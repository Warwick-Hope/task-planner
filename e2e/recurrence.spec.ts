import { test, expect } from '@playwright/test'
import { buildRrule, firstOccurrence, nextOccurrence } from '../lib/recurrence'

/**
 * Pure-logic specs — no page, no network. They live here because Playwright is
 * the only runner this repository has (PLAN.md §Verification).
 *
 * What they guard is a day-vs-moment mistake that has now been made twice, in
 * mirror image: `nextOccurrence` compared against the middle of the completed
 * day and could return that same day, and `firstOccurrence` asked from the
 * middle of fromDate and so skipped an occurrence falling on fromDate itself
 * (KB.md #49, #56). Both were found by reading rather than by running, which is
 * why they are pinned to fixed dates here.
 *
 * 2026-09-21 is a Monday.
 */

const MONDAY  = '2026-09-21'
const TUESDAY = '2026-09-22'

test.describe('firstOccurrence', () => {
  test('a daily rule starting today offers today, not tomorrow', () => {
    const rule = buildRrule({ frequency: 'daily', interval: 1 })
    expect(firstOccurrence(rule, MONDAY)).toBe(MONDAY)
  })

  test('a weekly rule on its own weekday offers today, not next week', () => {
    const rule = buildRrule({ frequency: 'weekly', interval: 1, weekdays: [0] })
    expect(firstOccurrence(rule, MONDAY)).toBe(MONDAY)
  })

  test('a weekly rule on another weekday offers the next one', () => {
    const rule = buildRrule({ frequency: 'weekly', interval: 1, weekdays: [0] })
    expect(firstOccurrence(rule, TUESDAY)).toBe('2026-09-28')
  })

  test('a monthly rule on the day it falls offers that day', () => {
    const rule = buildRrule({ frequency: 'monthly', interval: 1 })
    expect(firstOccurrence(rule, '2026-09-01')).toBe('2026-09-01')
  })

  // A rule that arrived through the API rather than the form carries no
  // DTSTART, so rrule times its occurrences from the clock at parse time. That
  // is the shape that made the bug look intermittent — it only missed the day
  // before midday — so it is asserted separately rather than assumed.
  test('a bare RRULE with no DTSTART behaves the same', () => {
    expect(firstOccurrence('RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO', MONDAY)).toBe(MONDAY)
  })

  test('a rule that has already ended returns null', () => {
    const rule = buildRrule({
      frequency: 'weekly', interval: 1, weekdays: [0], endDate: '2026-01-01',
    })
    expect(firstOccurrence(rule, MONDAY)).toBeNull()
  })

  test('an unparseable rule returns null rather than throwing', () => {
    expect(firstOccurrence('not an rrule', MONDAY)).toBeNull()
  })
})

test.describe('nextOccurrence', () => {
  // The other half of KB.md #49: completing a weekly task on its own weekday
  // must not hand back the day just completed.
  test('completing on the occurrence day advances to the next one', () => {
    const rule = buildRrule({ frequency: 'weekly', interval: 1, weekdays: [0] })
    expect(nextOccurrence(rule, MONDAY)).toBe('2026-09-28')
  })

  test('completing a daily task advances one day', () => {
    const rule = buildRrule({ frequency: 'daily', interval: 1 })
    expect(nextOccurrence(rule, MONDAY)).toBe(TUESDAY)
  })
})
