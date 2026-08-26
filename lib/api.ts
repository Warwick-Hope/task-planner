import { NextResponse } from 'next/server'

// Each helper builds a fresh NextResponse — a response body can only be
// consumed once, so these must not be shared module-level instances.

/** Standard 401 — spelling is UK English throughout the API. */
export const unauthorised = () =>
  NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

export const forbidden = () => NextResponse.json({ error: 'Forbidden' }, { status: 403 })

/**
 * Parses a JSON request body without throwing on malformed input.
 * Returns null when the body is not valid JSON or is not an object —
 * the route should then respond 400.
 */
export async function parseJson<T = Record<string, unknown>>(
  request: Request
): Promise<T | null> {
  try {
    const body = await request.json()
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
    return body as T
  } catch {
    return null
  }
}

export const badBody = () =>
  NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

/** Narrows an unknown body field to a trimmed string, or null when absent/blank. */
export function trimmedString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

/**
 * The origin the caller actually reached us on, e.g. `https://clarity.example`.
 *
 * Used to build links that leave the app — an invitation link is pasted into a
 * message and opened on someone else's device, so a relative path is useless.
 * It was built from `NEXT_PUBLIC_APP_URL`, which is not set in production, so
 * every invite link generated there read `/invite/<token>` and went nowhere.
 *
 * Deriving it from the request means the link points at whatever host the owner
 * was using when they created it, with no environment variable to forget on the
 * next deployment. `x-forwarded-*` are what Vercel sets in front of the app;
 * `host` covers running the server directly. `NEXT_PUBLIC_APP_URL` is only a
 * fallback for the case where neither header is present — it is not an override,
 * because the value that has actually been wrong in production is that one.
 */
export function requestOrigin(request: Request): string {
  const headers = request.headers
  const host = headers.get('x-forwarded-host') ?? headers.get('host')

  if (host) {
    const protocol =
      headers.get('x-forwarded-proto') ??
      (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
    return `${protocol}://${host}`
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')

  // Last resort: whatever URL the runtime handed the route.
  return new URL(request.url).origin
}

/**
 * What a `lib/` helper says when it will not do the thing.
 *
 * The status travels with the message because the same helper is called by a
 * route, which needs an HTTP status, and by an MCP tool, which needs a sentence
 * to hand back to a model. Anything that returns one of these pairs with a
 * success shape, so callers branch on `ok` and TypeScript narrows the rest.
 */
export interface Refusal {
  ok: false
  status: number
  error: string
}

/** Turns a helper's refusal into the response a route should send. */
export const refusal = (r: Refusal) => NextResponse.json({ error: r.error }, { status: r.status })
