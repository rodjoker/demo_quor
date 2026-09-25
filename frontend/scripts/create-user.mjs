// Crea un usuario con un rol (por defecto admin) en Supabase, ya confirmado y listo para entrar.
//
//   npm run create-user -- --email tu@correo.com --password "TuClave" --name "Tu Nombre"
//   npm run create-user -- --email tu@correo.com                      (pide la contraseña sin mostrarla)
//   npm run create-user -- --email x@y.com --role vendedor            (admin | vendedor | bodega | cliente)
//   npm run create-user -- --email x@y.com --dry-run                  (solo valida, no toca la base)
//
// Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY de frontend/.env.local.
// Si el correo ya existe, solo le cambia el rol: NUNCA cambia una contraseña existente.
import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2)
const opt = name => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const DRY_RUN = argv.includes('--dry-run')
const ROLES = ['admin', 'vendedor', 'bodega', 'cliente']

const fail = msg => {
  console.error(`\n✖ ${msg}\n`)
  process.exit(1)
}

// Contraseña escrita sin eco en pantalla (solo en una terminal interactiva)
function askHidden(question) {
  if (!process.stdin.isTTY) fail('Sin terminal interactiva: pasa la contraseña con --password "..."')
  process.stdout.write(question)
  return new Promise(resolve => {
    let buf = ''
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    const onData = chunk => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') {
          process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdin.off('data', onData)
          process.stdout.write('\n')
          return resolve(buf)
        }
        if (c === '\u0003') process.exit(130)
        if (c === '\u007f' || c === '\b') buf = buf.slice(0, -1)
        else buf += c
      }
    }
    process.stdin.on('data', onData)
  })
}

const email = opt('email')?.trim().toLowerCase()
const role = opt('role') ?? 'admin'
const name = opt('name')?.trim() || undefined

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Falta un correo válido: --email tu@correo.com')
if (!ROLES.includes(role)) fail(`Rol inválido "${role}". Usa: ${ROLES.join(', ')}`)

const password = opt('password') ?? (DRY_RUN ? 'simulacro' : await askHidden('Contraseña (no se muestra): '))
if (!DRY_RUN && password.length < 8) fail('La contraseña debe tener al menos 8 caracteres.')

if (DRY_RUN) {
  console.log('Simulacro: no se toca ninguna base de datos.')
  console.log(`  correo: ${email}\n  rol:    ${role}\n  nombre: ${name ?? '(sin nombre)'}`)
  process.exit(0)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  fail(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en frontend/.env.local.\n' +
      '  (la clave secreta NO lleva el prefijo NEXT_PUBLIC_)',
  )
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
console.log(`Destino: ${new URL(url).host}`)

// 1) Crear el usuario en Auth ya confirmado (sin depender del correo de verificación)
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: name ? { full_name: name } : {},
})

let userId
if (error) {
  if (!/already|registered|exists/i.test(error.message)) fail(`No se pudo crear el usuario: ${error.message}`)
  const { data: existing, error: findErr } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle()
  if (findErr) fail(`Buscar el usuario existente: ${findErr.message}`)
  if (!existing) fail('El correo ya existe en Auth pero no tiene perfil. Revísalo en Authentication → Users.')
  userId = existing.id
  console.log('• El usuario ya existía: solo se actualiza el rol (la contraseña NO se cambia).')
} else {
  userId = data.user.id
  console.log('✔ Usuario creado y confirmado')
}

// 2) El trigger ya creó su perfil como "cliente"; aquí se le asigna el rol pedido
const { data: profile, error: upErr } = await supabase
  .from('profiles')
  .update({ role, ...(name ? { full_name: name } : {}) })
  .eq('id', userId)
  .select('email, role, blocked')
  .single()
if (upErr) fail(`Asignar el rol: ${upErr.message}`)

console.log(`✔ ${profile.email} ahora es "${profile.role}"${profile.blocked ? ' (¡está bloqueado!)' : ''}`)
console.log('\nListo. Ya puede iniciar sesión.')
