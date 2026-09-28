'use client'

import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Logo } from '@/components/remedium/primitives'

const links = [
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#for-pharmacies', label: 'For Pharmacies' },
  { href: '/#for-practices', label: 'For Practices' },
  { href: '/#for-insurance', label: 'For Insurance' },
]

export function SiteNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4 sm:px-8">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
        {/* Logo — positioned comfortably to the left */}
        <div className="flex items-center">
          <Logo />
        </div>

        {/* Center Nav Capsule — reduced height, elegant black border */}
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1 rounded-full border border-black bg-white/95 px-2 py-1 shadow-sm backdrop-blur-md">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="inline-block rounded-full border border-transparent px-4 py-1 text-[13px] font-medium text-neutral-600 transition-all duration-150 hover:border-black/30 hover:bg-neutral-100 hover:text-black"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Right CTA — Get Started capsule with impressive black border */}
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center justify-center rounded-full border border-black bg-black px-4 py-1.5 text-[13px] font-medium text-white shadow-sm transition-all duration-150 hover:bg-neutral-800 hover:-translate-y-px"
          >
            Get Started
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full border border-black bg-white shadow-sm transition-colors hover:bg-neutral-50 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer with crisp black border */}
      {open && (
        <div className="mx-auto mt-2 max-w-sm rounded-3xl border border-black bg-white p-3 shadow-lift animate-fade-up md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 hover:text-black"
            >
              {l.label}
            </Link>
          ))}
          <div className="my-2 h-px bg-neutral-200" />
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center rounded-full border border-black bg-black py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
          >
            Get Started
          </Link>
        </div>
      )}
    </header>
  )
}
