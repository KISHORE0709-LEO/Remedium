'use client'

import { ArrowUpRight, FileCheck2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Badge } from '@/components/remedium/primitives'
import { formatWaiting, relativeTime } from '@/lib/remedium/engine'
import { useRemedium } from '@/lib/remedium/store'
import type { InsuranceState, RefillCase } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'
import { AiAnalysis } from './ai-analysis'
import { CaseActions } from './case-actions'
import { useCasesForRole, useNow } from './hooks'
import { EmptyState, LoadingBlock, PageHeader, SectionTitle, StatCard } from './ui-bits'

const COVERAGE: Record<InsuranceState, { label: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'neutral' }> = {
  not_started: { label: 'Not started', tone: 'neutral' },
  pending: { label: 'Pending', tone: 'amber' },
  pa_required: { label: 'PA required', tone: 'amber' },
  pa_submitted: { label: 'PA submitted', tone: 'blue' },
  approved: { label: 'Covered', tone: 'green' },
  not_covered: { label: 'Not covered', tone: 'red' },
  cash_price: { label: 'Cash price', tone: 'neutral' },
}

export function CoverageBadge({ state }: { state: InsuranceState }) {
  const c = COVERAGE[state]
  return <Badge tone={c.tone}>{c.label}</Badge>
}

const COPAY = { 1: '$5.00', 2: '$25.00', 3: '$45.00' } as const

export function InsuranceDashboard({ compact = false }: { compact?: boolean }) {
  const state = useRemedium()
  const now = useNow()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // ↓ Hook called unconditionally before early return
  const all = useCasesForRole(state?.cases ?? [], 'insurance')
  if (!state) return <LoadingBlock />

  const queue = all.filter((c) => c.status === 'WAITING_FOR_INSURANCE').sort((a, b) => a.statusSince - b.statusSince)
  const history = all.filter((c) => c.status !== 'WAITING_FOR_INSURANCE').slice(0, 6)
  const selected = queue.find((c) => c.id === selectedId) ?? queue[0]

  return (
    <div className="@container space-y-8">
      <PageHeader eyebrow="Meridian Health PBM" title="Coverage review" description="Claims and prior authorizations routed by Remedium." />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Pending review" value={queue.length} tone="amber" />
        <StatCard label="PA submitted" value={queue.filter((c) => c.insurance === 'pa_submitted').length} tone="blue" />
        <StatCard label="Decided" value={all.filter((c) => ['approved', 'not_covered', 'pa_required'].includes(c.insurance)).length} tone="green" />
      </div>

      {!selected ? (
        <EmptyState title="No claims waiting" body="Coverage checks appear here as soon as a refill clears pharmacy and provider review." />
      ) : (
        <div className={cn('grid gap-6', !compact && '@4xl:grid-cols-[320px_minmax(0,1fr)]')}>
          <section aria-label="Coverage queue">
            <SectionTitle>Queue</SectionTitle>
            <ul className="space-y-2">
              {queue.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    aria-pressed={c.id === selected.id}
                    className={cn(
                      'w-full rounded-2xl border bg-card p-4 text-left shadow-soft transition-all',
                      c.id === selected.id ? 'border-foreground/25 ring-3 ring-foreground/[0.04]' : 'hover:border-foreground/15',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{c.medication.name} {c.medication.strength}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{formatWaiting(c.statusSince, now)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.patient.name} · {c.id}
                    </p>
                    <div className="mt-2.5">
                      <CoverageBadge state={c.insurance} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <CoverageReview refill={selected} />
        </div>
      )}

      {history.length > 0 && (
        <section aria-label="Recent determinations">
          <SectionTitle>Recent determinations</SectionTitle>
          <ul className="divide-y rounded-2xl border bg-card shadow-soft">
            {history.map((c) => (
              <li key={c.id}>
                <Link href={`/app/insurance/cases/${c.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/40">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{c.medication.name} {c.medication.strength}</span>
                    <span className="text-muted-foreground"> · {c.patient.name}</span>
                  </span>
                  <CoverageBadge state={c.insurance} />
                  <span className="w-16 text-right font-mono text-[10px] text-muted-foreground">{relativeTime(c.statusSince, now)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function CoverageReview({ refill: c }: { refill: RefillCase }) {
  const paSubmitted = c.insurance === 'pa_submitted'
  return (
    <section aria-label={`Coverage review ${c.id}`} className="space-y-4">
      <div className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground">
              {c.id} · {paSubmitted ? 'PRIOR AUTHORIZATION' : 'CLAIM'}
            </p>
            <h2 className="mt-1 text-xl font-medium tracking-tight">
              {c.medication.name} {c.medication.strength}
            </h2>
            <p className="text-sm text-muted-foreground">
              Member {c.patient.name} · {c.plan}
            </p>
          </div>
          <Link
            href={`/app/insurance/cases/${c.id}`}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium hover:border-foreground/25"
          >
            Full case <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
        <dl className="mt-5 grid gap-4 border-t pt-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Formulary tier</dt>
            <dd className="mt-0.5 font-medium">Tier {c.medication.tier}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Member copay</dt>
            <dd className="mt-0.5 font-medium">{COPAY[c.medication.tier]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">PA policy</dt>
            <dd className={cn('mt-0.5 font-medium', c.medication.requiresPA && 'text-[oklch(0.52_0.13_65)]')}>
              {c.medication.requiresPA ? 'Required for class' : 'Not required'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Prescriber</dt>
            <dd className="mt-0.5 font-medium">{c.prescriber}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Quantity</dt>
            <dd className="mt-0.5 font-medium">
              {c.medication.quantity} · {c.medication.daysSupply}-day
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Coverage status</dt>
            <dd className="mt-1">
              <CoverageBadge state={c.insurance} />
            </dd>
          </div>
        </dl>
        {paSubmitted && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-info/20 bg-info/[0.05] p-3.5">
            <FileCheck2 className="mt-0.5 size-4 text-info" />
            <p className="text-sm leading-relaxed">
              PA packet includes diagnosis code, prior therapy history and prescriber attestation — assembled automatically by Remedium from the chart.
            </p>
          </div>
        )}
      </div>
      <AiAnalysis refill={c} compact />
      <div className="rounded-2xl border bg-card p-4 shadow-soft">
        <p className="mb-3 text-xs text-muted-foreground">Determination</p>
        <CaseActions refill={c} role="insurance" />
      </div>
    </section>
  )
}
