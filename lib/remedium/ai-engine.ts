/**
 * Remedium AI Analysis Engine  —  deterministic rule-based core
 *
 * Produces fully structured output for every refill intake covering:
 *   1. Why the refill is stuck   (stuckReason)
 *   2. Current blocker           (blocker)
 *   3. Responsible role          (responsibleRole)
 *   4. Priority + reason         (priority, priorityReason)
 *   5. Recommended next action   (nextAction)
 *   6. Missing information       (missingFields)
 *   7. Human-readable summary    (summary)
 *   8. Draft message             (draftMessage)
 *   9. Confidence                (confidence)
 *  10. Human review required?    (requiresHumanReview)
 *
 * HARD CONSTRAINTS — this engine NEVER:
 *   - approves or rejects a prescription
 *   - changes medication name, dosage, or quantity
 *   - overrides insurance decisions
 *   - makes clinical decisions of any kind
 *
 * All outputs are advisory only. Every clinical decision is made
 * by a licensed provider, pharmacist, or insurer.
 *
 * This module also serves as the SAFE FALLBACK when the LLM API call
 * in app/api/ai-analyze/route.ts fails or times out.
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

const MODEL_VERSION = 'remedium-rules-v2'

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO DETECTION
// Returns a canonical scenario key used by all downstream helpers.
// ─────────────────────────────────────────────────────────────────────────────
type Scenario =
  | 'no_refills'          // Zero refills remaining → provider renewal required
  | 'pa_required'         // Insurance / prior-auth issue → waiting for insurance
  | 'missing_info'        // Missing prescription information → needs information
  | 'conflict'            // Conflicting or suspicious data → human review
  | 'approved'            // Clean intake, no blockers → waiting for pharmacy
  | 'unclear'             // Cannot classify reliably → human review

function detectScenario(intake: RefillIntake, missing: string[]): Scenario {
  // Conflicting / suspicious data check first — if dosage language looks wrong
  // or supply vs quantity are inconsistent flag for human review.
  const hasDosageConflict =
    intake.quantity > 0 &&
    intake.daysSupply > 0 &&
    intake.quantity > intake.daysSupply * 4   // e.g. 200 tablets for 30-day supply
  if (hasDosageConflict) return 'conflict'

  // Missing critical intake information
  if (missing.length > 0) return 'missing_info'

  // No refills remaining
  if (intake.refillsRemaining === 0) return 'no_refills'

  // Prior authorization required
  if (intake.requiresPA) return 'pa_required'

  // Tier 3 without explicit PA flag might still require step therapy
  if (intake.tier === 3) return 'pa_required'

  // All checks passed → clear for pharmacy processing
  return 'approved'
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
  if (intake.quantity <= 0) missing.push('Valid quantity')
  if (intake.daysSupply <= 0) missing.push('Valid days supply')
  return missing
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKER + STUCK REASON
// ─────────────────────────────────────────────────────────────────────────────
function buildBlocker(scenario: Scenario, intake: RefillIntake): string | null {
  switch (scenario) {
    case 'no_refills':
      return `Zero refills remaining on prescription — ${intake.providerName} must authorize a renewal`
    case 'pa_required':
      if (intake.tier === 3 && !intake.requiresPA)
        return `Tier 3 medication may require step therapy documentation per ${intake.plan} policy`
      return `Prior authorization required by ${intake.plan} for ${intake.medicationName} (Tier ${intake.tier})`
    case 'missing_info':
      return 'Incomplete prescription intake — missing required fields before case can advance'
    case 'conflict':
      return `Intake data inconsistency detected (quantity ${intake.quantity} vs ${intake.daysSupply}-day supply) — human review required`
    case 'unclear':
      return 'Unable to classify refill request — insufficient or ambiguous data'
    case 'approved':
      return null
  }
}

function buildStuckReason(scenario: Scenario, intake: RefillIntake, missing: string[]): string | null {
  switch (scenario) {
    case 'no_refills':
      return `The prescription for ${intake.medicationName} ${intake.dosage} has 0 refills remaining. The pharmacy cannot dispense until ${intake.providerName} authorizes a renewal.`
    case 'pa_required':
      if (intake.tier === 3 && !intake.requiresPA)
        return `${intake.plan} may require step therapy evidence before covering this Tier 3 medication.`
      return `${intake.plan} requires a prior authorization for ${intake.medicationName} before coverage will apply.`
    case 'missing_info':
      return `The refill intake is incomplete. The following information is required before the case can advance: ${missing.join(', ')}.`
    case 'conflict':
      return `Quantity (${intake.quantity}) appears inconsistent with the ${intake.daysSupply}-day supply period. This mismatch requires a pharmacist or provider to verify the intended directions.`
    case 'unclear':
      return 'The refill data does not match any known workflow scenario. A human coordinator must review and classify the case.'
    case 'approved':
      return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIORITY + PRIORITY REASON
// ─────────────────────────────────────────────────────────────────────────────
function scorePriority(scenario: Scenario, intake: RefillIntake): {
  priority: AiAnalysis['priority']
  priorityReason: string
} {
  if (intake.urgent || intake.supplyDaysLeft <= 1) {
    return {
      priority: 'urgent',
      priorityReason: intake.urgent
        ? 'Marked urgent by submitting pharmacy'
        : `Patient has only ${intake.supplyDaysLeft} day of supply remaining — immediate action required`,
    }
  }
  if (scenario === 'conflict' || scenario === 'unclear') {
    return {
      priority: 'high',
      priorityReason: 'Data inconsistency or unclassifiable case requires immediate human attention',
    }
  }
  if (intake.supplyDaysLeft <= 3) {
    return {
      priority: 'high',
      priorityReason: `Patient has ${intake.supplyDaysLeft} days of supply remaining — action needed within 24 hours`,
    }
  }
  if (scenario === 'no_refills' || scenario === 'pa_required') {
    return {
      priority: intake.supplyDaysLeft <= 7 ? 'high' : 'standard',
      priorityReason:
        scenario === 'no_refills'
          ? `Provider renewal required; ${intake.supplyDaysLeft} days of supply remaining`
          : `Prior authorization required; ${intake.supplyDaysLeft} days of supply remaining`,
    }
  }
  return {
    priority: 'standard',
    priorityReason: `Routine refill with ${intake.supplyDaysLeft} days of supply remaining`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSIBLE ROLE
// ─────────────────────────────────────────────────────────────────────────────
function assignRole(scenario: Scenario): Role | 'remedium' | 'none' {
  switch (scenario) {
    case 'no_refills':   return 'provider'
    case 'pa_required':  return 'insurance'
    case 'missing_info': return 'pharmacy'
    case 'conflict':     return 'pharmacy'   // pharmacist initiates the clarification
    case 'unclear':      return 'pharmacy'
    case 'approved':     return 'pharmacy'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NEXT ACTION
// ─────────────────────────────────────────────────────────────────────────────
function recommendNextAction(scenario: Scenario, intake: RefillIntake, missing: string[]): string {
  switch (scenario) {
    case 'no_refills':
      return `Route renewal authorization request to ${intake.providerName} at ${intake.pharmacyName}; monitor for response within 24 hours`
    case 'pa_required':
      if (intake.tier === 3 && !intake.requiresPA)
        return `Verify step therapy requirements with ${intake.providerName} and obtain supporting documentation before submitting to ${intake.plan}`
      return `Submit Remedium pre-assembled PA packet to ${intake.plan}; track adjudication status`
    case 'missing_info':
      return `Collect missing intake data from pharmacy: ${missing.join(', ')}; do not advance until complete`
    case 'conflict':
      return `Flag for pharmacist review — verify intended quantity and sig against original prescription before dispensing`
    case 'unclear':
      return `Assign to pharmacy coordinator for manual classification; do not route to provider or payer without human confirmation`
    case 'approved':
      return `Proceed to insurance eligibility check with ${intake.plan}, then route to ${intake.pharmacyName} dispensing queue`
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HUMAN REVIEW FLAG
// ─────────────────────────────────────────────────────────────────────────────
function flagHumanReview(scenario: Scenario): boolean {
  return scenario === 'conflict' || scenario === 'unclear'
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE SCORING
// ─────────────────────────────────────────────────────────────────────────────
function scoreConfidence(scenario: Scenario, intake: RefillIntake, missing: string[]): number {
  if (scenario === 'conflict' || scenario === 'unclear') return 0.45
  let score = 0.95
  score -= missing.length * 0.07
  if (!intake.dob) score -= 0.03
  if (intake.tier === 3 && !intake.requiresPA) score -= 0.05
  return Math.max(0.45, Math.min(0.98, score))
}

// ─────────────────────────────────────────────────────────────────────────────
// HUMAN-READABLE SUMMARY (field 7)
// ─────────────────────────────────────────────────────────────────────────────
function buildSummary(
  scenario: Scenario,
  intake: RefillIntake,
  priority: AiAnalysis['priority'],
  missing: string[],
): string {
  const first = intake.patientName.split(' ')[0]
  const med = `${intake.medicationName} ${intake.dosage}`
  const supplyNote =
    intake.supplyDaysLeft <= 3
      ? `Patient has ${intake.supplyDaysLeft} day${intake.supplyDaysLeft === 1 ? '' : 's'} of supply remaining — time-sensitive.`
      : `Patient has ${intake.supplyDaysLeft} days of supply remaining.`

  switch (scenario) {
    case 'no_refills':
      return `${first}'s ${med} prescription has 0 refills remaining. ${intake.providerName} must authorize a renewal before ${intake.pharmacyName} can dispense. ${supplyNote} Remedium has pre-routed the renewal request.`
    case 'pa_required':
      if (intake.tier === 3 && !intake.requiresPA)
        return `${intake.plan} may require step therapy documentation for ${first}'s ${med} (Tier 3). ${supplyNote} Verify with ${intake.providerName} before submitting a coverage claim.`
      return `${intake.plan} requires prior authorization for ${first}'s ${med} (Tier ${intake.tier}). Remedium has pre-assembled the PA packet using available clinical data. ${supplyNote}`
    case 'missing_info':
      return `Intake for ${first}'s ${med} refill is incomplete. Missing: ${missing.join(', ')}. ${supplyNote} Pharmacy must resolve these gaps before the case can advance.`
    case 'conflict':
      return `A data inconsistency was detected in ${first}'s ${med} refill intake: quantity ${intake.quantity} against a ${intake.daysSupply}-day supply appears unusual. A pharmacist should verify before dispensing. ${supplyNote}`
    case 'unclear':
      return `${first}'s refill request for ${med} could not be automatically classified. The intake data is incomplete or ambiguous. A coordinator must review before the case is routed. ${supplyNote}`
    case 'approved':
      return `${first}'s ${med} refill intake is complete with no blockers detected. ${supplyNote} Routing to ${intake.plan} for eligibility verification and then to ${intake.pharmacyName} dispensing queue. Priority: ${priority}.`
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAFT MESSAGE (field 8)
// ─────────────────────────────────────────────────────────────────────────────
function buildDraftMessage(
  scenario: Scenario,
  intake: RefillIntake,
  missing: string[],
): string {
  const med = `${intake.medicationName} ${intake.dosage}`
  const first = intake.patientName.split(' ')[0]

  switch (scenario) {
    case 'no_refills':
      return `Dear ${intake.providerName},\n\nHarbor Pharmacy is requesting renewal authorization for ${first}'s ${med} prescription. The current prescription has 0 refills remaining and the patient has ${intake.supplyDaysLeft} day${intake.supplyDaysLeft === 1 ? '' : 's'} of supply left.\n\nPlease review and authorize at your earliest convenience. You can respond directly through the Remedium provider portal.\n\nThank you,\n${intake.pharmacyName}`

    case 'pa_required':
      return `Re: Prior Authorization Request — ${first}, ${med}, ${intake.plan}\n\nWe are submitting a prior authorization request for the above patient (Tier ${intake.tier} formulary). Clinical justification and supporting documentation have been pre-assembled by Remedium and are attached to this request.\n\nPlease process at your earliest convenience.\n\n${intake.pharmacyName}`

    case 'missing_info':
      return `Hi,\n\nThis is ${intake.pharmacyName} regarding a refill request for ${first} (${med}). Before we can process this refill, we need the following information:\n\n${missing.map((f) => `• ${f}`).join('\n')}\n\nPlease provide the above details at your earliest convenience.\n\n${intake.pharmacyName}`

    case 'conflict':
      return `Hi ${intake.providerName},\n\nWe are processing a refill request for ${first} (${med}) and have identified a potential data discrepancy: the prescription lists a quantity of ${intake.quantity} for a ${intake.daysSupply}-day supply.\n\nCould you confirm the intended dispensing directions (sig) and quantity before we proceed? We want to ensure accuracy before dispensing.\n\nThank you,\n${intake.pharmacyName}`

    case 'unclear':
      return `Hi,\n\nWe have received a refill request for ${first} (${med}) that requires manual review before it can be processed. Our system was unable to automatically classify this case.\n\nA member of our pharmacy team will reach out shortly to resolve this.\n\n${intake.pharmacyName}`

    case 'approved':
      return `Hi ${first},\n\nYour refill request for ${med} has been received and is being processed. We will notify you when your prescription is ready for pickup at ${intake.pharmacyName}.\n\nIf you have any questions, please contact us directly.\n\n${intake.pharmacyName}`
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — analyzeRefillIntake
// ─────────────────────────────────────────────────────────────────────────────
export function analyzeRefillIntake(intake: RefillIntake): AiAnalysis {
  const missingFields = detectMissingFields(intake)
  const scenario = detectScenario(intake, missingFields)
  const blocker = buildBlocker(scenario, intake)
  const stuckReason = buildStuckReason(scenario, intake, missingFields)
  const { priority, priorityReason } = scorePriority(scenario, intake)
  const responsibleRole = assignRole(scenario)
  const nextAction = recommendNextAction(scenario, intake, missingFields)
  const requiresHumanReview = flagHumanReview(scenario)
  const confidence = scoreConfidence(scenario, intake, missingFields)
  const summary = buildSummary(scenario, intake, priority, missingFields)
  const draftMessage = buildDraftMessage(scenario, intake, missingFields)

  return {
    stuckReason,
    blocker,
    priority,
    priorityReason,
    responsibleRole,
    nextAction,
    summary,
    confidence,
    draftMessage,
    missingFields,
    requiresHumanReview,
    analyzedAt: Date.now(),
    modelVersion: MODEL_VERSION,
  }
}
