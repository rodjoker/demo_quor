'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronRight, Plus, Search } from 'lucide-react'
import { Card, EmptyState, OrderStatusBadge, PageHeader, STATUS_LABEL, btn, cx, inputCls } from '@/components/ui'
import { formatCOP, formatDateTime, formatOrderNumber } from '@/lib/format'
import { CUSTOMER_BY_ID } from '@/lib/mock/seed'
import { useStore } from '@/lib/mock/store'
import { can } from '@/lib/roles'
import type { OrderStatus, Role } from '@/lib/types'

const STATUSES: OrderStatus[] = ['recibido', 'en_revision', 'aprobado', 'preparando', 'despachado', 'cancelado']

export default function OrdersList({ role, ownCustomerId }: { role: Role; ownCustomerId: string }) {
  const { orders } = useStore()
  const router = useRouter()
  const [status, setStatus] = useState<OrderStatus | 'todos'>('todos')
  const [query, setQuery] = useState('')

  const mine = can.seeAllOrders(role) ? orders : orders.filter(o => o.customerId === ownCustomerId)
  const q = query.trim().toLowerCase()
  const shown = mine.filter(o => {
    if (status !== 'todos' && o.status !== status) return false
    if (!q) return true
    const c = CUSTOMER_BY_ID.get(o.customerId)
    return formatOrderNumber(o.number).toLowerCase().includes(q) || (c?.name.toLowerCase().includes(q) ?? false)
  })
  const count = (s: OrderStatus) => mine.filter(o => o.status === s).length

  return (
    <>
      <PageHeader
        title={can.seeAllOrders(role) ? 'Pedidos' : 'Mis pedidos'}
        subtitle="Se actualizan solos cuando entra un pedido nuevo o cambia su estado."
        actions={
          can.orderForOthers(role) || role === 'cliente' ? (
            <Link href="/nuevo-pedido" className={btn.primary}>
              <Plus className="size-4" aria-hidden /> Nuevo pedido
            </Link>
          ) : undefined
        }
      />

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por número o cliente"
          aria-label="Buscar pedido"
          className={cx(inputCls, 'pl-9 sm:max-w-sm')}
        />
      </div>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Estado">
        <Chip active={status === 'todos'} onClick={() => setStatus('todos')} label="Todos" n={mine.length} />
        {STATUSES.map(s => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)} label={STATUS_LABEL[s]} n={count(s)} />
        ))}
      </div>

      <Card>
        {shown.length === 0 ? (
          <EmptyState title="No hay pedidos con este filtro" hint="Cambia el estado o la búsqueda." />
        ) : (
          <>
            {/* Escritorio: tabla */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium text-muted">
                  <th className="px-4 py-3 font-medium">Pedido</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Canal</th>
                  <th className="px-4 py-3 text-right font-medium">Uds.</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Recibido</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map(o => {
                  const c = CUSTOMER_BY_ID.get(o.customerId)
                  const units = o.items.reduce((s, i) => s + i.confirmed, 0)
                  const short = o.items.some(i => i.requested > i.confirmed)
                  return (
                    <tr key={o.id} onClick={() => router.push(`/pedidos/${o.id}`)} className="cursor-pointer hover:bg-canvas">
                      <td className="px-4 py-3 font-medium text-ink tnum">
                        <Link href={`/pedidos/${o.id}`} className="focus-visible:underline" onClick={e => e.stopPropagation()}>
                          {formatOrderNumber(o.number)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block text-ink">{c?.name}</span>
                        <span className="text-xs text-muted">{c?.city}</span>
                      </td>
                      <td className="px-4 py-3 text-muted">{o.channel === 'web' ? 'Web' : 'App'}</td>
                      <td className="px-4 py-3 text-right tnum">
                        {units}
                        {short && <span className="ml-1 text-xs font-semibold text-bad">*</span>}
                      </td>
                      <td className="px-4 py-3 text-right tnum">{formatCOP(o.total)}</td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-3 text-muted tnum">{formatDateTime(o.createdAt)}</td>
                      <td className="pr-3 text-muted">
                        <ChevronRight className="size-4" aria-hidden />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Móvil: tarjetas */}
            <ul className="divide-y divide-line md:hidden">
              {shown.map(o => {
                const c = CUSTOMER_BY_ID.get(o.customerId)
                const units = o.items.reduce((s, i) => s + i.confirmed, 0)
                const short = o.items.some(i => i.requested > i.confirmed)
                return (
                  <li key={o.id}>
                    <Link href={`/pedidos/${o.id}`} className="block p-4 active:bg-canvas">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-ink tnum">{formatOrderNumber(o.number)}</p>
                          <p className="truncate text-sm text-ink">{c?.name}</p>
                        </div>
                        <OrderStatusBadge status={o.status} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted tnum">
                        <span>
                          {formatDateTime(o.createdAt)} · {o.channel === 'web' ? 'Web' : 'App'}
                        </span>
                        <span className="font-medium text-ink">
                          {units} uds. · {formatCOP(o.total)}
                          {short && <span className="ml-1 text-bad">*</span>}
                        </span>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">
        <span className="font-semibold text-bad">*</span> El pedido tiene unidades pendientes por falta de stock.
      </p>
    </>
  )
}

function Chip({ active, onClick, label, n }: { active: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        'min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors',
        active ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink hover:bg-canvas',
      )}
    >
      {label} <span className={cx('ml-1 tnum', active ? 'text-white/70' : 'text-muted')}>{n}</span>
    </button>
  )
}
