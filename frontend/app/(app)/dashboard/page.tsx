import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import ExecutiveDashboard from './ExecutiveDashboard'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <ExecutiveDashboard />
}
