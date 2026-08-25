'use client'

import { useEffect, useState } from 'react'

/**
 * The "Install app" row in the More sheet.
 *
 * Chrome fires `beforeinstallprompt` once, early — often before React has
 * hydrated — so the event is captured by an inline script in the root layout and
 * parked on `window`. This component picks it up from there, and also listens
 * for the custom event that script fires if it arrives later.
 *
 * When there is no captured prompt the row still renders, with instructions
 * instead of a button. That covers iOS Safari, which never fires the event, and
 * the Android browsers that bury the option — which is the actual reported
 * problem: the app was installable and there was nothing in it that said so.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __clarityInstallPrompt?: BeforeInstallPromptEvent
  }
}

export default function InstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    // Already running from the home screen — there is nothing to install.
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    setPrompt(window.__clarityInstallPrompt ?? null)

    function onReady() {
      setPrompt(window.__clarityInstallPrompt ?? null)
    }
    function onInstalled() {
      setPrompt(null)
      setInstalled(true)
    }

    window.addEventListener('clarity:installprompt', onReady)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('clarity:installprompt', onReady)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    // The event is single-use: once shown it cannot be shown again.
    window.__clarityInstallPrompt = undefined
    setPrompt(null)
    if (outcome === 'accepted') setInstalled(true)
  }

  if (installed) {
    return (
      <p className="px-4 py-3 text-xs text-gray-400">Installed — you&apos;re running the app.</p>
    )
  }

  if (prompt) {
    return (
      <button
        onClick={install}
        className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
      >
        <svg
          className="w-5 h-5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
        </svg>
        Install app
      </button>
    )
  }

  return (
    <div>
      <button
        onClick={() => setShowHelp(h => !h)}
        aria-expanded={showHelp}
        className="w-full flex items-center gap-3 px-4 py-3 min-h-[52px] text-sm text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <svg
          className="w-5 h-5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
        </svg>
        Add to home screen
      </button>
      {showHelp && (
        <p className="px-4 pb-3 -mt-1 text-xs text-gray-400 leading-relaxed">
          Your browser hasn&apos;t offered a one-tap install. Open its menu and choose
          <span className="text-gray-500"> Add to home screen</span> — in Chrome and Edge it may
          read <span className="text-gray-500">Install app</span>, and on iPhone it is under
          Share.
        </p>
      )}
    </div>
  )
}
