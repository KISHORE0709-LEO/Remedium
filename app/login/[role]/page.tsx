import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { SignInForm } from '@/components/auth/sign-in-form'
import { isRole, ROLE_META } from '@/lib/remedium/roles'

export async function generateMetadata({ params }: { params: Promise<{ role: string }> }): Promise<Metadata> {
  const { role } = await params
  if (!isRole(role)) return {}
  return { title: `Sign in as ${ROLE_META[role].label} — Remedium` }
}

export default async function RoleLoginPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params
  if (!isRole(role)) notFound()
  return (
    <AuthShell>
      <SignInForm role={role} />
    </AuthShell>
  )
}
