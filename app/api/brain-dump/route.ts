import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Category } from '@/types'
import { unauthorised, parseJson, badBody } from '@/lib/api'
import { MAX_BRAIN_DUMP_CHARS } from '@/lib/limits'
import {
  buildHorizonFields,
  monthFromDate,
  yearFromDate,
  monthToQuarter,
} from '@/lib/horizon'

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

const PRECISIONS: ParsedHorizonPrecision[] =
  ['unplanned', 'year', 'quarter', 'month', 'week', 'day']

/** True only for a real calendar date in YYYY-MM-DD form. */
function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(value + 'T12:00:00')
  return !isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

/**
 * Derives the full horizon field set from a precision plus any date inside the
 * intended period — so "next month" only needs the model to name a date in it.
 */
function horizonFromAnchor(
  precision: ParsedHorizonPrecision,
  anchor: string | null
): Pick<ParsedTask, 'horizon_year' | 'horizon_quarter' | 'horizon_month' | 'horizon_week' | 'horizon_day'> {
  const blank = { horizon_year: null, horizon_quarter: null, horizon_month: null, horizon_week: null, horizon_day: null }
  if (precision === 'unplanned' || !anchor) return blank

  const year = yearFromDate(anchor)
  const month = monthFromDate(anchor)

  const fields =
    precision === 'year'    ? buildHorizonFields('year',    { year })
  : precision === 'quarter' ? buildHorizonFields('quarter', { year, quarter: monthToQuarter(month) })
  : precision === 'month'   ? buildHorizonFields('month',   { year, month })
  : precision === 'week'    ? buildHorizonFields('week',    { weekStr: anchor })
  : precision === 'day'     ? buildHorizonFields('day',     { dayStr: anchor })
  : null

  if (!fields) return blank

  return {
    horizon_year: fields.horizon_year,
    horizon_quarter: fields.horizon_quarter,
    horizon_month: fields.horizon_month,
    horizon_week: fields.horizon_week,
    horizon_day: fields.horizon_day,
  }
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const body = await parseJson<{ text?: unknown }>(request)
  if (!body) return badBody()

  const { text } = body
  if (typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }
  if (text.length > MAX_BRAIN_DUMP_CHARS) {
    return NextResponse.json(
      { error: `Brain dump is too long — ${text.length.toLocaleString()} characters, limit is ${MAX_BRAIN_DUMP_CHARS.toLocaleString()}. Split it into a couple of dumps.` },
      { status: 413 }
    )
  }

  // Fetch user's categories to pass as context
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, parent_id')
    .eq('owner_id', user.id)
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
      metadata: { user_id: user.id },
    })

    // Truncation would otherwise surface as an unintelligible JSON parse error
    if (message.stop_reason === 'max_tokens') {
      return NextResponse.json(
        { error: 'That dump produced more tasks than one pass can return. Split it into two smaller dumps.' },
        { status: 422 }
      )
    }

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // Strip markdown code fences if Claude wrapped the JSON despite instructions
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

    parsed = JSON.parse(jsonStr)

    if (!Array.isArray(parsed)) throw new Error('Response was not an array')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Brain dump parse error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
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

    return {
      title: String(t.title ?? '').trim(),
      notes: String(t.notes ?? '').trim(),
      category_id:
        typeof t.category_id === 'string' && validIds.has(t.category_id) ? t.category_id : null,
      horizon_precision: resolved,
      ...horizonFromAnchor(resolved, anchor),
    }
  }).filter(t => t.title.length > 0)

  return NextResponse.json({ tasks: sanitised })
}
