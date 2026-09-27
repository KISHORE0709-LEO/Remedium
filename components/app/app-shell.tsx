'use client'

import {
  AlertCircle,
  Bell,
  Building2,
  Check,
  ClipboardList,
  Edit3,
  ExternalLink,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  RotateCcw,
  Search,
  Settings,
  Stethoscope,
  TimerIcon,
  User,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Logo } from '@/components/remedium/primitives'
import { ROLE_META } from '@/lib/remedium/roles'
import { useAuthProfile } from '@/lib/remedium/auth-profile'
import { actions, useRemedium } from '@/lib/remedium/store'
import type { Role } from '@/lib/remedium/types'
import { isActive as isCaseActive } from '@/lib/remedium/engine'
import { cn } from '@/lib/utils'
import { LiveToaster } from './live-toaster'

// â”€â”€â”€ Auth identity context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Provides the authenticated user's providerId / pharmacyId to every child
// component so casesForRole() can filter by the real ID without prop-drilling.
export interface AuthIdentityCtx {
  providerId: string | null
  pharmacyId: string | null
  loading: boolean
}
export const AuthIdentityContext = createContext<AuthIdentityCtx>({
  providerId: null,
  pharmacyId: null,
  loading: true,
})
export function useAuthIdentity() {
  return useContext(AuthIdentityContext)
}
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const pathname = usePathname()
  const state = useRemedium()
  const unread = state?.notifications.filter((n) => n.role === role && !n.read).length ?? 0
  const base = `/app/${role}`
  const meta = (role && ROLE_META[role]) ? ROLE_META[role] : ROLE_META.provider
  const RoleIcon = meta?.Icon ?? Stethoscope

  // â”€â”€ Firebase auth profile (Firestore /users/{uid}) â”€â”€
  const authProfile = useAuthProfile(role)

  // Sidebar open/close state (Open by default)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // â”€â”€ EDITABLE PROFILE STATE â”€â”€
  // Priority: localStorage override (user edited) â†’ Firestore auth profile â†’ role defaults
  const [profile, setProfile] = useState<{
    person: string
    label: string
    org: string
    email?: string
    phone?: string
  }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`remedium-profile-${role}`)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {}
      }
    }
    // No localStorage override yet â€” use role defaults as placeholder until
    // useAuthProfile resolves with real Firestore data.
    return {
      person: meta.person,
      label: meta.label,
      org: meta.org,
      email: meta.email,
      phone: '',
    }
  })

  // Once the auth profile loads from Firestore, sync the display profile ONLY
  // if the user hasn't manually edited their profile in this browser session.
  useEffect(() => {
    if (authProfile.loading) return
    const hasLocalOverride = typeof window !== 'undefined' &&
      !!localStorage.getItem(`remedium-profile-${role}`)
    if (hasLocalOverride) return  // User edited manually â€” respect their override

    setProfile({
      person: authProfile.name || meta.person,
      label: meta.label,
      org: authProfile.org || meta.org,
      email: authProfile.email || meta.email,
      phone: '',
    })
  }, [authProfile.loading, authProfile.name, authProfile.org, authProfile.email, role, meta])

  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [editPerson, setEditPerson] = useState(profile.person)
  const [editLabel, setEditLabel] = useState(profile.label)
  const [editOrg, setEditOrg] = useState(profile.org)
  const [editEmail, setEditEmail] = useState(profile.email || '')
  const [editPhone, setEditPhone] = useState(profile.phone || '')

  function openEditProfile() {
    setEditPerson(profile.person)
    setEditLabel(profile.label)
    setEditOrg(profile.org)
    setEditEmail(profile.email || '')
    setEditPhone(profile.phone || '')
    setProfileModalOpen(true)
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    const updated = {
      person: editPerson.trim() || meta.person,
      label: editLabel.trim() || meta.label,
      org: editOrg.trim() || meta.org,
      email: editEmail.trim(),
      phone: editPhone.trim(),
    }
    setProfile(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`remedium-profile-${role}`, JSON.stringify(updated))
      window.dispatchEvent(new Event('remedium-profile-updated'))
    }
    setProfileModalOpen(false)
  }

  // Counts for badge notifications
  const openCases = state?.cases.filter(isCaseActive) ?? []
  const blockedCount = openCases.filter((c) => c.status === 'BLOCKED' || !!c.blockReason).length
  const fulfillmentCount = state?.cases.filter((c) => c.status === 'PHARMACY_PROCESSING' || c.status === 'READY_FOR_PICKUP').length ?? 0

  interface WorkspaceNavItem {
    href: string
    label: string
    Icon: any
    count?: number
    badgeColor?: string
  }

  // 1. Pharmacy Workspace items
  const pharmacyNav: WorkspaceNavItem[] = [
    { href: base, label: 'Dashboard', Icon: LayoutDashboard },
    { href: `${base}/refills`, label: 'Refill Requests', Icon: ClipboardList, count: openCases.length },
    { href: `${base}/blocked`, label: 'Blocked', Icon: AlertCircle, count: blockedCount, badgeColor: 'bg-red-500' },
    { href: `${base}/fulfillment`, label: 'Fulfillment', Icon: PackageCheck, count: fulfillmentCount, badgeColor: 'bg-emerald-600' },
    { href: `${base}/notifications`, label: 'Notifications', Icon: Bell, count: unread },
    { href: `${base}/settings`, label: 'Settings', Icon: Settings },
  ]

  // Default / Provider workspace items
  const defaultNav: WorkspaceNavItem[] = [
    { href: base, label: 'Dashboard', Icon: LayoutDashboard },
    { href: `${base}/refills`, label: 'Refills', Icon: RefreshCcw },
    { href: `${base}/timeline`, label: 'Timeline', Icon: TimerIcon },
    { href: `${base}/notifications`, label: 'Notifications', Icon: Bell, count: unread },
  ]

  const workspaceNav = role === 'pharmacy' ? pharmacyNav : defaultNav

  function isActive(href: string) {
    if (href === base) return pathname === base || pathname.startsWith(`${base}/cases`)
    return pathname.startsWith(href)
  }

  const currentSection =
    workspaceNav.find((item) => isActive(item.href))?.label ||
    (pathname.includes('/cases') ? 'Case Review' : 'Workspace')

  const authIdentityValue: AuthIdentityCtx = {
    providerId: authProfile.providerId,
    pharmacyId: authProfile.pharmacyId,
    loading: authProfile.loading,
  }

  return (
    <AuthIdentityContext.Provider value={authIdentityValue}>
    <div className="relative flex min-h-svh w-full bg-[#f9fafc]">
      {/* â”€â”€ 1. IN-FLOW DESKTOP / TABLET LEFT SIDEBAR â”€â”€ */}
      <aside
        className={cn(
          'sticky top-0 h-svh shrink-0 hidden sm:flex flex-col border-r border-neutral-200 bg-white transition-all duration-200 ease-in-out z-30 shadow-xs',
          sidebarOpen ? 'w-64' : 'w-0 -translate-x-full border-none overflow-hidden',
        )}
      >
        {/* Sidebar Header with Logo and Close Button */}
        <div className="flex h-16 items-center justify-between border-b border-neutral-100 px-4 shrink-0">
          <Logo href={base} />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="grid size-8 place-items-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:border-black hover:bg-neutral-100 hover:text-black cursor-pointer"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>

        {/* Current Active Role Profile Card (EDITABLE) */}
        <div className="p-3 border-b border-neutral-100 shrink-0">
          <button
            type="button"
            onClick={openEditProfile}
            className="group relative flex w-full items-center gap-3 rounded-xl border border-black/15 bg-neutral-50 p-2.5 text-left shadow-2xs transition-all hover:border-black/35 hover:bg-white hover:shadow-soft cursor-pointer"
            title="Click to edit profile"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-black text-white shadow-xs group-hover:scale-105 transition-transform">
              <RoleIcon className="size-4" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="truncate text-xs font-semibold text-neutral-900 leading-tight">
                  {profile.person}
                </p>
                <Edit3 className="size-3 text-neutral-400 opacity-60 group-hover:opacity-100 group-hover:text-black transition-all shrink-0" />
              </div>
              <p className="truncate font-mono text-[10px] tracking-wider text-neutral-500 uppercase mt-0.5">
                {profile.label}
              </p>
              <p className="truncate text-[10px] text-neutral-400 mt-0.5">{profile.org}</p>
            </div>
          </button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-6">
          {/* Workspace Items Only */}
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
                          ? 'border border-black bg-black text-white shadow-xs'
                          : 'text-neutral-600 hover:bg-neutral-100 hover:text-black',
                      )}
                    >
                      <item.Icon className={cn('size-4 shrink-0', active ? 'text-white' : 'text-neutral-500')} />
                      <span className="flex-1">{item.label}</span>
                      {!!item.count && (
                        <span
                          className={cn(
                            'grid min-w-[20px] place-items-center rounded-full px-1.5 font-mono text-[10px] leading-5',
                            active ? 'bg-white text-black' : `${item.badgeColor || 'bg-neutral-800'} text-white`,
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
        </div>

        {/* Clean Sidebar Footer */}
        <div className="border-t border-neutral-100 p-3 bg-neutral-50/70 shrink-0">
          <button
            type="button"
            onClick={() => actions.resetDemo()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200/80 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-600 shadow-2xs transition-colors hover:border-black hover:text-black cursor-pointer"
          >
            <RotateCcw className="size-3 text-neutral-400" />
            Reset demo data
          </button>
        </div>
      </aside>

      {/* â”€â”€ 2. MOBILE SLIDE-OVER DRAWER (for small screens < 640px) â”€â”€ */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs sm:hidden"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out sm:hidden',
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
          <button
            type="button"
            onClick={() => {
              setMobileDrawerOpen(false)
              openEditProfile()
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-black/15 bg-neutral-50 p-2.5 text-left"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-black text-white">
              <RoleIcon className="size-4" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="truncate text-xs font-semibold text-neutral-900">{profile.person}</p>
                <Edit3 className="size-3 text-neutral-400" />
              </div>
              <p className="truncate font-mono text-[10px] tracking-wider text-neutral-500 uppercase">
                {profile.label}
              </p>
              <p className="truncate text-[10px] text-neutral-400 mt-0.5">{profile.org}</p>
            </div>
          </button>
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
                        <span className={cn('rounded-full px-1.5 font-mono text-[10px] text-white', item.badgeColor || 'bg-neutral-800')}>
                          {item.count}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <div className="border-t p-3 bg-neutral-50">
          <button
            type="button"
            onClick={() => {
              actions.resetDemo()
              setMobileDrawerOpen(false)
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100"
          >
            <RotateCcw className="size-3.5" /> Reset demo data
          </button>
        </div>
      </aside>

      {/* â”€â”€ 3. MAIN DASHBOARD CONTENT AREA â”€â”€ */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Control Bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-neutral-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            {/* Desktop / Tablet Sidebar Toggle Icon Button (Clean, minimalist) */}
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="hidden sm:grid size-8 place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition-colors hover:border-black hover:text-black shadow-2xs cursor-pointer"
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
            </button>

            {/* Mobile Sidebar Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="grid size-8 place-items-center rounded-lg border border-neutral-200 text-neutral-700 transition-colors hover:bg-neutral-100 sm:hidden cursor-pointer"
              aria-label="Open navigation drawer"
            >
              <Menu className="size-4" />
            </button>

            {/* Clean Section Header & Search */}
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-neutral-900">{currentSection}</span>
            </div>

            {/* Search Input Bar in Header */}
            <div className="relative hidden md:block ml-2">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search prescriptions, patients, MRN..."
                className="h-8.5 w-60 rounded-full border border-neutral-200 bg-neutral-50/70 pl-8.5 pr-3 text-xs outline-none transition-all placeholder:text-neutral-400 focus:border-black focus:bg-white focus:ring-1 focus:ring-black sm:w-72"
              />
            </div>
          </div>

          {/* Right Header items: Sign Out (replaces Back to Site) */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs transition-colors hover:border-black hover:bg-neutral-50 hover:text-black cursor-pointer"
            >
              <LogOut className="size-3.5 text-neutral-500" />
              <span>Sign out</span>
            </Link>
          </div>
        </header>

        {/* Dashboard Main Content */}
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>

      {/* â”€â”€ 4. EDIT PROFILE MODAL â”€â”€ */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-up">
          <div className="relative w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-xl bg-black text-white">
                  <User className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900">Edit Profile</h2>
                  <p className="text-[11px] text-neutral-500">Update clinician identity & pharmacy organization</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="grid size-7 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-black cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="mt-4 space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-neutral-500 uppercase font-mono">
                  Full Name & Title
                </label>
                <input
                  type="text"
                  required
                  value={editPerson}
                  onChange={(e) => setEditPerson(e.target.value)}
                  className="h-9 w-full rounded-xl border border-neutral-200 px-3 text-xs outline-none focus:border-black"
                  placeholder="e.g. Alex Rivera, PharmD"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-neutral-500 uppercase font-mono">
                  Role / Title
                </label>
                <input
                  type="text"
                  required
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="h-9 w-full rounded-xl border border-neutral-200 px-3 text-xs outline-none focus:border-black"
                  placeholder="e.g. Pharmacy / Lead Pharmacist"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-neutral-500 uppercase font-mono">
                  Pharmacy / Practice Name
                </label>
                <input
                  type="text"
                  required
                  value={editOrg}
                  onChange={(e) => setEditOrg(e.target.value)}
                  className="h-9 w-full rounded-xl border border-neutral-200 px-3 text-xs outline-none focus:border-black"
                  placeholder="e.g. Harbor Pharmacy #214"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-neutral-500 uppercase font-mono">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="h-9 w-full rounded-xl border border-neutral-200 px-3 text-xs outline-none focus:border-black"
                    placeholder="name@pharmacy.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-neutral-500 uppercase font-mono">
                    Direct Phone
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="h-9 w-full rounded-xl border border-neutral-200 px-3 text-xs outline-none focus:border-black"
                    placeholder="(555) 234-8901"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="rounded-full border border-neutral-200 px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full border border-black bg-black px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-neutral-800 cursor-pointer"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <LiveToaster roles={[role]} />
    </div>
    </AuthIdentityContext.Provider>
  )
}

