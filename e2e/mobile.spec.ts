import { test, expect, type Page } from '@playwright/test'
import { taskRow, deleteTaskRow, uniqueTitle } from './helpers'

/**
 * The phone-viewport guard for Phase 4.1.
 *
 * It does not judge how the pages look — it checks the two things the mobile
 * pass was actually about and that a screenshot review would miss: nothing
 * sticks out past the side of the screen, and the controls that used to appear
 * only on hover are reachable without one. Runs only in the `mobile-chromium`
 * project, which uses a Pixel 5 viewport.
 */

/**
 * Elements wider than the viewport, ignoring anything inside a container that
 * scrolls sideways deliberately (the section nav, the week grid).
 *
 * Measured element by element rather than from documentElement.scrollWidth,
 * because body carries `overflow-x: clip` — which is exactly what stops a stray
 * wide child panning the page, and would also hide it from a scrollWidth check.
 */
async function overflowingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const offenders: string[] = []
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      if (r.right <= vw + 1 && r.left >= -1) return
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return
      }
      const cls = typeof el.className === 'string' ? el.className.slice(0, 60) : ''
      offenders.push(`${el.tagName.toLowerCase()}.${cls} (${Math.round(r.left)}–${Math.round(r.right)})`)
    })
    return offenders
  })
}

const PERSONAL_ROUTES = [
  '/dashboard',
  '/tasks',
  '/plan',
  '/calendar',
  '/brain-dump',
  '/roles',
  '/mission',
]

for (const route of PERSONAL_ROUTES) {
  test(`${route} fits the viewport and keeps the nav reachable`, async ({ page }) => {
    await page.goto(route)
    // The mobile-only copy of the section nav, under the header bar.
    await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible()

    const offenders = await overflowingElements(page)
    expect(offenders, `${route} has content past the edge of the screen`).toEqual([])
  })
}

test('task row actions are reachable without hovering', async ({ page }) => {
  const title = uniqueTitle('mobile-actions')

  await page.goto('/tasks/new')
  await page.getByPlaceholder('What needs doing?').fill(title)
  await page.getByRole('button', { name: 'Create task' }).click()
  await expect(page).toHaveURL('/tasks')

  // A touch screen never hovers, so these have to be visible already.
  const row = taskRow(page, title).first()
  await expect(row.getByRole('link', { name: 'Edit task' })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Delete task' })).toBeVisible()

  await deleteTaskRow(page, title)
  await expect(taskRow(page, title)).toHaveCount(0)
})
