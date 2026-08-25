import type { Page, Locator } from '@playwright/test'

/**
 * Saved sessions written by auth.setup.ts. They live here rather than in the
 * setup file because Playwright forbids a spec from importing a setup file.
 */
export const OWNER_STATE = 'e2e/.auth/user.json'
export const INVITEE_STATE = 'e2e/.auth/user2.json'

/**
 * A task row in the list.
 *
 * Rows are plain divs carrying Tailwind's `group` marker — not list items, which
 * is what the first version of these specs assumed. If the markup changes this
 * fails loudly in one place rather than in every spec.
 */
export function taskRow(page: Page, title: string): Locator {
  return page.locator('div.group').filter({ hasText: title })
}

/**
 * Deletes a task through the UI's two-step confirm and waits for it to go.
 *
 * The ✕ carries an aria-label since the mobile pass — a bare glyph is no name
 * for a screen reader — so it is addressed by that, not by its text.
 */
export async function deleteTaskRow(page: Page, title: string): Promise<void> {
  const row = taskRow(page, title).first()
  await row.getByRole('button', { name: 'Delete task' }).click()
  await row.getByRole('button', { name: 'Delete' }).click()
  await taskRow(page, title).waitFor({ state: 'detached' }).catch(() => {})
}

/** Titles every test-created task so a failed run leaves findable litter. */
export function uniqueTitle(label: string): string {
  return `[e2e] ${label} ${Date.now()}`
}
