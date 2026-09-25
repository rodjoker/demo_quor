import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import WarehouseQueue from './WarehouseQueue'

export default async function WarehousePage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <WarehouseQueue />
}
