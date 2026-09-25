'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { Card, Modal, OrderStatusBadge, ProductThumb, Toast, btn, cx, inputCls } from '@/components/ui'
import { formatCOP, formatDateTime, formatOrderNumber } from '@/lib/format'
import { CUSTOMER_BY_ID, PRODUCT_BY_ID } from '@/lib/mock/seed'
import { StoreError, nextStatuses, setOrderStatus, useStore } from '@/lib/mock/store'
import { can } from '@/lib/roles'
import type { OrderStatus, Role } from '@/lib/types'

const ACTION: Record<OrderStatus, { label: string; primary?: boolean }> = {
  recibido: { label: 'Recibido' },
  en_revision: { label: 'Pasar a revisión' },
  aprobado: { label: 'Aprobar pedido', primary: true },
  preparando: { label: 'Enviar a preparar', primary: true },
  despachado: { label: 'Marcar como despachado', primary: true },
  cancelado: { label: 'Cancelar pedido' },
}

export default function OrderDetail({
  id,
  role,
  userName,
  ownCustomerId,
}: {
  id: string
  role: Role
  userName: string
  ownCustomerId: string
}) {
  const { orders } = useStore()
  const order = orders.find(o => o.id === id)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [toast, setToast] = useState<{ message: string; kind: 'ok' | 'error' } | null>(null)

  const flash = (message: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ message, kind })
    setTimeout(() => setToast(null), 3500)
  }

  if (!order || (!can.seeAllOrders(role) && order.customerId !== ownCustomerId)) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium text-ink">No encontramos este pedido.</p>
        <Link href="/pedidos" className={cx(btn.secondary, 'mt-4')}>
          Volver a pedidos
        </Link>
      </div>
    )
  }

  const customer = CUSTOMER_BY_ID.get(order.customerId)!
  const number = formatOrderNumber(order.number)
  const pending = order.items.filter(i => i.requested > i.confirmed)

  // Qué botones ve cada rol (la base de datos vuelve a validarlo)
  const actions = nextStatuses(order.status).filter(s => {
    if (can.changeStatus(role)) return true
    return role === 'bodega' && (s === 'preparando' || s === 'despachado')
  })

  const change = (to: OrderStatus, why?: string) => {
    try {
      setOrderStatus(order.id, to, role, userName, why)
      flash(to === 'cancelado' ? 'Pedido cancelado. El stock volvió al inventario.' : `Pedido ${ACTION[to].label.toLowerCase()}.`)
    } catch (e) {
      flash(e instanceof StoreError ? e.message : 'No se pudo cambiar el estado.', 'error')
    }
  }

  const whatsapp = `https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
    `Hola ${customer.name}, te escribimos de Quor sobre tu pedido ${number}.`,
  )}`

  return (
    <>
      <Link href="/pedidos" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Pedidos
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-ink tnum sm:text-2xl">{number}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {formatDateTime(order.createdAt)} · {order.channel === 'web' ? 'Pedido web' : 'Pedido desde la app'}
          </p>
        </div>

        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions
              .filter(s => s !== 'cancelado')
              .map(s => (
                <button key={s} className={ACTION[s].primary ? btn.primary : btn.secondary} onClick={() => change(s)}>
                  {ACTION[s].label}
                </button>
              ))}
            {actions.includes('cancelado') && (
              <button className={btn.danger} onClick={() => setCancelOpen(true)}>
                Cancelar pedido
              </button>
            )}
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <p role="status" className="mb-4 rounded-md bg-bad/5 px-4 py-3 text-sm text-bad">
          Este pedido salió con {pending.reduce((s, i) => s + (i.requested - i.confirmed), 0)} unidades pendientes por falta de
          stock. Quedaron registradas como demanda no atendida.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Productos</h2>
            <ul className="divide-y divide-line">
              {order.items.map(it => {
                const p = PRODUCT_BY_ID.get(it.productId)!
                const missing = it.requested - it.confirmed
                return (
                  <li key={it.productId} className="flex items-center gap-3 p-4">
                    <ProductThumb product={p} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug text-ink">{p.name}</p>
                      <p className="mt-0.5 text-xs text-muted tnum">
                        {p.sku} · {formatCOP(it.unitPrice)} c/u
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-sm tnum">
                      <p className="font-medium text-ink">
                        {it.confirmed} <span className="font-normal text-muted">de {it.requested}</span>
                      </p>
                      {missing > 0 && <p className="text-xs font-semibold text-bad">{missing} pendientes</p>}
                      <p className="text-xs text-muted">{formatCOP(it.confirmed * it.unitPrice)}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="flex justify-between border-t border-line px-4 py-3 text-base font-semibold text-ink">
              <span>Total</span>
              <span className="tnum">{formatCOP(order.total)}</span>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {can.seeAllOrders(role) && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-ink">Cliente</h2>
              <p className="text-sm font-medium text-ink">{customer.name}</p>
              <p className="mt-0.5 text-sm text-muted">
                {customer.document} · {customer.type === 'mayorista' ? 'Mayorista' : 'Detal'}
              </p>
              <p className="mt-0.5 text-sm text-muted">{customer.city}</p>
              <p className="mt-0.5 text-sm text-muted tnum">{customer.phone}</p>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={cx(btn.secondary, 'mt-4 w-full')}>
                <MessageCircle className="size-4" aria-hidden /> Escribir por WhatsApp
              </a>
            </Card>
          )}

          <Card className="p-4">
            <h2 className="mb-4 text-sm font-semibold text-ink">Historial</h2>
            <ol className="relative space-y-4 border-l border-line pl-5">
              {order.events.map((ev, i) => (
                <li key={i} className="relative">
                  <span
                    className={cx(
                      'absolute -left-[1.6rem] top-1 size-2.5 rounded-full border-2 border-surface',
                      i === order.events.length - 1 ? 'bg-ink' : 'bg-line',
                    )}
                    aria-hidden
                  />
                  <OrderStatusBadge status={ev.to} />
                  <p className="mt-1 text-xs text-muted tnum">
                    {formatDateTime(ev.at)} · {ev.by}
                  </p>
                  {ev.reason && <p className="mt-0.5 text-xs text-muted">{ev.reason === 'sin_stock' ? 'Sin stock disponible' : ev.reason}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={`Cancelar ${number}`}
        footer={
          <>
            <button className={btn.secondary} onClick={() => setCancelOpen(false)}>
              Volver
            </button>
            <button
              className={btn.danger}
              onClick={() => {
                change('cancelado', reason.trim() || undefined)
                setCancelOpen(false)
                setReason('')
              }}
            >
              Sí, cancelar pedido
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Las {order.items.reduce((s, i) => s + i.confirmed, 0)} unidades reservadas volverán al inventario. Esta acción no se puede deshacer.
        </p>
        <label htmlFor="reason" className="mb-1.5 block text-xs font-medium text-muted">
          Motivo (opcional)
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          maxLength={200}
          className={cx(inputCls, 'py-2')}
        />
      </Modal>

      {toast && <Toast message={toast.message} kind={toast.kind} />}
    </>
  )
}
