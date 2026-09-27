'use client'

import {
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Pill as PillIcon,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  TimerIcon,
  User,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { Logo, LogoMark } from '@/components/remedium/primitives'
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
  const meta = ROLE_META[role]

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // Workspace items
  const workspaceNav = [
    { href: base, label: 'Dashboard', Icon: LayoutDashboard },
    { href: `${base}/refills`, label: 'Refills', Icon: RefreshCcw },
    { href: `${base}/timeline`, label: 'Timeline', Icon: TimerIcon },
    { href: `${base}/notifications`, label: 'Notifications', Icon: Bell, count: unread },
  ]

  // Website items
  const websiteNav = [
    { href: '/', label: 'Home Page', Icon: Home },
    { href: '/#how-it-works', label: 'How It Works', Icon: ExternalLink },
    { href: '/#for-practices', label: 'For Practices', Icon: ExternalLink },
    { href: '/#for-pharmacies', label: 'For Pharmacies', Icon: ExternalLink },
  ]

  function isActive(href: string) {
    if (href === base) return pathname === base || pathname.startsWith(`${base}/cases`)
    return pathname.startsWith(href)
  }

  // Get current section label for breadcrumb
  const currentSection =
    workspaceNav.find((item) => isActive(item.href))?.label ||
    (pathname.includes('/cases') ? 'Case Details' : 'Workspace')

  return (
    <div className="flex min-h-svh bg-[#f9fafc]">
      {/* ── Left Sidebar (Desktop) ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden md:flex flex-col border-r border-neutral-200/80 bg-white shadow-sm transition-all duration-300 ease-in-out',
          sidebarOpen ? 'w-64' : 'w-0 -translate-x-full overflow-hidden border-none',
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b border-neutral-100 px-4">
          <Logo href={base} />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="grid size-8 place-items-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>

        {/* Current Active Role Badge */}
        <div className="p-3 border-b border-neutral-100">
          <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-neutral-50 p-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-black text-white shadow-sm">
              <meta.Icon className="size-4" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-neutral-900 leading-tight">{meta.person}</p>
              <p className="truncate font-mono text-[10px] tracking-wider text-neutral-500 uppercase">{meta.label}</p>
            </div>
          </div>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-6">
          {/* Group 1: Workspace Items */}
          <div>
            <p className="px-2 mb-1.5 font-mono text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
              Workspace
            </p>
            <ul className="space-y-1">
              {workspaceNav.map((item) => {
                const active = isActive(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150',
                        active
                          ? 'border border-black bg-black text-white shadow-sm'
                          : 'text-neutral-600 hover:bg-neutral-100 hover:text-black',
                      )}
                    >
                      <item.Icon className={cn('size-4 shrink-0', active ? 'text-white' : 'text-neutral-500')} />
                      <span className="flex-1">{item.label}</span>
                      {!!item.count && (
                        <span
                          className={cn(
                            'grid min-w-[20px] place-items-center rounded-full px-1.5 font-mono text-[10px] leading-5',
                            active ? 'bg-white text-black' : 'bg-red-500 text-white',
                          )}
                        >
                          {item.count}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Group 2: Website Pages */}
          <div>
            <p className="px-2 mb-1.5 font-mono text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
              Website Pages
            </p>
            <ul className="space-y-1">
              {websiteNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-black"
                  >
                    <item.Icon className="size-4 shrink-0 text-neutral-400" />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Group 3: Switch Role */}
          <div>
            <p className="px-2 mb-1.5 font-mono text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
              Switch Role
            </p>
            <ul className="space-y-1">
              {ROLES.map((r) => {
                const m = ROLE_META[r]
                const current = r === role
                return (
                  <li key={r}>
                    <Link
                      href={`/app/${r}`}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-1.5 text-[12.5px] transition-colors',
                        current
                          ? 'bg-neutral-100 font-semibold text-black border border-neutral-300'
                          : 'text-neutral-600 hover:bg-neutral-50 hover:text-black',
                      )}
                    >
                      <m.Icon className="size-3.5 text-neutral-500" />
                      <span className="flex-1">{m.label}</span>
                      {current && <span className="size-1.5 rounded-full bg-emerald-500" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="border-t border-neutral-100 p-3 space-y-1 bg-neutral-50/50">
          <div className="flex items-center justify-between px-2 py-1 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5 font-mono text-[10px]">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              SIMULATION LIVE
            </span>
          </div>

          <button
            type="button"
            onClick={() => actions.resetDemo()}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-200/60 hover:text-black"
          >
            <RotateCcw className="size-3.5" />
            Reset demo data
          </button>

          <Link
            href="/login"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-200/60 hover:text-black"
          >
            <LogOut className="size-3.5" />
            Sign out
          </Link>
        </div>
      </aside>

      {/* ── Mobile Sidebar Overlay Drawer ── */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden animate-fade-in"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out md:hidden',
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Logo href={base} />
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            className="grid size-8 place-items-center rounded-lg border border-neutral-200 text-neutral-500"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-3 border-b">
          <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-neutral-50 p-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-black text-white">
              <meta.Icon className="size-4" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-neutral-900">{meta.person}</p>
              <p className="truncate font-mono text-[10px] tracking-wider text-neutral-500 uppercase">{meta.label}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          <div>
            <p className="px-2 mb-1.5 font-mono text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
              Workspace
            </p>
            <ul className="space-y-1">
              {workspaceNav.map((item) => {
                const active = isActive(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors',
                        active ? 'bg-black text-white' : 'text-neutral-700 hover:bg-neutral-100',
                      )}
                    >
                      <item.Icon className="size-4" />
                      <span className="flex-1">{item.label}</span>
                      {!!item.count && (
                        <span className="rounded-full bg-red-500 px-1.5 font-mono text-[10px] text-white">
                          {item.count}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <p className="px-2 mb-1.5 font-mono text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
              Website Pages
            </p>
            <ul className="space-y-1">
              {websiteNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileDrawerOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-neutral-700 hover:bg-neutral-100"
                  >
                    <item.Icon className="size-4 text-neutral-400" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="px-2 mb-1.5 font-mono text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
              Switch Role
            </p>
            <ul className="space-y-1">
              {ROLES.map((r) => {
                const m = ROLE_META[r]
                return (
                  <li key={r}>
                    <Link
                      href={`/app/${r}`}
                      onClick={() => setMobileDrawerOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100"
                    >
                      <m.Icon className="size-3.5 text-neutral-500" />
                      <span>{m.label}</span>
                      {r === role && <span className="ml-auto size-1.5 rounded-full bg-emerald-500" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <div className="border-t p-3 space-y-1 bg-neutral-50">
          <button
            type="button"
            onClick={() => {
              actions.resetDemo()
              setMobileDrawerOpen(false)
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-200/60"
          >
            <RotateCcw className="size-3.5" />
            Reset demo data
          </button>
          <Link
            href="/login"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-200/60"
          >
            <LogOut className="size-3.5" />
            Sign out
          </Link>
        </div>
      </aside>

      {/* ── Main Layout Area ── */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out',
          sidebarOpen ? 'md:pl-64' : 'md:pl-0',
        )}
      >
        {/* Top Control Bar — clean, minimal, houses the sidebar toggle button */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200/80 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            {/* Desktop Toggle Button */}
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="hidden md:inline-flex items-center gap-2 rounded-lg border border-black/20 bg-neutral-50 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-black hover:bg-white hover:text-black shadow-sm"
              title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              {sidebarOpen ? (
                <>
                  <PanelLeftClose className="size-4" />
                  <span>Hide Sidebar</span>
                </>
              ) : (
                <>
                  <PanelLeftOpen className="size-4" />
                  <span>Open Sidebar</span>
                </>
              )}
            </button>

            {/* Mobile Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="grid size-8 place-items-center rounded-lg border border-black/20 text-neutral-700 transition-colors hover:bg-neutral-100 md:hidden"
              aria-label="Open navigation drawer"
            >
              <Menu className="size-4" />
            </button>

            {/* Breadcrumb Section Indicator */}
            <div className="flex items-center gap-2 text-xs">
              <span className="hidden sm:inline font-mono tracking-wider text-neutral-400 uppercase">
                {meta.label}
              </span>
              <span className="hidden sm:inline text-neutral-300">/</span>
              <span className="font-semibold text-neutral-900">{currentSection}</span>
            </div>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-neutral-50 px-2.5 py-1 font-mono text-[10px] tracking-widest text-neutral-600">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE SYNC
            </span>

            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-neutral-500 transition-colors hover:text-black"
            >
              <Home className="size-3.5" />
              Back to Site
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>

      <LiveToaster roles={[role]} />
    </div>
  )
}
