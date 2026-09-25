// Modo demo: se activa solo cuando NO hay Supabase configurado (o con NEXT_PUBLIC_DEMO_MODE=true).
// En modo demo no hay login: se entra directo y el rol se cambia desde el menú de usuario.
// Al poner las claves de Supabase en .env.local, la sesión pasa a ser la real.
export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.NEXT_PUBLIC_SUPABASE_URL
