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
