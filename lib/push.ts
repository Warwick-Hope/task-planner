import webpush from 'web-push'
import type { createClient } from '@/lib/supabase-server'

/**
 * Sending web push from a route handler.
 *
 * The sender is almost never the recipient — the whole point is telling someone
 * else they have been assigned a task — so this cannot read
 * `push_subscriptions` directly: RLS restricts that table to its owner, which is
 * deliberate, because a subscription is a capability to notify a device. It goes
 * through `get_push_subscriptions_for_member`, which returns another member's
 * endpoints only when both parties share the workspace.
 *
 * Nothing here throws. A notification that fails to send must not fail the
 * request that triggered it: the assignment itself is the thing the user asked
 * for, and it has already been written by the time we get here.
 */

type ServerClient = ReturnType<typeof createClient>

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY
const subject = process.env.VAPID_SUBJECT ?? 'mailto:noreply@clarity.app'

/**
 * False when the VAPID pair is missing — locally before `.env.local` has it, or
 * in an environment where it was never set. Callers skip quietly rather than
 * erroring, and `/api/push/subscribe` reports it so the UI can explain itself.
 */
export const pushConfigured = Boolean(publicKey && privateKey)

if (pushConfigured) {
  webpush.setVapidDetails(subject, publicKey as string, privateKey as string)
}

export interface PushPayload {
  title: string
  body: string
  /** Where a click should land. Same-origin path, not a full URL. */
  url: string
  /**
   * Collapses repeats: a second notification with the same tag replaces the
   * first rather than stacking. Assignment pushes tag by task id.
   */
  tag?: string
}

interface SubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
}

/** Sends one payload to a set of endpoints. Returns how many accepted it. */
async function sendToSubscriptions(
  supabase: ServerClient,
  subscriptions: SubscriptionRow[],
  payload: PushPayload
): Promise<number> {
  if (subscriptions.length === 0) return 0

  const body = JSON.stringify(payload)
  let delivered = 0

  await Promise.all(
    subscriptions.map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        )
        delivered += 1
      } catch (err) {
        // 404/410 mean the push service has retired this endpoint — the browser
        // was uninstalled, or the user cleared site data. Anything else (a 5xx
        // from the push service, a network blip) is transient: leave the row
        // alone and let the next notification try again.
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint })
        }
      }
    })
  )

  return delivered
}

/**
 * Pushes to every device belonging to one member of one workspace.
 * Returns how many devices accepted it — 0 is a normal outcome (nobody has
 * granted permission on any device yet).
 */
export async function pushToMember(
  supabase: ServerClient,
  {
    userId,
    workspaceId,
    payload,
  }: {
    userId: string
    workspaceId: string
    payload: PushPayload
  }
): Promise<number> {
  if (!pushConfigured) return 0

  const { data, error } = await supabase.rpc('get_push_subscriptions_for_member', {
    p_user_id: userId,
    p_workspace_id: workspaceId,
  })

  if (error || !data) return 0

  return sendToSubscriptions(supabase, data as SubscriptionRow[], payload)
}

/**
 * Pushes to the caller's own devices.
 *
 * Reads the table directly — RLS already restricts it to the owner, so no
 * security definer function is needed or wanted here. This exists because there
 * is otherwise **no way to test push with one account**: an assignment to
 * yourself deliberately sends nothing, so a single user cannot see a
 * notification without a second person to assign them a task.
 */
export async function pushToSelf(
  supabase: ServerClient,
  userId: string,
  payload: PushPayload
): Promise<number> {
  if (!pushConfigured) return 0

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error || !data) return 0

  return sendToSubscriptions(supabase, data as SubscriptionRow[], payload)
}
