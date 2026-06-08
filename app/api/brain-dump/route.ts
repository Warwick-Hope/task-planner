import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Category } from '@/types'

export interface ParsedTask {
  title: string
  notes: string
  category_id: string | null
  horizon_precision: 'unplanned' | 'year' | 'quarter' | 'month' | 'week' | 'day'
  horizon_year: number | null
  horizon_quarter: number | null
  horizon_month: number | null
  horizon_week: string | null   // ISO date of Monday
  horizon_day: string | null    // ISO date YYYY-MM-DD
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  let body: { text: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { text } = body
  if (!text?.trim()) return NextResponse.json({ error: 'No text provided' }, { status: 400 })

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

Extract every distinct task or action item from the user's text. For each task:
- Write a short, clear, actionable title (verb-first where possible, e.g. "Book dentist appointment")
- Put any supporting context in notes (keep it brief)
- Match to one category id if the task clearly fits one; otherwise null
- Infer a horizon precision and date fields if the text mentions timing ("this week", "by end of month", "next year", "tomorrow", "Friday", etc.); otherwise use "unplanned"
- For week: return the ISO date of the Monday of that week
- For day: return the ISO date (YYYY-MM-DD)
- Derive horizon_year, horizon_quarter, horizon_month consistently with the most precise field set

Return ONLY a valid JSON array. No markdown, no explanation, no code fences. Example shape:
[
  {
    "title": "Book dentist appointment",
    "notes": "Been putting this off — need a check-up",
    "category_id": null,
    "horizon_precision": "month",
    "horizon_year": 2026,
    "horizon_quarter": 2,
    "horizon_month": 5,
    "horizon_week": null,
    "horizon_day": null
  }
]`

  let parsed: ParsedTask[]
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: text.trim(),
        },
      ],
      system: systemPrompt,
    })

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

  // Validate category_ids against real user categories
  const validIds = new Set(categoryList.map(c => c.id))
  const sanitised: ParsedTask[] = parsed.map(t => ({
    title: String(t.title ?? '').trim(),
    notes: String(t.notes ?? '').trim(),
    category_id: t.category_id && validIds.has(t.category_id) ? t.category_id : null,
    horizon_precision: t.horizon_precision ?? 'unplanned',
    horizon_year: t.horizon_year ?? null,
    horizon_quarter: t.horizon_quarter ?? null,
    horizon_month: t.horizon_month ?? null,
    horizon_week: t.horizon_week ?? null,
    horizon_day: t.horizon_day ?? null,
  })).filter(t => t.title.length > 0)

  return NextResponse.json({ tasks: sanitised })
}
