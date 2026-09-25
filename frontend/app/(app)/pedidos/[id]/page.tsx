import { redirect } from 'next/navigation'
import { getSession, DEMO_CUSTOMER_ID } from '@/lib/session'
import OrderDetail from './OrderDetail'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')
  return <OrderDetail id={id} role={session.role} userName={session.name} ownCustomerId={DEMO_CUSTOMER_ID} />
}
