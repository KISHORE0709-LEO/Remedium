import type { Metadata } from 'next'
import { RoleDashboard } from '@/components/app/role-views'
import type { Role } from '@/lib/remedium/types'

export const metadata: Metadata = { title: 'Dashboard · Remedium' }

export default async function Page({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params
  return <RoleDashboard role={role as Role} />
}
