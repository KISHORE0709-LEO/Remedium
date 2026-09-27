'use client'

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  Flame,
  HelpCircle,
  Loader2,
  PackageCheck,
  Pill as PillIcon,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { analyzeCase, formatWaiting, isActive, relativeTime } from '@/lib/remedium/engine'
import { submitPharmacyRefillToFirestore } from '@/lib/remedium/firestore-service'
import { nameToProviderId, nameToPharmacyId } from '@/lib/remedium/auth-profile'
import { actions, useRemedium } from '@/lib/remedium/store'
import type { RefillCase } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'
import { useNow } from './hooks'
import { useAuthIdentity } from './app-shell'
import { CaseStatus, EmptyState, LoadingBlock } from './ui-bits'

const PHARMACY_NAME = 'Harbor Pharmacy #214'

// Priority order for sorting cases
const statusPriority: Record<RefillCase['status'], number> = {
  NEW: 0,
  BLOCKED: 0,
  ESCALATED: 0,
  NEEDS_INFORMATION: 1,
  WAITING_FOR_PROVIDER: 1,
  WAITING_FOR_INSURANCE: 2,
  ANALYZING: 3,
  CHECKING: 3,
  REQUESTED: 3,
  WAITING_FOR_PHARMACY: 4,
  PHARMACY_PROCESSING: 4,
  APPROVED: 5,
  PRESCRIPTION_SENT: 5,
  FULFILLED: 6,
  READY_FOR_PICKUP: 6,
  RESOLVED: 9,
  COMPLETED: 9,
  REJECTED: 9,
  DENIED: 9,
  CANCELLED: 9,
}

export function sortQueue(cases: RefillCase[]) {
  return [...cases].sort(
    (a, b) =>
      Number(b.urgent) - Number(a.urgent) ||
      statusPriority[a.status] - statusPriority[b.status] ||
      a.supplyDaysLeft - b.supplyDaysLeft ||
      b.createdAt - a.createdAt,
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function PharmacyDashboard({
  defaultFilter = 'all',
  compact = false,
}: {
  defaultFilter?: 'all' | 'blocked' | 'fulfillment'
  compact?: boolean
}) {
  const state = useRemedium()
  const now = useNow()
  const authIdentity = useAuthIdentity()

  const [selectedCase, setSelectedCase] = useState<RefillCase | null>(null)
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false)
  const [filterTab, setFilterTab] = useState<
    'all' | 'blocked' | 'waiting' | 'waiting_provider' | 'waiting_insurance' | 'ready' | 'fulfillment'
  >(
    defaultFilter === 'blocked' ? 'blocked' : defaultFilter === 'fulfillment' ? 'fulfillment' : 'all',
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Dynamic Pharmacy Name from editable profile
  const [pharmacyName, setPharmacyName] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('remedium-profile-pharmacy')
      if (saved) {
        try {
          return JSON.parse(saved).org || PHARMACY_NAME
        } catch (e) {}
      }
    }
    return PHARMACY_NAME
  })

  useEffect(() => {
    function onProfileUpdate() {
      const saved = localStorage.getItem('remedium-profile-pharmacy')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.org) setPharmacyName(parsed.org)
        } catch (e) {}
      }
    }
    window.addEventListener('remedium-profile-updated', onProfileUpdate)
    return () => window.removeEventListener('remedium-profile-updated', onProfileUpdate)
  }, [])

  if (!state) return <LoadingBlock />

  // CANONICAL FIRESTORE-BACKED DATA SOURCE
  const allCases = state.cases
  const activeCases = sortQueue(allCases.filter(isActive))

  // Dynamically calculated counts from the exact same Firestore refill records:
  const openRefillsCount = activeCases.length
  const blockedCases = activeCases.filter((c) => c.status === 'BLOCKED' || !!c.blockReason)
  const blockedCount = blockedCases.length
  const waitingProviderCases = activeCases.filter((c) => c.status === 'WAITING_FOR_PROVIDER')
  const waitingProviderCount = waitingProviderCases.length
  const waitingInsuranceCases = activeCases.filter((c) => c.status === 'WAITING_FOR_INSURANCE')
  const waitingInsuranceCount = waitingInsuranceCases.length
  const readyForPickupCases = activeCases.filter(
    (c) => c.status === 'READY_FOR_PICKUP' || c.status === 'FULFILLED',
  )
  const readyForPickupCount = readyForPickupCases.length

  // Filtered queue based on selected tab and search
  const filteredQueue = activeCases.filter((c) => {
    if (filterTab === 'blocked' && !(c.status === 'BLOCKED' || !!c.blockReason)) return false
    if (filterTab === 'waiting' && !(c.status === 'WAITING_FOR_PROVIDER' || c.status === 'WAITING_FOR_INSURANCE')) return false
    if (filterTab === 'waiting_provider' && c.status !== 'WAITING_FOR_PROVIDER') return false
    if (filterTab === 'waiting_insurance' && c.status !== 'WAITING_FOR_INSURANCE') return false
    if (filterTab === 'ready' && c.status !== 'READY_FOR_PICKUP' && c.status !== 'FULFILLED') return false
    if (
      filterTab === 'fulfillment' &&
      !['WAITING_FOR_PHARMACY', 'APPROVED', 'PHARMACY_PROCESSING', 'FULFILLED'].includes(c.status)
    )
      return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        c.patient.name.toLowerCase().includes(q) ||
        c.medication.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.prescriber.toLowerCase().includes(q)
      )
    }
    return true
  })

  function notifySuccess(msg: string) {
    setActionSuccess(msg)
    window.setTimeout(() => setActionSuccess(null), 3500)
  }

  return (
    <div className="space-y-8">
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground shadow-2xs">
            <span className="size-2 rounded-full bg-ok animate-pulse" />
            Live Pharmacy Operations · NPI 1928374650
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {getGreeting()}, {pharmacyName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Refill coordination hub · {openRefillsCount} open refills ·{' '}
            <span className="font-medium text-foreground">{blockedCount} need immediate attention</span>
          </p>
        </div>

        {/* Primary Action: + New Refill Request */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsNewRequestOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-foreground bg-foreground px-5 py-2.5 text-xs font-semibold text-background shadow-soft transition-all duration-200 hover:-translate-y-px hover:bg-foreground/90 hover:shadow-lift cursor-pointer"
          >
            <Plus className="size-4 stroke-[2.5]" />
            New Refill Request
          </button>
        </div>
      </div>

      {/* Action Toast */}
      {actionSuccess && (
        <div className="flex items-center gap-2.5 rounded-xl border border-ok/25 bg-ok/[0.08] px-4 py-3 text-xs text-[oklch(0.42_0.11_158)] animate-fade-up">
          <CheckCircle2 className="size-4 shrink-0" />
          <span className="font-medium">{actionSuccess}</span>
        </div>
      )}

      {/* ── DYNAMIC FIRESTORE-CALCULATED KPI CARDS ────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-5">
        {/* 1. Total Open Refills */}
        <div className="rounded-2xl border border-border bg-card p-4.5 shadow-2xs transition-all hover:border-foreground/15 hover:shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Open</span>
            <div className="grid size-8 place-items-center rounded-xl bg-muted text-muted-foreground">
              <FileText className="size-4" />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {openRefillsCount}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Active in queue</p>
        </div>

        {/* 2. Blocked */}
        <div className="relative overflow-hidden rounded-2xl border border-risk/30 bg-card p-4.5 shadow-2xs transition-all hover:border-risk/60 hover:shadow-soft">
          <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-risk/5" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-risk">Blocked</span>
            <div className="grid size-8 place-items-center rounded-xl bg-risk/10 text-risk">
              <AlertCircle className="size-4" />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-semibold tracking-tight text-risk sm:text-3xl">
            {blockedCount}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Needs coordination</p>
        </div>

        {/* 3. Waiting for Provider */}
        <div className="rounded-2xl border border-border bg-card p-4.5 shadow-2xs transition-all hover:border-warn/40 hover:shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Waiting Provider</span>
            <div className="grid size-8 place-items-center rounded-xl bg-warn/10 text-warn">
              <Stethoscope className="size-4" />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {waitingProviderCount}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Prescriber authorization</p>
        </div>

        {/* 4. Waiting for Insurance */}
        <div className="rounded-2xl border border-border bg-card p-4.5 shadow-2xs transition-all hover:border-sky-500/40 hover:shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Waiting Insurance</span>
            <div className="grid size-8 place-items-center rounded-xl bg-sky-500/10 text-sky-600">
              <ShieldAlert className="size-4" />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {waitingInsuranceCount}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Payer adjudication / PA</p>
        </div>

        {/* 5. Ready for Pickup */}
        <div className="rounded-2xl border border-border bg-card p-4.5 shadow-2xs transition-all hover:border-ok/40 hover:shadow-soft col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Ready for Pickup</span>
            <div className="grid size-8 place-items-center rounded-xl bg-ok/10 text-ok">
              <PackageCheck className="size-4" />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {readyForPickupCount}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">In pickup bin</p>
        </div>
      </div>

      {/* ── "NEEDS ATTENTION" SECTION ────────────────────────────────────────── */}
      {blockedCases.length > 0 && (
        <section aria-labelledby="needs-attention-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid size-6 place-items-center rounded-lg bg-risk/10 text-risk">
                <AlertTriangle className="size-3.5" />
              </span>
              <h2 id="needs-attention-heading" className="text-base font-semibold text-foreground">
                Needs Attention
              </h2>
              <span className="rounded-full border border-risk/20 bg-risk/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-risk">
                {blockedCases.length} stuck
              </span>
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Focused on: <strong>What is stuck?</strong> · <strong>Why is it stuck?</strong> · <strong>What happens next?</strong>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {blockedCases.map((refill) => {
              const analysis = analyzeCase(refill)
              return (
                <RefillCard
                  key={refill.id}
                  refill={refill}
                  now={now}
                  onView={() => setSelectedCase(refill)}
                  onActionComplete={(msg) => notifySuccess(msg)}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* ── ALL REFILL REQUESTS / OPERATIONAL QUEUE ──────────────────────────── */}
      <section aria-labelledby="queue-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 id="queue-heading" className="text-base font-semibold text-foreground">
              Refill Queue
            </h2>
            <span className="font-mono text-xs text-muted-foreground">({filteredQueue.length})</span>
          </div>

          {/* Filter Tabs & Search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search patient, drug, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8.5 w-44 rounded-full border border-border bg-white pl-8 pr-3 text-xs outline-none transition-all placeholder:text-muted-foreground focus:border-foreground focus:ring-1 focus:ring-foreground sm:w-56"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap rounded-full border border-border bg-muted/60 p-1 text-xs">
              {(
                [
                  { id: 'all', label: 'All Open', count: openRefillsCount },
                  { id: 'blocked', label: 'Blocked', count: blockedCount },
                  { id: 'waiting_provider', label: 'Waiting Provider', count: waitingProviderCount },
                  { id: 'waiting_insurance', label: 'Waiting Insurance', count: waitingInsuranceCount },
                  { id: 'ready', label: 'Ready for Pickup', count: readyForPickupCount },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-all cursor-pointer',
                    filterTab === tab.id
                      ? 'bg-card text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span>{tab.label}</span>
                  <span className="font-mono text-[10px] opacity-75">({tab.count})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Refill Cards List */}
        {filteredQueue.length === 0 ? (
          <EmptyState
            title="No matching refills"
            body={
              searchQuery
                ? `No requests match "${searchQuery}". Clear your search to see all active cases.`
                : 'There are no refill requests in this view right now.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredQueue.map((refill) => (
              <RefillCardCompact
                key={refill.id}
                refill={refill}
                now={now}
                onView={() => setSelectedCase(refill)}
                onActionComplete={(msg) => notifySuccess(msg)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── CASE DETAIL DRAWER / MODAL ───────────────────────────────────────── */}
      {selectedCase && (
        <CaseDetailModal
          refill={selectedCase}
          now={now}
          onClose={() => setSelectedCase(null)}
          onActionComplete={(msg) => notifySuccess(msg)}
        />
      )}

      {/* ── "+ NEW REFILL REQUEST" MODAL ────────────────────────────────────── */}
      {isNewRequestOpen && (
        <NewRefillModal
          pharmacyId={authIdentity.pharmacyId ?? 'harbor-pharmacy-214'}
          onClose={() => setIsNewRequestOpen(false)}
          onCreated={(id, patient, med) => {
            setIsNewRequestOpen(false)
            notifySuccess(`Created refill request ${id} for ${patient} (${med})`)
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REFILL CARD (Featured in "Needs Attention" with full 3-step clarity)
// ─────────────────────────────────────────────────────────────────────────────
function RefillCard({
  refill,
  now,
  onView,
  onActionComplete,
}: {
  refill: RefillCase
  now: number
  onView: () => void
  onActionComplete: (msg: string) => void
}) {
  const analysis = analyzeCase(refill)
  const isUrgent = refill.urgent || refill.supplyDaysLeft <= 2

  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-5 shadow-soft transition-all duration-200 hover:border-foreground/20 hover:shadow-lift',
        refill.status === 'BLOCKED' ? 'border-risk/30' : 'border-border',
      )}
    >
      <div>
        {/* Card Header: Patient & Status & Waiting Time */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground truncate">{refill.patient.name}</span>
              {isUrgent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-risk/10 px-2 py-0.5 text-[10px] font-semibold text-risk">
                  <Flame className="size-3" />
                  {refill.supplyDaysLeft}d supply left
                </span>
              )}
            </div>
            <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
              DOB: {refill.patient.dob} · MRN: {refill.patient.mrn}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <CaseStatus refill={refill} />
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
              <Clock className="size-3" />
              Waiting {formatWaiting(refill.statusSince, now)}
            </span>
          </div>
        </div>

        {/* Medication Details */}
        <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <PillIcon className="size-4 text-foreground/70 shrink-0" />
            <span className="font-medium text-sm text-foreground">
              {refill.medication.name} {refill.medication.strength}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed pl-6">
            {refill.medication.sig} · Qty {refill.medication.quantity} ({refill.medication.daysSupply}-day supply)
          </p>
          <div className="mt-2 flex items-center justify-between pl-6 text-[11px] text-muted-foreground">
            <span>Prescriber: <strong>{refill.prescriber}</strong></span>
            <span>Plan: <strong>{refill.plan}</strong></span>
          </div>
        </div>

        {/* Blocker Callout: "Why is it stuck?" */}
        <div className="mt-3.5 rounded-xl border border-risk/25 bg-risk/[0.04] p-3 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-[oklch(0.48_0.18_25)]">
            <AlertCircle className="size-3.5" />
            <span>Why is it stuck?</span>
          </div>
          <p className="mt-1 text-muted-foreground leading-relaxed">
            {refill.blockReason === 'pa_required' && (
              <>Prior Authorization required by {refill.plan}. Formulary policy requires clinical paperwork before coverage confirmation.</>
            )}
            {refill.blockReason === 'no_refills' && (
              <>Prescription has <strong>0 refills remaining</strong> on file. Waiting on {refill.prescriber} to approve renewal.</>
            )}
            {refill.blockReason === 'visit_required' && (
              <>{refill.prescriber} requested patient schedule a routine office follow-up prior to authorizing refill.</>
            )}
            {refill.blockReason === 'not_covered' && (
              <>Medication is excluded from formulary by {refill.plan}. Remedium identified patient-assist cash price ($18.40).</>
            )}
            {!refill.blockReason && analysis.blocker}
          </p>
        </div>

        {/* What happens next */}
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground px-1">
          <Sparkles className="size-3.5 text-primary shrink-0" />
          <span className="truncate">
            Next: <strong>{analysis.actionRequired}</strong>
          </span>
        </div>
      </div>

      {/* Card Actions Footer */}
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        {/* Quick Context Action */}
        <QuickActionButton refill={refill} onComplete={onActionComplete} />

        {/* View Details Button */}
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-2xs hover:border-foreground/30 hover:bg-neutral-50 transition-colors cursor-pointer"
        >
          View Details
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPACT REFILL CARD (For Queue grid)
// ─────────────────────────────────────────────────────────────────────────────
function RefillCardCompact({
  refill,
  now,
  onView,
  onActionComplete,
}: {
  refill: RefillCase
  now: number
  onView: () => void
  onActionComplete: (msg: string) => void
}) {
  const analysis = analyzeCase(refill)
  const isBlocked = refill.status === 'BLOCKED' || !!refill.blockReason
  const isReady = refill.status === 'READY_FOR_PICKUP' || refill.status === 'FULFILLED'

  return (
    <div
      className={cn(
        'flex flex-col justify-between rounded-2xl border bg-card p-4 shadow-2xs transition-all hover:border-foreground/20 hover:shadow-soft',
        isBlocked ? 'border-risk/30' : isReady ? 'border-ok/30' : 'border-border',
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{refill.patient.name}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{refill.id} · MRN: {refill.patient.mrn}</p>
          </div>
          <CaseStatus refill={refill} />
        </div>

        <div className="mt-3">
          <p className="text-xs font-medium text-foreground">
            {refill.medication.name} {refill.medication.strength}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">{refill.medication.sig}</p>
        </div>

        {/* Blocker or status summary */}
        {isBlocked ? (
          <div className="mt-2.5 rounded-lg border border-risk/20 bg-risk/[0.04] p-2 text-[11px] text-risk">
            <span className="font-medium block">
              {refill.blockReason === 'pa_required'
                ? 'PA required by plan'
                : refill.blockReason === 'no_refills'
                ? '0 refills on file'
                : refill.blockReason === 'visit_required'
                ? 'Office visit required'
                : 'Formulary exception'}
            </span>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground truncate">
            {analysis.actionRequired}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
          <span>{refill.prescriber}</span>
          <span>Waiting {formatWaiting(refill.statusSince, now)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <QuickActionButton refill={refill} onComplete={onActionComplete} compact />

        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:underline cursor-pointer"
        >
          View
          <ArrowRight className="size-3" />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK ACTION BUTTON (Respond to request / Confirm fulfillment directly)
// ─────────────────────────────────────────────────────────────────────────────
function QuickActionButton({
  refill,
  onComplete,
  compact = false,
}: {
  refill: RefillCase
  onComplete: (msg: string) => void
  compact?: boolean
}) {
  const [loading, setLoading] = useState(false)

  // 1. Prior Authorization blocker -> Submit PA Packet
  if (refill.blockReason === 'pa_required' || refill.insurance === 'pa_required') {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          setLoading(true)
          actions.pharmacySubmitPA(refill.id)
          onComplete(`Submitted Prior Auth packet for ${refill.patient.name} (${refill.medication.name})`)
        }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary text-primary-foreground font-semibold shadow-2xs hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50',
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs',
        )}
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3" />}
        Submit PA Packet
      </button>
    )
  }

  // 2. Not Covered -> Offer Cash Price
  if (refill.blockReason === 'not_covered') {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          setLoading(true)
          actions.pharmacyAcceptCashPrice(refill.id)
          onComplete(`Applied $18.40 cash discount for ${refill.patient.name}`)
        }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-ok bg-ok text-white font-semibold shadow-2xs hover:bg-ok/90 transition-all cursor-pointer disabled:opacity-50',
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs',
        )}
      >
        <Check className="size-3" />
        Apply Cash Price ($18.40)
      </button>
    )
  }

  // 3. Waiting on Provider -> Nudge / Escalation
  if (refill.status === 'WAITING_FOR_PROVIDER') {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          setLoading(true)
          actions.pharmacyNudgeProvider(refill.id)
          onComplete(`Sent priority refill reminder to ${refill.prescriber}`)
          setLoading(false)
        }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 text-warn font-semibold hover:bg-warn/20 transition-all cursor-pointer disabled:opacity-50',
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs',
        )}
      >
        <Send className="size-3" />
        Nudge Provider
      </button>
    )
  }

  // 4. Approved / waiting for pharmacy → Confirm Fulfillment
  if (refill.status === 'WAITING_FOR_PHARMACY' || refill.status === 'APPROVED' || refill.status === 'PHARMACY_PROCESSING') {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          setLoading(true)
          actions.pharmacyConfirmFulfillment(refill.id)
          onComplete(`Fulfillment confirmed for ${refill.patient.name}`)
        }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-ok bg-ok text-white font-semibold shadow-2xs hover:bg-ok/90 transition-all cursor-pointer disabled:opacity-50',
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs',
        )}
      >
        <PackageCheck className="size-3" />
        Confirm Fulfillment
      </button>
    )
  }

  // 5. Ready for Pickup / Fulfilled → Confirm Dispensed
  if (refill.status === 'READY_FOR_PICKUP' || refill.status === 'FULFILLED') {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          setLoading(true)
          actions.completePickup(refill.id)
          onComplete(`Fulfillment confirmed: Dispensed to ${refill.patient.name}`)
        }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-foreground bg-foreground text-background font-semibold shadow-2xs hover:bg-foreground/90 transition-all cursor-pointer disabled:opacity-50',
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs',
        )}
      >
        <CheckCircle2 className="size-3" />
        Confirm Dispensed
      </button>
    )
  }

  return (
    <span className="text-[11px] text-muted-foreground font-mono">
      In Automated Workflow
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CASE DETAIL MODAL ("View" button action)
// ─────────────────────────────────────────────────────────────────────────────
function CaseDetailModal({
  refill,
  now,
  onClose,
  onActionComplete,
}: {
  refill: RefillCase
  now: number
  onClose: () => void
  onActionComplete: (msg: string) => void
}) {
  const analysis = analyzeCase(refill)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-up">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground uppercase">{refill.id}</span>
              <CaseStatus refill={refill} />
            </div>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              {refill.medication.name} {refill.medication.strength}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Patient: <strong>{refill.patient.name}</strong> (DOB {refill.patient.dob}, MRN {refill.patient.mrn})
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 3-Core Questions: What is stuck? Why is it stuck? What happens next? */}
        <div className="mt-6 space-y-4">
          {/* 1. What is stuck? */}
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              1. What is stuck?
            </h3>
            <p className="mt-1 text-sm font-medium text-foreground">
              {refill.medication.name} {refill.medication.strength} prescription for {refill.patient.name}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Prescriber: <span className="text-foreground font-medium">{refill.prescriber}</span></div>
              <div>Plan: <span className="text-foreground font-medium">{refill.plan}</span></div>
              <div>Directions: <span className="text-foreground font-medium">{refill.medication.sig}</span></div>
              <div>Days Supply Left: <span className="text-foreground font-medium">{refill.supplyDaysLeft} days</span></div>
            </div>
          </div>

          {/* 2. Why is it stuck? */}
          <div className="rounded-2xl border border-risk/30 bg-risk/[0.04] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-risk">
              2. Why is it stuck?
            </h3>
            <p className="mt-1 text-sm font-medium text-foreground">
              {refill.blockReason === 'pa_required' && 'Prior Authorization Required'}
              {refill.blockReason === 'no_refills' && '0 Refills Remaining on Prescription'}
              {refill.blockReason === 'visit_required' && 'Provider Mandated Patient Office Visit'}
              {refill.blockReason === 'not_covered' && 'Medication Excluded from Plan Formulary'}
              {!refill.blockReason && analysis.blocker}
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {refill.blockReason === 'pa_required' &&
                'Insurance payer Meridian Health PBM flagged this medication as Tier 3 requiring clinical prior authorization before coverage is guaranteed.'}
              {refill.blockReason === 'no_refills' &&
                'The active prescription record indicates zero remaining refills. Provider authorization is legally required before dispensing.'}
              {refill.blockReason === 'visit_required' &&
                'Prescriber requested patient attend scheduled appointment before re-authorizing maintenance therapy.'}
              {refill.blockReason === 'not_covered' &&
                'Not on formulary tier. Remedium verified discount assistance cash pricing is available for patient.'}
            </p>
          </div>

          {/* 3. What happens next? */}
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
              3. What happens next?
            </h3>
            <p className="mt-1 text-sm font-medium text-foreground">
              {refill.aiRecommendation || analysis.actionRequired}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Waiting on: <strong>{refill.waitingFor || analysis.waitingFor}</strong>
            </p>
          </div>

          {/* AI Clinical Summary & Recommendation from Firestore document */}
          {(refill.aiSummary || refill.aiRecommendation) && (
            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-4 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-purple-700">
                <Sparkles className="size-3.5 text-purple-600" />
                <span>Remedium Clinical Intelligence</span>
              </div>
              {refill.aiSummary && (
                <p className="mt-1.5 text-foreground leading-relaxed">{refill.aiSummary}</p>
              )}
              {refill.aiRecommendation && (
                <p className="mt-2 font-medium text-foreground">
                  Action Recommendation:{' '}
                  <span className="font-normal text-muted-foreground">{refill.aiRecommendation}</span>
                </p>
              )}
            </div>
          )}

          {/* Timeline of events */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Case Timeline
            </h3>
            <div className="space-y-3">
              {refill.events.map((ev) => (
                <div key={ev.id} className="flex items-start gap-2.5 text-xs">
                  <span className="size-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{ev.label}</p>
                    {ev.detail && <p className="text-muted-foreground text-[11px]">{ev.detail}</p>}
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{relativeTime(ev.at, now)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <Link
            href={`/app/pharmacy/cases/${refill.id}`}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Open full case record →
          </Link>

          <div className="flex items-center gap-2">
            <QuickActionButton
              refill={refill}
              onComplete={(msg) => {
                onActionComplete(msg)
                onClose()
              }}
            />
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// "+ NEW REFILL REQUEST" MODAL
// ─────────────────────────────────────────────────────────────────────────────
function NewRefillModal({
  pharmacyId,
  onClose,
  onCreated,
}: {
  pharmacyId: string
  onClose: () => void
  onCreated: (id: string, patient: string, med: string) => void
}) {
  const [form, setForm] = useState({
    patientName: '',
    dob: '',
    mrn: '',
    phone: '',
    allergies: '',
    medication: '',
    dosage: '',
    quantity: '',
    daysSupply: '30',
    prescriptionId: '',
    provider: '',
    plan: '',
    reason: '',
  })
  const [errors, setErrors] = useState<Partial<typeof form>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const e: Partial<typeof form> = {}
    if (!form.patientName.trim()) e.patientName = 'Patient name is required'
    if (!form.medication.trim()) e.medication = 'Medication is required'
    if (!form.dosage.trim()) e.dosage = 'Dosage is required'
    if (!form.quantity.trim() || isNaN(Number(form.quantity)) || Number(form.quantity) <= 0)
      e.quantity = 'Valid quantity is required'
    if (!form.prescriptionId.trim()) e.prescriptionId = 'Prescription ID is required'
    if (!form.provider.trim()) e.provider = 'Provider name is required'
    if (!form.reason.trim()) e.reason = 'Reason for refill is required'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const id = await submitPharmacyRefillToFirestore({
        patientName: form.patientName.trim(),
        dob: form.dob.trim() || undefined,
        mrn: form.mrn.trim() || undefined,
        phone: form.phone.trim() || undefined,
        allergies: form.allergies.trim() || undefined,
        medicationName: form.medication.trim(),
        dosage: form.dosage.trim(),
        quantity: Number(form.quantity),
        daysSupply: Number(form.daysSupply) || 30,
        prescriptionId: form.prescriptionId.trim(),
        provider: form.provider.trim(),
        // Derive a stable providerId from the entered provider name so that
        // Dr. Sarah Williams → 'dr-sarah-williams', matching her Firestore profile.
        providerId: nameToProviderId(form.provider.trim()),
        plan: form.plan.trim() || undefined,
        reason: form.reason.trim(),
        pharmacyId,
      })
      onCreated(id, form.patientName.trim(), `${form.medication.trim()} ${form.dosage.trim()}`)
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit refill request. Please try again.')
      setSubmitting(false)
    }
  }

  const fields: { key: keyof typeof form; label: string; placeholder: string; type?: string; multiline?: boolean; optional?: boolean }[] = [
    { key: 'patientName', label: 'Patient Name', placeholder: 'e.g. Jane Smith' },
    { key: 'dob', label: 'Date of Birth', placeholder: 'e.g. 04/12/1968', optional: true },
    { key: 'mrn', label: 'MRN', placeholder: 'e.g. MRN-204417', optional: true },
    { key: 'phone', label: 'Phone', placeholder: 'e.g. (415) 555-0142', optional: true },
    { key: 'allergies', label: 'Allergies', placeholder: 'e.g. Penicillin or NKDA', optional: true },
    { key: 'medication', label: 'Medication', placeholder: 'e.g. Atorvastatin' },
    { key: 'dosage', label: 'Dosage / Strength', placeholder: 'e.g. 20 mg' },
    { key: 'quantity', label: 'Quantity', placeholder: 'e.g. 30', type: 'number' },
    { key: 'daysSupply', label: 'Days Supply', placeholder: 'e.g. 30', type: 'number', optional: true },
    { key: 'prescriptionId', label: 'Prescription ID', placeholder: 'e.g. RX-2024-00142' },
    { key: 'provider', label: 'Provider', placeholder: 'e.g. Dr. Sarah Williams' },
    { key: 'plan', label: 'Insurance Plan', placeholder: 'e.g. Meridian Health PBM', optional: true },
    { key: 'reason', label: 'Reason for Refill', placeholder: 'e.g. Maintenance therapy — 30-day supply running low', multiline: true },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-up">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">New Refill Request</h2>
            <p className="text-xs text-muted-foreground">Submit a new prescription refill from the pharmacy counter</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          {fields.map(({ key, label, placeholder, type, multiline, optional }) => (
            <div key={key} className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase font-mono">
                {label}
                {optional
                  ? <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
                  : <span className="text-risk">*</span>
                }
              </label>
              {multiline ? (
                <textarea
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder={placeholder}
                  rows={3}
                  className={cn(
                    'w-full resize-none rounded-xl border bg-white px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground',
                    errors[key] ? 'border-risk' : 'border-border',
                  )}
                />
              ) : (
                <input
                  type={type || 'text'}
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder={placeholder}
                  min={type === 'number' ? 1 : undefined}
                  className={cn(
                    'h-10 w-full rounded-xl border bg-white px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground',
                    errors[key] ? 'border-risk' : 'border-border',
                  )}
                />
              )}
              {errors[key] && (
                <p className="flex items-center gap-1 text-[11px] text-risk">
                  <AlertCircle className="size-3 shrink-0" />
                  {errors[key]}
                </p>
              )}
            </div>
          ))}


          {submitError && (
            <div className="flex items-center gap-2 rounded-xl border border-risk/25 bg-risk/[0.06] px-3 py-2.5 text-xs text-risk">
              <AlertCircle className="size-3.5 shrink-0" />
              {submitError}
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full border border-foreground bg-foreground px-5 py-2 text-xs font-semibold text-background shadow-soft hover:bg-foreground/90 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
