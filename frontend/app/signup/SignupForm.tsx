'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signup, type SignupState } from './actions'

export default function SignupForm() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(signup, null)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-zinc-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 disabled:opacity-50"
          placeholder="tu@email.com"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-zinc-700">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 disabled:opacity-50"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? 'Creando cuenta...' : 'Crear cuenta'}
      </button>

      <p className="text-center text-sm text-zinc-500">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-medium text-zinc-900 hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </form>
  )
}
