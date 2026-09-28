'use client'

import { useSyncExternalStore } from 'react'
import {
  DEMO_PATIENT,
  DEMO_PHARMACY,
  DEMO_PLAN,
  DEMO_PROVIDER,
  patientMedications,
} from './seed'
import type { AppNotification, RefillCase, RemediumState, Role } from './types'
import {
  subscribeToRefills,
  subscribeToAllNotifications,
  submitPharmacyRefillToFirestore,
  submitPAToFirestore,
  acceptCashPriceInFirestore,
  nudgeProviderInFirestore,
  markReadyInFirestore,
  completePickupInFirestore,
  markAllNotificationsReadInFirestore,
  markNotificationReadInFirestore,
  seedFirestoreIfEmpty,
  providerApproveInFirestore,
  providerRejectInFirestore,
  providerRequestInfoInFirestore,
  providerEscalateInFirestore,
  patientScheduleVisitInFirestore,
  insuranceApproveInFirestore,
  insuranceRequirePAInFirestore,
  insuranceNotCoveredInFirestore,
  insuranceDenyInFirestore,
  pharmacyConfirmFulfillmentInFirestore,
  escalateInFirestore,
} from './firestore-service'

const CHANNEL = 'remedium-workflow-v1'
const tabId = typeof window === 'undefined' ? 'server' : Math.random().toString(36).slice(2, 10)

let state: RemediumState | null = null
const listeners = new Set<() => void>()
let channel: BroadcastChannel | null = null
let firestoreInitialized = false

function initFirestoreSync() {
  if (typeof window === 'undefined' || firestoreInitialized) return
  firestoreInitialized = true

  try {
    subscribeToRefills((firestoreRefills) => {
      const current = ensure()
      state = {
        ...current,
        cases: firestoreRefills,
        version: current.version + 1,
        origin: 'firestore',
      }
      emit()
      channel?.postMessage({ type: 'state', state })
    })

    subscribeToAllNotifications((notifs) => {
      const current = ensure()
      state = {
        ...current,
        notifications: notifs,
        version: current.version + 1,
        origin: 'firestore',
      }
      emit()
      channel?.postMessage({ type: 'state', state })
    })
  } catch (err) {
    console.error('Failed to initialize Firestore sync in store:', err)
  }
}

function ensure(): RemediumState {
  if (state) return state
  state = {
    version: 1,
    origin: tabId,
    nextCaseNumber: 10500,
    cases: [],
    notifications: [],
  }
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (event: MessageEvent) => {
      const msg = event.data as { type: 'state'; state: RemediumState } | { type: 'hello' }
      if (msg.type === 'hello') {
        channel?.postMessage({ type: 'state', state })
        return
      }
      if (msg.type === 'state' && state) {
        const incoming = msg.state
        const newer =
          incoming.version > state.version ||
          (incoming.version === state.version && incoming.origin > state.origin)
        if (newer) {
          state = incoming
          emit()
        }
      }
    }
    channel.postMessage({ type: 'hello' })
  }
  return state
}

function emit() {
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  ensure()
  initFirestoreSync()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return ensure()
}

function getServerSnapshot() {
  return null
}

export function useRemedium(): RemediumState | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

function statusIs(caseId: string, statuses: RefillCase['status'][]) {
  const c = ensure().cases.find((x) => x.id === caseId)
  return !!c && statuses.includes(c.status)
}

export const actions = {
  async requestRefill(medKey: string) {
    const s = ensure()
    const existing = s.cases.find(
      (c) =>
        c.patient.name === DEMO_PATIENT.name &&
        c.medication.key === medKey &&
        c.status !== 'COMPLETED' &&
        c.status !== 'DENIED' &&
        c.status !== 'RESOLVED' &&
        c.status !== 'REJECTED' &&
        c.status !== 'CANCELLED',
    )
    if (existing) return existing.id
    const med = patientMedications(Date.now()).find((m) => m.key === medKey)
    if (!med) return null
    return submitPharmacyRefillToFirestore({
      patientName: DEMO_PATIENT.name,
      dob: DEMO_PATIENT.dob,
      mrn: DEMO_PATIENT.mrn,
      phone: DEMO_PATIENT.phone,
      allergies: DEMO_PATIENT.allergies,
      medicationName: med.name,
      dosage: med.strength,
      sig: med.sig,
      quantity: med.quantity,
      daysSupply: med.daysSupply,
      prescriptionId: `RX-${med.key.toUpperCase()}`,
      provider: DEMO_PROVIDER,
      plan: DEMO_PLAN,
      reason: med.refillsRemaining === 0 ? 'No refills remaining' : 'Maintenance refill',
      pharmacyId: 'harbor-pharmacy-214',
    })
  },

  providerApprove(caseId: string): Promise<void> {
    return providerApproveInFirestore(caseId)
  },

  providerReject(caseId: string, reason: string): Promise<void> {
    return providerRejectInFirestore(caseId, reason)
  },

  providerRequestInfo(caseId: string): Promise<void> {
    return providerRequestInfoInFirestore(caseId)
  },

  providerEscalate(caseId: string): Promise<void> {
    return providerEscalateInFirestore(caseId)
  },

  patientScheduleVisit(caseId: string): Promise<void> | undefined {
    if (!statusIs(caseId, ['BLOCKED', 'NEEDS_INFORMATION'])) return
    return patientScheduleVisitInFirestore(caseId)
  },

  insuranceApprove(caseId: string): Promise<void> | undefined {
    if (!statusIs(caseId, ['WAITING_FOR_INSURANCE'])) return
    return insuranceApproveInFirestore(caseId)
  },

  insuranceRequirePA(caseId: string): Promise<void> | undefined {
    if (!statusIs(caseId, ['WAITING_FOR_INSURANCE'])) return
    return insuranceRequirePAInFirestore(caseId)
  },

  insuranceNotCovered(caseId: string): Promise<void> | undefined {
    if (!statusIs(caseId, ['WAITING_FOR_INSURANCE'])) return
    return insuranceNotCoveredInFirestore(caseId)
  },

  insuranceDeny(caseId: string, reason: string): Promise<void> | undefined {
    if (!statusIs(caseId, ['WAITING_FOR_INSURANCE'])) return
    return insuranceDenyInFirestore(caseId, reason)
  },

  pharmacySubmitPA(caseId: string): Promise<void> | undefined {
    if (!statusIs(caseId, ['BLOCKED', 'NEEDS_INFORMATION', 'WAITING_FOR_INSURANCE'])) return
    return submitPAToFirestore(caseId)
  },

  pharmacyAcceptCashPrice(caseId: string): Promise<void> | undefined {
    if (!statusIs(caseId, ['BLOCKED', 'NEEDS_INFORMATION'])) return
    return acceptCashPriceInFirestore(caseId)
  },

  pharmacyNudgeProvider(caseId: string): Promise<void> {
    return nudgeProviderInFirestore(caseId)
  },

  pharmacyMarkReady(caseId: string): Promise<void> | undefined {
    if (!statusIs(caseId, ['WAITING_FOR_PHARMACY', 'PHARMACY_PROCESSING'])) return
    return markReadyInFirestore(caseId)
  },

  completePickup(caseId: string): Promise<void> | undefined {
    if (!statusIs(caseId, ['FULFILLED', 'READY_FOR_PICKUP'])) return
    return completePickupInFirestore(caseId)
  },

  pharmacyConfirmFulfillment(caseId: string): Promise<void> {
    return pharmacyConfirmFulfillmentInFirestore(caseId)
  },

  escalate(caseId: string, role: Role): Promise<void> {
    return escalateInFirestore(caseId, role)
  },

  async submitPharmacyRefill(data: {
    patientName: string
    dob?: string
    mrn?: string
    phone?: string
    allergies?: string
    medicationName: string
    dosage?: string
    strength?: string
    sig?: string
    quantity?: number
    daysSupply?: number
    prescriptionId?: string
    prescriber?: string
    provider?: string
    plan?: string
    reason?: string
    urgent?: boolean
    pharmacyId?: string
  }): Promise<string> {
    return submitPharmacyRefillToFirestore({
      ...data,
      dosage: data.dosage || data.strength || 'Standard Dose',
    })
  },

  markAllRead(role: Role): Promise<void> {
    return markAllNotificationsReadInFirestore(role)
  },

  markNotificationRead(notificationId: string): Promise<void> {
    return markNotificationReadInFirestore(notificationId)
  },

  resetDemo() {
    seedFirestoreIfEmpty(true).catch((err) => {
      console.error('Firestore resetDemo error:', err)
    })
  },
}

export { DEMO_PATIENT, DEMO_PROVIDER, DEMO_PHARMACY, DEMO_PLAN }
