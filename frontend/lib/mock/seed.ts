// Datos cableados de la demo. Solo el catálogo es real (78 productos públicos de quorproducts.co);
// clientes, stock, pedidos e historial son FICTICIOS y así se debe decir en la presentación.
import raw from './products.json'
import type {
  AppUser,
  Customer,
  Order,
  OrderEvent,
  OrderItem,
  OrderStatus,
  Product,
  StockMovement,
  UnmetDemand,
} from '../types'

export const PRODUCTS: Product[] = raw.map(p => ({
  id: String(p.id),
  sku: p.sku,
  name: p.name,
  category: p.category,
  price: p.price,
  image: p.image,
}))

export const PRODUCT_BY_ID = new Map(PRODUCTS.map(p => [p.id, p]))
const BY_SKU = new Map(PRODUCTS.map(p => [p.sku, p]))

// Producto del caso estrella de la demo: "piden 50 y quedan 35"
export const ROSE_GOLD = BY_SKU.get('QRGPRG0015')!


function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seedStock(): Record<string, number> {
  const stock: Record<string, number> = {}
  PRODUCTS.forEach((p, i) => {
    const h = hash(p.sku)
    let qty = 40 + (h % 260)
    if (i % 9 === 4) qty = 3 + (h % 11) // bajo
    if (i % 17 === 8) qty = 0 // agotado
    stock[p.id] = qty
  })
  stock[ROSE_GOLD.id] = 35
  return stock
}

export const CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Salón Bella Uñas', document: 'NIT 900.412.118-3', city: 'Medellín', phone: '+57 300 555 0141', type: 'mayorista' },
  { id: 'c2', name: 'Nails by Camila', document: 'CC 1.037.555.210', city: 'Envigado', phone: '+57 311 555 0172', type: 'detal' },
  { id: 'c3', name: 'Distribuciones Estética Total', document: 'NIT 901.223.774-9', city: 'Bogotá', phone: '+57 310 555 0193', type: 'mayorista' },
  { id: 'c4', name: 'Studio Glam Cali', document: 'NIT 900.870.331-5', city: 'Cali', phone: '+57 315 555 0114', type: 'mayorista' },
  { id: 'c5', name: 'Manicure Express', document: 'CC 43.998.120', city: 'Bello', phone: '+57 320 555 0165', type: 'detal' },
  { id: 'c6', name: 'Academia Uñas de Autor', document: 'NIT 901.004.552-1', city: 'Barranquilla', phone: '+57 304 555 0128', type: 'mayorista' },
]

export const CUSTOMER_BY_ID = new Map(CUSTOMERS.map(c => [c.id, c]))

export const USERS: AppUser[] = [
  { id: 'u1', name: 'Gerencia Quor', email: 'admin@quor.demo', role: 'admin', blocked: false },
  { id: 'u2', name: 'Laura Restrepo', email: 'laura@quor.demo', role: 'vendedor', blocked: false },
  { id: 'u3', name: 'Andrés Vélez', email: 'andres@quor.demo', role: 'vendedor', blocked: false },
  { id: 'u4', name: 'Carlos Muñoz', email: 'carlos@quor.demo', role: 'bodega', blocked: false },
  { id: 'u5', name: 'Salón Bella Uñas', email: 'bella@cliente.demo', role: 'cliente', blocked: false },
  { id: 'u6', name: 'Nails by Camila', email: 'camila@cliente.demo', role: 'cliente', blocked: true },
]

// ---------- Pedidos históricos ----------
const p = (sku: string) => BY_SKU.get(sku)!.id
const at = (i: number) => PRODUCTS[i].id

type L = [productId: string, requested: number, confirmed: number]
interface OrderSeed {
  number: number
  customerId: string
  at: string
  channel: 'web' | 'app'
  status: OrderStatus
  lines: L[]
}

const T = (d: string, hm: string) => `2026-09-${d}T${hm}:00-05:00`

const ORDER_SEEDS: OrderSeed[] = [
  { number: 1049, customerId: 'c1', at: T('25', '09:14'), channel: 'web', status: 'recibido',
    lines: [[ROSE_GOLD.id, 50, 35], [p('QRGPTOC015'), 10, 10], [p('QRGPVV0015'), 12, 12]] },
  { number: 1048, customerId: 'c3', at: T('25', '08:40'), channel: 'app', status: 'recibido',
    lines: [[p('QRET120001'), 60, 60], [p('QRET120004'), 40, 40]] },
  { number: 1047, customerId: 'c2', at: T('25', '08:05'), channel: 'web', status: 'en_revision',
    lines: [[p('QRGPTTN0015'), 6, 6], [p('QRGPTOC015'), 6, 6]] },
  { number: 1046, customerId: 'c5', at: T('25', '07:30'), channel: 'app', status: 'preparando',
    lines: [[at(20), 12, 12], [at(21), 12, 12], [at(22), 8, 8]] },
  { number: 1045, customerId: 'c4', at: T('24', '17:20'), channel: 'web', status: 'aprobado',
    lines: [[at(40), 24, 24], [at(41), 24, 24], [p('QRGL202405'), 30, 30]] },
  { number: 1044, customerId: 'c6', at: T('24', '15:02'), channel: 'web', status: 'preparando',
    lines: [[at(55), 20, 20], [at(56), 10, 10]] },
  { number: 1043, customerId: 'c1', at: T('24', '11:48'), channel: 'app', status: 'despachado',
    lines: [[p('QRGL202407'), 40, 40], [p('QRGPVV0015'), 24, 24]] },
  { number: 1042, customerId: 'c3', at: T('23', '16:10'), channel: 'web', status: 'despachado',
    lines: [[at(10), 80, 80], [at(11), 80, 70], [at(12), 50, 50]] },
  { number: 1041, customerId: 'c2', at: T('23', '10:30'), channel: 'web', status: 'cancelado',
    lines: [[at(30), 6, 6]] },
  { number: 1040, customerId: 'c5', at: T('22', '14:15'), channel: 'app', status: 'despachado',
    lines: [[at(3), 30, 30], [at(60), 12, 12]] },
  { number: 1039, customerId: 'c4', at: T('22', '09:00'), channel: 'web', status: 'despachado',
    lines: [[ROSE_GOLD.id, 40, 40], [at(64), 20, 20]] },
  { number: 1038, customerId: 'c1', at: T('21', '13:45'), channel: 'web', status: 'despachado',
    lines: [[at(70), 15, 15], [at(71), 15, 15]] },
  { number: 1037, customerId: 'c6', at: T('20', '16:30'), channel: 'app', status: 'despachado',
    lines: [[at(5), 100, 100], [at(6), 100, 90]] },
  { number: 1036, customerId: 'c3', at: T('19', '11:05'), channel: 'web', status: 'despachado',
    lines: [[at(45), 36, 36], [at(46), 36, 36]] },
]

const STAFF = { vendedor: 'Laura Restrepo', bodega: 'Carlos Muñoz' }

const CHAIN: Record<OrderStatus, OrderStatus[]> = {
  recibido: ['recibido'],
  en_revision: ['recibido', 'en_revision'],
  aprobado: ['recibido', 'en_revision', 'aprobado'],
  preparando: ['recibido', 'aprobado', 'preparando'],
  despachado: ['recibido', 'aprobado', 'preparando', 'despachado'],
  cancelado: ['recibido', 'cancelado'],
}

function buildEvents(startIso: string, status: OrderStatus): OrderEvent[] {
  const start = new Date(startIso).getTime()
  const chain = CHAIN[status]
  return chain.map((to, i) => ({
    from: i === 0 ? null : chain[i - 1],
    to,
    at: new Date(start + i * 12 * 60_000).toISOString(),
    by: to === 'despachado' ? STAFF.bodega : i === 0 ? 'Sistema' : STAFF.vendedor,
    ...(to === 'cancelado' ? { reason: 'El cliente se arrepintió' } : {}),
  }))
}

export interface SeedState {
  stock: Record<string, number>
  orders: Order[]
  unmet: UnmetDemand[]
  movements: StockMovement[]
  nextNumber: number
}

export function buildSeed(): SeedState {
  const orders: Order[] = []
  const unmet: UnmetDemand[] = []
  const movements: StockMovement[] = []

  for (const s of ORDER_SEEDS) {
    const id = `o${s.number}`
    const items: OrderItem[] = s.lines.map(([productId, requested, confirmed]) => ({
      productId,
      requested,
      confirmed,
      unitPrice: PRODUCT_BY_ID.get(productId)!.price,
    }))
    const total = items.reduce((sum, it) => sum + it.confirmed * it.unitPrice, 0)
    orders.push({
      id,
      number: s.number,
      customerId: s.customerId,
      channel: s.channel,
      status: s.status,
      total,
      createdAt: new Date(s.at).toISOString(),
      items,
      events: buildEvents(s.at, s.status),
    })

    items.forEach((it, i) => {
      if (it.confirmed > 0) {
        movements.push({
          id: `m-${id}-${i}`, productId: it.productId, delta: -it.confirmed, reason: 'sale',
          orderId: id, at: new Date(s.at).toISOString(), by: 'Sistema',
        })
        if (s.status === 'cancelado') {
          movements.push({
            id: `m-${id}-${i}-r`, productId: it.productId, delta: it.confirmed, reason: 'cancel_restock',
            orderId: id, at: new Date(new Date(s.at).getTime() + 12 * 60_000).toISOString(), by: STAFF.vendedor,
          })
        }
      }
      if (it.requested > it.confirmed) {
        unmet.push({
          orderId: id, productId: it.productId, missing: it.requested - it.confirmed,
          unitPrice: it.unitPrice, at: new Date(s.at).toISOString(),
        })
      }
    })
  }

  orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  movements.sort((a, b) => b.at.localeCompare(a.at))

  return {
    stock: seedStock(),
    orders,
    unmet,
    movements,
    nextNumber: Math.max(...ORDER_SEEDS.map(s => s.number)) + 1,
  }
}
