'use client'

import { ArrowRight, Check, MapPin, Pill as PillIcon, TriangleAlert, X } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'
import { Pill } from '@/components/remedium/primitives'
import { estimatedPickup, isActive, patientHeadline, patientSteps, relativeTime, type PatientStep } from '@/lib/remedium/engine'
import { patientMedications } from '@/lib/remedium/seed'
import { actions, DEMO_PATIENT, useRemedium } from '@/lib/remedium/store'
import type { RefillCase } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'
import { CaseActions } from './case-actions'
import { casesForRole, useNow } from './hooks'
import { eventTone } from './timeline'
import { StatusDot } from '@/components/remedium/primitives'
import { CaseStatus, EmptyState, LoadingBlock, PageHeader, SectionTitle, SupplyMeter } from './ui-bits'

export function PatientDashboard({ compact = false }: { compact?: boolean }) {
  const state = useRemedium()
  const now = useNow()
  const meds = useMemo(() => patientMedications(Date.now()), [])
  if (!state) return <LoadingBlock />

  const mine = casesForRole(state, 'patient')
  const active = mine.filter(isActive)
  const featured = active[0] ?? mine[0]
  const updates = state.notifications.filter((n) => n.role === 'patient').slice(0, 5)
  const first = DEMO_PATIENT.name.split(' ')[0]
  const hour = new Date(now).getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="@container space-y-8">
      <PageHeader eyebrow="Patient" title={`${greeting}, ${first}`} description="Your medications and refills, all in one place." />

      {featured ? (
        <ActiveRefill refill={featured} compact={compact} />
      ) : (
        <EmptyState title="No refills in progress" body="Request a refill from your medications below and we'll keep you posted." />
      )}

      <div className="grid gap-8 @3xl:grid-cols-[1.4fr_1fr]">
        <section aria-label="My medications">
          <SectionTitle>My medications</SectionTitle>
          <ul className="space-y-2.5">
            {meds.map((m) => {
              const open = mine.find((c) => c.medication.key === m.key && isActive(c))
              return (
                <li key={m.key} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4 shadow-soft">
                  <span className="grid size-10 place-items-center rounded-full bg-muted">
                    <PillIcon className="size-4 text-muted-foreground" strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {m.name} <span className="font-normal text-muted-foreground">{m.strength}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{m.sig}</p>
                  </div>
                  {open ? (
                    <Link href={`/app/patient/cases/${open.id}`} className="flex items-center gap-2">
                      <CaseStatus refill={open} />
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </Link>
                  ) : (
                    <Pill size="sm" variant="primary" onClick={() => actions.requestRefill(m.key)}>
                      Request refill
                    </Pill>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-label="Recent updates">
          <SectionTitle aside={<Link href="/app/patient/notifications" className="text-xs text-muted-foreground hover:text-foreground">View all</Link>}>
            Recent updates
          </SectionTitle>
          {updates.length ? (
            <ul className="divide-y rounded-2xl border bg-card shadow-soft">
              {updates.map((n) => (
                <li key={n.id} className="flex gap-3 p-4">
                  <StatusDot tone={eventTone[n.tone]} className="mt-1.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{relativeTime(n.at, now)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No updates yet.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function ActiveRefill({ refill, compact }: { refill: RefillCase; compact: boolean }) {
  const h = patientHeadline(refill)
  const steps = patientSteps(refill)
  const accent = h.tone === 'green' ? 'from-ok/15' : h.tone === 'amber' ? 'from-warn/15' : h.tone === 'red' ? 'from-risk/12' : 'from-info/12'
  return (
    <section aria-label="Current refill" className="overflow-hidden rounded-3xl border bg-card shadow-soft">
      <div className={cn('bg-gradient-to-br to-transparent p-6 sm:p-8', accent)}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {refill.medication.name} {refill.medication.strength} · {refill.id}
            </p>
            <h2 className="mt-2 text-2xl font-medium tracking-tight text-balance sm:text-3xl" aria-live="polite">
              {h.title}
            </h2>
            <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted-foreground">{h.body}</p>
          </div>
          <CaseStatus refill={refill} />
        </div>
        <CaseActions refill={refill} role="patient" className="mt-5" />
      </div>
      <div className={cn('grid gap-6 border-t p-6 sm:p-8', !compact && '@3xl:grid-cols-[1fr_260px]')}>
        <StepTracker steps={steps} />
        <dl className="grid content-start gap-4 text-sm sm:grid-cols-3 @3xl:grid-cols-1">
          <div>
            <dt className="text-xs text-muted-foreground">Estimated pickup</dt>
            <dd className="mt-0.5 font-medium">{estimatedPickup(refill)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Pharmacy</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
              <MapPin className="size-3.5 text-muted-foreground" /> {refill.pharmacy}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Supply remaining</dt>
            <dd className="mt-1">
              <SupplyMeter days={refill.supplyDaysLeft} total={refill.medication.daysSupply} />
            </dd>
          </div>
        </dl>
      </div>
      <div className="border-t px-6 py-3 sm:px-8">
        <Link href={`/app/patient/cases/${refill.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          View full timeline <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  )
}

export function StepTracker({ steps }: { steps: PatientStep[] }) {
  return (
    <ol className="space-y-0" aria-label="Refill progress">
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex items-center gap-3.5 pb-4 last:pb-0">
          {i < steps.length - 1 && (
            <span
              className={cn('absolute top-5 bottom-0 left-[11px] w-0.5', s.state === 'done' ? 'bg-ok' : 'bg-border')}
              aria-hidden="true"
            />
          )}
          <StepIcon state={s.state} />
          <span
            className={cn(
              'text-sm',
              s.state === 'pending' && 'text-muted-foreground',
              s.state === 'active' && 'font-medium',
              s.state === 'blocked' && 'font-medium text-[oklch(0.52_0.13_65)]',
              s.state === 'error' && 'font-medium text-risk',
            )}
          >
            {s.label}
          </span>
          <span className="sr-only">({s.state})</span>
        </li>
      ))}
    </ol>
  )
}

function StepIcon({ state }: { state: PatientStep['state'] }) {
  const base = 'relative z-10 grid size-6 shrink-0 place-items-center rounded-full'
  if (state === 'done')
    return (
      <span className={cn(base, 'bg-ok text-white')}>
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    )
  if (state === 'blocked')
    return (
      <span className={cn(base, 'bg-warn text-white')}>
        <TriangleAlert className="size-3" strokeWidth={2.6} />
      </span>
    )
  if (state === 'error')
    return (
      <span className={cn(base, 'bg-risk text-white')}>
        <X className="size-3.5" strokeWidth={3} />
      </span>
    )
  if (state === 'active')
    return (
      <span className={cn(base, 'bg-info/15')}>
        <span className="absolute inset-0 rounded-full bg-info/20 animate-ping" />
        <span className="size-2.5 rounded-full bg-info" />
      </span>
    )
  return <span className={cn(base, 'border-2 border-dashed border-border bg-card')} />
}
