'use client'

import { BellRing, CalendarPlus, Check, CircleDollarSign, FileCheck2, PackageCheck, ShieldAlert, ShieldCheck, ShieldX, Stethoscope, X } from 'lucide-react'
import { useState } from 'react'
import { Pill } from '@/components/remedium/primitives'
import { actions } from '@/lib/remedium/store'
import type { RefillCase, Role } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'

const DENY_REASONS = ['Therapy discontinued', 'Needs alternative medication', 'Patient transferred care']

export function CaseActions({
  refill,
  role,
  size = 'md',
  className,
}: {
  refill: RefillCase
  role: Role
  size?: 'sm' | 'md'
  className?: string
}) {
  const [denying, setDenying] = useState(false)
  const c = refill
  const wrap = cn('flex flex-wrap items-center gap-2', className)

  if (role === 'provider') {
    const canDecide = c.status === 'WAITING_FOR_PROVIDER'
    if (!canDecide) return null
    if (denying) {
      return (
        <div className={cn('w-full rounded-2xl border border-risk/20 bg-risk/[0.04] p-3', className)}>
          <p className="text-xs font-medium">Reason for denial</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DENY_REASONS.map((r) => (
              <Pill key={r} size="sm" variant="danger" onClick={() => actions.providerDeny(c.id, r)}>
                {r}
              </Pill>
            ))}
            <Pill size="sm" variant="ghost" onClick={() => setDenying(false)}>
              Cancel
            </Pill>
          </div>
        </div>
      )
    }
    return (
      <div className={wrap}>
        <Pill variant="success" size={size} onClick={() => actions.providerApprove(c.id)}>
          <Check /> Approve Refill
        </Pill>
        {c.blockReason !== 'visit_scheduled' && (
          <Pill variant="warn" size={size} onClick={() => actions.providerRequestVisit(c.id)}>
            <Stethoscope /> Request Visit
          </Pill>
        )}
        <Pill variant="danger" size={size} onClick={() => setDenying(true)}>
          <X /> Deny
        </Pill>
      </div>
    )
  }

  if (role === 'insurance') {
    if (c.status !== 'WAITING_FOR_INSURANCE') return null
    const paSubmitted = c.insurance === 'pa_submitted'
    return (
      <div className={wrap}>
        <Pill variant="success" size={size} onClick={() => actions.insuranceApprove(c.id)}>
          <ShieldCheck /> {paSubmitted ? 'Approve Authorization' : 'Approve Coverage'}
        </Pill>
        {!paSubmitted && (
          <Pill variant="warn" size={size} onClick={() => actions.insuranceRequirePA(c.id)}>
            <ShieldAlert /> Require Prior Auth
          </Pill>
        )}
        <Pill variant="danger" size={size} onClick={() => actions.insuranceNotCovered(c.id)}>
          <ShieldX /> Not Covered
        </Pill>
      </div>
    )
  }

  if (role === 'pharmacy') {
    if (c.status === 'WAITING_FOR_PROVIDER')
      return (
        <div className={wrap}>
          <Pill size={size} onClick={() => actions.pharmacyNudgeProvider(c.id)}>
            <BellRing /> Send Provider Reminder
          </Pill>
        </div>
      )
    if (c.status === 'BLOCKED' && c.blockReason === 'pa_required')
      return (
        <div className={wrap}>
          <Pill variant="primary" size={size} onClick={() => actions.pharmacySubmitPA(c.id)}>
            <FileCheck2 /> Submit Authorization Request
          </Pill>
        </div>
      )
    if (c.status === 'BLOCKED' && c.blockReason === 'not_covered')
      return (
        <div className={wrap}>
          <Pill variant="primary" size={size} onClick={() => actions.pharmacyAcceptCashPrice(c.id)}>
            <CircleDollarSign /> Apply Discount Price · $18.40
          </Pill>
        </div>
      )
    if (c.status === 'PHARMACY_PROCESSING')
      return (
        <div className={wrap}>
          <Pill variant="success" size={size} onClick={() => actions.pharmacyMarkReady(c.id)}>
            <PackageCheck /> Mark Ready for Pickup
          </Pill>
        </div>
      )
    if (c.status === 'READY_FOR_PICKUP')
      return (
        <div className={wrap}>
          <Pill size={size} onClick={() => actions.completePickup(c.id)}>
            <Check /> Confirm Pickup
          </Pill>
        </div>
      )
    return null
  }

  if (c.status === 'BLOCKED' && c.blockReason === 'visit_required')
    return (
      <div className={wrap}>
        <Pill variant="primary" size={size} onClick={() => actions.patientScheduleVisit(c.id)}>
          <CalendarPlus /> Schedule Visit
        </Pill>
      </div>
    )
  if (c.status === 'READY_FOR_PICKUP')
    return (
      <div className={wrap}>
        <Pill variant="success" size={size} onClick={() => actions.completePickup(c.id)}>
          <Check /> I Picked It Up
        </Pill>
      </div>
    )
  return null
}
