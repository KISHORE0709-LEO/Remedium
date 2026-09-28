/**
 * POST /api/ai-analyze
 *
 * Multi-provider AI analysis with sequential fallback.
 *
 * Fallback order:
 *   1. Google Gemini    (GEMINI_API_KEY)
 *   2. Groq             (GROQ_API_KEY)   — uses openai/gpt-oss-20b with strict JSON schema
 *   3. AWS Bedrock      (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY)
 *   4. remedium-rules-v2  — deterministic, always succeeds
 *
 * Each provider is skipped automatically when its key is absent or a placeholder.
 * Providers are tried sequentially — never in parallel — to avoid wasting quota.
 *
 * A provider is skipped / falls through to the next on:
 *   - Missing or placeholder API key
 *   - Network error, timeout (8 s), rate-limit, or model not found
 *   - Response cannot be JSON-parsed
 *   - Required AiAnalysis fields are missing / null
 *   - passesSafetyCheck() detects clinical decision language
 *
 * Safety guarantees (applied to every LLM response):
 *   1. System prompt + instructions explicitly forbid clinical decisions.
 *   2. passesSafetyCheck() scans all 5 text fields for forbidden phrases.
 *   3. validateRequiredFields() ensures minimum schema shape.
 *   4. Low-confidence or incomplete analysis forces requiresHumanReview = true.
 *   5. All API keys have NO NEXT_PUBLIC_ prefix — never bundled in the browser.
 *   6. Only the provider label (e.g. "remedium-groq-v1") is stored in the
 *      returned modelVersion; no secret is ever written to Firestore or logged.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import Groq from 'groq-sdk'
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message as BedrockMessage,
} from '@aws-sdk/client-bedrock-runtime'
import { analyzeRefillIntake, type RefillIntake } from '@/lib/remedium/ai-engine'
import type { AiAnalysis } from '@/lib/remedium/types'

// ─── Model constants ──────────────────────────────────────────────────────────
const GEMINI_MODEL  = 'gemini-3.5-flash'
// openai/gpt-oss-20b: supports strict structured output on Groq (constrained decoding)
const GROQ_MODEL    = 'openai/gpt-oss-20b'
// Amazon Nova Lite via Bedrock Converse + tool_use for structured output
const BEDROCK_MODEL = 'us.amazon.nova-lite-v1:0'

const PROVIDER_TIMEOUT_MS = 8000
const GEMINI_MAX_RETRIES  = 2
const GEMINI_RETRY_BASE   = 1000   // 1 s, 2 s backoff

const HUMAN_REVIEW_CONFIDENCE_THRESHOLD = 0.60

// ─── Strict JSON schema for Groq structured output ───────────────────────────
// Groq strict mode requires:
//   - additionalProperties: false on every object
//   - all properties listed in "required"
//   - optional fields expressed as ["string", "null"] union
const GROQ_STRICT_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  properties: {
    stuckReason:         { type: ['string', 'null'] as any },
    blocker:             { type: ['string', 'null'] as any },
    priority:            { type: 'string', enum: ['urgent', 'high', 'standard', 'low'] },
    priorityReason:      { type: 'string' },
    responsibleRole:     { type: 'string', enum: ['patient', 'pharmacy', 'provider', 'insurance', 'remedium', 'none'] },
    nextAction:          { type: 'string' },
    summary:             { type: 'string' },
    confidence:          { type: 'number' },
    draftMessage:        { type: 'string' },
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

// Gemini schema (supports array types natively, no additionalProperties needed)
const GEMINI_SCHEMA = {
  type: 'object',
  description: 'Structured administrative analysis of a prescription refill request.',
  properties: {
    stuckReason:         { type: ['string', 'null'] as any, description: 'One sentence why refill is blocked. null if not blocked.' },
    blocker:             { type: ['string', 'null'] as any, description: 'Short blocker label. null if none.' },
    priority:            { type: 'string', enum: ['urgent', 'high', 'standard', 'low'] },
    priorityReason:      { type: 'string', description: 'One sentence explaining priority.' },
    responsibleRole:     { type: 'string', enum: ['patient', 'pharmacy', 'provider', 'insurance', 'remedium', 'none'] },
    nextAction:          { type: 'string', description: 'Next administrative action. NOT a clinical decision.' },
    summary:             { type: 'string', description: '2-3 sentence summary for pharmacists/providers.' },
    confidence:          { type: 'number', minimum: 0, maximum: 1 },
    draftMessage:        { type: 'string', description: 'Ready-to-send message. No clinical decisions.' },
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
const REQUIRED: (keyof AiAnalysis)[] = [
  'summary', 'nextAction', 'priority', 'responsibleRole', 'confidence',
]
function validateRequiredFields(p: Partial<AiAnalysis>): string[] {
  return REQUIRED.filter((f) => p[f] === undefined || p[f] === null)
}

// ─── Sanitize fabricated PA actions ──────────────────────────────────────────
function sanitize(text: string | null | undefined): string {
  if (!text) return text ?? ''
  return text
    .replace(/PA packet (?:has been |was |is )(?:auto-assembled|assembled|submitted|pre-filled|compiled)[^.]*\./gi,
      'Prior authorization documentation is required from the prescriber.')
    .replace(/Remedium (?:has )?pre-(?:assembled|filled|compiled)[^.]*PA[^.]*\./gi,
      'PA documentation is required by the payer.')
    .replace(/auto-assembled[^.]*PA[^.]*\./gi, 'PA documentation is required.')
}

// ─── Merge LLM result with deterministic baseline ────────────────────────────
function merge(parsed: Partial<AiAnalysis>, baseline: AiAnalysis, now: number, version: string): AiAnalysis {
  const conf    = typeof parsed.confidence === 'number' ? parsed.confidence : baseline.confidence
  const missing = Array.isArray(parsed.missingFields) ? parsed.missingFields : baseline.missingFields
  const forced  = conf < HUMAN_REVIEW_CONFIDENCE_THRESHOLD || missing.length >= 3
  return {
    stuckReason:         parsed.stuckReason         ?? baseline.stuckReason,
    blocker:             parsed.blocker             ?? baseline.blocker,
    priority:            parsed.priority            ?? baseline.priority,
    priorityReason:      parsed.priorityReason      ?? baseline.priorityReason,
    responsibleRole:     parsed.responsibleRole     ?? baseline.responsibleRole,
    nextAction:          parsed.nextAction          ?? baseline.nextAction,
    summary:             sanitize(parsed.summary      ?? baseline.summary),
    confidence:          conf,
    draftMessage:        sanitize(parsed.draftMessage ?? baseline.draftMessage),
    missingFields:       missing,
    requiresHumanReview: forced || (parsed.requiresHumanReview ?? baseline.requiresHumanReview),
    analyzedAt:          now,
    modelVersion:        version,
  }
}

// ─── Shared prompt ────────────────────────────────────────────────────────────
function prompt(intake: RefillIntake, baseline: AiAnalysis, now: number, version: string): string {
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

Output ONLY valid JSON matching the AiAnalysis schema.
Use analyzedAt: ${now}
Use modelVersion: "${version}"`
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider 1: Google Gemini
// ─────────────────────────────────────────────────────────────────────────────
async function tryGemini(intake: RefillIntake, baseline: AiAnalysis, now: number): Promise<AiAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key-here') return null

  const version = 'remedium-gemini-v1'
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

  let raw = '', lastErr: any = null
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, GEMINI_RETRY_BASE * attempt))
    try {
      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt(intake, baseline, now, version),
        config: {
          responseFormat: { text: { mimeType: 'application/json', schema: GEMINI_SCHEMA } },
          temperature: 0.2,
          maxOutputTokens: 1200,
          systemInstruction:
            'You are a healthcare administrative assistant. Output only valid JSON. ' +
            'Never make clinical decisions, approve or reject prescriptions, ' +
            'change dosages, or override insurance decisions. ' +
            'Flag conflicting/ambiguous cases with requiresHumanReview: true.',
        },
      })
      raw = res.text ?? ''
      lastErr = null
      break
    } catch (err: any) {
      lastErr = err
      if (!isRetryable(err) || attempt === GEMINI_MAX_RETRIES) break
    }
  }
  if (lastErr) { console.warn('[ai-analyze] Gemini failed:', lastErr?.message ?? String(lastErr)); return null }

  try {
    const parsed: Partial<AiAnalysis> = JSON.parse(raw)
    const missing = validateRequiredFields(parsed)
    if (missing.length > 0) { console.warn('[ai-analyze] Gemini missing fields:', missing); return null }
    if (!passesSafetyCheck(parsed)) { console.warn('[ai-analyze] Gemini failed safety check'); return null }
    return merge(parsed, baseline, now, version)
  } catch {
    console.warn('[ai-analyze] Gemini JSON parse failed')
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider 2: Groq  (openai/gpt-oss-20b, strict JSON schema)
// ─────────────────────────────────────────────────────────────────────────────
async function tryGroq(intake: RefillIntake, baseline: AiAnalysis, now: number): Promise<AiAnalysis | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || apiKey.startsWith('your-')) return null

  const version = 'remedium-groq-v1'
  const groq = new Groq({ apiKey })

  try {
    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)

    const completion = await groq.chat.completions.create(
      {
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a healthcare administrative assistant. Output ONLY valid JSON matching the schema. ' +
              'Never make clinical decisions, approve or reject prescriptions, change dosages, or override insurance decisions. ' +
              'Flag conflicting/ambiguous cases with requiresHumanReview: true.',
          },
          { role: 'user', content: prompt(intake, baseline, now, version) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'ai_analysis',
            strict: true,
            schema: GROQ_STRICT_SCHEMA,
          },
        } as any,
        temperature: 0.2,
        max_tokens: 1200,
      },
      { signal: controller.signal },
    )
    clearTimeout(timeoutId)

    const raw = completion.choices?.[0]?.message?.content ?? ''
    if (!raw) { console.warn('[ai-analyze] Groq empty response'); return null }

    const parsed: Partial<AiAnalysis> = JSON.parse(raw)
    const missing = validateRequiredFields(parsed)
    if (missing.length > 0) { console.warn('[ai-analyze] Groq missing fields:', missing); return null }
    if (!passesSafetyCheck(parsed)) { console.warn('[ai-analyze] Groq failed safety check'); return null }
    return merge(parsed, baseline, now, version)
  } catch (err: any) {
    console.warn('[ai-analyze] Groq failed:', err?.message ?? String(err))
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider 3: AWS Bedrock  (Amazon Nova Lite via Converse + tool_use)
// ─────────────────────────────────────────────────────────────────────────────
async function tryBedrock(intake: RefillIntake, baseline: AiAnalysis, now: number): Promise<AiAnalysis | null> {
  const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK
  const region      = process.env.AWS_REGION ?? 'us-east-1'

  if (!bearerToken || bearerToken.startsWith('your-')) return null

  const version = 'remedium-bedrock-v1'

  const toolSchema = {
    type: 'object' as const,
    properties: {
      stuckReason:         { type: 'string', description: 'Why blocked, or empty string.' },
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
    const client = new BedrockRuntimeClient({ region })
    const messages: BedrockMessage[] = [{ role: 'user', content: [{ text: prompt(intake, baseline, now, version) }] }]

    const command = new ConverseCommand({
      modelId: BEDROCK_MODEL,
      messages,
      system: [{ text:
        'You are a healthcare administrative assistant. Call the analyze_refill tool with your analysis. ' +
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
        toolChoice: { tool: { name: 'analyze_refill' } },
      },
      inferenceConfig: { temperature: 0.2, maxTokens: 1200 },
    })

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Bedrock timeout')), PROVIDER_TIMEOUT_MS),
    )
    const response = await Promise.race([client.send(command), timeout])

    const toolUse = (response.output?.message?.content ?? []).find((b: any) => b.toolUse?.name === 'analyze_refill')
    if (!toolUse) { console.warn('[ai-analyze] Bedrock: no tool_use block'); return null }

    const parsed = { ...toolUse.toolUse?.input as Partial<AiAnalysis>, analyzedAt: now, modelVersion: version, stuckReason: (toolUse.toolUse?.input as any)?.stuckReason ?? null, blocker: (toolUse.toolUse?.input as any)?.blocker ?? null }
    const missing = validateRequiredFields(parsed)
    if (missing.length > 0) { console.warn('[ai-analyze] Bedrock missing fields:', missing); return null }
    if (!passesSafetyCheck(parsed)) { console.warn('[ai-analyze] Bedrock failed safety check'); return null }
    return merge(parsed, baseline, now, version)
  } catch (err: any) {
    console.warn('[ai-analyze] Bedrock failed:', err?.message ?? String(err))
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

  // Deterministic baseline — always runs first; guaranteed fallback if all LLMs fail
  const baseline = analyzeRefillIntake(intake)
  const now = Date.now()

  // Sequential fallback: Bedrock → Gemini → Groq → deterministic
  const providers = [
    { name: 'Bedrock', fn: () => tryBedrock(intake, baseline, now) },
    { name: 'Gemini',  fn: () => tryGemini(intake, baseline, now)  },
    { name: 'Groq',    fn: () => tryGroq(intake, baseline, now)    },
  ]

  for (const { name, fn } of providers) {
    try {
      const result = await fn()
      if (result) {
        return NextResponse.json(result, { status: 200 })
      }
    } catch (err: any) {
      console.error(`[ai-analyze] Unexpected error from ${name}:`, err?.message ?? String(err))
    }
  }

  // All LLM providers failed — deterministic fallback always succeeds
  console.info('[ai-analyze] All LLM providers failed — using deterministic remedium-rules-v2 fallback')
  return NextResponse.json(baseline, { status: 200 })
}
