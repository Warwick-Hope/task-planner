import { requestOrigin } from '@/lib/api'
import { protectedResourceMetadata } from '@/lib/oauth'

/**
 * Protected-resource metadata, RFC 9728 (Phase 4.11).
 *
 * Served at `/.well-known/oauth-protected-resource` — and at that path with
 * `/api/mcp` appended, which is the form a client builds from the resource URL
 * itself. Both are rewrites in `next.config.mjs`; a folder beginning with a dot
 * is not a route in the App Router.
 *
 * This is the document a client fetches after a 401 tells it where to look. It
 * says only "this resource is protected, and here is who issues its tokens" —
 * the authorization server's own metadata is a separate document, so a client
 * that already has a token never reads it.
 */
export async function GET(request: Request) {
  return Response.json(protectedResourceMetadata(requestOrigin(request)), {
    headers: {
      // Public, and it changes about once a phase.
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
