import { ArrowRight, Building2, Stethoscope } from 'lucide-react'
import { Eyebrow, PillLink } from '@/components/remedium/primitives'

const AUDIENCES = [
  {
    id: 'for-practices',
    Icon: Stethoscope,
    eyebrow: 'For Practices',
    title: 'Only the decisions that need a clinician.',
    body: 'Refill requests arrive pre-analyzed, with history, supply and the exact blocker. Approve, request a visit or deny — Remedium handles every handoff after that.',
    points: [
      ['One-click decisions', 'Approve · Request visit · Deny'],
      ['AI case summaries', 'Context without chart digging'],
      ['Clinician stays in control', 'AI never makes the prescribing call'],
    ],
    metric: ['68%', 'fewer refill calls to the front desk'],
    href: '/login/provider',
    cta: 'Open provider workspace',
  },
  {
    id: 'for-pharmacies',
    Icon: Building2,
    eyebrow: 'For Pharmacies',
    title: 'A queue that explains itself.',
    body: 'Every open refill shows its blocker, who it is waiting for and the next action. Stuck cases route automatically and verified results flow back without follow-up calls.',
    points: [
      ['Why is this refill stuck?', 'Blocker, owner, impact at a glance'],
      ['Automatic routing', 'Provider, insurance or patient'],
      ['Prior auth packets', 'Pre-assembled from the chart'],
    ],
    metric: ['3.4×', 'faster time-to-resolution on blocked refills'],
    href: '/login/pharmacy',
    cta: 'Open pharmacy operations',
  },
]

export function Audiences() {
  return (
    <section className="border-t">
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-24 lg:grid-cols-2">
        {AUDIENCES.map((a) => (
          <article
            key={a.id}
            id={a.id}
            className="group flex scroll-mt-28 flex-col rounded-3xl border bg-card p-7 shadow-soft transition-shadow hover:shadow-lift sm:p-9"
          >
            <div className="flex items-center justify-between">
              <Eyebrow>{a.eyebrow}</Eyebrow>
              <span className="grid size-10 place-items-center rounded-full border bg-muted/50">
                <a.Icon className="size-4" strokeWidth={1.6} />
              </span>
            </div>
            <h3 className="mt-6 text-2xl font-medium tracking-tight text-balance sm:text-3xl">{a.title}</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground">{a.body}</p>
            <ul className="mt-7 divide-y border-y">
              {a.points.map(([t, d]) => (
                <li key={t} className="flex items-center justify-between gap-4 py-3.5 text-sm">
                  <span className="font-medium">{t}</span>
                  <span className="text-right text-muted-foreground">{d}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-medium tracking-tight">{a.metric[0]}</p>
                <p className="text-xs text-muted-foreground">{a.metric[1]} · pilot projection</p>
              </div>
              <PillLink href={a.href} variant="outline" size="sm">
                {a.cta}
                <ArrowRight />
              </PillLink>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
