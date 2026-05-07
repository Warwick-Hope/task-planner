import type { Task } from '@/types'

export type HorizonPrecision = 'unplanned' | 'year' | 'half' | 'quarter' | 'month' | 'week' | 'day' | 'time'

export const HORIZON_PRECISION_LABELS: Record<HorizonPrecision, string> = {
  unplanned: 'Unplanned',
  year: 'Year',
  half: 'Half-year',
  quarter: 'Quarter',
  month: 'Month',
  week: 'Week',
  day: 'Day',
  time: 'Time',
}

export function monthToQuarter(month: number): 1 | 2 | 3 | 4 {
  if (month <= 3) return 1
  if (month <= 6) return 2
  if (month <= 9) return 3
  return 4
}

export function quarterToHalf(quarter: number): 1 | 2 {
  return quarter <= 2 ? 1 : 2
}

/** Returns the ISO date string (YYYY-MM-DD) of the Monday of the week containing the given date string. */
export function getMondayOfWeek(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date.toISOString().split('T')[0]
}

/** Derives the month number (1-12) from a date string. */
export function monthFromDate(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00').getMonth() + 1
}

/** Derives the full year from a date string. */
export function yearFromDate(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00').getFullYear()
}

export interface HorizonFields {
  horizon_year: number | null
  horizon_half: number | null
  horizon_quarter: number | null
  horizon_month: number | null
  horizon_week: string | null
  horizon_day: string | null
  horizon_time_slot: string | null
}

/**
 * Builds the full set of horizon fields from form state.
 * Coarser fields are always derived from the most precise field set —
 * this keeps the data consistent for filtering at any granularity.
 */
export function buildHorizonFields(
  precision: HorizonPrecision,
  opts: {
    year?: number
    half?: 1 | 2
    quarter?: 1 | 2 | 3 | 4
    month?: number
    weekStr?: string
    dayStr?: string
    timeStr?: string
  }
): HorizonFields {
  const empty: HorizonFields = {
    horizon_year: null,
    horizon_half: null,
    horizon_quarter: null,
    horizon_month: null,
    horizon_week: null,
    horizon_day: null,
    horizon_time_slot: null,
  }

  if (precision === 'unplanned') return empty

  if (precision === 'year') {
    return { ...empty, horizon_year: opts.year ?? null }
  }

  if (precision === 'half') {
    return {
      ...empty,
      horizon_year: opts.year ?? null,
      horizon_half: opts.half ?? null,
    }
  }

  if (precision === 'quarter') {
    const q = opts.quarter ?? 1
    return {
      ...empty,
      horizon_year: opts.year ?? null,
      horizon_half: quarterToHalf(q),
      horizon_quarter: q,
    }
  }

  if (precision === 'month') {
    const m = opts.month ?? 1
    const q = monthToQuarter(m)
    return {
      ...empty,
      horizon_year: opts.year ?? null,
      horizon_half: quarterToHalf(q),
      horizon_quarter: q,
      horizon_month: m,
    }
  }

  if (precision === 'week' && opts.weekStr) {
    const monday = getMondayOfWeek(opts.weekStr)
    const m = monthFromDate(monday)
    const q = monthToQuarter(m)
    return {
      ...empty,
      horizon_year: yearFromDate(monday),
      horizon_half: quarterToHalf(q),
      horizon_quarter: q,
      horizon_month: m,
      horizon_week: monday,
    }
  }

  if (precision === 'day' && opts.dayStr) {
    const m = monthFromDate(opts.dayStr)
    const q = monthToQuarter(m)
    const monday = getMondayOfWeek(opts.dayStr)
    return {
      ...empty,
      horizon_year: yearFromDate(opts.dayStr),
      horizon_half: quarterToHalf(q),
      horizon_quarter: q,
      horizon_month: m,
      horizon_week: monday,
      horizon_day: opts.dayStr,
    }
  }

  if (precision === 'time' && opts.timeStr) {
    const dayStr = opts.timeStr.split('T')[0]
    const m = monthFromDate(dayStr)
    const q = monthToQuarter(m)
    const monday = getMondayOfWeek(dayStr)
    return {
      ...empty,
      horizon_year: yearFromDate(dayStr),
      horizon_half: quarterToHalf(q),
      horizon_quarter: q,
      horizon_month: m,
      horizon_week: monday,
      horizon_day: dayStr,
      horizon_time_slot: new Date(opts.timeStr).toISOString(),
    }
  }

  return empty
}

export type HorizonReviewStatus = 'approaching' | 'overdue'

/**
 * Returns whether a task needs horizon review.
 *
 * 'overdue'    — the horizon period has already passed at the coarse precision set
 * 'approaching' — the horizon period is ending soon (no specific date set yet)
 * undefined    — no review needed (task has a specific day/time, or is unplanned)
 *
 * Only active tasks (not done/cancelled) should be passed in.
 */
export function getHorizonReviewStatus(
  task: Task,
  today: Date = new Date(),
): HorizonReviewStatus | undefined {
  // Already pinned to a specific date → no nudge needed
  if (task.horizon_day || task.horizon_time_slot) return undefined
  // Unplanned → no nudge needed
  if (!task.horizon_year) return undefined

  const todayYear  = today.getFullYear()
  const todayMonth = today.getMonth() + 1 // 1-based
  const todayDay   = today.getDate()

  // ── Week precision ────────────────────────────────────────────────────────
  if (task.horizon_week) {
    const monday  = new Date(task.horizon_week + 'T12:00:00')
    const sunday  = new Date(monday); sunday.setDate(monday.getDate() + 6)
    const wednesday = new Date(monday); wednesday.setDate(monday.getDate() + 2)
    // Strip time for day-level comparison
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const sunMidnight   = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate())
    const wedMidnight   = new Date(wednesday.getFullYear(), wednesday.getMonth(), wednesday.getDate())
    if (todayMidnight > sunMidnight)  return 'overdue'
    if (todayMidnight >= wedMidnight) return 'approaching'
    return undefined
  }

  // ── Month precision ───────────────────────────────────────────────────────
  if (task.horizon_month != null) {
    const ty = task.horizon_year, tm = task.horizon_month
    if (ty < todayYear || (ty === todayYear && tm < todayMonth)) return 'overdue'
    if (ty === todayYear && tm === todayMonth) {
      const lastDay = new Date(todayYear, todayMonth, 0).getDate()
      if (todayDay >= lastDay - 6) return 'approaching'
    }
    return undefined
  }

  // ── Quarter precision ─────────────────────────────────────────────────────
  if (task.horizon_quarter != null) {
    const ty = task.horizon_year, tq = task.horizon_quarter
    const todayQ = monthToQuarter(todayMonth)
    if (ty < todayYear || (ty === todayYear && tq < todayQ)) return 'overdue'
    if (ty === todayYear && tq === todayQ) {
      // Last month of quarter: Q1→3, Q2→6, Q3→9, Q4→12
      if (todayMonth === tq * 3) return 'approaching'
    }
    return undefined
  }

  // ── Half precision ────────────────────────────────────────────────────────
  if (task.horizon_half != null) {
    const ty = task.horizon_year, th = task.horizon_half
    const todayH = quarterToHalf(monthToQuarter(todayMonth))
    if (ty < todayYear || (ty === todayYear && th < todayH)) return 'overdue'
    if (ty === todayYear && th === todayH) {
      // Last month of half: H1→6, H2→12
      if (todayMonth === th * 6) return 'approaching'
    }
    return undefined
  }

  // ── Year precision ────────────────────────────────────────────────────────
  if (task.horizon_year != null) {
    const ty = task.horizon_year
    if (ty < todayYear) return 'overdue'
    if (ty === todayYear && monthToQuarter(todayMonth) === 4) return 'approaching'
    return undefined
  }

  return undefined
}

/**
 * Returns a sortable string key for a task's horizon.
 * Earlier horizons sort first; unplanned tasks sort last.
 */
export function horizonSortKey(task: Task): string {
  if (task.horizon_time_slot) return `a_${task.horizon_time_slot}`
  if (task.horizon_day) return `b_${task.horizon_day}`
  if (task.horizon_week) return `c_${task.horizon_week}`
  if (task.horizon_month != null && task.horizon_year != null) {
    return `d_${task.horizon_year}-${String(task.horizon_month).padStart(2, '0')}`
  }
  if (task.horizon_quarter != null && task.horizon_year != null) {
    return `e_${task.horizon_year}-Q${task.horizon_quarter}`
  }
  if (task.horizon_half != null && task.horizon_year != null) {
    return `f_${task.horizon_year}-H${task.horizon_half}`
  }
  if (task.horizon_year != null) return `g_${task.horizon_year}`
  return 'z_unplanned'
}

/** Returns a human-readable summary of a task's horizon. */
export function formatHorizon(task: Task): string {
  if (task.horizon_time_slot) {
    return new Date(task.horizon_time_slot).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  if (task.horizon_day) {
    return new Date(task.horizon_day + 'T12:00:00').toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  if (task.horizon_week) {
    const d = new Date(task.horizon_week + 'T12:00:00')
    return `w/c ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  }
  if (task.horizon_month != null && task.horizon_year != null) {
    const d = new Date(task.horizon_year, task.horizon_month - 1, 1)
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  if (task.horizon_quarter != null && task.horizon_year != null) {
    return `Q${task.horizon_quarter} ${task.horizon_year}`
  }
  if (task.horizon_half != null && task.horizon_year != null) {
    return `H${task.horizon_half} ${task.horizon_year}`
  }
  if (task.horizon_year != null) return `${task.horizon_year}`
  return 'Unplanned'
}
