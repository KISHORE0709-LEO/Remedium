import { ArrowRight } from 'lucide-react'
import { Eyebrow, Logo, PillLink } from '@/components/remedium/primitives'

export function Closing() {
  return (
    <section className="border-t">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="relative overflow-hidden rounded-[2rem] border bg-foreground px-7 py-14 text-background sm:px-14">
          <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_85%_20%,oklch(0.6_0.2_292/0.6),transparent_45%),radial-gradient(circle_at_10%_100%,oklch(0.65_0.12_195/0.5),transparent_45%)]" />
          <div className="relative grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div>
              <Eyebrow className="text-background/60">Enter the application</Eyebrow>
              <h2 className="mt-4 text-3xl font-medium tracking-tight text-balance sm:text-5xl">
                Connected refill coordination for practices and pharmacies.
              </h2>
              <p className="mt-4 max-w-lg leading-relaxed text-background/70">
                Sign in to your practice or pharmacy workspace — keeping patients, prescribers, and payers in sync in
                real time.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
              <PillLink href="/login" size="lg" className="border-white bg-white text-foreground hover:bg-white/90">
                Get Started
                <ArrowRight />
              </PillLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-10 sm:flex-row sm:items-center">
        <Logo />
        <p className="text-xs text-muted-foreground">
          Remedium Healthcare · Provider Practice & Pharmacy Refill Coordination Platform.
        </p>
      </div>
    </footer>
  )
}
