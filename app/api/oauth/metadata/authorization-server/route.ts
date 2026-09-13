import { requestOrigin } from '@/lib/api'
import { authorizationServerMetadata } from '@/lib/oauth'

/**
 * Authorization server metadata, RFC 8414 (Phase 4.11).
 *
 * Served at `/.well-known/oauth-authorization-server` by a rewrite. It is what
 * turns "add this URL as a connector" into a working install: the client reads
 * where to send the user, where to exchange the code, and where to register
 * itself, rather than being told any of it by hand.
 */
export async function GET(request: Request) {
  return Response.json(authorizationServerMetadata(requestOrigin(request)), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
