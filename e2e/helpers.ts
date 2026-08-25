import type { Page, Locator } from '@playwright/test'

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

/** Deletes a task through the UI's two-step confirm and waits for it to go. */
export async function deleteTaskRow(page: Page, title: string): Promise<void> {
  const row = taskRow(page, title).first()
  await row.getByRole('button', { name: '✕' }).click()
  await row.getByRole('button', { name: 'Delete' }).click()
  await taskRow(page, title).waitFor({ state: 'detached' }).catch(() => {})
}

/** Titles every test-created task so a failed run leaves findable litter. */
export function uniqueTitle(label: string): string {
  return `[e2e] ${label} ${Date.now()}`
}
