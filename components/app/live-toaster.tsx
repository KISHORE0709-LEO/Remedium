'use client'

import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { StatusDot } from '@/components/remedium/primitives'
import { roleLabel } from '@/lib/remedium/engine'
import { useRemedium } from '@/lib/remedium/store'
import type { AppNotification, Role } from '@/lib/remedium/types'
import { eventTone } from './timeline'

export function LiveToaster({ roles, showRole = false }: { roles: Role[]; showRole?: boolean }) {
  const state = useRemedium()
  const seen = useRef<Set<string> | null>(null)
  const [toasts, setToasts] = useState<AppNotification[]>([])
  const rolesKey = roles.join(',')

  useEffect(() => {
    if (!state) return
    const relevant = state.notifications.filter((n) => rolesKey.split(',').includes(n.role))
    if (!seen.current) {
      seen.current = new Set(relevant.map((n) => n.id))
      return
    }
    const fresh = relevant.filter((n) => !seen.current!.has(n.id))
    if (!fresh.length) return
    for (const n of fresh) seen.current.add(n.id)
    setToasts((t) => [...fresh.reverse(), ...t].slice(0, 4))
    const ids = fresh.map((n) => n.id)
    window.setTimeout(() => setToasts((t) => t.filter((x) => !ids.includes(x.id))), 5200)
  }, [state, rolesKey])

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="glass pointer-events-auto flex items-start gap-3 rounded-2xl border border-foreground/[0.08] p-3.5 shadow-lift animate-pop"
        >
          <StatusDot tone={eventTone[t.tone]} pulse className="mt-1.5" />
          <div className="min-w-0 flex-1">
            {showRole && (
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{roleLabel(t.role)}</p>
            )}
            <p className="text-sm font-medium">{t.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t.body}</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
