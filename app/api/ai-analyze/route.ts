/**
 * POST /api/ai-analyze
 *
 * Multi-provider AI analysis with sequential fallback.
 *
 * Architecture:
 *   Frontend → POST /api/ai-analyze  (server-only Route Handler)
 *            → Deterministic engine → baseline AiAnalysis (always runs first)
 *            → Try providers in order until one succeeds:
 *                1. Google Gemini  (GEMINI_API_KEY)
 *                2. AWS Bedrock    (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY)
 *                3. xAI / Grok    (XAI_API_KEY)
 *                4. remedium-rules-v2  (deterministic, always succeeds)
 *            → Safety validator on every LLM response
 *            → Merge: LLM fields enrich baseline; baseline fills any gaps
 *   Frontend ← AiAnalysis JSON (200) — always succeeds
 *
 * Fallback triggers for each provider:
 *   - API key missing / placeholder
 *   - Network error, timeout (8 s), rate-limit, or model not found
 *   - Response is not valid JSON
 *   - Required AiAnalysis fields are missing or null
 *   - Safety validator detects clinical decision language
 *   - Confidence below threshold (forcedHumanReview escalation still applied)
 *
 * Safety guarantees (enforced across all providers):
 *   1. System prompt / instructions forbid clinical decisions.
 *   2. passesSafetyCheck() scans all text fields after every LLM call.
 *   3. validateRequiredFields() ensures minimum shape.
 *   4. All API keys have NO NEXT_PUBLIC_ prefix — never bundled in the browser.
 *   5. Only the provider name (never any key or secret) is recorded in the
 *      returned modelVersion string.
 *   6. If all providers fail, remedium-rules-v2 runs synchronously.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message as BedrockMessage,
} from '@aws-sdk/client-bedrock-runtime'
import { analyzeRefillIntake, type RefillIntake } from '@/lib/remedium/ai-engine'
import type { AiAnalysis } from '@/lib/remedium/types'

// ─── Model constants ─────────────────────────────────────────────────────────
const GEMINI_MODEL    = 'gemini-3.5-flash'
const BEDROCK_MODEL   = 'anthropic.claude-3-5-haiku-20241022-v1:0'  // fast + cheap Claude on Bedrock
const GROK_MODEL      = 'grok-3-mini'  // fast reasoning model, JSON mode supported
const GROK_BASE_URL   = 'https://api.x.ai/v1'

const PROVIDER_TIMEOUT_MS = 8000   // 8 seconds per provider
const GEMINI_MAX_RETRIES  = 2
const GEMINI_RETRY_BASE   = 1000   // 1 s, 2 s

const HUMAN_REVIEW_CONFIDENCE_THRESHOLD = 0.60

// ─── Shared JSON schema (used by all providers) ───────────────────────────────
const AI_ANALYSIS_SCHEMA = {
  type: 'object',
  description: 'Structured administrative analysis of a prescription refill request.',
  properties: {
    stuckReason:         { type: ['string', 'null'],  description: 'One sentence why refill is blocked. null if not blocked.' },
    blocker:             { type: ['string', 'null'],  description: 'Short blocker label. null if none.' },
    priority:            { type: 'string', enum: ['urgent', 'high', 'standard', 'low'] },
    priorityReason:      { type: 'string',            description: 'One sentence explaining priority.' },
    responsibleRole:     { type: 'string', enum: ['patient', 'pharmacy', 'provider', 'insurance', 'remedium', 'none'] },
    nextAction:          { type: 'string',            description: 'Next administrative action. NOT a clinical decision.' },
    summary:             { type: 'string',            description: '2-3 sentence summary for pharmacists/providers.' },
    confidence:          { type: 'number', minimum: 0, maximum: 1 },
    draftMessage:        { type: 'string',            description: 'Ready-to-send message. No clinical decisions.' },
    missingFields:       { type: 'array', items: { type: 'string' } },
    requiresHumanReview: { type: 'boolean' },
    analyzedAt:          { type: 'number' },
    modelVersion:        { type: 'string' },
  },
  required: [
    'stuckReason', 'blocker', 'priority', 'priorityReason', 'responsibleRole',
    'nextAction', 'summary', 'confidence', 'draftMessage', 'missingFields',
    'requiresHumanReview', 'analyzedAt', 'modelVersion',
  ],
}

// ─── Safety validator ─────────────────────────────────────────────────────────
function passesSafetyCheck(parsed: Partial<AiAnalysis>): boolean {
  const FORBIDDEN = [
    'approve this refill', 'approving this refill',
    'reject this refill', 'rejecting this refill',
    'deny this refill', 'denying this refill',
    'refill is approved', 'refill has been approved',
    'change the dosage', 'changing the dosage',
    'change the medication', 'changing the medication',
    'alter the dosage', 'alter the medication',
    'modify the dosage', 'modify the prescription',
    'override the insurance', 'overriding the insurance',
    'bypass the insurance', 'ignore the insurance',
    'clinical decision', 'clinical recommendation',
    'prescribe', 'diagnose', 'medical advice',
  ]
  const fields = [
    parsed.nextAction ?? '', parsed.draftMessage ?? '',
    parsed.summary ?? '', parsed.stuckReason ?? '', parsed.priorityReason ?? '',
  ]
  for (const f of fields) {
    const lower = f.toLowerCase()
    for (const p of FORBIDDEN) { if (lower.includes(p)) return false }
  }
  return true
}

// ─── Required-field validator ─────────────────────────────────────────────────
const REQUIRED_FIELDS: (keyof AiAnalysis)[] = [
  'summary', 'nextAction', 'priority', 'responsibleRole', 'confidence',
]
function validateRequiredFields(parsed: Partial<AiAnalysis>): string[] {
  return REQUIRED_FIELDS.filter((f) => parsed[f] === undefined || parsed[f] === null)
}

// ─── Sanitize fabricated PA actions ─────────────────────────────────────────
function sanitizeFabricatedActions(text: string | null | undefined): string {
  if (!text) return text ?? ''
  return text
    .replace(/PA packet (?:has been |was |is )(?:auto-assembled|assembled|submitted|pre-filled|compiled)[^.]*\./gi,
      'Prior authorization documentation is required from the prescriber.')
    .replace(/Remedium (?:has )?pre-(?:assembled|filled|compiled)[^.]*PA[^.]*\./gi,
      'PA documentation is required by the payer.')
    .replace(/auto-assembled[^.]*PA[^.]*\./gi,
      'PA documentation is required.')
}

// ─── Merge LLM result with deterministic baseline ────────────────────────────
function mergeWithBaseline(
  parsed: Partial<AiAnalysis>,
  baseline: AiAnalysis,
  now: number,
  providerVersion: string,
): AiAnalysis {
  const mergedConfidence    = typeof parsed.confidence === 'number' ? parsed.confidence : baseline.confidence
  const mergedMissingFields = Array.isArray(parsed.missingFields) ? parsed.missingFields : baseline.missingFields
  const forcedHumanReview   =
    mergedConfidence < HUMAN_REVIEW_CONFIDENCE_THRESHOLD || mergedMissingFields.length >= 3

  return {
    stuckReason:         parsed.stuckReason         ?? baseline.stuckReason,
    blocker:             parsed.blocker             ?? baseline.blocker,
    priority:            parsed.priority            ?? baseline.priority,
    priorityReason:      parsed.priorityReason      ?? baseline.priorityReason,
    responsibleRole:     parsed.responsibleRole     ?? baseline.responsibleRole,
    nextAction:          parsed.nextAction          ?? baseline.nextAction,
    summary:             sanitizeFabricatedActions(parsed.summary      ?? baseline.summary),
    confidence:          mergedConfidence,
    draftMessage:        sanitizeFabricatedActions(parsed.draftMessage ?? baseline.draftMessage),
    missingFields:       mergedMissingFields,
    requiresHumanReview: forcedHumanReview || (parsed.requiresHumanReview ?? baseline.requiresHumanReview),
    analyzedAt:          now,
    modelVersion:        providerVersion,
  }
}

// ─── Shared prompt text ───────────────────────────────────────────────────────
function buildPromptText(intake: RefillIntake, baseline: AiAnalysis, now: number, modelVersion: string): string {
  return `You are Remedium AI, a healthcare administrative assistant coordinating prescription refill workflows.

HARD RULES — you must NEVER:
1. Approve or reject a prescription or refill
2. Change medication name, dosage, strength, or quantity
3. Override or contradict an insurance coverage decision
4. Make clinical decisions of any kind
5. Recommend bypassing a licensed provider, pharmacist, or insurer

If data is conflicting or ambiguous, set requiresHumanReview to true and confidence below 0.6.

REFILL INTAKE DATA:
${JSON.stringify(intake, null, 2)}

DETERMINISTIC BASELINE — enrich this, do NOT contradict it:
${JSON.stringify(baseline, null, 2)}

INSTRUCTIONS:
- Write a clear, specific stuckReason for this patient and medication.
- Write a summary a pharmacist or provider would find immediately useful.
- Write a professional draft message ready to send.
- Use analyzedAt: ${now}
- Use modelVersion: "${modelVersion}"
- Output ONLY valid JSON matching the AiAnalysis schema. No extra text.`
}

// ─── Provider 1: Google Gemini ────────────────────────────────────────────────
async function tryGemini(
  intake: RefillIntake,
  baseline: AiAnalysis,
  now: number,
): Promise<AiAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key-here') return null

  const providerVersion = 'remedium-gemini-v1'
  const ai = new GoogleGenAI({ apiKey })

  function isRetryable(err: any): boolean {
    const msg = String(err?.message ?? err)
    return (
      msg.includes('"code":503') || msg.includes('"code":429') ||
      msg.includes('503') || msg.includes('429') ||
      msg.includes('RESOURCE_EXHAUSTED') || msg.includes('overloaded') ||
      msg.includes('high demand') || msg.includes('rate limit') || msg.includes('quota')
    )
  }

  let raw = ''
  let lastErr: any = null
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, GEMINI_RETRY_BASE * attempt))
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: buildPromptText(intake, baseline, now, providerVersion),
        config: {
          responseFormat: { text: { mimeType: 'application/json', schema: AI_ANALYSIS_SCHEMA } },
          temperature: 0.2,
          maxOutputTokens: 1200,
          systemInstruction:
            'You are a healthcare administrative assistant. Output only valid JSON. ' +
            'Never make clinical decisions, approve or reject prescriptions, ' +
            'change dosages, or override insurance decisions. ' +
            'Flag conflicting/ambiguous cases with requiresHumanReview: true.',
        },
      })
      raw = response.text ?? ''
      lastErr = null
      break
    } catch (err: any) {
      lastErr = err
      if (!isRetryable(err) || attempt === GEMINI_MAX_RETRIES) break
    }
  }

  if (lastErr) {
    console.warn('[ai-analyze] Gemini failed:', lastErr?.message ?? String(lastErr))
    return null
  }

  try {
    const parsed: Partial<AiAnalysis> = JSON.parse(raw)
    const missing = validateRequiredFields(parsed)
    if (missing.length > 0) {
      console.warn('[ai-analyze] Gemini missing fields:', missing)
      return null
    }
    if (!passesSafetyCheck(parsed)) {
      console.warn('[ai-analyze] Gemini failed safety check')
      return null
    }
    return mergeWithBaseline(parsed, baseline, now, providerVersion)
  } catch {
    console.warn('[ai-analyze] Gemini JSON parse failed, raw:', raw.slice(0, 100))
    return null
  }
}

// ─── Provider 2: AWS Bedrock (Claude via Converse API) ───────────────────────
async function tryBedrock(
  intake: RefillIntake,
  baseline: AiAnalysis,
  now: number,
): Promise<AiAnalysis | null> {
  const accessKeyId     = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const region          = process.env.AWS_REGION ?? 'us-east-1'

  if (
    !accessKeyId || accessKeyId === 'your-aws-access-key-id-here' ||
    !secretAccessKey || secretAccessKey === 'your-aws-secret-access-key-here'
  ) return null

  const providerVersion = 'remedium-bedrock-v1'
  const promptText = buildPromptText(intake, baseline, now, providerVersion)

  // Use tool_use to enforce structured JSON output from Claude on Bedrock.
  // Claude will call the "analyze_refill" tool with a structured argument matching
  // the AiAnalysis schema — this is more reliable than asking it to output raw JSON.
  const toolSchema = {
    type: 'object' as const,
    properties: {
      stuckReason:         { type: 'string', description: 'Why the refill is blocked, or empty string.' },
      blocker:             { type: 'string', description: 'Short blocker label, or empty string.' },
      priority:            { type: 'string', enum: ['urgent', 'high', 'standard', 'low'] },
      priorityReason:      { type: 'string' },
      responsibleRole:     { type: 'string', enum: ['patient', 'pharmacy', 'provider', 'insurance', 'remedium', 'none'] },
      nextAction:          { type: 'string' },
      summary:             { type: 'string' },
      confidence:          { type: 'number' },
      draftMessage:        { type: 'string' },
      missingFields:       { type: 'array', items: { type: 'string' } },
      requiresHumanReview: { type: 'boolean' },
    },
    required: ['priority', 'priorityReason', 'responsibleRole', 'nextAction', 'summary', 'confidence', 'draftMessage', 'missingFields', 'requiresHumanReview'],
  }

  try {
    const client = new BedrockRuntimeClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    })

    const messages: BedrockMessage[] = [{ role: 'user', content: [{ text: promptText }] }]

    const command = new ConverseCommand({
      modelId: BEDROCK_MODEL,
      messages,
      system: [{ text:
        'You are a healthcare administrative assistant. ' +
        'You must call the analyze_refill tool with your analysis. ' +
        'Never make clinical decisions, approve or reject prescriptions, or change medication details.',
      }],
      toolConfig: {
        tools: [{
          toolSpec: {
            name: 'analyze_refill',
            description: 'Analyze a prescription refill request and return structured administrative analysis.',
            inputSchema: { json: toolSchema as any },
          },
        }],
        toolChoice: { tool: { name: 'analyze_refill' } },  // force tool use
      },
      inferenceConfig: { temperature: 0.2, maxTokens: 1200 },
    })

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Bedrock timeout')), PROVIDER_TIMEOUT_MS),
    )
    const response = await Promise.race([client.send(command), timeoutPromise])

    // Extract tool use result
    const output = response.output?.message?.content ?? []
    const toolUse = output.find((b: any) => b.toolUse?.name === 'analyze_refill')
    if (!toolUse) {
      console.warn('[ai-analyze] Bedrock: no tool_use block in response')
      return null
    }

    const parsed = toolUse.toolUse?.input as Partial<AiAnalysis>
    // Add fields that weren't in the tool schema
    parsed.analyzedAt   = now
    parsed.modelVersion = providerVersion
    parsed.stuckReason  = (parsed.stuckReason as any) || null
    parsed.blocker      = (parsed.blocker as any) || null

    const missing = validateRequiredFields(parsed)
    if (missing.length > 0) {
      console.warn('[ai-analyze] Bedrock missing fields:', missing)
      return null
    }
    if (!passesSafetyCheck(parsed)) {
      console.warn('[ai-analyze] Bedrock failed safety check')
      return null
    }
    return mergeWithBaseline(parsed, baseline, now, providerVersion)
  } catch (err: any) {
    console.warn('[ai-analyze] Bedrock failed:', err?.message ?? String(err))
    return null
  }
}

// ─── Provider 3: xAI / Grok (OpenAI-compatible) ──────────────────────────────
async function tryGrok(
  intake: RefillIntake,
  baseline: AiAnalysis,
  now: number,
): Promise<AiAnalysis | null> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey || apiKey === 'your-xai-api-key-here') return null

  const providerVersion = 'remedium-grok-v1'
  const promptText = buildPromptText(intake, baseline, now, providerVersion)

  try {
    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)

    const res = await fetch(`${GROK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a healthcare administrative assistant. Output ONLY valid JSON matching the AiAnalysis schema. ' +
              'Never make clinical decisions, approve or reject prescriptions, change dosages, or override insurance decisions. ' +
              'Flag conflicting/ambiguous cases with requiresHumanReview: true.',
          },
          { role: 'user', content: promptText },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 1200,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      console.warn('[ai-analyze] Grok HTTP error:', res.status, res.statusText)
      return null
    }

    const data = await res.json()
    const raw: string = data?.choices?.[0]?.message?.content ?? ''
    if (!raw) {
      console.warn('[ai-analyze] Grok empty response')
      return null
    }

    const parsed: Partial<AiAnalysis> = JSON.parse(raw)
    const missing = validateRequiredFields(parsed)
    if (missing.length > 0) {
      console.warn('[ai-analyze] Grok missing fields:', missing)
      return null
    }
    if (!passesSafetyCheck(parsed)) {
      console.warn('[ai-analyze] Grok failed safety check')
      return null
    }
    return mergeWithBaseline(parsed, baseline, now, providerVersion)
  } catch (err: any) {
    console.warn('[ai-analyze] Grok failed:', err?.message ?? String(err))
    return null
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let intake: RefillIntake
  try {
    intake = await req.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  }

  // Always run the deterministic engine first — it is both the baseline for LLMs
  // to enrich and the guaranteed final fallback if every provider fails.
  const baseline = analyzeRefillIntake(intake)
  const now = Date.now()

  // ── Sequential provider fallback ─────────────────────────────────────────
  // Try each provider in order. The first one that returns a valid, safe
  // AiAnalysis wins. If all fail, we use the deterministic baseline.
  //
  // We do NOT run providers in parallel — parallel calls would waste quota on
  // providers that don't need to be used.
  const providers: Array<{
    name: string
    fn: () => Promise<AiAnalysis | null>
  }> = [
    { name: 'Gemini',  fn: () => tryGemini(intake, baseline, now)  },
    { name: 'Bedrock', fn: () => tryBedrock(intake, baseline, now) },
    { name: 'Grok',    fn: () => tryGrok(intake, baseline, now)    },
  ]

  for (const { name, fn } of providers) {
    try {
      const result = await fn()
      if (result) {
        // Provider succeeded — return its enriched analysis
        return NextResponse.json(result, { status: 200 })
      }
      // null means provider was skipped (no key) or failed — try next
    } catch (err: any) {
      // Unexpected error — log and continue to next provider
      console.error(`[ai-analyze] Unexpected error from ${name}:`, err?.message ?? String(err))
    }
  }

  // ── All providers failed — use deterministic fallback ─────────────────────
  // This path is reached only when every external provider is either
  // unconfigured, errored, or returned an unsafe/incomplete response.
  // The deterministic engine always produces a valid AiAnalysis.
  console.info('[ai-analyze] All LLM providers failed — using deterministic remedium-rules-v2 fallback')
  return NextResponse.json(baseline, { status: 200 })
}
