'use client'

import { ArrowLeft, ArrowRight, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Pill, StatusDot } from '@/components/remedium/primitives'
import { analyzeCase, formatTime, isActive, patientHeadline, relativeTime, roleLabel } from '@/lib/remedium/engine'
import { actions, useRemedium } from '@/lib/remedium/store'
import type { Role } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'
import { AiAnalysis } from './ai-analysis'
import { CaseActions } from './case-actions'
import { casesForRole, useNow } from './hooks'
import { InsuranceDashboard } from './insurance-dashboard'
import { PatientDashboard, StepTracker } from './patient-dashboard'
import { PharmacyDashboard, sortQueue } from './pharmacy-dashboard'
import { ProviderDashboard } from './provider-dashboard'
import { eventTone, Timeline } from './timeline'
import { CaseStatus, EmptyState, LoadingBlock, PageHeader, SupplyMeter, WhyStuck } from './ui-bits'
import { patientSteps } from '@/lib/remedium/engine'

export function RoleDashboard({ role, compact = false }: { role: Role; compact?: boolean }) {
  if (role === 'patient') return <PatientDashboard compact={compact} />
  if (role === 'pharmacy') return <PharmacyDashboard compact={compact} />
  if (role === 'provider') return <ProviderDashboard compact={compact} />
  return <InsuranceDashboard compact={compact} />
}

type Filter = 'active' | 'all' | 'closed'

export function RefillsList({ role }: { role: Role }) {
  const state = useRemedium()
  const [filter, setFilter] = useState<Filter>('active')
  if (!state) return <LoadingBlock />
  const all = sortQueue(casesForRole(state, role))
  const list = all.filter((c) => (filter === 'all' ? true : filter === 'active' ? isActive(c) : !isActive(c)))
  const counts = { active: all.filter(isActive).length, all: all.length, closed: all.filter((c) => !isActive(c)).length }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={roleLabel(role)} title="Refills" description="Every refill case you're part of, updated in real time." />
      <div role="tablist" aria-label="Filter refills" className="inline-flex rounded-full border bg-card p-1 shadow-soft">
        {(['active', 'all', 'closed'] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            type="button"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'h-8 rounded-full px-4 text-[13px] font-medium capitalize transition-colors',
              filter === f ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f} <span className="ml-1 font-mono text-[10px] opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState title="Nothing here" body="Cases will appear as they move through the workflow." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-soft">
          {list.map((c) => {
            const i = analyzeCase(c)
            const line = role === 'patient' ? patientHeadline(c).title : (i.blocker ?? i.actionRequired)
            return (
              <li key={c.id}>
                <Link href={`/app/${role}/cases/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="text-sm font-medium">
                      {c.medication.name} {c.medication.strength}
                      {role !== 'patient' && <span className="font-normal text-muted-foreground"> · {c.patient.name}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">{c.id}</span> · {line}
                    </p>
                  </div>
                  <SupplyMeter days={c.supplyDaysLeft} total={c.medication.daysSupply} />
                  <CaseStatus refill={c} />
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function ActivityFeed({ role }: { role: Role }) {
  const state = useRemedium()
  const now = useNow()
  if (!state) return <LoadingBlock />
  const events = casesForRole(state, role)
    .flatMap((c) => c.events.map((e) => ({ ...e, refill: c })))
    .filter((e) => role !== 'patient' || e.tone !== 'info')
    .sort((a, b) => b.at - a.at)
    .slice(0, 60)

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={roleLabel(role)} title="Timeline" description="A live audit trail of every step across your refills." />
      {events.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <ol className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
          {events.map((e, i) => (
            <li key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
              {i < events.length - 1 && <span className="absolute top-3 bottom-0 left-[3.5px] w-px bg-border" aria-hidden="true" />}
              <StatusDot tone={eventTone[e.tone]} className="mt-1.5" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-medium">{e.label}</p>
                  <time className="font-mono text-[11px] text-muted-foreground">
                    {relativeTime(e.at, now)} · {formatTime(e.at)}
                  </time>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <Link href={`/app/${role}/cases/${e.refill.id}`} className="font-mono hover:text-foreground">
                    {e.refill.id}
                  </Link>{' '}
                  · {e.refill.medication.name}
                  {role !== 'patient' && ` · ${e.refill.patient.name}`}
                  <span className={cn('ml-2 font-mono text-[10px] tracking-wider uppercase', e.actor === 'remedium' && 'text-ai')}>
                    {roleLabel(e.actor)}
                  </span>
                </p>
                {e.detail && <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function NotificationsList({ role }: { role: Role }) {
  const state = useRemedium()
  const now = useNow()
  if (!state) return <LoadingBlock />
  const list = state.notifications.filter((n) => n.role === role)
  const unread = list.filter((n) => !n.read).length
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={roleLabel(role)}
        title="Notifications"
        description={unread ? `${unread} unread` : 'You are all caught up'}
        actions={
          unread > 0 && (
            <Pill size="sm" onClick={() => actions.markAllRead(role)}>
              <CheckCheck /> Mark all read
            </Pill>
          )
        }
      />
      {list.length === 0 ? (
        <EmptyState title="No notifications" body="You'll be notified the moment a refill needs you." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-soft">
          {list.map((n) => (
            <li key={n.id}>
              <Link href={`/app/${role}/cases/${n.caseId}`} className={cn('flex gap-3.5 px-5 py-4 transition-colors hover:bg-muted/40', !n.read && 'bg-info/[0.03]')}>
                <StatusDot tone={eventTone[n.tone]} pulse={!n.read} className="mt-1.5" />
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm', !n.read ? 'font-medium' : 'text-muted-foreground')}>{n.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                </div>
                <span className="font-mono text-[10px] whitespace-nowrap text-muted-foreground">{relativeTime(n.at, now)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function CaseDetail({ role, caseId }: { role: Role; caseId: string }) {
  const state = useRemedium()
  const now = useNow()
  if (!state) return <LoadingBlock />
  const c = state.cases.find((x) => x.id === caseId)
  if (!c) {
    return (
      <EmptyState title="Case not found" body="This refill may have been reset. Return to your dashboard.">
        <Link href={`/app/${role}`} className="text-sm underline underline-offset-4">
          Back to dashboard
        </Link>
      </EmptyState>
    )
  }
  const isPatient = role === 'patient'
  const h = patientHeadline(c)

  return (
    <div className="@container space-y-6">
      <Link href={`/app/${role}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back
      </Link>
      <PageHeader
        eyebrow={`${c.id} · Opened ${relativeTime(c.createdAt, now)}`}
        title={
          <>
            {c.medication.name} <span className="text-muted-foreground">{c.medication.strength}</span>
          </>
        }
        description={isPatient ? h.body : `${c.patient.name} · ${c.prescriber} · ${c.pharmacy}`}
        actions={<CaseStatus refill={c} />}
      />
      <CaseActions refill={c} role={role} />

      <div className="grid gap-6 @4xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {!isPatient && <AiAnalysis refill={c} />}
          {isPatient && (
            <section className="rounded-2xl border bg-card p-6 shadow-soft">
              <h2 className="mb-4 text-sm font-medium">Progress</h2>
              <StepTracker steps={patientSteps(c)} />
            </section>
          )}
          <section className="rounded-2xl border bg-card p-6 shadow-soft">
            <h2 className="mb-5 text-sm font-medium">Case timeline</h2>
            <Timeline refill={isPatient ? { ...c, events: c.events.filter((e) => e.tone !== 'info') } : c} showActors={!isPatient} />
          </section>
        </div>
        <div className="space-y-6">
          {!isPatient && <WhyStuck refill={c} now={now} />}
          <section className="rounded-2xl border bg-card p-5 shadow-soft">
            <h2 className="text-sm font-medium">Details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {(
                [
                  ['Patient', `${c.patient.name} · DOB ${c.patient.dob}`],
                  ['Directions', c.medication.sig],
                  ['Quantity', `${c.medication.quantity} · ${c.medication.daysSupply}-day supply`],
                  ['Prescriber', c.prescriber],
                  ['Pharmacy', c.pharmacy],
                  ['Plan', c.plan],
                  ...(isPatient ? [] : [['Refills remaining', String(c.medication.refillsRemaining)] as [string, string]]),
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Supply</dt>
                <dd>
                  <SupplyMeter days={c.supplyDaysLeft} total={c.medication.daysSupply} />
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}
