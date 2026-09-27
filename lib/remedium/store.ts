'use client'

import { useSyncExternalStore } from 'react'
import {
  createSeedState,
  DEMO_PATIENT,
  DEMO_PHARMACY,
  DEMO_PLAN,
  DEMO_PROVIDER,
  makeEvent,
  patientMedications,
} from './seed'
import type {
  Actor,
  AppNotification,
  EventTone,
  RefillCase,
  RemediumState,
  Role,
} from './types'

const CHANNEL = 'remedium-workflow-v1'
const tabId = typeof window === 'undefined' ? 'server' : Math.random().toString(36).slice(2, 10)

let state: RemediumState | null = null
const listeners = new Set<() => void>()
let channel: BroadcastChannel | null = null

function ensure(): RemediumState {
  if (state) return state
  state = createSeedState(tabId)
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

function commit(next: Omit<RemediumState, 'version' | 'origin'>) {
  const current = ensure()
  state = { ...next, version: current.version + 1, origin: tabId }
  emit()
  channel?.postMessage({ type: 'state', state })
}

function subscribe(listener: () => void) {
  ensure()
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

/* ---------------- internal helpers ---------------- */

let notifCounter = 0

function note(
  role: Role,
  caseId: string,
  title: string,
  body: string,
  tone: EventTone,
): AppNotification {
  notifCounter += 1
  return {
    id: `n-${Date.now().toString(36)}-${notifCounter}-${tabId}`,
    role,
    caseId,
    title,
    body,
    tone,
    at: Date.now(),
    read: false,
  }
}

type Mutator = (c: RefillCase, now: number) => {
  patch: Partial<RefillCase>
  events?: [string, EventTone, Actor, string?][]
  notify?: [Role, string, string, EventTone][]
}

function mutate(caseId: string, fn: Mutator) {
  const s = ensure()
  const target = s.cases.find((c) => c.id === caseId)
  if (!target) return
  const now = Date.now()
  const { patch, events = [], notify = [] } = fn(target, now)
  const statusChanged = patch.status && patch.status !== target.status
  const updated: RefillCase = {
    ...target,
    ...patch,
    statusSince: statusChanged ? now : target.statusSince,
    events: [
      ...target.events,
      ...events.map(([label, tone, actor, detail], i) => makeEvent(label, now + i, tone, actor, detail)),
    ],
  }
  commit({
    nextCaseNumber: s.nextCaseNumber,
    cases: s.cases.map((c) => (c.id === caseId ? updated : c)),
    notifications: [
      ...notify.map(([role, title, body, tone]) => note(role, caseId, title, body, tone)),
      ...s.notifications,
    ],
  })
}

function later(ms: number, fn: () => void) {
  if (typeof window !== 'undefined') window.setTimeout(fn, ms)
}

function medName(c: RefillCase) {
  return `${c.medication.name} ${c.medication.strength}`
}

function statusIs(caseId: string, statuses: RefillCase['status'][]) {
  const c = ensure().cases.find((x) => x.id === caseId)
  return !!c && statuses.includes(c.status)
}

/* ---------------- workflow actions ---------------- */

function routeToInsurance(caseId: string) {
  mutate(caseId, (c) => ({
    patch: { status: 'WAITING_FOR_INSURANCE', insurance: 'pending', blockReason: null },
    events: [['Insurance verification', 'active', 'remedium', `Claim submitted to ${c.plan}`]],
    notify: [['insurance', 'New coverage check', `${c.patient.name} · ${medName(c)} · tier ${c.medication.tier}`, 'active']],
  }))
}

export const actions = {
  requestRefill(medKey: string) {
    const s = ensure()
    const existing = s.cases.find(
      (c) => c.patient.name === DEMO_PATIENT.name && c.medication.key === medKey && c.status !== 'COMPLETED' && c.status !== 'DENIED',
    )
    if (existing) return existing.id
    const now = Date.now()
    const med = patientMedications(now).find((m) => m.key === medKey)
    if (!med) return null
    const id = `RM-${s.nextCaseNumber}`
    const newCase: RefillCase = {
      id,
      patient: { ...DEMO_PATIENT },
      medication: med,
      prescriber: DEMO_PROVIDER,
      pharmacy: DEMO_PHARMACY,
      plan: DEMO_PLAN,
      status: 'REQUESTED',
      blockReason: null,
      insurance: 'not_started',
      supplyDaysLeft: medKey === 'metformin' ? 2 : medKey === 'ozempic' ? 3 : 4,
      urgent: false,
      createdAt: now,
      statusSince: now,
      refillHistory: [
        { date: med.lastFilled - med.daysSupply * 86_400_000, quantity: med.quantity },
        { date: med.lastFilled, quantity: med.quantity },
      ],
      events: [makeEvent('Refill requested', now, 'done', 'patient', 'Requested from patient app')],
    }
    commit({
      nextCaseNumber: s.nextCaseNumber + 1,
      cases: [newCase, ...s.cases],
      notifications: [
        note('pharmacy', id, 'New refill request', `${DEMO_PATIENT.name} · ${med.name} ${med.strength}`, 'active'),
        ...s.notifications,
      ],
    })

    later(700, () => {
      mutate(id, () => ({
        patch: { status: 'CHECKING' },
        events: [['Remedium analyzing case', 'info', 'remedium', 'Checking refills, prescriber and coverage']],
      }))
    })

    later(2000, () => {
      if (!statusIs(id, ['CHECKING'])) return
      mutate(id, (c) => {
        if (c.medication.refillsRemaining === 0) {
          return {
            patch: { status: 'WAITING_FOR_PROVIDER', blockReason: 'no_refills' },
            events: [
              ['Pharmacy reviewed', 'done', 'pharmacy'],
              ['No refills remaining', 'warning', 'remedium', 'Blocker detected by Remedium AI'],
              ['Provider review requested', 'active', 'remedium', `Routed to ${c.prescriber}`],
            ],
            notify: [
              ['provider', 'Refill needs your review', `${c.patient.name} · ${medName(c)} · no refills remaining`, 'warning'],
              ['pharmacy', 'Blocker detected', `${c.id}: no refills remaining — routed to ${c.prescriber}`, 'warning'],
              ['patient', 'Refill is being reviewed', `We sent your ${c.medication.name} request to ${c.prescriber} for approval.`, 'active'],
            ],
          }
        }
        return {
          patch: {},
          events: [['Pharmacy reviewed', 'done', 'pharmacy', 'Refills on file · no provider action needed']],
          notify: [['patient', 'Refill is being reviewed', `Your ${c.medication.name} refill passed pharmacy review.`, 'active']],
        }
      })
      const c = ensure().cases.find((x) => x.id === id)
      if (c && c.status === 'CHECKING') later(900, () => routeToInsurance(id))
    })
    return id
  },

  providerApprove(caseId: string) {
    if (!statusIs(caseId, ['WAITING_FOR_PROVIDER', 'BLOCKED'])) return
    mutate(caseId, (c) => ({
      patch: { status: 'APPROVED', blockReason: null, medication: { ...c.medication, refillsRemaining: 5 } },
      events: [['Provider approved', 'done', 'provider', `${c.prescriber} · 5 refills authorized`]],
      notify: [
        ['patient', 'Approved', 'Your prescription has been approved and sent to the pharmacy.', 'done'],
        ['pharmacy', 'Provider approval received', `${c.patient.name} · ${medName(c)}`, 'done'],
      ],
    }))
    later(1100, () => {
      mutate(caseId, (c) => ({
        patch: { status: 'PRESCRIPTION_SENT' },
        events: [['Prescription sent to pharmacy', 'done', 'remedium', `e-Rx verified at ${c.pharmacy}`]],
      }))
    })
    later(2400, () => {
      if (statusIs(caseId, ['PRESCRIPTION_SENT'])) routeToInsurance(caseId)
    })
  },

  providerRequestVisit(caseId: string) {
    if (!statusIs(caseId, ['WAITING_FOR_PROVIDER'])) return
    mutate(caseId, (c) => ({
      patch: { status: 'BLOCKED', blockReason: 'visit_required' },
      events: [['Visit requested by provider', 'warning', 'provider', 'Clinical follow-up required before refill']],
      notify: [
        ['patient', 'Visit needed', `${c.prescriber} would like to see you before refilling ${c.medication.name}.`, 'warning'],
        ['pharmacy', 'Provider requested a visit', `${c.id} · waiting on patient to schedule`, 'warning'],
      ],
    }))
  },

  patientScheduleVisit(caseId: string) {
    if (!statusIs(caseId, ['BLOCKED'])) return
    const visitAt = Date.now() + 2 * 86_400_000
    mutate(caseId, (c) => ({
      patch: { status: 'WAITING_FOR_PROVIDER', blockReason: 'visit_scheduled', visitAt },
      events: [
        ['Visit scheduled', 'done', 'patient', new Date(visitAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · 9:30 AM'],
        ['Provider review requested', 'active', 'remedium', `Returned to ${c.prescriber}`],
      ],
      notify: [['provider', 'Visit scheduled', `${c.patient.name} booked a follow-up · refill back in your queue`, 'active']],
    }))
  },

  providerDeny(caseId: string, reason: string) {
    if (!statusIs(caseId, ['WAITING_FOR_PROVIDER', 'BLOCKED'])) return
    mutate(caseId, (c) => ({
      patch: { status: 'DENIED', denialReason: reason },
      events: [['Provider denied refill', 'error', 'provider', reason]],
      notify: [
        ['patient', 'Refill not approved', `Please contact ${c.prescriber}'s office about ${c.medication.name}.`, 'error'],
        ['pharmacy', 'Refill denied', `${c.id} · ${reason}`, 'error'],
      ],
    }))
  },

  insuranceApprove(caseId: string) {
    if (!statusIs(caseId, ['WAITING_FOR_INSURANCE'])) return
    mutate(caseId, (c) => ({
      patch: { status: 'APPROVED', insurance: 'approved', blockReason: null },
      events: [['Coverage confirmed', 'done', 'insurance', `Tier ${c.medication.tier} · $${c.medication.tier === 1 ? '5.00' : c.medication.tier === 2 ? '25.00' : '45.00'} copay`]],
      notify: [
        ['pharmacy', 'Coverage confirmed', `${c.patient.name} · ${medName(c)} — ready to fill`, 'done'],
        ['patient', 'Coverage confirmed', `Your insurance approved ${c.medication.name}.`, 'done'],
      ],
    }))
    later(1200, () => {
      mutate(caseId, () => ({
        patch: { status: 'PHARMACY_PROCESSING' },
        events: [['Pharmacy filling', 'active', 'pharmacy']],
      }))
    })
  },

  insuranceRequirePA(caseId: string) {
    if (!statusIs(caseId, ['WAITING_FOR_INSURANCE'])) return
    mutate(caseId, (c) => ({
      patch: { status: 'BLOCKED', blockReason: 'pa_required', insurance: 'pa_required' },
      events: [['Prior authorization required', 'warning', 'insurance', `${c.plan} policy`]],
      notify: [
        ['pharmacy', 'Prior authorization required', `${c.id} · Remedium pre-filled the PA packet`, 'warning'],
        ['patient', 'Insurance needs more info', 'Your plan needs extra paperwork. We are handling it.', 'warning'],
      ],
    }))
  },

  insuranceNotCovered(caseId: string) {
    if (!statusIs(caseId, ['WAITING_FOR_INSURANCE'])) return
    mutate(caseId, (c) => ({
      patch: { status: 'BLOCKED', blockReason: 'not_covered', insurance: 'not_covered' },
      events: [['Not covered by plan', 'error', 'insurance', 'Excluded from formulary']],
      notify: [['pharmacy', 'Coverage denied', `${c.id} · offer cash price or alternative`, 'error']],
    }))
  },

  pharmacySubmitPA(caseId: string) {
    if (!statusIs(caseId, ['BLOCKED'])) return
    mutate(caseId, (c) => ({
      patch: { status: 'WAITING_FOR_INSURANCE', insurance: 'pa_submitted', blockReason: null },
      events: [['Authorization request submitted', 'active', 'pharmacy', 'PA packet auto-assembled by Remedium AI']],
      notify: [['insurance', 'Prior authorization submitted', `${c.patient.name} · ${medName(c)}`, 'active']],
    }))
  },

  pharmacyAcceptCashPrice(caseId: string) {
    if (!statusIs(caseId, ['BLOCKED'])) return
    mutate(caseId, () => ({
      patch: { status: 'PHARMACY_PROCESSING', insurance: 'cash_price', blockReason: null },
      events: [
        ['Patient accepted discount price', 'done', 'pharmacy', 'Cash price $18.40'],
        ['Pharmacy filling', 'active', 'pharmacy'],
      ],
      notify: [['patient', 'Being prepared', 'Your pharmacy is filling your prescription.', 'active']],
    }))
  },

  pharmacyNudgeProvider(caseId: string) {
    mutate(caseId, (c) => ({
      patch: {},
      events: [['Provider reminder sent', 'info', 'pharmacy', `Escalated to ${c.prescriber}`]],
      notify: [['provider', 'Reminder: refill waiting', `${c.patient.name} · ${medName(c)} · ${c.supplyDaysLeft} days of supply left`, 'warning']],
    }))
  },

  pharmacyMarkReady(caseId: string) {
    if (!statusIs(caseId, ['PHARMACY_PROCESSING'])) return
    mutate(caseId, (c) => ({
      patch: { status: 'READY_FOR_PICKUP' },
      events: [['Ready for pickup', 'done', 'pharmacy', 'Patient notified by SMS']],
      notify: [['patient', 'Ready for pickup', `Your ${c.medication.name} is ready at ${c.pharmacy}.`, 'done']],
    }))
  },

  completePickup(caseId: string) {
    if (!statusIs(caseId, ['READY_FOR_PICKUP'])) return
    mutate(caseId, (c) => ({
      patch: { status: 'COMPLETED', supplyDaysLeft: c.medication.daysSupply },
      events: [['Picked up · Completed', 'done', 'patient']],
      notify: [['pharmacy', 'Refill completed', `${c.id} · ${c.patient.name}`, 'done']],
    }))
  },

  markAllRead(role: Role) {
    const s = ensure()
    commit({
      nextCaseNumber: s.nextCaseNumber,
      cases: s.cases,
      notifications: s.notifications.map((n) => (n.role === role ? { ...n, read: true } : n)),
    })
  },

  resetDemo() {
    const current = ensure()
    const seed = createSeedState(tabId)
    state = { ...seed, version: current.version + 1, origin: tabId }
    emit()
    channel?.postMessage({ type: 'state', state })
  },
}

export { DEMO_PATIENT, DEMO_PROVIDER, DEMO_PHARMACY, DEMO_PLAN }
