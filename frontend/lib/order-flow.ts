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

// Quién puede llevar un pedido a cada estado: despachar es solo de bodega (y admin);
// el resto de cambios (aprobar, enviar a preparar, cancelar) son del vendedor (y admin).
export const canMoveTo = (role: string, to: OrderStatus) =>
  to === 'despachado' ? role === 'admin' || role === 'bodega' : role === 'admin' || role === 'vendedor'
