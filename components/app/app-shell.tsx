'use client'

import { ChevronDown, LogOut, MonitorSmartphone, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Logo } from '@/components/remedium/primitives'
import { ROLE_META } from '@/lib/remedium/roles'
import { actions, useRemedium } from '@/lib/remedium/store'
import { ROLES, type Role } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'
import { LiveToaster } from './live-toaster'

export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const pathname = usePathname()
  const state = useRemedium()
  const unread = state?.notifications.filter((n) => n.role === role && !n.read).length ?? 0
  const base = `/app/${role}`
  const nav = [
    { href: base, label: 'Dashboard' },
    { href: `${base}/refills`, label: 'Refills' },
    { href: `${base}/timeline`, label: 'Timeline' },
    { href: `${base}/notifications`, label: 'Notifications', count: unread },
  ]

  return (
    <div className="min-h-svh bg-[linear-gradient(180deg,oklch(0.985_0.004_255),oklch(0.975_0.006_255))]">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Logo href={base} />
          <nav aria-label="Workspace" className="mx-auto hidden md:block">
            <ul className="flex items-center gap-1 rounded-full border bg-white/70 p-1 shadow-soft">
              {nav.map((item) => (
                <NavItem key={item.href} {...item} active={isActive(pathname, item.href, base)} />
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <span className="hidden items-center gap-1.5 rounded-full border bg-white/70 px-2.5 py-1 font-mono text-[10px] tracking-widest text-muted-foreground lg:inline-flex">
              <span className="size-1.5 rounded-full bg-ok animate-pulse-soft" /> LIVE
            </span>
            <RoleMenu role={role} />
          </div>
        </div>
        <nav aria-label="Workspace" className="overflow-x-auto border-t px-4 py-2 md:hidden">
          <ul className="flex w-max items-center gap-1">
            {nav.map((item) => (
              <NavItem key={item.href} {...item} active={isActive(pathname, item.href, base)} />
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <LiveToaster roles={[role]} />
    </div>
  )
}

function isActive(pathname: string, href: string, base: string) {
  if (href === base) return pathname === base || pathname.startsWith(`${base}/cases`)
  return pathname.startsWith(href)
}

function NavItem({ href, label, count, active }: { href: string; label: string; count?: number; active: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors',
          active ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {label}
        {!!count && (
          <span
            className={cn(
              'grid min-w-[18px] place-items-center rounded-full px-1 font-mono text-[10px] leading-[18px]',
              active ? 'bg-background text-foreground' : 'bg-risk text-white',
            )}
          >
            {count}
          </span>
        )}
      </Link>
    </li>
  )
}

function RoleMenu({ role }: { role: Role }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const meta = ROLE_META[role]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border bg-white py-1 pr-3 pl-1 shadow-soft transition-colors hover:border-foreground/20"
      >
        <span className="grid size-7 place-items-center rounded-full bg-foreground text-background">
          <meta.Icon className="size-3.5" strokeWidth={1.8} />
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] leading-tight font-medium">{meta.person}</span>
          <span className="block text-[11px] leading-tight text-muted-foreground">{meta.label}</span>
        </span>
        <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border bg-popover p-1.5 shadow-lift animate-pop"
        >
          <p className="px-3 pt-2 pb-1 font-mono text-[10px] tracking-widest text-muted-foreground">SWITCH ROLE</p>
          {ROLES.map((r) => {
            const m = ROLE_META[r]
            return (
              <Link
                key={r}
                role="menuitem"
                href={`/app/${r}`}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-muted',
                  r === role && 'bg-muted',
                )}
              >
                <m.Icon className="size-4 text-muted-foreground" strokeWidth={1.7} />
                <span className="flex-1">{m.label}</span>
                {r === role && <span className="size-1.5 rounded-full bg-ok" />}
              </Link>
            )
          })}
          <div className="my-1.5 h-px bg-border" />
          <Link role="menuitem" href="/demo" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-muted">
            <MonitorSmartphone className="size-4 text-muted-foreground" strokeWidth={1.7} /> Live demo console
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              actions.resetDemo()
              setOpen(false)
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-muted"
          >
            <RotateCcw className="size-4 text-muted-foreground" strokeWidth={1.7} /> Reset demo data
          </button>
          <Link role="menuitem" href="/login" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-muted">
            <LogOut className="size-4 text-muted-foreground" strokeWidth={1.7} /> Sign out
          </Link>
        </div>
      )}
    </div>
  )
}
