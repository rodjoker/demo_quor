# library_login_sb

Sistema de autenticación y gestión de usuarios construido con **Next.js 16** y **Supabase**. Incluye login seguro con bloqueo por intentos fallidos, registro de usuarios, edición de perfil y un sistema de roles y permisos.

## Tecnologías

| Capa | Stack |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, TypeScript |
| Backend | Supabase (PostgreSQL, Auth, RLS) |
| Dev local | Supabase CLI + Docker |

## Estructura del proyecto

```
library_login_sb/
  frontend/   — aplicación Next.js (App Router)
  backend/    — configuración de Supabase (migraciones, config)
```

## Requisitos previos

- [Node.js](https://nodejs.org/) v18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (para Supabase local)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)

```bash
npm install -g supabase
```

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/rodjoker/library_login_sb.git
cd library_login_sb
```

### 2. Levantar el backend (Supabase local)

```bash
cd backend
npx supabase start        # inicia los contenedores Docker
npx supabase db reset     # aplica las migraciones
```

Al finalizar verás las URLs y claves del proyecto local. Cópialas para el siguiente paso.

### 3. Configurar variables de entorno del frontend

```bash
cd ../frontend
cp .env.example .env
```

Edita `.env` con los valores que mostró `supabase start`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key
SUPABASE_SECRET_KEY=tu_secret_key
```

### 4. Instalar dependencias y correr el frontend

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

## Funcionalidades

- **Registro** — crea una cuenta con email y contraseña
- **Login** — autenticación con email y contraseña
- **Bloqueo por intentos** — la cuenta se bloquea automáticamente tras 3 intentos fallidos
- **Edición de perfil** — cada usuario puede editar su nombre, usuario, teléfono y dirección
- **Roles** — `admin`, `operator`, `users`
- **Permisos** — 20 permisos definidos y asignados por rol en la base de datos
- **Protección de rutas** — middleware que redirige a `/login` si no hay sesión activa

## Base de datos

La migración en `backend/supabase/migrations/` crea:

- **`profiles`** — datos de cada usuario vinculados a `auth.users`
- **`role_permissions`** — tabla de permisos por rol
- **RLS** habilitado en todas las tablas con políticas por usuario autenticado

## Detener el entorno local

```bash
cd backend
npx supabase stop
```
