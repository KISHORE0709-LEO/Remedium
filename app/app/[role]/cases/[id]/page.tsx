import type { Metadata } from 'next'
import { CaseDetail } from '@/components/app/role-views'
import type { Role } from '@/lib/remedium/types'

export const metadata: Metadata = { title: 'Case · Remedium' }

export default async function Page({ params }: { params: Promise<{ role: string; id: string }> }) {
  const { role, id } = await params
  return <CaseDetail role={role as Role} caseId={decodeURIComponent(id)} />
}
