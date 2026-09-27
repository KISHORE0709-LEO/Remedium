'use client'

import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldAlert,
  User,
  Building2,
  Stethoscope,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Pill } from '@/components/remedium/primitives'
import { ROLE_META } from '@/lib/remedium/roles'
import { ROLES, type Role } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'

const inputClass =
  'h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 pr-10 text-sm shadow-sm transition-colors outline-none placeholder:text-neutral-400 focus:border-black focus:ring-2 focus:ring-black/10'

export function SignInForm({ role: initialRole }: { role: Role }) {
  const router = useRouter()

  // Mode: signin, signup, or forgot password
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
  const [activeRole, setActiveRole] = useState<Role>(initialRole)
  const meta = ROLE_META[activeRole]

  // Form states
  const [name, setName] = useState('')
  const [organization, setOrganization] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [agreeTerms, setAgreeTerms] = useState(false)

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Feedback states
  const [error, setError] = useState<string | null>(null)
  const [forgotSent, setForgotSent] = useState(false)
  const [pending, setPending] = useState<'form' | 'demo' | null>(null)

  function enter(kind: 'form' | 'demo') {
    setPending(kind)
    window.setTimeout(() => router.push(`/app/${activeRole}`), 550)
  }

  function handleSignIn(e: FormEvent) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Please enter a valid email address.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    setError(null)
    enter('form')
  }

  function handleSignUp(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Please enter your full name.')
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Please enter a valid work or personal email.')
    if (password.length < 8) return setError('Password must be at least 8 characters long.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    if (!agreeTerms) return setError('You must agree to the Terms of Service & Privacy Policy.')
    setError(null)
    enter('form')
  }

  function handleForgotPassword(e: FormEvent) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Please enter the email address for your account.')
    setError(null)
    setPending('form')
    setTimeout(() => {
      setPending(null)
      setForgotSent(true)
    }, 600)
  }

  function signInWithDemo() {
    setEmail(meta.email)
    setPassword('••••••••••')
    setError(null)
    enter('demo')
  }

  return (
    <div className="mx-auto w-full max-w-lg animate-fade-up">
      {/* Back to Role Selection */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/80 px-3.5 py-1.5 text-[13px] text-neutral-600 transition-colors hover:border-black hover:text-black shadow-sm"
        >
          <ArrowLeft className="size-3.5" /> Back to roles
        </Link>

        {/* Quick Role Switcher */}
        <div className="inline-flex items-center rounded-full border border-black/10 bg-white p-0.5 shadow-sm text-xs">
          {ROLES.map((r) => {
            const m = ROLE_META[r]
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setActiveRole(r)
                  setError(null)
                }}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-medium transition-all capitalize',
                  activeRole === r
                    ? 'border border-black bg-black text-white shadow-xs'
                    : 'text-neutral-500 hover:text-black',
                )}
                title={m.label}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-black/15 bg-white p-7 shadow-lift sm:p-9">
        {/* Role Header */}
        <div className="flex items-center gap-3 pb-6 border-b border-neutral-100">
          <span className="grid size-11 place-items-center rounded-2xl bg-black text-white shadow-sm">
            <meta.Icon className="size-[20px]" strokeWidth={1.7} />
          </span>
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-neutral-400 uppercase">
              {meta.workspace}
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
              {mode === 'signin' && `Sign in as ${meta.label}`}
              {mode === 'signup' && `Create ${meta.label} Account`}
              {mode === 'forgot' && 'Reset your password'}
            </h1>
          </div>
        </div>

        {/* ── Mode 1: Forgot Password View ── */}
        {mode === 'forgot' ? (
          <div className="mt-6 space-y-4">
            {forgotSent ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-center">
                <div className="mx-auto grid size-10 place-items-center rounded-full bg-emerald-100 text-emerald-700 mb-3">
                  <Check className="size-5" />
                </div>
                <h3 className="text-sm font-semibold text-emerald-900">Reset Link Sent</h3>
                <p className="mt-1 text-xs text-emerald-700 leading-relaxed">
                  We have sent password reset instructions to <span className="font-semibold">{email}</span>. Please check
                  your inbox.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setForgotSent(false)
                    setMode('signin')
                  }}
                  className="mt-4 inline-flex items-center justify-center rounded-full border border-black bg-black px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-neutral-800"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Enter the email address registered with your {meta.label} account and we will send you a secure link to
                  reset your password.
                </p>
                <div className="space-y-1.5">
                  <label htmlFor="forgot-email" className="text-xs font-semibold text-neutral-700 uppercase tracking-wider font-mono">
                    Account Email
                  </label>
                  <div className="relative">
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      placeholder={meta.email}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                    />
                    <Mail className="absolute right-3.5 top-3.5 size-4 text-neutral-400 pointer-events-none" />
                  </div>
                </div>

                {error && (
                  <p role="alert" className="text-xs font-medium text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pending !== null}
                  className="w-full flex items-center justify-center gap-2 rounded-full border border-black bg-black py-2.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 disabled:opacity-50"
                >
                  {pending === 'form' ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                  Send Reset Link
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setMode('signin')
                    }}
                    className="text-xs text-neutral-600 hover:text-black underline underline-offset-4"
                  >
                    Remember your password? Sign in
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <>
            {/* Sign In / Create Account Navigation Tabs */}
            <div className="grid grid-cols-2 gap-1 mt-6 p-1 rounded-2xl border border-black/10 bg-neutral-100">
              <button
                type="button"
                onClick={() => {
                  setMode('signin')
                  setError(null)
                }}
                className={cn(
                  'rounded-xl py-2 text-xs font-semibold transition-all duration-150',
                  mode === 'signin'
                    ? 'border border-black bg-white text-black shadow-xs'
                    : 'text-neutral-500 hover:text-black',
                )}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup')
                  setError(null)
                }}
                className={cn(
                  'rounded-xl py-2 text-xs font-semibold transition-all duration-150',
                  mode === 'signup'
                    ? 'border border-black bg-white text-black shadow-xs'
                    : 'text-neutral-500 hover:text-black',
                )}
              >
                Create Account
              </button>
            </div>

            {/* ── Mode 2: Sign In Form ── */}
            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="mt-6 space-y-4" noValidate>
                <div className="space-y-1.5">
                  <label htmlFor="signin-email" className="text-xs font-semibold text-neutral-700 uppercase tracking-wider font-mono">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="signin-email"
                      type="email"
                      autoComplete="email"
                      placeholder={meta.email}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                    />
                    <Mail className="absolute right-3.5 top-3.5 size-4 text-neutral-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="signin-password" className="text-xs font-semibold text-neutral-700 uppercase tracking-wider font-mono">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null)
                        setMode('forgot')
                      }}
                      className="text-xs text-neutral-600 hover:text-black hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-3 text-neutral-400 hover:text-black transition-colors"
                      title={showPassword ? 'Hide password' : 'Show password'}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-neutral-700 select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="size-4 rounded border-neutral-300 accent-black text-black focus:ring-black"
                    />
                    <span>Remember my session</span>
                  </label>
                </div>

                {error && (
                  <p role="alert" className="text-xs font-medium text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pending !== null}
                  className="w-full flex items-center justify-center gap-2 rounded-full border border-black bg-black py-2.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 disabled:opacity-50 transition-all"
                >
                  {pending === 'form' ? <Loader2 className="size-4 animate-spin" /> : null}
                  Sign In to {meta.label}
                </button>
              </form>
            )}

            {/* ── Mode 3: Create Account Form ── */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="mt-6 space-y-3.5" noValidate>
                <div className="space-y-1">
                  <label htmlFor="signup-name" className="text-xs font-semibold text-neutral-700 uppercase tracking-wider font-mono">
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      id="signup-name"
                      type="text"
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                    />
                    <User className="absolute right-3.5 top-3.5 size-4 text-neutral-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="signup-email" className="text-xs font-semibold text-neutral-700 uppercase tracking-wider font-mono">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="signup-email"
                      type="email"
                      placeholder="jane@organization.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                    />
                    <Mail className="absolute right-3.5 top-3.5 size-4 text-neutral-400 pointer-events-none" />
                  </div>
                </div>

                {activeRole !== 'patient' && (
                  <div className="space-y-1">
                    <label htmlFor="signup-org" className="text-xs font-semibold text-neutral-700 uppercase tracking-wider font-mono">
                      Practice / Pharmacy / Plan Name
                    </label>
                    <div className="relative">
                      <input
                        id="signup-org"
                        type="text"
                        placeholder="e.g. Harbor Health Clinic"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        className={inputClass}
                      />
                      <Building2 className="absolute right-3.5 top-3.5 size-4 text-neutral-400 pointer-events-none" />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label htmlFor="signup-password" className="text-xs font-semibold text-neutral-700 uppercase tracking-wider font-mono">
                    Create Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-3 text-neutral-400 hover:text-black transition-colors"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="signup-confirm" className="text-xs font-semibold text-neutral-700 uppercase tracking-wider font-mono">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-3 text-neutral-400 hover:text-black transition-colors"
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Agreement Checkbox */}
                <div className="pt-1">
                  <label className="flex items-start gap-2 cursor-pointer text-xs text-neutral-600 select-none">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 size-4 rounded border-neutral-300 accent-black text-black focus:ring-black"
                    />
                    <span>
                      I agree to Remedium&apos;s{' '}
                      <span className="text-black font-medium underline">Terms of Service</span> and{' '}
                      <span className="text-black font-medium underline">HIPAA Privacy Policy</span>.
                    </span>
                  </label>
                </div>

                {error && (
                  <p role="alert" className="text-xs font-medium text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pending !== null}
                  className="w-full flex items-center justify-center gap-2 rounded-full border border-black bg-black py-2.5 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 disabled:opacity-50 transition-all"
                >
                  {pending === 'form' ? <Loader2 className="size-4 animate-spin" /> : null}
                  Create {meta.label} Account
                </button>
              </form>
            )}

            {/* Quick Demo Access Divider */}
            <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
              <span className="h-px flex-1 bg-neutral-200" /> or Instant Access{' '}
              <span className="h-px flex-1 bg-neutral-200" />
            </div>

            {/* 1-Click Demo Login Button */}
            <button
              type="button"
              onClick={signInWithDemo}
              disabled={pending !== null}
              className="w-full flex items-center justify-center gap-2 rounded-full border border-black/30 bg-neutral-50 py-2.5 text-xs font-semibold text-neutral-800 shadow-sm transition-all hover:border-black hover:bg-white"
            >
              {pending === 'demo' ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-3.5" />}
              Continue as Demo {meta.label} ({meta.person})
            </button>

            <p className="mt-3 text-center text-[11px] text-neutral-400">
              Simulated {meta.workspace} · No password required
            </p>
          </>
        )}
      </div>
    </div>
  )
}
