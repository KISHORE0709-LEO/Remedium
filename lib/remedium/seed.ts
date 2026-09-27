import type {
  Actor,
  EventTone,
  Medication,
  RefillCase,
  RemediumState,
  TimelineEvent,
} from './types'

const MIN = 60_000
const DAY = 24 * 60 * MIN

export const DEMO_PATIENT = {
  name: 'John Doe',
  dob: '04/12/1968',
  mrn: 'MRN-204417',
  phone: '(415) 555-0142',
  allergies: 'Penicillin',
}

export const DEMO_PROVIDER = 'Dr. Sarah Williams'
export const DEMO_PHARMACY = 'Harbor Pharmacy #214'
export const DEMO_PLAN = 'Meridian Health PBM'

export function patientMedications(now: number): Medication[] {
  return [
    {
      key: 'metformin',
      name: 'Metformin',
      strength: '500 mg',
      form: 'Tablet',
      sig: 'Take 1 tablet by mouth twice daily with meals',
      quantity: 60,
      daysSupply: 30,
      refillsRemaining: 0,
      lastFilled: now - 28 * DAY,
      requiresPA: false,
      tier: 1,
    },
    {
      key: 'atorvastatin',
      name: 'Atorvastatin',
      strength: '20 mg',
      form: 'Tablet',
      sig: 'Take 1 tablet by mouth nightly',
      quantity: 30,
      daysSupply: 30,
      refillsRemaining: 3,
      lastFilled: now - 26 * DAY,
      requiresPA: false,
      tier: 1,
    },
    {
      key: 'ozempic',
      name: 'Ozempic',
      strength: '0.5 mg pen',
      form: 'Injection',
      sig: 'Inject 0.5 mg subcutaneously once weekly',
      quantity: 1,
      daysSupply: 28,
      refillsRemaining: 2,
      lastFilled: now - 25 * DAY,
      requiresPA: true,
      tier: 3,
    },
  ]
}

let eventCounter = 0
export function makeEvent(
  label: string,
  at: number,
  tone: EventTone,
  actor: Actor,
  detail?: string,
): TimelineEvent {
  eventCounter += 1
  return {
    id: `ev-${at.toString(36)}-${eventCounter}-${Math.random().toString(36).slice(2, 6)}`,
    label,
    at,
    tone,
    actor,
    detail,
  }
}

interface SeedInput {
  id: string
  name: string
  dob: string
  mrn: string
  med: Omit<Medication, 'key' | 'lastFilled'> & { lastFilledDaysAgo: number }
  prescriber: string
  status: RefillCase['status']
  blockReason: RefillCase['blockReason']
  insurance: RefillCase['insurance']
  supplyDaysLeft: number
  urgent?: boolean
  startedMinAgo: number
  events: [string, number, EventTone, Actor, string?][]
}

function build(now: number, s: SeedInput): RefillCase {
  const createdAt = now - s.startedMinAgo * MIN
  const events = s.events.map(([label, minAgo, tone, actor, detail]) =>
    makeEvent(label, now - minAgo * MIN, tone, actor, detail),
  )
  return {
    id: s.id,
    patient: {
      name: s.name,
      dob: s.dob,
      mrn: s.mrn,
      phone: '(415) 555-01' + s.id.slice(-2),
      allergies: 'None reported',
    },
    medication: {
      key: s.med.name.toLowerCase(),
      name: s.med.name,
      strength: s.med.strength,
      form: s.med.form,
      sig: s.med.sig,
      quantity: s.med.quantity,
      daysSupply: s.med.daysSupply,
      refillsRemaining: s.med.refillsRemaining,
      requiresPA: s.med.requiresPA,
      tier: s.med.tier,
      lastFilled: now - s.med.lastFilledDaysAgo * DAY,
    },
    prescriber: s.prescriber,
    pharmacy: DEMO_PHARMACY,
    plan: DEMO_PLAN,
    status: s.status,
    blockReason: s.blockReason,
    insurance: s.insurance,
    supplyDaysLeft: s.supplyDaysLeft,
    urgent: s.urgent ?? false,
    createdAt,
    statusSince: events[events.length - 1]?.at ?? createdAt,
    refillHistory: [
      { date: now - (s.med.lastFilledDaysAgo + s.med.daysSupply) * DAY, quantity: s.med.quantity },
      { date: now - s.med.lastFilledDaysAgo * DAY, quantity: s.med.quantity },
    ],
    events,
  }
}

export function createSeedState(origin: string): RemediumState {
  const now = Date.now()
  const cases: RefillCase[] = [
    build(now, {
      id: 'RM-10474',
      name: 'Linda Brooks',
      dob: '09/02/1957',
      mrn: 'MRN-198803',
      med: {
        name: 'Albuterol HFA',
        strength: '90 mcg',
        form: 'Inhaler',
        sig: 'Inhale 2 puffs every 4–6 hours as needed',
        quantity: 1,
        daysSupply: 25,
        refillsRemaining: 0,
        requiresPA: false,
        tier: 1,
        lastFilledDaysAgo: 26,
      },
      prescriber: 'Dr. Sarah Williams',
      status: 'WAITING_FOR_PROVIDER',
      blockReason: 'no_refills',
      insurance: 'not_started',
      supplyDaysLeft: 0,
      urgent: true,
      startedMinAgo: 94,
      events: [
        ['Refill requested', 94, 'done', 'patient'],
        ['Pharmacy reviewed', 93, 'done', 'pharmacy'],
        ['No refills remaining', 93, 'warning', 'remedium'],
        ['Provider review requested', 92, 'active', 'remedium', 'Routed to Dr. Sarah Williams'],
      ],
    }),
    build(now, {
      id: 'RM-10471',
      name: 'Maria Gonzalez',
      dob: '11/23/1972',
      mrn: 'MRN-201156',
      med: {
        name: 'Lisinopril',
        strength: '10 mg',
        form: 'Tablet',
        sig: 'Take 1 tablet by mouth once daily',
        quantity: 30,
        daysSupply: 30,
        refillsRemaining: 0,
        requiresPA: false,
        tier: 1,
        lastFilledDaysAgo: 29,
      },
      prescriber: 'Dr. Sarah Williams',
      status: 'WAITING_FOR_PROVIDER',
      blockReason: 'no_refills',
      insurance: 'not_started',
      supplyDaysLeft: 1,
      startedMinAgo: 47,
      events: [
        ['Refill requested', 47, 'done', 'patient'],
        ['Pharmacy reviewed', 46, 'done', 'pharmacy'],
        ['No refills remaining', 46, 'warning', 'remedium'],
        ['Provider review requested', 45, 'active', 'remedium', 'Routed to Dr. Sarah Williams'],
      ],
    }),
    build(now, {
      id: 'RM-10468',
      name: 'David Chen',
      dob: '02/14/1981',
      mrn: 'MRN-199742',
      med: {
        name: 'Ozempic',
        strength: '1 mg pen',
        form: 'Injection',
        sig: 'Inject 1 mg subcutaneously once weekly',
        quantity: 1,
        daysSupply: 28,
        refillsRemaining: 3,
        requiresPA: true,
        tier: 3,
        lastFilledDaysAgo: 24,
      },
      prescriber: 'Dr. Sarah Williams',
      status: 'BLOCKED',
      blockReason: 'pa_required',
      insurance: 'pa_required',
      supplyDaysLeft: 4,
      startedMinAgo: 182,
      events: [
        ['Refill requested', 182, 'done', 'patient'],
        ['Pharmacy reviewed', 180, 'done', 'pharmacy'],
        ['Insurance verification', 178, 'active', 'remedium'],
        ['Prior authorization required', 131, 'warning', 'insurance', 'GLP-1 agonists require PA under plan policy'],
      ],
    }),
    build(now, {
      id: 'RM-10465',
      name: 'Aisha Patel',
      dob: '06/30/1964',
      mrn: 'MRN-200381',
      med: {
        name: 'Eliquis',
        strength: '5 mg',
        form: 'Tablet',
        sig: 'Take 1 tablet by mouth twice daily',
        quantity: 60,
        daysSupply: 30,
        refillsRemaining: 2,
        requiresPA: false,
        tier: 2,
        lastFilledDaysAgo: 27,
      },
      prescriber: 'Dr. Priya Raman',
      status: 'WAITING_FOR_INSURANCE',
      blockReason: null,
      insurance: 'pending',
      supplyDaysLeft: 3,
      startedMinAgo: 22,
      events: [
        ['Refill requested', 22, 'done', 'patient'],
        ['Pharmacy reviewed', 21, 'done', 'pharmacy'],
        ['Insurance verification', 20, 'active', 'remedium', 'Claim submitted to Meridian Health PBM'],
      ],
    }),
    build(now, {
      id: 'RM-10460',
      name: 'Robert Kim',
      dob: '01/08/1959',
      mrn: 'MRN-197620',
      med: {
        name: 'Atorvastatin',
        strength: '40 mg',
        form: 'Tablet',
        sig: 'Take 1 tablet by mouth nightly',
        quantity: 30,
        daysSupply: 30,
        refillsRemaining: 4,
        requiresPA: false,
        tier: 1,
        lastFilledDaysAgo: 28,
      },
      prescriber: 'Dr. Sarah Williams',
      status: 'PHARMACY_PROCESSING',
      blockReason: null,
      insurance: 'approved',
      supplyDaysLeft: 2,
      startedMinAgo: 64,
      events: [
        ['Refill requested', 64, 'done', 'patient'],
        ['Pharmacy reviewed', 63, 'done', 'pharmacy'],
        ['Insurance verification', 62, 'done', 'remedium'],
        ['Coverage confirmed', 58, 'done', 'insurance', 'Tier 1 · $5.00 copay'],
        ['Pharmacy filling', 14, 'active', 'pharmacy'],
      ],
    }),
    build(now, {
      id: 'RM-10455',
      name: 'Emily Johnson',
      dob: '07/19/1990',
      mrn: 'MRN-203318',
      med: {
        name: 'Levothyroxine',
        strength: '50 mcg',
        form: 'Tablet',
        sig: 'Take 1 tablet by mouth every morning',
        quantity: 90,
        daysSupply: 90,
        refillsRemaining: 1,
        requiresPA: false,
        tier: 1,
        lastFilledDaysAgo: 86,
      },
      prescriber: 'Dr. Priya Raman',
      status: 'READY_FOR_PICKUP',
      blockReason: null,
      insurance: 'approved',
      supplyDaysLeft: 4,
      startedMinAgo: 240,
      events: [
        ['Refill requested', 240, 'done', 'patient'],
        ['Pharmacy reviewed', 238, 'done', 'pharmacy'],
        ['Coverage confirmed', 230, 'done', 'insurance', 'Tier 1 · $0.00 copay'],
        ['Pharmacy filling', 190, 'done', 'pharmacy'],
        ['Ready for pickup', 35, 'done', 'pharmacy', 'Bin A-14 · Patient notified by SMS'],
      ],
    }),
    build(now, {
      id: 'RM-10449',
      name: 'James Wilson',
      dob: '03/03/1949',
      mrn: 'MRN-196114',
      med: {
        name: 'Amlodipine',
        strength: '5 mg',
        form: 'Tablet',
        sig: 'Take 1 tablet by mouth once daily',
        quantity: 30,
        daysSupply: 30,
        refillsRemaining: 5,
        requiresPA: false,
        tier: 1,
        lastFilledDaysAgo: 0,
      },
      prescriber: 'Dr. Michael Osei',
      status: 'COMPLETED',
      blockReason: null,
      insurance: 'approved',
      supplyDaysLeft: 30,
      startedMinAgo: 420,
      events: [
        ['Refill requested', 420, 'done', 'patient'],
        ['Pharmacy reviewed', 418, 'done', 'pharmacy'],
        ['Coverage confirmed', 410, 'done', 'insurance'],
        ['Pharmacy filling', 380, 'done', 'pharmacy'],
        ['Ready for pickup', 300, 'done', 'pharmacy'],
        ['Picked up · Completed', 120, 'done', 'patient'],
      ],
    }),
  ]

  return {
    version: 1,
    origin,
    nextCaseNumber: 10482,
    cases,
    notifications: [
      {
        id: 'n-seed-1',
        role: 'pharmacy',
        caseId: 'RM-10474',
        title: 'Urgent refill waiting on provider',
        body: 'Linda Brooks · Albuterol HFA · supply exhausted today.',
        tone: 'error',
        at: now - 90 * MIN,
        read: false,
      },
      {
        id: 'n-seed-2',
        role: 'provider',
        caseId: 'RM-10471',
        title: 'Refill needs your review',
        body: 'Maria Gonzalez · Lisinopril 10 mg · no refills remaining.',
        tone: 'warning',
        at: now - 45 * MIN,
        read: false,
      },
      {
        id: 'n-seed-3',
        role: 'insurance',
        caseId: 'RM-10465',
        title: 'Coverage check pending',
        body: 'Aisha Patel · Eliquis 5 mg · Tier 2 claim submitted.',
        tone: 'active',
        at: now - 20 * MIN,
        read: false,
      },
      {
        id: 'n-seed-4',
        role: 'patient',
        caseId: '',
        title: 'Metformin supply running low',
        body: 'About 2 days left. Request a refill — Remedium will handle the rest.',
        tone: 'warning',
        at: now - 60 * MIN,
        read: false,
      },
    ],
  }
}
