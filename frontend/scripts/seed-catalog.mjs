// Carga el catálogo real de Quor (78 productos de quorproducts.co) y su stock inicial en Supabase.
//
//   npm run seed:catalog -- --dry-run        ver el plan sin tocar la base (no necesita claves)
//   npm run seed:catalog                     carga productos y stock inicial
//   npm run seed:catalog -- --reset-stock    ademas VUELVE a poner el stock inicial en todos (pisa ajustes)
//
// Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY de frontend/.env.local.
// Es repetible: los productos se actualizan por SKU (no se duplican) y el stock inicial solo se pone
// en los productos que todavia no tienen fila de stock, salvo con --reset-stock.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const args = new Set(process.argv.slice(2))
const DRY_RUN = args.has('--dry-run')
const RESET_STOCK = args.has('--reset-stock')
const NOTE = 'Carga inicial del catálogo'

const fail = msg => {
  console.error(`\n✖ ${msg}\n`)
  process.exit(1)
}

// ---------- Datos ----------
const catalog = JSON.parse(readFileSync(new URL('../lib/mock/products.json', import.meta.url), 'utf8'))

const seen = new Set()
for (const p of catalog) {
  if (!p.sku || !p.name || !p.category) fail(`Producto incompleto en products.json: ${JSON.stringify(p)}`)
  if (!Number.isInteger(p.price) || p.price < 0) fail(`Precio inválido para ${p.sku}: ${p.price}`)
  if (seen.has(p.sku)) fail(`SKU repetido: ${p.sku}`)
  seen.add(p.sku)
}

const rows = catalog.map(p => ({
  sku: p.sku,
  name: p.name,
  category: p.category,
  price_cop: p.price,
  image_url: p.image ?? null,
  source_url: p.url ?? null,
  active: true,
}))

// Stock inicial ficticio y determinista (la misma regla que el modo demo de la app):
// casi todos con existencias, algunos bajos, otros agotados, y el Rose Gold en 35
// para el caso "piden 50 y quedan 35".
function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
const initialStock = new Map(
  catalog.map((p, i) => {
    const h = hash(p.sku)
    let qty = 40 + (h % 260)
    if (i % 9 === 4) qty = 3 + (h % 11)
    if (i % 17 === 8) qty = 0
    if (p.sku === 'QRGPRG0015') qty = 35
    return [p.sku, qty]
  }),
)

// ---------- Simulacro ----------
if (DRY_RUN) {
  const byCat = {}
  for (const p of catalog) byCat[p.category] = (byCat[p.category] ?? 0) + 1
  const values = [...initialStock.values()]
  console.log(`Simulacro: no se toca ninguna base de datos.\n`)
  console.log(`Productos a cargar: ${rows.length}`)
  console.log(`Por categoría:`, byCat)
  console.log(`Precios: $${Math.min(...catalog.map(p => p.price))} a $${Math.max(...catalog.map(p => p.price))} COP`)
  console.log(
    `Stock inicial: ${values.filter(q => q >= 15).length} disponibles, ` +
      `${values.filter(q => q > 0 && q < 15).length} con stock bajo, ` +
      `${values.filter(q => q === 0).length} agotados`,
  )
  console.log(`Rose Gold (QRGPRG0015): ${initialStock.get('QRGPRG0015')} unidades`)
  process.exit(0)
}

// ---------- Carga real ----------
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  fail(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en frontend/.env.local.\n' +
      '  Se ejecuta con: npm run seed:catalog (desde la carpeta frontend).',
  )
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const check = (step, error) => {
  if (error) fail(`${step}: ${error.message}${error.hint ? `\n  Pista: ${error.hint}` : ''}`)
}

console.log(`Destino: ${new URL(url).host}`)

// 1) Bodega por defecto (la crea la migración)
const { data: wh, error: whErr } = await supabase.from('warehouses').select('id, name').eq('is_default', true).maybeSingle()
check('Buscar la bodega por defecto (¿se aplicó la migración?)', whErr)
if (!wh) fail('No existe la bodega por defecto. Aplica primero la migración 20260925000000_quor_schema.sql.')

// 2) Productos: upsert por SKU
const { data: saved, error: upErr } = await supabase
  .from('products')
  .upsert(rows, { onConflict: 'sku' })
  .select('id, sku')
check('Cargar productos', upErr)
console.log(`✔ ${saved.length} productos cargados o actualizados`)

// 3) Stock inicial: solo donde aún no hay fila de stock (o en todos con --reset-stock)
const { data: existing, error: exErr } = await supabase.from('stock').select('product_id').eq('warehouse_id', wh.id)
check('Leer stock existente', exErr)
const hasStock = new Set(existing.map(s => s.product_id))

let applied = 0
let kept = 0
for (const p of saved) {
  if (hasStock.has(p.id) && !RESET_STOCK) {
    kept++
    continue
  }
  // Por adjust_stock (no por insert directo) para que quede el movimiento en el libro de auditoría
  const { error } = await supabase.rpc('adjust_stock', {
    p_product_id: p.id,
    p_new_quantity: initialStock.get(p.sku),
    p_reason: NOTE,
    p_warehouse_id: wh.id,
  })
  check(`Stock de ${p.sku}`, error)
  applied++
}
console.log(`✔ Stock inicial aplicado a ${applied} productos${kept ? ` (${kept} ya tenían stock y no se tocaron)` : ''}`)
console.log('\nListo.')
