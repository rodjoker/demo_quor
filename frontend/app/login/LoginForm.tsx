'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { btn, cx, inputCls } from '@/components/ui'
import { login, type LoginState } from './actions'

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, null)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <div role="alert" className="rounded-md bg-bad/10 px-4 py-3 text-sm text-bad">
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-ink">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputCls}
          placeholder="tu@correo.com"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputCls}
          placeholder="••••••••"
        />
      </div>

      <button type="submit" disabled={pending} className={cx(btn.primary, 'mt-2')}>
        {pending ? 'Ingresando…' : 'Ingresar'}
      </button>

      <p className="text-center text-sm text-muted">
        ¿No tienes cuenta?{' '}
        <Link href="/signup" className="font-medium text-ink underline-offset-2 hover:underline">
          Crear cuenta
        </Link>
      </p>
    </form>
  )
}
