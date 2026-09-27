'use client'

import { AlertTriangle, BellRing, CalendarPlus, Check, CircleDollarSign, FileCheck2, PackageCheck, ShieldAlert, ShieldCheck, ShieldX, Stethoscope, X } from 'lucide-react'
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
          <p className="text-xs font-medium">Reason for rejection</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DENY_REASONS.map((r) => (
              <Pill key={r} size="sm" variant="danger" onClick={() => actions.providerReject(c.id, r)}>
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
          <Check /> Approve
        </Pill>
        <Pill variant="danger" size={size} onClick={() => setDenying(true)}>
          <X /> Reject
        </Pill>
        <Pill variant="warn" size={size} onClick={() => actions.providerRequestInfo(c.id)}>
          <FileCheck2 /> Request Information
        </Pill>
        <Pill variant="secondary" size={size} onClick={() => actions.providerEscalate(c.id)}>
          <ShieldAlert /> Escalate
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
    if (['WAITING_FOR_PHARMACY', 'APPROVED', 'PHARMACY_PROCESSING'].includes(c.status))
      return (
        <div className={wrap}>
          <Pill variant="success" size={size} onClick={() => actions.pharmacyConfirmFulfillment(c.id)}>
            <PackageCheck /> Confirm Fulfillment
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

  // Escalate button for active, delayed cases (can be checked using statusSince, but for simplicity show if not terminal)
  if (!['RESOLVED', 'REJECTED', 'CANCELLED', 'FULFILLED', 'READY_FOR_PICKUP'].includes(c.status) && role !== 'patient') {
    return (
      <div className={wrap}>
        <Pill variant="warning" size={size} onClick={() => actions.escalate(c.id, role)}>
          <AlertTriangle /> Escalate
        </Pill>
      </div>
    )
  }

  return null
}
