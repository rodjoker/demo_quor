import { AuthCard } from '@/components/AuthCard'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <AuthCard title="Iniciar sesión" subtitle="Ingresa tus credenciales para continuar">
      <LoginForm />
    </AuthCard>
  )
}
