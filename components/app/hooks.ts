'use client'

import { useContext, useEffect, useState } from 'react'
import { AuthIdentityContext } from '@/components/app/app-shell'
import { DEMO_PATIENT } from '@/lib/remedium/seed'
import type { RefillCase, RemediumState, Role } from '@/lib/remedium/types'

export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/**
 * Returns the subset of cases relevant to the current authenticated role.
 *
 * Provider filtering uses the real providerId from the Firestore /users/{uid}
 * doc (via AuthIdentityContext) so every provider only sees their own cases.
 * Falls back to 'dr-sarah-williams' while the auth profile is still loading,
 * which covers the seeded demo data immediately on first render.
 *
 * Pharmacy filtering uses the pharmacyId from auth context similarly.
 */
export function casesForRole(state: RemediumState, role: Role): RefillCase[] {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { providerId, pharmacyId, loading } = useContext(AuthIdentityContext)

  switch (role) {
    case 'patient':
      return state.cases.filter((c) => c.patient.name === DEMO_PATIENT.name)

    case 'provider': {
      // While loading, show cases matching the seeded demo provider so the
      // dashboard isn't empty during the auth-profile fetch.
      const effectiveId = (!loading && providerId) ? providerId : 'dr-sarah-williams'
      return state.cases.filter(
        (c) =>
          c.providerId === effectiveId ||
          c.prescriber === effectiveId ||
          // Also match by display name in case prescriber field holds the name string
          (effectiveId === 'dr-sarah-williams' && c.prescriber === 'Dr. Sarah Williams'),
      )
    }

    case 'pharmacy': {
      // If a pharmacyId is set on the auth profile, filter to that pharmacy's cases.
      // Fall back to showing all cases (demo mode: single pharmacy).
      if (!loading && pharmacyId) {
        return state.cases.filter(
          (c) => !c.pharmacyId || c.pharmacyId === pharmacyId,
        )
      }
      return state.cases
    }

    case 'insurance':
      return state.cases.filter(
        (c) => c.insurance !== 'not_started' || c.status === 'WAITING_FOR_INSURANCE',
      )
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
      // Pharmacy needs to act when a refill is blocked/needs info, ready to fill,
      // approved and awaiting fulfillment, or already fulfilled (move to RESOLVED)
      return (
        (c.status === 'BLOCKED' && c.blockReason !== 'visit_required') ||
        c.status === 'NEEDS_INFORMATION' ||
        c.status === 'PHARMACY_PROCESSING' ||
        c.status === 'WAITING_FOR_PHARMACY' ||
        c.status === 'APPROVED' ||
        c.status === 'FULFILLED'
      )
  }
}
