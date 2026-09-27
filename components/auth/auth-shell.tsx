import type { ReactNode } from 'react'
import { Logo, PillLink } from '@/components/remedium/primitives'

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-svh flex-col">
      {/* Subtle ambient background */}
      <div className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,black,transparent)]" />
      <div className="absolute top-[-15%] left-1/2 -z-10 size-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(0.75_0.12_270/0.12),transparent_65%)]" />
      <div className="absolute bottom-[-10%] right-[-5%] -z-10 size-[500px] rounded-full bg-[radial-gradient(circle,oklch(0.8_0.1_195/0.10),transparent_65%)]" />

      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <PillLink href="/" variant="ghost" size="sm">
          Back to site
        </PillLink>
      </header>

      {/* Main content */}
      <main className="flex flex-1 items-center px-6 pt-4 pb-20">{children}</main>
    </div>
  )
}
