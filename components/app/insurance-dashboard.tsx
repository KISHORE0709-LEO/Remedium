'use client'

/**
 * Insurance / PBM Dashboard — Meridian Health PBM Simulator
 *
 * This is a hackathon simulation of an external insurance/PBM workspace.
 * All data comes from the shared Firestore refills collection — no separate
 * database. Insurance decisions update the existing refill state machine and
 * create workflowEvents + notifications visible to Provider/Pharmacy in real
 * time.
 *
 * Workflow decisions:
 *   Approve:             WAITING_FOR_INSURANCE → APPROVED → WAITING_FOR_PHARMACY
 *   Request More Info:   WAITING_FOR_INSURANCE → NEEDS_INFORMATION
 *   Deny:                WAITING_FOR_INSURANCE → REJECTED
 */

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileCheck2,
  FileText,
  Flame,
  HelpCircle,
  Loader2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Badge } from '@/components/remedium/primitives'
import { analyzeCase, formatWaiting, isActive, relativeTime } from '@/lib/remedium/engine'
import { actions, useRemedium } from '@/lib/remedium/store'
import type { InsuranceState, RefillCase } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'
import { AiAnalysis } from './ai-analysis'
import { CaseActions } from './case-actions'
import { useCasesForRole, useNow } from './hooks'
import { CaseStatus, EmptyState, LoadingBlock, SupplyMeter } from './ui-bits'
import { eventTone, Timeline } from './timeline'

// ─── Coverage badge ───────────────────────────────────────────────────────────
const COVERAGE_META: Record<InsuranceState, { label: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'neutral' }> = {
  not_started: { label: 'Not started', tone: 'neutral' },
  pending:     { label: 'Pending review', tone: 'amber' },
  pa_required: { label: 'PA required', tone: 'amber' },
  pa_submitted:{ label: 'PA submitted', tone: 'blue' },
  approved:    { label: 'Approved', tone: 'green' },
  not_covered: { label: 'Not covered', tone: 'red' },
  cash_price:  { label: 'Cash price', tone: 'neutral' },
}

export function CoverageBadge({ state }: { state: InsuranceState }) {
  const m = COVERAGE_META[state]
  return <Badge tone={m.tone}>{m.label}</Badge>
}

const COPAY: Record<1 | 2 | 3, string> = { 1: '$5.00', 2: '$25.00', 3: '$45.00' }

const DENY_REASONS = [
  'Not medically necessary per current clinical guidelines',
  'Step therapy requirements not met',
  'Formulary alternative available',
  'Quantity exceeds plan limits',
  'Diagnosis does not support requested medication',
]

// ─── Main dashboard ───────────────────────────────────────────────────────────
export function InsuranceDashboard({ compact = false }: { compact?: boolean }) {
  const state = useRemedium()
  const now = useNow()
  const all = useCasesForRole(state?.cases ?? [], 'insurance')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterTab, setFilterTab] = useState<'pending' | 'decided' | 'all'>('pending')

  if (!state) return <LoadingBlock />

  const pending   = all.filter((c) => c.status === 'WAITING_FOR_INSURANCE').sort((a, b) => a.statusSince - b.statusSince)
  const decided   = all.filter((c) => c.status !== 'WAITING_FOR_INSURANCE' && (c.insurance === 'approved' || c.insurance === 'not_covered' || c.status === 'REJECTED' || c.status === 'NEEDS_INFORMATION')).slice(0, 20)
  const approved  = decided.filter((c) => c.insurance === 'approved' || c.status === 'WAITING_FOR_PHARMACY' || c.status === 'FULFILLED' || c.status === 'RESOLVED')
  const denied    = decided.filter((c) => c.status === 'REJECTED')
  const moreInfo  = decided.filter((c) => c.status === 'NEEDS_INFORMATION' && c.insurance !== 'approved')

  const listCases = filterTab === 'pending' ? pending : filterTab === 'decided' ? decided : all.filter((c) => c.insurance !== 'not_started')
  const selected  = (listCases.find((c) => c.id === selectedId) ?? listCases[0]) ?? null

  return (
    <div className="@container space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground shadow-2xs">
            <span className="size-2 rounded-full bg-ok animate-pulse" />
            Meridian Health PBM · Claims Portal
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Prior Authorization Review
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pending.length} request{pending.length !== 1 ? 's' : ''} awaiting determination
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setFilterTab('pending')}
          className={cn(
            'rounded-2xl border bg-card p-4 text-left shadow-2xs transition-all hover:shadow-soft cursor-pointer',
            filterTab === 'pending' ? 'border-warn/50 ring-1 ring-warn/15' : 'border-warn/30 hover:border-warn/50',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-warn">Pending Review</span>
            <div className="grid size-8 place-items-center rounded-xl bg-warn/10 text-warn">
              <Clock className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-semibold text-warn">{pending.length}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Awaiting decision</p>
        </button>

        <button
          type="button"
          onClick={() => { setFilterTab('decided'); setSelectedId(null) }}
          className={cn(
            'rounded-2xl border bg-card p-4 text-left shadow-2xs transition-all hover:shadow-soft cursor-pointer',
            filterTab === 'decided' && selectedId === null ? 'border-ok/50 ring-1 ring-ok/15' : 'border-ok/30 hover:border-ok/50',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ok">Approved</span>
            <div className="grid size-8 place-items-center rounded-xl bg-ok/10 text-ok">
              <ShieldCheck className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-semibold text-ok">{approved.length}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Coverage confirmed</p>
        </button>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">More Info</span>
            <div className="grid size-8 place-items-center rounded-xl bg-info/10 text-info">
              <HelpCircle className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">{moreInfo.length}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Awaiting docs</p>
        </div>

        <div className="rounded-2xl border border-risk/30 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-risk">Denied</span>
            <div className="grid size-8 place-items-center rounded-xl bg-risk/10 text-risk">
              <ShieldX className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-semibold text-risk">{denied.length}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Not authorized</p>
        </div>
      </div>

      {/* Main content: list + detail panel */}
      {listCases.length === 0 ? (
        <EmptyState
          title={filterTab === 'pending' ? 'No pending PA requests' : 'No decisions yet'}
          body={filterTab === 'pending'
            ? 'New prior authorization requests from pharmacies will appear here.'
            : 'Determined requests will appear here after you make a decision.'}
        />
      ) : (
        <div className={cn('grid gap-5', !compact && '@4xl:grid-cols-[340px_minmax(0,1fr)]')}>
          {/* Left: PA request list */}
          <section className="space-y-3">
            {/* Filter tabs */}
            <div className="flex rounded-full border border-border bg-muted/60 p-1 text-xs w-fit">
              {([
                { id: 'pending', label: 'Pending', count: pending.length },
                { id: 'decided', label: 'Decided', count: decided.length },
                { id: 'all', label: 'All', count: all.filter((c) => c.insurance !== 'not_started').length },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setFilterTab(tab.id); setSelectedId(null) }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-all cursor-pointer',
                    filterTab === tab.id ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                  <span className="font-mono text-[10px] opacity-70">({tab.count})</span>
                </button>
              ))}
            </div>

            <ul className="space-y-2">
              {listCases.map((c) => (
                <PARequestCard
                  key={c.id}
                  refill={c}
                  now={now}
                  selected={c.id === (selected?.id ?? listCases[0]?.id)}
                  onSelect={() => setSelectedId(c.id)}
                />
              ))}
            </ul>
          </section>

          {/* Right: detail panel */}
          {selected && (
            <PARequestDetail
              key={selected.id}
              refill={selected}
              now={now}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── PA Request Card (list item) ─────────────────────────────────────────────
function PARequestCard({
  refill: c,
  now,
  selected,
  onSelect,
}: {
  refill: RefillCase
  now: number
  selected: boolean
  onSelect: () => void
}) {
  const isPending = c.status === 'WAITING_FOR_INSURANCE'
  const isUrgent  = c.urgent || c.supplyDaysLeft <= 3

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-2xl border bg-card p-4 text-left shadow-2xs transition-all hover:shadow-soft cursor-pointer',
        selected
          ? 'border-foreground/25 ring-2 ring-foreground/[0.06]'
          : isUrgent
          ? 'border-warn/40 hover:border-warn/60'
          : 'border-border hover:border-foreground/15',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate">
              {c.medication.name} <span className="font-normal text-muted-foreground">{c.medication.strength}</span>
            </p>
            {isUrgent && <Flame className="size-3.5 shrink-0 text-warn" />}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {c.patient.name} · {c.id}
          </p>
        </div>
        <CoverageBadge state={c.insurance} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileText className="size-3" />
          Tier {c.medication.tier}
        </span>
        {c.medication.requiresPA && (
          <span className="flex items-center gap-1 text-warn">
            <ShieldAlert className="size-3" />
            PA required
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {formatWaiting(c.statusSince, now)}
        </span>
        <span className={cn('flex items-center gap-1', c.supplyDaysLeft <= 3 && 'text-risk font-medium')}>
          {c.supplyDaysLeft}d supply
        </span>
      </div>
    </button>
  )
}

// ─── PA Request Detail panel ─────────────────────────────────────────────────
function PARequestDetail({ refill: c, now }: { refill: RefillCase; now: number }) {
  const [action, setAction] = useState<'approve' | 'more_info' | 'deny' | null>(null)
  const [denyReason, setDenyReason] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<'approved' | 'more_info' | 'denied' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isPending = c.status === 'WAITING_FOR_INSURANCE'
  const paSubmitted = c.insurance === 'pa_submitted'

  async function executeAction() {
    if (!action) return
    setPending(true)
    setError(null)
    try {
      if (action === 'approve') {
        await actions.insuranceApprove(c.id)
        setDone('approved')
      } else if (action === 'more_info') {
        await actions.insuranceRequirePA(c.id)
        setDone('more_info')
      } else if (action === 'deny') {
        if (!denyReason) { setError('Please select a reason for denial.'); setPending(false); return }
        await actions.insuranceDeny(c.id, denyReason)
        setDone('denied')
      }
      setAction(null)
    } catch (err: any) {
      setError(err?.message ?? 'Action failed. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="space-y-4" aria-label={`PA review: ${c.id}`}>
      {/* ── Case header ── */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              {c.id} · {paSubmitted ? 'Prior Authorization' : 'Coverage Review'}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              {c.medication.name}{' '}
              <span className="font-normal text-muted-foreground">{c.medication.strength}</span>
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Member {c.patient.name} · {c.plan}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CaseStatus refill={c} />
            <CoverageBadge state={c.insurance} />
          </div>
        </div>

        {/* Prescription details grid */}
        <dl className="mt-5 grid grid-cols-2 gap-3.5 border-t border-border pt-5 text-sm sm:grid-cols-3">
          {[
            ['Member', `${c.patient.name} · DOB ${c.patient.dob}`],
            ['MRN', c.patient.mrn],
            ['Prescriber', c.prescriber],
            ['Pharmacy', c.pharmacy],
            ['Formulary Tier', `Tier ${c.medication.tier} · Copay ${COPAY[c.medication.tier]}`],
            ['PA Policy', c.medication.requiresPA ? 'Required for this drug class' : 'Not required'],
            ['Quantity', `${c.medication.quantity} · ${c.medication.daysSupply}-day supply`],
            ['Supply Remaining', `${c.supplyDaysLeft} days`],
            ['Refills on File', String(c.medication.refillsRemaining)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{k}</dt>
              <dd className={cn('mt-0.5 text-sm font-medium text-foreground', k === 'Supply Remaining' && c.supplyDaysLeft <= 3 && 'text-risk')}>{v}</dd>
            </div>
          ))}
        </dl>

        {/* PA submission notice */}
        {paSubmitted && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-info/20 bg-info/[0.05] p-3.5">
            <FileCheck2 className="mt-0.5 size-4 shrink-0 text-info" />
            <div>
              <p className="text-sm font-medium text-foreground">PA documentation submitted by pharmacy</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Clinical documentation has been submitted for this request. Review the supporting information before making a determination.
              </p>
            </div>
          </div>
        )}

        {/* Why PA is required */}
        {(c.blocker || c.blockReason) && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-warn/25 bg-warn/[0.05] p-3.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-warn">Why PA is required</p>
              <p className="mt-1 text-sm text-foreground">{c.blocker ?? 'Prior authorization required per formulary policy'}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── AI Summary ── */}
      {c.aiAnalysis && (
        <div className="rounded-2xl border border-ai/20 bg-[linear-gradient(135deg,oklch(0.97_0.02_292),oklch(0.985_0.01_255))] p-5">
          <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ai">
            <Sparkles className="size-3.5" /> Remedium AI Summary · advisory only
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground">{c.aiAnalysis.summary}</p>
          {c.aiAnalysis.priorityReason && (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Priority: </span>{c.aiAnalysis.priorityReason}
            </p>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            AI recommendations are advisory only. Coverage decisions are made by licensed insurance staff.
          </p>
        </div>
      )}

      {/* ── Decision zone ── */}
      {isPending && !done && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-4">
          <div className="flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-foreground text-background">
              <Shield className="size-3.5" />
            </span>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
              Coverage Determination — your decision is final
            </p>
          </div>

          {/* Action selection */}
          {!action && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => { setAction('approve'); setError(null) }}
                className="flex items-center gap-3 rounded-xl border border-ok/30 bg-ok/[0.06] p-3.5 text-left transition-colors hover:bg-ok/10 cursor-pointer"
              >
                <ShieldCheck className="size-5 shrink-0 text-ok" />
                <div>
                  <p className="text-sm font-semibold text-ok">Approve</p>
                  <p className="text-[11px] text-muted-foreground">Confirm coverage</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setAction('more_info'); setError(null) }}
                className="flex items-center gap-3 rounded-xl border border-info/30 bg-info/[0.05] p-3.5 text-left transition-colors hover:bg-info/10 cursor-pointer"
              >
                <HelpCircle className="size-5 shrink-0 text-info" />
                <div>
                  <p className="text-sm font-semibold text-info">Request Info</p>
                  <p className="text-[11px] text-muted-foreground">Need more docs</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setAction('deny'); setError(null) }}
                className="flex items-center gap-3 rounded-xl border border-risk/30 bg-risk/[0.05] p-3.5 text-left transition-colors hover:bg-risk/10 cursor-pointer"
              >
                <ShieldX className="size-5 shrink-0 text-risk" />
                <div>
                  <p className="text-sm font-semibold text-risk">Deny</p>
                  <p className="text-[11px] text-muted-foreground">Not authorized</p>
                </div>
              </button>
            </div>
          )}

          {/* Confirm Approve */}
          {action === 'approve' && (
            <div className="rounded-xl border border-ok/25 bg-ok/[0.05] p-4 space-y-3">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Confirm coverage approval</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This will approve coverage for <strong>{c.medication.name} {c.medication.strength}</strong> for member <strong>{c.patient.name}</strong>. The refill will move to <strong>WAITING_FOR_PHARMACY</strong> and the pharmacy will be notified immediately.
                  </p>
                </div>
              </div>
              {error && <p className="text-xs text-risk">{error}</p>}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setAction(null)}
                  disabled={pending}
                  className="rounded-full border border-border px-4 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeAction}
                  disabled={pending}
                  className="inline-flex items-center gap-2 rounded-full border border-ok/40 bg-ok/10 px-5 py-2 text-xs font-semibold text-ok hover:bg-ok hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {pending ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                  {pending ? 'Approving…' : 'Confirm Approval'}
                </button>
              </div>
            </div>
          )}

          {/* Confirm Request More Info */}
          {action === 'more_info' && (
            <div className="rounded-xl border border-info/25 bg-info/[0.05] p-4 space-y-3">
              <div className="flex items-start gap-3">
                <HelpCircle className="mt-0.5 size-5 shrink-0 text-info" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Request additional documentation</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The case will move to <strong>NEEDS_INFORMATION</strong>. The pharmacy will be notified to provide additional clinical documentation before a coverage determination can be made.
                  </p>
                </div>
              </div>
              {error && <p className="text-xs text-risk">{error}</p>}
              <div className="flex items-center gap-2.5 pt-1">
                <button type="button" onClick={() => setAction(null)} disabled={pending}
                  className="rounded-full border border-border px-4 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50 cursor-pointer">
                  Cancel
                </button>
                <button type="button" onClick={executeAction} disabled={pending}
                  className="inline-flex items-center gap-2 rounded-full border border-info/40 bg-info/10 px-5 py-2 text-xs font-semibold text-info hover:bg-info hover:text-white disabled:opacity-50 transition-colors cursor-pointer">
                  {pending ? <Loader2 className="size-3.5 animate-spin" /> : <HelpCircle className="size-3.5" />}
                  {pending ? 'Sending…' : 'Request Documentation'}
                </button>
              </div>
            </div>
          )}

          {/* Confirm Deny */}
          {action === 'deny' && (
            <div className="rounded-xl border border-risk/25 bg-risk/[0.04] p-4 space-y-3">
              <div className="flex items-start gap-3">
                <ShieldX className="mt-0.5 size-5 shrink-0 text-risk" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Select reason for denial</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    The refill will be moved to <strong>REJECTED</strong>. Provider and pharmacy will be notified.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {DENY_REASONS.map((r) => (
                  <label key={r} className="flex items-center gap-3 rounded-xl border border-border p-3 cursor-pointer hover:border-risk/30 hover:bg-risk/[0.03] transition-colors">
                    <input
                      type="radio"
                      name="denyReason"
                      value={r}
                      checked={denyReason === r}
                      onChange={() => setDenyReason(r)}
                      className="shrink-0 accent-risk"
                    />
                    <span className="text-xs text-foreground">{r}</span>
                  </label>
                ))}
              </div>
              {error && <p className="text-xs text-risk">{error}</p>}
              <div className="flex items-center gap-2.5 pt-1">
                <button type="button" onClick={() => { setAction(null); setDenyReason('') }} disabled={pending}
                  className="rounded-full border border-border px-4 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50 cursor-pointer">
                  Cancel
                </button>
                <button type="button" onClick={executeAction} disabled={pending || !denyReason}
                  className="inline-flex items-center gap-2 rounded-full border border-risk/40 bg-risk/[0.07] px-5 py-2 text-xs font-semibold text-risk hover:bg-risk hover:text-white disabled:opacity-50 transition-colors cursor-pointer">
                  {pending ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldX className="size-3.5" />}
                  {pending ? 'Denying…' : 'Confirm Denial'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Decision result banner ── */}
      {done === 'approved' && (
        <div className="flex items-center gap-3 rounded-2xl border border-ok/25 bg-ok/[0.07] px-5 py-4">
          <CheckCircle2 className="size-5 shrink-0 text-ok" />
          <div>
            <p className="text-sm font-semibold text-ok">Coverage approved</p>
            <p className="text-xs text-muted-foreground">Pharmacy has been notified and the prescription is queued for fulfillment.</p>
          </div>
        </div>
      )}
      {done === 'more_info' && (
        <div className="flex items-center gap-3 rounded-2xl border border-info/25 bg-info/[0.06] px-5 py-4">
          <HelpCircle className="size-5 shrink-0 text-info" />
          <div>
            <p className="text-sm font-semibold text-info">Additional documentation requested</p>
            <p className="text-xs text-muted-foreground">Pharmacy has been notified to provide additional clinical information.</p>
          </div>
        </div>
      )}
      {done === 'denied' && (
        <div className="flex items-center gap-3 rounded-2xl border border-risk/25 bg-risk/[0.06] px-5 py-4">
          <ShieldX className="size-5 shrink-0 text-risk" />
          <div>
            <p className="text-sm font-semibold text-risk">Coverage denied</p>
            <p className="text-xs text-muted-foreground">Provider and pharmacy have been notified of the denial decision.</p>
          </div>
        </div>
      )}

      {/* Already decided state */}
      {!isPending && !done && (
        <div className="rounded-2xl border border-border bg-muted/30 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              This request has already been determined. Current status: <span className="font-medium text-foreground">{c.status.replace(/_/g, ' ')}</span>
            </p>
          </div>
        </div>
      )}

      {/* ── Activity Timeline ── */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Activity Timeline</h3>
        <Timeline refill={c} showActors />
      </div>
    </section>
  )
}
