import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import NewOrder from './NewOrder'

export default async function NewOrderPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  // El cliente compra siempre a su nombre: su ficha viene de la sesión.
  return <NewOrder role={session.role} ownCustomerId={session.customerId ?? ''} />
}
