import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileForm from './ProfileForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name, address, phone_number, email, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return <ProfileForm profile={profile} />
}
