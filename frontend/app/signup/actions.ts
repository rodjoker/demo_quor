'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type SignupState = { error: string } | null

export async function signup(prevState: SignupState, formData: FormData): Promise<SignupState> {
  const email = (formData.get('email') as string).toLowerCase().trim()
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email y contraseña son requeridos.' }
  }

  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    if (error.message.includes('already registered')) {
      return { error: 'Este email ya está registrado.' }
    }
    return { error: error.message }
  }

  redirect('/')
}
