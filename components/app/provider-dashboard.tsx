'use client'

import { ArrowUpRight, Flame } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { formatDate, formatWaiting, relativeTime } from '@/lib/remedium/engine'
import { useRemedium } from '@/lib/remedium/store'
import type { RefillCase } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'
import { AiAnalysis } from './ai-analysis'
import { CaseActions } from './case-actions'
import { casesForRole, useNow } from './hooks'
import { CaseStatus, EmptyState, LoadingBlock, PageHeader, SectionTitle, StatCard, SupplyMeter } from './ui-bits'

export function ProviderDashboard({ compact = false }: { compact?: boolean }) {
  const state = useRemedium()
  const now = useNow()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  if (!state) return <LoadingBlock />

  const mine = casesForRole(state, 'provider')
  const pending = mine
    .filter((c) => c.status === 'WAITING_FOR_PROVIDER')
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.supplyDaysLeft - b.supplyDaysLeft)
  const decided = mine.filter((c) => c.status !== 'WAITING_FOR_PROVIDER').slice(0, 5)
  const selected = pending.find((c) => c.id === selectedId) ?? pending[0]

  return (
    <div className="@container space-y-8">
      <PageHeader
        eyebrow="Bayview Internal Medicine"
        title="Refill decisions"
        description="Remedium prepared each request. Only a clinical decision is needed."
      />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Awaiting decision" value={pending.length} tone="amber" />
        <StatCard label="Urgent" value={pending.filter((c) => c.urgent || c.supplyDaysLeft <= 2).length} tone="red" />
        <StatCard label="Decided today" value={decided.length} tone="green" />
      </div>

      {pending.length === 0 || !selected ? (
        <EmptyState title="You're all caught up" body="New refill requests that need your authorization will appear here instantly." />
      ) : (
        <div className={cn('grid gap-6', !compact && '@4xl:grid-cols-[300px_minmax(0,1fr)]')}>
          <section aria-label="Pending requests">
            <SectionTitle>Pending requests</SectionTitle>
            <ul className="space-y-2">
              {pending.map((c) => (
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
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {c.urgent && <Flame className="size-3.5 text-risk" aria-label="Urgent" />}
                        {c.patient.name}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">{formatWaiting(c.statusSince, now)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {c.medication.name} {c.medication.strength}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between">
                      <CaseStatus refill={c} />
                      <SupplyMeter days={c.supplyDaysLeft} total={c.medication.daysSupply} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <ProviderReview refill={selected} />
        </div>
      )}

      {decided.length > 0 && (
        <section aria-label="Recent decisions">
          <SectionTitle>Recent decisions</SectionTitle>
          <ul className="divide-y rounded-2xl border bg-card shadow-soft">
            {decided.map((c) => (
              <li key={c.id}>
                <Link href={`/app/provider/cases/${c.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/40">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{c.patient.name}</span>
                    <span className="text-muted-foreground"> · {c.medication.name} {c.medication.strength}</span>
                  </span>
                  <CaseStatus refill={c} />
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

function ProviderReview({ refill: c }: { refill: RefillCase }) {
  return (
    <section aria-label={`Review ${c.id}`} className="space-y-4">
      <div className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground">{c.id} · REFILL AUTHORIZATION</p>
            <h2 className="mt-1 text-xl font-medium tracking-tight">{c.patient.name}</h2>
            <p className="text-sm text-muted-foreground">
              DOB {c.patient.dob} · MRN {c.patient.mrn}
            </p>
          </div>
          <Link
            href={`/app/provider/cases/${c.id}`}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium hover:border-foreground/25"
          >
            Full case <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        <dl className="mt-5 grid gap-4 border-t pt-5 text-sm sm:grid-cols-2">
          <Field k="Medication" v={`${c.medication.name} ${c.medication.strength} ${c.medication.form}`} />
          <Field k="Directions" v={c.medication.sig} />
          <Field k="Last filled" v={formatDate(c.medication.lastFilled)} />
          <Field k="Refills remaining" v={String(c.medication.refillsRemaining)} tone={c.medication.refillsRemaining === 0 ? 'text-risk' : undefined} />
          <Field k="Allergies" v={c.patient.allergies} />
          <Field k="Supply remaining" v={`${c.supplyDaysLeft} days`} tone={c.supplyDaysLeft <= 2 ? 'text-risk' : undefined} />
        </dl>

        <div className="mt-5 border-t pt-5">
          <p className="text-xs text-muted-foreground">Refill history</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {c.refillHistory.map((r) => (
              <li key={r.date} className="rounded-full border bg-muted/40 px-3 py-1 font-mono text-[11px]">
                {formatDate(r.date)} · qty {r.quantity}
              </li>
            ))}
            <li className="rounded-full border border-ok/25 bg-ok/10 px-3 py-1 font-mono text-[11px] text-[oklch(0.45_0.12_158)]">
              Adherence on schedule
            </li>
          </ul>
        </div>
      </div>
      <AiAnalysis refill={c} />
      <div className="rounded-2xl border bg-card p-4 shadow-soft">
        <p className="mb-3 text-xs text-muted-foreground">Your decision</p>
        <CaseActions refill={c} role="provider" />
      </div>
    </section>
  )
}

function Field({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className={cn('mt-0.5 font-medium', tone)}>{v}</dd>
    </div>
  )
}
