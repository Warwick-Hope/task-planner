import { test, expect, type Locator, type Page } from '@playwright/test'
import { taskRow, deleteTaskRow, uniqueTitle } from './helpers'

/**
 * Task CRUD against the real dev workspace.
 *
 * Every task is created with a unique title so a failed run can be identified
 * and cleared, and each test removes what it created. Nothing here asserts on
 * pre-existing data — the workspace is real dev data, not a fixture.
 */

test('create a task, see it in the list, then delete it', async ({ page }) => {
  const title = uniqueTitle('create-and-delete')

  await page.goto('/tasks/new')
  await page.getByPlaceholder('What needs doing?').fill(title)
  await page.getByRole('button', { name: 'Create task' }).click()

  await expect(page).toHaveURL('/tasks')
  await expect(taskRow(page, title).first()).toBeVisible()

  await deleteTaskRow(page, title)
  await expect(taskRow(page, title)).toHaveCount(0)
})

test('a task can be edited and the change persists a reload', async ({ page }) => {
  const title = uniqueTitle('edit')
  const edited = `${title} (edited)`

  await page.goto('/tasks/new')
  await page.getByPlaceholder('What needs doing?').fill(title)
  await page.getByRole('button', { name: 'Create task' }).click()
  await expect(page).toHaveURL('/tasks')

  // exact: the row title is itself a link to the same edit page, so a substring
  // match on "Edit" resolves to two elements whenever a title contains that word.
  await taskRow(page, title).first().getByRole('link', { name: 'Edit task', exact: true }).click()
  await page.getByPlaceholder('What needs doing?').fill(edited)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL('/tasks')

  // Reload rather than trusting the client-side update — this is the assertion
  // that the change actually reached the database.
  await page.reload()
  await expect(taskRow(page, edited).first()).toBeVisible()

  await deleteTaskRow(page, edited)
  await expect(taskRow(page, edited)).toHaveCount(0)
})

test('the status indicator advances and the change persists', async ({ page }) => {
  const title = uniqueTitle('status-toggle')

  await page.goto('/tasks/new')
  await page.getByPlaceholder('What needs doing?').fill(title)
  await page.getByRole('button', { name: 'Create task' }).click()
  await expect(page).toHaveURL('/tasks')

  const row = taskRow(page, title).first()
  const indicator = row.getByTitle(/^Status:/)
  await expect(indicator).toHaveAttribute('title', /not_started/)

  // Clicking advances not_started -> wip, optimistically and then for real.
  // The optimistic half is why the PATCH has to be waited for explicitly: the
  // title says wip the instant the click lands, so a reload straight after it
  // can beat the write to the database and read back not_started. That is a
  // race in the test, not in the app, and it failed exactly that way once.
  const written = page.waitForResponse(
    (res) => res.request().method() === 'PATCH' && res.url().includes('/api/tasks/')
  )
  await indicator.click()
  await expect(row.getByTitle(/^Status:/)).toHaveAttribute('title', /wip/)
  expect((await written).ok(), 'the status PATCH failed').toBe(true)

  // The reload is the point: it proves the PATCH reached the database rather
  // than the row just updating in place.
  await page.reload()
  await expect(taskRow(page, title).first().getByTitle(/^Status:/)).toHaveAttribute('title', /wip/)

  await deleteTaskRow(page, title)
})

test('the list opens on Open, and a finished task is only behind All', async ({ page }) => {
  const title = uniqueTitle('open-filter')

  await page.goto('/tasks/new')
  await page.getByPlaceholder('What needs doing?').fill(title)
  await page.getByRole('button', { name: 'Create task' }).click()
  await expect(page).toHaveURL('/tasks')
  await expect(taskRow(page, title).first()).toBeVisible()

  // Two clicks is not_started -> wip -> done. Each PATCH is waited for because
  // the indicator updates optimistically, so the second click can otherwise
  // land before the first write has reached the database.
  const indicator = () =>
    taskRow(page, title)
      .first()
      .getByTitle(/^Status:/)
  for (const reached of ['wip', 'done']) {
    const written = page.waitForResponse(
      (res) => res.request().method() === 'PATCH' && res.url().includes('/api/tasks/')
    )
    await indicator().click()
    expect((await written).ok(), 'the status PATCH failed').toBe(true)
    if (reached === 'wip') {
      await expect(indicator()).toHaveAttribute('title', /wip/)
    }
  }

  // The default list is Open, so a done task leaves it.
  await page.reload()
  await expect(taskRow(page, title)).toHaveCount(0)

  // All brings it back, and says so in the URL — status=all is the one value
  // that has to be written out, since an absent parameter now means Open.
  const statusFilter = page.getByRole('group', { name: 'Status filter' })
  await statusFilter.getByRole('button', { name: 'All' }).click()
  await expect(page).toHaveURL(/status=all/)
  await expect(taskRow(page, title).first()).toBeVisible()

  await deleteTaskRow(page, title)
})

test('a top-level category can be put on a task, not just a subcategory', async ({ page }) => {
  const title = uniqueTitle('top-level-category')

  await page.goto('/tasks/new')
  await page.getByPlaceholder('What needs doing?').fill(title)

  // The top-level chips are the ones whose accessible name ends "(top level)".
  // The account always has at least one — onboarding requires a category.
  const topLevel = page.getByRole('button', { name: /\(top level\)$/ }).first()
  const name = ((await topLevel.textContent()) ?? '').trim()
  expect(name, 'the account has no top-level category to pick').not.toBe('')
  await topLevel.click()
  await expect(topLevel).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Create task' }).click()
  await expect(page).toHaveURL('/tasks')

  // The row carrying the parent's own name is the assertion that a top-level
  // id reached the database, not just the picker.
  await expect(taskRow(page, title).first()).toContainText(name)

  await deleteTaskRow(page, title)
})

/**
 * Completing a task from the three screens that used to only show it.
 *
 * The calendar and the plan board are the ones worth a test: their chips are
 * drag handles, and dnd-kit claims any pointerdown it can see — so a control
 * inside one picks the task up instead of advancing it unless the event is
 * stopped. That is a thing you cannot tell from a screenshot.
 */

/** The chip or row carrying this title, addressed by the status control in it. */
function taskWithStatusControl(page: Page, title: string): Locator {
  return page
    .locator('div')
    .filter({ has: page.getByText(title) })
    .filter({ has: page.getByRole('button', { name: /^Status:/ }) })
    .last()
}

/** Advances the control until the task is done, waiting for each write. */
async function completeFromControl(page: Page, title: string) {
  for (let step = 0; step < 3; step++) {
    const control = taskWithStatusControl(page, title).getByRole('button', { name: /^Status:/ })
    const name = (await control.getAttribute('aria-label')) ?? ''
    if (name.includes('done')) return
    const written = page.waitForResponse(
      (res) => res.request().method() === 'PATCH' && res.url().includes('/api/tasks/')
    )
    await control.click()
    expect((await written).ok(), 'the status PATCH failed').toBe(true)
  }
  throw new Error('the control never reached done')
}

/** YYYY-MM-DD, offset from today in local time. */
function dayOffset(days: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

for (const { screen, path, seed } of [
  { screen: 'the plan board', path: '/plan', seed: {} },
  { screen: 'the calendar', path: '/calendar', seed: {} },
  {
    screen: 'the needs-attention panel',
    path: '/tasks',
    seed: { horizon_precision: 'week', horizon_date: dayOffset(-14) },
  },
]) {
  test(`a task can be completed from ${screen}`, async ({ page, request }) => {
    const title = uniqueTitle(`complete-from-${path.slice(1)}`)
    const created = await request.post('/api/tasks', { data: { title, ...seed } })
    expect(created.status(), await created.text()).toBe(201)
    const { id } = await created.json()

    await page.goto(path)
    await expect(taskWithStatusControl(page, title)).toBeVisible()
    await completeFromControl(page, title)

    // Read it back rather than trusting the optimistic row.
    const after = await (await request.get(`/api/tasks/${id}`)).json()
    expect(after.task.status, `${screen} did not save the change`).toBe('done')

    await request.delete(`/api/tasks/${id}`)
  })
}
test('the API refuses a task with no title', async ({ request }) => {
  // Session cookies come from the shared storageState, so this exercises the
  // authenticated path rather than the 401 branch.
  const response = await request.post('/api/tasks', { data: { title: '   ' } })
  expect(response.status()).toBe(400)
  // Assert on the reason, not just the status: before onboarding was handled in
  // setup this passed for the wrong reason — 400 "No workspace found" rather
  // than anything to do with the title.
  expect((await response.json()).error).toMatch(/title/i)
})
