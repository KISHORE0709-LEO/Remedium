'use client'

import { useEffect, useState } from 'react'
import { DEMO_PATIENT, DEMO_PROVIDER } from '@/lib/remedium/seed'
import type { RefillCase, RemediumState, Role } from '@/lib/remedium/types'

export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

export function casesForRole(state: RemediumState, role: Role): RefillCase[] {
  switch (role) {
    case 'patient':
      return state.cases.filter((c) => c.patient.name === DEMO_PATIENT.name)
    case 'provider':
      return state.cases.filter(
        (c) =>
          c.prescriber === DEMO_PROVIDER &&
          (c.status === 'WAITING_FOR_PROVIDER' ||
            c.blockReason === 'visit_required' ||
            c.status === 'DENIED' ||
            c.events.some((e) => e.actor === 'provider' || e.label.startsWith('Provider'))),
      )
    case 'insurance':
      return state.cases.filter((c) => c.insurance !== 'not_started')
    case 'pharmacy':
      return state.cases
  }
}

export function needsRoleAction(c: RefillCase, role: Role) {
  switch (role) {
    case 'provider':
      return c.status === 'WAITING_FOR_PROVIDER'
    case 'insurance':
      return c.status === 'WAITING_FOR_INSURANCE'
    case 'patient':
      return c.blockReason === 'visit_required' || c.status === 'READY_FOR_PICKUP'
    case 'pharmacy':
      return c.status === 'BLOCKED' && c.blockReason !== 'visit_required' ? true : c.status === 'PHARMACY_PROCESSING'
  }
}
