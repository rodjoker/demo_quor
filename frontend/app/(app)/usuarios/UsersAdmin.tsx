'use client'

import { useState } from 'react'
import { Card, PageHeader, btn, cx, inputCls } from '@/components/ui'
import { USERS } from '@/lib/mock/seed'
import { ROLES, ROLE_LABEL, isRole } from '@/lib/roles'
import type { AppUser } from '@/lib/types'

export default function UsersAdmin() {
  const [users, setUsers] = useState<AppUser[]>(USERS)

  const update = (id: string, patch: Partial<AppUser>) =>
    setUsers(list => list.map(u => (u.id === id ? { ...u, ...patch } : u)))

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle="Asigna roles y bloquea accesos. Los cambios de rol aplican al volver a iniciar sesión."
      />

      <Card>
        <ul className="divide-y divide-line">
          {users.map(u => (
            <li key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  {u.name}
                  {u.blocked && (
                    <span className="rounded-full bg-bad/10 px-2 py-0.5 text-xs font-medium text-bad">Bloqueado</span>
                  )}
                </p>
                <p className="truncate text-xs text-muted">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`role-${u.id}`}>
                  Rol de {u.name}
                </label>
                <select
                  id={`role-${u.id}`}
                  value={u.role}
                  onChange={e => isRole(e.target.value) && update(u.id, { role: e.target.value })}
                  className={cx(inputCls, 'w-44')}
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <button className={u.blocked ? btn.secondary : btn.danger} onClick={() => update(u.id, { blocked: !u.blocked })}>
                  {u.blocked ? 'Desbloquear' : 'Bloquear'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <p className="mt-3 text-xs text-muted">
        Modo demo: los cambios de esta pantalla no se guardan. Con Supabase se aplican sobre <code>profiles</code>.
      </p>
    </>
  )
}
