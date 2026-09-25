// Reflejan las tablas de backend/supabase/migrations/20260925000000_quor_schema.sql.
// Al conectar Supabase, estos tipos se mantienen y solo cambia de dónde vienen los datos.

export type Role = 'admin' | 'vendedor' | 'bodega' | 'cliente'

export type OrderStatus =
  | 'recibido'
  | 'en_revision'
  | 'aprobado'
  | 'preparando'
  | 'despachado'
  | 'cancelado'

export type Channel = 'web' | 'app'
export type CustomerType = 'mayorista' | 'detal'
export type MovementReason = 'sale' | 'cancel_restock' | 'manual_adjust' | 'sync'

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  price: number // COP, sin decimales
  image: string | null
}

export interface Customer {
  id: string
  name: string
  document: string
  city: string
  phone: string
  type: CustomerType
}

export interface OrderItem {
  productId: string
  requested: number
  confirmed: number
  unitPrice: number
}

export interface OrderEvent {
  from: OrderStatus | null
  to: OrderStatus
  at: string // ISO
  by: string
  reason?: string
}

export interface Order {
  id: string
  number: number
  customerId: string
  channel: Channel
  status: OrderStatus
  total: number
  createdAt: string // ISO
  items: OrderItem[]
  events: OrderEvent[]
}

export interface UnmetDemand {
  orderId: string
  productId: string
  missing: number
  unitPrice: number
  at: string
}

export interface StockMovement {
  id: string
  productId: string
  delta: number
  reason: MovementReason
  orderId?: string
  at: string
  by: string
  note?: string
}

export interface AppUser {
  id: string
  name: string
  email: string
  role: Role
  blocked: boolean
}
