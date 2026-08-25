'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      title="Sign out"
      aria-label="Sign out"
      className="flex items-center justify-center min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 rounded-md text-xs text-gray-500 hover:text-gray-800 transition-colors"
    >
      {/* The label costs width the phone header hasn't got — icon there, words above sm. */}
      <span className="hidden sm:inline">Sign out</span>
      <svg
        className="sm:hidden w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
        />
      </svg>
    </button>
  )
}
