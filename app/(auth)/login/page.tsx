import LoginForm from '@/components/auth/LoginForm'

export const metadata = { title: 'Sign in — Clarity' }

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return <LoginForm next={searchParams.next} />
}
