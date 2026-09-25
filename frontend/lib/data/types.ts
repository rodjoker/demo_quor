import type {
  Channel,
  Customer,
  Order,
  OrderStatus,
  Product,
  StockMovement,
  UnmetDemand,
} from '../types'

/** Error de negocio con un mensaje que se puede mostrar tal cual a la persona. */
export class StoreError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

export interface PlaceOrderInput {
  customerId: string
  items: { productId: string; quantity: number }[]
  channel: Channel
  /** 'partial': lleva lo disponible y registra lo pendiente. 'reject': si falta stock, aborta todo. */
  onShortage: 'partial' | 'reject'
}

export interface PlaceOrderResult {
  order: Order
  lines: { productId: string; requested: number; confirmed: number; missing: number }[]
}

/**
 * Lo único que las pantallas conocen. Hay dos implementaciones:
 *  - modo demo: datos en memoria (lib/mock)
 *  - modo real: Supabase con Realtime (lib/data/supabase-provider.tsx)
 */
export interface StoreValue {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  /** Vuelve a cargar todo (botón "Reintentar"). */
  reload: () => void
  /** ¿Los cambios de otros usuarios llegan solos? */
  live: boolean

  products: Product[]
  productById: ReadonlyMap<string, Product>
  customers: Customer[]
  customerById: ReadonlyMap<string, Customer>
  stock: Record<string, number>
  orders: Order[]
  unmet: UnmetDemand[]
  movements: StockMovement[]

  placeOrder: (input: PlaceOrderInput) => Promise<PlaceOrderResult>
  setOrderStatus: (orderId: string, to: OrderStatus, reason?: string) => Promise<void>
  adjustStock: (productId: string, newQuantity: number, note?: string) => Promise<void>
}
