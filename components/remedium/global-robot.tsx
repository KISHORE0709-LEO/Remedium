'use client'

/**
 * GlobalRobot — Spline robot + AI chatbot
 *
 * The Spline robot sits in the bottom-right corner of every page.
 * Clicking it opens a full AI chat panel that:
 *   - guides the user through the current page
 *   - answers questions about Remedium's workflow
 *   - explains refill statuses
 *   - never makes clinical or approval decisions
 *
 * API key stays server-side in /api/assistant — never in this file.
 * Chat history is kept in React state only (not persisted to Firestore).
 */

import Spline from '@splinetool/react-spline'
import { Loader2, Minimize2, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'model'
  text: string
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'model',
  text: "Hi! I'm the Remedium AI guide. I can explain refill statuses, walk you through the workflow, or answer any questions about this application. What would you like to know?",
}

// Page-specific quick prompts shown when chat first opens
const PAGE_PROMPTS: Record<string, string[]> = {
  '/login':             ['What is Remedium?', 'Who can use Remedium?', 'How do I get started?'],
  '/app/pharmacy':      ['What does WAITING_FOR_PROVIDER mean?', 'How do I submit a prior auth?', 'How do I confirm fulfillment?'],
  '/app/provider':      ['What refills need my review?', 'What happens after I approve?', 'What is escalation?'],
  '/app/insurance':     ['How does prior auth work?', 'What is a Tier 3 medication?', 'When should I approve coverage?'],
  '/app/patient':       ['Where is my prescription?', 'What does ready for pickup mean?', 'Why is my refill delayed?'],
  'fulfillment':        ['How do I confirm fulfillment?', 'What is WAITING_FOR_PHARMACY?', 'What happens after I confirm?'],
  'notifications':      ['What do notifications mean?', 'How do I clear unread alerts?'],
  'timeline':           ['What does the timeline show?', 'What is a workflowEvent?'],
  'cases':              ['What is this case\'s current blocker?', 'What should I do next?', 'What does the AI recommend?'],
  'refills':            ['How do I filter by status?', 'What does ESCALATED mean?', 'How are refills sorted?'],
  'blocked':            ['Why is this refill blocked?', 'How do I resolve a PA block?', 'What is missing info?'],
  'settings':           ['How do I update my profile?', 'What is my pharmacyId?'],
  default:              ['What is Remedium?', 'How does the refill workflow work?', 'What roles exist in Remedium?'],
}

function getPromptsForPath(path: string): string[] {
  for (const [key, prompts] of Object.entries(PAGE_PROMPTS)) {
    if (key !== 'default' && path.includes(key)) return prompts
  }
  return PAGE_PROMPTS.default
}

export function GlobalRobot() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    if (open && !minimized) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open, minimized])

  // Focus input when panel opens
  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [open, minimized])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    const history = [...messages, userMsg]
      .filter((m) => m.id !== 'welcome')
      .slice(-12)
      .map((m) => ({ role: m.role, text: m.text }))

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          context: `Current page: ${pathname}`,
        }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          text: data.reply ?? "I'm having trouble responding right now. Please try again.",
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'model',
          text: "I'm temporarily unavailable. Please try again in a moment.",
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const quickPrompts = getPromptsForPath(pathname ?? '')

  return (
    <>
      {/* ── Chat panel ── */}
      {open && (
        <div
          className={cn(
            'fixed bottom-44 right-5 z-[200] flex flex-col rounded-3xl border border-border bg-white shadow-2xl transition-all duration-200',
            minimized ? 'h-14 w-72' : 'h-[500px] w-[350px]',
          )}
        >
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 rounded-t-3xl border-b border-border bg-[linear-gradient(135deg,oklch(0.97_0.02_292),oklch(0.985_0.01_255))] px-4">
            <div className="flex items-center gap-2">
              {/* Small robot avatar in header */}
              <div className="size-7 overflow-hidden rounded-full border border-ai/20 bg-ai/10 flex items-center justify-center">
                <span className="text-[11px]">✦</span>
              </div>
              <span className="text-sm font-semibold text-foreground">Remedium Guide</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={minimized ? 'Expand' : 'Minimize'}
                onClick={() => setMinimized((m) => !m)}
                className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <Minimize2 className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Close guide"
                onClick={() => setOpen(false)}
                className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-foreground text-background rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm',
                      )}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5">
                      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Thinking…</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Quick prompts — only on first open */}
              {messages.length === 1 && !loading && (
                <div className="shrink-0 px-4 pb-2">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Quick questions for this page
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {quickPrompts.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => sendMessage(q)}
                        className="rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-foreground/30 hover:bg-muted transition-colors cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="shrink-0 flex items-center gap-2 border-t border-border px-3 py-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about Remedium…"
                  disabled={loading}
                  className="flex-1 rounded-full border border-border bg-muted/60 px-3.5 py-2 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-foreground focus:bg-white"
                />
                <button
                  type="button"
                  aria-label="Send"
                  disabled={!input.trim() || loading}
                  onClick={() => sendMessage(input)}
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background shadow-xs disabled:opacity-40 hover:bg-foreground/85 transition-all cursor-pointer"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Spline robot trigger ── */}
      <div
        className="fixed bottom-4 right-4 z-[100] size-32 cursor-pointer hover:scale-105 transition-transform"
        onClick={() => { setOpen((o) => !o); setMinimized(false) }}
        title="Click to open Remedium Guide"
        role="button"
        aria-label="Open Remedium AI Guide"
      >
        {/* Glow behind the robot */}
        <div className="absolute inset-0 -z-10 rounded-full bg-purple-500/10 blur-xl" />
        <Spline scene="https://prod.spline.design/rU2-Ks0SC0T5od9B/scene.splinecode" />
        {/* Pulse indicator when closed */}
        {!open && (
          <span className="absolute -top-1 -right-1 flex size-4">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-ai opacity-50" />
            <span className="relative inline-flex size-4 rounded-full bg-ai" />
          </span>
        )}
      </div>
    </>
  )
}
