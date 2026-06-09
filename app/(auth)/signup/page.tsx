import SignUpForm from '@/components/auth/SignUpForm'

export const metadata = { title: 'Create account — Clarity' }

export default function SignUpPage({ searchParams }: { searchParams: { next?: string } }) {
  return <SignUpForm next={searchParams.next} />
}
