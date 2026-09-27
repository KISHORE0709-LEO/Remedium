import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  Timestamp,
  serverTimestamp,
  addDoc,
  limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type {
  Actor,
  AppNotification,
  BlockReason,
  EventTone,
  InsuranceState,
  RefillCase,
  RefillStatus,
  Role,
  TimelineEvent,
} from './types'

// Collection constants
export const COLLECTIONS = {
  USERS: 'users',
  PATIENTS: 'patients',
  PRESCRIPTIONS: 'prescriptions',
  REFILLS: 'refills',
  WORKFLOW_EVENTS: 'workflowEvents',
  NOTIFICATIONS: 'notifications',
  INSURANCE_ISSUES: 'insuranceIssues',
} as const

// Raw Firestore Refill Document schema
export interface FirestoreRefillDoc {
  id: string
  refillId: string
  patientId: string
  patientName: string
  dob: string
  mrn: string
  phone: string
  allergies: string
  medication: string
  dosage: string
  sig: string
  quantity: number
  daysSupply: number
  supplyDaysLeft: number
  pharmacyId: string
  pharmacyName: string
  providerId: string
  providerName: string
  plan: string
  status: RefillStatus
  blocker: string | null
  blockReason: BlockReason
  waitingFor: string
  priority: 'urgent' | 'standard'
  urgent: boolean
  createdAt: any
  updatedAt: any
  statusSince: any
  aiSummary: string
  aiRecommendation: string
  assignedTo: string
  insurance: InsuranceState
  refillsRemaining: number
  requiresPA: boolean
  tier: 1 | 2 | 3
}

// Convert timestamp to epoch milliseconds
export function timestampToMillis(ts: any, fallback = Date.now()): number {
  if (!ts) return fallback
  if (typeof ts === 'number') return ts
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.toDate === 'function') return ts.toDate().getTime()
  if (ts.seconds) return ts.seconds * 1000
  return fallback
}

// Converter from Firestore Refill Doc to RefillCase (for UI compatibility)
export function toRefillCase(
  docData: any,
  events: TimelineEvent[] = [],
): RefillCase {
  const createdMs = timestampToMillis(docData.createdAt)
  const statusSinceMs = timestampToMillis(docData.statusSince, createdMs)
  const updatedMs = timestampToMillis(docData.updatedAt, createdMs)

  return {
    id: docData.refillId || docData.id,
    refillId: docData.refillId || docData.id,
    patientId: docData.patientId || 'patient-1',
    patient: {
      name: docData.patientName || 'Unknown Patient',
      dob: docData.dob || '01/01/1980',
      mrn: docData.mrn || 'MRN-000000',
      phone: docData.phone || '(555) 000-0000',
      allergies: docData.allergies || 'None documented',
    },
    medication: {
      key: (docData.medication || '').toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: docData.medication || 'Medication',
      strength: docData.dosage || '',
      form: 'Tablet',
      sig: docData.sig || 'Take as directed',
      quantity: docData.quantity || 30,
      daysSupply: docData.daysSupply || 30,
      refillsRemaining: docData.refillsRemaining ?? 0,
      lastFilled: createdMs - 30 * 86_400_000,
      requiresPA: !!docData.requiresPA,
      tier: docData.tier || 1,
    },
    prescriber: docData.providerName || 'Dr. Sarah Williams',
    providerId: docData.providerId || 'dr-sarah-williams',
    pharmacy: docData.pharmacyName || 'Harbor Pharmacy #214',
    pharmacyId: docData.pharmacyId || 'harbor-pharmacy-214',
    plan: docData.plan || 'Meridian Health PBM',
    status: docData.status || 'CHECKING',
    blocker: docData.blocker || null,
    blockReason: docData.blockReason || null,
    waitingFor: docData.waitingFor || 'Pharmacist Review',
    priority: docData.priority || (docData.urgent ? 'urgent' : 'standard'),
    aiSummary: docData.aiSummary || '',
    aiRecommendation: docData.aiRecommendation || '',
    assignedTo: docData.assignedTo || 'pharmacy',
    insurance: docData.insurance || 'not_started',
    supplyDaysLeft: docData.supplyDaysLeft ?? 3,
    urgent: !!docData.urgent || docData.priority === 'urgent',
    createdAt: createdMs,
    updatedAt: updatedMs,
    statusSince: statusSinceMs,
    refillHistory: [
      { date: createdMs - 60 * 86_400_000, quantity: docData.quantity || 30 },
      { date: createdMs - 30 * 86_400_000, quantity: docData.quantity || 30 },
    ],
    events: events,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7 REQUIRED DEMO SCENARIOS (SYNTHETIC HEALTHCARE DATA)
// ─────────────────────────────────────────────────────────────────────────────
export function getInitialDemoScenarios() {
  const now = Date.now()
  const HOUR = 3600_000
  const DAY = 24 * HOUR

  return [
    // 1. No refills remaining → waiting for provider
    {
      refill: {
        id: 'RM-10482',
        refillId: 'RM-10482',
        patientId: 'pat-101',
        patientName: 'John Doe',
        dob: '04/12/1968',
        mrn: 'MRN-204417',
        phone: '(415) 555-0142',
        allergies: 'Penicillin',
        medication: 'Metformin',
        dosage: '500 mg',
        sig: 'Take 1 tablet by mouth twice daily with meals',
        quantity: 60,
        daysSupply: 30,
        supplyDaysLeft: 2,
        pharmacyId: 'harbor-pharmacy-214',
        pharmacyName: 'Harbor Pharmacy #214',
        providerId: 'dr-sarah-williams',
        providerName: 'Dr. Sarah Williams',
        plan: 'Meridian Health PBM',
        status: 'WAITING_FOR_PROVIDER' as RefillStatus,
        blocker: '0 refills remaining on prescription',
        blockReason: 'no_refills' as BlockReason,
        waitingFor: 'Dr. Sarah Williams',
        priority: 'urgent' as const,
        urgent: true,
        aiSummary:
          'Remedium AI identified 0 refills remaining on prescription. Historical adherence is 94%. Automatic renewal request routed to Bayview Medicine.',
        aiRecommendation: 'Authorize 5 maintenance renewals for 30-day supply.',
        assignedTo: 'provider',
        insurance: 'pending' as InsuranceState,
        refillsRemaining: 0,
        requiresPA: false,
        tier: 1 as const,
        createdAt: Timestamp.fromMillis(now - 3 * HOUR),
        updatedAt: Timestamp.fromMillis(now - 3 * HOUR),
        statusSince: Timestamp.fromMillis(now - 3 * HOUR),
      },
      events: [
        { label: 'Refill requested by patient', tone: 'done', actor: 'patient', detail: 'Requested via patient mobile app', at: now - 3.2 * HOUR },
        { label: 'Pharmacy intake verified', tone: 'done', actor: 'pharmacy', detail: 'Received at Harbor Pharmacy #214', at: now - 3.1 * HOUR },
        { label: 'Blocker detected: 0 refills remaining', tone: 'warning', actor: 'remedium', detail: 'Prescription renewal authorization required', at: now - 3 * HOUR },
        { label: 'Renewal routed to provider', tone: 'active', actor: 'remedium', detail: 'Dr. Sarah Williams · Bayview Medicine queue', at: now - 3 * HOUR },
      ],
      notification: {
        role: 'pharmacy' as Role,
        title: 'Refill waiting on provider',
        body: 'RM-10482: John Doe (Metformin 500mg) waiting on Dr. Williams',
        tone: 'warning' as EventTone,
        caseId: 'RM-10482',
        at: now - 3 * HOUR,
      },
    },

    // 2. Insurance issue → waiting for insurance
    {
      refill: {
        id: 'RM-10483',
        refillId: 'RM-10483',
        patientId: 'pat-102',
        patientName: 'Maria Garcia',
        dob: '09/22/1974',
        mrn: 'MRN-582910',
        phone: '(415) 555-0189',
        allergies: 'Sulfa drugs',
        medication: 'Ozempic',
        dosage: '0.5 mg pen',
        sig: 'Inject 0.5 mg subcutaneously once weekly',
        quantity: 1,
        daysSupply: 28,
        supplyDaysLeft: 3,
        pharmacyId: 'harbor-pharmacy-214',
        pharmacyName: 'Harbor Pharmacy #214',
        providerId: 'dr-sarah-williams',
        providerName: 'Dr. Sarah Williams',
        plan: 'Meridian Health PBM',
        status: 'BLOCKED' as RefillStatus,
        blocker: 'Prior Authorization required by Meridian Health PBM',
        blockReason: 'pa_required' as BlockReason,
        waitingFor: 'Meridian Health PBM',
        priority: 'urgent' as const,
        urgent: true,
        aiSummary:
          'Payer flagged GLP-1 receptor agonist under Tier 3 formulary policy. Remedium pre-filled PA packet with HbA1c 8.2% clinical chart history.',
        aiRecommendation: 'Submit auto-assembled PA packet to Meridian Health PBM.',
        assignedTo: 'pharmacy',
        insurance: 'pa_required' as InsuranceState,
        refillsRemaining: 2,
        requiresPA: true,
        tier: 3 as const,
        createdAt: Timestamp.fromMillis(now - 5 * HOUR),
        updatedAt: Timestamp.fromMillis(now - 4.8 * HOUR),
        statusSince: Timestamp.fromMillis(now - 4.8 * HOUR),
      },
      events: [
        { label: 'Refill requested by patient', tone: 'done', actor: 'patient', detail: 'Maintenance renewal request', at: now - 5.1 * HOUR },
        { label: 'Prior Authorization required', tone: 'warning', actor: 'insurance', detail: 'Meridian Health PBM Tier 3 clinical criteria', at: now - 4.9 * HOUR },
        { label: 'PA packet auto-assembled', tone: 'info', actor: 'remedium', detail: 'Clinical chart justification pre-compiled', at: now - 4.8 * HOUR },
      ],
      notification: {
        role: 'pharmacy' as Role,
        title: 'Prior authorization required',
        body: 'RM-10483: Maria Garcia (Ozempic 0.5mg) requires PA submission',
        tone: 'warning' as EventTone,
        caseId: 'RM-10483',
        at: now - 4.8 * HOUR,
      },
    },

    // 3. Missing information
    {
      refill: {
        id: 'RM-10484',
        refillId: 'RM-10484',
        patientId: 'pat-103',
        patientName: 'James Wilson',
        dob: '01/15/1962',
        mrn: 'MRN-391024',
        phone: '(415) 555-0233',
        allergies: 'No known drug allergies (NKDA)',
        medication: 'Lisinopril',
        dosage: '10 mg',
        sig: 'Take 1 tablet by mouth daily in the morning',
        quantity: 30,
        daysSupply: 30,
        supplyDaysLeft: 4,
        pharmacyId: 'harbor-pharmacy-214',
        pharmacyName: 'Harbor Pharmacy #214',
        providerId: 'dr-kevin-vance',
        providerName: 'Dr. Kevin Vance',
        plan: 'Blue Shield Health',
        status: 'BLOCKED' as RefillStatus,
        blocker: 'Missing diagnosis code (ICD-10) and prescriber supervisor NPI on e-Rx transmission',
        blockReason: 'missing_info' as BlockReason,
        waitingFor: 'Pacific Heights Clinic Staff',
        priority: 'standard' as const,
        urgent: false,
        aiSummary:
          'Electronic intake validation detected missing ICD-10 indication (Essential Hypertension I10) required for insurance clearing.',
        aiRecommendation: 'Request clinic intake coordinator re-transmit prescription with ICD-10 I10.',
        assignedTo: 'remedium',
        insurance: 'pending' as InsuranceState,
        refillsRemaining: 1,
        requiresPA: false,
        tier: 1 as const,
        createdAt: Timestamp.fromMillis(now - 6 * HOUR),
        updatedAt: Timestamp.fromMillis(now - 5.5 * HOUR),
        statusSince: Timestamp.fromMillis(now - 5.5 * HOUR),
      },
      events: [
        { label: 'e-Rx intake received', tone: 'done', actor: 'pharmacy', detail: 'NCPDP SCRIPT message parsed', at: now - 6 * HOUR },
        { label: 'Missing data detected', tone: 'warning', actor: 'remedium', detail: 'Missing ICD-10 indication and supervisor NPI', at: now - 5.8 * HOUR },
        { label: 'Clarification sent to clinic', tone: 'active', actor: 'remedium', detail: 'Automated query routed to Pacific Heights Clinic', at: now - 5.5 * HOUR },
      ],
      notification: {
        role: 'pharmacy' as Role,
        title: 'Missing information on e-Rx',
        body: 'RM-10484: James Wilson (Lisinopril 10mg) missing diagnosis code',
        tone: 'info' as EventTone,
        caseId: 'RM-10484',
        at: now - 5.5 * HOUR,
      },
    },

    // 4. Provider approved → waiting for pharmacy
    {
      refill: {
        id: 'RM-10485',
        refillId: 'RM-10485',
        patientId: 'pat-104',
        patientName: 'Robert Chen',
        dob: '06/30/1979',
        mrn: 'MRN-849201',
        phone: '(415) 555-0311',
        allergies: 'Aspirin',
        medication: 'Atorvastatin',
        dosage: '20 mg',
        sig: 'Take 1 tablet by mouth nightly at bedtime',
        quantity: 30,
        daysSupply: 30,
        supplyDaysLeft: 5,
        pharmacyId: 'harbor-pharmacy-214',
        pharmacyName: 'Harbor Pharmacy #214',
        providerId: 'dr-sarah-williams',
        providerName: 'Dr. Sarah Williams',
        plan: 'Meridian Health PBM',
        status: 'PHARMACY_PROCESSING' as RefillStatus,
        blocker: null,
        blockReason: null,
        waitingFor: 'Harbor Pharmacy #214',
        priority: 'standard' as const,
        urgent: false,
        aiSummary:
          'Dr. Sarah Williams authorized 5 renewals. Formulary confirmed Tier 1 ($5 copay). Label printed, queued for fill & verification.',
        aiRecommendation: 'Compound/fill medication and mark ready for pickup.',
        assignedTo: 'pharmacy',
        insurance: 'approved' as InsuranceState,
        refillsRemaining: 5,
        requiresPA: false,
        tier: 1 as const,
        createdAt: Timestamp.fromMillis(now - 1.5 * HOUR),
        updatedAt: Timestamp.fromMillis(now - 0.8 * HOUR),
        statusSince: Timestamp.fromMillis(now - 0.8 * HOUR),
      },
      events: [
        { label: 'Provider approved renewal', tone: 'done', actor: 'provider', detail: 'Dr. Sarah Williams authorized 5 refills', at: now - 1.2 * HOUR },
        { label: 'Coverage confirmed', tone: 'done', actor: 'insurance', detail: 'Tier 1 · $5.00 copay confirmed', at: now - 1 * HOUR },
        { label: 'Pharmacy filling', tone: 'active', actor: 'pharmacy', detail: 'Prescription in verification queue', at: now - 0.8 * HOUR },
      ],
      notification: {
        role: 'pharmacy' as Role,
        title: 'Prescription approved - ready to fill',
        body: 'RM-10485: Robert Chen (Atorvastatin 20mg) ready for compounding',
        tone: 'done' as EventTone,
        caseId: 'RM-10485',
        at: now - 0.8 * HOUR,
      },
    },

    // 5. Ready for pickup
    {
      refill: {
        id: 'RM-10486',
        refillId: 'RM-10486',
        patientId: 'pat-105',
        patientName: 'Eleanor Vance',
        dob: '11/08/1955',
        mrn: 'MRN-773194',
        phone: '(415) 555-0422',
        allergies: 'No known drug allergies (NKDA)',
        medication: 'Levothyroxine',
        dosage: '50 mcg',
        sig: 'Take 1 tablet by mouth every morning 30 minutes before breakfast',
        quantity: 90,
        daysSupply: 90,
        supplyDaysLeft: 90,
        pharmacyId: 'harbor-pharmacy-214',
        pharmacyName: 'Harbor Pharmacy #214',
        providerId: 'dr-michael-chang',
        providerName: 'Dr. Michael Chang',
        plan: 'Medicare Part D',
        status: 'READY_FOR_PICKUP' as RefillStatus,
        blocker: null,
        blockReason: null,
        waitingFor: 'Patient',
        priority: 'standard' as const,
        urgent: false,
        aiSummary:
          'Prescription filled, verified by pharmacist, and placed in pickup bin B-14. Automated SMS sent to patient.',
        aiRecommendation: 'Dispense to patient upon counter arrival.',
        assignedTo: 'patient',
        insurance: 'approved' as InsuranceState,
        refillsRemaining: 3,
        requiresPA: false,
        tier: 1 as const,
        createdAt: Timestamp.fromMillis(now - 2 * HOUR),
        updatedAt: Timestamp.fromMillis(now - 45 * 60_000),
        statusSince: Timestamp.fromMillis(now - 45 * 60_000),
      },
      events: [
        { label: 'Prescription filled & verified', tone: 'done', actor: 'pharmacy', detail: 'Verified by Alex Rivera, PharmD', at: now - 50 * 60_000 },
        { label: 'Ready for pickup', tone: 'done', actor: 'pharmacy', detail: 'Bin B-14 · Patient SMS notification sent', at: now - 45 * 60_000 },
      ],
      notification: {
        role: 'pharmacy' as Role,
        title: 'Prescription in pickup bin',
        body: 'RM-10486: Eleanor Vance (Levothyroxine 50mcg) ready for pickup',
        tone: 'done' as EventTone,
        caseId: 'RM-10486',
        at: now - 45 * 60_000,
      },
    },

    // 6. Resolved refill
    {
      refill: {
        id: 'RM-10487',
        refillId: 'RM-10487',
        patientId: 'pat-106',
        patientName: 'Marcus Brody',
        dob: '03/19/1983',
        mrn: 'MRN-602811',
        phone: '(415) 555-0567',
        allergies: 'Codeine',
        medication: 'Amlodipine',
        dosage: '5 mg',
        sig: 'Take 1 tablet by mouth daily in the morning',
        quantity: 30,
        daysSupply: 30,
        supplyDaysLeft: 30,
        pharmacyId: 'harbor-pharmacy-214',
        pharmacyName: 'Harbor Pharmacy #214',
        providerId: 'dr-sarah-williams',
        providerName: 'Dr. Sarah Williams',
        plan: 'Meridian Health PBM',
        status: 'COMPLETED' as RefillStatus,
        blocker: null,
        blockReason: null,
        waitingFor: 'Resolved',
        priority: 'standard' as const,
        urgent: false,
        aiSummary:
          'Refill cycle resolved. Medication picked up and copay collected ($5.00). Adherence counter reset.',
        aiRecommendation: 'Next anticipated refill in 25 days.',
        assignedTo: 'pharmacy',
        insurance: 'approved' as InsuranceState,
        refillsRemaining: 4,
        requiresPA: false,
        tier: 1 as const,
        createdAt: Timestamp.fromMillis(now - 2 * DAY),
        updatedAt: Timestamp.fromMillis(now - 1.8 * DAY),
        statusSince: Timestamp.fromMillis(now - 1.8 * DAY),
      },
      events: [
        { label: 'Dispensed to patient', tone: 'done', actor: 'pharmacy', detail: 'ID verified, consultation completed', at: now - 1.8 * DAY },
        { label: 'Refill completed', tone: 'done', actor: 'remedium', detail: '30-day adherence tracker initialized', at: now - 1.8 * DAY },
      ],
      notification: {
        role: 'pharmacy' as Role,
        title: 'Refill completed',
        body: 'RM-10487: Marcus Brody picked up Amlodipine 5mg',
        tone: 'done' as EventTone,
        caseId: 'RM-10487',
        at: now - 1.8 * DAY,
      },
    },

    // 7. Conflicting information requiring human review
    {
      refill: {
        id: 'RM-10488',
        refillId: 'RM-10488',
        patientId: 'pat-107',
        patientName: 'Sarah Jenkins',
        dob: '08/14/1971',
        mrn: 'MRN-419823',
        phone: '(415) 555-0678',
        allergies: 'Ciprofloxacin',
        medication: 'Gabapentin',
        dosage: '300 mg',
        sig: 'Take 1 capsule by mouth three times daily',
        quantity: 90,
        daysSupply: 30,
        supplyDaysLeft: 1,
        pharmacyId: 'harbor-pharmacy-214',
        pharmacyName: 'Harbor Pharmacy #214',
        providerId: 'dr-emily-hayes',
        providerName: 'Dr. Emily Hayes',
        plan: 'Aetna Commercial',
        status: 'BLOCKED' as RefillStatus,
        blocker: 'Conflicting clinical dose: 300 mg TID requested but EHR medication history records 100 mg BID',
        blockReason: 'conflict_review' as BlockReason,
        waitingFor: 'Clinical Pharmacist / Prescriber Clarification',
        priority: 'urgent' as const,
        urgent: true,
        aiSummary:
          'Remedium AI safety cross-check detected 3x dosage jump without documented titration schedule in electronic health record.',
        aiRecommendation: 'Clarify titration intent with Dr. Hayes before dispensing 300 mg strength.',
        assignedTo: 'pharmacy',
        insurance: 'pending' as InsuranceState,
        refillsRemaining: 1,
        requiresPA: false,
        tier: 1 as const,
        createdAt: Timestamp.fromMillis(now - 4 * HOUR),
        updatedAt: Timestamp.fromMillis(now - 3.8 * HOUR),
        statusSince: Timestamp.fromMillis(now - 3.8 * HOUR),
      },
      events: [
        { label: 'Refill request submitted', tone: 'done', actor: 'pharmacy', detail: 'Intake at Harbor Pharmacy #214', at: now - 4 * HOUR },
        { label: 'Dose safety conflict flagged', tone: 'error', actor: 'remedium', detail: '300mg TID exceeds previous documented dose of 100mg BID', at: now - 3.9 * HOUR },
        { label: 'Clinical hold placed', tone: 'warning', actor: 'pharmacy', detail: 'Escalated for pharmacist clinical review', at: now - 3.8 * HOUR },
      ],
      notification: {
        role: 'pharmacy' as Role,
        title: 'Safety alert: Conflicting dosage',
        body: 'RM-10488: Sarah Jenkins (Gabapentin 300mg) requires clinical verification',
        tone: 'error' as EventTone,
        caseId: 'RM-10488',
        at: now - 3.8 * HOUR,
      },
    },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATABASE (Idempotent seed check)
// ─────────────────────────────────────────────────────────────────────────────
export async function seedFirestoreIfEmpty(force = false): Promise<void> {
  try {
    const refillsCol = collection(db, COLLECTIONS.REFILLS)
    const existingSnap = await getDocs(query(refillsCol, limit(1)))

    if (!existingSnap.empty && !force) {
      return
    }

    const scenarios = getInitialDemoScenarios()

    for (const scenario of scenarios) {
      // 1. Write Refill document
      await setDoc(doc(db, COLLECTIONS.REFILLS, scenario.refill.id), scenario.refill)

      // 2. Write Workflow Events
      for (const ev of scenario.events) {
        const evId = `ev-${scenario.refill.id}-${Math.random().toString(36).slice(2, 7)}`
        await setDoc(doc(db, COLLECTIONS.WORKFLOW_EVENTS, evId), {
          id: evId,
          refillId: scenario.refill.id,
          label: ev.label,
          detail: ev.detail,
          tone: ev.tone,
          actor: ev.actor,
          createdAt: Timestamp.fromMillis(ev.at),
        })
      }

      // 3. Write Notification
      if (scenario.notification) {
        const notifId = `notif-${scenario.refill.id}`
        await setDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notifId), {
          id: notifId,
          role: scenario.notification.role,
          pharmacyId: 'harbor-pharmacy-214',
          providerId: scenario.refill.providerId,
          caseId: scenario.refill.id,
          title: scenario.notification.title,
          body: scenario.notification.body,
          tone: scenario.notification.tone,
          read: false,
          createdAt: Timestamp.fromMillis(scenario.notification.at),
        })
      }

      // 4. Write Patient profile
      await setDoc(doc(db, COLLECTIONS.PATIENTS, scenario.refill.patientId), {
        patientId: scenario.refill.patientId,
        name: scenario.refill.patientName,
        dob: scenario.refill.dob,
        mrn: scenario.refill.mrn,
        phone: scenario.refill.phone,
        allergies: scenario.refill.allergies,
        pharmacyId: scenario.refill.pharmacyId,
        providerId: scenario.refill.providerId,
        plan: scenario.refill.plan,
        createdAt: scenario.refill.createdAt,
      })

      // 5. Write Prescription record
      const rxId = `rx-${scenario.refill.id}`
      await setDoc(doc(db, COLLECTIONS.PRESCRIPTIONS, rxId), {
        prescriptionId: rxId,
        patientId: scenario.refill.patientId,
        medicationName: scenario.refill.medication,
        dosage: scenario.refill.dosage,
        sig: scenario.refill.sig,
        quantity: scenario.refill.quantity,
        daysSupply: scenario.refill.daysSupply,
        refillsRemaining: scenario.refill.refillsRemaining,
        requiresPA: scenario.refill.requiresPA,
        pharmacyId: scenario.refill.pharmacyId,
        providerId: scenario.refill.providerId,
        createdAt: scenario.refill.createdAt,
      })

      // 6. Write Insurance issue if applicable
      if (scenario.refill.blockReason === 'pa_required') {
        const issueId = `pa-${scenario.refill.id}`
        await setDoc(doc(db, COLLECTIONS.INSURANCE_ISSUES, issueId), {
          id: issueId,
          refillId: scenario.refill.id,
          plan: scenario.refill.plan,
          issueType: 'pa_required',
          status: 'pending',
          notes: 'Remedium auto-packet assembled with HbA1c history',
          createdAt: scenario.refill.createdAt,
        })
      }
    }
  } catch (error) {
    console.error('Error seeding Firestore demo data:', error)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REAL-TIME FIRESTORE SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────

// Subscribe to refills and real-time workflow events for complete case timeline
export function subscribeToRefills(
  callback: (refills: RefillCase[]) => void,
  pharmacyId = 'harbor-pharmacy-214',
) {
  const refillsCol = collection(db, COLLECTIONS.REFILLS)
  const eventsCol = collection(db, COLLECTIONS.WORKFLOW_EVENTS)

  let latestRefillDocs: any[] = []
  let latestEventsDocs: any[] = []
  let seeded = false

  function notify() {
    if (latestRefillDocs.length === 0) return

    const eventsByCase = new Map<string, TimelineEvent[]>()
    latestEventsDocs.forEach((docSnap) => {
      const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap
      const ev: TimelineEvent = {
        id: data.id || docSnap.id,
        label: data.label,
        detail: data.detail,
        tone: data.tone || 'info',
        actor: data.actor || 'remedium',
        at: timestampToMillis(data.createdAt),
      }
      const cEvents = eventsByCase.get(data.refillId) || []
      cEvents.push(ev)
      eventsByCase.set(data.refillId, cEvents)
    })

    const converted: RefillCase[] = latestRefillDocs.map((docSnap) => {
      const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap
      const caseEvents = (eventsByCase.get(data.refillId || data.id) || []).sort(
        (a, b) => a.at - b.at,
      )
      return toRefillCase(data, caseEvents)
    })

    callback(converted)
  }

  // 1. Subscribe to Refill documents
  const unsubRefills = onSnapshot(
    refillsCol,
    async (snapshot) => {
      if (snapshot.empty && !seeded) {
        seeded = true
        await seedFirestoreIfEmpty()
        return
      }
      latestRefillDocs = snapshot.docs
      notify()
    },
    (err) => {
      console.error('Firestore refills listener error:', err)
    },
  )

  // 2. Subscribe to Workflow events in real time
  const unsubEvents = onSnapshot(
    eventsCol,
    (snapshot) => {
      latestEventsDocs = snapshot.docs
      notify()
    },
    (err) => {
      console.error('Firestore workflowEvents listener error in subscribeToRefills:', err)
    },
  )

  return () => {
    unsubRefills()
    unsubEvents()
  }
}

// Subscribe to all workflow events (for Timeline page)
export function subscribeToWorkflowEvents(
  callback: (events: (TimelineEvent & { refillId: string })[]) => void,
) {
  const eventsCol = collection(db, COLLECTIONS.WORKFLOW_EVENTS)

  return onSnapshot(
    eventsCol,
    (snapshot) => {
      const events = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data()
          return {
            id: data.id || docSnap.id,
            refillId: data.refillId,
            label: data.label,
            detail: data.detail,
            tone: data.tone || 'info',
            actor: data.actor || 'remedium',
            at: timestampToMillis(data.createdAt),
          }
        })
        .sort((a, b) => b.at - a.at)

      callback(events)
    },
    (err) => {
      console.error('Firestore workflowEvents listener error:', err)
    },
  )
}

// Subscribe to notifications
export function subscribeToNotifications(
  role: Role,
  callback: (notifications: AppNotification[]) => void,
) {
  const notifCol = collection(db, COLLECTIONS.NOTIFICATIONS)

  return onSnapshot(
    notifCol,
    (snapshot) => {
      const notifications = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data()
          return {
            id: data.id || docSnap.id,
            role: data.role || 'pharmacy',
            caseId: data.caseId || '',
            title: data.title || '',
            body: data.body || '',
            tone: data.tone || 'info',
            at: timestampToMillis(data.createdAt),
            read: !!data.read,
          }
        })
        .filter((n) => n.role === role)
        .sort((a, b) => b.at - a.at)

      callback(notifications)
    },
    (err) => {
      console.error('Firestore notifications listener error:', err)
    },
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW ACTIONS (Writing directly to Firestore)
// ─────────────────────────────────────────────────────────────────────────────

// Helper to log a timeline workflow event
export async function logWorkflowEvent(
  refillId: string,
  label: string,
  detail: string,
  tone: EventTone,
  actor: Actor,
) {
  const evId = `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  await setDoc(doc(db, COLLECTIONS.WORKFLOW_EVENTS, evId), {
    id: evId,
    refillId,
    label,
    detail,
    tone,
    actor,
    createdAt: serverTimestamp(),
  })
}

// Helper to create an in-app notification
export async function createNotification(
  role: Role,
  caseId: string,
  title: string,
  body: string,
  tone: EventTone,
) {
  const notifId = `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  await setDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notifId), {
    id: notifId,
    role,
    caseId,
    title,
    body,
    tone,
    read: false,
    createdAt: serverTimestamp(),
  })
}

// 1. Submit a new refill request from Pharmacy
export async function submitPharmacyRefillToFirestore(data: {
  patientName: string
  dob?: string
  mrn?: string
  phone?: string
  allergies?: string
  medicationName: string
  strength: string
  sig?: string
  quantity?: number
  daysSupply?: number
  prescriber?: string
  plan?: string
  urgent?: boolean
}): Promise<string> {
  const nextNum = Math.floor(10480 + Math.random() * 500)
  const id = `RM-${nextNum}`
  const now = Date.now()

  const isOzempic = data.medicationName.toLowerCase().includes('ozempic')
  const isMetformin = data.medicationName.toLowerCase().includes('metformin')
  const requiresPA = isOzempic || data.medicationName.toLowerCase().includes('wegovy')
  const refillsRemaining = isMetformin ? 0 : 3
  const quantity = data.quantity || 60
  const daysSupply = data.daysSupply || 30
  const patientId = `pat-${Math.floor(100 + Math.random() * 900)}`

  const refillDocData = {
    id,
    refillId: id,
    patientId,
    patientName: data.patientName || 'Jane Smith',
    dob: data.dob || '05/14/1975',
    mrn: data.mrn || `MRN-${Math.floor(100000 + Math.random() * 900000)}`,
    phone: data.phone || '(555) 234-8901',
    allergies: data.allergies || 'No known drug allergies (NKDA)',
    medication: data.medicationName,
    dosage: data.strength || 'Standard Dose',
    sig: data.sig || 'Take 1 tablet by mouth daily as directed',
    quantity,
    daysSupply,
    supplyDaysLeft: data.urgent ? 1 : 3,
    pharmacyId: 'harbor-pharmacy-214',
    pharmacyName: 'Harbor Pharmacy #214',
    providerId: 'dr-sarah-williams',
    providerName: data.prescriber || 'Dr. Sarah Williams',
    plan: data.plan || 'Meridian Health PBM',
    status: 'CHECKING' as RefillStatus,
    blocker: null,
    blockReason: null,
    waitingFor: 'Remedium AI Intake Check',
    priority: data.urgent ? ('urgent' as const) : ('standard' as const),
    urgent: !!data.urgent,
    aiSummary: 'New intake registered. Remedium automated clearing engine validating prescription.',
    aiRecommendation: 'Verifying refill balance on file and formulary eligibility.',
    assignedTo: 'remedium',
    insurance: 'not_started' as InsuranceState,
    refillsRemaining,
    requiresPA,
    tier: requiresPA ? (3 as const) : (1 as const),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    statusSince: serverTimestamp(),
  }

  // 1. Write Refill document
  await setDoc(doc(db, COLLECTIONS.REFILLS, id), refillDocData)

  // 2. Write initial workflow events
  await logWorkflowEvent(
    id,
    'Refill request submitted',
    `Intake processed at Harbor Pharmacy #214`,
    'done',
    'pharmacy',
  )

  await logWorkflowEvent(
    id,
    'Remedium verifying refills on file',
    'Checking state prescription database and formulary criteria',
    'info',
    'remedium',
  )

  // 3. Write notifications
  await createNotification(
    'pharmacy',
    id,
    'Refill submitted',
    `${data.patientName} · ${data.medicationName} ${data.strength}`,
    'done',
  )

  await createNotification(
    'provider',
    id,
    'New refill request',
    `${data.patientName} · ${data.medicationName} ${data.strength}`,
    'active',
  )

  // 4. Simulate smart Remedium blocker evaluation after 1.8s
  setTimeout(async () => {
    try {
      if (refillsRemaining === 0) {
        await updateDoc(doc(db, COLLECTIONS.REFILLS, id), {
          status: 'WAITING_FOR_PROVIDER',
          blocker: '0 refills remaining on prescription',
          blockReason: 'no_refills',
          waitingFor: data.prescriber || 'Dr. Sarah Williams',
          assignedTo: 'provider',
          aiSummary: '0 refills remaining on file. Automatic renewal request routed to provider.',
          aiRecommendation: 'Prescriber review and authorization required.',
          updatedAt: serverTimestamp(),
          statusSince: serverTimestamp(),
        })
        await logWorkflowEvent(
          id,
          'Blocker identified: 0 refills remaining',
          'Prescription renewal authorization required',
          'warning',
          'remedium',
        )
      } else if (requiresPA) {
        await updateDoc(doc(db, COLLECTIONS.REFILLS, id), {
          status: 'BLOCKED',
          blocker: 'Prior Authorization required by Meridian Health PBM',
          blockReason: 'pa_required',
          waitingFor: 'Meridian Health PBM',
          assignedTo: 'pharmacy',
          aiSummary: 'Payer requires prior authorization documentation.',
          aiRecommendation: 'Submit PA packet pre-filled by Remedium.',
          updatedAt: serverTimestamp(),
          statusSince: serverTimestamp(),
        })
        await logWorkflowEvent(
          id,
          'Blocker identified: Prior Authorization required',
          'Plan policy requires clinical paperwork',
          'warning',
          'remedium',
        )
      } else {
        await updateDoc(doc(db, COLLECTIONS.REFILLS, id), {
          status: 'APPROVED',
          blocker: null,
          blockReason: null,
          waitingFor: 'Harbor Pharmacy #214',
          assignedTo: 'pharmacy',
          aiSummary: 'Prescription refills validated on file. Ready for filling.',
          aiRecommendation: 'Proceed to dispensing queue.',
          updatedAt: serverTimestamp(),
          statusSince: serverTimestamp(),
        })
        await logWorkflowEvent(
          id,
          'Refills verified on file',
          'Active refills confirmed · routed to pharmacy filling queue',
          'done',
          'remedium',
        )
      }
    } catch (e) {
      console.error('Async workflow error:', e)
    }
  }, 1800)

  return id
}

// 2. Submit Prior Authorization packet
export async function submitPAToFirestore(refillId: string) {
  const refillRef = doc(db, COLLECTIONS.REFILLS, refillId)

  await updateDoc(refillRef, {
    status: 'WAITING_FOR_INSURANCE',
    blocker: null,
    blockReason: null,
    waitingFor: 'Meridian Health PBM',
    assignedTo: 'insurance',
    insurance: 'pa_submitted',
    aiSummary: 'Prior Authorization packet auto-assembled and submitted to payer.',
    aiRecommendation: 'Awaiting payer electronic adjudication (est. 24h).',
    updatedAt: serverTimestamp(),
    statusSince: serverTimestamp(),
  })

  await logWorkflowEvent(
    refillId,
    'Prior Authorization packet submitted',
    'Clinical documentation auto-compiled and transmitted to Meridian Health PBM',
    'active',
    'pharmacy',
  )

  await createNotification(
    'pharmacy',
    refillId,
    'Prior authorization submitted',
    `${refillId}: PA packet submitted to Meridian Health PBM`,
    'active',
  )
}

// 3. Nudge / Escalate Provider
export async function nudgeProviderInFirestore(
  refillId: string,
  providerName = 'Dr. Sarah Williams',
) {
  await logWorkflowEvent(
    refillId,
    'Provider priority reminder sent',
    `Priority escalation delivered to ${providerName}`,
    'warning',
    'pharmacy',
  )

  await createNotification(
    'provider',
    refillId,
    'Urgent Refill Reminder',
    `Priority escalation from Harbor Pharmacy regarding ${refillId}`,
    'warning',
  )
}

// 4. Accept Cash Price
export async function acceptCashPriceInFirestore(refillId: string) {
  const refillRef = doc(db, COLLECTIONS.REFILLS, refillId)

  await updateDoc(refillRef, {
    status: 'PHARMACY_PROCESSING',
    blocker: null,
    blockReason: null,
    waitingFor: 'Harbor Pharmacy #214',
    assignedTo: 'pharmacy',
    insurance: 'cash_price',
    aiSummary: 'Patient discount cash price ($18.40) applied. Cleared for dispensing.',
    aiRecommendation: 'Print label and fill prescription.',
    updatedAt: serverTimestamp(),
    statusSince: serverTimestamp(),
  })

  await logWorkflowEvent(
    refillId,
    'Discount cash price accepted',
    'Patient opted for $18.40 cash rate · bypassing payer formulary restriction',
    'done',
    'pharmacy',
  )
}

// 5. Mark Ready for Pickup
export async function markReadyInFirestore(refillId: string) {
  const refillRef = doc(db, COLLECTIONS.REFILLS, refillId)

  await updateDoc(refillRef, {
    status: 'READY_FOR_PICKUP',
    blocker: null,
    blockReason: null,
    waitingFor: 'Patient',
    assignedTo: 'patient',
    aiSummary: 'Prescription compounded, labeled, verified, and placed in pickup bin.',
    aiRecommendation: 'Dispense to patient upon counter arrival.',
    updatedAt: serverTimestamp(),
    statusSince: serverTimestamp(),
  })

  await logWorkflowEvent(
    refillId,
    'Prescription verified & ready for pickup',
    'Compounded & placed in pickup bin · SMS notification sent to patient',
    'done',
    'pharmacy',
  )

  await createNotification(
    'pharmacy',
    refillId,
    'Prescription Ready',
    `${refillId} is verified and ready in the pickup bin`,
    'done',
  )
}

// 6. Confirm Dispensed / Complete Fulfillment
export async function completePickupInFirestore(refillId: string) {
  const refillRef = doc(db, COLLECTIONS.REFILLS, refillId)

  await updateDoc(refillRef, {
    status: 'COMPLETED',
    blocker: null,
    blockReason: null,
    waitingFor: 'Resolved',
    assignedTo: 'pharmacy',
    aiSummary: 'Medication dispensed to patient. Cycle completed.',
    aiRecommendation: 'Adherence counter running. Next refill expected in 28 days.',
    updatedAt: serverTimestamp(),
    statusSince: serverTimestamp(),
  })

  await logWorkflowEvent(
    refillId,
    'Medication dispensed to patient',
    'Identity verified, consultation provided, copay processed',
    'done',
    'pharmacy',
  )

  await createNotification(
    'pharmacy',
    refillId,
    'Refill Completed',
    `${refillId} has been successfully dispensed to patient`,
    'done',
  )
}

// 7. Mark notification read
export async function markNotificationReadInFirestore(notificationId: string) {
  const notifRef = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId)
  await updateDoc(notifRef, { read: true })
}

// 8. Mark all notifications read
export async function markAllNotificationsReadInFirestore(role: Role) {
  const q = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('role', '==', role),
    where('read', '==', false),
  )
  const snap = await getDocs(q)
  for (const docSnap of snap.docs) {
    await updateDoc(docSnap.ref, { read: true })
  }
}

// 9. Provider approves renewal
export async function providerApproveInFirestore(caseId: string) {
  const refillRef = doc(db, COLLECTIONS.REFILLS, caseId)
  await updateDoc(refillRef, {
    status: 'APPROVED',
    blocker: null,
    blockReason: null,
    waitingFor: 'Harbor Pharmacy #214',
    assignedTo: 'pharmacy',
    refillsRemaining: 5,
    aiSummary: 'Provider renewal approved for 5 refills. Routing to pharmacy verification.',
    aiRecommendation: 'Queue for fulfillment and label printing.',
    updatedAt: serverTimestamp(),
    statusSince: serverTimestamp(),
  })

  await logWorkflowEvent(
    caseId,
    'Provider approved renewal',
    'Dr. Sarah Williams authorized 5 refills',
    'done',
    'provider',
  )

  await createNotification(
    'pharmacy',
    caseId,
    'Provider approval received',
    `${caseId}: Provider approved 5 renewals`,
    'done',
  )

  setTimeout(async () => {
    try {
      await updateDoc(refillRef, {
        status: 'PHARMACY_PROCESSING',
        updatedAt: serverTimestamp(),
        statusSince: serverTimestamp(),
      })
      await logWorkflowEvent(
        caseId,
        'Prescription sent to pharmacy',
        'e-Rx verified at Harbor Pharmacy #214',
        'done',
        'remedium',
      )
    } catch (e) {
      console.error(e)
    }
  }, 1200)
}

// 10. Provider denies refill
export async function providerDenyInFirestore(caseId: string, reason: string) {
  const refillRef = doc(db, COLLECTIONS.REFILLS, caseId)
  await updateDoc(refillRef, {
    status: 'DENIED',
    blocker: `Denied by provider: ${reason}`,
    waitingFor: 'Resolved',
    assignedTo: 'pharmacy',
    aiSummary: `Provider declined renewal authorization: ${reason}`,
    aiRecommendation: 'Notify patient and contact clinic coordinator for alternative therapy.',
    updatedAt: serverTimestamp(),
    statusSince: serverTimestamp(),
  })

  await logWorkflowEvent(
    caseId,
    'Provider denied refill',
    reason,
    'error',
    'provider',
  )

  await createNotification(
    'pharmacy',
    caseId,
    'Refill denied by provider',
    `${caseId}: ${reason}`,
    'error',
  )
}

// 11. Provider requests visit
export async function providerRequestVisitInFirestore(caseId: string) {
  const refillRef = doc(db, COLLECTIONS.REFILLS, caseId)
  await updateDoc(refillRef, {
    status: 'BLOCKED',
    blocker: 'Clinical follow-up required before refill',
    blockReason: 'visit_required',
    waitingFor: 'Patient',
    assignedTo: 'patient',
    aiSummary: 'Provider requested an in-office follow-up evaluation before authorizing additional refills.',
    aiRecommendation: 'Patient must schedule appointment.',
    updatedAt: serverTimestamp(),
    statusSince: serverTimestamp(),
  })

  await logWorkflowEvent(
    caseId,
    'Visit requested by provider',
    'Clinical follow-up required before refill',
    'warning',
    'provider',
  )

  await createNotification(
    'pharmacy',
    caseId,
    'Provider requested visit',
    `${caseId}: Patient office visit required prior to renewal`,
    'warning',
  )
}

// 12. Patient schedules visit
export async function patientScheduleVisitInFirestore(caseId: string) {
  const refillRef = doc(db, COLLECTIONS.REFILLS, caseId)
  await updateDoc(refillRef, {
    status: 'WAITING_FOR_PROVIDER',
    blocker: 'Visit scheduled · Awaiting provider review',
    blockReason: 'visit_scheduled',
    waitingFor: 'Dr. Sarah Williams',
    assignedTo: 'provider',
    aiSummary: 'Patient scheduled follow-up appointment. Case returned to provider queue.',
    aiRecommendation: 'Provider review and approval.',
    updatedAt: serverTimestamp(),
    statusSince: serverTimestamp(),
  })

  await logWorkflowEvent(
    caseId,
    'Visit scheduled',
    'Follow-up appointment booked for Thursday 9:30 AM',
    'done',
    'patient',
  )
}

// 13. Insurance approves coverage
export async function insuranceApproveInFirestore(caseId: string) {
  const refillRef = doc(db, COLLECTIONS.REFILLS, caseId)
  await updateDoc(refillRef, {
    status: 'APPROVED',
    blocker: null,
    blockReason: null,
    insurance: 'approved',
    waitingFor: 'Harbor Pharmacy #214',
    assignedTo: 'pharmacy',
    aiSummary: 'Insurance coverage confirmed. Tier copay adjudicated.',
    aiRecommendation: 'Proceed to dispensing and compounding queue.',
    updatedAt: serverTimestamp(),
    statusSince: serverTimestamp(),
  })

  await logWorkflowEvent(
    caseId,
    'Coverage confirmed by insurance',
    'Claim adjudicated successfully',
    'done',
    'insurance',
  )

  setTimeout(async () => {
    try {
      await updateDoc(refillRef, {
        status: 'PHARMACY_PROCESSING',
        updatedAt: serverTimestamp(),
        statusSince: serverTimestamp(),
      })
      await logWorkflowEvent(
        caseId,
        'Pharmacy filling',
        'Medication sent to dispensing workstation',
        'active',
        'pharmacy',
      )
    } catch (e) {
      console.error(e)
    }
  }, 1000)
}

// 14. Insurance requires PA
export async function insuranceRequirePAInFirestore(caseId: string) {
  const refillRef = doc(db, COLLECTIONS.REFILLS, caseId)
  await updateDoc(refillRef, {
    status: 'BLOCKED',
    blocker: 'Prior Authorization required by payer',
    blockReason: 'pa_required',
    insurance: 'pa_required',
    waitingFor: 'Meridian Health PBM',
    assignedTo: 'pharmacy',
    aiSummary: 'Payer requires prior authorization documentation.',
    aiRecommendation: 'Submit PA packet pre-filled by Remedium.',
    updatedAt: serverTimestamp(),
    statusSince: serverTimestamp(),
  })

  await logWorkflowEvent(
    caseId,
    'Prior authorization required',
    'Payer policy requires clinical paperwork',
    'warning',
    'insurance',
  )
}

// 15. Insurance not covered
export async function insuranceNotCoveredInFirestore(caseId: string) {
  const refillRef = doc(db, COLLECTIONS.REFILLS, caseId)
  await updateDoc(refillRef, {
    status: 'BLOCKED',
    blocker: 'Medication excluded from formulary',
    blockReason: 'not_covered',
    insurance: 'not_covered',
    waitingFor: 'Pharmacy',
    assignedTo: 'pharmacy',
    aiSummary: 'Medication is not covered under current formulary.',
    aiRecommendation: 'Offer discount cash price ($18.40) or request formulary therapeutic switch.',
    updatedAt: serverTimestamp(),
    statusSince: serverTimestamp(),
  })

  await logWorkflowEvent(
    caseId,
    'Not covered by plan',
    'Excluded from payer formulary list',
    'error',
    'insurance',
  )
}

