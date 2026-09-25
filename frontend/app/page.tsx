import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { ROLE_HOME } from '@/lib/roles'

// Cada rol aterriza en su pantalla de trabajo.
export default async function Home() {
  const session = await getSession()
  redirect(session ? ROLE_HOME[session.role] : '/login')
}
