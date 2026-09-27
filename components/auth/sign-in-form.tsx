'use client'

import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
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
import Spline from '@splinetool/react-spline'
import { Logo } from '@/components/remedium/primitives'
import { auth, db, googleProvider } from '@/lib/firebase'
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'

type AuthRole = 'provider' | 'pharmacy'

const inputClass =
  'h-11 w-full rounded-xl border border-border bg-white px-3.5 pr-10 text-sm shadow-xs transition-all outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10'

function GoogleIcon() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      or continue with
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

export function SignInForm({
  role: initialRole = 'provider',
  initialStep = 'role-select',
}: {
  role?: Role
  initialStep?: 'role-select' | 'auth'
} = {}) {
  const router = useRouter()
  const startRole: AuthRole = initialRole === 'pharmacy' ? 'pharmacy' : 'provider'
  const [selectedRole, setSelectedRole] = useState<AuthRole>(startRole)
  const [step, setStep] = useState<'role-select' | 'auth'>(initialStep)
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
  const meta = ROLE_META[selectedRole] ?? ROLE_META.provider
  const RoleIcon = meta?.Icon ?? Stethoscope
  const [signInIdentifier, setSignInIdentifier] = useState('')
  const [signInPassword, setSignInPassword] = useState('')
  const [showSignInPassword, setShowSignInPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [signUpName, setSignUpName] = useState('')
  const [signUpOrg, setSignUpOrg] = useState('')
  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('')
  const [showSignUpPassword, setShowSignUpPassword] = useState(false)
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSubmitted, setForgotSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, setPending] = useState<'form' | 'google' | 'demo' | null>(null)
  const passLength = signUpPassword.length >= 8
  const passHasNumber = /\d/.test(signUpPassword)
  const passHasUpper = /[A-Z]/.test(signUpPassword)
  const passMatches = signUpPassword.length > 0 && signUpPassword === signUpConfirmPassword

  function navigateToDashboard(role: AuthRole) {
    window.setTimeout(() => router.push(`/app/${role}`), 600)
  }

  async function handleSignInSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setSuccess(null)
    if (!signInIdentifier.trim()) return setError('Please enter your email or username.')
    if (signInPassword.length < 6) return setError('Password must be at least 6 characters.')
    setPending('form')
    try {
      const userCred = await signInWithEmailAndPassword(auth, signInIdentifier, signInPassword)
      await setDoc(
        doc(db, 'users', userCred.user.uid),
        {
          uid: userCred.user.uid,
          email: userCred.user.email,
          role: selectedRole,
          pharmacyId: selectedRole === 'pharmacy' ? 'harbor-pharmacy-214' : null,
          providerId: selectedRole === 'provider' ? 'dr-sarah-williams' : null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ).catch(() => {})
      setSuccess(`Signing in as ${meta.label}...`); navigateToDashboard(selectedRole)
    } catch (err: any) { setError(err.message || 'Failed to sign in.'); setPending(null) }
  }

  async function handleSignUpSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setSuccess(null)
    if (!signUpName.trim()) return setError('Please enter your full name.')
    if (!signUpOrg.trim()) return setError(selectedRole === 'provider' ? 'Please enter your practice or clinic name.' : 'Please enter your pharmacy name.')
    if (!/^\S+@\S+\.\S+$/.test(signUpEmail)) return setError('Please enter a valid work email address.')
    if (!passLength || !passHasNumber || !passHasUpper) return setError('Please satisfy all password requirements.')
    if (signUpPassword !== signUpConfirmPassword) return setError('Passwords do not match.')
    if (!agreeTerms) return setError('You must accept the Terms of Service & HIPAA Compliance Agreement.')
    setPending('form')
    try {
      const userCred = await createUserWithEmailAndPassword(auth, signUpEmail, signUpPassword)
      await setDoc(
        doc(db, 'users', userCred.user.uid),
        {
          uid: userCred.user.uid,
          email: signUpEmail,
          name: signUpName,
          org: signUpOrg,
          role: selectedRole,
          pharmacyId: selectedRole === 'pharmacy' ? 'harbor-pharmacy-214' : null,
          providerId: selectedRole === 'provider' ? 'dr-sarah-williams' : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ).catch(() => {})
      setSuccess(`Account created! Launching your ${meta.label} workspace...`); navigateToDashboard(selectedRole)
    } catch (err: any) { setError(err.message || 'Failed to create account.'); setPending(null) }
  }

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault(); setError(null)
    if (!/^\S+@\S+\.\S+$/.test(forgotEmail)) return setError('Please enter a valid email address.')
    setPending('form')
    try {
      await sendPasswordResetEmail(auth, forgotEmail); setPending(null); setForgotSubmitted(true)
    } catch (err: any) { setError(err.message || 'Failed to send reset email.'); setPending(null) }
  }

  async function handleGoogleLogin() {
    setError(null); setSuccess(null); setPending('google')
    try {
      const userCred = await signInWithPopup(auth, googleProvider)
      await setDoc(
        doc(db, 'users', userCred.user.uid),
        {
          uid: userCred.user.uid,
          email: userCred.user.email,
          role: selectedRole,
          pharmacyId: selectedRole === 'pharmacy' ? 'harbor-pharmacy-214' : null,
          providerId: selectedRole === 'provider' ? 'dr-sarah-williams' : null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ).catch(() => {})
      setSuccess(`Authenticated via Google (${meta.label})`); navigateToDashboard(selectedRole)
    } catch (err: any) { setError(err.message || 'Failed to authenticate with Google.'); setPending(null) }
  }

  function handleDemoLogin() {
    setError(null); setSuccess(null); setPending('demo')
    setSignInIdentifier(meta.email)
    setSuccess(`Authenticated as ${meta.person} (${meta.label})`); navigateToDashboard(selectedRole)
  }

  // ── ROLE SELECT ─────────────────────────────────────────────────────────────
  if (step === 'role-select') {
    return (
      <div className="relative min-h-screen w-full overflow-hidden bg-background">
        {/* Same grid + glows as homepage hero */}
        <div className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,black,transparent)]" />
        <div className="absolute -top-40 right-[-5%] -z-10 size-[600px] rounded-full bg-[radial-gradient(circle,oklch(0.75_0.12_255/0.18),transparent_65%)]" />
        <div className="absolute bottom-[-10%] left-[-10%] -z-10 size-[520px] rounded-full bg-[radial-gradient(circle,oklch(0.8_0.1_195/0.16),transparent_65%)]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -z-10 size-[400px] rounded-full bg-[radial-gradient(circle,oklch(0.7_0.15_292/0.08),transparent_70%)]" />

        {/* Header — exactly matches site-nav style */}
        <header className="absolute left-0 top-0 z-20 flex w-full items-center justify-between px-8 py-5 sm:px-12">
          <Logo />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-white/80 px-4 py-2 text-xs font-medium text-foreground/70 shadow-soft backdrop-blur-sm transition-all hover:border-foreground/20 hover:bg-white hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to site
          </Link>
        </header>

        {/* Main content — elevated nicely */}
        <main className="relative z-10 flex min-h-screen flex-col items-center justify-start px-6 pt-24 pb-12 sm:pt-28 sm:pb-16 sm:px-12">
          {/* Eyebrow badge */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-white/80 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-soft backdrop-blur-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-ok" />
            </span>
            Secure Healthcare Portal
          </div>

          {/* Headline — same typographic style as hero */}
          <div className="text-center">
            <h1 className="text-4xl font-medium tracking-[-0.035em] text-balance text-foreground sm:text-5xl lg:text-6xl">
              Welcome to{' '}
              <span className="text-gradient">Remedium</span>
            </h1>
            <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
              Select your role below to securely sign in or create your workspace account.
            </p>
          </div>

          {/* Role Cards — Pharmacy first, Provider/Practice second */}
          <div className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Pharmacy Card (First) */}
            <button
              type="button"
              onClick={() => { setSelectedRole('pharmacy'); setStep('auth'); setError(null); setSuccess(null) }}
              className="group relative flex min-h-[250px] flex-col overflow-hidden rounded-3xl border border-border bg-card p-7 text-left shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-lift"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,oklch(0.8_0.1_195/0.10),transparent_60%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative z-10 flex flex-1 flex-col justify-between">
                <div>
                  <div className="mb-5 inline-grid size-13 place-items-center rounded-2xl border border-foreground/10 bg-foreground text-background shadow-soft">
                    <Building2 className="size-6.5" />
                  </div>
                  <h3 className="text-xl font-medium tracking-tight text-foreground">Pharmacy</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Process Rx requests, resolve PA issues, and manage prescription workflows efficiently.
                  </p>
                  <ul className="mt-4 space-y-2">
                    {['Rx request processing', 'PA resolution', 'Prescription tracking'].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Check className="size-3.5 text-ok shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">Get started</span>
                  <div className="grid size-8.5 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-all group-hover:border-foreground group-hover:bg-foreground group-hover:text-background">
                    <ChevronRight className="size-4" />
                  </div>
                </div>
              </div>
            </button>

            {/* Provider / Practice Card (Second) */}
            <button
              type="button"
              onClick={() => { setSelectedRole('provider'); setStep('auth'); setError(null); setSuccess(null) }}
              className="group relative flex min-h-[250px] flex-col overflow-hidden rounded-3xl border border-border bg-card p-7 text-left shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-lift"
            >
              {/* Hover glow using site info color */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,oklch(0.75_0.12_255/0.08),transparent_60%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative z-10 flex flex-1 flex-col justify-between">
                <div>
                  <div className="mb-5 inline-grid size-13 place-items-center rounded-2xl border border-foreground/10 bg-foreground text-background shadow-soft">
                    <Stethoscope className="size-6.5" />
                  </div>
                  <h3 className="text-xl font-medium tracking-tight text-foreground">Provider / Practice</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Manage patient refills, coordinate care, and streamline prior authorization workflows.
                  </p>
                  <ul className="mt-4 space-y-2">
                    {['Patient refill management', 'Care coordination', 'PA automation'].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Check className="size-3.5 text-ok shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">Get started</span>
                  <div className="grid size-8.5 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-all group-hover:border-foreground group-hover:bg-foreground group-hover:text-background">
                    <ChevronRight className="size-4" />
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-ok" />
            <span>HIPAA Compliant · End-to-End Encrypted · SOC 2 Type II</span>
          </div>
        </main>
      </div>
    )
  }

  // ── AUTH FORM ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen w-full bg-background">
      <div className="relative flex w-full flex-col lg:w-1/2">
        {/* Same subtle grid on left side */}
        <div className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_60%_80%_at_30%_50%,black,transparent)]" />
        <div className="absolute top-0 right-0 -z-10 size-[400px] rounded-full bg-[radial-gradient(circle,oklch(0.75_0.12_255/0.1),transparent_65%)]" />

        <header className="absolute left-0 top-0 z-20 flex w-full items-center justify-between px-8 py-6 sm:px-10">
          <Logo />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-white/80 px-4 py-2 text-xs font-medium text-foreground/70 shadow-soft backdrop-blur-sm transition-all hover:border-foreground/20 hover:bg-white hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to site
          </Link>
        </header>

        <div className="flex flex-1 flex-col justify-center px-6 pt-24 pb-12 sm:px-12 lg:px-14 xl:px-20">
          <div className="mx-auto w-full max-w-md">
            {/* Change role pill */}
            <button
              type="button"
              onClick={() => { setStep('role-select'); setMode('signin'); setError(null); setSuccess(null) }}
              className="group mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-xs font-medium text-muted-foreground shadow-soft transition-all hover:border-foreground/20 hover:text-foreground hover:shadow-lift"
            >
              <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
              Change Role
            </button>

            {/* Auth card */}
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-7 shadow-lift sm:p-8">
              {/* Ambient glow using site palette */}
              <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-[radial-gradient(circle,oklch(0.75_0.12_255/0.12),transparent_70%)]" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full bg-[radial-gradient(circle,oklch(0.8_0.1_195/0.10),transparent_70%)]" />

              {/* Role badge */}
              <div className="relative z-10 mb-6 flex items-center gap-3 border-b border-border pb-5">
                <span className="grid size-10 place-items-center rounded-xl border border-foreground/10 bg-foreground text-background shadow-soft">
                  <RoleIcon className="size-5" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="font-mono text-[10px] font-semibold tracking-wider text-primary uppercase">{meta.workspace}</p>
                  <h2 className="text-lg font-medium tracking-tight text-foreground leading-tight">
                    {mode === 'signin' && `Sign In · ${meta.label}`}
                    {mode === 'signup' && `Create Account · ${meta.label}`}
                    {mode === 'forgot' && 'Reset Password'}
                  </h2>
                </div>
              </div>

              {/* Tab switcher */}
              {mode !== 'forgot' && (
                <div className="relative z-10 mb-5 grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted p-1">
                  <button type="button" onClick={() => { setMode('signin'); setError(null); setSuccess(null) }}
                    className={cn('rounded-lg py-2 text-xs font-medium transition-all', mode === 'signin' ? 'bg-card text-foreground shadow-soft border border-border/60' : 'text-muted-foreground hover:text-foreground')}>
                    Sign In
                  </button>
                  <button type="button" onClick={() => { setMode('signup'); setError(null); setSuccess(null) }}
                    className={cn('rounded-lg py-2 text-xs font-medium transition-all', mode === 'signup' ? 'bg-card text-foreground shadow-soft border border-border/60' : 'text-muted-foreground hover:text-foreground')}>
                    Create Account
                  </button>
                </div>
              )}

              {/* Alerts */}
              {error && (
                <div className="relative z-10 mb-4 flex items-start gap-2.5 rounded-xl border border-risk/25 bg-risk/[0.07] p-3 text-xs text-[oklch(0.48_0.18_25)]">
                  <XCircle className="size-4 shrink-0 mt-0.5" /><span>{error}</span>
                </div>
              )}
              {success && (
                <div className="relative z-10 mb-4 flex items-start gap-2.5 rounded-xl border border-ok/25 bg-ok/[0.07] p-3 text-xs text-[oklch(0.42_0.11_158)]">
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5" /><span>{success}</span>
                </div>
              )}

              {/* Sign In */}
              {mode === 'signin' && (
                <form onSubmit={handleSignInSubmit} className="relative z-10 space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <label htmlFor="si-user" className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Email or Username</label>
                    <div className="relative">
                      <input id="si-user" type="text" autoComplete="username" placeholder={meta.email} value={signInIdentifier} onChange={(e) => setSignInIdentifier(e.target.value)} className={inputClass} />
                      <Mail className="absolute right-3.5 top-3.5 size-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="si-pass" className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Password</label>
                      <button type="button" onClick={() => { setError(null); setMode('forgot') }} className="text-xs text-primary font-medium hover:underline">Forgot password?</button>
                    </div>
                    <div className="relative">
                      <input id="si-pass" type={showSignInPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••••••" value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)} className={inputClass} />
                      <button type="button" onClick={() => setShowSignInPassword((p) => !p)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors" aria-label="Toggle password">
                        {showSignInPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground select-none">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="size-4 rounded border-border accent-foreground" />
                    Remember me on this device
                  </label>
                  <button type="submit" disabled={pending !== null} className="w-full flex items-center justify-center gap-2 rounded-full border border-foreground bg-foreground py-2.5 text-sm font-medium text-background shadow-sm hover:bg-foreground/88 hover:-translate-y-px hover:shadow-lift disabled:opacity-50 transition-all cursor-pointer">
                    {pending === 'form' ? <Loader2 className="size-4 animate-spin" /> : null}
                    Sign In to {meta.label}
                  </button>
                  <OrDivider />
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={handleGoogleLogin} disabled={pending !== null} className="flex items-center justify-center gap-2 rounded-full border border-border bg-card py-2.5 text-sm font-medium text-foreground hover:-translate-y-px hover:shadow-soft cursor-pointer transition-all">
                      {pending === 'google' ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}Google
                    </button>
                    <button type="button" onClick={handleDemoLogin} disabled={pending !== null} className="flex items-center justify-center gap-2 rounded-full border border-border bg-card py-2.5 text-sm font-medium text-foreground hover:-translate-y-px hover:shadow-soft cursor-pointer transition-all">
                      {pending === 'demo' ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-3.5" />}Demo
                    </button>
                  </div>
                  <p className="text-center text-xs text-muted-foreground pt-1">
                    Don&apos;t have an account?{' '}
                    <button type="button" onClick={() => { setMode('signup'); setError(null) }} className="font-medium text-primary hover:underline cursor-pointer">Create one</button>
                  </p>
                </form>
              )}

              {/* Sign Up */}
              {mode === 'signup' && (
                <form onSubmit={handleSignUpSubmit} className="relative z-10 space-y-3" noValidate>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="su-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Full Name</label>
                      <div className="relative">
                        <input id="su-name" type="text" placeholder="Dr. Jane Smith" value={signUpName} onChange={(e) => setSignUpName(e.target.value)} className={inputClass} />
                        <User className="absolute right-3.5 top-3.5 size-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="su-org" className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">{selectedRole === 'provider' ? 'Practice' : 'Pharmacy'}</label>
                      <div className="relative">
                        <input id="su-org" type="text" placeholder={selectedRole === 'provider' ? 'Bayview Medicine' : 'Harbor Pharmacy'} value={signUpOrg} onChange={(e) => setSignUpOrg(e.target.value)} className={inputClass} />
                        <Building2 className="absolute right-3.5 top-3.5 size-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="su-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Work Email</label>
                    <div className="relative">
                      <input id="su-email" type="email" placeholder="name@practice.com" value={signUpEmail} onChange={(e) => setSignUpEmail(e.target.value)} className={inputClass} />
                      <Mail className="absolute right-3.5 top-3.5 size-4 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="su-pass" className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Password</label>
                    <div className="relative">
                      <input id="su-pass" type={showSignUpPassword ? 'text' : 'password'} placeholder="Create a strong password" value={signUpPassword} onChange={(e) => setSignUpPassword(e.target.value)} className={inputClass} />
                      <button type="button" onClick={() => setShowSignUpPassword((p) => !p)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors">
                        {showSignUpPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-muted p-2 text-[11px]">
                      {[{ ok: passLength, label: '8+ chars' }, { ok: passHasNumber, label: '1+ number' }, { ok: passHasUpper, label: '1+ uppercase' }].map(({ ok, label }) => (
                        <span key={label} className={cn('flex items-center gap-1 font-medium', ok ? 'text-[oklch(0.42_0.11_158)]' : 'text-muted-foreground')}>
                          <Check className={cn('size-3 stroke-[2.5]', ok ? 'opacity-100' : 'opacity-30')} />{label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="su-confirm" className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Confirm Password</label>
                    <div className="relative">
                      <input id="su-confirm" type={showSignUpConfirmPassword ? 'text' : 'password'} placeholder="Re-enter your password" value={signUpConfirmPassword} onChange={(e) => setSignUpConfirmPassword(e.target.value)} className={inputClass} />
                      <button type="button" onClick={() => setShowSignUpConfirmPassword((p) => !p)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors">
                        {showSignUpConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    {signUpConfirmPassword && (
                      <p className={cn('text-[11px] font-medium pt-0.5', passMatches ? 'text-[oklch(0.42_0.11_158)]' : 'text-[oklch(0.48_0.18_25)]')}>
                        {passMatches ? '✓ Passwords match' : '✗ Passwords do not match'}
                      </p>
                    )}
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer text-xs text-muted-foreground select-none pt-1">
                    <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-0.5 size-4 rounded border-border accent-foreground" />
                    <span>I agree to Remedium&apos;s <span className="font-medium underline text-foreground">Terms of Service</span> and <span className="font-medium underline text-foreground">HIPAA Compliance Agreement</span>.</span>
                  </label>
                  <button type="submit" disabled={pending !== null} className="w-full flex items-center justify-center gap-2 rounded-full border border-foreground bg-foreground py-2.5 text-sm font-medium text-background shadow-sm hover:bg-foreground/88 hover:-translate-y-px hover:shadow-lift disabled:opacity-50 transition-all cursor-pointer">
                    {pending === 'form' ? <Loader2 className="size-4 animate-spin" /> : null}Create Account
                  </button>
                  <OrDivider />
                  <button type="button" onClick={handleGoogleLogin} disabled={pending !== null} className="w-full flex items-center justify-center gap-2 rounded-full border border-border bg-card py-2.5 text-sm font-medium text-foreground hover:-translate-y-px hover:shadow-soft cursor-pointer transition-all">
                    {pending === 'google' ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}Continue with Google
                  </button>
                  <p className="text-center text-xs text-muted-foreground pt-1">
                    Already have an account?{' '}
                    <button type="button" onClick={() => { setMode('signin'); setError(null) }} className="font-medium text-primary hover:underline cursor-pointer">Sign In</button>
                  </p>
                </form>
              )}

              {/* Forgot */}
              {mode === 'forgot' && (
                <div className="relative z-10 space-y-4">
                  {forgotSubmitted ? (
                    <div className="rounded-2xl border border-ok/25 bg-ok/[0.07] p-5 text-center">
                      <div className="mx-auto grid size-12 place-items-center rounded-full bg-ok/10 text-[oklch(0.42_0.11_158)] mb-3"><CheckCircle2 className="size-6" /></div>
                      <h3 className="text-sm font-medium text-foreground">Check Your Email</h3>
                      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">We&apos;ve sent a reset link to <span className="font-medium text-foreground">{forgotEmail}</span>. It expires in 30 minutes.</p>
                      <button type="button" onClick={() => { setForgotSubmitted(false); setForgotEmail(''); setMode('signin') }} className="mt-4 text-xs font-medium text-primary hover:underline">Back to Sign In</button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotSubmit} className="space-y-4" noValidate>
                      <p className="text-xs text-muted-foreground leading-relaxed">Enter your registered email and we&apos;ll send a secure reset link.</p>
                      <div className="space-y-1.5">
                        <label htmlFor="fp-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Email Address</label>
                        <div className="relative">
                          <input id="fp-email" type="email" autoComplete="email" placeholder="name@practice.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className={inputClass} />
                          <KeyRound className="absolute right-3.5 top-3.5 size-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                      <button type="submit" disabled={pending !== null} className="w-full flex items-center justify-center gap-2 rounded-full border border-foreground bg-foreground py-2.5 text-sm font-medium text-background shadow-sm hover:bg-foreground/88 hover:-translate-y-px hover:shadow-lift disabled:opacity-50 transition-all cursor-pointer">
                        {pending === 'form' ? <Loader2 className="size-4 animate-spin" /> : null}Send Reset Link
                      </button>
                      <p className="text-center text-xs text-muted-foreground">
                        <button type="button" onClick={() => { setMode('signin'); setError(null) }} className="font-medium text-primary hover:underline cursor-pointer">Back to Sign In</button>
                      </p>
                    </form>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-ok" />
              <span>HIPAA Compliant · End-to-End Encrypted</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right column — Spline (light purple background matching project theme) */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-[oklch(0.965_0.025_292)] border-l border-border">
        {/* Subtle grid with same style as home */}
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_80%_75%_at_50%_50%,black,transparent)] opacity-60" />
        
        {/* Soft lavender/purple ambient glows matching home page */}
        <div className="pointer-events-none absolute -top-24 right-[-10%] size-[520px] rounded-full bg-[radial-gradient(circle,oklch(0.75_0.12_255/0.25),transparent_65%)]" />
        <div className="pointer-events-none absolute -bottom-24 left-[-10%] size-[480px] rounded-full bg-[radial-gradient(circle,oklch(0.7_0.15_292/0.25),transparent_65%)]" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[420px] rounded-full bg-[radial-gradient(circle,oklch(0.85_0.09_292/0.4),transparent_65%)]" />
        
        <div className="absolute inset-0 flex items-center justify-center">
          <Spline scene="https://prod.spline.design/rU2-Ks0SC0T5od9B/scene.splinecode" />
        </div>
        <div className="absolute bottom-8 left-0 right-0 z-10 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-white/80 px-4 py-2 text-xs font-medium text-foreground/80 shadow-soft backdrop-blur-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-ok" />
            </span>
            AI-powered healthcare assistant
          </div>
        </div>
      </div>
    </div>
  )
}
