/**
 * POST /api/ai-analyze
 *
 * Server-side Gemini LLM handler for Remedium AI analysis.
 *
 * Architecture:
 *   Frontend → POST /api/ai-analyze  (Next.js App Router Route Handler — server only)
 *            → Deterministic engine runs first → produces baseline AiAnalysis
 *            → Google Gemini API (gemini-2.5-flash, structured JSON output)
 *               enriches the baseline with richer language and reasoning
 *            → Safety validator rejects any clinical decision language
 *            → Merge: LLM fields overwrite baseline; missing LLM fields fall
 *              back to the deterministic baseline value
 *   Frontend ← AiAnalysis JSON (200) or 503 if Gemini is unavailable
 *   The caller (firestore-service.ts) falls back to analyzeRefillIntake()
 *   directly when it receives a non-200 response, so the refill workflow
 *   never stalls.
 *
 * Safety guarantees (enforced at multiple layers):
 *   1. System instruction in the Gemini prompt forbids clinical decisions.
 *   2. passesSafetyCheck() scans nextAction + draftMessage for decision language.
 *   3. The GEMINI_API_KEY env var has no NEXT_PUBLIC_ prefix → never bundled
 *      into the browser bundle or logged anywhere in this file.
 *   4. On any failure (missing key, API error, timeout, bad JSON, safety
 *      violation) the route returns 503; the client falls back to the
 *      deterministic engine.
 *
 * Model: gemini-2.5-flash
 *   - Available on the Gemini API free tier
 *   - Supports structured JSON output via responseFormat config
 *   - Fast enough for synchronous refill intake processing
 *
 * SDK: @google/genai  (the official unified Google Gen AI JS/TS SDK, GA May 2025)
 *   NOT the deprecated @google/generative-ai package.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { analyzeRefillIntake, type RefillIntake } from '@/lib/remedium/ai-engine'
import type { AiAnalysis } from '@/lib/remedium/types'

// gemini-2.5-flash: free-tier eligible, structured output supported, fast
const GEMINI_MODEL = 'gemini-2.5-flash'
const MODEL_VERSION = 'remedium-gemini-v1'

// ─── AiAnalysis JSON Schema for Gemini structured output ─────────────────────
// Matches the AiAnalysis interface in lib/remedium/types.ts exactly.
// Gemini's structured output mode guarantees a syntactically valid response
// that matches this schema, eliminating most JSON parse failures.
const AI_ANALYSIS_SCHEMA = {
  type: 'object',
  description: 'Structured administrative analysis of a prescription refill request. Never approves, rejects, or makes clinical decisions.',
  properties: {
    stuckReason: {
      type: ['string', 'null'],
      description: 'One sentence explaining why the refill is currently blocked. null if not blocked.',
    },
    blocker: {
      type: ['string', 'null'],
      description: 'Short label for the current blocker. null if none.',
    },
    priority: {
      type: 'string',
      enum: ['urgent', 'high', 'standard', 'low'],
      description: 'Case priority based on supply days remaining and clinical urgency.',
    },
    priorityReason: {
      type: 'string',
      description: 'One sentence explaining why this priority was assigned.',
    },
    responsibleRole: {
      type: 'string',
      enum: ['patient', 'pharmacy', 'provider', 'insurance', 'remedium', 'none'],
      description: 'The role responsible for the next action.',
    },
    nextAction: {
      type: 'string',
      description: 'The next administrative action required. Must NOT be a clinical decision.',
    },
    summary: {
      type: 'string',
      description: '2-3 sentence human-readable summary of the case for pharmacists and providers.',
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Confidence score from 0.0 to 1.0.',
    },
    draftMessage: {
      type: 'string',
      description: 'Ready-to-send professional message to the responsible party. Must NOT approve, reject, or make clinical decisions.',
    },
    missingFields: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of required fields that are missing from the intake. Empty array if none.',
    },
    requiresHumanReview: {
      type: 'boolean',
      description: 'true if data is conflicting, ambiguous, or involves safety-sensitive clinical concerns.',
    },
    analyzedAt: {
      type: 'number',
      description: 'Unix milliseconds timestamp of when the analysis was performed.',
    },
    modelVersion: {
      type: 'string',
      description: 'The model/version string identifying this analysis.',
    },
  },
  required: [
    'stuckReason',
    'blocker',
    'priority',
    'priorityReason',
    'responsibleRole',
    'nextAction',
    'summary',
    'confidence',
    'draftMessage',
    'missingFields',
    'requiresHumanReview',
    'analyzedAt',
    'modelVersion',
  ],
}

// ─── Safety validator ─────────────────────────────────────────────────────────
// Reject any Gemini response that attempts to make a clinical or coverage decision.
// Scans only nextAction and draftMessage — the fields most likely to contain
// an erroneous instruction.
function passesSafetyCheck(parsed: Partial<AiAnalysis>): boolean {
  const fieldsToScan = [parsed.nextAction ?? '', parsed.draftMessage ?? '']
  for (const field of fieldsToScan) {
    const lower = field.toLowerCase()
    if (
      lower.includes('approve this refill') ||
      lower.includes('reject this refill') ||
      lower.includes('deny this refill') ||
      lower.includes('change the dosage') ||
      lower.includes('change the medication') ||
      lower.includes('override the insurance')
    ) {
      return false
    }
  }
  return true
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(intake: RefillIntake, baseline: AiAnalysis, now: number): string {
  return `You are Remedium AI, a healthcare administrative assistant that coordinates prescription refill workflows.

HARD RULES — you must NEVER:
1. Approve or reject a prescription or refill
2. Change medication name, dosage, strength, or quantity
3. Override or contradict an insurance coverage decision
4. Make clinical decisions of any kind
5. Recommend that anyone bypass a licensed provider, pharmacist, or insurer

If data is conflicting or ambiguous, set requiresHumanReview to true and lower the confidence below 0.6.

---
REFILL INTAKE DATA:
${JSON.stringify(intake, null, 2)}

DETERMINISTIC BASELINE — use this as the ground-truth workflow state.
Enrich it with clearer language and reasoning; do NOT contradict it:
${JSON.stringify(baseline, null, 2)}

---
INSTRUCTIONS:
- Write a clear, specific stuckReason tailored to this patient and medication.
- Write a summary that a pharmacist or provider would find immediately useful.
- Write a draft message that is professional, concise, and ready to send.
- Use analyzedAt: ${now}
- Use modelVersion: "${MODEL_VERSION}"
- Focus on administrative workflow coordination; never make clinical judgements.`
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Guard: GEMINI_API_KEY is server-side only, never NEXT_PUBLIC_
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    return NextResponse.json(
      { error: 'LLM_NOT_CONFIGURED', message: 'GEMINI_API_KEY not configured — using deterministic fallback' },
      { status: 503 },
    )
  }

  let intake: RefillIntake
  try {
    intake = await req.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  }

  // Run the deterministic engine as the baseline the LLM enriches from.
  // This also guarantees a valid fallback if Gemini fails at any point below.
  const baseline = analyzeRefillIntake(intake)
  const now = Date.now()

  let raw: string
  try {
    const ai = new GoogleGenAI({ apiKey })

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: buildPrompt(intake, baseline, now),
      config: {
        // Structured JSON output — Gemini guarantees schema-conformant responses
        responseFormat: {
          text: {
            mimeType: 'application/json',
            schema: AI_ANALYSIS_SCHEMA,
          },
        },
        temperature: 0.2,    // low temperature for consistent, fact-driven output
        maxOutputTokens: 1200,
        // System instruction enforces safety at the model level in addition to
        // the prompt-level rules above
        systemInstruction:
          'You are a healthcare administrative assistant. Output only valid JSON. ' +
          'Never make clinical decisions, approve or reject prescriptions, ' +
          'change dosages, or override insurance decisions. ' +
          'Flag conflicting or ambiguous cases with requiresHumanReview: true.',
      },
    })

    raw = response.text ?? ''
  } catch (err: any) {
    // Gemini API errors (rate limits, auth failures, network issues, etc.)
    console.error('[ai-analyze] Gemini API error:', err?.message ?? String(err))
    return NextResponse.json(
      { error: 'LLM_ERROR', message: err?.message ?? 'Gemini request failed' },
      { status: 503 },
    )
  }

  // Parse the response (structured output should always be valid JSON,
  // but we guard defensively)
  let parsed: Partial<AiAnalysis>
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('[ai-analyze] Failed to parse Gemini JSON response:', raw.slice(0, 200))
    return NextResponse.json({ error: 'INVALID_LLM_RESPONSE' }, { status: 503 })
  }

  // Safety check — reject responses that attempt clinical decisions
  if (!passesSafetyCheck(parsed)) {
    console.warn('[ai-analyze] Gemini response failed safety check — returning deterministic baseline')
    return NextResponse.json(baseline, { status: 200 })
  }

  // Merge: Gemini-enriched fields take priority; deterministic baseline fills
  // any field the LLM omitted or returned as null where we need a value.
  const result: AiAnalysis = {
    stuckReason:         parsed.stuckReason         ?? baseline.stuckReason,
    blocker:             parsed.blocker             ?? baseline.blocker,
    priority:            parsed.priority            ?? baseline.priority,
    priorityReason:      parsed.priorityReason      ?? baseline.priorityReason,
    responsibleRole:     parsed.responsibleRole     ?? baseline.responsibleRole,
    nextAction:          parsed.nextAction          ?? baseline.nextAction,
    summary:             parsed.summary             ?? baseline.summary,
    confidence:          typeof parsed.confidence === 'number' ? parsed.confidence : baseline.confidence,
    draftMessage:        parsed.draftMessage        ?? baseline.draftMessage,
    missingFields:       Array.isArray(parsed.missingFields) ? parsed.missingFields : baseline.missingFields,
    requiresHumanReview: parsed.requiresHumanReview ?? baseline.requiresHumanReview,
    analyzedAt:          now,
    modelVersion:        MODEL_VERSION,
  }

  return NextResponse.json(result, { status: 200 })
}
