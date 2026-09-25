import { getSession, DEMO_CUSTOMER_ID } from '@/lib/session'
import { redirect } from 'next/navigation'
import NewOrder from './NewOrder'

export default async function NewOrderPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  // Cliente: compra siempre a su nombre. En modo real, aquí se busca su ficha en `customers`.
  return <NewOrder role={session.role} userName={session.name} ownCustomerId={DEMO_CUSTOMER_ID} />
}
