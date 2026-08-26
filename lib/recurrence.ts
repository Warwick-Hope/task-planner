import { RRule, Weekday } from 'rrule'

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurrenceOptions {
  frequency: Frequency
  interval: number          // every N days/weeks/months/years
  weekdays?: number[]       // 0=Mon…6=Sun, only for weekly
  endDate?: string | null   // YYYY-MM-DD
}

const FREQ_MAP: Record<Frequency, number> = {
  daily:   RRule.DAILY,
  weekly:  RRule.WEEKLY,
  monthly: RRule.MONTHLY,
  yearly:  RRule.YEARLY,
}

const RRULE_WEEKDAYS = [
  RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU,
]

/** Build an rrule string from structured options. */
export function buildRrule(opts: RecurrenceOptions): string {
  const byweekday = opts.frequency === 'weekly' && opts.weekdays?.length
    ? opts.weekdays.map(i => RRULE_WEEKDAYS[i])
    : undefined

  const rule = new RRule({
    freq:      FREQ_MAP[opts.frequency],
    interval:  opts.interval,
    byweekday,
    until:     opts.endDate ? new Date(opts.endDate + 'T00:00:00Z') : undefined,
    dtstart:   new Date(Date.UTC(2000, 0, 1)), // placeholder; adjusted at generation time
  })

  return rule.toString()
}

/** Parse an rrule string back into structured options. */
export function parseRrule(rruleStr: string): RecurrenceOptions | null {
  try {
    const rule = RRule.fromString(rruleStr)
    const opts = rule.origOptions

    const freqReverse: Record<number, Frequency> = {
      [RRule.DAILY]:   'daily',
      [RRule.WEEKLY]:  'weekly',
      [RRule.MONTHLY]: 'monthly',
      [RRule.YEARLY]:  'yearly',
    }
    const frequency = freqReverse[opts.freq as number] ?? 'daily'
    const interval  = (opts.interval as number) ?? 1

    const weekdays = Array.isArray(opts.byweekday)
      ? (opts.byweekday as Weekday[]).map(w => w.weekday)
      : []

    const until = opts.until as Date | undefined
    const endDate = until ? until.toISOString().split('T')[0] : null

    return { frequency, interval, weekdays, endDate }
  } catch {
    return null
  }
}

/**
 * Given an rrule string and the date a task was completed,
 * returns the next due date after completedDate, or null if no more occurrences.
 */
export function nextOccurrence(rruleStr: string, afterDate: string): string | null {
  try {
    const rule = RRule.fromString(rruleStr)

    /**
     * The end of that day, not the middle of it.
     *
     * A stored rule carries no DTSTART, so rrule takes the time of day from the
     * clock when the string is parsed — which meant this comparison was against
     * a moving target. Completing a weekly Monday task on its own Monday
     * returned *that* Monday whenever the parse happened after midday, so the
     * "next occurrence" was a duplicate of the one just finished, and whether it
     * happened depended on the time of day. Found by the Phase 4.10 e2e run,
     * where `complete_task` produced a task due the same day (KB.md #47).
     *
     * The unit of a recurrence here is a day, so the comparison has to be one.
     */
    const after = new Date(afterDate + 'T23:59:59.999Z')

    // Generate the next occurrence after the completed date
    const next = rule.after(after, false)
    if (!next) return null
    return next.toISOString().split('T')[0]
  } catch {
    return null
  }
}

/**
 * Returns the first occurrence of an rrule on or after fromDate.
 */
export function firstOccurrence(rruleStr: string, fromDate: string): string | null {
  try {
    const rule = RRule.fromString(rruleStr)
    const from = new Date(fromDate + 'T12:00:00Z')
    const next = rule.after(from, true) // true = inclusive (on or after)
    if (!next) return null
    return next.toISOString().split('T')[0]
  } catch {
    return null
  }
}

/** Human-readable summary of a recurrence rule. */
export function describeRrule(rruleStr: string): string {
  try {
    const rule = RRule.fromString(rruleStr)
    return rule.toText()
  } catch {
    return 'Repeats'
  }
}
