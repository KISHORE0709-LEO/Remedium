'use client'

import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, FileText, Flame, Search, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { formatWaiting, isActive, analyzeCase } from '@/lib/remedium/engine'
import { useRemedium } from '@/lib/remedium/store'
import type { RefillCase } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'
import { casesForRole, useNow } from './hooks'
import { CaseStatus, EmptyState, LoadingBlock } from './ui-bits'

const statusPriority: Record<RefillCase['status'], number> = {
  NEW: 0,
  WAITING_FOR_PROVIDER: 0,
  NEEDS_INFORMATION: 1,
  BLOCKED: 1,
  ESCALATED: 1,
  ANALYZING: 3,
  CHECKING: 3,
  REQUESTED: 3,
  WAITING_FOR_INSURANCE: 4,
  WAITING_FOR_PHARMACY: 5,
  PHARMACY_PROCESSING: 5,
  APPROVED: 6,
  PRESCRIPTION_SENT: 6,
  FULFILLED: 7,
  READY_FOR_PICKUP: 7,
  RESOLVED: 9,
  COMPLETED: 9,
  REJECTED: 9,
  DENIED: 9,
  CANCELLED: 9,
}

function sortProviderQueue(cases: RefillCase[]) {
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

export function ProviderDashboard({ compact = false }: { compact?: boolean }) {
  const state = useRemedium()
  const now = useNow()

  const [filterTab, setFilterTab] = useState<'all' | 'needs_me' | 'urgent' | 'blocked' | 'waiting' | 'resolved'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  if (!state) return <LoadingBlock />

  const providerCases = casesForRole(state, 'provider')
  
  // KPIs
  const totalRequests = providerCases.filter(isActive).length
  const needsReviewCount = providerCases.filter(c => c.status === 'WAITING_FOR_PROVIDER').length
  const blockedCount = providerCases.filter(c => c.status === 'BLOCKED' || c.status === 'NEEDS_INFORMATION').length
  const resolvedTodayCount = providerCases.filter(c => !isActive(c) && (now - c.updatedAt) < 86400000).length

  // Needs your attention
  const needsAttention = providerCases.filter(c => c.status === 'WAITING_FOR_PROVIDER' || c.urgent || c.status === 'NEEDS_INFORMATION')
  const sortedAttention = sortProviderQueue(needsAttention)

  // Filtered Queue
  const filteredQueue = sortProviderQueue(providerCases).filter((c) => {
    if (filterTab === 'needs_me' && c.status !== 'WAITING_FOR_PROVIDER') return false
    if (filterTab === 'urgent' && !c.urgent && c.supplyDaysLeft > 2) return false
    if (filterTab === 'blocked' && c.status !== 'BLOCKED' && c.status !== 'NEEDS_INFORMATION') return false
    if (filterTab === 'waiting' && c.status !== 'WAITING_FOR_INSURANCE' && c.status !== 'WAITING_FOR_PHARMACY' && c.status !== 'PHARMACY_PROCESSING' && c.status !== 'READY_FOR_PICKUP') return false
    if (filterTab === 'resolved' && isActive(c)) return false
    if (filterTab === 'all' && !isActive(c)) return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        c.patient.name.toLowerCase().includes(q) ||
        c.medication.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground shadow-2xs">
            <span className="size-2 rounded-full bg-ok animate-pulse" />
            Bayview Internal Medicine
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {getGreeting()}, Dr. Williams
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {needsReviewCount} requests need your review today.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4.5 shadow-2xs transition-all hover:border-foreground/15 hover:shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Requests</span>
            <div className="grid size-8 place-items-center rounded-xl bg-muted text-muted-foreground">
              <FileText className="size-4" />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {totalRequests}
          </p>
        </div>

        <div className="rounded-2xl border border-risk/30 bg-card p-4.5 shadow-2xs transition-all hover:border-risk/60 hover:shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-risk">Needs Review</span>
            <div className="grid size-8 place-items-center rounded-xl bg-risk/10 text-risk">
              <AlertCircle className="size-4" />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-semibold tracking-tight text-risk sm:text-3xl">
            {needsReviewCount}
          </p>
        </div>

        <div className="rounded-2xl border border-warn/40 bg-card p-4.5 shadow-2xs transition-all hover:border-warn/60 hover:shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-warn">Blocked / Needs Info</span>
            <div className="grid size-8 place-items-center rounded-xl bg-warn/10 text-warn">
              <AlertTriangle className="size-4" />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {blockedCount}
          </p>
        </div>

        <div className="rounded-2xl border border-ok/40 bg-card p-4.5 shadow-2xs transition-all hover:border-ok/60 hover:shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ok">Resolved Today</span>
            <div className="grid size-8 place-items-center rounded-xl bg-ok/10 text-ok">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <p className="mt-2.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {resolvedTodayCount}
          </p>
        </div>
      </div>

      {/* NEEDS YOUR ATTENTION */}
      {sortedAttention.length > 0 && (
        <section aria-labelledby="needs-attention-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid size-6 place-items-center rounded-lg bg-risk/10 text-risk">
                <AlertTriangle className="size-3.5" />
              </span>
              <h2 id="needs-attention-heading" className="text-base font-semibold text-foreground">
                Needs Your Attention
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {sortedAttention.slice(0, 4).map((refill) => (
              <RefillCardCompact key={refill.id} refill={refill} now={now} />
            ))}
          </div>
        </section>
      )}

      {/* REFILL QUEUE */}
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

            <div className="flex flex-wrap rounded-full border border-border bg-muted/60 p-1 text-xs">
              {(
                [
                  { id: 'all', label: 'All Open', count: totalRequests },
                  { id: 'needs_me', label: 'Needs Me', count: needsReviewCount },
                  { id: 'urgent', label: 'Urgent', count: providerCases.filter(c => c.urgent || c.supplyDaysLeft <= 2).length },
                  { id: 'blocked', label: 'Blocked', count: blockedCount },
                  { id: 'waiting', label: 'Waiting', count: providerCases.filter(c => ['WAITING_FOR_INSURANCE', 'WAITING_FOR_PHARMACY', 'PHARMACY_PROCESSING', 'READY_FOR_PICKUP'].includes(c.status)).length },
                  { id: 'resolved', label: 'Resolved', count: providerCases.filter(c => !isActive(c)).length },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id as any)}
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

        {filteredQueue.length === 0 ? (
          <EmptyState
            title="No matching refills"
            body={searchQuery ? `No requests match "${searchQuery}".` : 'There are no refill requests in this view right now.'}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredQueue.map((refill) => (
              <RefillCardCompact key={refill.id} refill={refill} now={now} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function RefillCardCompact({ refill, now }: { refill: RefillCase; now: number }) {
  const analysis = analyzeCase(refill)
  const isBlocked = refill.status === 'BLOCKED' || !!refill.blockReason
  const needsMe = refill.status === 'WAITING_FOR_PROVIDER'

  return (
    <Link
      href={`/app/provider/cases/${refill.id}`}
      className={cn(
        'group flex flex-col justify-between rounded-2xl border bg-card p-4 shadow-2xs transition-all hover:border-foreground/20 hover:shadow-soft',
        needsMe ? 'border-risk/30 hover:border-risk/60' : isBlocked ? 'border-warn/30' : 'border-border',
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-foreground truncate">{refill.patient.name}</p>
              {refill.urgent && <Flame className="size-3 text-risk" />}
            </div>
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

        {needsMe ? (
          <div className="mt-2.5 rounded-lg border border-risk/20 bg-risk/[0.04] p-2 text-[11px] text-risk">
            <span className="font-medium block">
              Needs your authorization
            </span>
          </div>
        ) : isBlocked ? (
           <div className="mt-2.5 rounded-lg border border-warn/20 bg-warn/[0.04] p-2 text-[11px] text-warn-foreground">
            <span className="font-medium block truncate">
              {refill.blocker || 'Action Required'}
            </span>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground truncate">
            Owner: {refill.waitingFor}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
          <span>{refill.pharmacy}</span>
          <span>Waiting {formatWaiting(refill.statusSince, now)}</span>
        </div>
      </div>
    </Link>
  )
}
