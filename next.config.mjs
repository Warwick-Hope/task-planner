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

  /**
   * The OAuth discovery documents (Phase 4.11).
   *
   * They have to live at `/.well-known/...`, and a folder whose name begins with
   * a dot is not a route in the App Router — so the routes sit under `/api/oauth`
   * and are rewritten here.
   *
   * Each is served at two paths. RFC 9728 has a client build the metadata URL by
   * inserting `.well-known` *before* the resource's own path, so a resource at
   * `/api/mcp` is discovered at `/.well-known/oauth-protected-resource/api/mcp`;
   * the bare path is what a client that only knows the origin will try. Both
   * answer, because which one a given client uses is not ours to decide.
   */
  async rewrites() {
    return [
      {
        source: '/.well-known/oauth-protected-resource',
        destination: '/api/oauth/metadata/protected-resource',
      },
      {
        source: '/.well-known/oauth-protected-resource/:path*',
        destination: '/api/oauth/metadata/protected-resource',
      },
      {
        source: '/.well-known/oauth-authorization-server',
        destination: '/api/oauth/metadata/authorization-server',
      },
      {
        source: '/.well-known/oauth-authorization-server/:path*',
        destination: '/api/oauth/metadata/authorization-server',
      },
    ]
  },
}

export default nextConfig
