'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

/**
 * Sign in with Google (Phase 4.4).
 *
 * **Additive, never a replacement.** Email and password stay, because removing
 * that path would strand the two e2e accounts and the invitation flow
 * (PLAN.md §Decisions log, 14 Aug 2026). The same account is reachable either
 * way: Supabase matches on the verified email address, so signing in with Google
 * on an address that already has a password lands in the same account rather
 * than making a second one.
 *
 * Nothing happens here after the click — `signInWithOAuth` navigates away to
 * Google, and the browser comes back to `/api/auth/callback`, which exchanges the
 * code for a session exactly as it does for an email confirmation. A brand-new
 * account arrives with no profile, and `AppShell` sends it to `/onboarding`,
 * which is what creates the personal workspace.
 */
export default function GoogleButton({ next, label }: { next?: string; label: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const callback = new URL('/api/auth/callback', window.location.origin)
    // Carried through Google and back, so a link that sent someone to sign in
    // still lands where it meant to — an OAuth consent screen, usually.
    if (next) callback.searchParams.set('next', next)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback.toString() },
    })

    // Reached only when the redirect never happened: the provider is not
    // configured on this Supabase project, or the network failed.
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={signIn}
        disabled={loading}
        className="flex min-h-11 w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {/* Google's mark, inline: an external image on a sign-in page is a
            request to somebody else's server before anyone has signed in. */}
        <svg aria-hidden viewBox="0 0 18 18" className="h-[18px] w-[18px]">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
          />
        </svg>
        {loading ? 'Redirecting…' : label}
      </button>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-xs uppercase tracking-wide text-gray-400">or</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>
    </div>
  )
}
