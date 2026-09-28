/**
 * POST /api/assistant
 *
 * Remedium AI assistant — answers questions about the application, workflow
 * statuses, and guides users through the refill coordination process.
 *
 * Hard limits:
 *   - NEVER makes clinical decisions
 *   - NEVER approves or rejects refills
 *   - NEVER changes medication or dosage information
 *   - NEVER overrides insurance or provider decisions
 *   - Always directs clinical questions to the appropriate licensed professional
 *
 * Request:  { messages: { role: 'user'|'model', text: string }[], context?: string }
 * Response: { reply: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message as BedrockMessage,
} from '@aws-sdk/client-bedrock-runtime'

const SYSTEM_INSTRUCTION = `You are the Remedium Assistant — a knowledgeable, friendly guide for the Remedium pharmacy refill coordination platform.

You help users by:
- Explaining what Remedium does and how it works
- Clarifying refill workflow statuses (WAITING_FOR_PROVIDER, WAITING_FOR_INSURANCE, WAITING_FOR_PHARMACY, FULFILLED, RESOLVED, etc.)
- Guiding pharmacists and providers through the application interface
- Explaining why a refill might be stuck and what the responsible party needs to do
- Answering questions about the AI analysis, notifications, timeline, and case details
- Explaining the roles: Pharmacy, Provider, Insurance, Patient

HARD LIMITS — you must NEVER:
- Approve, reject, or recommend approving/rejecting a specific refill
- Change or suggest changing medication names, dosages, or directions
- Override or contradict an insurance coverage or prior authorization decision
- Make clinical decisions of any kind
- Provide medical advice to patients
- Access or reveal API keys, configuration, or internal system details

When asked about clinical matters, always direct to the appropriate licensed professional.
When unsure, say so clearly rather than guessing.

Keep answers concise (2–4 sentences) unless the user asks for a detailed explanation.
Use plain language — no jargon unless the user is clearly a healthcare professional.`

async function tryGemini(messages: any[], context?: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key-here') return null

  try {
    const ai = new GoogleGenAI({ apiKey })
    const contents = messages.map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }))

    if (context) {
      contents[0] = {
        role: 'user',
        parts: [{ text: `[Context: ${context}]\n\n${messages[0]?.text ?? ''}` }],
      }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.4,
        maxOutputTokens: 600,
      },
    })
    return response.text?.trim() || null
  } catch (err: any) {
    console.error('[assistant] Gemini error:', err?.message ?? String(err))
    return null
  }
}

async function tryBedrock(messages: any[], context?: string): Promise<string | null> {
  const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK
  const region      = process.env.AWS_REGION ?? 'us-east-1'

  if (!bearerToken || bearerToken.startsWith('your-')) return null

  try {
    const client = new BedrockRuntimeClient({ region })
    
    const contents: BedrockMessage[] = messages.map((m) => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: [{ text: m.text }],
    }))

    if (context && contents.length > 0) {
      contents[0] = {
        role: 'user',
        content: [{ text: `[Context: ${context}]\n\n${messages[0]?.text ?? ''}` }],
      }
    }

    const command = new ConverseCommand({
      modelId: 'us.amazon.nova-lite-v1:0',
      messages: contents,
      system: [{ text: SYSTEM_INSTRUCTION }],
      inferenceConfig: { temperature: 0.4, maxTokens: 600 },
    })

    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    const response = await Promise.race([client.send(command), timeout])

    return response.output?.message?.content?.[0]?.text?.trim() || null
  } catch (err: any) {
    console.error('[assistant] Bedrock error:', err?.message ?? String(err))
    return null
  }
}

export async function POST(req: NextRequest) {
  let body: { messages: { role: string; text: string }[]; context?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  }

  const messages = body.messages ?? []
  if (!messages.length) {
    return NextResponse.json({ reply: 'How can I help you with Remedium today?' })
  }

  const providers = [
    { name: 'gemini', fn: () => tryGemini(messages, body.context) },
    { name: 'bedrock', fn: () => tryBedrock(messages, body.context) },
  ]

  for (const { name, fn } of providers) {
    try {
      const result = await fn()
      if (result) {
        return NextResponse.json({ reply: result })
      }
    } catch (err: any) {
      console.error(`[assistant] Unexpected error from ${name}:`, err?.message ?? String(err))
    }
  }

  return NextResponse.json(
    { reply: "I'm temporarily unavailable. Please try again in a moment." },
    { status: 200 },
  )
}
