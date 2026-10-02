import Image from 'next/image'

// Pantalla de acceso: aquí sí se ve el degradado de marca, de forma suave, como fondo.
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="brand-wash flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Image src="/quor-logo.png" alt="Quor" width={120} height={62} priority className="h-auto w-28" />
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
            <p className="mt-1 text-sm text-muted">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}