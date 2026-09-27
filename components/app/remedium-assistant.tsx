'use client'

/**
 * RemediumAssistant
 *
 * Floating AI chat button that gives any authenticated user quick access to
 * a contextual AI assistant. The assistant answers questions about Remedium,
 * explains refill statuses and workflow steps, and guides users through the
 * application. It never makes clinical or refill-approval decisions.
 *
 * Architecture:
 *   User message → POST /api/assistant (server-side Gemini) → reply text
 *   History is kept in React state only — not persisted to Firestore.
 *   API key stays server-side. No keys in this file.
 */

import { Loader2, MessageCircle, Minimize2, Send, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Role } from '@/lib/remedium/types'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'model'
  text: string
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'model',
  text: "Hi! I'm the Remedium Assistant. I can explain refill statuses, guide you through the workflow, or answer questions about the application. How can I help?",
}

// A few quick-start chips to reduce typing friction
const QUICK_PROMPTS: Record<Role, string[]> = {
  pharmacy: [
    'What does WAITING_FOR_PROVIDER mean?',
    'How do I confirm fulfillment?',
    'How do I submit a prior auth?',
  ],
  provider: [
    'What refills need my review?',
    'What happens after I approve?',
    'What is escalation?',
  ],
  patient: [
    'Where is my prescription?',
    'What does ready for pickup mean?',
    'Why is my refill delayed?',
  ],
  insurance: [
    'How does prior auth work here?',
    'What is a Tier 3 medication?',
    'What does WAITING_FOR_INSURANCE mean?',
  ],
}

export function RemediumAssistant({ role, context }: { role: Role; context?: string }) {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    if (open && !minimized) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open, minimized])

  // Focus input when chat opens
  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, minimized])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Build history to send (exclude welcome message, keep last 12 turns for context window)
    const history = [...messages, userMsg]
      .filter((m) => m.id !== 'welcome')
      .slice(-12)
      .map((m) => ({ role: m.role, text: m.text }))

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, context }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json()
      const reply: Message = {
        id: `m-${Date.now()}`,
        role: 'model',
        text: data.reply ?? "Sorry, I couldn't generate a response. Please try again.",
      }
      setMessages((prev) => [...prev, reply])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: 'model', text: "I'm temporarily unavailable. Please try again in a moment." },
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

  return (
    <>
      {/* Floating toggle button — always visible */}
      {!open && (
        <button
          type="button"
          onClick={() => { setOpen(true); setMinimized(false) }}
          aria-label="Open Remedium Assistant"
          className="fixed bottom-5 right-5 z-50 flex size-13 items-center justify-center rounded-full border border-ai/30 bg-[oklch(0.28_0.08_292)] text-white shadow-lift transition-all hover:scale-105 hover:shadow-xl cursor-pointer"
        >
          <Sparkles className="size-5" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            'fixed bottom-5 right-5 z-50 flex flex-col rounded-3xl border border-border bg-card shadow-2xl transition-all duration-200',
            minimized ? 'h-14 w-72' : 'h-[520px] w-[360px]',
          )}
        >
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 rounded-t-3xl border-b border-border bg-[linear-gradient(135deg,oklch(0.97_0.02_292),oklch(0.985_0.01_255))] px-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-ai" />
              <span className="text-sm font-semibold text-foreground">Remedium Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMinimized((m) => !m)}
                aria-label={minimized ? 'Expand' : 'Minimize'}
                className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <Minimize2 className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Body — hidden when minimized */}
          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      msg.role === 'user' ? 'justify-end' : 'justify-start',
                    )}
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

              {/* Quick-start chips — only show while only the welcome message exists */}
              {messages.length === 1 && !loading && (
                <div className="shrink-0 px-4 pb-2">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Quick questions
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(QUICK_PROMPTS[role] ?? QUICK_PROMPTS.pharmacy).map((q) => (
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
                  className="flex-1 rounded-full border border-border bg-muted/60 px-3.5 py-2 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-foreground focus:bg-white"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  aria-label="Send message"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background shadow-xs disabled:opacity-40 hover:bg-foreground/85 transition-all cursor-pointer"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
