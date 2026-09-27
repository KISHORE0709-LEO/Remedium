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
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { ROLE_META } from '@/lib/remedium/roles'
import type { Role } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'

// Only 2 roles for authentication
type AuthRole = 'provider' | 'pharmacy'

const inputClass =
  'h-11 w-full rounded-xl border border-neutral-300 bg-white px-3.5 pr-10 text-sm shadow-xs transition-colors outline-none placeholder:text-neutral-400 focus:border-black focus:ring-2 focus:ring-black/10'

export function SignInForm({ role: initialRole = 'provider' }: { role?: Role } = {}) {
  const router = useRouter()

  // Ensure default role is either 'provider' or 'pharmacy'
  const startRole: AuthRole = initialRole === 'pharmacy' ? 'pharmacy' : 'provider'
  const [selectedRole, setSelectedRole] = useState<AuthRole>(startRole)
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

  // Real-time password requirement checks
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
    <div className="mx-auto w-full max-w-xl animate-fade-up">
      {/* ── Top Role Selector: ONLY 2 ROLES ── */}
      <div className="mb-6">
        <p className="mb-2 text-center text-xs font-semibold text-neutral-500 uppercase tracking-widest font-mono">
          Select Your Healthcare Role
        </p>
        <div className="grid grid-cols-2 gap-3">
          {/* Role 1: Provider / Practice */}
          <button
            type="button"
            onClick={() => {
              setSelectedRole('provider')
              setError(null)
              setSuccess(null)
            }}
            className={cn(
              'group relative flex flex-col items-start rounded-2xl border p-4 text-left transition-all duration-200 shadow-sm',
              selectedRole === 'provider'
                ? 'border-black bg-black text-white shadow-md ring-2 ring-black/10'
                : 'border-neutral-200 bg-white text-neutral-800 hover:border-black/40 hover:bg-neutral-50',
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span
                className={cn(
                  'grid size-10 place-items-center rounded-xl transition-colors',
                  selectedRole === 'provider'
                    ? 'bg-neutral-800 text-white'
                    : 'bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200',
                )}
              >
                <Stethoscope className="size-5" strokeWidth={1.8} />
              </span>
              {selectedRole === 'provider' && (
                <span className="grid size-5 place-items-center rounded-full bg-white text-black">
                  <Check className="size-3 stroke-[3]" />
                </span>
              )}
            </div>
            <p className="mt-3 font-semibold text-sm leading-tight">Provider / Practice</p>
            <p
              className={cn(
                'mt-1 text-xs leading-relaxed',
                selectedRole === 'provider' ? 'text-neutral-300' : 'text-neutral-500',
              )}
            >
              Doctors, clinics & clinical staff
            </p>
          </button>

          {/* Role 2: Pharmacy */}
          <button
            type="button"
            onClick={() => {
              setSelectedRole('pharmacy')
              setError(null)
              setSuccess(null)
            }}
            className={cn(
              'group relative flex flex-col items-start rounded-2xl border p-4 text-left transition-all duration-200 shadow-sm',
              selectedRole === 'pharmacy'
                ? 'border-black bg-black text-white shadow-md ring-2 ring-black/10'
                : 'border-neutral-200 bg-white text-neutral-800 hover:border-black/40 hover:bg-neutral-50',
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span
                className={cn(
                  'grid size-10 place-items-center rounded-xl transition-colors',
                  selectedRole === 'pharmacy'
                    ? 'bg-neutral-800 text-white'
                    : 'bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200',
                )}
              >
                <Building2 className="size-5" strokeWidth={1.8} />
              </span>
              {selectedRole === 'pharmacy' && (
                <span className="grid size-5 place-items-center rounded-full bg-white text-black">
                  <Check className="size-3 stroke-[3]" />
                </span>
              )}
            </div>
            <p className="mt-3 font-semibold text-sm leading-tight">Pharmacy</p>
            <p
              className={cn(
                'mt-1 text-xs leading-relaxed',
                selectedRole === 'pharmacy' ? 'text-neutral-300' : 'text-neutral-500',
              )}
            >
              Pharmacists & dispensary teams
            </p>
          </button>
        </div>
      </div>

      {/* ── Main Authentication Box ── */}
      <div className="rounded-3xl border border-black/15 bg-white p-7 shadow-lift sm:p-9">
        {/* Header with active role badge */}
        <div className="flex items-center justify-between pb-5 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-black text-white shadow-xs">
              <RoleIcon className="size-5" strokeWidth={1.8} />
            </span>
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
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
          <div className="grid grid-cols-2 gap-1 mt-5 p-1 rounded-2xl border border-black/10 bg-neutral-100">
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
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <XCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* ── FORM 1: SIGN IN ── */}
        {mode === 'signin' && (
          <form onSubmit={handleSignInSubmit} className="mt-5 space-y-4" noValidate>
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
                  className="text-xs text-neutral-600 hover:text-black hover:underline"
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
              className="w-full flex items-center justify-center gap-2 rounded-full border border-black bg-black py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-50 transition-all cursor-pointer"
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
              className="w-full flex items-center justify-center gap-2 rounded-full border border-black/30 bg-neutral-50 py-2.5 text-xs font-semibold text-neutral-800 shadow-xs transition-all hover:border-black hover:bg-white cursor-pointer"
            >
              {pending === 'demo' ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-3.5" />}
              Continue with Demo Account ({meta.person})
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
                className="font-semibold text-black underline underline-offset-4 hover:text-neutral-800 cursor-pointer"
              >
                Create Account
              </button>
            </p>
          </form>
        )}

        {/* ── FORM 2: CREATE ACCOUNT ── */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUpSubmit} className="mt-5 space-y-3.5" noValidate>
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
              className="w-full flex items-center justify-center gap-2 rounded-full border border-black bg-black py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-50 transition-all cursor-pointer"
            >
              {pending === 'form' ? <Loader2 className="size-4 animate-spin" /> : null}
              Create {meta.label} Account
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
                className="font-semibold text-black underline underline-offset-4 hover:text-neutral-800 cursor-pointer"
              >
                Sign In
              </button>
            </p>
          </form>
        )}

        {/* ── FORM 3: FORGOT PASSWORD ── */}
        {mode === 'forgot' && (
          <div className="mt-5 space-y-4">
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
                  className="mt-5 inline-flex items-center justify-center rounded-full border border-black bg-black px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 cursor-pointer"
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
                  className="w-full flex items-center justify-center gap-2 rounded-full border border-black bg-black py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 disabled:opacity-50 transition-all cursor-pointer"
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

      {/* Security notice footer */}
      <div className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-neutral-500">
        <ShieldCheck className="size-3.5 text-emerald-600" />
        <span>HIPAA Compliant · End-to-End Encrypted Healthcare Authentication</span>
      </div>
    </div>
  )
}
