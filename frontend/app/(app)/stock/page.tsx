import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import StockTable from './StockTable'

export default async function StockPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <StockTable role={session.role} />
}
