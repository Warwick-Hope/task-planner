import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { unauthorised } from '@/lib/api'
import { pushToSelf, pushConfigured } from '@/lib/push'

/**
 * Sends a test notification to the caller's own devices.
 *
 * This exists because **push was otherwise untestable by one person.** The only
 * thing that sends is an assignment, and assigning a task to yourself
 * deliberately notifies nobody — so a single user could turn push on, see the
 * toggle say it was on, and have no way of finding out whether a notification
 * would ever arrive. That is exactly the state 4.2 shipped in with the install
 * offer, and it is worth not repeating.
 *
 * It can only ever notify the caller: `pushToSelf` reads the caller's own rows
 * under RLS, so there is no way to aim this at anyone else.
 */
export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return unauthorised()

  if (!pushConfigured) {
    return NextResponse.json(
      { error: 'Push is not configured on this server' },
      { status: 503 }
    )
  }

  const delivered = await pushToSelf(supabase, user.id, {
    title: 'Clarity',
    body: 'Push notifications are working on this device.',
    url: '/dashboard',
    // Replaces rather than stacks, so repeated tests leave one notification.
    tag: 'push-test',
  })

  // 0 is not an error: it means no device on this account has push turned on,
  // or the only one it had was retired mid-send. The UI says which.
  return NextResponse.json({ delivered })
}
