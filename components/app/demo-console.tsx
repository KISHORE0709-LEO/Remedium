'use client'

import { ArrowUpRight, Play, RotateCcw, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Logo, Pill } from '@/components/remedium/primitives'
import { analyzeCase, isActive, roleLabel } from '@/lib/remedium/engine'
import { ROLE_META } from '@/lib/remedium/roles'
import { actions, DEMO_PATIENT, useRemedium } from '@/lib/remedium/store'
import { ROLES, type Role } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'
import { LiveToaster } from './live-toaster'
import { RoleDashboard } from './role-views'

const ORDER: Role[] = ['patient', 'pharmacy', 'provider', 'insurance']

export function DemoConsole() {
  const state = useRemedium()
  const demoCase = state?.cases.find((c) => c.patient.name === DEMO_PATIENT.name && c.medication.key === 'metformin' && isActive(c))
  const insight = demoCase ? analyzeCase(demoCase) : null
  const unread = (r: Role) => state?.notifications.filter((n) => n.role === r && !n.read).length ?? 0

  return (
    <div className="min-h-svh bg-[oklch(0.965_0.006_255)]">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
          <Logo />
          <span className="hidden h-5 w-px bg-border sm:block" />
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="size-1.5 rounded-full bg-ok animate-pulse-soft" />
            Live workflow console
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Pill variant="primary" size="sm" onClick={() => actions.requestRefill('metformin')} disabled={!!demoCase}>
              <Play /> Patient requests Metformin refill
            </Pill>
            <Pill size="sm" onClick={() => actions.resetDemo()}>
              <RotateCcw /> Reset
            </Pill>
          </div>
        </div>
        <div className="flex items-center gap-2.5 border-t bg-ai/[0.04] px-4 py-2 text-sm sm:px-6" aria-live="polite">
          <Sparkles className="size-3.5 shrink-0 text-ai" />
          {insight && demoCase ? (
            <p className="min-w-0 truncate">
              <span className="font-mono text-[11px] text-muted-foreground">{demoCase.id}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              {insight.blocker && <span className="font-medium text-risk">{insight.blocker} · </span>}
              Next: <span className="font-medium">{insight.nextAction}</span>
              {insight.owner !== 'none' && insight.owner !== 'remedium' && (
                <span className="text-muted-foreground"> — act in the {roleLabel(insight.owner)} panel</span>
              )}
            </p>
          ) : (
            <p className="text-muted-foreground">
              Start the demo: John Doe requests a Metformin refill. Every panel below updates in real time.
            </p>
          )}
        </div>
      </header>

      <div className="grid gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-2">
        {ORDER.map((role) => {
          const meta = ROLE_META[role]
          const owns = insight?.owner === role
          return (
            <section
              key={role}
              aria-label={`${meta.label} view`}
              className={cn(
                'flex h-[min(78svh,760px)] flex-col overflow-hidden rounded-2xl border bg-background shadow-soft transition-shadow duration-500',
                owns && 'ring-2 ring-ai/40 shadow-lift',
              )}
            >
              <div className="flex items-center gap-3 border-b bg-card px-4 py-2.5">
                <span className={cn('grid size-7 place-items-center rounded-full', owns ? 'bg-ai text-white' : 'bg-foreground text-background')}>
                  <meta.Icon className="size-3.5" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-tight font-medium">{meta.label}</p>
                  <p className="truncate text-[11px] leading-tight text-muted-foreground">{meta.person}</p>
                </div>
                {owns && (
                  <span className="rounded-full bg-ai/10 px-2 py-0.5 font-mono text-[10px] tracking-wider text-ai">YOUR MOVE</span>
                )}
                {unread(role) > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-risk px-1.5 font-mono text-[10px] leading-5 text-white">
                    {unread(role)}
                  </span>
                )}
                <Link
                  href={`/app/${role}`}
                  target="_blank"
                  aria-label={`Open ${meta.label} app in new tab`}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ArrowUpRight className="size-4" />
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                <RoleDashboard role={role} compact />
              </div>
            </section>
          )
        })}
      </div>
      <LiveToaster roles={ROLES} showRole />
    </div>
  )
}
