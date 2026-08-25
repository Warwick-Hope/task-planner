import { test, expect } from '@playwright/test'

/**
 * Task CRUD against the real dev workspace.
 *
 * Every task is created with a unique title so a failed run can be identified
 * and cleared, and each test removes what it created. Nothing here asserts on
 * pre-existing data — the workspace is Warwick's real dev data, not a fixture.
 */
function uniqueTitle(label: string) {
  return `[e2e] ${label} ${Date.now()}`
}

test('create a task, see it in the list, then delete it', async ({ page }) => {
  const title = uniqueTitle('create-and-delete')

  await page.goto('/tasks/new')
  await page.getByPlaceholder('What needs doing?').fill(title)
  await page.getByRole('button', { name: 'Create task' }).click()

  // The form redirects back to the list on success.
  await expect(page).toHaveURL('/tasks')

  const row = page.locator('li', { hasText: title }).first()
  await expect(row).toBeVisible()

  // Delete is behind an inline confirm: ✕ reveals a Delete button.
  await row.getByRole('button', { name: '✕' }).click()
  await row.getByRole('button', { name: 'Delete' }).click()

  await expect(page.locator('li', { hasText: title })).toHaveCount(0)
})

test('a task can be edited and the change persists a reload', async ({ page }) => {
  const title = uniqueTitle('edit')
  const edited = `${title} (edited)`

  await page.goto('/tasks/new')
  await page.getByPlaceholder('What needs doing?').fill(title)
  await page.getByRole('button', { name: 'Create task' }).click()
  await expect(page).toHaveURL('/tasks')

  const row = page.locator('li', { hasText: title }).first()
  await row.getByRole('link', { name: 'Edit task' }).or(row.getByTitle('Edit task')).first().click()

  await page.getByPlaceholder('What needs doing?').fill(edited)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL('/tasks')

  // Reload rather than trusting the client-side update — this is the assertion
  // that the change actually reached the database.
  await page.reload()
  const editedRow = page.locator('li', { hasText: edited }).first()
  await expect(editedRow).toBeVisible()

  await editedRow.getByRole('button', { name: '✕' }).click()
  await editedRow.getByRole('button', { name: 'Delete' }).click()
  await expect(page.locator('li', { hasText: edited })).toHaveCount(0)
})

test('the API refuses a task with no title', async ({ request }) => {
  // Session cookies come from the shared storageState, so this exercises the
  // authenticated path rather than the 401 branch.
  const response = await request.post('/api/tasks', { data: { title: '   ' } })
  expect(response.status()).toBe(400)
})
