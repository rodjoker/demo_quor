'use client'

// Modo real: los datos viven en Supabase.
//  - LEER:     consultas a las tablas (la RLS decide qué ve cada rol).
//  - ESCRIBIR: solo por las funciones de la base (place_order, set_order_status, adjust_stock).
//  - ESCUCHAR: Realtime avisa de cambios en `stock` y `orders`, hechos por cualquier usuario.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  Channel,
  Customer,
  MovementReason,
  Order,
  OrderStatus,
  Product,
  Role,
  StockMovement,
  UnmetDemand,
} from '../types'
import { StoreContext } from './context'
import { StoreError, type PlaceOrderInput, type PlaceOrderResult, type StoreValue } from './types'

// ---------- Filas tal como salen de la base ----------
interface ProductRow { id: string; sku: string; name: string; category: string; price_cop: number; image_url: string | null }
interface CustomerRow { id: string; name: string; document: string | null; city: string | null; phone: string | null; customer_type: 'mayorista' | 'detal' }
interface StockRow { product_id: string; quantity: number }
interface OrderRow {
  id: string
  order_number: number
  customer_id: string
  channel: Channel
  status: OrderStatus
  total_cop: number
  created_at: string
  order_items: { product_id: string; quantity_requested: number; quantity_confirmed: number; unit_price_cop: number }[]
  order_events: { id: number; from_status: OrderStatus | null; to_status: OrderStatus; created_at: string; user_name: string | null; reason: string | null }[]
}
interface UnmetRow { order_id: string; product_id: string; quantity_missing: number; unit_price_cop: number; created_at: string }
interface MovementRow {
  id: number; product_id: string; delta: number; reason: MovementReason
  order_id: string | null; user_name: string | null; note: string | null; created_at: string
}
interface RpcOrderResult {
  order_id: string
  order_number: number
  status: OrderStatus
  total_cop: number
  lines: { product_id: string; requested: number; confirmed: number; missing: number }[]
}

const ORDER_SELECT =
  'id, order_number, customer_id, channel, status, total_cop, created_at, ' +
  'order_items(product_id, quantity_requested, quantity_confirmed, unit_price_cop), ' +
  'order_events(id, from_status, to_status, created_at, user_name, reason)'

const NONE = { data: [], error: null }

function unwrap<T>(res: { data: unknown; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(res.error.message)
  return (res.data ?? []) as T[]
}

// ---------- Conversión fila -> modelo de la app ----------
const toProduct = (r: ProductRow): Product => ({
  id: r.id, sku: r.sku, name: r.name, category: r.category, price: r.price_cop, image: r.image_url,
})

const toCustomer = (r: CustomerRow): Customer => ({
  id: r.id, name: r.name, document: r.document ?? '', city: r.city ?? '', phone: r.phone ?? '', type: r.customer_type,
})

const toOrder = (r: OrderRow): Order => ({
  id: r.id,
  number: Number(r.order_number),
  customerId: r.customer_id,
  channel: r.channel,
  status: r.status,
  total: r.total_cop,
  createdAt: r.created_at,
  items: r.order_items.map(i => ({
    productId: i.product_id, requested: i.quantity_requested, confirmed: i.quantity_confirmed, unitPrice: i.unit_price_cop,
  })),
  // Varios eventos del mismo pedido comparten la hora de la transacción: se desempata por id
  events: [...r.order_events]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
    .map(e => ({
      from: e.from_status, to: e.to_status, at: e.created_at, by: e.user_name ?? 'Sistema',
      ...(e.reason ? { reason: e.reason } : {}),
    })),
})

const toUnmet = (r: UnmetRow): UnmetDemand => ({
  orderId: r.order_id, productId: r.product_id, missing: r.quantity_missing, unitPrice: r.unit_price_cop, at: r.created_at,
})

const toMovement = (r: MovementRow): StockMovement => ({
  id: String(r.id), productId: r.product_id, delta: r.delta, reason: r.reason,
  ...(r.order_id ? { orderId: r.order_id } : {}),
  at: r.created_at, by: r.user_name ?? 'Sistema',
  ...(r.note ? { note: r.note } : {}),
})

// ---------- Errores de la base -> mensajes para personas ----------
const KNOWN_ERRORS: [RegExp, string, string][] = [
  [/forbidden|permission denied|row-level security/i, 'forbidden', 'No tienes permiso para esta acción.'],
  [/invalid_transition/i, 'invalid_transition', 'Ese cambio de estado ya no es posible: otra persona pudo actualizar el pedido antes.'],
  [/order_not_found/i, 'order_not_found', 'No encontramos el pedido.'],
  [/product_not_found/i, 'product_not_found', 'Uno de los productos ya no está disponible.'],
  [/customer_not_found/i, 'customer_not_found', 'No encontramos el cliente del pedido.'],
  [/invalid_items|invalid_quantity|invalid_shortage_mode/i, 'invalid_input', 'Revisa las cantidades: deben ser números enteros positivos.'],
]

function toStoreError(message: string, products: ReadonlyMap<string, Product>): StoreError {
  if (/^insufficient_stock/i.test(message)) {
    const m = message.match(/product ([0-9a-f-]{36}), requested (\d+), available (\d+)/i)
    if (m) {
      const name = products.get(m[1])?.name ?? 'Un producto'
      return new StoreError('insufficient_stock', `${name}: pediste ${m[2]} y solo quedan ${m[3]}.`)
    }
    return new StoreError('insufficient_stock', 'No hay stock suficiente para este pedido.')
  }
  for (const [re, code, text] of KNOWN_ERRORS) if (re.test(message)) return new StoreError(code, text)
  console.error('[quor] error de la base de datos:', message)
  return new StoreError('unknown', 'No se pudo completar la acción. Intenta de nuevo.')
}

// ---------- Proveedor ----------
interface Snapshot {
  status: StoreValue['status']
  error: string | null
  products: Product[]
  customers: Customer[]
  stock: Record<string, number>
  orders: Order[]
  unmet: UnmetDemand[]
  movements: StockMovement[]
}

const EMPTY: Snapshot = {
  status: 'loading', error: null, products: [], customers: [], stock: {}, orders: [], unmet: [], movements: [],
}

const byNewest = (a: Order, b: Order) => b.createdAt.localeCompare(a.createdAt)

export function SupabaseProvider({ role, children }: { role: Role; children: ReactNode }) {
  const supabase = useMemo(() => createClient(), [])
  // Solo el administrador puede leer la demanda no atendida y el libro de movimientos (RLS)
  const canAudit = role === 'admin'

  const [snap, setSnap] = useState<Snapshot>(EMPTY)
  const [live, setLive] = useState(false)

  const productById = useMemo(() => new Map(snap.products.map(p => [p.id, p])), [snap.products])
  const customerById = useMemo(() => new Map(snap.customers.map(c => [c.id, c])), [snap.customers])
  const productsRef = useRef<ReadonlyMap<string, Product>>(productById)
  useEffect(() => {
    productsRef.current = productById
  }, [productById])

  // ----- Lecturas -----
  const loadStock = useCallback(async () => {
    const rows = unwrap<StockRow>(await supabase.from('stock').select('product_id, quantity'))
    const stock: Record<string, number> = {}
    for (const r of rows) stock[r.product_id] = (stock[r.product_id] ?? 0) + r.quantity
    setSnap(prev => ({ ...prev, stock }))
  }, [supabase])

  const loadAudit = useCallback(async () => {
    if (!canAudit) return
    const [u, m] = await Promise.all([
      supabase.from('unmet_demand').select('order_id, product_id, quantity_missing, unit_price_cop, created_at')
        .order('created_at', { ascending: false }).limit(500),
      supabase.from('stock_movements').select('id, product_id, delta, reason, order_id, user_name, note, created_at')
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(500),
    ])
    setSnap(prev => ({
      ...prev,
      unmet: unwrap<UnmetRow>(u).map(toUnmet),
      movements: unwrap<MovementRow>(m).map(toMovement),
    }))
  }, [supabase, canAudit])

  // Trae UN pedido (con sus líneas y su historial) y lo mezcla en la lista
  const fetchOrder = useCallback(
    async (id: string) => {
      const res = await supabase.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle()
      if (res.error) throw new Error(res.error.message)
      if (!res.data) return
      const order = toOrder(res.data as unknown as OrderRow)
      setSnap(prev => ({ ...prev, orders: [order, ...prev.orders.filter(o => o.id !== order.id)].sort(byNewest) }))
    },
    [supabase],
  )

  const loadOrders = useCallback(async () => {
    const res = await supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(300)
    const orders = unwrap<OrderRow>(res).map(toOrder)
    setSnap(prev => ({ ...prev, orders }))
  }, [supabase])

  const loadAll = useCallback(async () => {
    console.info('[quor] carga: inicio')
    try {
      const [p, c, s, o, u, m] = await Promise.all([
        supabase.from('products').select('id, sku, name, category, price_cop, image_url').eq('active', true).order('name'),
        supabase.from('customers').select('id, name, document, city, phone, customer_type').order('name'),
        supabase.from('stock').select('product_id, quantity'),
        supabase.from('orders').select(ORDER_SELECT).order('created_at', { ascending: false }).limit(300),
        canAudit
          ? supabase.from('unmet_demand').select('order_id, product_id, quantity_missing, unit_price_cop, created_at')
              .order('created_at', { ascending: false }).limit(500)
          : Promise.resolve(NONE),
        canAudit
          ? supabase.from('stock_movements').select('id, product_id, delta, reason, order_id, user_name, note, created_at')
              .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(500)
          : Promise.resolve(NONE),
      ])

      const stock: Record<string, number> = {}
      for (const r of unwrap<StockRow>(s)) stock[r.product_id] = (stock[r.product_id] ?? 0) + r.quantity

      console.info('[quor] carga: consultas listas', { productos: (p.data ?? []).length, clientes: (c.data ?? []).length, stock: (s.data ?? []).length, pedidos: (o.data ?? []).length })
      setSnap({
        status: 'ready',
        error: null,
        products: unwrap<ProductRow>(p).map(toProduct),
        customers: unwrap<CustomerRow>(c).map(toCustomer),
        stock,
        orders: unwrap<OrderRow>(o).map(toOrder),
        unmet: unwrap<UnmetRow>(u).map(toUnmet),
        movements: unwrap<MovementRow>(m).map(toMovement),
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error desconocido'
      console.error('[quor] carga falló:', message)
      // Si ya había datos en pantalla, se conservan; el error solo bloquea la primera carga
      setSnap(prev => (prev.status === 'ready' ? prev : { ...prev, status: 'error', error: message }))
    }
  }, [supabase, canAudit])

  const reload = useCallback(() => {
    setSnap(prev => ({ ...prev, status: 'loading', error: null }))
    void loadAll()
  }, [loadAll])

  // ----- Carga inicial + Realtime -----
  useEffect(() => {
    let cancelled = false
    const timers: Record<string, ReturnType<typeof setTimeout> | undefined> = {}

    // Agrupa ráfagas de eventos (una compra toca varias filas) en una sola recarga
    const later = (key: string, fn: () => Promise<void>) => {
      clearTimeout(timers[key])
      timers[key] = setTimeout(() => {
        if (!cancelled) fn().catch(() => {})
      }, 200)
    }

    console.info('[quor] proveedor montado; rol:', role)
    // Carga inicial. No depende de Realtime: si la conexión en vivo tardara o fallara, los datos igual aparecen.
    later('init', loadAll)
    timers.watchdog = setTimeout(() => {
      if (cancelled) return
      setSnap(prev =>
        prev.status === 'loading'
          ? { ...prev, status: 'error', error: 'La carga está tardando demasiado. Revisa tu conexión y que las tablas existan en Supabase.' }
          : prev,
      )
    }, 15000)

    const channel = supabase
      .channel('quor-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, () => {
        later('stock', loadStock)
        later('audit', loadAudit)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        const id = (payload.new as { id?: string } | null)?.id
        if (payload.eventType === 'DELETE' || !id) later('orders', loadOrders)
        else fetchOrder(id).catch(() => {})
        later('audit', loadAudit)
      })
      .subscribe(status => {
        if (cancelled) return
        console.info('[quor] realtime:', status)
        setLive(status === 'SUBSCRIBED')
        // Al (re)conectar se recarga todo: cubre lo ocurrido mientras no había conexión
        if (status === 'SUBSCRIBED') void loadAll()
      })

    return () => {
      cancelled = true
      Object.values(timers).forEach(t => clearTimeout(t))
      void supabase.removeChannel(channel)
    }
  }, [supabase, role, loadAll, loadStock, loadAudit, loadOrders, fetchOrder])

  // ----- Escrituras (siempre por las funciones de la base) -----
  const refreshAfterWrite = useCallback(
    async (orderId?: string) => {
      await Promise.all([loadStock(), orderId ? fetchOrder(orderId) : Promise.resolve(), loadAudit()]).catch(() => {})
    },
    [loadStock, fetchOrder, loadAudit],
  )

  const placeOrder = useCallback(
    async (input: PlaceOrderInput): Promise<PlaceOrderResult> => {
      const { data, error } = await supabase.rpc('place_order', {
        p_customer_id: input.customerId,
        p_items: input.items.map(i => ({ product_id: i.productId, quantity: i.quantity })),
        p_channel: input.channel,
        p_on_shortage: input.onShortage,
      })
      if (error) throw toStoreError(error.message, productsRef.current)

      const res = data as RpcOrderResult
      void refreshAfterWrite(res.order_id) // Realtime también avisará; esto evita esperar
      return {
        order: {
          id: res.order_id,
          number: Number(res.order_number),
          customerId: input.customerId,
          channel: input.channel,
          status: res.status,
          total: res.total_cop,
          createdAt: new Date().toISOString(),
          items: res.lines.map(l => ({
            productId: l.product_id,
            requested: l.requested,
            confirmed: l.confirmed,
            unitPrice: productsRef.current.get(l.product_id)?.price ?? 0,
          })),
          events: [],
        },
        lines: res.lines.map(l => ({
          productId: l.product_id, requested: l.requested, confirmed: l.confirmed, missing: l.missing,
        })),
      }
    },
    [supabase, refreshAfterWrite],
  )

  const setOrderStatus = useCallback(
    async (orderId: string, to: OrderStatus, reason?: string) => {
      const { error } = await supabase.rpc('set_order_status', {
        p_order_id: orderId,
        p_new_status: to,
        p_reason: reason ?? null,
      })
      if (error) {
        void refreshAfterWrite(orderId) // por si el pedido ya cambió: se muestra el estado real
        throw toStoreError(error.message, productsRef.current)
      }
      void refreshAfterWrite(orderId)
    },
    [supabase, refreshAfterWrite],
  )

  const adjustStock = useCallback(
    async (productId: string, newQuantity: number, note?: string) => {
      const { error } = await supabase.rpc('adjust_stock', {
        p_product_id: productId,
        p_new_quantity: newQuantity,
        p_reason: note ?? null,
      })
      if (error) throw toStoreError(error.message, productsRef.current)
      void refreshAfterWrite()
    },
    [supabase, refreshAfterWrite],
  )

  const value = useMemo<StoreValue>(
    () => ({
      status: snap.status,
      error: snap.error,
      reload,
      live,
      products: snap.products,
      productById,
      customers: snap.customers,
      customerById,
      stock: snap.stock,
      orders: snap.orders,
      unmet: snap.unmet,
      movements: snap.movements,
      placeOrder,
      setOrderStatus,
      adjustStock,
    }),
    [snap, live, reload, productById, customerById, placeOrder, setOrderStatus, adjustStock],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
