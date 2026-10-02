'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PackageCheck, Truck } from 'lucide-react'
import { Card, EmptyState, PageHeader, Toast, btn, cx } from '@/components/ui'
import { formatDateTime, formatOrderNumber } from '@/lib/format'
import { useStore } from '@/lib/data/context'
import { StoreError } from '@/lib/data/types'
import type { Order } from '@/lib/types'

export default function WarehouseQueue() {
  const { orders, setOrderStatus } = useStore()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<{ message: string; kind: 'ok' | 'error' } | null>(null)

  const flash = (message: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ message, kind })
    setTimeout(() => setToast(null), 3500)
  }

  // Más antiguos primero: se despacha en orden de llegada
  const oldestFirst = (a: Order, b: Order) => a.createdAt.localeCompare(b.createdAt)
  const preparing = orders.filter(o => o.status === 'preparando').sort(oldestFirst)
  const dispatched = orders.filter(o => o.status === 'despachado')

  const move = async (o: Order, to: 'despachado') => {
    if (busyId) return // una acción a la vez
    setBusyId(o.id)
    try {
      await setOrderStatus(o.id, to)
      flash(`${formatOrderNumber(o.number)} despachado.`)
    } catch (e) {
      flash(e instanceof StoreError ? e.message : 'No se pudo actualizar.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const lineKey = (o: Order, productId: string) => `${o.id}:${productId}`
  const lines = (o: Order) => o.items.filter(i => i.confirmed > 0)
  const allPicked = (o: Order) => lines(o).every(i => picked[lineKey(o, i.productId)])

  return (
    <>
      <PageHeader
        title="Bodega"
        subtitle="Pedidos que el vendedor envió a preparar, en orden de llegada. Alístalos y márcalos como despachados."
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink tnum">
            <Truck className="size-3.5" aria-hidden /> {dispatched.length} despachados
          </span>
        }
      />

      <div className="max-w-2xl">
        <section aria-labelledby="col-preparing">
          <h2 id="col-preparing" className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <PackageCheck className="size-4 text-muted" aria-hidden /> Por alistar y despachar
            <span className="rounded-full bg-[#fff1d1] px-2 py-0.5 text-xs tnum">{preparing.length}</span>
          </h2>
          <div className="space-y-4">
            {preparing.length === 0 && (
              <Card>
                <EmptyState title="No hay pedidos para despachar" hint="Cuando el vendedor envíe uno a preparar aparece aquí solo." />
              </Card>
            )}
            {preparing.map(o => (
              <OrderCard
                key={o.id}
                order={o}
                pick={{
                  isPicked: pid => !!picked[lineKey(o, pid)],
                  toggle: pid => setPicked(p => ({ ...p, [lineKey(o, pid)]: !p[lineKey(o, pid)] })),
                }}
              >
                <button
                  className={cx(btn.primary, 'w-full')}
                  disabled={!allPicked(o) || busyId === o.id}
                  onClick={() => void move(o, 'despachado')}
                >
                  <Truck className="size-4" aria-hidden />
                  {allPicked(o) ? 'Marcar despachado' : 'Marca cada producto para despachar'}
                </button>
              </OrderCard>
            ))}
          </div>
        </section>
      </div>

      {toast && <Toast message={toast.message} kind={toast.kind} />}
    </>
  )
}

function OrderCard({
  order,
  children,
  pick,
}: {
  order: Order
  children: React.ReactNode
  pick?: { isPicked: (productId: string) => boolean; toggle: (productId: string) => void }
}) {
  const { customerById, productById } = useStore()
  const c = customerById.get(order.customerId) ?? { name: 'Cliente', city: '' }
  const items = order.items.filter(i => i.confirmed > 0)
  const units = items.reduce((s, i) => s + i.confirmed, 0)

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 border-b border-line p-4">
        <div className="min-w-0">
          <Link href={`/pedidos/${order.id}`} className="font-semibold text-ink tnum hover:underline">
            {formatOrderNumber(order.number)}
          </Link>
          <p className="truncate text-sm text-ink">{c.name}</p>
          <p className="text-xs text-muted">
            {c.city} · {formatDateTime(order.createdAt)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink tnum">{units} uds.</span>
      </div>

      <ul className="divide-y divide-line">
        {items.map(it => {
          const p = productById.get(it.productId) ?? { name: 'Producto no disponible', sku: '—' }
          const checked = pick?.isPicked(it.productId) ?? false
          const inner = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-snug text-ink">{p.name}</span>
                <span className="text-xs text-muted tnum">{p.sku}</span>
              </span>
              <span className="shrink-0 text-base font-semibold text-ink tnum">× {it.confirmed}</span>
            </>
          )
          return (
            <li key={it.productId}>
              {pick ? (
                <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-canvas">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => pick.toggle(it.productId)}
                    className="size-5 shrink-0 accent-ink"
                  />
                  <span className={cx('flex flex-1 items-center gap-3', checked && 'opacity-50')}>{inner}</span>
                </label>
              ) : (
                <div className="flex items-center gap-3 px-4 py-2.5">{inner}</div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="p-4">{children}</div>
    </Card>
  )
}
