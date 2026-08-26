import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { unauthorised, parseJson, badBody } from '@/lib/api'
import { pushConfigured } from '@/lib/push'

/**
 * A device registering or dropping its own push subscription.
 *
 * Both handlers write only the caller's own rows, so RLS is the enforcement and
 * this route adds validation on top. Nothing here can reach another user's
 * subscriptions — sending to someone else goes through a security definer
 * function instead (see lib/push.ts).
 */

interface SubscribeBody {
  endpoint?: unknown
  keys?: { p256dh?: unknown; auth?: unknown }
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return unauthorised()

  if (!pushConfigured) {
    // Worth an explicit answer rather than a silent success: without a VAPID
    // pair the subscription the browser just created can never be sent to.
    return NextResponse.json({ error: 'Push is not configured on this server' }, { status: 503 })
  }

  const body = await parseJson<SubscribeBody>(request)
  if (!body) return badBody()

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : ''
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : ''

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'endpoint and keys are required' }, { status: 400 })
  }

  // Endpoints are absolute URLs at the browser vendor's push service. Reject
  // anything else rather than storing a string we will later hand to a fetch.
  let parsed: URL
  try {
    parsed = new URL(endpoint)
  } catch {
    return NextResponse.json({ error: 'endpoint must be a URL' }, { status: 400 })
  }
  if (parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'endpoint must be https' }, { status: 400 })
  }

  // The same endpoint can be re-registered — the browser hands back the existing
  // subscription on a second subscribe() — and it can change hands if a device
  // is signed into a different account, so the owner is updated too.
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return unauthorised()

  const body = await parseJson<{ endpoint?: unknown }>(request)
  if (!body) return badBody()

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
  if (!endpoint) return NextResponse.json({ error: 'endpoint is required' }, { status: 400 })

  // Scoped to the caller as well as the endpoint: RLS would do it anyway, and
  // saying it here means a future policy change cannot quietly widen this.
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
