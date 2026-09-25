'use client'

import { useActionState } from 'react'
import { updateProfile, type ProfileState } from './actions'
import { Card, PageHeader, btn, cx, inputCls } from '@/components/ui'

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
  placeholder,
  readOnly,
}: {
  label: string
  name: string
  defaultValue?: string | null
  placeholder?: string
  readOnly?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-xs font-medium text-muted">
        {label}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        readOnly={readOnly}
        className={cx(inputCls, readOnly && 'cursor-default bg-canvas text-muted')}
      />
    </div>
  )
}

export default function ProfileForm({ profile, demo }: { profile: Profile; demo?: boolean }) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(updateProfile, null)

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Mi perfil" subtitle={profile.full_name || profile.email} />

      <form action={formAction}>
        <Card className="space-y-8 p-5 sm:p-6">
          {demo && (
            <p className="rounded-md bg-pink-soft/60 px-3 py-2 text-sm text-ink">
              Modo demo: el perfil es de ejemplo y no se guarda. Al conectar Supabase se activa la edición.
            </p>
          )}
          {state?.error && (
            <p role="alert" className="rounded-md bg-bad/10 px-3 py-2 text-sm text-bad">
              {state.error}
            </p>
          )}
          {state?.success && (
            <p role="status" className="rounded-md bg-ok/10 px-3 py-2 text-sm text-ok">
              Perfil actualizado correctamente.
            </p>
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold text-ink">Cuenta</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Correo" name="email" defaultValue={profile.email} readOnly />
              <Field label="Rol" name="role" defaultValue={profile.role ?? '—'} readOnly />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-ink">Información personal</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre completo" name="full_name" defaultValue={profile.full_name} placeholder="Laura Restrepo" />
              <Field label="Nombre de usuario" name="username" defaultValue={profile.username} placeholder="laurar" />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-ink">Contacto</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Teléfono" name="phone_number" defaultValue={profile.phone_number} placeholder="+57 300 000 0000" />
              <Field label="Dirección" name="address" defaultValue={profile.address} placeholder="Calle 10 # 20-30, Medellín" />
            </div>
          </section>

          <div className="flex justify-end border-t border-line pt-5">
            <button type="submit" disabled={pending || demo} className={btn.primary}>
              {pending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </Card>
      </form>
    </div>
  )
}
