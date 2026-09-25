'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CircleCheck, Minus, Plus, Search, ShoppingCart, TriangleAlert } from 'lucide-react'
import { Card, EmptyState, Modal, PageHeader, ProductThumb, StockBadge, Toast, btn, cx, inputCls } from '@/components/ui'
import { CATEGORY_LABEL, categoryLabel, formatCOP, formatOrderNumber } from '@/lib/format'
import { CUSTOMERS, CUSTOMER_BY_ID, PRODUCTS, PRODUCT_BY_ID } from '@/lib/mock/seed'
import { StoreError, placeOrder, useStore, type PlaceOrderResult } from '@/lib/mock/store'
import { can } from '@/lib/roles'
import type { Product, Role } from '@/lib/types'

const CATEGORIES = Object.keys(CATEGORY_LABEL).filter(c => PRODUCTS.some(p => p.category === c))

export default function NewOrder({
  role,
  userName,
  ownCustomerId,
}: {
  role: Role
  userName: string
  ownCustomerId: string
}) {
  const { stock } = useStore()
  const forOthers = can.orderForOthers(role)

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('todas')
  const [qty, setQty] = useState<Record<string, number>>({})
  const [customerId, setCustomerId] = useState(forOthers ? CUSTOMERS[0].id : ownCustomerId)
  const [cartOpen, setCartOpen] = useState(false)
  const [shortageOpen, setShortageOpen] = useState(false)
  const [result, setResult] = useState<PlaceOrderResult | null>(null)
  const [toast, setToast] = useState<{ message: string; kind: 'ok' | 'error' } | null>(null)

  const availOf = (id: string) => stock[id] ?? 0

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PRODUCTS.filter(
      p =>
        (category === 'todas' || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
    )
  }, [query, category])

  const lines = Object.entries(qty)
    .filter(([, n]) => n > 0)
    .map(([id, requested]) => {
      const product = PRODUCT_BY_ID.get(id)!
      const available = availOf(id)
      const confirmed = Math.min(requested, available)
      return { product, requested, confirmed, missing: requested - confirmed }
    })

  const totalUnits = lines.reduce((s, l) => s + l.requested, 0)
  const total = lines.reduce((s, l) => s + l.confirmed * l.product.price, 0)
  const shortages = lines.filter(l => l.missing > 0)
  const nothingAvailable = lines.length > 0 && lines.every(l => l.confirmed === 0)

  const setLine = (id: string, n: number) =>
    setQty(prev => {
      const next = { ...prev }
      if (!Number.isFinite(n) || n <= 0) delete next[id]
      else next[id] = Math.min(Math.floor(n), 100000)
      return next
    })

  /** Alternativa del mismo tipo: misma categoría, sin mezclar productos "de servicio" (coats, primers)
   *  con colores, y la más cercana en precio. Es una regla simple, no IA. */
  const similarTo = (product: Product): Product | null => {
    const utility = (n: string) => /COAT|PRIMER|BASE|CLEANER|REMOVER|LIMA|M[AÁ]QUINA/i.test(n)
    let best: Product | null = null
    for (const p of PRODUCTS) {
      if (p.id === product.id || p.category !== product.category || availOf(p.id) < 1) continue
      if (utility(p.name) !== utility(product.name)) continue
      if (!best || Math.abs(p.price - product.price) < Math.abs(best.price - product.price)) best = p
    }
    return best
  }

  const submit = (onShortage: 'partial' | 'reject') => {
    try {
      const res = placeOrder({
        customerId,
        channel: forOthers ? 'app' : 'web',
        onShortage,
        by: userName,
        items: lines.map(l => ({ productId: l.product.id, quantity: l.requested })),
      })
      setResult(res)
      setQty({})
      setShortageOpen(false)
      setCartOpen(false)
    } catch (e) {
      setShortageOpen(false)
      setToast({
        message: e instanceof StoreError ? e.message : 'No se pudo enviar el pedido.',
        kind: 'error',
      })
      setTimeout(() => setToast(null), 4000)
    }
  }

  const confirm = () => (shortages.length > 0 ? setShortageOpen(true) : submit('reject'))

  if (result) return <OrderSent result={result} onNew={() => setResult(null)} />

  const cart = (
    <CartPanel
      lines={lines}
      total={total}
      totalUnits={totalUnits}
      forOthers={forOthers}
      customerId={customerId}
      onCustomer={setCustomerId}
      onRemove={id => setLine(id, 0)}
      onConfirm={confirm}
    />
  )

  return (
    <>
      <PageHeader
        title="Nuevo pedido"
        subtitle="La disponibilidad se actualiza en vivo y el stock se descuenta al confirmar."
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-ok" />
            </span>
            Stock en vivo
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por nombre o SKU"
              aria-label="Buscar producto"
              className={cx(inputCls, 'pl-9')}
            />
          </div>

          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Categorías">
            {['todas', ...CATEGORIES].map(c => (
              <button
                key={c}
                role="tab"
                aria-selected={category === c}
                onClick={() => setCategory(c)}
                className={cx(
                  'min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors',
                  category === c ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink hover:bg-canvas',
                )}
              >
                {c === 'todas' ? 'Todas' : categoryLabel(c)}
              </button>
            ))}
          </div>

          <Card>
            {visible.length === 0 ? (
              <EmptyState title="Sin resultados" hint="Prueba con otro nombre, SKU o categoría." />
            ) : (
              <ul className="divide-y divide-line">
                {visible.map(p => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    available={availOf(p.id)}
                    value={qty[p.id] ?? 0}
                    onChange={n => setLine(p.id, n)}
                    similar={similarTo(p)}
                    similarAvailable={id => availOf(id)}
                    onUseSimilar={(sim, n) => setLine(sim.id, (qty[sim.id] ?? 0) + n)}
                  />
                ))}
              </ul>
            )}
          </Card>
          <div className="h-16 lg:hidden" aria-hidden />
        </div>

        {/* Carrito: columna fija en escritorio */}
        <aside className="hidden lg:block">
          <div className="sticky top-8">{cart}</div>
        </aside>
      </div>

      {/* Carrito: barra + hoja inferior en móvil */}
      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-line bg-surface p-3 lg:hidden">
          <button onClick={() => setCartOpen(true)} className={cx(btn.primary, 'w-full justify-between')}>
            <span className="inline-flex items-center gap-2">
              <ShoppingCart className="size-4" aria-hidden /> Ver pedido · {totalUnits} u.
            </span>
            <span className="tnum">{formatCOP(total)}</span>
          </button>
        </div>
      )}
      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title="Tu pedido">
        {cart}
      </Modal>

      <Modal
        open={shortageOpen}
        onClose={() => setShortageOpen(false)}
        title="No alcanza el stock para todo"
        footer={
          <>
            <button className={btn.secondary} onClick={() => setShortageOpen(false)}>
              Ajustar cantidades
            </button>
            <button className={btn.primary} onClick={() => submit('partial')}>
              {nothingAvailable ? 'Registrar como pendiente' : 'Confirmar con lo disponible'}
            </button>
          </>
        }
      >
        <p className="mb-4 text-sm text-muted">
          {nothingAvailable
            ? 'Ninguno de estos productos tiene unidades hoy. Puedes dejar la solicitud registrada y te avisamos cuando haya stock.'
            : 'Enviaremos a bodega lo que hay hoy y dejaremos el resto pendiente. Esa demanda queda registrada.'}
        </p>
        <ul className="space-y-3">
          {shortages.map(l => (
            <li key={l.product.id} className="rounded-md border border-line p-3">
              <p className="text-sm font-medium text-ink">{l.product.name}</p>
              <p className="mt-1 text-sm text-muted tnum">
                Pediste {l.requested} · <span className="font-semibold text-ink">llevas {l.confirmed}</span> ·{' '}
                <span className="font-semibold text-bad">{l.missing} pendientes</span>
              </p>
            </li>
          ))}
        </ul>
      </Modal>

      {toast && <Toast message={toast.message} kind={toast.kind} />}
    </>
  )
}

function ProductRow({
  product,
  available,
  value,
  onChange,
  similar,
  similarAvailable,
  onUseSimilar,
}: {
  product: Product
  available: number
  value: number
  onChange: (n: number) => void
  similar: Product | null
  similarAvailable: (id: string) => number
  onUseSimilar: (p: Product, n: number) => void
}) {
  const missing = Math.max(0, value - available)
  const soldOut = available <= 0

  return (
    <li className="p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 sm:flex-nowrap">
        <ProductThumb product={product} size={48} />
        <div className="min-w-0 flex-1 basis-[calc(100%-4rem)] sm:basis-auto">
          <p className="text-sm font-medium leading-snug text-ink">{product.name}</p>
          <p className="mt-0.5 text-xs text-muted tnum">
            {product.sku} · {formatCOP(product.price)}
          </p>
        </div>
        <div className="hidden w-36 shrink-0 text-right sm:block">
          <StockBadge qty={available} />
        </div>
        <div className="flex w-full items-center justify-between gap-3 pl-[3.75rem] sm:w-auto sm:pl-0">
          <div className="sm:hidden">
            <StockBadge qty={available} />
          </div>
          <div className="ml-auto inline-flex items-center rounded-[5px] border border-line">
            <button
              onClick={() => onChange(value - 1)}
              disabled={value <= 0}
              aria-label={`Quitar una unidad de ${product.name}`}
              className="flex size-11 items-center justify-center text-ink hover:bg-canvas disabled:opacity-30"
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <input
              inputMode="numeric"
              value={value === 0 ? '' : String(value)}
              placeholder="0"
              aria-label={`Cantidad de ${product.name}`}
              onChange={e => onChange(parseInt(e.target.value.replace(/\D/g, ''), 10))}
              className="h-11 w-16 border-x border-line bg-surface text-center text-sm font-medium tnum outline-none focus-visible:bg-pink-soft/40"
            />
            <button
              onClick={() => onChange(value + 1)}
              aria-label={`Agregar una unidad de ${product.name}`}
              className="flex size-11 items-center justify-center text-ink hover:bg-canvas"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {missing > 0 && (
        <div role="status" className="mt-3 rounded-md bg-bad/5 p-3 text-sm sm:ml-[3.75rem]">
          <p className="flex items-start gap-2 font-medium text-bad">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {soldOut ? 'Sin stock hoy.' : `Solo quedan ${available}.`} Pides {value}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {!soldOut && (
              <button className={cx(btn.secondary, '!min-h-10 !text-xs')} onClick={() => onChange(available)}>
                Llevar {available}
              </button>
            )}
            {similar && (
              <button
                className={cx(btn.secondary, '!min-h-10 !text-xs')}
                onClick={() => onUseSimilar(similar, Math.min(missing, similarAvailable(similar.id)))}
              >
                Completar con similar: {similar.name.length > 34 ? similar.name.slice(0, 34) + '…' : similar.name} (
                {similarAvailable(similar.id)} disp.)
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">O déjalo así: enviaremos lo disponible y {missing} quedarán pendientes.</p>
        </div>
      )}
    </li>
  )
}

function CartPanel({
  lines,
  total,
  totalUnits,
  forOthers,
  customerId,
  onCustomer,
  onRemove,
  onConfirm,
}: {
  lines: { product: Product; requested: number; confirmed: number; missing: number }[]
  total: number
  totalUnits: number
  forOthers: boolean
  customerId: string
  onCustomer: (id: string) => void
  onRemove: (id: string) => void
  onConfirm: () => void
}) {
  const customer = CUSTOMER_BY_ID.get(customerId)!
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink">Resumen del pedido</h2>

      <div className="mb-4">
        <label htmlFor="customer" className="mb-1.5 block text-xs font-medium text-muted">
          Cliente
        </label>
        {forOthers ? (
          <select id="customer" value={customerId} onChange={e => onCustomer(e.target.value)} className={inputCls}>
            {CUSTOMERS.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.city}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-ink">{customer.name}</p>
        )}
        <p className="mt-1 text-xs text-muted">
          {customer.document} · {customer.type === 'mayorista' ? 'Mayorista' : 'Detal'}
        </p>
      </div>

      {lines.length === 0 ? (
        <p className="rounded-md bg-canvas px-3 py-6 text-center text-sm text-muted">
          Agrega productos para armar el pedido.
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {lines.map(l => (
            <li key={l.product.id} className="py-2.5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-snug text-ink">{l.product.name}</p>
                <button
                  onClick={() => onRemove(l.product.id)}
                  className="shrink-0 text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
                >
                  Quitar
                </button>
              </div>
              <p className="mt-1 text-xs text-muted tnum">
                {l.confirmed} × {formatCOP(l.product.price)}
                {l.missing > 0 && <span className="font-semibold text-bad"> · {l.missing} pendientes</span>}
              </p>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between text-muted">
          <dt>Unidades pedidas</dt>
          <dd className="tnum">{totalUnits}</dd>
        </div>
        <div className="flex justify-between text-base font-semibold text-ink">
          <dt>Total a pagar hoy</dt>
          <dd className="tnum">{formatCOP(total)}</dd>
        </div>
      </dl>

      <button onClick={onConfirm} disabled={lines.length === 0} className={cx(btn.primary, 'mt-4 w-full')}>
        Confirmar pedido
      </button>
      <p className="mt-2 text-center text-xs text-muted">Se envía a bodega al instante.</p>
    </Card>
  )
}

function OrderSent({ result, onNew }: { result: PlaceOrderResult; onNew: () => void }) {
  const { order, lines } = result
  const cancelled = order.status === 'cancelado'
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="p-6 sm:p-8">
        <div className="mb-5 flex items-start gap-3">
          {cancelled ? (
            <TriangleAlert className="mt-0.5 size-6 shrink-0 text-warn" aria-hidden />
          ) : (
            <CircleCheck className="mt-0.5 size-6 shrink-0 text-ok" aria-hidden />
          )}
          <div>
            <h1 className="text-xl font-semibold text-ink">
              {cancelled ? 'Sin stock: quedó registrado como pendiente' : `Pedido ${formatOrderNumber(order.number)} enviado a bodega`}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {cancelled
                ? 'No había unidades disponibles. No se descontó nada del inventario y la demanda quedó registrada.'
                : 'El inventario ya se descontó y bodega lo ve en su cola.'}
            </p>
          </div>
        </div>

        <ul className="divide-y divide-line rounded-md border border-line">
          {lines.map(l => (
            <li key={l.productId} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1 text-ink">{PRODUCT_BY_ID.get(l.productId)!.name}</span>
              <span className="shrink-0 text-right tnum text-muted">
                {l.confirmed} de {l.requested}
                {l.missing > 0 && <span className="block font-semibold text-bad">{l.missing} pendientes</span>}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-between text-base font-semibold text-ink">
          <span>Total</span>
          <span className="tnum">{formatCOP(order.total)}</span>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button className={btn.primary} onClick={onNew}>
            Hacer otro pedido
          </button>
          <Link href={`/pedidos/${order.id}`} className={btn.secondary}>
            Ver el pedido
          </Link>
        </div>
      </Card>
    </div>
  )
}
