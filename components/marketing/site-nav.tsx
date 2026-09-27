'use client'

import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Logo, PillLink } from '@/components/remedium/primitives'

const links = [
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#for-practices', label: 'For Practices' },
  { href: '/#for-pharmacies', label: 'For Pharmacies' },
]

export function SiteNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4">
      <nav
        aria-label="Primary"
        className="glass mx-auto flex max-w-5xl items-center justify-between rounded-full border border-foreground/[0.08] py-2 pr-2 pl-5 shadow-soft"
      >
        {/* Logo — standalone left */}
        <Logo />

        {/* Nav links — elegant bordered capsule, desktop only */}
        <ul className="hidden items-center gap-0 rounded-full border border-foreground/[0.08] bg-white/50 px-1 py-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="rounded-full px-4 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-white hover:text-foreground block"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Auth — standalone right */}
        <div className="flex items-center gap-2">
          <PillLink href="/login" variant="primary" size="sm" className="hidden sm:inline-flex">
            Get Started
          </PillLink>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full border md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="glass mx-auto mt-2 max-w-5xl rounded-3xl border p-2 shadow-soft animate-fade-up md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-2xl px-4 py-3 text-sm hover:bg-white"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="block rounded-2xl px-4 py-3 text-sm font-medium hover:bg-white"
          >
            Get Started
          </Link>
        </div>
      )}
    </header>
  )
}
