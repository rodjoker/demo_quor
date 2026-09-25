import { redirect } from 'next/navigation'
import { Shell } from '@/components/Shell'
import { DataGate } from '@/lib/data/context'
import { StoreProvider } from '@/lib/data/StoreProvider'
import { getSession } from '@/lib/session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <StoreProvider demo={session.demo} role={session.role} userName={session.name}>
      <Shell role={session.role} name={session.name} email={session.email} demo={session.demo}>
        <DataGate>{children}</DataGate>
      </Shell>
    </StoreProvider>
  )
}
