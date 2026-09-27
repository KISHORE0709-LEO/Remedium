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

// ─── Internal filter (pure, no hooks) ────────────────────────────────────────
// Used by useCasesForRole and the role-views ActivityFeed which reads
// authIdentity separately.
export function filterCasesForRole(
  cases: RefillCase[],
  role: Role,
  providerId: string | null,
  pharmacyId: string | null,
  loading: boolean,
): RefillCase[] {
  switch (role) {
    case 'patient':
      return cases.filter((c) => c.patient.name === DEMO_PATIENT.name)

    case 'provider': {
      // While loading, fall back to the seeded demo provider ID so the
      // dashboard is populated immediately, before the Firestore auth doc arrives.
      const effectiveId = !loading && providerId ? providerId : 'dr-sarah-williams'
      return cases.filter(
        (c) =>
          c.providerId === effectiveId ||
          c.prescriber === effectiveId ||
          // Display-name match for seeded data whose prescriber field holds the name string
          (effectiveId === 'dr-sarah-williams' && c.prescriber === 'Dr. Sarah Williams'),
      )
    }

    case 'pharmacy': {
      if (!loading && pharmacyId) {
        return cases.filter((c) => !c.pharmacyId || c.pharmacyId === pharmacyId)
      }
      return cases
    }

    case 'insurance':
      return cases.filter(
        (c) => c.insurance !== 'not_started' || c.status === 'WAITING_FOR_INSURANCE',
      )
  }
}

/**
 * useCasesForRole — a proper React hook.
 *
 * Always called at the top level of a component, NEVER inside a conditional
 * or after an early return. This avoids the Rules-of-Hooks violation that the
 * old casesForRole plain function had when called after `if (!state) return …`.
 *
 * Usage:
 *   const providerCases = useCasesForRole(state?.cases ?? [], 'provider')
 */
export function useCasesForRole(cases: RefillCase[], role: Role): RefillCase[] {
  const { providerId, pharmacyId, loading } = useContext(AuthIdentityContext)
  return filterCasesForRole(cases, role, providerId, pharmacyId, loading)
}

/**
 * casesForRole — kept for the ActivityFeed and any place that already has
 * the auth identity available outside this hook.  Do NOT call this after an
 * early return inside a component.
 *
 * @deprecated Prefer useCasesForRole in new code.
 */
export function casesForRole(state: RemediumState, role: Role): RefillCase[] {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { providerId, pharmacyId, loading } = useContext(AuthIdentityContext)
  return filterCasesForRole(state.cases, role, providerId, pharmacyId, loading)
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
