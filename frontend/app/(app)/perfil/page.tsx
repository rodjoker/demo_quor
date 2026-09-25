import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/session'
import ProfileForm from './ProfileForm'

export default async function ProfilePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  if (session.demo) {
    return (
      <ProfileForm
        demo
        profile={{
          username: null,
          full_name: session.name,
          address: null,
          phone_number: null,
          email: session.email,
          role: session.role,
        }}
      />
    )
  }

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name, address, phone_number, email, role')
    .eq('id', session.userId)
    .single()

  if (!profile) redirect('/login')

  return <ProfileForm profile={profile} />
}
