import { test, expect } from '@playwright/test'
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
