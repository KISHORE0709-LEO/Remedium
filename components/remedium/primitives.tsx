import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/remedium/engine'

type PillVariant = 'primary' | 'outline' | 'ghost' | 'success' | 'danger' | 'warn'
type PillSize = 'sm' | 'md' | 'lg'

const pillBase =
  'inline-flex items-center justify-center gap-2 rounded-full border font-medium whitespace-nowrap transition-all duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0'

const pillVariants: Record<PillVariant, string> = {
  primary:
    'border-foreground bg-foreground text-background hover:bg-foreground/88 hover:-translate-y-px hover:shadow-lift',
  outline:
    'border-border bg-white/70 backdrop-blur text-foreground hover:border-foreground/25 hover:bg-white hover:-translate-y-px',
  ghost: 'border-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]',
  success:
    'border-ok/40 bg-ok/10 text-[oklch(0.42_0.11_158)] hover:bg-ok hover:text-white hover:border-ok hover:-translate-y-px',
  danger:
    'border-risk/35 bg-risk/[0.07] text-[oklch(0.48_0.18_25)] hover:bg-risk hover:text-white hover:border-risk hover:-translate-y-px',
  warn:
    'border-warn/45 bg-warn/10 text-[oklch(0.5_0.12_70)] hover:bg-warn hover:text-white hover:border-warn hover:-translate-y-px',
}

const pillSizes: Record<PillSize, string> = {
  sm: 'h-8 px-3.5 text-[13px]',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-6 text-[15px]',
}

export function pillClass(variant: PillVariant = 'outline', size: PillSize = 'md', className?: string) {
  return cn(pillBase, pillVariants[variant], pillSizes[size], className)
}

export function Pill({
  variant = 'outline',
  size = 'md',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: PillVariant; size?: PillSize }) {
  return <button type="button" className={pillClass(variant, size, className)} {...props} />
}

export function PillLink({
  variant = 'outline',
  size = 'md',
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: PillVariant; size?: PillSize }) {
  return <Link className={pillClass(variant, size, className)} {...props} />
}

export const toneText: Record<Tone, string> = {
  green: 'text-[oklch(0.45_0.12_158)]',
  amber: 'text-[oklch(0.52_0.13_65)]',
  red: 'text-[oklch(0.5_0.19_25)]',
  blue: 'text-[oklch(0.47_0.16_255)]',
  violet: 'text-[oklch(0.47_0.2_292)]',
  neutral: 'text-muted-foreground',
}

export const toneBg: Record<Tone, string> = {
  green: 'bg-ok',
  amber: 'bg-warn',
  red: 'bg-risk',
  blue: 'bg-info',
  violet: 'bg-ai',
  neutral: 'bg-muted-foreground/50',
}

const toneSoft: Record<Tone, string> = {
  green: 'bg-ok/10 border-ok/25',
  amber: 'bg-warn/10 border-warn/30',
  red: 'bg-risk/[0.07] border-risk/25',
  blue: 'bg-info/[0.07] border-info/20',
  violet: 'bg-ai/[0.07] border-ai/20',
  neutral: 'bg-muted border-border',
}

export function StatusDot({ tone, pulse = false, className }: { tone: Tone; pulse?: boolean; className?: string }) {
  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)} aria-hidden="true">
      {pulse && <span className={cn('absolute inset-0 rounded-full opacity-60 animate-ping', toneBg[tone])} />}
      <span className={cn('relative inline-flex size-2 rounded-full', toneBg[tone])} />
    </span>
  )
}

export function Badge({
  tone,
  children,
  pulse,
  className,
}: {
  tone: Tone
  children: ReactNode
  pulse?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider',
        toneSoft[tone],
        toneText[tone],
        className,
      )}
    >
      <StatusDot tone={tone} pulse={pulse} />
      {children}
    </span>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground', className)}>
      {children}
    </p>
  )
}

export function Logo({ className, href = '/' }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn('group inline-flex items-center gap-2.5', className)} aria-label="Remedium home">
      <LogoMark />
      <span className="text-[13px] font-semibold tracking-[0.28em]">REMEDIUM</span>
    </Link>
  )
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative grid size-7 place-items-center rounded-full border border-foreground/10 bg-white shadow-soft',
        className,
      )}
      aria-hidden="true"
    >
      <span className="absolute inset-1 rounded-full bg-[conic-gradient(from_200deg,var(--info),var(--ai),var(--teal),var(--info))] opacity-90" />
      <span className="relative size-2 rounded-full bg-white" />
    </span>
  )
}

export function Panel({ className, children, ...props }: ComponentProps<'section'>) {
  return (
    <section className={cn('rounded-2xl border bg-card shadow-soft', className)} {...props}>
      {children}
    </section>
  )
}
