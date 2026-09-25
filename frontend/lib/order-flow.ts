import type { OrderStatus } from './types'

// Estados a los que puede pasar un pedido. La base de datos vuelve a validarlo en set_order_status().
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  recibido: ['en_revision', 'preparando', 'cancelado'],
  en_revision: ['aprobado', 'cancelado'],
  aprobado: ['preparando', 'cancelado'],
  preparando: ['despachado', 'cancelado'],
  despachado: [],
  cancelado: [],
}

export const nextStatuses = (s: OrderStatus) => TRANSITIONS[s]
