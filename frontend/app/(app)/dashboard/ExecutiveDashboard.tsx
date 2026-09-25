'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { RefreshCw, TrendingDown } from 'lucide-react'
import { Card, PageHeader, StockBadge, cx } from '@/components/ui'
import { dayOf, formatCOP, formatDay } from '@/lib/format'
import { PRODUCTS, PRODUCT_BY_ID } from '@/lib/mock/seed'
import { useStore } from '@/lib/mock/store'

const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 })

// Los 7 días que terminan en la fecha del pedido más reciente
function lastDays(endKey: string, n: number): string[] {
  const [y, m, d] = endKey.split('-').map(Number)
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1, d - (n - 1 - i))).toISOString().slice(0, 10))
}

export default function ExecutiveDashboard() {
  const { orders, unmet, stock } = useStore()

  const m = useMemo(() => {
    const live = orders.filter(o => o.status !== 'cancelado')
    const endKey = orders.map(o => dayOf(o.createdAt)).sort().at(-1) ?? '2026-09-25'
    const days = lastDays(endKey, 7)
    const inWindow = live.filter(o => days.includes(dayOf(o.createdAt)))

    const revenue = inWindow.reduce((s, o) => s + o.total, 0)
    const perDay = days.map(d => ({
      day: d,
      total: inWindow.filter(o => dayOf(o.createdAt) === d).reduce((s, o) => s + o.total, 0),
      count: inWindow.filter(o => dayOf(o.createdAt) === d).length,
    }))

    const sold = new Map<string, number>()
    for (const o of inWindow) for (const it of o.items) sold.set(it.productId, (sold.get(it.productId) ?? 0) + it.confirmed)
    const top = [...sold.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

    const lost = new Map<string, { units: number; cop: number }>()
    for (const u of unmet) {
      if (!days.includes(dayOf(u.at))) continue
      const cur = lost.get(u.productId) ?? { units: 0, cop: 0 }
      lost.set(u.productId, { units: cur.units + u.missing, cop: cur.cop + u.missing * u.unitPrice })
    }
    const lostList = [...lost.entries()].sort((a, b) => b[1].cop - a[1].cop)

    const out = PRODUCTS.filter(p => (stock[p.id] ?? 0) <= 0)
    const low = PRODUCTS.filter(p => (stock[p.id] ?? 0) > 0 && (stock[p.id] ?? 0) < 15)

    return {
      days,
      count: inWindow.length,
      revenue,
      ticket: inWindow.length ? Math.round(revenue / inWindow.length) : 0,
      perDay,
      top,
      lostList,
      lostUnits: lostList.reduce((s, [, v]) => s + v.units, 0),
      lostCop: lostList.reduce((s, [, v]) => s + v.cop, 0),
      out,
      low,
    }
  }, [orders, unmet, stock])

  const maxDay = Math.max(1, ...m.perDay.map(d => d.total))
  const maxTop = Math.max(1, ...m.top.map(([, n]) => n))
  const maxLost = Math.max(1, ...m.lostList.map(([, v]) => v.cop))

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Últimos 7 días. Datos de demostración, salvo el catálogo."
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink">
            <RefreshCw className="size-3.5 text-ok" aria-hidden /> Matrix (simulada): sincronizada
          </span>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pedidos" value={String(m.count)} />
        <Kpi label="Ingresos" value={formatCOP(m.revenue)} />
        <Kpi label="Ticket promedio" value={formatCOP(m.ticket)} />
        <Kpi
          label="Demanda no atendida"
          value={formatCOP(m.lostCop)}
          hint={`${m.lostUnits} unidades sin stock`}
          highlight
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">Ventas por día</h2>
          <p className="mb-5 text-xs text-muted">Ingresos de pedidos no cancelados</p>
          <div className="flex h-48 items-end gap-2 sm:gap-3">
            {m.perDay.map(d => (
              <div key={d.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[11px] font-medium text-ink tnum">{d.total ? compact.format(d.total) : ''}</span>
                <div
                  role="img"
                  aria-label={`${formatDay(d.day + 'T12:00:00-05:00')}: ${formatCOP(d.total)} en ${d.count} pedidos`}
                  className={cx('w-full max-w-10 rounded-t-[4px]', d.total ? 'bg-pink' : 'bg-line')}
                  style={{ height: `${Math.max(3, (d.total / maxDay) * 78)}%` }}
                />
                <span className="text-[11px] text-muted tnum">{formatDay(d.day + 'T12:00:00-05:00')}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
            <TrendingDown className="size-4 text-bad" aria-hidden /> Lo que se dejó de vender
          </h2>
          <p className="mb-4 text-xs text-muted">Pedidos que pidieron más de lo que había</p>
          {m.lostList.length === 0 ? (
            <p className="text-sm text-muted">Sin demanda perdida en el período.</p>
          ) : (
            <ul className="space-y-3">
              {m.lostList.slice(0, 5).map(([id, v]) => (
                <li key={id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-ink">{PRODUCT_BY_ID.get(id)!.name}</span>
                    <span className="shrink-0 font-medium text-bad tnum">{v.units} uds.</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-canvas">
                    <div className="h-full rounded-full bg-bad/70" style={{ width: `${(v.cop / maxLost) * 100}%` }} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted tnum">{formatCOP(v.cop)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Más vendidos</h2>
          <ul className="space-y-3">
            {m.top.map(([id, n]) => (
              <li key={id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-ink">{PRODUCT_BY_ID.get(id)!.name}</span>
                  <span className="shrink-0 font-medium text-ink tnum">{n} uds.</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-canvas">
                  <div className="brand-line h-full rounded-full" style={{ width: `${(n / maxTop) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Alertas de inventario</h2>
            <Link href="/stock" className="text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline">
              Ver inventario
            </Link>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-md bg-bad/5 p-3">
              <p className="text-2xl font-semibold text-bad tnum">{m.out.length}</p>
              <p className="text-xs text-muted">Agotados</p>
            </div>
            <div className="rounded-md bg-warn/10 p-3">
              <p className="text-2xl font-semibold text-warn tnum">{m.low.length}</p>
              <p className="text-xs text-muted">Stock bajo</p>
            </div>
          </div>
          <ul className="divide-y divide-line">
            {[...m.out, ...m.low].slice(0, 6).map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate text-ink">{p.name}</span>
                <StockBadge qty={stock[p.id] ?? 0} compact={false} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

function Kpi({ label, value, hint, highlight }: { label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <Card className={cx('p-4', highlight && 'border-bad/30 bg-bad/[0.03]')}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cx('mt-1.5 text-xl font-semibold tracking-tight tnum sm:text-2xl', highlight ? 'text-bad' : 'text-ink')}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Card>
  )
}
