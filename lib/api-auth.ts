import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase-server'
import { bearerToken, hashToken } from '@/lib/api-tokens'
import type { ApiTokenScope } from '@/types'

/**
 * Who is calling, and a Supabase client that acts as them.
 *
 * Two ways in: the session cookie the app uses, or a personal access token in an
 * `Authorization: Bearer` header (Phase 4.9). Routes get the same two things
 * either way — a user and a client — so their bodies do not care which it was.
 *
 * **A token-authed client is a real user session, not a service-role client.**
 * That is the whole design: every RLS policy in the database keys off workspace
 * membership for a user, and none of them care how that user authenticated. A
 * service-role client would turn every policy into a comment and leave the route
 * layer as the only thing between a token and someone else's household.
 *
 * Getting there is not free, because we cannot sign a Supabase JWT ourselves:
 * the project's signing key is asymmetric (ES256) and its private half never
 * leaves Supabase. So the token is exchanged for a genuine session through the
 * Auth admin API — a magic link generated and immediately redeemed server-side,
 * which is the supported way to obtain a session for a user you have already
 * authenticated by other means. That exchange is the only thing the secret key
 * is used for, and its result is cached for the life of the access token.
 */

export interface Caller {
  /** Acts as the user: RLS applies exactly as it does for a browser session. */
  supabase: SupabaseClient
  userId: string
  via: 'session' | 'token'
  /** A session is the owner and holds every scope; a token holds what it was granted. */
  scopes: ApiTokenScope[]
}

export type CallerResult = { ok: true; caller: Caller } | { ok: false; response: NextResponse }

export interface RequireCallerOptions {
  /**
   * The scope a bearer token must hold to use this route. **Omitting it makes the
   * route session-only** — the safe default, so a new route is never reachable by
   * token until somebody has decided it should be.
   */
  scope?: ApiTokenScope
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Sessions minted for tokens, keyed by token hash.
 *
 * Per server instance and in memory only: it holds live access tokens, so it
 * must not be written anywhere that outlives the process. A cold start pays the
 * exchange again, which is three Auth calls, not a failure.
 */
const sessionCache = new Map<string, { accessToken: string; expiresAt: number; userId: string }>()

/** Refresh a little before expiry rather than exactly on it. */
const EXPIRY_MARGIN_SECONDS = 60

export async function requireCaller(
  request: Request,
  opts: RequireCallerOptions = {}
): Promise<CallerResult> {
  const token = bearerToken(request)

  if (token) {
    if (!opts.scope) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'This endpoint requires a signed-in session, not an API token' },
          { status: 403 }
        ),
      }
    }
    return resolveToken(token, opts.scope)
  }

  const supabase = createSessionClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }),
    }
  }

  return {
    ok: true,
    caller: { supabase, userId: user.id, via: 'session', scopes: ['tasks:read', 'tasks:write'] },
  }
}

async function resolveToken(token: string, required: ApiTokenScope): Promise<CallerResult> {
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!secretKey) {
    // The same shape as push without a VAPID pair (KB.md #38): a missing server
    // secret is a deployment problem, and saying so beats a 401 that sends the
    // caller looking at their token.
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Token authentication is not configured on this deployment' },
        { status: 503 }
      ),
    }
  }

  const tokenHash = hashToken(token)

  // Resolving cannot go through RLS — the caller has no session yet. The
  // security definer function takes the hash, stamps last_used_at, and returns
  // nothing at all for a token that is unknown, revoked or expired.
  const anon = createSupabaseClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await anon.rpc('resolve_api_token', { p_token_hash: tokenHash })

  const resolved = (data as { token_id: string; user_id: string; scopes: string[] }[] | null)?.[0]

  if (error || !resolved) {
    sessionCache.delete(tokenHash)
    return { ok: false, response: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }
  }

  if (!resolved.scopes.includes(required)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `This token does not hold the ${required} scope` },
        { status: 403 }
      ),
    }
  }

  const accessToken = await accessTokenFor(tokenHash, resolved.user_id, secretKey)
  if (!accessToken) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Could not establish a session' }, { status: 500 }),
    }
  }

  return {
    ok: true,
    caller: {
      supabase: createSupabaseClient(SUPABASE_URL, PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      }),
      userId: resolved.user_id,
      via: 'token',
      scopes: resolved.scopes as ApiTokenScope[],
    },
  }
}

/** A live access token for this user, from the cache or freshly exchanged. */
async function accessTokenFor(
  tokenHash: string,
  userId: string,
  secretKey: string
): Promise<string | null> {
  const cached = sessionCache.get(tokenHash)
  if (cached && cached.userId === userId && cached.expiresAt > Date.now()) {
    return cached.accessToken
  }

  const admin = createSupabaseClient(SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId)
  const email = userData?.user?.email
  if (userError || !email) return null

  // generateLink does not send anything: it returns the token an email would
  // have carried, which is then redeemed here rather than by a browser.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const hashedToken = link?.properties?.hashed_token
  if (linkError || !hashedToken) return null

  const { data: verified, error: verifyError } = await admin.auth.verifyOtp({
    type: 'email',
    token_hash: hashedToken,
  })

  const session = verified?.session
  if (verifyError || !session) return null

  sessionCache.set(tokenHash, {
    accessToken: session.access_token,
    userId,
    expiresAt: (session.expires_at ?? 0) * 1000 - EXPIRY_MARGIN_SECONDS * 1000,
  })

  return session.access_token
}

/** Drops any cached session for a token — call when one is revoked. */
export function forgetToken(tokenHash: string): void {
  sessionCache.delete(tokenHash)
}
