import type { Metadata } from 'next'
import { RefillsList } from '@/components/app/role-views'
import type { Role } from '@/lib/remedium/types'

export const metadata: Metadata = { title: 'Refills · Remedium' }

export default async function Page({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params
  return <RefillsList role={role as Role} />
}
