import type { MetadataRoute } from 'next'

/**
 * Served at /manifest.webmanifest, and linked from every page by Next itself.
 *
 * Two things here are load-bearing for installability on Android: a PNG icon of
 * at least 192px (an SVG will not do), and `display: standalone`. The route is
 * also exempted from the auth redirect in middleware.ts — Chrome may fetch it
 * before there is a session, and a 307 to /login is not a manifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // A stable identity, so a later change to start_url does not read as a
    // different app and orphan the installed one.
    id: '/',
    name: 'Clarity — planning and household',
    short_name: 'Clarity',
    description: 'Personal planning and household coordination',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    // Matches the app shell's header, which is what sits under the status bar.
    theme_color: '#ffffff',
    background_color: '#ffffff',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Separate file, not a second purpose on the same one: a launcher crops a
      // maskable icon, and the rounded-square artwork would lose its corners.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Brain dump', short_name: 'Dump', url: '/brain-dump' },
      { name: "Today's plan", short_name: 'Plan', url: '/plan' },
    ],
  }
}
