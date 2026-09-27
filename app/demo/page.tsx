import type { Metadata } from 'next'
import { DemoConsole } from '@/components/app/demo-console'

export const metadata: Metadata = {
  title: 'Live Demo · Remedium',
  description: 'Watch a refill move across patient, pharmacy, provider and insurance in real time.',
}

export default function Page() {
  return <DemoConsole />
}
