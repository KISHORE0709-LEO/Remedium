import { ArrowRight } from 'lucide-react'
import { Eyebrow, PillLink } from '@/components/remedium/primitives'
import { HeroVisual } from './hero-visual'

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_60%_40%,black,transparent)]" />
      <div className="absolute -top-40 right-[-10%] -z-10 size-[640px] rounded-full bg-[radial-gradient(circle,oklch(0.75_0.12_255/0.18),transparent_65%)]" />
      <div className="absolute bottom-[-20%] left-[-10%] -z-10 size-[520px] rounded-full bg-[radial-gradient(circle,oklch(0.8_0.1_195/0.16),transparent_65%)]" />
      <div className="absolute bottom-[-10%] right-[-5%] -z-10 size-[400px] rounded-full bg-[radial-gradient(circle,oklch(0.85_0.08_255/0.1),transparent_70%)]" />
      
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-0 overflow-hidden" aria-hidden="true">
        <svg className="w-full min-w-[1440px] h-auto object-cover" viewBox="0 0 1440 320" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 256L48 245.3C96 235 192 213 288 213.3C384 213 480 235 576 224C672 213 768 171 864 165.3C960 160 1056 192 1152 192C1248 192 1344 160 1392 144L1440 128V320H1392C1344 320 1248 320 1152 320C1056 320 960 320 864 320C768 320 672 320 576 320C480 320 384 320 288 320C192 320 96 320 48 320H0V256Z" fill="url(#hero-wave-1)" />
          <path d="M0 160L48 176C96 192 192 224 288 218.7C384 213 480 171 576 160C672 149 768 171 864 192C960 213 1056 235 1152 229.3C1248 224 1344 192 1392 176L1440 160V320H1392C1344 320 1248 320 1152 320C1056 320 960 320 864 320C768 320 672 320 576 320C480 320 384 320 288 320C192 320 96 320 48 320H0V160Z" fill="url(#hero-wave-2)" />
          <path d="M0 288L48 272C96 256 192 224 288 229.3C384 235 480 277 576 272C672 267 768 213 864 186.7C960 160 1056 160 1152 181.3C1248 203 1344 245 1392 266.7L1440 288V320H1392C1344 320 1248 320 1152 320C1056 320 960 320 864 320C768 320 672 320 576 320C480 320 384 320 288 320C192 320 96 320 48 320H0V288Z" fill="url(#hero-wave-3)" />
          <defs>
            <linearGradient id="hero-wave-1" x1="0" y1="128" x2="1440" y2="320" gradientUnits="userSpaceOnUse">
              <stop stopColor="oklch(0.85 0.08 255)" stopOpacity="0.4" />
              <stop offset="1" stopColor="oklch(0.9 0.05 255)" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="hero-wave-2" x1="0" y1="160" x2="1440" y2="320" gradientUnits="userSpaceOnUse">
              <stop stopColor="oklch(0.8 0.1 292)" stopOpacity="0.3" />
              <stop offset="1" stopColor="oklch(0.9 0.05 292)" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="hero-wave-3" x1="0" y1="160" x2="1440" y2="320" gradientUnits="userSpaceOnUse">
              <stop stopColor="oklch(0.82 0.09 265)" stopOpacity="0.5" />
              <stop offset="1" stopColor="oklch(0.88 0.06 265)" stopOpacity="0.15" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="mx-auto grid min-h-svh max-w-6xl items-center gap-12 px-6 pt-32 pb-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24 relative z-10">
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
