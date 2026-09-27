import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthShell } from '@/components/auth/auth-shell'
import { ROLE_META } from '@/lib/remedium/roles'
import { ROLES } from '@/lib/remedium/types'

export const metadata: Metadata = {
  title: 'Get Started — Remedium',
  description: 'Choose your role to continue to Remedium.',
}

export default function LoginPage() {
  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-5xl animate-fade-up">
        {/* Heading */}
        <div className="text-center">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Welcome to Remedium
          </p>
          <h1 className="mt-3 text-4xl font-medium tracking-[-0.03em] text-balance sm:text-5xl">
            Who are you signing in as?
          </h1>
          <p className="mt-3 text-muted-foreground">
            Each role has its own workspace and view of the refill journey.
          </p>
        </div>

        {/* Role cards */}
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r, i) => {
            const m = ROLE_META[r]
            return (
              <li key={r} className="animate-fade-up" style={{ animationDelay: `${80 + i * 60}ms` }}>
                <Link
                  href={`/login/${r}`}
                  className="group flex h-full flex-col rounded-2xl border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid size-11 place-items-center rounded-full border bg-muted/40 transition-colors group-hover:border-foreground group-hover:bg-foreground group-hover:text-background">
                      <m.Icon className="size-[18px]" strokeWidth={1.6} />
                    </span>
                    <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100" />
                  </div>
                  <p className="mt-8 font-mono text-[11px] font-medium tracking-[0.2em]">{m.label.toUpperCase()}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.description}</p>
                  <span className="mt-6 inline-flex items-center gap-1.5 border-t pt-4 text-[13px] font-medium">
                    Continue <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </AuthShell>
  )
}
