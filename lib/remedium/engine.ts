import type { RefillCase, Role } from './types'

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'neutral'

export interface CaseInsight {
  blocker: string | null
  owner: Role | 'remedium' | 'none'
  ownerName: string
  waitingFor: string
  actionRequired: string
  missingInfo: string
  patientImpact: string
  nextAction: string
  summary: string
  signals: string[]
  confidence: number
}

const ROLE_LABEL: Record<Role | 'remedium' | 'none', string> = {
  patient: 'Patient',
  pharmacy: 'Pharmacy',
  provider: 'Provider',
  insurance: 'Insurance',
  remedium: 'Remedium AI',
  none: '—',
}

export function roleLabel(role: Role | 'remedium' | 'none') {
  return ROLE_LABEL[role]
}

function medLabel(c: RefillCase) {
  return `${c.medication.name} ${c.medication.strength}`
}

function supplyImpact(c: RefillCase) {
  if (c.supplyDaysLeft <= 0) return 'Patient is out of medication today'
  if (c.supplyDaysLeft === 1) return 'Medication supply may run out tomorrow'
  return `Medication supply may run out in ${c.supplyDaysLeft} days`
}

export function analyzeCase(c: RefillCase): CaseInsight {
  const med = medLabel(c)
  const first = c.patient.name.split(' ')[0]
  const baseSignals = [
    `${c.medication.refillsRemaining} refills remaining on file`,
    `Last filled ${Math.max(0, Math.round((Date.now() - c.medication.lastFilled) / 86_400_000))} days ago · ${c.medication.daysSupply}-day supply`,
    `Formulary tier ${c.medication.tier}${c.medication.requiresPA ? ' · PA policy applies' : ''}`,
  ]

  switch (c.status) {
    // ── New canonical intake states ──────────────────────────────────────────
    case 'NEW':
      return {
        blocker: null,
        owner: 'pharmacy',
        ownerName: c.pharmacy,
        waitingFor: 'Pharmacy Review',
        actionRequired: 'Awaiting pharmacy intake review',
        missingInfo: 'None yet',
        patientImpact: supplyImpact(c),
        nextAction: 'Begin eligibility analysis',
        summary: `New refill request for ${first}'s ${med} has been submitted and is awaiting pharmacy intake review.`,
        signals: ['Refill request received'],
        confidence: 0.5,
      }
    case 'ANALYZING':
    // Legacy aliases that map to the same analysis phase
    case 'REQUESTED':
    case 'CHECKING':
      return {
        blocker: null,
        owner: 'remedium',
        ownerName: 'Remedium AI',
        waitingFor: 'Remedium AI',
        actionRequired: 'Automated eligibility check',
        missingInfo: 'None yet — verifying prescription',
        patientImpact: supplyImpact(c),
        nextAction: 'Verify refills, prescriber and coverage',
        summary: `Remedium is checking ${first}'s ${med} prescription against refill count, prescriber authorization and plan formulary to identify any blocker.`,
        signals: ['Reading prescription record', 'Checking refill count', 'Pre-screening coverage'],
        confidence: 0.6,
      }
    case 'NEEDS_INFORMATION':
      return {
        blocker: c.blocker || 'Additional information required',
        owner: 'pharmacy',
        ownerName: c.pharmacy,
        waitingFor: c.waitingFor || 'Pharmacy',
        actionRequired: c.aiRecommendation || 'Provide missing clinical information',
        missingInfo: c.blocker || 'Clinical details required',
        patientImpact: supplyImpact(c),
        nextAction: 'Resolve information gap and re-analyze',
        summary: c.aiSummary || `Additional information is needed before ${first}'s ${med} refill can proceed.`,
        signals: [...baseSignals, 'Intake validation: information gap detected'],
        confidence: 0.85,
      }

    // ── Provider / Insurance waiting ─────────────────────────────────────────
    case 'WAITING_FOR_PROVIDER': {
      if (c.blockReason === 'visit_scheduled') {
        return {
          blocker: 'Follow-up visit scheduled',
          owner: 'provider',
          ownerName: c.prescriber,
          waitingFor: 'Provider',
          actionRequired: 'Provider authorization after visit',
          missingInfo: 'Provider approval',
          patientImpact: supplyImpact(c),
          nextAction: 'Provider approves refill',
          summary: `${first} scheduled the follow-up visit requested by ${c.prescriber}. The refill is back in the provider queue for a final clinical decision.`,
          signals: [...baseSignals, 'Visit confirmed by patient'],
          confidence: 0.94,
        }
      }
      return {
        blocker: 'No refills remaining',
        owner: 'provider',
        ownerName: c.prescriber,
        waitingFor: 'Provider',
        actionRequired: 'Provider authorization',
        missingInfo: 'Provider approval',
        patientImpact: supplyImpact(c),
        nextAction: 'Provider review',
        summary: `Patient is requesting continuation of ${med}. The current prescription has no remaining refills. Provider authorization is required before the pharmacy can dispense the medication.`,
        signals: baseSignals,
        confidence: 0.98,
      }
    }
    case 'WAITING_FOR_INSURANCE':
      return {
        blocker: null,
        owner: 'insurance',
        ownerName: c.plan,
        waitingFor: 'Insurance',
        actionRequired: c.insurance === 'pa_submitted' ? 'Review prior authorization' : 'Coverage verification',
        missingInfo: c.insurance === 'pa_submitted' ? 'PA determination' : 'Coverage determination',
        patientImpact: supplyImpact(c),
        nextAction: c.insurance === 'pa_submitted' ? 'Insurance reviews PA' : 'Confirm coverage',
        summary:
          c.insurance === 'pa_submitted'
            ? `Prior authorization packet for ${med} was submitted with diagnosis and therapy history. Awaiting a determination from ${c.plan}.`
            : `Claim for ${med} submitted to ${c.plan}. ${c.medication.requiresPA ? 'This drug class commonly requires prior authorization.' : 'Formulary match suggests coverage will be confirmed.'}`,
        signals: baseSignals,
        confidence: c.medication.requiresPA ? 0.81 : 0.93,
      }

    // ── Legacy BLOCKED ───────────────────────────────────────────────────────
    case 'BLOCKED': {
      if (c.blockReason === 'visit_required') {
        return {
          blocker: 'Visit required before refill',
          owner: 'patient',
          ownerName: c.patient.name,
          waitingFor: 'Patient',
          actionRequired: 'Schedule follow-up visit',
          missingInfo: 'Recent clinical assessment',
          patientImpact: supplyImpact(c),
          nextAction: 'Patient schedules visit',
          summary: `${c.prescriber} requested a follow-up visit before continuing ${med}. Remedium notified ${first} and will return the case to the provider once the visit is booked.`,
          signals: [...baseSignals, 'Provider decision: visit requested'],
          confidence: 0.96,
        }
      }
      if (c.blockReason === 'pa_required') {
        return {
          blocker: 'Prior authorization required',
          owner: 'insurance',
          ownerName: c.plan,
          waitingFor: 'Insurance',
          actionRequired: 'Prior authorization',
          missingInfo: 'PA form · diagnosis code · prior therapy history',
          patientImpact: supplyImpact(c),
          nextAction: 'Submit authorization request',
          summary: `${c.plan} requires prior authorization for ${med} (tier ${c.medication.tier}). Remedium has pre-filled the PA packet from the chart; pharmacy can submit it in one step.`,
          signals: [...baseSignals, 'Claim rejected: code 75 — PA required'],
          confidence: 0.97,
        }
      }
      if (c.blockReason === 'missing_info') {
        return {
          blocker: c.blocker || 'Missing clinical information',
          owner: 'remedium',
          ownerName: 'Clinic Staff / Remedium',
          waitingFor: c.waitingFor || 'Pacific Heights Clinic Staff',
          actionRequired: c.aiRecommendation || 'Request clinic coordinator re-transmit prescription with ICD-10',
          missingInfo: 'ICD-10 diagnosis indication & prescriber supervisor NPI',
          patientImpact: supplyImpact(c),
          nextAction: 'Re-transmit electronic prescription with diagnosis code',
          summary: c.aiSummary || `Electronic intake validation detected missing ICD-10 indication required for insurance clearing.`,
          signals: [...baseSignals, 'e-Rx intake: Missing ICD-10 code'],
          confidence: 0.95,
        }
      }
      if (c.blockReason === 'conflict_review') {
        return {
          blocker: c.blocker || 'Conflicting clinical dose requiring human review',
          owner: 'pharmacy',
          ownerName: c.pharmacy,
          waitingFor: c.waitingFor || 'Clinical Pharmacist / Prescriber Clarification',
          actionRequired: c.aiRecommendation || 'Clarify titration intent with prescriber before dispensing',
          missingInfo: 'Clinical dosage titration schedule in chart',
          patientImpact: supplyImpact(c),
          nextAction: 'Clinical pharmacist clarifies dose with prescriber',
          summary: c.aiSummary || `Remedium AI safety cross-check detected dosage conflict with electronic health record history.`,
          signals: [...baseSignals, 'Clinical hold: Dosage conflict flagged'],
          confidence: 0.98,
        }
      }
      if (c.blockReason === 'not_covered') {
        return {
          blocker: 'Not covered by plan',
          owner: 'pharmacy',
          ownerName: c.pharmacy,
          waitingFor: 'Pharmacy',
          actionRequired: 'Resolve coverage gap',
          missingInfo: 'Patient payment decision',
          patientImpact: supplyImpact(c),
          nextAction: 'Offer cash price or formulary alternative',
          summary: `${c.plan} does not cover ${med}. Remedium found a discount cash price and a formulary alternative; pharmacy should confirm the path with ${first}.`,
          signals: [...baseSignals, 'Claim rejected: code 70 — not covered'],
          confidence: 0.92,
        }
      }
      if (c.blocker) {
        return {
          blocker: c.blocker,
          owner: c.assignedTo === 'provider' ? 'provider' : c.assignedTo === 'insurance' ? 'insurance' : 'pharmacy',
          ownerName: c.waitingFor || c.pharmacy,
          waitingFor: c.waitingFor || 'Pharmacy Review',
          actionRequired: c.aiRecommendation || 'Resolve blocker',
          missingInfo: 'Clinical review',
          patientImpact: supplyImpact(c),
          nextAction: c.aiRecommendation || 'Review case',
          summary: c.aiSummary || `Case requires operational review.`,
          signals: [...baseSignals, `Blocker: ${c.blocker}`],
          confidence: 0.9,
        }
      }
      break
    }

    // ── Approval / Prescription routing ─────────────────────────────────────
    case 'APPROVED':
    case 'PRESCRIPTION_SENT':
      return {
        blocker: null,
        owner: 'remedium',
        ownerName: 'Remedium AI',
        waitingFor: 'Remedium AI',
        actionRequired: 'Transmit new prescription',
        missingInfo: 'None',
        patientImpact: supplyImpact(c),
        nextAction: 'Insurance verification',
        summary: `${c.prescriber} approved ${med}. Remedium verified the new e-prescription and is routing the claim to ${c.plan}.`,
        signals: ['Provider approval verified', 'New Rx received by pharmacy'],
        confidence: 0.99,
      }

    // ── Pharmacy filling ─────────────────────────────────────────────────────
    case 'WAITING_FOR_PHARMACY':
    case 'PHARMACY_PROCESSING':
      return {
        blocker: null,
        owner: 'pharmacy',
        ownerName: c.pharmacy,
        waitingFor: 'Pharmacy',
        actionRequired: 'Fill and verify prescription',
        missingInfo: 'None',
        patientImpact: 'All approvals complete',
        nextAction: 'Mark ready for pickup',
        summary: `All blockers resolved for ${med}. Coverage is confirmed and the pharmacy is filling the prescription.`,
        signals: ['Provider authorization on file', 'Coverage confirmed'],
        confidence: 0.99,
      }

    // ── Ready / Fulfilled ────────────────────────────────────────────────────
    case 'FULFILLED':
    case 'READY_FOR_PICKUP':
      return {
        blocker: null,
        owner: 'patient',
        ownerName: c.patient.name,
        waitingFor: 'Patient',
        actionRequired: 'Pick up medication',
        missingInfo: 'None',
        patientImpact: 'Medication ready',
        nextAction: 'Patient pickup',
        summary: `${med} is filled and ready. ${first} has been notified.`,
        signals: ['Patient notified'],
        confidence: 1,
      }

    // ── Terminal: success ────────────────────────────────────────────────────
    case 'RESOLVED':
    case 'COMPLETED':
      return {
        blocker: null,
        owner: 'none',
        ownerName: '—',
        waitingFor: '—',
        actionRequired: 'None',
        missingInfo: 'None',
        patientImpact: 'Resolved',
        nextAction: 'Case closed',
        summary: `Refill for ${med} resolved end-to-end and picked up by ${first}.`,
        signals: ['Workflow complete'],
        confidence: 1,
      }

    // ── Terminal: failure / escalation ───────────────────────────────────────
    case 'ESCALATED':
      return {
        blocker: c.blocker || 'Case escalated for manual review',
        owner: 'pharmacy',
        ownerName: c.pharmacy,
        waitingFor: c.waitingFor || 'Clinical Review Team',
        actionRequired: c.aiRecommendation || 'Manual clinical review required',
        missingInfo: 'Escalation resolution',
        patientImpact: supplyImpact(c),
        nextAction: 'Resolve escalation and resume workflow',
        summary: c.aiSummary || `${med} refill for ${first} has been escalated for manual review.`,
        signals: [...baseSignals, 'Escalation flag raised'],
        confidence: 0.7,
      }
    case 'REJECTED':
    case 'DENIED':
      return {
        blocker: c.blocker || 'Refill denied',
        owner: 'patient',
        ownerName: c.patient.name,
        waitingFor: 'Patient',
        actionRequired: 'Contact provider office',
        missingInfo: 'None',
        patientImpact: 'Medication will not be refilled',
        nextAction: 'Patient contacts provider',
        summary: `${c.prescriber} declined to continue ${med}${c.denialReason ? ` — ${c.denialReason}` : ''}. Remedium notified the pharmacy and patient.`,
        signals: ['Provider decision: denied'],
        confidence: 1,
      }
    case 'CANCELLED':
      return {
        blocker: null,
        owner: 'none',
        ownerName: '—',
        waitingFor: '—',
        actionRequired: 'None',
        missingInfo: 'None',
        patientImpact: 'Request cancelled',
        nextAction: 'Submit new request if needed',
        summary: `The refill request for ${med} was cancelled.`,
        signals: ['Workflow terminated: cancelled'],
        confidence: 1,
      }
  }

  return {
    blocker: 'Unknown',
    owner: 'pharmacy',
    ownerName: c.pharmacy,
    waitingFor: 'Pharmacy',
    actionRequired: 'Manual review',
    missingInfo: 'Unknown',
    patientImpact: supplyImpact(c),
    nextAction: 'Review case',
    summary: 'Remedium could not classify this case automatically.',
    signals: [],
    confidence: 0.4,
  }
}

export interface StatusBadge {
  label: string
  tone: Tone
}

export function statusBadge(c: RefillCase): StatusBadge {
  switch (c.status) {
    case 'NEW':
      return { label: 'New', tone: 'blue' }
    case 'ANALYZING':
    case 'REQUESTED':
      return { label: 'Analyzing', tone: 'violet' }
    case 'CHECKING':
      return { label: 'Analyzing', tone: 'violet' }
    case 'NEEDS_INFORMATION':
      return { label: 'Needs Info', tone: 'amber' }
    case 'BLOCKED':
      return { label: 'Blocked', tone: 'red' }
    case 'WAITING_FOR_PROVIDER':
      return c.blockReason === 'no_refills'
        ? { label: 'Blocked', tone: 'red' }
        : { label: 'Waiting', tone: 'amber' }
    case 'WAITING_FOR_INSURANCE':
      return { label: 'Waiting', tone: 'amber' }
    case 'APPROVED':
      return { label: 'Approved', tone: 'green' }
    case 'PRESCRIPTION_SENT':
      return { label: 'Rx Sent', tone: 'blue' }
    case 'WAITING_FOR_PHARMACY':
    case 'PHARMACY_PROCESSING':
      return { label: 'Filling', tone: 'blue' }
    case 'FULFILLED':
    case 'READY_FOR_PICKUP':
      return { label: 'Ready', tone: 'green' }
    case 'RESOLVED':
    case 'COMPLETED':
      return { label: 'Completed', tone: 'green' }
    case 'ESCALATED':
      return { label: 'Escalated', tone: 'amber' }
    case 'REJECTED':
    case 'DENIED':
      return { label: 'Denied', tone: 'red' }
    case 'CANCELLED':
      return { label: 'Cancelled', tone: 'neutral' }
  }
}

const TERMINAL: Set<RefillCase['status']> = new Set([
  'RESOLVED', 'COMPLETED', 'REJECTED', 'DENIED', 'CANCELLED', 'NEW',
])

export function isActive(c: RefillCase) {
  return !TERMINAL.has(c.status)
}

export type StepState = 'done' | 'active' | 'pending' | 'blocked' | 'error'

export interface PatientStep {
  key: string
  label: string
  state: StepState
}

function needsProvider(c: RefillCase) {
  return (
    c.status === 'WAITING_FOR_PROVIDER' ||
    c.blockReason === 'visit_required' ||
    c.status === 'DENIED' ||
    c.status === 'REJECTED' ||
    c.events.some((e) => e.label.toLowerCase().includes('provider'))
  )
}

export function patientSteps(c: RefillCase): PatientStep[] {
  const steps: { key: string; label: string }[] = [
    { key: 'requested', label: 'Refill requested' },
    { key: 'pharmacy', label: 'Pharmacy reviewed' },
  ]
  if (needsProvider(c)) steps.push({ key: 'provider', label: 'Provider review' })
  steps.push(
    { key: 'insurance', label: 'Insurance verification' },
    { key: 'prep', label: 'Pharmacy preparation' },
    { key: 'ready', label: 'Ready for pickup' },
  )

  const stageKey: Record<RefillCase['status'], string> = {
    NEW: 'requested',
    ANALYZING: 'pharmacy',
    REQUESTED: 'pharmacy',
    CHECKING: 'pharmacy',
    NEEDS_INFORMATION: 'pharmacy',
    WAITING_FOR_PROVIDER: 'provider',
    BLOCKED: c.blockReason === 'visit_required' ? 'provider' : 'insurance',
    DENIED: 'provider',
    REJECTED: 'provider',
    APPROVED: 'insurance',
    PRESCRIPTION_SENT: 'insurance',
    WAITING_FOR_INSURANCE: 'insurance',
    WAITING_FOR_PHARMACY: 'prep',
    PHARMACY_PROCESSING: 'prep',
    FULFILLED: 'ready',
    READY_FOR_PICKUP: 'ready',
    RESOLVED: '__done__',
    COMPLETED: '__done__',
    ESCALATED: 'pharmacy',
    CANCELLED: 'requested',
  }
  const current = stageKey[c.status]
  const currentIndex = current === '__done__' ? steps.length : steps.findIndex((s) => s.key === current)

  return steps.map((s, i) => {
    let state: StepState = 'pending'
    if (i < currentIndex) state = 'done'
    else if (i === currentIndex) {
      if (c.status === 'DENIED' || c.status === 'REJECTED') state = 'error'
      else if (c.status === 'BLOCKED' || c.status === 'NEEDS_INFORMATION') state = 'blocked'
      else if (c.status === 'FULFILLED' || c.status === 'READY_FOR_PICKUP') state = 'done'
      else state = 'active'
    }
    let label = s.label
    if (s.key === 'provider' && state === 'done') label = 'Provider approved'
    if (s.key === 'insurance' && state === 'done') label = 'Coverage confirmed'
    if (s.key === 'provider' && (c.status === 'DENIED' || c.status === 'REJECTED')) label = 'Provider declined refill'
    if (s.key === 'provider' && c.blockReason === 'visit_required') label = 'Visit requested by provider'
    if (s.key === 'insurance' && state === 'blocked') label = c.blockReason === 'pa_required' ? 'Prior authorization in progress' : 'Coverage issue'
    return { key: s.key, label, state }
  })
}

export function upcomingEvents(c: RefillCase): string[] {
  const done = patientSteps(c)
  return done.filter((s) => s.state === 'pending').map((s) => s.label)
}

export function patientHeadline(c: RefillCase): { title: string; body: string; tone: Tone } {
  switch (c.status) {
    case 'NEW':
      return { title: 'Refill submitted', body: 'Your refill request has been submitted and is pending review.', tone: 'blue' }
    case 'ANALYZING':
    case 'REQUESTED':
    case 'CHECKING':
      return { title: 'Refill requested', body: 'Your refill is being reviewed.', tone: 'blue' }
    case 'NEEDS_INFORMATION':
      return { title: 'Information needed', body: 'Your pharmacy needs additional information to process your refill.', tone: 'amber' }
    case 'WAITING_FOR_PROVIDER':
      return c.blockReason === 'visit_scheduled'
        ? { title: 'Visit scheduled', body: `Your doctor will review your refill after your visit.`, tone: 'amber' }
        : { title: 'Waiting for provider review', body: `Your prescription needs a quick approval from ${c.prescriber}. We've already sent the request.`, tone: 'amber' }
    case 'BLOCKED':
      if (c.blockReason === 'visit_required')
        return { title: 'Visit needed', body: `${c.prescriber} would like to see you before refilling. Schedule a visit to continue.`, tone: 'amber' }
      if (c.blockReason === 'not_covered')
        return { title: 'Checking payment options', body: 'Your plan does not cover this medication. The pharmacy will contact you about options.', tone: 'amber' }
      return { title: 'Insurance approval in progress', body: 'Your plan needs extra paperwork. The pharmacy and Remedium are handling it for you.', tone: 'amber' }
    case 'APPROVED':
    case 'PRESCRIPTION_SENT':
      return { title: 'Approved', body: 'Your prescription has been approved and sent to the pharmacy.', tone: 'green' }
    case 'WAITING_FOR_INSURANCE':
      return { title: 'Checking your coverage', body: 'We are confirming your insurance coverage.', tone: 'blue' }
    case 'WAITING_FOR_PHARMACY':
    case 'PHARMACY_PROCESSING':
      return { title: 'Being prepared', body: 'Your pharmacy is filling your prescription.', tone: 'blue' }
    case 'FULFILLED':
    case 'READY_FOR_PICKUP':
      return { title: 'Ready for pickup', body: `Pick up at ${c.pharmacy}.`, tone: 'green' }
    case 'RESOLVED':
    case 'COMPLETED':
      return { title: 'Picked up', body: 'This refill is complete.', tone: 'green' }
    case 'ESCALATED':
      return { title: 'Under review', body: 'Your refill has been escalated for clinical review. We will update you shortly.', tone: 'amber' }
    case 'REJECTED':
    case 'DENIED':
      return { title: 'Refill not approved', body: `Please contact ${c.prescriber}'s office to discuss next steps.`, tone: 'red' }
    case 'CANCELLED':
      return { title: 'Request cancelled', body: 'This refill request was cancelled. Submit a new request if needed.', tone: 'neutral' }
  }
}

export function estimatedPickup(c: RefillCase): string {
  switch (c.status) {
    case 'FULFILLED':
    case 'READY_FOR_PICKUP':
      return 'Ready now'
    case 'RESOLVED':
    case 'COMPLETED':
      return 'Picked up'
    case 'REJECTED':
    case 'DENIED':
    case 'CANCELLED':
      return '—'
    case 'WAITING_FOR_PHARMACY':
    case 'PHARMACY_PROCESSING':
      return 'Today, within 1 hour'
    case 'APPROVED':
    case 'PRESCRIPTION_SENT':
    case 'WAITING_FOR_INSURANCE':
      return 'Today, by 5:00 PM'
    default:
      return 'Tomorrow, by noon'
  }
}

export function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatWaiting(since: number, now: number) {
  const mins = Math.max(0, Math.floor((now - since) / 60_000))
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function relativeTime(ts: number, now: number) {
  const mins = Math.floor((now - ts) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
