import type { Metadata } from 'next'
import { NotificationsList } from '@/components/app/role-views'
import type { Role } from '@/lib/remedium/types'

export const metadata: Metadata = { title: 'Notifications · Remedium' }

export default async function Page({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params
  return <NotificationsList role={role as Role} />
}
