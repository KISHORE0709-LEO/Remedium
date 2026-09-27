'use client'

import { Check, Sparkles } from 'lucide-react'
import { analyzeCase } from '@/lib/remedium/engine'
import type { RefillCase } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'

export function AiAnalysis({ refill, compact = false, className }: { refill: RefillCase; compact?: boolean; className?: string }) {
  const insight = analyzeCase(refill)
  const analyzing = refill.status === 'CHECKING' || refill.status === 'REQUESTED'
  return (
    <section
      aria-label="Remedium AI case analysis"
      className={cn(
        'relative overflow-hidden rounded-2xl border border-ai/20 bg-[linear-gradient(135deg,oklch(0.97_0.02_292),oklch(0.985_0.01_255))] p-5',
        className,
      )}
    >
      {analyzing && (
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_30%,oklch(1_0_0/0.7)_50%,transparent_70%)] bg-[length:200%_100%] animate-shimmer" />
      )}
      <div className="relative flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-[0.18em] text-ai">
          <Sparkles className="size-3.5" /> AI CASE ANALYSIS
        </p>
        <span className="font-mono text-[10px] text-muted-foreground">
          {analyzing ? 'analyzing…' : `confidence ${Math.round(insight.confidence * 100)}%`}
        </span>
      </div>
      <p className="relative mt-3 text-[15px] leading-relaxed text-pretty">{insight.summary}</p>
      {!compact && insight.signals.length > 0 && (
        <ul className="relative mt-4 flex flex-wrap gap-1.5">
          {insight.signals.map((s) => (
            <li key={s} className="inline-flex items-center gap-1.5 rounded-full border border-ai/15 bg-white/70 px-2.5 py-1 text-xs">
              <Check className="size-3 text-ai" strokeWidth={2.5} />
              {s}
            </li>
          ))}
        </ul>
      )}
      <p className="relative mt-4 text-[11px] text-muted-foreground">
        Remedium coordinates the workflow. Clinical decisions are always made by licensed providers.
      </p>
    </section>
  )
}
