'use client'

import { Check, Sparkles, TriangleAlert, X } from 'lucide-react'
import { formatTime, roleLabel, upcomingEvents, type Tone } from '@/lib/remedium/engine'
import type { EventTone, RefillCase } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'

export const eventTone: Record<EventTone, Tone> = {
  done: 'green',
  warning: 'amber',
  active: 'blue',
  error: 'red',
  info: 'violet',
}

function Dot({ tone, latest }: { tone: EventTone; latest: boolean }) {
  const base = 'relative z-10 grid size-[18px] shrink-0 place-items-center rounded-full border-2 border-card'
  if (tone === 'done')
    return (
      <span className={cn(base, 'bg-ok text-white')}>
        <Check className="size-2.5" strokeWidth={3.5} />
      </span>
    )
  if (tone === 'warning')
    return (
      <span className={cn(base, 'bg-warn text-white')}>
        <TriangleAlert className="size-2.5" strokeWidth={3} />
      </span>
    )
  if (tone === 'error')
    return (
      <span className={cn(base, 'bg-risk text-white')}>
        <X className="size-2.5" strokeWidth={3.5} />
      </span>
    )
  if (tone === 'info')
    return (
      <span className={cn(base, 'bg-ai text-white')}>
        <Sparkles className="size-2.5" strokeWidth={2.5} />
      </span>
    )
  return (
    <span className={cn(base, 'bg-info/15')}>
      <span className={cn('size-2 rounded-full bg-info', latest && 'animate-pulse-soft')} />
    </span>
  )
}

export function Timeline({
  refill,
  showUpcoming = true,
  showActors = true,
  className,
}: {
  refill: RefillCase
  showUpcoming?: boolean
  showActors?: boolean
  className?: string
}) {
  const upcoming = showUpcoming ? upcomingEvents(refill) : []
  const events = refill.events
  return (
    <ol className={cn('relative space-y-0', className)} aria-label={`Timeline for ${refill.id}`}>
      {events.map((e, i) => {
        const latest = i === events.length - 1
        const isLast = latest && upcoming.length === 0
        return (
          <li key={e.id} className={cn('relative flex gap-3.5 pb-5', latest && 'animate-fade-up')}>
            {!isLast && <span className="absolute top-4 bottom-0 left-[8.5px] w-px bg-border" aria-hidden="true" />}
            <Dot tone={e.tone} latest={latest} />
            <div className="-mt-0.5 min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className={cn('text-sm font-medium', latest && 'text-foreground')}>{e.label}</p>
                <time className="font-mono text-[11px] text-muted-foreground" dateTime={new Date(e.at).toISOString()}>
                  {formatTime(e.at)}
                </time>
              </div>
              {(e.detail || showActors) && (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {showActors && (
                    <span className={cn('mr-1.5 font-mono text-[10px] uppercase tracking-wider', e.actor === 'remedium' && 'text-ai')}>
                      {roleLabel(e.actor)}
                    </span>
                  )}
                  {e.detail}
                </p>
              )}
            </div>
          </li>
        )
      })}
      {upcoming.map((label, i) => (
        <li key={label} className="relative flex gap-3.5 pb-5 last:pb-0">
          {i < upcoming.length - 1 && (
            <span className="absolute top-4 bottom-0 left-[8.5px] w-px border-l border-dashed" aria-hidden="true" />
          )}
          <span className="relative z-10 size-[18px] shrink-0 rounded-full border-2 border-dashed border-border bg-card" />
          <p className="-mt-0.5 text-sm text-muted-foreground">{label}</p>
        </li>
      ))}
    </ol>
  )
}
