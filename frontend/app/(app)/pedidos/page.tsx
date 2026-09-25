import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import OrdersList from './OrdersList'

export default async function OrdersPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <OrdersList role={session.role} ownCustomerId={session.customerId ?? ''} />
}
