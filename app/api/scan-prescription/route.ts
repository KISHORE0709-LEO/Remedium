/**
 * POST /api/scan-prescription
 *
 * Accepts a base64-encoded prescription image and extracts structured form
 * fields for the pharmacy refill form using vision AI.
 *
 * Fallback order:
 *   1. Google Gemini 3.5 Flash (vision)  — with retry on 429/503
 *   2. Groq llama-4-scout (vision)       — fallback when Gemini is overloaded
 *   3. 503 with SCAN_UNAVAILABLE error   — pharmacist enters fields manually
 *
 * Safety rules:
 *   - Extracts ONLY administrative fields — pharmacist must review all before submit
 *   - NEVER submits to Firestore automatically
 *   - NEVER makes clinical decisions or modifies prescription details
 *   - API keys stay server-side; never returned in response or logged
 *
 * Request:  { image: string (base64), mimeType?: 'image/jpeg'|'image/png'|'image/webp' }
 * Response: { fields: ExtractedFields, confidence: number, warnings: string[], provider: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import Groq from 'groq-sdk'
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message as BedrockMessage,
} from '@aws-sdk/client-bedrock-runtime'

// Allow up to 30s for the AI fallback chain (Bedrock → Gemini → Groq)
// Vercel Hobby default is 10s which is too short for vision models
export const maxDuration = 30

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

const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    patientName:    { type: 'string', description: 'Full patient name as written on the prescription' },
    dob:            { type: 'string', description: 'Patient date of birth MM/DD/YYYY or empty string' },
    mrn:            { type: 'string', description: 'Patient MRN if present, else empty string' },
    phone:          { type: 'string', description: 'Patient phone number if present, else empty string' },
    allergies:      { type: 'string', description: 'Drug allergies listed, or empty string' },
    medication:     { type: 'string', description: 'Medication name exactly as written' },
    dosage:         { type: 'string', description: 'Dosage strength e.g. "500 mg"' },
    sig:            { type: 'string', description: 'Dispensing directions as written' },
    quantity:       { type: 'string', description: 'Quantity to dispense as number string e.g. "30"' },
    daysSupply:     { type: 'string', description: 'Days supply as number string, empty if not stated' },
    prescriptionId: { type: 'string', description: 'Rx number or DEA number if present' },
    provider:       { type: 'string', description: 'Prescriber full name and credentials' },
    plan:           { type: 'string', description: 'Insurance plan name if on prescription, else empty' },
    reason:         { type: 'string', description: 'Indication if stated, else "Prescription refill"' },
    confidence:     { type: 'number', minimum: 0, maximum: 1, description: 'Overall OCR confidence 0-1' },
    warnings:       { type: 'array', items: { type: 'string' }, description: 'Fields that were unclear or require pharmacist verification' },
  },
  required: ['patientName', 'medication', 'dosage', 'provider', 'confidence', 'warnings'],
}

const OCR_INSTRUCTION =
  'You are a pharmacy intake assistant. Extract prescription information from this image ' +
  'for administrative data entry. Extract ONLY what is clearly written. ' +
  'Do NOT interpret clinical meaning. Do NOT modify medication names, dosages, or directions. ' +
  'If a field is illegible or absent, return an empty string and add a warning. ' +
  'Respond ONLY with valid JSON. This data will be reviewed by a licensed pharmacist before use.'

function parseOcrResponse(raw: string): { fields: ExtractedFields; confidence: number; warnings: string[] } | null {
  try {
    const parsed = JSON.parse(raw)
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
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    }
  } catch {
    return null
  }
}

function isRetryableGeminiError(err: any): boolean {
  const msg = String(err?.message ?? err)
  return (
    msg.includes('503') || msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') || msg.includes('overloaded') ||
    msg.includes('rate limit') || msg.includes('quota')
  )
}

// ─── Provider 1: Gemini Vision ────────────────────────────────────────────────
async function tryGemini(
  image: string,
  mimeType: string,
): Promise<{ fields: ExtractedFields; confidence: number; warnings: string[] } | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key-here') return null

  const ai = new GoogleGenAI({ apiKey })
  let raw = ''
  let lastErr: any = null
  const MAX_RETRIES = 0 // Reduced to fail fast and reach Bedrock fallback quickly

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt))
    try {
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
      const req = ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [{
          role: 'user',
          parts: [
            { text: OCR_INSTRUCTION },
            { inlineData: { mimeType: mimeType as any, data: image } },
          ],
        }],
        config: {
          responseFormat: { text: { mimeType: 'application/json', schema: EXTRACT_SCHEMA } },
          temperature: 0.1,
          maxOutputTokens: 800,
        },
      })
      const response = await Promise.race([req, timeout]) as any
      raw = response.text ?? ''
      lastErr = null
      break
    } catch (err: any) {
      lastErr = err
      if (!isRetryableGeminiError(err) || attempt === MAX_RETRIES) break
    }
  }

  if (lastErr) {
    console.warn('[scan-prescription] Gemini failed:', lastErr?.message ?? String(lastErr))
    return null
  }

  const result = parseOcrResponse(raw)
  if (!result) { console.warn('[scan-prescription] Gemini parse failed'); return null }
  return result
}

// ─── Provider 2: Groq Vision (llama-4-scout) ──────────────────────────────────
async function tryGroq(
  image: string,
  mimeType: string,
): Promise<{ fields: ExtractedFields; confidence: number; warnings: string[] } | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || apiKey.startsWith('your-')) return null

  const groq = new Groq({ apiKey })

  try {
    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), 9000)  // 9s timeout for Groq

    const completion = await groq.chat.completions.create(
      {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  OCR_INSTRUCTION +
                  '\n\nRespond ONLY with a JSON object with these fields: ' +
                  'patientName, dob, mrn, phone, allergies, medication, dosage, sig, quantity, ' +
                  'daysSupply, prescriptionId, provider, plan, reason, confidence (0-1), warnings (array of strings). ' +
                  'Empty string for any field not clearly visible.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${image}`,
                },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 800,
      },
      { signal: controller.signal },
    )
    clearTimeout(timeoutId)

    const raw = completion.choices?.[0]?.message?.content ?? ''
    if (!raw) { console.warn('[scan-prescription] Groq empty response'); return null }

    const result = parseOcrResponse(raw)
    if (!result) { console.warn('[scan-prescription] Groq parse failed'); return null }
    return result
  } catch (err: any) {
    console.warn('[scan-prescription] Groq failed:', err?.message ?? String(err))
    return null
  }
}

// ─── Provider 3: AWS Bedrock (Amazon Nova Lite Vision) ────────────────────────
async function tryBedrock(
  image: string,
  mimeType: string,
): Promise<{ fields: ExtractedFields; confidence: number; warnings: string[] } | null> {
  const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK
  const region      = process.env.AWS_REGION ?? 'us-east-1'

  if (!bearerToken || bearerToken.startsWith('your-')) return null

  try {
    const client = new BedrockRuntimeClient({ region })
    // The format needs to be 'png' | 'jpeg' | 'webp' | 'gif'
    const format = mimeType.replace('image/', '')

    const messages: BedrockMessage[] = [{
      role: 'user',
      content: [
        { text: OCR_INSTRUCTION + '\n\nRespond ONLY with a JSON object with these fields: patientName, dob, mrn, phone, allergies, medication, dosage, sig, quantity, daysSupply, prescriptionId, provider, plan, reason, confidence (0-1), warnings (array of strings). Empty string for any field not clearly visible.' },
        { image: { format: format as any, source: { bytes: Buffer.from(image, 'base64') } } }
      ]
    }]

    const command = new ConverseCommand({
      modelId: 'us.amazon.nova-lite-v1:0',
      messages,
      inferenceConfig: { temperature: 0.1, maxTokens: 800 },
    })

    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
    const response = await Promise.race([client.send(command), timeout])

    const raw = response.output?.message?.content?.[0]?.text ?? ''
    if (!raw) { console.warn('[scan-prescription] Bedrock empty response'); return null }

    const cleanRaw = raw.replace(/```json/g, '').replace(/```/g, '')
    const result = parseOcrResponse(cleanRaw)
    if (!result) { console.warn('[scan-prescription] Bedrock parse failed'); return null }
    return result
  } catch (err: any) {
    console.warn('[scan-prescription] Bedrock failed:', err?.message ?? String(err))
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

  // Try Bedrock first, fall back to Gemini, then Groq
  const providers: Array<{ name: string; fn: () => Promise<any> }> = [
    { name: 'bedrock', fn: () => tryBedrock(body.image, mimeType) },
    { name: 'gemini',  fn: () => tryGemini(body.image, mimeType) },
    { name: 'groq',    fn: () => tryGroq(body.image, mimeType)   },
  ]

  for (const { name, fn } of providers) {
    try {
      const result = await fn()
      if (result) {
        return NextResponse.json({
          ...result,
          provider: name,  // safe metadata — which provider extracted the fields
        })
      }
    } catch (err: any) {
      console.error(`[scan-prescription] Unexpected error from ${name}:`, err?.message ?? String(err))
    }
  }

  // Both providers failed — let pharmacist know they can enter fields manually
  return NextResponse.json(
    {
      error: 'SCAN_UNAVAILABLE',
      message: 'Prescription scanning is temporarily unavailable. Please enter the prescription details manually.',
    },
    { status: 503 },
  )
}
