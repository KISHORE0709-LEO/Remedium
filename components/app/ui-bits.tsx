'use client'

import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/remedium/primitives'
import { analyzeCase, formatWaiting, roleLabel, statusBadge } from '@/lib/remedium/engine'
import type { RefillCase } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{eyebrow}</p>}
        <h1 className="mt-1.5 text-2xl font-medium tracking-tight text-balance sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  )
}

export function StatCard({ label, value, tone, hint }: { label: string; value: number | string; tone?: 'red' | 'amber' | 'green' | 'blue'; hint?: string }) {
  const bar = tone === 'red' ? 'bg-risk' : tone === 'amber' ? 'bg-warn' : tone === 'green' ? 'bg-ok' : tone === 'blue' ? 'bg-info' : 'bg-foreground/20'
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-4 shadow-soft">
      <span className={cn('absolute top-4 left-0 h-6 w-[3px] rounded-r-full', bar)} />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-medium tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function CaseStatus({ refill }: { refill: RefillCase }) {
  const b = statusBadge(refill)
  const live = refill.status !== 'COMPLETED' && refill.status !== 'DENIED' && refill.status !== 'READY_FOR_PICKUP'
  return (
    <Badge tone={b.tone} pulse={live && (b.tone === 'red' || b.tone === 'violet')}>
      {b.label}
    </Badge>
  )
}

export function LoadingBlock({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)} aria-busy="true" aria-label="Loading">
      <div className="h-8 w-64 animate-pulse rounded-full bg-muted" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-muted" />
    </div>
  )
}

export function EmptyState({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full border bg-card">
        <Inbox className="size-4 text-muted-foreground" strokeWidth={1.6} />
      </span>
      <p className="mt-4 font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  )
}

export function SupplyMeter({ days, total = 30 }: { days: number; total?: number }) {
  const pct = Math.max(4, Math.min(100, (days / total) * 100))
  const tone = days <= 2 ? 'bg-risk' : days <= 7 ? 'bg-warn' : 'bg-ok'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-xs tabular-nums', days <= 2 ? 'font-medium text-risk' : 'text-muted-foreground')}>
        {days}d left
      </span>
    </div>
  )
}

export function WhyStuck({ refill, now, className }: { refill: RefillCase; now: number; className?: string }) {
  const i = analyzeCase(refill)
  const rows: [string, string, string?][] = [
    ['Blocker', i.blocker ?? 'No blocker', i.blocker ? 'text-risk' : 'text-ok'],
    ['Waiting for', i.waitingFor === '—' ? '—' : `${i.waitingFor}${i.ownerName && i.ownerName !== i.waitingFor ? ` · ${i.ownerName}` : ''}`],
    ['Action required', i.actionRequired],
    ['Missing info', i.missingInfo],
    ['Patient impact', i.patientImpact, refill.supplyDaysLeft <= 2 && i.blocker ? 'text-risk' : undefined],
    ['Next action', i.nextAction, 'text-ai'],
    ['Time in status', formatWaiting(refill.statusSince, now)],
  ]
  return (
    <section aria-label="Why is this refill stuck?" className={cn('rounded-2xl border bg-card p-5 shadow-soft', className)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{i.blocker ? 'Why is this refill stuck?' : 'Where is this refill?'}</h3>
        <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground">
          OWNER · {roleLabel(i.owner).toUpperCase()}
        </span>
      </div>
      <dl className="mt-4 divide-y">
        {rows.map(([k, v, color]) => (
          <div key={k} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <dt className="shrink-0 text-xs text-muted-foreground">{k}</dt>
            <dd className={cn('text-right text-sm font-medium', color)}>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-medium">{children}</h2>
      {aside}
    </div>
  )
}
