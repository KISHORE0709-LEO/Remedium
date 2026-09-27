'use client'

import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Stethoscope,
  User,
  XCircle,
  ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { ROLE_META } from '@/lib/remedium/roles'
import type { Role } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'
import Spline from '@splinetool/react-spline'
import { PillLink, Logo } from '@/components/remedium/primitives'

type AuthRole = 'provider' | 'pharmacy'

const inputClass =
  'h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 pr-10 text-sm shadow-xs transition-colors outline-none placeholder:text-neutral-400 focus:border-black focus:ring-2 focus:ring-black/10'

export function SignInForm({ role: initialRole = 'provider' }: { role?: Role } = {}) {
  const router = useRouter()

  const startRole: AuthRole = initialRole === 'pharmacy' ? 'pharmacy' : 'provider'
  const [selectedRole, setSelectedRole] = useState<AuthRole>(startRole)
  const [step, setStep] = useState<'role-select' | 'auth'>('role-select')
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')

  const meta = (selectedRole && ROLE_META[selectedRole]) ? ROLE_META[selectedRole] : ROLE_META.provider
  const RoleIcon = meta?.Icon ?? Stethoscope

  // Sign In inputs
  const [signInIdentifier, setSignInIdentifier] = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [showSignInPassword, setShowSignInPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  // Sign Up inputs
  const [signUpName, setSignUpName] = useState('')
  const [signUpOrg, setSignUpOrg] = useState('')
  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('')
  const [showSignUpPassword, setShowSignUpPassword] = useState(false)
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)

  // Forgot password inputs
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSubmitted, setForgotSubmitted] = useState(false)

  // Feedback & Loading
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, setPending] = useState<'form' | 'demo' | null>(null)

  const passLength = signUpPassword.length >= 8
  const passHasNumber = /\d/.test(signUpPassword)
  const passHasUpper = /[A-Z]/.test(signUpPassword)
  const passMatches = signUpPassword.length > 0 && signUpPassword === signUpConfirmPassword

  function navigateToDashboard(role: AuthRole) {
    window.setTimeout(() => router.push(`/app/${role}`), 600)
  }

  function handleSignInSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!signInIdentifier.trim()) {
      return setError('Please enter your email or username.')
    }
    if (signInPassword.length < 6) {
      return setError('Password must be at least 6 characters.')
    }

    setPending('form')
    setSuccess(`Signing in as ${meta.label}...`)
    navigateToDashboard(selectedRole)
  }

  function handleSignUpSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!signUpName.trim()) {
      return setError('Please enter your full name.')
    }
    if (!signUpOrg.trim()) {
      return setError(
        selectedRole === 'provider'
          ? 'Please enter your practice or clinic name.'
          : 'Please enter your pharmacy name.',
      )
    }
    if (!/^\S+@\S+\.\S+$/.test(signUpEmail)) {
      return setError('Please enter a valid work email address.')
    }
    if (!passLength || !passHasNumber || !passHasUpper) {
      return setError('Please satisfy all password requirements.')
    }
    if (signUpPassword !== signUpConfirmPassword) {
      return setError('Passwords do not match.')
    }
    if (!agreeTerms) {
      return setError('You must accept the Terms of Service & HIPAA Compliance Agreement.')
    }

    setPending('form')
    setSuccess(`Account created! Launching your ${meta.label} workspace...`)
    navigateToDashboard(selectedRole)
  }

  function handleForgotSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!/^\S+@\S+\.\S+$/.test(forgotEmail)) {
      return setError('Please enter a valid email address.')
    }

    setPending('form')
    setTimeout(() => {
      setPending(null)
      setForgotSubmitted(true)
    }, 700)
  }

  function handleDemoLogin() {
    setError(null)
    setSuccess(null)
    setPending('demo')
    setSignInIdentifier(meta.email)
    setSignInPassword('••••••••••••')
    setSuccess(`Authenticated as ${meta.person} (${meta.label})`)
    navigateToDashboard(selectedRole)
  }

  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* Left Column - Authentication (Full width if role-select) */}
      <div className={cn("relative flex w-full flex-col transition-all duration-500", step === 'auth' ? "lg:w-1/2" : "")}>
        {/* Header */}
        <header className="absolute left-0 top-0 w-full p-6 sm:p-10 flex justify-between items-center z-10">
          <Logo />
          <PillLink href="/" variant="outline" size="sm">
            Back to site
          </PillLink>
        </header>

        {/* Main Content (Centered) */}
        <div className="flex flex-1 flex-col justify-center px-6 pt-24 sm:px-12 lg:px-16 xl:px-24 relative z-20">
          <div className={cn("mx-auto w-full animate-fade-up", step === 'role-select' ? "max-w-2xl" : "max-w-xl")}>
      {step === 'role-select' ? (
        <div className="space-y-6">
          <div className="text-left mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">
              Welcome to Remedium
            </h1>
            <p className="mt-2 text-base text-neutral-500">
              Select your role to sign in or create a new account.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Provider Card */}
            <button
              onClick={() => {
                setSelectedRole('provider')
                setStep('auth')
                setError(null)
                setSuccess(null)
              }}
              className="group relative flex min-h-[280px] flex-col overflow-hidden rounded-3xl border border-black/10 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl text-left"
            >
              {/* Subtle Gradient background on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-black/5 opacity-0 transition-opacity group-hover:opacity-100" />
              
              <div className="relative z-10 flex flex-1 flex-col justify-between">
                <div>
                  <div className="grid size-16 place-items-center rounded-2xl bg-black text-white shadow-md mb-6">
                    <Stethoscope className="size-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-black">Provider / Practice</h3>
                  <p className="mt-2 text-sm text-neutral-500 font-medium">
                    Manage patient refills & coordinate care
                  </p>
                </div>
                <div className="mt-6 flex justify-end">
                  <div className="grid size-10 place-items-center rounded-full bg-neutral-100 text-neutral-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <ChevronRight className="size-5" />
                  </div>
                </div>
              </div>
            </button>

            {/* Pharmacy Card */}
            <button
              onClick={() => {
                setSelectedRole('pharmacy')
                setStep('auth')
                setError(null)
                setSuccess(null)
              }}
              className="group relative flex min-h-[280px] flex-col overflow-hidden rounded-3xl border border-black/10 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl text-left"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-black/5 opacity-0 transition-opacity group-hover:opacity-100" />
              
              <div className="relative z-10 flex flex-1 flex-col justify-between">
                <div>
                  <div className="grid size-16 place-items-center rounded-2xl bg-black text-white shadow-md mb-6">
                    <Building2 className="size-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-black">Pharmacy</h3>
                  <p className="mt-2 text-sm text-neutral-500 font-medium">
                    Process Rx requests & resolve PA issues
                  </p>
                </div>
                <div className="mt-6 flex justify-end">
                  <div className="grid size-10 place-items-center rounded-full bg-neutral-100 text-neutral-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <ChevronRight className="size-5" />
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div className="animate-fade-in">
          {/* Back to role selection */}
          <button
            type="button"
            onClick={() => {
              setStep('role-select')
              setMode('signin')
            }}
            className="group mb-8 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm transition-all hover:bg-neutral-50 hover:shadow-md"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
            Change Role
          </button>

          {/* ── Main Authentication Box ── */}
          <div className="rounded-3xl border border-black/15 bg-white p-7 shadow-2xl shadow-black/5 sm:p-9 relative overflow-hidden">
            {/* Ambient Card Glow */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 size-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

            {/* Header with active role badge */}
            <div className="relative z-10 flex items-center justify-between pb-5 border-b border-neutral-100">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-black text-white shadow-md">
                  <RoleIcon className="size-5" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="font-mono text-[10px] font-semibold tracking-wider text-purple-600 uppercase">
                    {meta.workspace}
                  </p>
                  <h2 className="text-lg font-bold text-neutral-900 leading-tight">
                    {mode === 'signin' && `Sign In · ${meta.label}`}
                    {mode === 'signup' && `Create Account · ${meta.label}`}
                    {mode === 'forgot' && 'Reset Password'}
                  </h2>
                </div>
              </div>

              {mode !== 'forgot' && (
                <span className="inline-flex items-center rounded-full border border-black/10 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600">
                  {meta.org}
                </span>
              )}
            </div>

            {/* ── Mode Switcher Tabs (Sign In / Create Account) ── */}
            {mode !== 'forgot' && (
              <div className="relative z-10 grid grid-cols-2 gap-1 mt-5 p-1 rounded-2xl border border-black/10 bg-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin')
                    setError(null)
                    setSuccess(null)
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
                    setSuccess(null)
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
            )}

            {/* Feedback Alerts */}
            {error && (
              <div className="relative z-10 mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 animate-in fade-in zoom-in-95">
                <XCircle className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="relative z-10 mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 animate-in fade-in zoom-in-95">
                <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{success}</span>
              </div>
            )}

            {/* ── FORM 1: SIGN IN ── */}
            {mode === 'signin' && (
              <form onSubmit={handleSignInSubmit} className="relative z-10 mt-5 space-y-4" noValidate>
                <div className="space-y-1.5">
                  <label
                    htmlFor="signin-user"
                    className="text-xs font-semibold text-neutral-700 uppercase tracking-wider font-mono"
                  >
                    Email or Username
                  </label>
                  <div className="relative">
                    <input
                      id="signin-user"
                      type="text"
                      autoComplete="username"
                      placeholder={meta.email}
                      value={signInIdentifier}
                      onChange={(e) => setSignInIdentifier(e.target.value)}
                      className={inputClass}
                    />
                    <Mail className="absolute right-3.5 top-3.5 size-4 text-neutral-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="signin-pass"
                      className="text-xs font-semibold text-neutral-700 uppercase tracking-wider font-mono"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null)
                        setMode('forgot')
                      }}
                      className="text-xs text-purple-600 font-medium hover:text-purple-700 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="signin-pass"
                      type={showSignInPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••••••"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignInPassword((p) => !p)}
                      className="absolute right-3 top-3 text-neutral-400 hover:text-black transition-colors"
                      title={showSignInPassword ? 'Hide password' : 'Show password'}
                      aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                    >
                      {showSignInPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-700 select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="size-4 rounded border-neutral-300 accent-black text-black focus:ring-black"
                    />
                    <span>Remember me on this device</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={pending !== null}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-black bg-black py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 hover:bg-neutral-800 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {pending === 'form' ? <Loader2 className="size-4 animate-spin" /> : null}
                  Sign In to {meta.label}
                </button>

                {/* Demo Divider */}
                <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
                  <span className="h-px flex-1 bg-neutral-200" /> or 1-Click Access{' '}
                  <span className="h-px flex-1 bg-neutral-200" />
                </div>

                {/* Instant Demo Access Button */}
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={pending !== null}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-black/20 bg-neutral-50 py-3 text-sm font-semibold text-neutral-800 shadow-sm transition-all hover:border-black hover:bg-white cursor-pointer"
                >
                  {pending === 'demo' ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                  Continue with Demo Account
                </button>

                {/* Bottom switch to signup */}
                <p className="mt-4 text-center text-xs text-neutral-500">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup')
                      setError(null)
                    }}
                    className="font-semibold text-purple-600 underline underline-offset-4 hover:text-purple-700 cursor-pointer"
                  >
                    Create Account
                  </button>
                </p>
              </form>
            )}

            {/* ── FORM 2: CREATE ACCOUNT ── */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUpSubmit} className="relative z-10 mt-5 space-y-3.5" noValidate>
                <div className="space-y-1">
                  <label
                    htmlFor="signup-fullname"
                    className="text-xs font-semibold text-neutral-700 uppercase tracking-wider font-mono"
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      id="signup-fullname"
                      type="text"
                      placeholder={selectedRole === 'provider' ? 'Dr. Sarah Williams' : 'Alex Rivera, PharmD'}
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      className={inputClass}
                    />
                    <User className="absolute right-3.5 top-3.5 size-4 text-neutral-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="signup-practice"
                    className="text-xs font-semibold text-neutral-700 uppercase tracking-wider font-mono"
                  >
                    {selectedRole === 'provider' ? 'Practice / Clinic Name' : 'Pharmacy / Store Name'}
                  </label>
                  <div className="relative">
                    <input
                      id="signup-practice"
                      type="text"
                      placeholder={selectedRole === 'provider' ? 'Bayview Internal Medicine' : 'Harbor Pharmacy #214'}
                      value={signUpOrg}
                      onChange={(e) => setSignUpOrg(e.target.value)}
                      className={inputClass}
                    />
                    <Building2 className="absolute right-3.5 top-3.5 size-4 text-neutral-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="signup-email"
                    className="text-xs font-semibold text-neutral-700 uppercase tracking-wider font-mono"
                  >
                    Work Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="signup-email"
                      type="email"
                      placeholder="name@practice.com"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      className={inputClass}
                    />
                    <Mail className="absolute right-3.5 top-3.5 size-4 text-neutral-400 pointer-events-none" />
                  </div>
                </div>

                {/* Password input */}
                <div className="space-y-1">
                  <label
                    htmlFor="signup-pass"
                    className="text-xs font-semibold text-neutral-700 uppercase tracking-wider font-mono"
                  >
                    Create Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-pass"
                      type={showSignUpPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignUpPassword((p) => !p)}
                      className="absolute right-3 top-3 text-neutral-400 hover:text-black transition-colors"
                      title={showSignUpPassword ? 'Hide password' : 'Show password'}
                    >
                      {showSignUpPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>

                  {/* Password Requirements Checklist */}
                  <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-neutral-50 p-2 text-[11px]">
                    <span
                      className={cn(
                        'flex items-center gap-1 font-medium transition-colors',
                        passLength ? 'text-emerald-700' : 'text-neutral-400',
                      )}
                    >
                      <Check className={cn('size-3 stroke-[2.5]', passLength ? 'opacity-100' : 'opacity-30')} />
                      8+ chars
                    </span>
                    <span
                      className={cn(
                        'flex items-center gap-1 font-medium transition-colors',
                        passHasNumber ? 'text-emerald-700' : 'text-neutral-400',
                      )}
                    >
                      <Check className={cn('size-3 stroke-[2.5]', passHasNumber ? 'opacity-100' : 'opacity-30')} />
                      1+ number
                    </span>
                    <span
                      className={cn(
                        'flex items-center gap-1 font-medium transition-colors',
                        passHasUpper ? 'text-emerald-700' : 'text-neutral-400',
                      )}
                    >
                      <Check className={cn('size-3 stroke-[2.5]', passHasUpper ? 'opacity-100' : 'opacity-30')} />
                      1+ uppercase
                    </span>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1">
                  <label
                    htmlFor="signup-confirm-pass"
                    className="text-xs font-semibold text-neutral-700 uppercase tracking-wider font-mono"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-confirm-pass"
                      type={showSignUpConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter your password"
                      value={signUpConfirmPassword}
                      onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignUpConfirmPassword((p) => !p)}
                      className="absolute right-3 top-3 text-neutral-400 hover:text-black transition-colors"
                      title={showSignUpConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showSignUpConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {signUpConfirmPassword && (
                    <p
                      className={cn(
                        'text-[11px] font-medium pt-0.5',
                        passMatches ? 'text-emerald-700' : 'text-red-600',
                      )}
                    >
                      {passMatches ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </p>
                  )}
                </div>

                {/* Terms Checkbox */}
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
                      <span className="text-black font-semibold underline">Terms of Service</span> and{' '}
                      <span className="text-black font-semibold underline">HIPAA Compliance Agreement</span>.
                    </span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={pending !== null}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-black bg-black py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 hover:bg-neutral-800 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {pending === 'form' ? <Loader2 className="size-4 animate-spin" /> : null}
                  Create Account
                </button>

                {/* Switch to Sign In */}
                <p className="mt-4 text-center text-xs text-neutral-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin')
                      setError(null)
                    }}
                    className="font-semibold text-purple-600 underline underline-offset-4 hover:text-purple-700 cursor-pointer"
                  >
                    Sign In
                  </button>
                </p>
              </form>
            )}

            {/* ── FORM 3: FORGOT PASSWORD ── */}
            {mode === 'forgot' && (
              <div className="relative z-10 mt-5 space-y-4">
                {forgotSubmitted ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-center">
                    <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-800 mb-3">
                      <CheckCircle2 className="size-6" />
                    </div>
                    <h3 className="text-sm font-bold text-emerald-900">Check Your Email</h3>
                    <p className="mt-1.5 text-xs text-emerald-700 leading-relaxed max-w-sm mx-auto">
                      We have sent a secure password reset link to{' '}
                      <span className="font-semibold">{forgotEmail}</span>. The link will expire in 30 minutes.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotSubmitted(false)
                        setMode('signin')
                      }}
                      className="mt-5 inline-flex items-center justify-center rounded-xl border border-black bg-black px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotSubmit} className="space-y-4">
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Enter your registered work email address below. We&apos;ll send you a verified link to safely reset
                      your {meta.label} password.
                    </p>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="forgot-user-email"
                        className="text-xs font-semibold text-neutral-700 uppercase tracking-wider font-mono"
                      >
                        Registered Email
                      </label>
                      <div className="relative">
                        <input
                          id="forgot-user-email"
                          type="email"
                          required
                          placeholder={meta.email}
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          className={inputClass}
                        />
                        <Mail className="absolute right-3.5 top-3.5 size-4 text-neutral-400 pointer-events-none" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={pending !== null}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-black bg-black py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 hover:bg-neutral-800 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {pending === 'form' ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <KeyRound className="size-4" />
                      )}
                      Send Password Reset Link
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setError(null)
                          setMode('signin')
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-black underline underline-offset-4 cursor-pointer"
                      >
                        <ArrowLeft className="size-3" /> Back to Sign In
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Security notice footer */}
      <div className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-neutral-500">
        <ShieldCheck className="size-3.5 text-emerald-600" />
        <span>HIPAA Compliant · End-to-End Encrypted</span>
      </div>
          </div>
        </div>
      </div>

      {/* Right Column - Spline Robot (Only shown during 'auth') */}
      {step === 'auth' && (
        <div className="hidden lg:block lg:w-1/2 relative bg-neutral-50 overflow-hidden animate-fade-in">
          {/* Subtle ambient background */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,rgba(147,51,234,0.1),transparent)]" />
          <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,black,transparent)] opacity-50" />
          
          {/* The Spline Robot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Spline
              scene="https://prod.spline.design/rU2-Ks0SC0T5od9B/scene.splinecode"
            />
          </div>
        </div>
      )}
    </div>
  )
}
