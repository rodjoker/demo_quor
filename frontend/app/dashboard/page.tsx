import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function logout() {
  'use server'
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900">Dashboard</h1>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl p-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <p className="text-sm text-zinc-500">Bienvenido</p>
          <p className="mt-1 text-xl font-medium text-zinc-900">
            {profile?.full_name ?? profile?.email}
          </p>
          {profile?.role && (
            <span className="mt-2 inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 capitalize">
              {profile.role}
            </span>
          )}
          <div className="mt-4 border-t border-zinc-100 pt-4">
            <Link
              href="/dashboard/profile"
              className="text-sm font-medium text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              Editar perfil →
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
