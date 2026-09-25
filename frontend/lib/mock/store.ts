// Almacén en memoria del MODO DEMO (cuando no hay Supabase configurado).
// Replica las reglas de las funciones SQL (place_order, set_order_status, adjust_stock):
//  - el stock baja al instante y nunca queda negativo,
//  - una compra parcial registra la demanda no atendida,
//  - cancelar devuelve el stock una sola vez,
//  - cada cambio deja un movimiento y un evento.
// Con Supabase configurado no se usa: ver lib/data/supabase-provider.tsx.
import { useSyncExternalStore } from 'react'
import { buildSeed, PRODUCT_BY_ID, type SeedState } from './seed'
import { StoreError, type PlaceOrderResult } from '../data/types'
import { TRANSITIONS } from '../order-flow'
import type { Channel, Order, OrderItem, OrderStatus, Role } from '../types'

export type State = SeedState

const INITIAL: State = buildSeed()
let state: State = INITIAL
const listeners = new Set<() => void>()

function commit(next: State) {
  state = next
  listeners.forEach(l => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Estado en memoria del modo demo (lo consume lib/data/demo-provider.tsx). */
export function useMockStore(): State {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL)
}

export interface MockPlaceOrderInput {
  customerId: string
  items: { productId: string; quantity: number }[]
  channel: Channel
  onShortage: 'partial' | 'reject'
  by: string
}

let counter = 0
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`

export function placeOrder(input: MockPlaceOrderInput): PlaceOrderResult {
  if (input.items.length === 0) throw new StoreError('invalid_items', 'El pedido está vacío.')

  // Agrupa líneas repetidas y valida
  const grouped = new Map<string, number>()
  for (const it of input.items) {
    if (!Number.isInteger(it.quantity) || it.quantity <= 0 || it.quantity > 100000) {
      throw new StoreError('invalid_items', 'Cantidad inválida.')
    }
    if (!PRODUCT_BY_ID.has(it.productId)) throw new StoreError('product_not_found', 'Producto inexistente.')
    grouped.set(it.productId, (grouped.get(it.productId) ?? 0) + it.quantity)
  }

  const stock = { ...state.stock }
  const now = new Date().toISOString()
  const orderId = uid('o')
  const number = state.nextNumber

  const lines: PlaceOrderResult['lines'] = []
  const items: OrderItem[] = []
  const unmet = [...state.unmet]
  const movements = [...state.movements]
  let total = 0
  let units = 0

  for (const [productId, requested] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const product = PRODUCT_BY_ID.get(productId)!
    const available = stock[productId] ?? 0
    if (input.onShortage === 'reject' && available < requested) {
      throw new StoreError(
        'insufficient_stock',
        `${product.name}: pediste ${requested} y solo quedan ${available}.`,
      )
    }
    const confirmed = Math.min(available, requested)
    if (confirmed > 0) {
      stock[productId] = available - confirmed
      movements.unshift({
        id: uid('m'), productId, delta: -confirmed, reason: 'sale', orderId, at: now, by: input.by,
      })
    }
    if (requested > confirmed) {
      unmet.unshift({ orderId, productId, missing: requested - confirmed, unitPrice: product.price, at: now })
    }
    items.push({ productId, requested, confirmed, unitPrice: product.price })
    lines.push({ productId, requested, confirmed, missing: requested - confirmed })
    total += confirmed * product.price
    units += confirmed
  }

  // Sin una sola unidad no hay nada que preparar: nace cancelado (la demanda ya quedó registrada)
  const status: OrderStatus = units === 0 ? 'cancelado' : 'recibido'
  const events: Order['events'] = [{ from: null, to: 'recibido', at: now, by: input.by }]
  if (status === 'cancelado') {
    events.push({ from: 'recibido', to: 'cancelado', at: now, by: 'Sistema', reason: 'sin_stock' })
  }

  const order: Order = {
    id: orderId, number, customerId: input.customerId, channel: input.channel,
    status, total, createdAt: now, items, events,
  }

  commit({ ...state, stock, orders: [order, ...state.orders], unmet, movements, nextNumber: number + 1 })
  return { order, lines }
}

export function setOrderStatus(orderId: string, to: OrderStatus, role: Role, by: string, reason?: string) {
  const order = state.orders.find(o => o.id === orderId)
  if (!order) throw new StoreError('order_not_found', 'Pedido no encontrado.')
  if (!TRANSITIONS[order.status].includes(to)) {
    throw new StoreError('invalid_transition', `No se puede pasar de ${order.status} a ${to}.`)
  }
  const isStaff = role === 'admin' || role === 'vendedor'
  const warehouseStep = (to === 'preparando' || to === 'despachado') && role === 'bodega'
  if (!isStaff && !warehouseStep) throw new StoreError('forbidden', 'No tienes permiso para este cambio.')

  const now = new Date().toISOString()
  const stock = { ...state.stock }
  const movements = [...state.movements]
  if (to === 'cancelado') {
    for (const it of order.items) {
      if (it.confirmed > 0) {
        stock[it.productId] = (stock[it.productId] ?? 0) + it.confirmed
        movements.unshift({
          id: uid('m'), productId: it.productId, delta: it.confirmed, reason: 'cancel_restock',
          orderId, at: now, by,
        })
      }
    }
  }

  const updated: Order = {
    ...order,
    status: to,
    events: [...order.events, { from: order.status, to, at: now, by, ...(reason ? { reason } : {}) }],
  }
  commit({ ...state, stock, movements, orders: state.orders.map(o => (o.id === orderId ? updated : o)) })
}

export function adjustStock(productId: string, newQuantity: number, role: Role, by: string, note?: string) {
  if (role !== 'admin') throw new StoreError('forbidden', 'Solo el administrador ajusta el stock.')
  if (!PRODUCT_BY_ID.has(productId)) throw new StoreError('product_not_found', 'Producto inexistente.')
  if (!Number.isInteger(newQuantity) || newQuantity < 0) {
    throw new StoreError('invalid_quantity', 'La cantidad debe ser un entero mayor o igual a 0.')
  }
  const old = state.stock[productId] ?? 0
  if (newQuantity === old) return
  commit({
    ...state,
    stock: { ...state.stock, [productId]: newQuantity },
    movements: [
      {
        id: uid('m'), productId, delta: newQuantity - old, reason: 'manual_adjust',
        at: new Date().toISOString(), by, ...(note ? { note } : {}),
      },
      ...state.movements,
    ],
  })
}
