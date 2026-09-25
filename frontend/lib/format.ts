// Formato fijo a Colombia (misma salida en servidor y navegador, para evitar desajustes de hidratación).
const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

const dateTime = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Bogota',
})

const dayOnly = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Bogota',
})

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }) // YYYY-MM-DD

export const formatCOP = (n: number) => cop.format(n)
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
export const formatDay = (iso: string) => dayOnly.format(new Date(iso))
export const dayOf = (iso: string) => dayKey.format(new Date(iso))
export const formatOrderNumber = (n: number) => `QR-${String(n).padStart(5, '0')}`

export const CATEGORY_LABEL: Record<string, string> = {
  'gel-polish': 'Gel Polish',
  tradicional: 'Tradicional',
  glitters: 'Glitters',
  polygel: 'Polygel',
  acrilicos: 'Acrílicos',
  'linea-spa': 'Línea Spa',
  'efectos-en-polvo': 'Efectos en polvo',
  herramientas: 'Herramientas',
}

export const categoryLabel = (slug: string) => CATEGORY_LABEL[slug] ?? slug
