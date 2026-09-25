import type { Role } from './types'

export type NavKey =
  | 'dashboard'
  | 'pedidos'
  | 'bodega'
  | 'stock'
  | 'nuevo-pedido'
  | 'usuarios'

export interface NavItem {
  key: NavKey
  href: string
  label: string
  /** Etiqueta corta para la barra inferior del móvil */
  short?: string
}

const ITEMS: Record<NavKey, NavItem> = {
  dashboard: { key: 'dashboard', href: '/dashboard', label: 'Dashboard' },
  pedidos: { key: 'pedidos', href: '/pedidos', label: 'Pedidos' },
  bodega: { key: 'bodega', href: '/bodega', label: 'Bodega' },
  stock: { key: 'stock', href: '/stock', label: 'Inventario' },
  'nuevo-pedido': { key: 'nuevo-pedido', href: '/nuevo-pedido', label: 'Nuevo pedido', short: 'Nuevo' },
  usuarios: { key: 'usuarios', href: '/usuarios', label: 'Usuarios' },
}

// Qué ve cada rol. La seguridad real está en la base de datos (RLS + funciones);
// esto solo decide qué se muestra.
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  admin: [ITEMS.dashboard, ITEMS.pedidos, ITEMS.bodega, ITEMS.stock, ITEMS['nuevo-pedido'], ITEMS.usuarios],
  vendedor: [ITEMS.pedidos, ITEMS['nuevo-pedido'], ITEMS.stock],
  bodega: [ITEMS.bodega, ITEMS.stock],
  cliente: [ITEMS['nuevo-pedido'], ITEMS.pedidos],
}

export const ROLE_HOME: Record<Role, string> = {
  admin: '/dashboard',
  vendedor: '/pedidos',
  bodega: '/bodega',
  cliente: '/nuevo-pedido',
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  bodega: 'Bodega',
  cliente: 'Cliente',
}

export const ROLES: Role[] = ['admin', 'vendedor', 'bodega', 'cliente']

export const isRole = (v: unknown): v is Role =>
  typeof v === 'string' && (ROLES as string[]).includes(v)

// Rutas permitidas por rol (incluye las que no salen en el menú)
const EXTRA_PATHS = ['/perfil']
export function canAccess(role: Role, pathname: string): boolean {
  const allowed = [...NAV_BY_ROLE[role].map(n => n.href), ...EXTRA_PATHS]
  return allowed.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// Permisos finos usados por la interfaz (espejo de role_permissions en la base de datos)
export const can = {
  editStock: (r: Role) => r === 'admin',
  changeStatus: (r: Role) => r === 'admin' || r === 'vendedor',
  prepare: (r: Role) => r === 'admin' || r === 'bodega',
  orderForOthers: (r: Role) => r === 'admin' || r === 'vendedor',
  seeAllOrders: (r: Role) => r !== 'cliente',
}
