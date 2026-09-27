/**
 * POST /api/scan-prescription
 *
 * Accepts a base64-encoded prescription image (JPEG/PNG/WebP) and uses
 * Gemini Vision to extract structured form fields for the pharmacy refill form.
 *
 * Safety rules:
 *   - Extracts ONLY administrative fields the pharmacist must manually review
 *   - NEVER submits to Firestore — returns extracted data for human review
 *   - NEVER interprets clinical meaning or makes dosage decisions
 *   - All fields are clearly marked as OCR-extracted; pharmacist must confirm
 *
 * Request body: { image: string (base64), mimeType: 'image/jpeg'|'image/png'|'image/webp' }
 * Response:     { fields: ExtractedFields, confidence: number, warnings: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

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
    dob:            { type: 'string', description: 'Patient date of birth in MM/DD/YYYY format if present, else empty string' },
    mrn:            { type: 'string', description: 'Patient medical record number if present, else empty string' },
    phone:          { type: 'string', description: 'Patient phone number if present, else empty string' },
    allergies:      { type: 'string', description: 'Known drug allergies listed on prescription, or empty string' },
    medication:     { type: 'string', description: 'Medication name (generic or brand) exactly as written' },
    dosage:         { type: 'string', description: 'Dosage strength e.g. "10 mg", "500 mg", "0.5 mg/mL"' },
    sig:            { type: 'string', description: 'Dispensing directions / sig as written, e.g. "Take 1 tablet twice daily"' },
    quantity:       { type: 'string', description: 'Quantity to dispense as a number string, e.g. "30"' },
    daysSupply:     { type: 'string', description: 'Days supply as a number string, e.g. "30". Leave empty if not stated.' },
    prescriptionId: { type: 'string', description: 'Prescription ID, Rx number, or DEA number if present' },
    provider:       { type: 'string', description: 'Prescriber full name and credentials, e.g. "Dr. Sarah Williams, MD"' },
    plan:           { type: 'string', description: 'Insurance plan name if present on prescription, else empty string' },
    reason:         { type: 'string', description: 'Indication or reason for prescription if stated, else "Prescription refill"' },
    confidence:     { type: 'number', minimum: 0, maximum: 1, description: 'Overall OCR confidence 0-1' },
    warnings:       { type: 'array', items: { type: 'string' }, description: 'Any fields that were unclear, illegible, or require pharmacist verification' },
  },
  required: ['patientName', 'medication', 'dosage', 'provider', 'confidence', 'warnings'],
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    return NextResponse.json({ error: 'GEMINI_NOT_CONFIGURED' }, { status: 503 })
  }

  let body: { image: string; mimeType?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  }

  if (!body.image) {
    return NextResponse.json({ error: 'MISSING_IMAGE' }, { status: 400 })
  }

  const mimeType = (body.mimeType ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'

  try {
    const ai = new GoogleGenAI({ apiKey })

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                'You are a pharmacy intake assistant. Extract prescription information from this image ' +
                'for administrative data entry. Extract ONLY what is clearly written on the prescription. ' +
                'Do NOT interpret clinical meaning. Do NOT modify medication names, dosages, or directions. ' +
                'If a field is illegible or absent, return an empty string and add a warning. ' +
                'This extracted data will be reviewed and confirmed by a licensed pharmacist before any use.',
            },
            {
              inlineData: {
                mimeType,
                data: body.image,
              },
            },
          ],
        },
      ],
      config: {
        responseFormat: {
          text: { mimeType: 'application/json', schema: EXTRACT_SCHEMA },
        },
        temperature: 0.1,
        maxOutputTokens: 800,
      },
    })

    const raw = response.text ?? ''
    let parsed: Partial<ExtractedFields & { confidence: number; warnings: string[] }>
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'PARSE_ERROR' }, { status: 503 })
    }

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

    return NextResponse.json({
      fields,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    })
  } catch (err: any) {
    console.error('[scan-prescription] Gemini error:', err?.message ?? String(err))
    return NextResponse.json({ error: 'LLM_ERROR', message: err?.message }, { status: 503 })
  }
}
