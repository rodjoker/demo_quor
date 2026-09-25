'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type LoginState = { error: string } | null

export async function login(prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = (formData.get('email') as string).toLowerCase().trim()
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email y contraseña son requeridos.' }
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('blocked, failed_attempts')
    .eq('email', email)
    .single()

  if (profile?.blocked) {
    return { error: 'Tu cuenta ha sido bloqueada. Contacta al administrador.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (profile) {
      const newAttempts = (profile.failed_attempts ?? 0) + 1
      const shouldBlock = newAttempts >= 3

      await admin
        .from('profiles')
        .update({
          failed_attempts: newAttempts,
          ...(shouldBlock && { blocked: true }),
        })
        .eq('email', email)

      if (shouldBlock) {
        return { error: 'Has superado el máximo de intentos. Tu cuenta ha sido bloqueada. Contacta al administrador.' }
      }

      return { error: `Credenciales incorrectas. Intentos restantes: ${3 - newAttempts}` }
    }

    return { error: 'Credenciales incorrectas.' }
  }

  await admin
    .from('profiles')
    .update({ failed_attempts: 0 })
    .eq('email', email)

  redirect('/')
}
