'use client'

import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Pill } from '@/components/remedium/primitives'
import { ROLE_META } from '@/lib/remedium/roles'
import type { Role } from '@/lib/remedium/types'

const inputClass =
  'h-11 w-full rounded-xl border bg-white px-4 text-sm shadow-[inset_0_1px_0_oklch(0.2_0.03_262/0.03)] transition-colors outline-none placeholder:text-muted-foreground/70 focus:border-foreground/30 focus:ring-3 focus:ring-ring/30'

export function SignInForm({ role }: { role: Role }) {
  const meta = ROLE_META[role]
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<'form' | 'demo' | null>(null)

  function enter(kind: 'form' | 'demo') {
    setPending(kind)
    window.setTimeout(() => router.push(`/app/${role}`), 550)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    setError(null)
    enter('form')
  }

  function signInWithDemo() {
    setEmail(meta.email)
    setPassword('••••••••••')
    setError(null)
    enter('demo')
  }

  return (
    <div className="mx-auto w-full max-w-md animate-fade-up">
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 rounded-full border bg-white/70 px-3.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to roles
      </Link>

      <div className="mt-6 rounded-3xl border bg-card p-7 shadow-lift sm:p-9">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-foreground text-background">
            <meta.Icon className="size-[18px]" strokeWidth={1.6} />
          </span>
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">{meta.workspace.toUpperCase()}</p>
            <h1 className="text-2xl font-medium tracking-tight">Continue as {meta.label}</h1>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={meta.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-risk">
              {error}
            </p>
          )}
          <Pill type="submit" variant="primary" size="lg" className="w-full" disabled={pending !== null}>
            {pending === 'form' ? <Loader2 className="animate-spin" /> : null}
            Continue
          </Pill>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <Pill variant="outline" size="lg" className="w-full" onClick={signInWithDemo} disabled={pending !== null}>
          {pending === 'demo' ? <Loader2 className="animate-spin" /> : null}
          Continue with Demo Account
        </Pill>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Demo: {meta.person} · {meta.org}
        </p>
      </div>
    </div>
  )
}
