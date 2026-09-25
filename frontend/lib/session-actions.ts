'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DEMO_MODE } from '@/lib/demo-mode'
import { DEMO_ROLE_COOKIE } from '@/lib/session'
import { ROLE_HOME, isRole } from '@/lib/roles'

// Solo modo demo: cambiar de rol para mostrar cada vista.
export async function switchDemoRole(role: string) {
  if (!DEMO_MODE || !isRole(role)) return
  const store = await cookies()
  store.set(DEMO_ROLE_COOKIE, role, { path: '/', sameSite: 'lax' })
  redirect(ROLE_HOME[role])
}

export async function logout() {
  if (DEMO_MODE) redirect('/')
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
