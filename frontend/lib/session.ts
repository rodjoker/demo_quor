import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { DEMO_MODE } from '@/lib/demo-mode'
import { isRole } from '@/lib/roles'
import type { Role } from '@/lib/types'

export interface Session {
  userId: string
  email: string
  name: string
  role: Role
  demo: boolean
  /** Ficha de cliente de esta persona (la crea el registro). En modo demo, un cliente de ejemplo. */
  customerId: string | null
}

export const DEMO_ROLE_COOKIE = 'demo_role'

// Cliente de demostración: el mismo que usa el rol "cliente" en los datos cableados.
export const DEMO_CUSTOMER_ID = 'c1'

const DEMO_USERS: Record<Role, { name: string; email: string }> = {
  admin: { name: 'Gerencia Quor', email: 'admin@quor.demo' },
  vendedor: { name: 'Laura Restrepo', email: 'vendedor@quor.demo' },
  bodega: { name: 'Carlos Muñoz', email: 'bodega@quor.demo' },
  cliente: { name: 'Salón Bella Uñas', email: 'cliente@quor.demo' },
}

export async function getSession(): Promise<Session | null> {
  if (DEMO_MODE) {
    const store = await cookies()
    const raw = store.get(DEMO_ROLE_COOKIE)?.value
    const role: Role = isRole(raw) ? raw : 'admin'
    return { userId: `demo-${role}`, role, demo: true, customerId: DEMO_CUSTOMER_ID, ...DEMO_USERS[role] }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, role')
    .eq('id', user.id)
    .single()

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle()

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? '',
    name: profile?.full_name ?? profile?.email ?? user.email ?? '',
    role: isRole(profile?.role) ? profile.role : 'cliente',
    demo: false,
    customerId: customer?.id ?? null,
  }
}
