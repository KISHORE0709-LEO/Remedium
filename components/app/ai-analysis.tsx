'use client'

import { AlertCircle, AlertTriangle, Check, ChevronDown, ChevronUp, ClipboardCopy, ShieldAlert, Sparkles, User } from 'lucide-react'
import { useState } from 'react'
import { analyzeCase } from '@/lib/remedium/engine'
import type { AiAnalysis as AiAnalysisType, RefillCase } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'

const ROLE_LABEL: Record<string, string> = {
  patient: 'Patient',
  pharmacy: 'Pharmacy',
  provider: 'Provider',
  insurance: 'Insurance',
  remedium: 'Remedium AI',
  none: '—',
}

const PRIORITY_STYLE: Record<string, string> = {
  urgent: 'bg-risk/10 text-risk border-risk/30',
  high: 'bg-warn/10 text-warn border-warn/30',
  standard: 'bg-muted text-muted-foreground border-border',
  low: 'bg-muted text-muted-foreground border-border',
}

export function AiAnalysis({ refill, compact = false, className }: { refill: RefillCase; compact?: boolean; className?: string }) {
  const [draftOpen, setDraftOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const ai: AiAnalysisType | null = refill.aiAnalysis ?? null
  const fallback = analyzeCase(refill)
  const analyzing = refill.status === 'ANALYZING' || refill.status === 'CHECKING' || refill.status === 'REQUESTED'
  const failed = !ai && !analyzing && (refill.status === 'NEEDS_INFORMATION' || refill.status === 'MANUAL_REVIEW' as string)

  const summary = ai?.summary ?? fallback.summary
  const confidence = ai?.confidence ?? fallback.confidence
  const blocker = ai?.blocker ?? fallback.blocker
  const stuckReason = ai?.stuckReason ?? null
  const nextAction = ai?.nextAction ?? fallback.nextAction
  const responsibleRole = ai?.responsibleRole ?? fallback.owner
  const priority = ai?.priority ?? (refill.urgent ? 'urgent' : 'standard')
  const priorityReason = ai?.priorityReason ?? null
  const missingFields = ai?.missingFields ?? []
  const draftMessage = ai?.draftMessage ?? null
  const modelVersion = ai?.modelVersion ?? null
  const requiresHumanReview = ai?.requiresHumanReview ?? false

  function copyDraft() {
    if (!draftMessage) return
    navigator.clipboard.writeText(draftMessage).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

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

      {/* Header */}
      <div className="relative flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-[0.18em] text-ai">
          <Sparkles className="size-3.5" /> AI CASE ANALYSIS
          {modelVersion && <span className="opacity-50">· {modelVersion}</span>}
        </p>
        <div className="flex items-center gap-2">
          {!analyzing && (
            <span className={cn('rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold capitalize', PRIORITY_STYLE[priority])}>
              {priority}
            </span>
          )}
          <span className="font-mono text-[10px] text-muted-foreground">
            {analyzing ? 'analyzing…' : failed ? 'manual review' : `confidence ${Math.round(confidence * 100)}%`}
          </span>
        </div>
      </div>

      {/* Human review required banner */}
      {requiresHumanReview && !analyzing && (
        <div className="relative mt-3 flex items-start gap-2 rounded-xl border border-risk/25 bg-risk/[0.05] px-3 py-2.5 text-xs text-risk">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          <span className="font-medium">Human review required — conflicting or ambiguous data detected. Do not route automatically.</span>
        </div>
      )}

      {/* AI failure fallback notice */}
      {failed && (
        <div className="relative mt-3 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/[0.06] px-3 py-2.5 text-xs text-warn">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>AI analysis unavailable — case set to manual review. A human can continue the workflow.</span>
        </div>
      )}

      {/* Summary */}
      <p className="relative mt-3 text-[15px] leading-relaxed text-pretty">{summary}</p>

      {/* Stuck reason — one-sentence plain-English explanation */}
      {stuckReason && !compact && (
        <p className="relative mt-2 text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Why it&apos;s stuck: </span>{stuckReason}
        </p>
      )}

      {!compact && (
        <>
          {/* Blocker */}
          {blocker && (
            <div className="relative mt-4 flex items-start gap-2 rounded-xl border border-risk/25 bg-risk/[0.04] px-3 py-2.5 text-xs">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-risk" />
              <div>
                <span className="font-semibold text-risk">Blocker detected: </span>
                <span className="text-foreground">{blocker}</span>
              </div>
            </div>
          )}

          {/* Missing fields */}
          {missingFields.length > 0 && (
            <div className="relative mt-3 rounded-xl border border-warn/25 bg-warn/[0.04] px-3 py-2.5 text-xs">
              <p className="font-semibold text-warn">Missing information:</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {missingFields.map((f) => (
                  <li key={f} className="rounded-full border border-warn/20 bg-white/60 px-2 py-0.5 text-foreground">{f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Next action + responsible role + priority reason */}
          <div className="relative mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-ai/15 bg-white/50 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Next Action</p>
              <p className="mt-1 text-xs font-medium text-foreground leading-snug">{nextAction}</p>
            </div>
            <div className="rounded-xl border border-ai/15 bg-white/50 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Responsible</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
                <User className="size-3 text-ai" />
                {ROLE_LABEL[responsibleRole] ?? responsibleRole}
              </p>
            </div>
          </div>

          {/* Priority reason — why this priority was assigned */}
          {priorityReason && (
            <p className="relative mt-2 text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground/70">Priority: </span>{priorityReason}
            </p>
          )}

          {/* Draft message (collapsible) */}
          {draftMessage && (
            <div className="relative mt-3 rounded-xl border border-ai/15 bg-white/50">
              <button
                type="button"
                onClick={() => setDraftOpen((o) => !o)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold text-foreground cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="size-3 text-ai" />
                  Draft message
                </span>
                {draftOpen ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
              </button>
              {draftOpen && (
                <div className="border-t border-ai/10 px-3 pb-3">
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">{draftMessage}</p>
                  <button
                    type="button"
                    onClick={copyDraft}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-ai/20 bg-white px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-ai/5 cursor-pointer"
                  >
                    {copied ? <Check className="size-3 text-ok" /> : <ClipboardCopy className="size-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <p className="relative mt-4 text-[11px] text-muted-foreground">
        Remedium coordinates the workflow. Clinical decisions are always made by licensed providers.
      </p>
    </section>
  )
}