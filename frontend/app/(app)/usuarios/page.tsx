import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import UsersAdmin from './UsersAdmin'

export default async function UsersPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <UsersAdmin />
}
