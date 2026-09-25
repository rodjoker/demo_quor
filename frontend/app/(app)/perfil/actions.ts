'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ProfileState = { error?: string; success?: boolean } | null

export async function updateProfile(
  prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'No autenticado.' }

  const username = (formData.get('username') as string).trim()
  const full_name = (formData.get('full_name') as string).trim()
  const address = (formData.get('address') as string).trim()
  const phone_number = (formData.get('phone_number') as string).trim()

  const { error } = await supabase
    .from('profiles')
    .update({
      username: username || null,
      full_name: full_name || null,
      address: address || null,
      phone_number: phone_number || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { error: 'No se pudo guardar. Intenta de nuevo.' }

  revalidatePath('/perfil')
  return { success: true }
}
