'use client'

import { ArrowRight, Check, Clock, Sparkles, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge, Eyebrow } from '@/components/remedium/primitives'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    title: 'A refill gets stuck.',
    body: 'John needs Metformin. The request lands at the pharmacy — and stops. Nobody can say why, or who owns the next move.',
  },
  {
    title: 'Remedium finds the blocker.',
    body: 'AI reads the prescription, refill count and plan rules the moment a request arrives, and names the exact blocker.',
  },
  {
    title: 'Who needs to act?',
    body: 'Every blocker has an owner. Remedium identifies the responsible stakeholder — provider, insurer, pharmacy or patient.',
  },
  {
    title: 'Route the next action.',
    body: 'The case is routed with a pre-assembled summary so the right person can act in one click — not one phone call.',
  },
  {
    title: 'Verify what happened.',
    body: 'Remedium confirms the action actually landed: the approval was signed, the e-Rx arrived, the claim was adjudicated.',
  },
  {
    title: 'Keep every handoff visible.',
    body: 'One shared timeline. Each role sees what matters to them, all backed by the same underlying workflow state.',
  },
  {
    title: 'From stuck to resolved.',
    body: 'Blockers are resolved in sequence until the medication is ready and the patient is notified. Then the case closes.',
  },
]

export function Story() {
  const [active, setActive] = useState(0)
  const refs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index))
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    for (const el of refs.current) if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="how-it-works" className="relative scroll-mt-24 border-t bg-white/60">
      <div className="mx-auto max-w-6xl px-6 pt-24">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          One refill. Seven moments where it usually breaks.
        </h2>
      </div>
      <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-2">
        <div>
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              ref={(el) => {
                refs.current[i] = el
              }}
              data-index={i}
              className="flex min-h-[46vh] flex-col justify-center py-10 lg:min-h-[72vh]"
            >
              <div className={cn('transition-all duration-500', active === i ? 'opacity-100' : 'lg:opacity-30')}>
                <p className="font-mono text-xs text-muted-foreground">0{i + 1} / 0{STEPS.length}</p>
                <h3 className="mt-3 text-3xl font-medium tracking-tight sm:text-5xl">{s.title}</h3>
                <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
              <div className="mt-8 lg:hidden">
                <StoryVisual step={i} />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden lg:block">
          <div className="sticky top-0 flex h-svh items-center">
            <StoryVisual step={active} />
          </div>
        </div>
      </div>
    </section>
  )
}

function Row({ label, value, highlight, tone }: { label: string; value: string; highlight?: boolean; tone?: 'red' | 'violet' | 'amber' | 'green' }) {
  const color =
    tone === 'red' ? 'text-risk' : tone === 'violet' ? 'text-ai' : tone === 'amber' ? 'text-[oklch(0.55_0.13_65)]' : tone === 'green' ? 'text-ok' : ''
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-xl border px-3.5 py-2.5 transition-all duration-500',
        highlight ? 'border-foreground/15 bg-white shadow-soft' : 'border-transparent bg-muted/60',
      )}
    >
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{label}</span>
      <span className={cn('text-sm font-medium', color)}>{value}</span>
    </div>
  )
}

function StoryVisual({ step }: { step: number }) {
  const resolved = step >= 6
  const approved = step >= 4
  return (
    <div className="relative w-full">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_30%_20%,oklch(0.75_0.12_255/0.14),transparent_60%),radial-gradient(circle_at_80%_90%,oklch(0.7_0.15_292/0.1),transparent_60%)]" />
      <div className="glass rounded-3xl border border-foreground/[0.08] p-5 shadow-lift sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground">REFILL #RM-10482</p>
            <p className="mt-1 text-lg font-medium">Metformin 500 mg</p>
            <p className="text-sm text-muted-foreground">John Doe · Harbor Pharmacy #214</p>
          </div>
          {resolved ? (
            <Badge tone="green">Ready</Badge>
          ) : approved ? (
            <Badge tone="blue" pulse>
              Progressing
            </Badge>
          ) : step >= 1 ? (
            <Badge tone="red" pulse>
              Blocked
            </Badge>
          ) : (
            <Badge tone="neutral">Unknown</Badge>
          )}
        </div>

        <div className="mt-5 space-y-2">
          {step === 0 && (
            <div key="s0" className="space-y-2 animate-fade-up">
              <Row label="Status" value="Pending…" />
              <Row label="Blocker" value="Unknown" />
              <Row label="Owner" value="Unassigned" />
              <div className="flex items-center gap-2 rounded-xl border border-dashed px-3.5 py-3 text-sm text-muted-foreground">
                <Clock className="size-4" /> Waiting 47 min · 3 phone calls · no visibility
              </div>
            </div>
          )}
          {step >= 1 && step <= 3 && (
            <div key="s1" className="space-y-2 animate-fade-up">
              <div className="rounded-xl border border-ai/20 bg-ai/[0.05] p-3.5">
                <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-ai">
                  <Sparkles className="size-3" /> AI CASE ANALYSIS
                </p>
                <p className="mt-1.5 text-sm leading-relaxed">
                  Current prescription has <strong className="font-medium">no remaining refills</strong>. Provider authorization is
                  required before dispensing.
                </p>
              </div>
              <Row label="Blocker" value="No refills remaining" highlight={step === 1} tone="red" />
              <Row label="Current owner" value={step >= 2 ? 'Dr. Sarah Williams' : '—'} highlight={step === 2} tone="violet" />
              <Row label="Next action" value={step >= 3 ? 'Provider review requested' : '—'} highlight={step === 3} tone="amber" />
              {step === 3 && (
                <div className="flex items-center justify-center gap-3 rounded-xl border bg-white px-3.5 py-3 text-sm animate-fade-up">
                  <span className="rounded-full border px-3 py-1">Pharmacy</span>
                  <ArrowRight className="size-4 text-ai" />
                  <span className="rounded-full border border-ai/30 bg-ai/[0.06] px-3 py-1 text-ai">Remedium</span>
                  <ArrowRight className="size-4 text-ai" />
                  <span className="rounded-full border bg-foreground px-3 py-1 text-background">Provider</span>
                </div>
              )}
            </div>
          )}
          {step === 4 && (
            <div key="s4" className="space-y-2 animate-fade-up">
              {[
                'Provider decision: Approved · 5 refills',
                'Signature verified',
                'New e-Rx received by pharmacy',
                'Claim routed to Meridian Health PBM',
              ].map((t, i) => (
                <div
                  key={t}
                  className="flex items-center gap-2.5 rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm animate-fade-up"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <span className="grid size-5 place-items-center rounded-full bg-ok/15 text-ok">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {t}
                </div>
              ))}
            </div>
          )}
          {step >= 5 && (
            <ol key="s5" className="relative space-y-3 pl-6 animate-fade-up">
              <span className="absolute top-2 bottom-2 left-[7px] w-px bg-border" />
              {[
                ['Refill requested', '10:42 AM', 'done'],
                ['No refills remaining', '10:43 AM', 'warn'],
                ['Provider approved', '10:47 AM', 'done'],
                ['Coverage confirmed', '10:49 AM', 'done'],
                ['Pharmacy filling', '10:50 AM', resolved ? 'done' : 'active'],
                ['Ready for pickup', resolved ? '11:05 AM' : '—', resolved ? 'done' : 'pending'],
              ].map(([label, time, state]) => (
                <li key={label} className="relative flex items-center justify-between text-sm">
                  <span
                    className={cn(
                      'absolute -left-6 grid size-[15px] place-items-center rounded-full border bg-white',
                      state === 'done' && 'border-ok bg-ok text-white',
                      state === 'warn' && 'border-warn bg-warn text-white',
                      state === 'active' && 'border-info',
                    )}
                  >
                    {state === 'done' && <Check className="size-2.5" strokeWidth={3} />}
                    {state === 'warn' && <TriangleAlert className="size-2" strokeWidth={3} />}
                    {state === 'active' && <span className="size-1.5 rounded-full bg-info animate-pulse-soft" />}
                  </span>
                  <span className={cn(state === 'pending' && 'text-muted-foreground')}>{label}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{time}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {resolved && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-ok/25 bg-ok/[0.07] p-3.5 animate-pop">
            <span className="grid size-8 place-items-center rounded-full bg-ok text-white">
              <Check className="size-4" strokeWidth={2.5} />
            </span>
            <div>
              <p className="text-sm font-medium">Ready for pickup · Patient notified</p>
              <p className="text-xs text-muted-foreground">Resolved in 23 minutes, zero phone calls.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
