'use client'

import Image from 'next/image'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { LOW_STOCK } from '@/lib/mock/seed'
import type { OrderStatus, Product } from '@/lib/types'

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

// Botones: negros y de esquina corta (5px), como en la tienda de Quor.
const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-[5px] px-4 text-sm font-semibold transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40 min-h-11'

export const btn = {
  primary: `${btnBase} bg-ink text-white hover:bg-[#2a2a2a]`,
  secondary: `${btnBase} border border-line bg-surface text-ink hover:bg-canvas`,
  ghost: `${btnBase} text-muted hover:bg-black/5 hover:text-ink`,
  danger: `${btnBase} border border-bad/30 bg-surface text-bad hover:bg-bad/5`,
}

export const inputCls =
  'min-h-11 w-full rounded-[5px] border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-pink'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-lg border border-line bg-surface', className)}>{children}</section>
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const STATUS_STYLE: Record<OrderStatus, { label: string; cls: string }> = {
  recibido: { label: 'Recibido', cls: 'bg-[#e3f4fb] text-[#17627f]' },
  en_revision: { label: 'En revisión', cls: 'bg-[#f0e8fa] text-[#5d3592]' },
  aprobado: { label: 'Aprobado', cls: 'bg-[#e2f4ea] text-[#17704d]' },
  preparando: { label: 'Preparando', cls: 'bg-[#fff1d1] text-[#7c5200]' },
  despachado: { label: 'Despachado', cls: 'bg-ink text-white' },
  cancelado: { label: 'Cancelado', cls: 'bg-[#fde4ec] text-[#b01446]' },
}

export const STATUS_LABEL = Object.fromEntries(
  Object.entries(STATUS_STYLE).map(([k, v]) => [k, v.label]),
) as Record<OrderStatus, string>

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', s.cls)}>
      {s.label}
    </span>
  )
}

export type StockLevel = 'ok' | 'low' | 'out'
export const stockLevel = (qty: number): StockLevel => (qty <= 0 ? 'out' : qty < LOW_STOCK ? 'low' : 'ok')

/** Semáforo de disponibilidad: color + texto (nunca solo color). */
export function StockBadge({ qty, compact }: { qty: number; compact?: boolean }) {
  const level = stockLevel(qty)
  const map = {
    ok: { dot: 'bg-ok', text: 'text-ok', label: compact ? `${qty}` : `Disponible · ${qty}` },
    low: { dot: 'bg-warn', text: 'text-warn', label: compact ? `${qty}` : `Quedan ${qty}` },
    out: { dot: 'bg-bad', text: 'text-bad', label: 'Agotado' },
  }[level]
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium tnum', map.text)}>
      <span className={cx('size-2 rounded-full', map.dot)} aria-hidden />
      {map.label}
    </span>
  )
}

export function ProductThumb({ product, size = 44 }: { product: Product; size?: number }) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-md border border-line bg-canvas"
      style={{ width: size, height: size }}
    >
      {product.image ? (
        <Image src={product.image} alt="" width={size * 2} height={size * 2} className="size-full object-cover" />
      ) : null}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  )
}

/** Hoja inferior en móvil, diálogo centrado en escritorio. Cierra con Esc o tocando fuera. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[88dvh] w-full flex-col rounded-t-2xl bg-surface shadow-xl outline-none sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h2>
          <button onClick={onClose} className={cx(btn.ghost, 'size-11 !p-0')} aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function Toast({ message, kind = 'ok' }: { message: string; kind?: 'ok' | 'error' }) {
  return (
    <div
      role="status"
      className={cx(
        'fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg lg:bottom-6',
        kind === 'ok' ? 'bg-ink' : 'bg-bad',
      )}
    >
      {message}
    </div>
  )
}
