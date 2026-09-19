import { test, expect, type Locator, type Page } from '@playwright/test'
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

/**
 * Fields a phone browser would zoom the page for.
 *
 * Under 16px, focusing an input zooms in and never zooms back out — and the
 * zoomed viewport is what puts a row off the side of the screen. `globals.css`
 * lifts every field on small screens; this is the check that the rule still
 * wins, because for a while it did not and read as though it did (KB.md #59).
 */
async function smallFields(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const small: string[] = []
    document.querySelectorAll('input, select, textarea').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      const type = (el as HTMLInputElement).type
      if (type === 'checkbox' || type === 'radio' || type === 'hidden') return
      const size = parseFloat(getComputedStyle(el).fontSize)
      if (size >= 16) return
      const name = (el as HTMLInputElement).placeholder || el.getAttribute('aria-label') || type
      small.push(`${el.tagName.toLowerCase()} "${name}" at ${size}px`)
    })
    return small
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

    const small = await smallFields(page)
    expect(small, `${route} has fields a phone would zoom in on`).toEqual([])
  })
}

// The forms live behind their own routes, and a zoomed form is the worst case:
// the zoom happens on focus, which is the moment the layout has to hold.
for (const route of ['/tasks/new', '/brain-dump', '/roles', '/mission']) {
  test(`${route} has no field a phone would zoom in on`, async ({ page }) => {
    await page.goto(route)
    const small = await smallFields(page)
    expect(small, `${route} has fields a phone would zoom in on`).toEqual([])
  })
}

test('every section is reachable from the tab bar or its More sheet', async ({ page }) => {
  await page.goto('/dashboard')

  // The four daily sections are tabs; nothing is hidden off the side of a
  // scrolling strip, which is what this replaced.
  for (const label of ['Dashboard', 'Tasks', 'Plan', 'Calendar']) {
    await expect(page.getByRole('link', { name: label }).first()).toBeVisible()
  }

  // Scoped to the sheet: the dashboard's quick-access cards link to the same
  // places, so an unscoped lookup matches two elements.
  await page.getByRole('button', { name: 'More' }).click()
  const sheet = page.getByRole('dialog', { name: 'More sections' })
  for (const label of ['Brain dump', 'Categories', 'Mission']) {
    await expect(sheet.getByRole('link', { name: label })).toBeVisible()
  }

  // And it navigates, rather than merely rendering.
  await sheet.getByRole('link', { name: 'Brain dump' }).click()
  await expect(page).toHaveURL(/\/brain-dump/)
  await expect(sheet).toBeHidden()
})

/**
 * The meal library's add-ingredient form, which the route sweep above cannot
 * judge: the form only exists after a click, and each meal card carries
 * `overflow-hidden`, which the overflow helper treats as a deliberate clip and
 * skips.
 *
 * It also does not assert overflow, because that is not how this broke. Five
 * controls in one row do not run off the side — flexbox shrinks them instead,
 * to an ingredient field 90px wide. What ran off the side was the *zoomed*
 * page: a phone browser zooms in when it focuses an input whose font is under
 * 16px, and the row that just fitted no longer did. So the two things checked
 * here are the two that were actually wrong — a usable width, and a font that
 * does not trigger the zoom.
 */
test('the add-ingredient form is usable on a phone', async ({ page, request }) => {
  const created = await request.post('/api/household', {
    data: { name: `[e2e] meals ${Date.now()}` },
  })
  expect(created.ok(), `household create failed: ${created.status()}`).toBe(true)
  const { workspaceId } = await created.json()

  const mealName = '[e2e] Toad in the Hole'
  const meal = await request.post(`/api/household/${workspaceId}/meals`, {
    data: { name: mealName },
  })
  expect(meal.ok(), `meal create failed: ${meal.status()}`).toBe(true)

  await page.goto(`/household/${workspaceId}/meals/library`)
  await page.getByRole('button', { name: /Toad in the Hole/ }).click()
  await page.getByRole('button', { name: '+ Add ingredient' }).click()

  const ingredient = page.getByPlaceholder('Ingredient')
  await expect(ingredient).toBeVisible()

  const box = await ingredient.boundingBox()
  expect(box!.width, 'the ingredient field is too narrow to type a name into').toBeGreaterThan(
    200
  )

  const fontSize = await ingredient.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(fontSize, 'under 16px makes the phone zoom in when the field is focused').
    toBeGreaterThanOrEqual(16)

  // Every control on screen, and the form still saves.
  const width = page.viewportSize()!.width
  const controls: Array<[string, Locator]> = [
    ['Ingredient', ingredient],
    ['Qty', page.getByPlaceholder('Qty')],
    ['Unit', page.getByPlaceholder('Unit')],
    ['Add', page.getByRole('button', { name: 'Add', exact: true })],
    ['Cancel', page.getByRole('button', { name: 'Cancel adding ingredient' })],
  ]
  for (const [label, control] of controls) {
    await expect(control, `${label} is not on screen`).toBeVisible()
    const r = await control.boundingBox()
    expect(r!.x, `${label} starts off the left of the screen`).toBeGreaterThanOrEqual(-1)
    expect(r!.x + r!.width, `${label} runs past the right of the screen`).toBeLessThanOrEqual(
      width + 1
    )
  }

  await ingredient.fill('Sausages')
  await page.getByPlaceholder('Qty').fill('8')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText('Sausages')).toBeVisible()
})

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
