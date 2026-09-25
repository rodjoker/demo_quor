'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Boxes,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  ShoppingCart,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { logout, switchDemoRole } from '@/lib/session-actions'
import { NAV_BY_ROLE, ROLES, ROLE_HOME, ROLE_LABEL, canAccess, type NavKey } from '@/lib/roles'
import type { Role } from '@/lib/types'
import { cx } from './ui'

const ICONS: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  pedidos: ClipboardList,
  bodega: PackageCheck,
  stock: Boxes,
  'nuevo-pedido': ShoppingCart,
  usuarios: Users,
}

interface ShellProps {
  role: Role
  name: string
  email: string
  demo: boolean
  children: ReactNode
}

export function Shell({ role, name, email, demo, children }: ShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const nav = NAV_BY_ROLE[role]

  // La seguridad real vive en la base de datos; esto solo evita mostrar pantallas que el rol no usa.
  const allowed = canAccess(role, pathname)
  useEffect(() => {
    if (!allowed) router.replace(ROLE_HOME[role])
  }, [allowed, role, router])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  // En móvil caben 5 accesos; el resto vive en el menú de usuario
  const bottomNav = nav.slice(0, 5)
  const overflowNav = nav.slice(5)

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <div className="brand-line fixed inset-x-0 top-0 z-40 h-[3px]" aria-hidden />

      {/* Barra lateral (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface pt-[3px] lg:flex">
        <div className="px-5 pb-4 pt-6">
          <Link href={ROLE_HOME[role]} aria-label="Inicio">
            <Image src="/quor-logo.png" alt="Quor" width={96} height={49} priority className="h-auto w-24" />
          </Link>
        </div>
        <nav aria-label="Principal" className="flex-1 space-y-1 px-3">
          {nav.map(item => {
            const Icon = ICONS[item.key]
            const active = isActive(item.href)
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                  active ? 'bg-pink-soft text-ink' : 'text-muted hover:bg-canvas hover:text-ink',
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-line p-3">
          <UserMenu role={role} name={name} email={email} demo={demo} placement="top" extraNav={[]} />
        </div>
      </aside>

      {/* Barra superior (móvil) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 pb-2 pt-[calc(0.5rem+3px)] lg:hidden">
        <Link href={ROLE_HOME[role]} aria-label="Inicio">
          <Image src="/quor-logo.png" alt="Quor" width={72} height={37} priority className="h-auto w-[4.5rem]" />
        </Link>
        <UserMenu role={role} name={name} email={email} demo={demo} placement="bottom" extraNav={overflowNav} compact />
      </header>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 lg:ml-60 lg:px-8 lg:pb-10 lg:pt-8">
        <div className="mx-auto w-full max-w-6xl">{allowed ? children : null}</div>
      </main>

      {/* Navegación inferior (móvil) */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        style={{ gridTemplateColumns: `repeat(${bottomNav.length}, minmax(0, 1fr))` }}
      >
        {bottomNav.map(item => {
          const Icon = ICONS[item.key]
          const active = isActive(item.href)
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex min-h-14 flex-col items-center justify-center gap-0.5 whitespace-nowrap text-[11px] font-medium',
                active ? 'text-ink' : 'text-muted',
              )}
            >
              <span className={cx('rounded-full px-4 py-1 transition-colors', active && 'bg-pink-soft')}>
                <Icon className="size-5" aria-hidden />
              </span>
              {item.short ?? item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

function UserMenu({
  role,
  name,
  email,
  demo,
  placement,
  extraNav,
  compact,
}: {
  role: Role
  name: string
  email: string
  demo: boolean
  placement: 'top' | 'bottom'
  extraNav: { key: NavKey; href: string; label: string }[]
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('')

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-canvas"
      >
        <span className="brand-line flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-ink">
          {initials || 'Q'}
        </span>
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{name}</span>
            <span className="block truncate text-xs text-muted">{ROLE_LABEL[role]}</span>
          </span>
        )}
        <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className={cx(
            'absolute z-50 w-64 rounded-lg border border-line bg-surface p-1.5 shadow-lg',
            placement === 'top' ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-2',
          )}
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-ink">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>

          {extraNav.map(item => {
            const Icon = ICONS[item.key]
            return (
              <Link
                key={item.key}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-ink hover:bg-canvas"
              >
                <Icon className="size-4" aria-hidden /> {item.label}
              </Link>
            )
          })}
          <Link
            href="/perfil"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-ink hover:bg-canvas"
          >
            <User className="size-4" aria-hidden /> Mi perfil
          </Link>

          {demo && (
            <div className="mt-1 border-t border-line px-3 pb-2 pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Ver la demo como
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {ROLES.map(r => (
                  <form key={r} action={switchDemoRole.bind(null, r)}>
                    <button
                      type="submit"
                      aria-pressed={r === role}
                      className={cx(
                        'min-h-10 w-full rounded-[5px] border px-2 text-xs font-medium',
                        r === role
                          ? 'border-ink bg-ink text-white'
                          : 'border-line bg-surface text-ink hover:bg-canvas',
                      )}
                    >
                      {ROLE_LABEL[r]}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          )}

          {!demo && (
            <form action={logout} className="mt-1 border-t border-line pt-1">
              <button
                type="submit"
                role="menuitem"
                className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-ink hover:bg-canvas"
              >
                <LogOut className="size-4" aria-hidden /> Cerrar sesión
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
