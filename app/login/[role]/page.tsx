import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/auth/auth-shell'
import { SignInForm } from '@/components/auth/sign-in-form'
import { isAuthRole, ROLE_META } from '@/lib/remedium/roles'
import type { Role } from '@/lib/remedium/types'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ role: string }>
}): Promise<Metadata> {
  const { role } = await params
  if (!isAuthRole(role)) return { title: 'Sign In — Remedium' }
  return { title: `Sign In as ${ROLE_META[role].label} — Remedium` }
}

export default async function RoleLoginPage({
  params,
}: {
  params: Promise<{ role: string }>
}) {
  const { role } = await params

  // Only provider and pharmacy are allowed login roles
  if (!isAuthRole(role)) {
    redirect('/login')
  }

  return (
    <AuthShell>
      <div className="w-full">
        <SignInForm role={role as Role} />
      </div>
    </AuthShell>
  )
}
