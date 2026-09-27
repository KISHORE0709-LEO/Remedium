'use client'

import { ArrowLeft, ArrowRight, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Pill, StatusDot } from '@/components/remedium/primitives'
import { analyzeCase, formatTime, isActive, patientHeadline, relativeTime, roleLabel } from '@/lib/remedium/engine'
import { subscribeToWorkflowEvents } from '@/lib/remedium/firestore-service'
import { actions, useRemedium } from '@/lib/remedium/store'
import type { Role, TimelineEvent } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'
import { AiAnalysis } from './ai-analysis'
import { CaseActions } from './case-actions'
import { useCasesForRole, useNow } from './hooks'
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
  // ↓ Hook called unconditionally at top level — before any early return
  const all = sortQueue(useCasesForRole(state?.cases ?? [], role))
  if (!state) return <LoadingBlock />
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
  const [liveEvents, setLiveEvents] = useState<(TimelineEvent & { refillId: string })[]>([])
  // ↓ Hook called unconditionally at top level — before any early return
  const cases = useCasesForRole(state?.cases ?? [], role)

  useEffect(() => {
    const unsub = subscribeToWorkflowEvents((events) => {
      setLiveEvents(events)
    })
    return () => unsub()
  }, [])

  if (!state) return <LoadingBlock />
  const caseMap = new Map(cases.map((c) => [c.id, c]))

  const events = (
    liveEvents.length > 0
      ? liveEvents
          .map((e) => {
            const refill = caseMap.get(e.refillId)
            return refill ? { ...e, refill } : null
          })
          .filter((e): e is NonNullable<typeof e> => e !== null)
      : cases.flatMap((c) => c.events.map((e) => ({ ...e, refill: c })))
  )
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
                {(e.action || e.previousState || e.newState) && (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {e.action ? `${e.action} · ` : ''}
                    {e.previousState && e.newState ? `${e.previousState} → ${e.newState}` : ''}
                  </p>
                )}
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
              <Link
                href={`/app/${role}/cases/${n.caseId}`}
                className={cn('flex gap-3.5 px-5 py-4 transition-colors hover:bg-muted/40', !n.read && 'bg-info/[0.03]')}
                onClick={() => {
                  // Mark this specific notification read in Firestore immediately on click.
                  // The onSnapshot listener will propagate the change back so the unread
                  // badge and bold styling update in real time and persist after refresh.
                  if (!n.read) {
                    actions.markNotificationRead(n.id).catch(() => {})
                  }
                }}
              >
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
  const markedRef = useRef(false)

  // Mark unread notifications for this case as read on mount
  useEffect(() => {
    if (!state || markedRef.current) return
    const unread = state.notifications.filter(
      (n) => n.caseId === caseId && n.role === role && !n.read,
    )
    if (!unread.length) return
    markedRef.current = true
    unread.forEach((n) => actions.markNotificationRead(n.id).catch(() => {}))
  }, [state, caseId, role])

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
  const ai = c.aiAnalysis ?? null
  const insight = analyzeCase(c)

  // Waiting time
  const waitingMs = now - (c.statusSince ?? c.createdAt)
  const waitingHours = Math.floor(waitingMs / 3_600_000)
  const waitingLabel =
    waitingHours < 1 ? 'Just updated' :
    waitingHours < 24 ? `Waiting ${waitingHours}h` :
    `Waiting ${Math.floor(waitingHours / 24)}d ${waitingHours % 24}h`

  // Priority colour
  const priorityStyle: Record<string, string> = {
    urgent: 'bg-risk/10 text-risk border-risk/30',
    high:   'bg-warn/10 text-warn border-warn/30',
    standard: 'bg-muted text-muted-foreground border-border',
    low:    'bg-muted text-muted-foreground border-border',
  }
  const aiPriority = ai?.priority ?? (c.urgent ? 'urgent' : 'standard')
  const aiConfidencePct = ai ? Math.round(ai.confidence * 100) : null
  const humanReviewRequired = ai?.requiresHumanReview ?? false

  if (isPatient) {
    // Patient view — simple progress + timeline (unchanged)
    return (
      <div className="@container space-y-6">
        <Link href={`/app/${role}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back
        </Link>
        <PageHeader
          eyebrow={`${c.id} · Opened ${relativeTime(c.createdAt, now)}`}
          title={<>{c.medication.name} <span className="text-muted-foreground">{c.medication.strength}</span></>}
          description={patientHeadline(c).body}
          actions={<CaseStatus refill={c} />}
        />
        <CaseActions refill={c} role={role} />
        <section className="rounded-2xl border bg-card p-6 shadow-soft">
          <h2 className="mb-4 text-sm font-medium">Progress</h2>
          <StepTracker steps={patientSteps(c)} />
        </section>
        <section className="rounded-2xl border bg-card p-6 shadow-soft">
          <h2 className="mb-5 text-sm font-medium">Case timeline</h2>
          <Timeline refill={{ ...c, events: c.events.filter((e) => e.tone !== 'info') }} showActors={false} />
        </section>
      </div>
    )
  }

  // ── Professional view (provider / pharmacy / insurance) ───────────────────
  return (
    <div className="@container space-y-5">
      {/* Back link */}
      <Link href={`/app/${role}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to dashboard
      </Link>

      {/* ── 1. Case header — ID · medication · patient · status · waiting ── */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-muted-foreground">{c.id} · opened {relativeTime(c.createdAt, now)}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {c.medication.name}{' '}
              <span className="text-muted-foreground font-normal">{c.medication.strength}</span>
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {c.patient.name} · {c.prescriber} · {c.pharmacy}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <CaseStatus refill={c} />
            <span className="rounded-full border border-border bg-muted px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              {waitingLabel}
            </span>
            <span className={cn('rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold capitalize', priorityStyle[aiPriority])}>
              {aiPriority}
            </span>
          </div>
        </div>

        {/* Supply bar */}
        <div className="mt-3 flex items-center gap-3">
          <SupplyMeter days={c.supplyDaysLeft} total={c.medication.daysSupply} />
          <span className="text-xs text-muted-foreground">
            {c.supplyDaysLeft} day{c.supplyDaysLeft === 1 ? '' : 's'} of supply remaining
          </span>
        </div>
      </div>

      {/* ── 2. Blocker callout — most prominent if stuck ── */}
      {(c.blocker || ai?.stuckReason) && (
        <div className="rounded-2xl border border-risk/30 bg-risk/[0.05] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-risk/10 text-risk">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </span>
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-risk">
                Current Blocker
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{c.blocker ?? ai?.stuckReason}</p>
              {ai?.stuckReason && c.blocker && ai.stuckReason !== c.blocker && (
                <p className="mt-1 text-xs text-muted-foreground">{ai.stuckReason}</p>
              )}
              {c.waitingFor && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Waiting on: <span className="font-medium text-foreground">{c.waitingFor}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Human review required — if flagged, show prominently ── */}
      {humanReviewRequired && (
        <div className="rounded-2xl border border-risk/30 bg-risk/[0.05] px-4 py-3 flex items-center gap-2.5">
          <svg className="size-4 shrink-0 text-risk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <div>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-risk">Human Review Required</span>
            <p className="text-xs text-foreground">AI confidence is low or data is conflicting. A human must review before this case can advance.</p>
          </div>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1fr)_360px]">

        {/* ── Left column ── */}
        <div className="space-y-5">

          {/* ── 3. AI RECOMMENDATION ZONE ── */}
          <section
            aria-label="Remedium AI recommendation"
            className="overflow-hidden rounded-2xl border border-ai/25 bg-[linear-gradient(135deg,oklch(0.97_0.02_292),oklch(0.985_0.01_255))] shadow-soft"
          >
            {/* Zone header */}
            <div className="flex items-center justify-between gap-3 border-b border-ai/15 px-5 py-3">
              <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ai">
                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2l2.09 6.26L21 9.27l-5 4.87 1.18 6.88L12 17.77l-5.18 3.25L8 14.14 3 9.27l6.91-1.01L12 2z"/></svg>
                Remedium AI — Recommendation only
              </p>
              <div className="flex items-center gap-2">
                {aiConfidencePct !== null && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    confidence {aiConfidencePct}%
                  </span>
                )}
                <span className={cn('rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold capitalize', priorityStyle[aiPriority])}>
                  {aiPriority}
                </span>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {/* 9 — AI Summary */}
              {(ai?.summary || insight.summary) && (
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Summary</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">{ai?.summary ?? insight.summary}</p>
                </div>
              )}

              {/* 8 — Why stuck */}
              {ai?.stuckReason && (
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Why it&apos;s stuck</p>
                  <p className="mt-1 text-sm text-foreground">{ai.stuckReason}</p>
                </div>
              )}

              {/* 10 + 11 — Next action + Priority reason */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-ai/15 bg-white/50 px-3 py-2.5">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recommended Next Action</p>
                  <p className="mt-1 text-xs font-medium text-foreground leading-snug">{ai?.nextAction ?? insight.nextAction}</p>
                </div>
                <div className="rounded-xl border border-ai/15 bg-white/50 px-3 py-2.5">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Priority Reason</p>
                  <p className="mt-1 text-xs text-foreground leading-snug">{ai?.priorityReason ?? `${aiPriority} priority`}</p>
                </div>
              </div>

              {/* Missing fields */}
              {(ai?.missingFields ?? []).length > 0 && (
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Missing Information</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {(ai?.missingFields ?? []).map((f) => (
                      <li key={f} className="rounded-full border border-warn/20 bg-warn/[0.07] px-2.5 py-0.5 text-[11px] text-warn">{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 12 + 13 — Draft message + Confidence — rendered via AiAnalysis (has edit/approve) */}
              {ai && <AiAnalysis refill={c} role={role} compact={false} className="mt-0 border-0 bg-transparent p-0 shadow-none" />}
            </div>

            {/* AI disclaimer footer */}
            <div className="border-t border-ai/15 px-5 py-2.5">
              <p className="text-[11px] text-muted-foreground">
                AI outputs are advisory only. Clinical decisions are always made by licensed providers, pharmacists, and insurers.
              </p>
            </div>
          </section>

          {/* ── 4 (15). HUMAN ACTIONS ZONE ── */}
          {(() => {
            const hasActions =
              (role === 'provider' && c.status === 'WAITING_FOR_PROVIDER') ||
              (role === 'insurance' && c.status === 'WAITING_FOR_INSURANCE') ||
              (role === 'pharmacy') ||
              (role === 'patient' && (c.blockReason === 'visit_required' || c.status === 'READY_FOR_PICKUP'))
            if (!hasActions) return null
            return (
              <section aria-label="Human actions" className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-foreground text-background">
                    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </span>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
                    Your Decision — actions write to the audit trail
                  </p>
                </div>
                <CaseActions refill={c} role={role} />
              </section>
            )
          })()}

          {/* ── 16. Complete Activity Timeline ── */}
          <section className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6">
            <h2 className="mb-5 text-sm font-semibold text-foreground">Activity Timeline</h2>
            <Timeline refill={c} showActors />
          </section>
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-5">

          {/* ── 1–4: Patient / Medication / Pharmacy / Provider ── */}
          <section className="rounded-2xl border bg-card p-5 shadow-soft">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Case Details</h2>
            <dl className="space-y-3 text-sm">
              {([
                ['Patient',   `${c.patient.name} · DOB ${c.patient.dob}`],
                ['MRN',       c.patient.mrn],
                ['Phone',     c.patient.phone],
                ['Allergies', c.patient.allergies],
                ['Medication',`${c.medication.name} ${c.medication.strength}`],
                ['Directions',c.medication.sig],
                ['Quantity',  `${c.medication.quantity} · ${c.medication.daysSupply}-day supply`],
                ['Refills',   `${c.medication.refillsRemaining} remaining`],
                ['Pharmacy',  c.pharmacy],
                ['Provider',  c.prescriber],
                ['Plan',      c.plan],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="shrink-0 text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium text-foreground truncate max-w-[55%]">{v}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 pt-1">
                <dt className="text-muted-foreground">Supply</dt>
                <dd><SupplyMeter days={c.supplyDaysLeft} total={c.medication.daysSupply} /></dd>
              </div>
            </dl>
          </section>

          {/* ── 5–7: Status / Blocker / Waiting ── */}
          <section className="rounded-2xl border bg-card p-5 shadow-soft">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Workflow State</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Status</dt>
                <dd><CaseStatus refill={c} /></dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Waiting</dt>
                <dd className="font-medium text-foreground font-mono text-xs">{waitingLabel}</dd>
              </div>
              {c.waitingFor && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Waiting on</dt>
                  <dd className="text-right font-medium text-foreground">{c.waitingFor}</dd>
                </div>
              )}
              {c.blocker && (
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-muted-foreground">Blocker</dt>
                  <dd className="text-right text-xs font-medium text-risk max-w-[55%]">{c.blocker}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">AI Priority</dt>
                <dd>
                  <span className={cn('rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold capitalize', priorityStyle[aiPriority])}>
                    {aiPriority}
                  </span>
                </dd>
              </div>
              {aiConfidencePct !== null && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">AI Confidence</dt>
                  <dd className="font-mono text-xs font-medium text-foreground">{aiConfidencePct}%</dd>
                </div>
              )}
              {humanReviewRequired && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Human Review</dt>
                  <dd className="font-mono text-[11px] font-semibold text-risk uppercase">Required</dd>
                </div>
              )}
            </dl>
          </section>

          {/* WhyStuck — existing component */}
          <WhyStuck refill={c} now={now} />
        </div>
      </div>
    </div>
  )
}
