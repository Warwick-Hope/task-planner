import { test, expect, type APIRequestContext, type Browser } from '@playwright/test'
import { uniqueTitle } from './helpers'
import { TOOLS } from '../lib/mcp-tools'

/**
 * The Claude connector (Phase 4.10).
 *
 * Everything here goes through `/api/mcp` as a client would, because the thing
 * worth testing is not that the helpers work — other specs cover that — but that
 * the protocol layer in front of them answers the way a client expects. A tool
 * that returns the right data inside the wrong envelope is invisible to every
 * other test in this suite and completely broken in Claude.
 *
 * `capture` is not exercised by default: it calls Anthropic and spends one of the
 * user's twenty daily captures. The @live test at the bottom does it for real.
 */

let nextId = 1

/** One JSON-RPC call, as a client makes it. */
async function rpc(
  api: APIRequestContext,
  method: string,
  params?: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await api.post('/api/mcp', {
    data: { jsonrpc: '2.0', id: nextId++, method, ...(params ? { params } : {}) },
  })
  const text = await response.text()
  return { status: response.status(), body: text ? JSON.parse(text) : {} }
}

interface ToolCallResult {
  content: { type: string; text: string }[]
  isError?: boolean
}

/** Calls a tool and hands back the envelope, error or not. */
async function callTool(
  api: APIRequestContext,
  name: string,
  args: Record<string, unknown> = {}
): Promise<ToolCallResult> {
  const { status, body } = await rpc(api, 'tools/call', { name, arguments: args })
  expect(status, `${name} should answer 200 even when it refuses`).toBe(200)
  expect(body.error, `${name} returned a protocol error: ${JSON.stringify(body.error)}`).toBeUndefined()
  return body.result as ToolCallResult
}

/** The parsed data from a tool that succeeded. */
async function toolData<T = Record<string, never>>(
  api: APIRequestContext,
  name: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const result = await callTool(api, name, args)
  expect(result.isError, `${name} failed: ${result.content?.[0]?.text}`).toBeFalsy()
  return JSON.parse(result.content[0].text) as T
}

interface Workspace {
  id: string
  name: string
  type: 'personal' | 'household'
  role: string
}

async function personalWorkspace(api: APIRequestContext): Promise<Workspace> {
  const { workspaces } = await toolData<{ workspaces: Workspace[] }>(api, 'list_workspaces')
  const personal = workspaces.find(w => w.type === 'personal')
  expect(personal, 'every user has a personal workspace').toBeTruthy()
  return personal!
}

/** A request context with no cookies, carrying only the bearer token. */
async function asToken(browser: Browser, token: string): Promise<APIRequestContext> {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  })
  return context.request
}

async function createToken(request: APIRequestContext, scopes: string[]): Promise<string> {
  const res = await request.post('/api/tokens', {
    data: { name: uniqueTitle('mcp token'), scopes, expiresInDays: 1 },
  })
  expect(res.status(), 'creating a token').toBe(201)
  return (await res.json()).token
}

test.describe('the transport', () => {
  test('a call with no credential is 401 JSON, not a login page', async ({ browser }) => {
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })

    const res = await anon.request.post('/api/mcp', {
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    })
    expect(res.status()).toBe(401)
    expect(res.headers()['content-type']).toContain('application/json')

    await anon.close()
  })

  test('GET is refused, because there is no event stream', async ({ request }) => {
    const res = await request.get('/api/mcp')
    expect(res.status()).toBe(405)
    expect(res.headers()['allow']).toBe('POST')
  })

  test('initialize names the protocol and the server', async ({ request }) => {
    const { body } = await rpc(request, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'e2e', version: '1' },
    })

    const result = body.result as {
      protocolVersion: string
      capabilities: { tools: unknown }
      serverInfo: { name: string }
    }
    expect(result.protocolVersion).toBe('2025-06-18')
    expect(result.capabilities.tools, 'tools must be advertised or nothing is callable').toBeTruthy()
    expect(result.serverInfo.name).toBe('clarity')
  })

  test('a notification is acknowledged with no body', async ({ request }) => {
    // No id, so there is nothing to answer — the client is not waiting.
    const res = await request.post('/api/mcp', {
      data: { jsonrpc: '2.0', method: 'notifications/initialized' },
    })
    expect(res.status()).toBe(202)
    expect(await res.text()).toBe('')
  })

  test('an unknown method is a protocol error; an unknown tool is not', async ({ request }) => {
    const { body } = await rpc(request, 'nonsense/method')
    expect((body.error as { code: number }).code, 'method not found').toBe(-32601)

    // A tool the model invented is its mistake to recover from, so it comes back
    // as a result it can read rather than an error that ends the exchange.
    const result = await callTool(request, 'delete_everything')
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No such tool')
  })

  test('a body that is not a request is refused with a code, not a crash', async ({ request }) => {
    // A Buffer, because a string given to Playwright as `data` is JSON-encoded —
    // and `"{ not json"` is perfectly valid JSON, which was worth finding out.
    const broken = await request.post('/api/mcp', {
      headers: { 'Content-Type': 'application/json' },
      data: Buffer.from('{ not json'),
    })
    expect(broken.status()).toBe(400)
    expect((await broken.json()).error.code, 'parse error').toBe(-32700)

    const notARequest = await request.post('/api/mcp', { data: { hello: 'world' } })
    expect(notARequest.status()).toBe(400)
    expect((await notARequest.json()).error.code, 'invalid request').toBe(-32600)
  })
})

test.describe('the tool surface', () => {
  test('tools/list is the seven tools, each with a schema', async ({ request }) => {
    const { body } = await rpc(request, 'tools/list')
    const { tools } = body.result as {
      tools: { name: string; description: string; inputSchema: { type: string } }[]
    }

    // Against the source rather than a hard-coded list: the point is that
    // everything defined is advertised, not that the number never changes.
    expect(tools.map(t => t.name).sort()).toEqual(TOOLS.map(t => t.name).sort())
    expect(tools).toHaveLength(7)

    for (const tool of tools) {
      expect(tool.description.length, `${tool.name} needs a description a model can use`)
        .toBeGreaterThan(40)
      expect(tool.inputSchema.type, `${tool.name} needs an object schema`).toBe('object')
    }
  })

  test('list_workspaces answers first, because everything else needs it', async ({ request }) => {
    const personal = await personalWorkspace(request)
    expect(personal.id).toBeTruthy()
    expect(personal.role, 'the caller owns their personal workspace').toBe('owner')
  })

  test('list_categories takes the workspace id and refuses a stranger', async ({ request }) => {
    const personal = await personalWorkspace(request)

    const { categories } = await toolData<{ categories: unknown[] }>(request, 'list_categories', {
      workspace_id: personal.id,
    })
    expect(Array.isArray(categories)).toBe(true)

    const missing = await callTool(request, 'list_categories', {
      workspace_id: '00000000-0000-0000-0000-000000000000',
    })
    expect(missing.isError).toBe(true)
  })

  test('create_tasks is plural, dates itself, and comes back with ids', async ({ request }) => {
    const personal = await personalWorkspace(request)
    const first = uniqueTitle('mcp one')
    const second = uniqueTitle('mcp two')

    const created = await toolData<{ created: number; tasks: { id: string; title: string }[] }>(
      request,
      'create_tasks',
      {
        workspace_id: personal.id,
        tasks: [
          { title: first, horizon_precision: 'day', horizon_date: '2026-09-01' },
          { title: second, notes: 'from the connector' },
        ],
      }
    )

    expect(created.created, 'both tasks in one round trip').toBe(2)
    const ids = created.tasks.map(t => t.id)

    // The horizon columns are the reason the tool takes a precision and a date
    // rather than seven fields: the server derives the rest (KB.md #22).
    const dated = await request.get(`/api/tasks/${ids[0]}`)
    const { task } = await dated.json()
    expect(task.horizon_day).toBe('2026-09-01')
    expect(task.horizon_week, 'the week is derived, not supplied').toBe('2026-08-31')
    expect(task.horizon_month).toBe(9)
    expect(task.horizon_quarter).toBe(3)
    expect(task.horizon_year).toBe(2026)

    // And the second one is genuinely unplanned rather than half-dated.
    const undated = await (await request.get(`/api/tasks/${ids[1]}`)).json()
    expect(undated.task.horizon_year).toBeNull()
    expect(undated.task.horizon_day).toBeNull()

    const listed = await toolData<{ tasks: { id: string }[] }>(request, 'list_tasks', {
      workspace_id: personal.id,
      day: '2026-09-01',
    })
    expect(listed.tasks.map(t => t.id)).toContain(ids[0])

    for (const id of ids) await request.delete(`/api/tasks/${id}`)
  })

  test('a task with no title is refused before anything is written', async ({ request }) => {
    const personal = await personalWorkspace(request)

    const result = await callTool(request, 'create_tasks', {
      workspace_id: personal.id,
      tasks: [{ title: uniqueTitle('valid') }, { notes: 'no title at all' }],
    })

    expect(result.isError).toBe(true)
    // The index matters: a batch of eight and a model needs to know which one.
    expect(result.content[0].text).toContain('tasks[1]')
  })

  test('a horizon precision with no date is refused, not half-applied', async ({ request }) => {
    const personal = await personalWorkspace(request)

    const result = await callTool(request, 'create_tasks', {
      workspace_id: personal.id,
      tasks: [{ title: uniqueTitle('no date'), horizon_precision: 'week' }],
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('horizon_date')
  })

  test('update_task changes only what it was given', async ({ request }) => {
    const personal = await personalWorkspace(request)
    const title = uniqueTitle('mcp update')

    const created = await toolData<{ tasks: { id: string }[] }>(request, 'create_tasks', {
      workspace_id: personal.id,
      tasks: [{ title, horizon_precision: 'month', horizon_date: '2026-10-15' }],
    })
    const id = created.tasks[0].id

    const updated = await toolData<{ task: { title: string; horizon_month: number } }>(
      request,
      'update_task',
      { task_id: id, notes: 'a note, and nothing else' }
    )

    expect(updated.task.title, 'the title was not touched').toBe(title)
    expect(updated.task.horizon_month, 'nor was the horizon').toBe(10)

    // Rescheduling is a precision and a date, and it rebuilds the whole set.
    const moved = await toolData<{ task: { horizon_day: string; horizon_month: number } }>(
      request,
      'update_task',
      { task_id: id, horizon_precision: 'day', horizon_date: '2026-11-03' }
    )
    expect(moved.task.horizon_day).toBe('2026-11-03')
    expect(moved.task.horizon_month).toBe(11)

    // "done" belongs to complete_task, because completing does more than set a
    // status — and a model that does not know that would silently stop
    // recurrences from advancing.
    const refused = await callTool(request, 'update_task', { task_id: id, status: 'done' })
    expect(refused.isError).toBe(true)
    expect(refused.content[0].text).toContain('complete_task')

    await request.delete(`/api/tasks/${id}`)
  })

  test('complete_task finishes a task and advances a recurring one', async ({ request }) => {
    const personal = await personalWorkspace(request)

    const plain = await toolData<{ tasks: { id: string }[] }>(request, 'create_tasks', {
      workspace_id: personal.id,
      tasks: [{ title: uniqueTitle('mcp complete') }],
    })
    const plainId = plain.tasks[0].id

    const done = await toolData<{ task: { status: string }; next_task_id: string | null }>(
      request,
      'complete_task',
      { task_id: plainId }
    )
    expect(done.task.status).toBe('done')
    expect(done.next_task_id, 'nothing to advance').toBeNull()

    // Completing twice is not an error — a model retrying should not be punished.
    const again = await toolData<{ task: { status: string } }>(request, 'complete_task', {
      task_id: plainId,
    })
    expect(again.task.status).toBe('done')

    // A recurring task is created through the API, since the tool surface
    // deliberately does not expose recurrence rules to a model.
    const recurringTitle = uniqueTitle('mcp weekly')
    const recurring = await request.post('/api/tasks', {
      data: {
        title: recurringTitle,
        due_date: '2026-09-07',
        is_recurring: true,
        recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO',
      },
    })
    expect(recurring.status()).toBe(201)
    const { id: recurringId } = await recurring.json()

    const advanced = await toolData<{ next_task_id: string | null }>(request, 'complete_task', {
      task_id: recurringId,
    })
    expect(advanced.next_task_id, 'completing a recurring task creates the next one').toBeTruthy()

    const next = await (await request.get(`/api/tasks/${advanced.next_task_id}`)).json()
    expect(next.task.title).toBe(recurringTitle)
    expect(next.task.due_date).toBe('2026-09-14')
    expect(next.task.status).toBe('not_started')
    // The follow-up is dated by lib/horizon.ts, not copied from the original.
    expect(next.task.horizon_day).toBe('2026-09-14')

    await request.delete(`/api/tasks/${plainId}`)
    await request.delete(`/api/tasks/${recurringId}`)
    await request.delete(`/api/tasks/${advanced.next_task_id}`)
  })
})

test.describe('credentials', () => {
  test('a bearer token reaches the connector and RLS still applies', async ({
    request,
    browser,
  }) => {
    const token = await createToken(request, ['tasks:read', 'tasks:write'])
    const api = await asToken(browser, token)

    const personal = await personalWorkspace(api)
    const title = uniqueTitle('mcp via token')

    const created = await toolData<{ tasks: { id: string }[] }>(api, 'create_tasks', {
      workspace_id: personal.id,
      tasks: [{ title }],
    })
    expect(created.tasks).toHaveLength(1)

    // A workspace this user is not in is not visible, whatever it is asked for.
    const stranger = await callTool(api, 'list_tasks', {
      workspace_id: '00000000-0000-0000-0000-000000000000',
    })
    expect(stranger.isError, 'a token is a user session, not a service key').toBe(true)

    await request.delete(`/api/tasks/${created.tasks[0].id}`)
  })

  test('a read-only token can list and cannot write', async ({ request, browser }) => {
    const token = await createToken(request, ['tasks:read'])
    const api = await asToken(browser, token)

    // The endpoint itself is reachable: scope is checked per tool, so a
    // read-only token gets a useful connector rather than a 403 at the door.
    const personal = await personalWorkspace(api)

    const refused = await callTool(api, 'create_tasks', {
      workspace_id: personal.id,
      tasks: [{ title: uniqueTitle('should never exist') }],
    })
    expect(refused.isError).toBe(true)
    expect(refused.content[0].text).toContain('tasks:write')
  })
})

test('@live capture extracts and saves through the connector', async ({ request }) => {
  test.skip(!process.env.E2E_LIVE, 'set E2E_LIVE=1 to spend a real capture on this')

  const result = await callTool(request, 'capture', {
    text: `${uniqueTitle('capture')} — book the dentist tomorrow, and sort the car insurance before the 3rd.`,
  })

  // A quota refusal is a legitimate outcome of a real run, and it is not a
  // failure of the connector — say which happened rather than going red.
  if (result.isError) {
    expect(result.content[0].text, 'the only acceptable refusal here').toContain('Daily capture limit')
    return
  }

  const data = JSON.parse(result.content[0].text) as {
    created: number
    tasks: { id: string }[]
    quota: { used: number; quota: number }
  }

  expect(data.created).toBeGreaterThan(0)
  expect(data.quota.used).toBeGreaterThan(0)
  // No assertion on the titles: model output legitimately varies.

  for (const task of data.tasks) await request.delete(`/api/tasks/${task.id}`)
})
