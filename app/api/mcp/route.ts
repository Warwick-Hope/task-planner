import { NextResponse } from 'next/server'
import { requireCaller, type Caller } from '@/lib/api-auth'
import { findTool, toolListing, type ToolOutcome } from '@/lib/mcp-tools'

/**
 * The Clarity MCP server (Phase 4.10).
 *
 * One endpoint, speaking JSON-RPC 2.0 over POST — the "streamable HTTP"
 * transport, minus the parts we do not need. It is written by hand rather than
 * with the MCP SDK, and that is a decision worth stating: the SDK's HTTP
 * transport wants a Node request and response pair to write a stream into, and a
 * Next.js route handler has a Web `Request` and returns a `Response`. Bridging
 * those two costs more code than the protocol we actually use, which is four
 * methods and no streaming.
 *
 * **Stateless.** No session id is issued, so nothing is held between calls and a
 * cold Vercel instance is not a broken connection. Every request carries its own
 * credential and resolves its own caller.
 *
 * **Scope is checked per tool** (KB.md #45's default applied one level down):
 * reaching this endpoint needs `tasks:read`, and a tool that writes needs
 * `tasks:write` on top. A read-only token therefore gets a useful connector
 * rather than a 403 at the door.
 *
 * **What 4.11 adds, and where.** OAuth becomes a third way for `requireCaller`
 * to produce a `Caller`; nothing in this file or in `lib/mcp-tools.ts` changes,
 * except that a 401 from here will want a `WWW-Authenticate` header pointing at
 * the protected-resource metadata (KB.md #46).
 */

/**
 * The protocol revision this server implements. A client asking for a different
 * one is answered with ours rather than refused — the negotiation exists so both
 * ends can find out, and every method used here is stable across these
 * revisions.
 */
const PROTOCOL_VERSION = '2025-06-18'

const SERVER_INFO = {
  name: 'clarity',
  title: 'Clarity',
  // The app is not versioned; the phase that shipped the connector is the only
  // number that would mean anything to somebody reading a client's log.
  version: '4.10',
}

/** JSON-RPC error codes, from the spec. */
const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const INTERNAL_ERROR = -32603

type JsonRpcId = string | number | null

interface JsonRpcRequest {
  jsonrpc: string
  id?: JsonRpcId
  method: string
  params?: Record<string, unknown>
}

const result = (id: JsonRpcId, value: unknown) => ({ jsonrpc: '2.0', id, result: value })

const failure = (id: JsonRpcId, code: number, message: string) => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
})

/**
 * A tool refusal is a *result*, not a JSON-RPC error.
 *
 * The distinction is the whole reason a model can recover: a protocol error says
 * the call was malformed and stops the conversation, while `isError` on a result
 * hands the model a sentence it can read and act on — "which workspace?", "that
 * token cannot write". Statuses live in the text because the model has no use
 * for the number and every use for the reason.
 */
function toolResult(outcome: ToolOutcome) {
  if (!outcome.ok) {
    return {
      content: [{ type: 'text', text: outcome.error }],
      isError: true,
    }
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(outcome.data, null, 2) }],
  }
}

async function callTool(
  params: Record<string, unknown> | undefined,
  caller: Caller
): Promise<unknown> {
  const name = typeof params?.name === 'string' ? params.name : ''
  const tool = findTool(name)

  if (!tool) {
    return {
      content: [{ type: 'text', text: `No such tool: ${name || '(none given)'}` }],
      isError: true,
    }
  }

  if (!caller.scopes.includes(tool.scope)) {
    return {
      content: [
        {
          type: 'text',
          text: `This credential does not hold the ${tool.scope} scope, which ${tool.name} needs.`,
        },
      ],
      isError: true,
    }
  }

  const args =
    typeof params?.arguments === 'object' && params.arguments !== null && !Array.isArray(params.arguments)
      ? (params.arguments as Record<string, unknown>)
      : {}

  try {
    return toolResult(await tool.handler(args, { caller }))
  } catch (err) {
    // A thrown handler is a bug here, not a bad call — but the model still needs
    // an answer, and the log still needs the stack.
    const message = err instanceof Error ? err.message : String(err)
    console.error(`MCP tool ${tool.name} threw:`, message)
    return {
      content: [{ type: 'text', text: `${tool.name} failed: ${message}` }],
      isError: true,
    }
  }
}

/** Answers one JSON-RPC message. Returns null for a notification. */
async function handle(message: JsonRpcRequest, caller: Caller): Promise<unknown | null> {
  const id = message.id ?? null
  const isNotification = message.id === undefined

  switch (message.method) {
    case 'initialize':
      return result(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      })

    // The client telling us it is ready, and pings we have nothing to say about.
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null

    case 'ping':
      return result(id, {})

    case 'tools/list':
      return result(id, { tools: toolListing() })

    case 'tools/call':
      return result(id, await callTool(message.params, caller))

    // Declared in no capability, so a well-behaved client will not ask — but
    // answering an empty list beats an error for one that does anyway.
    case 'resources/list':
      return result(id, { resources: [] })
    case 'prompts/list':
      return result(id, { prompts: [] })

    default:
      if (isNotification) return null
      return failure(id, METHOD_NOT_FOUND, `Unknown method: ${message.method}`)
  }
}

function isRequest(value: unknown): value is JsonRpcRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as JsonRpcRequest).method === 'string'
  )
}

export async function POST(request: Request) {
  // The endpoint's own gate. `tasks:read` is the floor — the tool then decides
  // whether this credential may write.
  const auth = await requireCaller(request, { scope: 'tasks:read' })
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(failure(null, PARSE_ERROR, 'Request body is not valid JSON'), {
      status: 400,
    })
  }

  // Batching left the protocol in the 2025-06-18 revision, but accepting an
  // array costs three lines and an older client sending one is not wrong.
  const messages = Array.isArray(body) ? body : [body]

  if (messages.length === 0 || !messages.every(isRequest)) {
    return NextResponse.json(
      failure(null, INVALID_REQUEST, 'Expected a JSON-RPC 2.0 request object'),
      { status: 400 }
    )
  }

  try {
    const answers = (await Promise.all(messages.map(m => handle(m, auth.caller)))).filter(
      (a): a is object => a !== null
    )

    // Everything was a notification: acknowledged, with nothing to say.
    if (answers.length === 0) return new NextResponse(null, { status: 202 })

    return NextResponse.json(Array.isArray(body) ? answers : answers[0])
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('MCP dispatch failed:', message)
    return NextResponse.json(failure(null, INTERNAL_ERROR, message), { status: 500 })
  }
}

/**
 * No server-initiated stream, so no GET.
 *
 * A client that wants one is told plainly instead of being left holding an open
 * request: 405 with `Allow` is what the transport specifies for a server that
 * only answers POSTs.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'This MCP endpoint accepts POST only — it opens no event stream.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}

/** Nothing is held between calls, so there is no session to delete. */
export async function DELETE() {
  return NextResponse.json(
    { error: 'This MCP endpoint is stateless — there is no session to end.' },
    { status: 405, headers: { Allow: 'POST' } }
  )
}
