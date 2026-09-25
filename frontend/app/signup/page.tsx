import SignupForm from './SignupForm'

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Crear cuenta</h1>
          <p className="mt-1 text-sm text-zinc-500">Ingresa tu email y una contraseña</p>
        </div>
        <SignupForm />
      </div>
    </div>
  )
}
