import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Category } from '@/types'
import { getPersonalWorkspaceId } from '@/lib/workspace-server'
import { MAX_BRAIN_DUMP_CHARS, MAX_CAPTURES_PER_DAY } from '@/lib/limits'
import { buildHorizonFields, horizonFromAnchor } from '@/lib/horizon'
import type { Refusal } from '@/lib/api'

/**
 * The brain dump, as a helper rather than a route body.
 *
 * It moved here in Phase 4.10 because the MCP `capture` tool is the same
 * operation reached a different way, and the alternative was a second extractor
 * with its own prompt, its own validation and its own idea of what a horizon is
 * — the duplication KB.md #24 is about, in the one place where the drift would
 * be invisible until a task came out dated wrongly.
 *
 * Two things stay true whichever door the call came through:
 *
 * - **The model extracts; the server decides the dates.** It returns a
 *   precision and one date inside the period, and `lib/horizon.ts` builds the
 *   seven columns (KB.md #22, #23).
 * - **One quota, shared.** The count is consumed here, so the textarea and the
 *   tool draw on the same daily budget instead of one each.
 */

export type ParsedHorizonPrecision =
  | 'unplanned' | 'year' | 'quarter' | 'month' | 'week' | 'day'

export interface ParsedTask {
  title: string
  notes: string
  category_id: string | null
  horizon_precision: ParsedHorizonPrecision
  horizon_year: number | null
  horizon_quarter: number | null
  horizon_month: number | null
  horizon_week: string | null   // ISO date of Monday
  horizon_day: string | null    // ISO date YYYY-MM-DD
}

/**
 * What the model is asked to return. Deliberately smaller than ParsedTask:
 * the model picks a precision and one anchor date, and the server does every
 * piece of calendar arithmetic. Asking a model to keep year/quarter/month/week
 * mutually consistent is the part it gets wrong, and it is trivial in code.
 */
interface ModelTask {
  title?: unknown
  notes?: unknown
  category_id?: unknown
  horizon_precision?: unknown
  horizon_date?: unknown
}

/** How many of today's calls this user has used, and out of what. */
export interface CaptureQuota {
  used: number
  quota: number
}

export type ExtractResult =
  | { ok: true; tasks: ParsedTask[]; quota: CaptureQuota }
  | Refusal

export type SaveResult =
  | { ok: true; tasks: { id: string; title: string }[] }
  | Refusal

const PRECISIONS: ParsedHorizonPrecision[] =
  ['unplanned', 'year', 'quarter', 'month', 'week', 'day']

/** True only for a real calendar date in YYYY-MM-DD form. */
function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(value + 'T12:00:00')
  return !isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

/**
 * Claims one of today's calls, atomically.
 *
 * The count and the decision happen in one statement inside
 * `consume_capture_quota`, so two calls arriving together cannot both read
 * "19 used" and both proceed. A caller cannot raise its own limit either: the
 * table has no write policy at all, and the function is security definer.
 */
async function consumeQuota(
  supabase: SupabaseClient
): Promise<{ ok: true; quota: CaptureQuota } | Refusal> {
  const { data, error } = await supabase.rpc('consume_capture_quota', {
    p_limit: MAX_CAPTURES_PER_DAY,
  })

  const row = (data as { allowed: boolean; used: number; quota: number }[] | null)?.[0]

  if (error || !row) {
    if (error) console.error('Capture quota check failed:', error.message)
    return { ok: false, status: 500, error: 'Could not check the daily capture limit' }
  }

  if (!row.allowed) {
    // 429 rather than 403: it is a rate limit, and the difference is what tells a
    // calling model to stop for now rather than to stop for good.
    return {
      ok: false,
      status: 429,
      error: `Daily capture limit reached — ${row.used} of ${row.quota} used. It resets at midnight UTC.`,
    }
  }

  return { ok: true, quota: { used: row.used, quota: row.quota } }
}

/**
 * Free text in, structured tasks out. Nothing is written here — the app shows
 * the result for review first, and the `capture` tool saves it immediately
 * afterwards.
 */
export async function extractTasks(
  supabase: SupabaseClient,
  userId: string,
  text: unknown
): Promise<ExtractResult> {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, status: 400, error: 'No text provided' }
  }

  if (text.length > MAX_BRAIN_DUMP_CHARS) {
    return {
      ok: false,
      status: 413,
      error: `Brain dump is too long — ${text.length.toLocaleString()} characters, limit is ${MAX_BRAIN_DUMP_CHARS.toLocaleString()}. Split it into a couple of dumps.`,
    }
  }

  // The quota is claimed before the model call, because the model call is the
  // thing it exists to limit. A dump that then fails to parse has still cost
  // what it cost.
  const quota = await consumeQuota(supabase)
  if (!quota.ok) return quota

  // Fetch user's categories to pass as context
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, parent_id')
    .eq('owner_id', userId)
    .order('sort_order', { ascending: true })

  const categoryList = (categories ?? []) as Pick<Category, 'id' | 'name' | 'parent_id'>[]
  const anthropic = new Anthropic()

  const today = new Date().toISOString().split('T')[0]

  const systemPrompt = `You are a task extraction assistant for a personal planning app.

Today's date is ${today}.

The user has these categories (use the exact id values):
${categoryList.length > 0
  ? categoryList.map(c => `- id: "${c.id}", name: "${c.name}"${c.parent_id ? ' (subcategory)' : ' (top-level)'}`).join('\n')
  : '(no categories set up yet)'}

Extract every distinct task or action item from the user's text. For each task return four fields:

- "title": short, clear, actionable, verb-first where possible (e.g. "Book dentist appointment")
- "notes": any supporting context, kept brief. Use "" if there is none.
- "category_id": one of the exact ids above if the task clearly fits, otherwise null
- "horizon_precision": how precisely the text pins the timing — one of
  "day", "week", "month", "quarter", "year", or "unplanned" when no timing is mentioned
- "horizon_date": any date that falls inside that period, as YYYY-MM-DD, or null when unplanned

You do not need to calculate week starts, quarter numbers, or month numbers — give the
precision and one date inside the period, and the app works out the rest.

Examples of the timing fields:
- "tomorrow"            -> precision "day",     date = tomorrow's date
- "Friday"              -> precision "day",     date = the next Friday
- "this week"           -> precision "week",    date = any date in this week
- "by end of the month" -> precision "month",   date = any date in this month
- "next quarter"        -> precision "quarter", date = any date in that quarter
- "at some point next year" -> precision "year", date = any date in that year
- no timing mentioned   -> precision "unplanned", date = null

Return ONLY a valid JSON array. No markdown, no explanation, no code fences. Example shape:
[
  {
    "title": "Book dentist appointment",
    "notes": "Been putting this off — need a check-up",
    "category_id": null,
    "horizon_precision": "month",
    "horizon_date": "${today}"
  }
]`

  let parsed: ModelTask[]
  try {
    // Haiku is the right tier here: this is extraction and classification, not
    // reasoning, and all the calendar arithmetic happens server-side.
    //
    // A full-length dump extracts dozens of tasks. 2048 truncated the array
    // mid-string ("Unterminated string in JSON"); 16000 covers the worst case a
    // 10,000-char dump can produce and stays under the non-streaming HTTP timeout.
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 16000,
      messages: [
        {
          role: 'user',
          content: text.trim(),
        },
      ],
      system: systemPrompt,
      metadata: { user_id: userId },
    })

    // Truncation would otherwise surface as an unintelligible JSON parse error
    if (message.stop_reason === 'max_tokens') {
      return {
        ok: false,
        status: 422,
        error:
          'That dump produced more tasks than one pass can return. Split it into two smaller dumps.',
      }
    }

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // Strip markdown code fences if Claude wrapped the JSON despite instructions
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

    parsed = JSON.parse(jsonStr)

    if (!Array.isArray(parsed)) throw new Error('Response was not an array')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Brain dump parse error:', msg)
    return { ok: false, status: 500, error: msg }
  }

  // Validate everything the model returned, then derive the horizon fields here.
  // An unrecognised precision or a malformed date falls back to unplanned rather
  // than writing a half-set of horizon columns.
  const validIds = new Set(categoryList.map(c => c.id))

  const sanitised: ParsedTask[] = parsed.map(t => {
    const precision: ParsedHorizonPrecision =
      PRECISIONS.includes(t.horizon_precision as ParsedHorizonPrecision)
        ? (t.horizon_precision as ParsedHorizonPrecision)
        : 'unplanned'

    const anchor = isIsoDate(t.horizon_date) ? t.horizon_date : null
    const resolved: ParsedHorizonPrecision = anchor ? precision : 'unplanned'
    const horizon = horizonFromAnchor(resolved, anchor)

    return {
      title: String(t.title ?? '').trim(),
      notes: String(t.notes ?? '').trim(),
      category_id:
        typeof t.category_id === 'string' && validIds.has(t.category_id) ? t.category_id : null,
      horizon_precision: resolved,
      // The review panel edits these five, and half-year and time-slot are not
      // things the model is asked for — they are rebuilt on save either way.
      horizon_year: horizon.horizon_year,
      horizon_quarter: horizon.horizon_quarter,
      horizon_month: horizon.horizon_month,
      horizon_week: horizon.horizon_week,
      horizon_day: horizon.horizon_day,
    }
  }).filter(t => t.title.length > 0)

  return { ok: true, tasks: sanitised, quota: quota.quota }
}

/**
 * Writes reviewed tasks into the caller's personal workspace.
 *
 * The horizon columns are rebuilt from the precision here rather than trusted
 * from the request, because the review panel lets the precision be changed — and
 * a precision changed without its seven columns rebuilt is exactly the
 * inconsistency KB.md #22 exists to prevent.
 */
export async function saveParsedTasks(
  supabase: SupabaseClient,
  userId: string,
  tasks: ParsedTask[]
): Promise<SaveResult> {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { ok: false, status: 400, error: 'No tasks to save' }
  }

  const workspaceId = await getPersonalWorkspaceId(supabase, userId)
  if (!workspaceId) {
    return { ok: false, status: 400, error: 'No personal workspace found' }
  }

  const rows = tasks
    .filter(t => typeof t?.title === 'string' && t.title.trim().length > 0)
    .map(t => {
      const horizonFields = buildHorizonFields(t.horizon_precision, {
        year: t.horizon_year ?? undefined,
        quarter: (t.horizon_quarter as 1 | 2 | 3 | 4) ?? undefined,
        month: t.horizon_month ?? undefined,
        weekStr: t.horizon_week ?? undefined,
        dayStr: t.horizon_day ?? undefined,
      })

      return {
        workspace_id: workspaceId,
        created_by: userId,
        title: t.title.trim(),
        notes: t.notes?.trim() || null,
        status: 'not_started' as const,
        category_id: t.category_id ?? null,
        source: 'brain_dump' as const,
        ...horizonFields,
      }
    })

  if (rows.length === 0) {
    return { ok: false, status: 400, error: 'No tasks to save' }
  }

  const { data, error } = await supabase.from('tasks').insert(rows).select('id, title')
  if (error) return { ok: false, status: 500, error: error.message }

  return { ok: true, tasks: (data ?? []) as { id: string; title: string }[] }
}
