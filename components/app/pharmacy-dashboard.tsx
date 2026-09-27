'use client'

import { ArrowUpRight, Flame } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { analyzeCase, formatWaiting, isActive } from '@/lib/remedium/engine'
import { useRemedium } from '@/lib/remedium/store'
import type { RefillCase } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'
import { AiAnalysis } from './ai-analysis'
import { CaseActions } from './case-actions'
import { useNow } from './hooks'
import { CaseStatus, EmptyState, LoadingBlock, PageHeader, SectionTitle, StatCard, WhyStuck } from './ui-bits'

const priority: Record<RefillCase['status'], number> = {
  BLOCKED: 0,
  WAITING_FOR_PROVIDER: 1,
  CHECKING: 2,
  REQUESTED: 2,
  WAITING_FOR_INSURANCE: 3,
  PHARMACY_PROCESSING: 4,
  APPROVED: 5,
  PRESCRIPTION_SENT: 5,
  READY_FOR_PICKUP: 6,
  COMPLETED: 9,
  DENIED: 9,
}

export function sortQueue(cases: RefillCase[]) {
  return [...cases].sort(
    (a, b) =>
      Number(b.urgent) - Number(a.urgent) ||
      priority[a.status] - priority[b.status] ||
      a.supplyDaysLeft - b.supplyDaysLeft ||
      b.createdAt - a.createdAt,
  )
}

export function PharmacyDashboard({ compact = false }: { compact?: boolean }) {
  const state = useRemedium()
  const now = useNow()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  if (!state) return <LoadingBlock />

  const open = sortQueue(state.cases.filter(isActive))
  const blocked = open.filter((c) => analyzeCase(c).blocker)
  const selected = open.find((c) => c.id === selectedId) ?? open[0]
  const count = (s: RefillCase['status'][]) => open.filter((c) => s.includes(c.status)).length

  return (
    <div className="@container space-y-8">
      <PageHeader
        eyebrow="Harbor Pharmacy #214"
        title="Refill operations"
        description={`${open.length} open refills · ${blocked.length} need attention`}
      />
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <StatCard label="Blocked" value={blocked.length} tone="red" hint="Remedium identified the cause" />
        <StatCard label="Waiting on provider" value={count(['WAITING_FOR_PROVIDER'])} tone="amber" />
        <StatCard label="Waiting on insurance" value={count(['WAITING_FOR_INSURANCE'])} tone="blue" />
        <StatCard label="Ready for pickup" value={count(['READY_FOR_PICKUP'])} tone="green" />
      </div>

      {open.length === 0 ? (
        <EmptyState title="Queue is clear" body="Every refill is resolved. New requests will appear here in real time." />
      ) : (
        <div className={cn('grid gap-6', !compact && '@5xl:grid-cols-[minmax(0,1fr)_400px]')}>
          <section aria-label="Refill queue">
            <SectionTitle aside={<span className="font-mono text-[10px] tracking-widest text-muted-foreground">SORTED BY PRIORITY</span>}>
              Refill queue
            </SectionTitle>
            <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
              <div className="hidden grid-cols-[1.3fr_1.2fr_110px_1.3fr_90px] gap-4 border-b bg-muted/40 px-4 py-2.5 font-mono text-[10px] tracking-widest text-muted-foreground @3xl:grid">
                <span>PATIENT</span>
                <span>MEDICATION</span>
                <span>STATUS</span>
                <span>BLOCKER · WAITING FOR</span>
                <span className="text-right">WAITING</span>
              </div>
              <ul className="divide-y">
                {open.map((c) => {
                  const i = analyzeCase(c)
                  const isSel = c.id === selected?.id
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        aria-pressed={isSel}
                        className={cn(
                          'grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3.5 text-left transition-colors @3xl:grid-cols-[1.3fr_1.2fr_110px_1.3fr_90px]',
                          isSel ? 'bg-info/[0.05] shadow-[inset_3px_0_0_var(--info)]' : 'hover:bg-muted/50',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            {c.urgent && <Flame className="size-3.5 text-risk" aria-label="Urgent" />}
                            <span className="truncate">{c.patient.name}</span>
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">{c.id}</span>
                        </span>
                        <span className="min-w-0 text-sm @3xl:order-none">
                          <span className="block truncate">{c.medication.name}</span>
                          <span className="block text-xs text-muted-foreground">{c.medication.strength}</span>
                        </span>
                        <span>
                          <CaseStatus refill={c} />
                        </span>
                        <span className="min-w-0 text-sm">
                          <span className={cn('block truncate', i.blocker ? 'text-foreground' : 'text-muted-foreground')}>
                            {i.blocker ?? i.actionRequired}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{i.waitingFor}</span>
                        </span>
                        <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                          {formatWaiting(c.statusSince, now)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>

          {selected && <CaseSidePanel refill={selected} now={now} role="pharmacy" />}
        </div>
      )}
    </div>
  )
}

export function CaseSidePanel({ refill, now, role }: { refill: RefillCase; now: number; role: 'pharmacy' | 'provider' | 'insurance' }) {
  return (
    <aside aria-label={`Case ${refill.id}`} className="space-y-4 @5xl:sticky @5xl:top-24 @5xl:self-start">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground">{refill.id}</p>
          <p className="font-medium">
            {refill.patient.name} · {refill.medication.name} {refill.medication.strength}
          </p>
        </div>
        <Link
          href={`/app/${role}/cases/${refill.id}`}
          className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1.5 text-xs font-medium hover:border-foreground/25"
        >
          Open case <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
      <WhyStuck refill={refill} now={now} />
      <AiAnalysis refill={refill} compact />
      <CaseActions refill={refill} role={role} />
    </aside>
  )
}
