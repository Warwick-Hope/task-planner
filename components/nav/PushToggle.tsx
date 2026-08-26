'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * The push on/off control, in the footer of the notification bell.
 *
 * It lives there rather than in a settings page because that panel is already
 * "your notifications", is present at every breakpoint, and is where someone
 * looks when they want to be told about things.
 *
 * Permission has to be requested from a real click — a browser ignores
 * `requestPermission()` without a user gesture, and Chrome penalises a site that
 * asks on load — so there is no auto-prompt anywhere in the app.
 */

type State =
  | 'loading'
  | 'unsupported' // no service worker or no PushManager
  | 'no-worker' // supported, but nothing registered (development)
  | 'off'
  | 'on'
  | 'denied'
  | 'busy'
  | 'error'

/**
 * The VAPID public key travels as base64url; subscribe() wants bytes.
 *
 * Returns the ArrayBuffer rather than a Uint8Array view: `applicationServerKey`
 * is typed as BufferSource, and a Uint8Array over ArrayBufferLike does not
 * satisfy it under this TypeScript lib.
 */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalised)
  const buffer = new ArrayBuffer(raw.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return buffer
}

export default function PushToggle() {
  const [state, setState] = useState<State>('loading')
  // What the last test send did, shown under the toggle. Null = never tried.
  const [testResult, setTestResult] = useState<string | null>(null)

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) setState('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) setState('denied')
        return
      }
      // getRegistration, not `ready`: `ready` never settles when no worker has
      // been registered, which is every development session.
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) {
        if (!cancelled) setState('no-worker')
        return
      }
      const existing = await registration.pushManager.getSubscription()
      if (!cancelled) setState(existing ? 'on' : 'off')
    }

    check().catch(() => {
      if (!cancelled) setState('error')
    })
    return () => {
      cancelled = true
    }
  }, [])

  const enable = useCallback(async () => {
    if (!publicKey) {
      setState('error')
      return
    }
    setState('busy')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off')
        return
      }

      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) {
        setState('no-worker')
        return
      }

      const subscription = await registration.pushManager.subscribe({
        // Required by Chrome: every push must result in a visible notification.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(publicKey),
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })

      if (!res.ok) {
        // Don't leave the browser subscribed to something the server cannot
        // send to — that would look enabled and never deliver.
        await subscription.unsubscribe()
        setState('error')
        return
      }
      setState('on')
    } catch {
      setState('error')
    }
  }, [publicKey])

  const sendTest = useCallback(async () => {
    setTestResult('Sending…')
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      if (!res.ok) {
        // 503 is the one worth naming: the server has no VAPID pair, so the
        // subscription is real and nothing can ever be sent to it.
        setTestResult(
          res.status === 503
            ? 'This server has no push keys set.'
            : 'Could not send a test notification.'
        )
        return
      }
      const { delivered } = (await res.json()) as { delivered: number }
      setTestResult(
        delivered > 0
          ? `Sent to ${delivered} device${delivered === 1 ? '' : 's'}.`
          : 'No devices are subscribed on this account.'
      )
    } catch {
      setTestResult('Could not send a test notification.')
    }
  }, [])

  const disable = useCallback(async () => {
    setState('busy')
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      setState('off')
    } catch {
      setState('error')
    }
  }, [])

  if (state === 'loading') return null

  const message: Partial<Record<State, string>> = {
    unsupported: 'This browser cannot do push notifications.',
    'no-worker': 'Push works in the installed app — available after the next deploy.',
    denied: 'Notifications are blocked. Turn them back on in your browser settings.',
    error: 'Something went wrong turning notifications on.',
  }

  if (message[state]) {
    return (
      <p className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400 leading-relaxed">
        {message[state]}
      </p>
    )
  }

  const on = state === 'on'
  const busy = state === 'busy'

  return (
    <div className="border-t border-gray-100">
    <button
      onClick={on ? disable : enable}
      disabled={busy}
      className="w-full flex items-center justify-between gap-2 px-4 py-3 min-h-[48px] text-xs text-left transition-colors hover:bg-gray-50 disabled:opacity-50"
    >
      <span className={on ? 'text-gray-500' : 'text-blue-600 font-medium'}>
        {busy ? 'Just a moment…' : on ? 'Push notifications are on' : 'Notify me on this device'}
      </span>
      <span
        aria-hidden="true"
        className={`shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          on ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            on ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>

      {/* Only worth offering once it is on — and it is the only way one person
          can find out whether push actually works, since assigning a task to
          yourself deliberately notifies nobody. */}
      {on && (
        <div className="px-4 pb-3 -mt-1 flex items-center gap-2">
          <button
            onClick={sendTest}
            className="text-xs text-blue-600 hover:text-blue-800 min-h-[32px] transition-colors"
          >
            Send a test notification
          </button>
          {testResult && <span className="text-xs text-gray-400 truncate">{testResult}</span>}
        </div>
      )}
    </div>
  )
}
