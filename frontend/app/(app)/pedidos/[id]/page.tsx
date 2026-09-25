import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import OrderDetail from './OrderDetail'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect('/login')
  return <OrderDetail id={id} role={session.role} ownCustomerId={session.customerId ?? ''} />
}
