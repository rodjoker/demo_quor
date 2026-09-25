'use client'

import { useActionState } from 'react'
import { updateProfile, type ProfileState } from './actions'

type Profile = {
  username: string | null
  full_name: string | null
  address: string | null
  phone_number: string | null
  email: string
  role: string | null
}

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  placeholder,
  readOnly,
}: {
  label: string
  name: string
  defaultValue?: string | null
  type?: string
  placeholder?: string
  readOnly?: boolean
}) {
  return (
    <div className="group flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`rounded-none border-0 border-b pb-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-300
          ${readOnly
            ? 'cursor-default border-slate-100 bg-transparent text-slate-400'
            : 'border-slate-200 bg-transparent focus:border-slate-800'
          }`}
      />
    </div>
  )
}

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    updateProfile,
    null
  )

  const initials = profile.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : profile.email[0].toUpperCase()

  return (
    <div className="min-h-screen bg-slate-50 font-[system-ui]">
      <div className="mx-auto max-w-2xl px-6 py-12">

        {/* Header */}
        <div className="mb-10 flex items-end gap-6 border-b border-slate-200 pb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-xl font-bold tracking-tight text-white">
            {initials}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Mi perfil
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold text-slate-900">
              {profile.full_name || profile.email}
            </h1>
            {profile.role && (
              <span className="mt-1 inline-block rounded-sm bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-500">
                {profile.role}
              </span>
            )}
          </div>
        </div>

        <form action={formAction} className="space-y-10">

          {/* Feedback */}
          {state?.error && (
            <div className="border-l-2 border-red-400 pl-4 text-sm text-red-600">
              {state.error}
            </div>
          )}
          {state?.success && (
            <div className="border-l-2 border-emerald-400 pl-4 text-sm text-emerald-600">
              Perfil actualizado correctamente.
            </div>
          )}

          {/* Cuenta (solo lectura) */}
          <section>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-300">
              Cuenta
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Field label="Email" name="email" defaultValue={profile.email} readOnly />
              <Field label="Rol" name="role" defaultValue={profile.role ?? '—'} readOnly />
            </div>
          </section>

          {/* Información personal */}
          <section>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-300">
              Información personal
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Field
                label="Nombre completo"
                name="full_name"
                defaultValue={profile.full_name}
                placeholder="Juan Pérez"
              />
              <Field
                label="Nombre de usuario"
                name="username"
                defaultValue={profile.username}
                placeholder="juanperez"
              />
            </div>
          </section>

          {/* Contacto */}
          <section>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-300">
              Contacto
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Field
                label="Teléfono"
                name="phone_number"
                defaultValue={profile.phone_number}
                placeholder="+54 11 1234-5678"
              />
              <Field
                label="Dirección"
                name="address"
                defaultValue={profile.address}
                placeholder="Calle 123, Ciudad"
              />
            </div>
          </section>

          {/* Submit */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-6">
            <a
              href="/dashboard"
              className="text-sm text-slate-400 transition-colors hover:text-slate-700"
            >
              ← Volver
            </a>
            <button
              type="submit"
              disabled={pending}
              className="rounded-sm bg-slate-800 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-40"
            >
              {pending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
