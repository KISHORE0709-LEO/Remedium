import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/app/app-shell'
import { isRole } from '@/lib/remedium/roles'

export default async function RoleLayout({ children, params }: { children: ReactNode; params: Promise<{ role: string }> }) {
  const { role } = await params
  if (!isRole(role)) notFound()
  return <AppShell role={role}>{children}</AppShell>
}
