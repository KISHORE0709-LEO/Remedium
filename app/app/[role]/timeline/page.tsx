import type { Metadata } from 'next'
import { ActivityFeed } from '@/components/app/role-views'
import type { Role } from '@/lib/remedium/types'

export const metadata: Metadata = { title: 'Timeline · Remedium' }

export default async function Page({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params
  return <ActivityFeed role={role as Role} />
}
