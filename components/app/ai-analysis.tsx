'use client'

import { AlertCircle, AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronUp, ClipboardCopy, Edit3, Loader2, ShieldAlert, Sparkles, User, X } from 'lucide-react'
import { useState } from 'react'
import { analyzeCase } from '@/lib/remedium/engine'
import { logApprovedDraft } from '@/lib/remedium/firestore-service'
import type { AiAnalysis as AiAnalysisType, RefillCase, Role } from '@/lib/remedium/types'
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

export function AiAnalysis({
  refill,
  role,
  compact = false,
  className,
}: {
  refill: RefillCase
  /** The authenticated user's role — required to log approved drafts */
  role?: Role
  compact?: boolean
  className?: string
}) {
  const [draftOpen, setDraftOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  // Editable draft state
  const [editing, setEditing] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [logStatus, setLogStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

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
    const text = editing ? editedText : draftMessage
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function openEdit() {
    setEditedText(draftMessage ?? '')
    setEditing(true)
    setLogStatus('idle')
  }

  async function handleApproveAndLog() {
    const finalText = editedText.trim()
    if (!finalText || !role) return
    setLogStatus('saving')
    try {
      await logApprovedDraft(refill.id, finalText, role)
      setLogStatus('saved')
      setEditing(false)
    } catch {
      setLogStatus('error')
    }
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

      {/* Stuck reason */}
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

          {/* Next action + responsible role */}
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

          {/* Priority reason */}
          {priorityReason && (
            <p className="relative mt-2 text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground/70">Priority: </span>{priorityReason}
            </p>
          )}

          {/* ── Draft message — collapsible + editable ── */}
          {draftMessage && (
            <div className="relative mt-3 rounded-xl border border-ai/15 bg-white/50">
              {/* Toggle header */}
              <button
                type="button"
                onClick={() => { setDraftOpen((o) => !o); if (!draftOpen) setEditing(false) }}
                className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold text-foreground cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="size-3 text-ai" />
                  Draft message
                  {logStatus === 'saved' && (
                    <span className="flex items-center gap-1 rounded-full bg-ok/10 px-2 py-0.5 text-[10px] font-medium text-ok">
                      <CheckCircle2 className="size-3" /> Logged
                    </span>
                  )}
                </span>
                {draftOpen ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
              </button>

              {draftOpen && (
                <div className="border-t border-ai/10 px-3 pb-3">
                  {!editing ? (
                    /* Read-only view */
                    <>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">{draftMessage}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={copyDraft}
                          className="inline-flex items-center gap-1.5 rounded-full border border-ai/20 bg-white px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-ai/5 cursor-pointer"
                        >
                          {copied ? <Check className="size-3 text-ok" /> : <ClipboardCopy className="size-3" />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                        {role && (
                          <button
                            type="button"
                            onClick={openEdit}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-foreground/30 hover:bg-muted cursor-pointer"
                          >
                            <Edit3 className="size-3" /> Edit &amp; Approve
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Edit + approve view */
                    <div className="mt-2 space-y-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Edit draft — reviewed and approved messages are logged to the audit trail
                      </p>
                      <textarea
                        value={editedText}
                        onChange={(e) => { setEditedText(e.target.value); setLogStatus('idle') }}
                        rows={6}
                        className="w-full resize-y rounded-xl border border-border bg-white px-3 py-2.5 text-xs leading-relaxed text-foreground outline-none transition-colors focus:border-foreground"
                        autoFocus
                      />
                      {logStatus === 'error' && (
                        <p className="flex items-center gap-1 text-[11px] text-risk">
                          <AlertCircle className="size-3 shrink-0" />
                          Could not log the message. Please try again.
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={copyDraft}
                          className="inline-flex items-center gap-1.5 rounded-full border border-ai/20 bg-white px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-ai/5 cursor-pointer"
                        >
                          {copied ? <Check className="size-3 text-ok" /> : <ClipboardCopy className="size-3" />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditing(false); setLogStatus('idle') }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted cursor-pointer"
                        >
                          <X className="size-3" /> Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleApproveAndLog}
                          disabled={!editedText.trim() || logStatus === 'saving'}
                          className="inline-flex items-center gap-1.5 rounded-full border border-ok/40 bg-ok/10 px-3 py-1 text-[11px] font-semibold text-ok hover:bg-ok hover:text-white disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          {logStatus === 'saving'
                            ? <><Loader2 className="size-3 animate-spin" /> Logging…</>
                            : <><Check className="size-3" /> Approve &amp; Log</>}
                        </button>
                      </div>
                    </div>
                  )}
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