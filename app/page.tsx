import { redirect } from 'next/navigation'

// Middleware handles auth redirects — this catch-all just redirects to dashboard
// (middleware will redirect to /login if no session exists)
export default function RootPage() {
  redirect('/dashboard')
}
