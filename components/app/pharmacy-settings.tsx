'use client'

import { Building2, Check, CheckCircle2, ShieldCheck, Sliders, Bell, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { Role } from '@/lib/remedium/types'

export function PharmacySettings({ role }: { role: Role }) {
  const [autoPA, setAutoPA] = useState(true)
  const [autoNudge, setAutoNudge] = useState(true)
  const [smsReady, setSmsReady] = useState(true)
  const [saved, setSaved] = useState(false)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pharmacy Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage pharmacy location identifiers, dispensing automation, and team notifications.
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-xl border border-ok/25 bg-ok/[0.08] px-4 py-3 text-xs text-[oklch(0.42_0.11_158)] animate-fade-up font-medium">
          <CheckCircle2 className="size-4 shrink-0" />
          Settings successfully updated.
        </div>
      )}

      {/* Pharmacy Details */}
      <form onSubmit={handleSave} className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border">
            <Building2 className="size-4 text-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Pharmacy Profile</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground uppercase font-mono">Pharmacy Name</label>
              <input
                type="text"
                readOnly
                value="Harbor Pharmacy #214"
                className="h-9 w-full rounded-lg border border-border bg-muted/40 px-3 text-foreground font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground uppercase font-mono">National Provider Identifier (NPI)</label>
              <input
                type="text"
                readOnly
                value="1928374650"
                className="h-9 w-full rounded-lg border border-border bg-muted/40 px-3 text-foreground font-mono"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="font-semibold text-muted-foreground uppercase font-mono">Address</label>
              <input
                type="text"
                readOnly
                value="742 Evergreen Terrace, Suite 100, San Francisco, CA 94107"
                className="h-9 w-full rounded-lg border border-border bg-muted/40 px-3 text-foreground"
              />
            </div>
          </div>
        </section>

        {/* Remedium Automated Workflow Rules */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Remedium Automation Engine</h2>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-xl border border-border/70 p-3 hover:bg-muted/20 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={autoPA}
                onChange={(e) => setAutoPA(e.target.checked)}
                className="mt-0.5 size-4 rounded accent-foreground"
              />
              <div className="text-xs">
                <span className="font-semibold text-foreground block">Auto-assemble Prior Authorization Packets</span>
                <span className="text-muted-foreground leading-relaxed block mt-0.5">
                  When a payer requires PA, Remedium AI extracts clinical history, prescriber notes, and ICD-10 criteria into an auto-filled packet.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-border/70 p-3 hover:bg-muted/20 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={autoNudge}
                onChange={(e) => setAutoNudge(e.target.checked)}
                className="mt-0.5 size-4 rounded accent-foreground"
              />
              <div className="text-xs">
                <span className="font-semibold text-foreground block">Provider Smart Escalation on 0 Refills</span>
                <span className="text-muted-foreground leading-relaxed block mt-0.5">
                  Automatically alert prescribers when a maintenance refill has zero refills on file and under 3 days of supply remaining.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-border/70 p-3 hover:bg-muted/20 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={smsReady}
                onChange={(e) => setSmsReady(e.target.checked)}
                className="mt-0.5 size-4 rounded accent-foreground"
              />
              <div className="text-xs">
                <span className="font-semibold text-foreground block">Automatic Patient SMS Ready Notification</span>
                <span className="text-muted-foreground leading-relaxed block mt-0.5">
                  Notify patients with pickup instructions the moment a prescription is marked ready at this pharmacy counter.
                </span>
              </div>
            </label>
          </div>
        </section>

        {/* Security & HIPAA */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-2xs">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border">
            <ShieldCheck className="size-4 text-ok" />
            <h2 className="text-sm font-semibold text-foreground">Compliance & Security</h2>
          </div>
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
            All prescription transmissions adhere to HIPAA, NCPDP SCRIPT Standard, and SOC 2 Type II controls. End-to-end encryption is enforced for all patient health information (PHI).
          </p>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full border border-foreground bg-foreground px-6 py-2.5 text-xs font-semibold text-background shadow-soft hover:bg-foreground/90 cursor-pointer transition-all"
          >
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  )
}
