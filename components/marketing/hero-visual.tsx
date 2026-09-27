'use client'

import { Building2, Pill as PillIcon, ShieldCheck, Stethoscope, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type NodeKey = 'patient' | 'pharmacy' | 'provider' | 'insurance' | 'core'

const NODES: Record<Exclude<NodeKey, 'core'>, { x: number; y: number; label: string; sub: string; Icon: typeof User }> = {
  patient: { x: 12, y: 50, label: 'Patient', sub: 'John Doe', Icon: User },
  pharmacy: { x: 50, y: 12, label: 'Pharmacy', sub: 'Harbor #214', Icon: Building2 },
  provider: { x: 88, y: 50, label: 'Provider', sub: 'Dr. Williams', Icon: Stethoscope },
  insurance: { x: 50, y: 88, label: 'Insurance', sub: 'Meridian PBM', Icon: ShieldCheck },
}

const SEQUENCE: { at: NodeKey; caption: string; detail: string; tone: 'blue' | 'violet' | 'amber' | 'green' }[] = [
  { at: 'patient', caption: 'Refill requested', detail: 'Metformin 500 mg', tone: 'blue' },
  { at: 'pharmacy', caption: 'Pharmacy review', detail: 'Case RM-10482 opened', tone: 'blue' },
  { at: 'core', caption: 'Blocker detected', detail: 'No refills remaining', tone: 'violet' },
  { at: 'provider', caption: 'Routed to provider', detail: 'Dr. Williams · approved', tone: 'amber' },
  { at: 'insurance', caption: 'Coverage verification', detail: 'Tier 1 · confirmed', tone: 'amber' },
  { at: 'core', caption: 'Result verified', detail: 'Shared state updated', tone: 'violet' },
  { at: 'pharmacy', caption: 'Pharmacy filling', detail: 'All blockers cleared', tone: 'blue' },
  { at: 'patient', caption: 'Ready for pickup', detail: 'Patient notified', tone: 'green' },
]

const toneColor = {
  blue: 'var(--info)',
  violet: 'var(--ai)',
  amber: 'var(--warn)',
  green: 'var(--ok)',
}

function pos(key: NodeKey) {
  return key === 'core' ? { x: 50, y: 50 } : NODES[key]
}

export function HeroVisual() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => (s + 1) % SEQUENCE.length), 1900)
    return () => window.clearInterval(id)
  }, [])

  const current = SEQUENCE[step]
  const token = pos(current.at)
  const doneCount = step + 1

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px]" aria-hidden="true">
      <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle_at_50%_50%,oklch(0.55_0.2_292/0.12),transparent_62%)]" />

      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id="spoke" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--info)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--ai)" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="38" fill="none" stroke="oklch(0.2 0.03 262 / 0.09)" strokeWidth="0.25" />
        <g className="origin-center animate-spin-slow" style={{ transformBox: 'fill-box' }}>
          <circle cx="50" cy="50" r="46" fill="none" stroke="oklch(0.2 0.03 262 / 0.08)" strokeWidth="0.2" strokeDasharray="0.6 2.4" />
        </g>
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke="url(#spoke)"
          strokeWidth="0.35"
          strokeDasharray="1.5 2.5"
          className="animate-dash"
        />
        {(['patient', 'pharmacy', 'provider', 'insurance'] as const).map((k) => {
          const n = NODES[k]
          const active = current.at === k || current.at === 'core'
          return (
            <line
              key={k}
              x1={n.x}
              y1={n.y}
              x2="50"
              y2="50"
              stroke="url(#spoke)"
              strokeWidth={active ? 0.45 : 0.25}
              strokeDasharray="1 1.5"
              className="animate-dash transition-all duration-500"
              opacity={active ? 1 : 0.55}
            />
          )
        })}
      </svg>

      {/* central core */}
      <div className="absolute top-1/2 left-1/2 size-[30%] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute -inset-[18%] rounded-full border border-dashed border-ai/25 animate-spin-reverse" />
        <div className="absolute -inset-[8%] rounded-full border border-info/20" />
        <div
          className={cn(
            'absolute inset-0 overflow-hidden rounded-full border border-white/80 shadow-lift transition-transform duration-700',
            current.at === 'core' && 'scale-105',
          )}
        >
          <div className="absolute inset-0 bg-[conic-gradient(from_120deg,oklch(0.7_0.14_255),oklch(0.62_0.2_292),oklch(0.75_0.11_195),oklch(0.7_0.14_255))] animate-spin-slow" />
          <div className="absolute inset-[6%] rounded-full bg-white/70 backdrop-blur-xl" />
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-mono text-[9px] tracking-[0.25em] text-muted-foreground sm:text-[10px]">REMEDIUM</p>
              <p className="text-[13px] font-semibold tracking-tight sm:text-base">AI Core</p>
              <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-ai/20 bg-ai/[0.06] px-2 py-0.5 font-mono text-[8px] text-ai sm:text-[9px]">
                <span className="size-1 rounded-full bg-ai animate-pulse-soft" />
                ORCHESTRATING
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* nodes */}
      {(Object.keys(NODES) as (keyof typeof NODES)[]).map((k) => {
        const n = NODES[k]
        const active = current.at === k
        return (
          <div
            key={k}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
          >
            <div
              className={cn(
                'glass flex items-center gap-2 rounded-full border py-1.5 pr-3 pl-1.5 shadow-soft transition-all duration-500 sm:gap-2.5 sm:py-2 sm:pr-4 sm:pl-2',
                active ? 'scale-105 border-foreground/20 shadow-lift' : 'border-foreground/[0.08]',
              )}
            >
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-full border transition-colors duration-500 sm:size-8',
                  active ? 'border-transparent bg-foreground text-background' : 'bg-white text-foreground/70',
                )}
              >
                <n.Icon className="size-3 sm:size-3.5" strokeWidth={1.75} />
              </span>
              <span className="leading-tight">
                <span className="block text-[10px] font-medium sm:text-xs">{n.label}</span>
                <span className="hidden font-mono text-[9px] text-muted-foreground sm:block">{n.sub}</span>
              </span>
            </div>
          </div>
        )
      })}

      {/* moving prescription token */}
      <div
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-[1100ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
        style={{ left: `${token.x}%`, top: `${token.y + (current.at === 'core' ? 0 : 9)}%` }}
      >
        <div
          className="flex items-center gap-1.5 rounded-full border border-white bg-white px-2 py-1 shadow-lift"
          style={{ boxShadow: `0 0 0 4px color-mix(in oklch, ${toneColor[current.tone]} 18%, transparent), 0 12px 24px -12px oklch(0.2 0.03 262 / 0.35)` }}
        >
          <PillIcon className="size-3" style={{ color: toneColor[current.tone] }} strokeWidth={2} />
          <span className="font-mono text-[9px] font-medium">RM-10482</span>
        </div>
      </div>

      {/* live caption card */}
      <div className="absolute right-0 bottom-[2%] left-auto w-[46%] min-w-44 sm:right-[-2%]">
        <div key={step} className="glass rounded-2xl border border-foreground/[0.08] p-3 shadow-lift animate-fade-up">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] tracking-widest text-muted-foreground">LIVE CASE</span>
            <span className="font-mono text-[9px] text-muted-foreground">
              {doneCount}/{SEQUENCE.length}
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium">
            <span className="size-1.5 rounded-full" style={{ background: toneColor[current.tone] }} />
            {current.caption}
          </p>
          <p className="text-xs text-muted-foreground">{current.detail}</p>
          <div className="mt-2.5 flex gap-1">
            {SEQUENCE.map((s, i) => (
              <span
                key={s.caption + i}
                className="h-0.5 flex-1 rounded-full transition-colors duration-500"
                style={{ background: i <= step ? toneColor[SEQUENCE[i].tone] : 'oklch(0.2 0.03 262 / 0.1)' }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* floating rx card */}
      <div className="absolute top-[3%] left-[-2%] hidden w-44 animate-float sm:block">
        <div className="glass rounded-2xl border border-foreground/[0.08] p-3 shadow-soft">
          <p className="font-mono text-[9px] tracking-widest text-muted-foreground">RX · METFORMIN</p>
          <p className="mt-1 text-[13px] font-medium">500 mg · 60 tabs</p>
          <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-2 font-mono text-[9px]">
            <span className="text-muted-foreground">REFILLS</span>
            <span className={cn('text-right transition-colors', step >= 3 ? 'text-ok' : 'text-risk')}>{step >= 3 ? '5' : '0'}</span>
            <span className="text-muted-foreground">SUPPLY</span>
            <span className="text-right">2 days</span>
          </div>
        </div>
      </div>
    </div>
  )
}
