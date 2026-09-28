/**
 * POST /api/scan-prescription
 *
 * Vision OCR for prescription images. Fallback order:
 *   1. AWS Bedrock — Claude 3.5 Haiku (uses AWS_BEARER_TOKEN_BEDROCK env var,
 *      automatically picked up by the SDK — no IAM keys needed)
 *   2. Google Gemini 3.5 Flash (vision, uses GEMINI_API_KEY)
 *   3. Groq llama-4-scout (vision, uses GROQ_API_KEY)
 *   4. 503 — pharmacist enters fields manually
 *
 * Safety: extracts only administrative fields. Pharmacist must review before submitting.
 * All API keys stay server-side only. Never logged or returned to client.
 */

import { NextRequest, NextResponse } from 'next/server'

// Tell Vercel this function can run up to 30 seconds (Pro plan) or 10s (Hobby)
export const maxDuration = 30
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message as BedrockMessage,
} from '@aws-sdk/client-bedrock-runtime'
import { GoogleGenAI } from '@google/genai'
import Groq from 'groq-sdk'

export interface ExtractedFields {
  patientName: string
  dob: string
  mrn: string
  phone: string
  allergies: string
  medication: string
  dosage: string
  sig: string
  quantity: string
  daysSupply: string
  prescriptionId: string
  provider: string
  plan: string
  reason: string
}

const EMPTY_FIELDS: ExtractedFields = {
  patientName: '', dob: '', mrn: '', phone: '', allergies: '',
  medication: '', dosage: '', sig: '', quantity: '', daysSupply: '',
  prescriptionId: '', provider: '', plan: '', reason: '',
}

const OCR_INSTRUCTION =
  'You are a pharmacy intake assistant. Extract prescription information from this image ' +
  'for administrative data entry only. Extract ONLY what is clearly written on the image. ' +
  'Do NOT interpret clinical meaning. Do NOT invent or modify medication names, dosages, or directions. ' +
  'If a field is illegible or absent, return an empty string. ' +
  'Respond ONLY with a valid JSON object. This data will be reviewed by a licensed pharmacist before any use.'

const JSON_KEYS_INSTRUCTION = `Return a JSON object with exactly these keys:
patientName (full name or empty), dob (MM/DD/YYYY or empty), mrn (or empty),
phone (or empty), allergies (or empty), medication (name exactly as written),
dosage (e.g. "500 mg"), sig (directions as written), quantity (number string e.g. "30"),
daysSupply (number string or empty), prescriptionId (Rx# or empty),
provider (prescriber name and credentials), plan (insurance plan or empty),
reason (indication if stated, else "Prescription refill"),
confidence (number 0-1 indicating overall OCR confidence),
warnings (array of strings for fields that were unclear or illegible).`

type ScanResult = { fields: ExtractedFields; confidence: number; warnings: string[]; provider: string }

function parseOcrJson(raw: string): { fields: ExtractedFields; confidence: number; warnings: string[] } | null {
  try {
    // Strip markdown code fences if the model wraps its output
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!parsed || typeof parsed !== 'object') return null

    const fields: ExtractedFields = {
      ...EMPTY_FIELDS,
      patientName:    String(parsed.patientName    ?? ''),
      dob:            String(parsed.dob            ?? ''),
      mrn:            String(parsed.mrn            ?? ''),
      phone:          String(parsed.phone          ?? ''),
      allergies:      String(parsed.allergies      ?? ''),
      medication:     String(parsed.medication     ?? ''),
      dosage:         String(parsed.dosage         ?? ''),
      sig:            String(parsed.sig            ?? ''),
      quantity:       String(parsed.quantity       ?? ''),
      daysSupply:     String(parsed.daysSupply     ?? ''),
      prescriptionId: String(parsed.prescriptionId ?? ''),
      provider:       String(parsed.provider       ?? ''),
      plan:           String(parsed.plan           ?? ''),
      reason:         String(parsed.reason         ?? 'Prescription refill'),
    }
    return {
      fields,
      confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.75,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
    }
  } catch {
    return null
  }
}

// ─── Provider 1: AWS Bedrock Claude 3.5 Haiku ─────────────────────────────────
// Uses AWS_BEARER_TOKEN_BEDROCK env var — automatically recognised by the SDK.
// No AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY needed.
async function tryBedrock(image: string, mimeType: string): Promise<ScanResult | null> {
  const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK
  const region      = process.env.AWS_REGION ?? 'us-east-1'

  if (!bearerToken || bearerToken.length < 20) {
    console.log('[scan] Bedrock: AWS_BEARER_TOKEN_BEDROCK not configured, skipping')
    return null
  }

  try {
    // The SDK automatically picks up AWS_BEARER_TOKEN_BEDROCK from process.env.
    // We create the client without explicit credentials — the SDK's default
    // credential chain reads the bearer token env var and uses it.
    const client = new BedrockRuntimeClient({ region })

    const imgFormat: 'jpeg' | 'png' | 'webp' =
      mimeType.includes('png')  ? 'png'  :
      mimeType.includes('webp') ? 'webp' : 'jpeg'

    const messages: BedrockMessage[] = [{
      role: 'user',
      content: [
        {
          image: {
            format: imgFormat,
            source: { bytes: Buffer.from(image, 'base64') },
          },
        },
        {
          text: OCR_INSTRUCTION + '\n\n' + JSON_KEYS_INSTRUCTION,
        },
      ],
    }]

    const command = new ConverseCommand({
      modelId: 'us.amazon.nova-lite-v1:0',
      messages,
      system: [{ text: 'You are a pharmacy intake assistant. Output only valid JSON. Never make clinical decisions.' }],
      inferenceConfig: { temperature: 0.1, maxTokens: 1000 },
    })

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Bedrock timeout')), 9000),
    )
    const response = await Promise.race([client.send(command), timeout])

    const raw = (response.output?.message?.content ?? [])
      .filter((b: any) => typeof b.text === 'string')
      .map((b: any) => b.text as string)
      .join('')

    if (!raw) { console.warn('[scan] Bedrock empty response'); return null }

    const result = parseOcrJson(raw)
    if (!result) { console.warn('[scan] Bedrock JSON parse failed, raw:', raw.slice(0, 200)); return null }

    console.log('[scan] Bedrock success, confidence:', result.confidence)
    return { ...result, provider: 'bedrock' }
  } catch (err: any) {
    console.warn('[scan] Bedrock failed:', err?.message ?? String(err))
    return null
  }
}

// ─── Provider 2: Google Gemini Vision ─────────────────────────────────────────
async function tryGemini(image: string, mimeType: string): Promise<ScanResult | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key-here') return null

  const ai = new GoogleGenAI({ apiKey })
  let lastErr: any = null

  for (let attempt = 0; attempt <= 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1200 * attempt))
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: [{
          role: 'user',
          parts: [
            { text: OCR_INSTRUCTION + '\n\n' + JSON_KEYS_INSTRUCTION },
            { inlineData: { mimeType: mimeType as any, data: image } },
          ],
        }],
        config: {
          responseFormat: {
            text: { mimeType: 'application/json', schema: {
              type: 'object',
              properties: {
                patientName: { type: 'string' }, dob: { type: 'string' },
                mrn: { type: 'string' }, phone: { type: 'string' },
                allergies: { type: 'string' }, medication: { type: 'string' },
                dosage: { type: 'string' }, sig: { type: 'string' },
                quantity: { type: 'string' }, daysSupply: { type: 'string' },
                prescriptionId: { type: 'string' }, provider: { type: 'string' },
                plan: { type: 'string' }, reason: { type: 'string' },
                confidence: { type: 'number' },
                warnings: { type: 'array', items: { type: 'string' } },
              },
              required: ['medication', 'provider', 'confidence', 'warnings'],
            }},
          },
          temperature: 0.1,
          maxOutputTokens: 1000,
        },
      })
      const raw = response.text ?? ''
      const result = parseOcrJson(raw)
      if (!result) { console.warn('[scan] Gemini parse failed'); return null }
      console.log('[scan] Gemini success')
      return { ...result, provider: 'gemini' }
    } catch (err: any) {
      lastErr = err
      const msg = String(err?.message ?? err)
      const retryable = msg.includes('503') || msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') || msg.includes('overloaded')
      if (!retryable || attempt === 2) break
    }
  }
  console.warn('[scan] Gemini failed:', lastErr?.message ?? String(lastErr))
  return null
}

// ─── Provider 3: Groq llama-4-scout (vision) ──────────────────────────────────
async function tryGroq(image: string, mimeType: string): Promise<ScanResult | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || apiKey.startsWith('your-')) return null

  try {
    const groq = new Groq({ apiKey })
    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), 10000)

    const completion = await groq.chat.completions.create(
      {
        model: 'llava-v1.5-7b-4096-preview',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: OCR_INSTRUCTION + '\n\n' + JSON_KEYS_INSTRUCTION },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image}` } },
          ],
        }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1000,
      },
      { signal: controller.signal },
    )
    clearTimeout(timeoutId)

    const raw = completion.choices?.[0]?.message?.content ?? ''
    if (!raw) { console.warn('[scan] Groq empty response'); return null }
    const result = parseOcrJson(raw)
    if (!result) { console.warn('[scan] Groq parse failed'); return null }
    console.log('[scan] Groq success')
    return { ...result, provider: 'groq' }
  } catch (err: any) {
    console.warn('[scan] Groq failed:', err?.message ?? String(err))
    return null
  }
}

// ─── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { image: string; mimeType?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  }

  if (!body.image) {
    return NextResponse.json({ error: 'MISSING_IMAGE' }, { status: 400 })
  }

  const mimeType = body.mimeType ?? 'image/jpeg'

  // Bedrock first (bearer token already in env), then Gemini, then Groq
  for (const { name, fn } of [
    { name: 'Bedrock', fn: () => tryBedrock(body.image, mimeType) },
    { name: 'Gemini',  fn: () => tryGemini(body.image, mimeType)  },
    { name: 'Groq',    fn: () => tryGroq(body.image, mimeType)    },
  ]) {
    try {
      const result = await fn()
      if (result) return NextResponse.json(result)
    } catch (err: any) {
      console.error(`[scan] Unexpected error from ${name}:`, err?.message ?? String(err))
    }
  }

  return NextResponse.json(
    { error: 'SCAN_UNAVAILABLE', message: 'Prescription scanning is temporarily unavailable. Please enter the details manually.' },
    { status: 503 },
  )
}
