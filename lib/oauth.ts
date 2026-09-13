import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { ALL_SCOPES, hashToken, OAUTH_TOKEN_PREFIX } from '@/lib/api-tokens'
import type { ApiTokenScope } from '@/types'

/**
 * OAuth 2.1 for the connector (Phase 4.11).
 *
 * A claude.ai custom connector is added by URL and authenticated by OAuth only —
 * there is no field for a pasted token, which is why 4.10 reached Claude Code and
 * nothing else (KB.md #46). This is the machinery behind that: discovery
 * metadata, dynamic client registration, authorization codes with PKCE, and
 * access tokens that `requireCaller` resolves as a third kind of credential
 * alongside the session cookie and the personal access token.
 *
 * **What it deliberately is not.** It is not a general-purpose authorization
 * server. There is one resource (this app), two scopes, one grant type plus
 * refresh, and S256 is the only PKCE method — OAuth 2.1 forbids `plain`, and a
 * server with no legacy client has no reason to carry it.
 */

/**
  * `clr_` is a personal access token (4.9); these are 4.11's. The access prefix
  * lives in `lib/api-tokens.ts` with `clr_`, because that file is the one that
  * decides what a bearer header may contain, and two copies of it would be two
  * answers to the same question.
  */
export const OAUTH_ACCESS_PREFIX = OAUTH_TOKEN_PREFIX
export const OAUTH_REFRESH_PREFIX = 'clrr_'
export const OAUTH_CODE_PREFIX = 'clrc_'
export const OAUTH_SECRET_PREFIX = 'clrs_'

/**
 * An hour, matching the Supabase session the token is exchanged for (KB.md #44).
 * A longer access token would outlive the thing it is a key to.
 */
export const ACCESS_TTL_SECONDS = 3600
/** Long enough that a phone left alone for a fortnight still works. */
export const REFRESH_TTL_DAYS = 30
export const CODE_TTL_SECONDS = 600

/** The scopes a client may ask for, and what they are called on the consent screen. */
export const SCOPE_LABELS: Record<ApiTokenScope, string> = {
  'tasks:read': 'Read your tasks, workspaces and categories',
  'tasks:write': 'Create, change and complete tasks, and use the brain dump',
}

export interface OAuthClient {
  id: string
  name: string
  redirect_uris: string[]
  secret_hash: string | null
}

function mint(prefix: string): string {
  return prefix + randomBytes(32).toString('base64url')
}

export const mintAccessToken = () => mint(OAUTH_ACCESS_PREFIX)
export const mintRefreshToken = () => mint(OAUTH_REFRESH_PREFIX)
export const mintCode = () => mint(OAUTH_CODE_PREFIX)
export const mintClientSecret = () => mint(OAUTH_SECRET_PREFIX)

export { hashToken }

/**
 * Verifies a PKCE code verifier against the challenge stored with the code.
 *
 * S256 only. Compared with `timingSafeEqual` because this is a secret comparison
 * on a public endpoint — cheap here, and the habit is worth more than the
 * microseconds.
 */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false
  // RFC 7636: 43–128 characters of unreserved alphabet.
  if (verifier.length < 43 || verifier.length > 128) return false

  const computed = createHash('sha256').update(verifier).digest('base64url')
  const a = Buffer.from(computed)
  const b = Buffer.from(challenge)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Whether a redirect URI may be registered.
 *
 * HTTPS anywhere, plus loopback over HTTP for a client running on the machine —
 * which is how a desktop or CLI client does this, and is the one exception OAuth
 * 2.1 keeps. A fragment is never allowed; the authorization response uses the
 * query, and a fragment would silently swallow it.
 */
export function isAllowedRedirectUri(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }

  if (url.hash) return false
  if (url.protocol === 'https:') return true

  return (
    url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  )
}

/** The scopes to grant: what was asked for, narrowed to what exists. Empty means read-only. */
export function requestedScopes(raw: unknown): ApiTokenScope[] {
  if (typeof raw !== 'string' || !raw.trim()) return ['tasks:read']

  const asked = raw.split(/[\s,]+/).filter(Boolean)
  const scopes = ALL_SCOPES.filter(scope => asked.includes(scope))

  // Same rule as a personal access token: write without read is a credential that
  // can create a task and not read it back, which is never what anyone means.
  if (scopes.includes('tasks:write') && !scopes.includes('tasks:read')) {
    scopes.unshift('tasks:read')
  }

  return scopes.length > 0 ? scopes : ['tasks:read']
}

/**
 * Where this server's metadata lives, and what it says.
 *
 * Both documents are built from the request's own origin rather than an
 * environment variable, for the reason invitation links are (KB.md #36): the
 * value that has actually been wrong in production is the environment variable.
 */
export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    scopes_supported: ALL_SCOPES,
    bearer_methods_supported: ['header'],
    resource_documentation: `${origin}/connections`,
  }
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    revocation_endpoint: `${origin}/api/oauth/revoke`,
    scopes_supported: ALL_SCOPES,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    // S256 only: OAuth 2.1 removes `plain`, and nothing here predates that.
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
  }
}

/** The `WWW-Authenticate` header that tells a client where to go and sign in. */
export function challengeHeader(origin: string): string {
  return `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`
}

/**
 * Client credentials from a token request, however the client chose to send them.
 *
 * A public client sends only `client_id` in the body, which is the normal case
 * for MCP; `client_secret_basic` and `client_secret_post` are accepted because
 * the metadata advertises them and some clients will use one.
 */
export function clientCredentials(
  request: Request,
  body: URLSearchParams
): { clientId: string | null; clientSecret: string | null } {
  const header = request.headers.get('authorization')

  if (header?.toLowerCase().startsWith('basic ')) {
    try {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
      const separator = decoded.indexOf(':')
      if (separator > 0) {
        return {
          clientId: decodeURIComponent(decoded.slice(0, separator)),
          clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
        }
      }
    } catch {
      // Fall through to the body — a malformed header is not a credential.
    }
  }

  return {
    clientId: body.get('client_id'),
    clientSecret: body.get('client_secret'),
  }
}

/** OAuth's error shape, which clients parse — not the app's `{ error: "..." }`. */
export function oauthError(
  code:
    | 'invalid_request'
    | 'invalid_client'
    | 'invalid_grant'
    | 'unauthorized_client'
    | 'unsupported_grant_type'
    | 'invalid_scope'
    | 'server_error',
  description: string,
  status = 400
): Response {
  return new Response(JSON.stringify({ error: code, error_description: description }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // A token response must never be cached: it carries a credential.
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  })
}
