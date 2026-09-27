import { ArrowRight } from 'lucide-react'
import { Eyebrow, PillLink } from '@/components/remedium/primitives'
import { HeroVisual } from './hero-visual'

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_60%_40%,black,transparent)]" />
      <div className="absolute -top-40 right-[-10%] -z-10 size-[640px] rounded-full bg-[radial-gradient(circle,oklch(0.75_0.12_255/0.18),transparent_65%)]" />
      <div className="absolute bottom-[-20%] left-[-10%] -z-10 size-[520px] rounded-full bg-[radial-gradient(circle,oklch(0.8_0.1_195/0.16),transparent_65%)]" />

      <div className="mx-auto grid min-h-svh max-w-6xl items-center gap-12 px-6 pt-32 pb-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
        <div className="animate-fade-up">
          <h1 className="mt-6 text-5xl leading-[1.02] font-medium tracking-[-0.035em] text-balance sm:text-6xl lg:text-7xl">
            Keep every prescription refill moving.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-pretty text-muted-foreground">
            Remedium transforms the prescription refill journey into one connected, intelligent workflow — giving every stakeholder the right information, routing every action to the right person, and keeping every refill moving from request to resolution.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <PillLink href="/login" variant="primary" size="lg">
              Get Started
              <ArrowRight />
            </PillLink>
            <PillLink href="#how-it-works" variant="outline" size="lg">
              See How It Works
            </PillLink>
          </div>

        </div>
        <HeroVisual />
      </div>
    </section>
  )
}
