import type { Metadata } from 'next'
import { PharmacySettings } from '@/components/app/pharmacy-settings'
import type { Role } from '@/lib/remedium/types'

export const metadata: Metadata = { title: 'Settings · Remedium' }

export default async function Page({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params
  return <PharmacySettings role={role as Role} />
}
