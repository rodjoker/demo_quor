'use client'

import { useMemo, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import {
  Card,
  EmptyState,
  Modal,
  PageHeader,
  ProductThumb,
  StockBadge,
  Toast,
  btn,
  cx,
  inputCls,
  stockLevel,
  type StockLevel,
} from '@/components/ui'
import { CATEGORY_LABEL, categoryLabel, formatCOP, formatDateTime } from '@/lib/format'
import { PRODUCTS } from '@/lib/mock/seed'
import { StoreError, adjustStock, useStore } from '@/lib/mock/store'
import { can } from '@/lib/roles'
import type { Product, Role } from '@/lib/types'

const CATEGORIES = Object.keys(CATEGORY_LABEL).filter(c => PRODUCTS.some(p => p.category === c))
const REASON_LABEL: Record<string, string> = {
  sale: 'Venta',
  cancel_restock: 'Cancelación',
  manual_adjust: 'Ajuste manual',
  sync: 'Sincronización',
}

export default function StockTable({ role, userName }: { role: Role; userName: string }) {
  const { stock, movements } = useStore()
  const canEdit = can.editStock(role)

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('todas')
  const [level, setLevel] = useState<StockLevel | 'todos'>('todos')
  const [editing, setEditing] = useState<Product | null>(null)
  const [newQty, setNewQty] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const qtyOf = (id: string) => stock[id] ?? 0
  const counts = useMemo(() => {
    const c = { ok: 0, low: 0, out: 0 }
    for (const p of PRODUCTS) c[stockLevel(stock[p.id] ?? 0)]++
    return c
  }, [stock])

  const shown = PRODUCTS.filter(p => {
    const q = query.trim().toLowerCase()
    if (category !== 'todas' && p.category !== category) return false
    if (level !== 'todos' && stockLevel(qtyOf(p.id)) !== level) return false
    return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
  })

  const openEdit = (p: Product) => {
    setEditing(p)
    setNewQty(String(qtyOf(p.id)))
    setNote('')
    setFormError(null)
  }

  const save = () => {
    if (!editing) return
    try {
      adjustStock(editing.id, Number(newQty), role, userName, note.trim() || undefined)
      setEditing(null)
      setToast('Stock actualizado. Los formularios ya lo ven.')
      setTimeout(() => setToast(null), 3500)
    } catch (e) {
      setFormError(e instanceof StoreError ? e.message : 'No se pudo guardar.')
    }
  }

  const recent = editing ? movements.filter(m => m.productId === editing.id).slice(0, 5) : []

  return (
    <>
      <PageHeader
        title="Inventario"
        subtitle={canEdit ? 'Edita el stock y se refleja al instante en los pedidos.' : 'Consulta de stock en solo lectura.'}
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink">
            <RefreshCw className="size-3.5 text-ok" aria-hidden /> Matrix (simulada): sincronizada
          </span>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Summary label="Disponibles" n={counts.ok} tone="text-ok" active={level === 'ok'} onClick={() => setLevel(level === 'ok' ? 'todos' : 'ok')} />
        <Summary label="Stock bajo" n={counts.low} tone="text-warn" active={level === 'low'} onClick={() => setLevel(level === 'low' ? 'todos' : 'low')} />
        <Summary label="Agotados" n={counts.out} tone="text-bad" active={level === 'out'} onClick={() => setLevel(level === 'out' ? 'todos' : 'out')} />
      </div>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
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
        <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Categoría" className={cx(inputCls, 'sm:w-56')}>
          <option value="todas">Todas las categorías</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </div>

      <Card>
        {shown.length === 0 ? (
          <EmptyState title="Sin productos con este filtro" />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map(p => (
              <li key={p.id} className="flex items-center gap-3 p-3 sm:p-4">
                <ProductThumb product={p} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug text-ink">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted tnum">
                    {p.sku} · {categoryLabel(p.category)} · {formatCOP(p.price)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <StockBadge qty={qtyOf(p.id)} />
                </div>
                {canEdit && (
                  <button className={cx(btn.secondary, '!min-h-10 shrink-0 !px-3 !text-xs')} onClick={() => openEdit(p)}>
                    Ajustar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Ajustar stock"
        footer={
          <>
            <button className={btn.secondary} onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button className={btn.primary} onClick={save}>
              Guardar
            </button>
          </>
        }
      >
        {editing && (
          <>
            <div className="mb-4 flex items-center gap-3">
              <ProductThumb product={editing} size={48} />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug text-ink">{editing.name}</p>
                <p className="text-xs text-muted tnum">
                  {editing.sku} · hoy hay {qtyOf(editing.id)}
                </p>
              </div>
            </div>

            <label htmlFor="newqty" className="mb-1.5 block text-xs font-medium text-muted">
              Nueva cantidad
            </label>
            <input
              id="newqty"
              inputMode="numeric"
              value={newQty}
              onChange={e => setNewQty(e.target.value.replace(/\D/g, ''))}
              className={cx(inputCls, 'tnum')}
            />
            <label htmlFor="note" className="mb-1.5 mt-4 block text-xs font-medium text-muted">
              Motivo (opcional)
            </label>
            <input
              id="note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ej. llegó mercancía del proveedor"
              maxLength={120}
              className={inputCls}
            />
            {formError && (
              <p role="alert" className="mt-3 text-sm text-bad">
                {formError}
              </p>
            )}

            <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-muted">Últimos movimientos</h3>
            {recent.length === 0 ? (
              <p className="text-sm text-muted">Sin movimientos todavía.</p>
            ) : (
              <ul className="divide-y divide-line rounded-md border border-line">
                {recent.map(m => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block text-ink">{REASON_LABEL[m.reason]}</span>
                      <span className="block truncate text-xs text-muted tnum">
                        {formatDateTime(m.at)} · {m.by}
                        {m.note ? ` · ${m.note}` : ''}
                      </span>
                    </span>
                    <span className={cx('shrink-0 font-semibold tnum', m.delta < 0 ? 'text-bad' : 'text-ok')}>
                      {m.delta > 0 ? '+' : ''}
                      {m.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Modal>

      {toast && <Toast message={toast} />}
    </>
  )
}

function Summary({
  label,
  n,
  tone,
  active,
  onClick,
}: {
  label: string
  n: number
  tone: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'rounded-lg border bg-surface p-3 text-left transition-colors sm:p-4',
        active ? 'border-ink' : 'border-line hover:bg-canvas',
      )}
    >
      <span className={cx('block text-2xl font-semibold tnum', tone)}>{n}</span>
      <span className="text-xs text-muted">{label}</span>
    </button>
  )
}
