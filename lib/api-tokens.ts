import { createHash, randomBytes } from 'crypto'
import type { ApiTokenScope } from '@/types'

/**
 * Minting and hashing personal access tokens.
 *
 * The token is 32 random bytes, base64url, behind a fixed `clr_` prefix so it is
 * recognisable in a config file and greppable in a log that should never have
 * contained it. Only the SHA-256 hash reaches the database; the plaintext is
 * returned once, at creation, and cannot be recovered afterwards.
 *
 * SHA-256 rather than a password hash on purpose: this is a 256-bit random
 * secret, not something a person chose, so there is no dictionary to slow down —
 * and the hash is computed on every API call, where bcrypt's cost would be paid
 * per request for no gain.
 */

export const TOKEN_PREFIX = 'clr_'

/** How much of the token the UI may show. Enough to tell two rows apart. */
const DISPLAY_PREFIX_LENGTH = TOKEN_PREFIX.length + 6

export const ALL_SCOPES: ApiTokenScope[] = ['tasks:read', 'tasks:write']

export interface MintedToken {
  /** Shown once. Never stored. */
  token: string
  tokenHash: string
  tokenPrefix: string
}

export function mintToken(): MintedToken {
  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url')
  return {
    token,
    tokenHash: hashToken(token),
    tokenPrefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * The bearer token on a request, or null.
 *
 * Anything that is not a `Bearer clr_…` is treated as absent rather than
 * rejected: a caller with a session cookie and a stray Authorization header
 * should still be able to use the app.
 */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null

  const [scheme, value] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null

  return value.startsWith(TOKEN_PREFIX) ? value : null
}

/** Narrows unknown input to the scopes we actually recognise. */
export function parseScopes(value: unknown): ApiTokenScope[] {
  if (!Array.isArray(value)) return []
  const scopes = ALL_SCOPES.filter((scope) => value.includes(scope))
  // tasks:write without tasks:read would be a token that can create a task and
  // not read it back, which is never what anyone means.
  if (scopes.includes('tasks:write') && !scopes.includes('tasks:read')) {
    scopes.unshift('tasks:read')
  }
  return scopes
}
