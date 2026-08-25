/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Browsers already refuse to use a service worker script older than 24
        // hours, but nothing stops an intermediary holding the old one for the
        // rest of that day. Saying no-cache means a deploy takes effect on the
        // next visit rather than whenever the CDN feels like it.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ]
  },
}

export default nextConfig
