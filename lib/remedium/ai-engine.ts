/**
 * Remedium AI Analysis Engine
 *
 * Deterministic rule-based analysis of refill intake data.
 * Produces structured output: blocker, priority, responsible role,
 * next action, summary, confidence, draft message.
 *
 * HARD CONSTRAINTS — this engine NEVER:
 *   - approves or rejects a prescription
 *   - changes medication name, dosage, or quantity
 *   - overrides insurance decisions
 *   - makes clinical decisions of any kind
 *
 * All outputs are advisory only. Every clinical decision is made
 * by a licensed provider, pharmacist, or insurer.
 */

import type { AiAnalysis, Role } from './types'

export interface RefillIntake {
  refillId: string
  patientName: string
  dob?: string
  mrn?: string
  allergies?: string
  medicationName: string
  dosage: string
  sig?: string
  quantity: number
  daysSupply: number
  supplyDaysLeft: number
  refillsRemaining: number
  requiresPA: boolean
  tier: 1 | 2 | 3
  providerName: string
  pharmacyName: string
  plan: string
  prescriptionId?: string
  reason?: string
  urgent?: boolean
}

const MODEL_VERSION = 'remedium-rules-v1'

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKER DETECTION
// ─────────────────────────────────────────────────────────────────────────────
function detectBlocker(intake: RefillIntake): string | null {
  if (intake.refillsRemaining === 0) return 'Zero refills remaining on prescription — provider renewal required'
  if (intake.requiresPA) return `Prior authorization required by ${intake.plan} for ${intake.medicationName} (Tier ${intake.tier})`
  if (!intake.prescriptionId?.trim()) return 'Prescription ID missing — cannot verify active prescription on file'
  if (!intake.sig?.trim()) return 'Dispensing directions (sig) missing from prescription'
  if (intake.quantity <= 0) return 'Invalid quantity — must be greater than zero'
  if (intake.daysSupply <= 0) return 'Invalid days supply — must be greater than zero'
  if (intake.tier === 3 && !intake.requiresPA) return `Tier 3 medication may require step therapy documentation per ${intake.plan} policy`
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// MISSING FIELD DETECTION
// ─────────────────────────────────────────────────────────────────────────────
function detectMissingFields(intake: RefillIntake): string[] {
  const missing: string[] = []
  if (!intake.prescriptionId?.trim()) missing.push('Prescription ID')
  if (!intake.sig?.trim()) missing.push('Dispensing directions (sig)')
  if (!intake.dob?.trim()) missing.push('Patient date of birth')
  if (!intake.mrn?.trim()) missing.push('Patient MRN')
  if (!intake.reason?.trim()) missing.push('Reason for refill')
  return missing
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIORITY SCORING
// ─────────────────────────────────────────────────────────────────────────────
function scorePriority(intake: RefillIntake): AiAnalysis['priority'] {
  if (intake.urgent || intake.supplyDaysLeft <= 1) return 'urgent'
  if (intake.supplyDaysLeft <= 3 || intake.refillsRemaining === 0) return 'high'
  if (intake.requiresPA || intake.tier === 3) return 'high'
  if (intake.supplyDaysLeft <= 7) return 'standard'
  return 'standard'
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSIBLE ROLE
// ─────────────────────────────────────────────────────────────────────────────
function assignRole(intake: RefillIntake, blocker: string | null, missing: string[]): Role | 'remedium' | 'none' {
  if (missing.length > 0) return 'pharmacy'
  if (blocker?.includes('provider renewal')) return 'provider'
  if (blocker?.includes('Prior authorization') || blocker?.includes('step therapy')) return 'insurance'
  if (blocker?.includes('Prescription ID') || blocker?.includes('sig') || blocker?.includes('quantity') || blocker?.includes('days supply')) return 'pharmacy'
  if (!blocker) return 'remedium'
  return 'pharmacy'
}

// ─────────────────────────────────────────────────────────────────────────────
// NEXT ACTION
// ─────────────────────────────────────────────────────────────────────────────
function recommendNextAction(intake: RefillIntake, blocker: string | null, missing: string[], role: Role | 'remedium' | 'none'): string {
  if (missing.length > 0) return `Collect missing information: ${missing.join(', ')}`
  if (blocker?.includes('provider renewal')) return `Route renewal request to ${intake.providerName} for authorization`
  if (blocker?.includes('Prior authorization')) return `Submit pre-assembled PA packet to ${intake.plan}`
  if (blocker?.includes('step therapy')) return `Request step therapy documentation from ${intake.providerName}`
  if (blocker?.includes('Tier 3')) return `Verify formulary exception or step therapy with ${intake.plan}`
  if (!blocker) return `Proceed to eligibility verification and route to ${intake.plan} for coverage check`
  return 'Route to pharmacy team for manual review'
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE SCORING
// ─────────────────────────────────────────────────────────────────────────────
function scoreConfidence(intake: RefillIntake, missing: string[]): number {
  let score = 0.95
  score -= missing.length * 0.08
  if (!intake.dob) score -= 0.03
  if (intake.tier === 3) score -= 0.04
  return Math.max(0.4, Math.min(0.98, score))
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY GENERATION
// ─────────────────────────────────────────────────────────────────────────────
function buildSummary(intake: RefillIntake, blocker: string | null, priority: AiAnalysis['priority'], missing: string[]): string {
  const firstName = intake.patientName.split(' ')[0]
  const med = `${intake.medicationName} ${intake.dosage}`
  const supplyNote = intake.supplyDaysLeft <= 3
    ? `Patient has ${intake.supplyDaysLeft} day${intake.supplyDaysLeft === 1 ? '' : 's'} of supply remaining — time-sensitive.`
    : `Patient has ${intake.supplyDaysLeft} days of supply remaining.`

  if (missing.length > 0) {
    return `Intake for ${firstName}'s ${med} refill is incomplete. Missing: ${missing.join(', ')}. ${supplyNote} Pharmacy must resolve information gaps before the case can advance.`
  }
  if (blocker?.includes('provider renewal')) {
    return `${firstName}'s ${med} prescription has 0 refills remaining. ${intake.providerName} must authorize a renewal before ${intake.pharmacyName} can dispense. ${supplyNote} Remedium has pre-routed the renewal request.`
  }
  if (blocker?.includes('Prior authorization')) {
    return `${intake.plan} requires prior authorization for ${med} (Tier ${intake.tier}). Remedium has pre-assembled the PA packet using available clinical data. ${supplyNote} Pharmacy can submit in one step.`
  }
  if (blocker?.includes('step therapy')) {
    return `${intake.plan} policy may require step therapy documentation for ${med} (Tier ${intake.tier}). ${supplyNote} Verify with ${intake.providerName} before submitting claim.`
  }
  return `${firstName}'s ${med} refill intake is complete. ${supplyNote} Remedium is routing the case for eligibility verification with ${intake.plan}. Priority: ${priority}.`
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAFT MESSAGE GENERATION
// ─────────────────────────────────────────────────────────────────────────────
function buildDraftMessage(intake: RefillIntake, blocker: string | null, role: Role | 'remedium' | 'none', missing: string[]): string {
  const med = `${intake.medicationName} ${intake.dosage}`
  const firstName = intake.patientName.split(' ')[0]

  if (missing.length > 0) {
    return `Hi, this is ${intake.pharmacyName} regarding a refill request for ${firstName} (${med}). We need the following to proceed: ${missing.join(', ')}. Please contact us at your earliest convenience.`
  }
  if (role === 'provider') {
    return `Dear ${intake.providerName}, Harbor Pharmacy is requesting renewal authorization for ${firstName}'s ${med} prescription. The current prescription has 0 refills remaining and the patient has ${intake.supplyDaysLeft} days of supply left. Please review and authorize at your earliest convenience.`
  }
  if (role === 'insurance') {
    return `Re: Prior Authorization Request — ${firstName}, ${med}, ${intake.plan}. We are submitting a prior authorization request for the above patient. Clinical justification and supporting documentation are attached. Please process at your earliest convenience.`
  }
  return `Refill request for ${firstName} (${med}) has been received and is being processed. We will notify you when the prescription is ready.`
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ANALYSIS FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
export function analyzeRefillIntake(intake: RefillIntake): AiAnalysis {
  const blocker = detectBlocker(intake)
  const missingFields = detectMissingFields(intake)
  const priority = scorePriority(intake)
  const responsibleRole = assignRole(intake, blocker, missingFields)
  const nextAction = recommendNextAction(intake, blocker, missingFields, responsibleRole)
  const confidence = scoreConfidence(intake, missingFields)
  const summary = buildSummary(intake, blocker, priority, missingFields)
  const draftMessage = buildDraftMessage(intake, blocker, responsibleRole, missingFields)

  return {
    blocker,
    priority,
    responsibleRole,
    nextAction,
    summary,
    confidence,
    draftMessage,
    missingFields,
    analyzedAt: Date.now(),
    modelVersion: MODEL_VERSION,
  }
}
