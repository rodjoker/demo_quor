import { AuthCard } from '@/components/AuthCard'
import SignupForm from './SignupForm'

export default function SignupPage() {
  return (
    <AuthCard title="Crear cuenta" subtitle="Ingresa tu email y una contraseña">
      <SignupForm />
    </AuthCard>
  )
}
