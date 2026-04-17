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
