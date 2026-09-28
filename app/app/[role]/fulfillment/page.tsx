import type { Metadata } from 'next'
import { FulfillmentView } from '@/components/app/pharmacy-dashboard'
import { RefillsList } from '@/components/app/role-views'
import type { Role } from '@/lib/remedium/types'

export const metadata: Metadata = { title: 'Fulfillment Operations · Remedium' }

export default async function Page({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params
  if (role === 'pharmacy') {
    return <FulfillmentView />
  }
  return <RefillsList role={role as Role} />
}
