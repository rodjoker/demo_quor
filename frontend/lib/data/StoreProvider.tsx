'use client'

import type { ReactNode } from 'react'
import type { Role } from '../types'
import { DemoProvider } from './demo-provider'
import { SupabaseProvider } from './supabase-provider'

/** Elige de dónde vienen los datos: memoria (demo) o Supabase (real). */
export function StoreProvider({
  demo,
  role,
  userName,
  children,
}: {
  demo: boolean
  role: Role
  userName: string
  children: ReactNode
}) {
  return demo ? (
    <DemoProvider role={role} userName={userName}>
      {children}
    </DemoProvider>
  ) : (
    <SupabaseProvider role={role}>{children}</SupabaseProvider>
  )
}
