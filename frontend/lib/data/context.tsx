'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { StoreValue } from './types'

export const StoreContext = createContext<StoreValue | null>(null)

export function useStore(): StoreValue {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore debe usarse dentro de <StoreProvider>.')
  return value
}

/** Muestra "cargando" o el error de conexión en lugar de la pantalla, hasta que haya datos. */
export function DataGate({ children }: { children: ReactNode }) {
  const { status, error, reload } = useStore()

  if (status === 'loading') {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-24 text-sm text-muted">
        <span className="size-6 animate-spin rounded-full border-2 border-line border-t-ink" aria-hidden />
        Cargando datos…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div role="alert" className="mx-auto max-w-md py-20 text-center">
        <p className="text-base font-semibold text-ink">No se pudieron cargar los datos</p>
        <p className="mt-2 text-sm text-muted">{error}</p>
        <button
          onClick={reload}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[5px] bg-ink px-4 text-sm font-semibold text-white hover:bg-[#2a2a2a]"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return <>{children}</>
}
