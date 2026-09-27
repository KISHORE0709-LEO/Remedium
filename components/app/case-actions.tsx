'use client'

import {
  AlertTriangle,
  BellRing,
  CalendarPlus,
  Check,
  CircleDollarSign,
  FileCheck2,
  Loader2,
  PackageCheck,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Pill } from '@/components/remedium/primitives'
import { actions } from '@/lib/remedium/store'
import type { RefillCase, Role } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'

const DENY_REASONS = ['Therapy discontinued', 'Needs alternative medication', 'Patient transferred care']

// ─── Shared async-action hook ────────────────────────────────────────────────
function useAsyncAction() {
  const [pending, setPending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function run(fn: () => Promise<void> | undefined | void) {
    if (pending) return
    setErrorMsg(null)
    setPending(true)
    try {
      await fn()
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return { pending, errorMsg, run }
}

function Spinner() {
  return <Loader2 className="size-4 animate-spin" aria-hidden="true" />
}

/**
 * AiAdvisoryBanner
 *
 * Shown above human action buttons when an AI analysis exists.
 * Makes the distinction between "AI recommendation" and "human decision"
 * visually explicit — the AI suggests, the human decides.
 */
function AiAdvisoryBanner({ refill }: { refill: RefillCase }) {
  const ai = refill.aiAnalysis
  if (!ai?.nextAction) return null
  return (
    <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-ai/25 bg-[linear-gradient(135deg,oklch(0.97_0.02_292),oklch(0.985_0.01_255))] px-3 py-2.5">
      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-ai" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ai">
          AI Recommendation · advisory only
        </p>
        <p className="mt-0.5 text-xs text-foreground leading-snug">{ai.nextAction}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          The decision below is yours. AI cannot approve, reject, or make clinical decisions.
        </p>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
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
  const { pending, errorMsg, run } = useAsyncAction()
  const c = refill
  const wrap = cn('flex flex-wrap items-center gap-2', className)

  const errorBanner = errorMsg ? (
    <p className="mt-2 w-full text-xs text-[oklch(0.48_0.18_25)]" role="alert">
      {errorMsg}
    </p>
  ) : null

  // ── PROVIDER ──────────────────────────────────────────────────────────────
  if (role === 'provider') {
    const canDecide = c.status === 'WAITING_FOR_PROVIDER'
    if (!canDecide) return null

    if (denying) {
      return (
        <div className={cn('w-full space-y-3', className)}>
          <AiAdvisoryBanner refill={c} />
          <div className="rounded-2xl border border-risk/20 bg-risk/[0.04] p-3">
            <p className="text-xs font-medium">
              <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/50 mr-2">Human Decision</span>
              Reason for rejection
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DENY_REASONS.map((r) => (
                <Pill
                  key={r}
                  size="sm"
                  variant="danger"
                  disabled={pending}
                  onClick={() => run(() => actions.providerReject(c.id, r))}
                >
                  {pending ? <Spinner /> : null}
                  {r}
                </Pill>
              ))}
              <Pill size="sm" variant="ghost" disabled={pending} onClick={() => setDenying(false)}>
                Cancel
              </Pill>
            </div>
            {errorBanner}
          </div>
        </div>
      )
    }

    return (
      <div className={cn('space-y-3', className)}>
        <AiAdvisoryBanner refill={c} />
        <div className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-2.5">
          <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
            Human Decision Required
          </p>
          <div className={wrap}>
            <Pill
              variant="success"
              size={size}
              disabled={pending}
              onClick={() => run(() => actions.providerApprove(c.id))}
            >
              {pending ? <Spinner /> : <Check />}
              {pending ? 'Approving…' : 'Approve'}
            </Pill>
            <Pill variant="danger" size={size} disabled={pending} onClick={() => setDenying(true)}>
              <X /> Reject
            </Pill>
            <Pill
              variant="warn"
              size={size}
              disabled={pending}
              onClick={() => run(() => actions.providerRequestInfo(c.id))}
            >
              {pending ? <Spinner /> : <FileCheck2 />}
              {pending ? 'Requesting…' : 'Request Information'}
            </Pill>
            <Pill
              variant="secondary"
              size={size}
              disabled={pending}
              onClick={() => run(() => actions.providerEscalate(c.id))}
            >
              {pending ? <Spinner /> : <ShieldAlert />}
              {pending ? 'Escalating…' : 'Escalate'}
            </Pill>
            {errorBanner}
          </div>
        </div>
      </div>
    )
  }

  // ── INSURANCE ─────────────────────────────────────────────────────────────
  if (role === 'insurance') {
    if (c.status !== 'WAITING_FOR_INSURANCE') return null
    const paSubmitted = c.insurance === 'pa_submitted'
    return (
      <div className={cn('space-y-3', className)}>
        <AiAdvisoryBanner refill={c} />
        <div className="rounded-2xl border border-border/60 bg-muted/30 px-3 py-2.5">
          <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground/50">
            Human Decision Required
          </p>
          <div className={wrap}>
            <Pill
              variant="success"
              size={size}
              disabled={pending}
              onClick={() => run(() => actions.insuranceApprove(c.id))}
            >
              {pending ? <Spinner /> : <ShieldCheck />}
              {pending ? 'Approving…' : paSubmitted ? 'Approve Authorization' : 'Approve Coverage'}
            </Pill>
            {!paSubmitted && (
              <Pill
                variant="warn"
                size={size}
                disabled={pending}
                onClick={() => run(() => actions.insuranceRequirePA(c.id))}
              >
                {pending ? <Spinner /> : <ShieldAlert />}
                {pending ? 'Updating…' : 'Require Prior Auth'}
              </Pill>
            )}
            <Pill
              variant="danger"
              size={size}
              disabled={pending}
              onClick={() => run(() => actions.insuranceNotCovered(c.id))}
            >
              {pending ? <Spinner /> : <ShieldX />}
              {pending ? 'Updating…' : 'Not Covered'}
            </Pill>
            {errorBanner}
          </div>
        </div>
      </div>
    )
  }

  // ── PHARMACY ──────────────────────────────────────────────────────────────
  if (role === 'pharmacy') {
    if (c.status === 'WAITING_FOR_PROVIDER')
      return (
        <div className={wrap}>
          <Pill
            size={size}
            disabled={pending}
            onClick={() => run(() => actions.pharmacyNudgeProvider(c.id))}
          >
            {pending ? <Spinner /> : <BellRing />}
            {pending ? 'Sending…' : 'Send Provider Reminder'}
          </Pill>
          {errorBanner}
        </div>
      )

    if (c.status === 'BLOCKED' && c.blockReason === 'pa_required')
      return (
        <div className={wrap}>
          <Pill
            variant="primary"
            size={size}
            disabled={pending}
            onClick={() => run(() => actions.pharmacySubmitPA(c.id))}
          >
            {pending ? <Spinner /> : <FileCheck2 />}
            {pending ? 'Submitting…' : 'Submit Authorization Request'}
          </Pill>
          {errorBanner}
        </div>
      )

    if (c.status === 'BLOCKED' && c.blockReason === 'not_covered')
      return (
        <div className={wrap}>
          <Pill
            variant="primary"
            size={size}
            disabled={pending}
            onClick={() => run(() => actions.pharmacyAcceptCashPrice(c.id))}
          >
            {pending ? <Spinner /> : <CircleDollarSign />}
            {pending ? 'Applying…' : 'Apply Discount Price · $18.40'}
          </Pill>
          {errorBanner}
        </div>
      )

    if (['WAITING_FOR_PHARMACY', 'APPROVED', 'PHARMACY_PROCESSING', 'FULFILLED'].includes(c.status))
      return (
        <div className={wrap}>
          <Pill
            variant="success"
            size={size}
            disabled={pending}
            onClick={() => run(() => actions.pharmacyConfirmFulfillment(c.id))}
          >
            {pending ? <Spinner /> : <PackageCheck />}
            {pending ? 'Confirming…' : 'Confirm Fulfillment'}
          </Pill>
          {errorBanner}
        </div>
      )

    if (c.status === 'READY_FOR_PICKUP')
      return (
        <div className={wrap}>
          <Pill
            size={size}
            disabled={pending}
            onClick={() => run(() => actions.completePickup(c.id))}
          >
            {pending ? <Spinner /> : <Check />}
            {pending ? 'Confirming…' : 'Confirm Pickup'}
          </Pill>
          {errorBanner}
        </div>
      )

    return null
  }

  // ── PATIENT ───────────────────────────────────────────────────────────────
  if (c.status === 'BLOCKED' && c.blockReason === 'visit_required')
    return (
      <div className={wrap}>
        <Pill
          variant="primary"
          size={size}
          disabled={pending}
          onClick={() => run(() => actions.patientScheduleVisit(c.id))}
        >
          {pending ? <Spinner /> : <CalendarPlus />}
          {pending ? 'Scheduling…' : 'Schedule Visit'}
        </Pill>
        {errorBanner}
      </div>
    )

  if (c.status === 'READY_FOR_PICKUP')
    return (
      <div className={wrap}>
        <Pill
          variant="success"
          size={size}
          disabled={pending}
          onClick={() => run(() => actions.completePickup(c.id))}
        >
          {pending ? <Spinner /> : <Check />}
          {pending ? 'Confirming…' : 'I Picked It Up'}
        </Pill>
        {errorBanner}
      </div>
    )

  // Escalate fallback for any active non-terminal case
  if (!['RESOLVED', 'REJECTED', 'CANCELLED', 'FULFILLED', 'READY_FOR_PICKUP'].includes(c.status) && role !== 'patient') {
    return (
      <div className={wrap}>
        <Pill
          variant="warn"
          size={size}
          disabled={pending}
          onClick={() => run(() => actions.escalate(c.id, role))}
        >
          {pending ? <Spinner /> : <AlertTriangle />}
          {pending ? 'Escalating…' : 'Escalate'}
        </Pill>
        {errorBanner}
      </div>
    )
  }

  return null
}
