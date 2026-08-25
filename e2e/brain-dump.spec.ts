import { test, expect } from '@playwright/test'
import { MAX_BRAIN_DUMP_CHARS } from '../lib/limits'
import { taskRow, deleteTaskRow } from './helpers'

/**
 * The brain dump is the one route that calls a model, and model output varies
 * between runs — asserting on which tasks came back would produce a test that
 * fails for legitimate reasons and trains you to ignore the suite.
 *
 * So: the deterministic paths are exercised for real (they never reach
 * Anthropic), and the happy path is driven through a mocked route so the review
 * panel and the confirm-and-save flow are tested repeatably. The genuine
 * end-to-end call is tagged @live and excluded from the default run.
 */

test.describe('input limits (no model call)', () => {
  test('rejects a dump over the character cap', async ({ request }) => {
    const response = await request.post('/api/brain-dump', {
      data: { text: 'x'.repeat(MAX_BRAIN_DUMP_CHARS + 1) },
    })
    expect(response.status()).toBe(413)
    expect((await response.json()).error).toContain('too long')
  })

  test('accepts a dump exactly at the cap without a 413', async ({ request }) => {
    // Guards the boundary: `>` rather than `>=`. A model call does happen here,
    // so only the rejection is asserted — not the body.
    const response = await request.post('/api/brain-dump', {
      data: { text: 'a '.repeat(MAX_BRAIN_DUMP_CHARS / 2).slice(0, MAX_BRAIN_DUMP_CHARS) },
    })
    expect(response.status()).not.toBe(413)
  })

  test('rejects empty and non-string input', async ({ request }) => {
    expect((await request.post('/api/brain-dump', { data: { text: '   ' } })).status()).toBe(400)
    expect((await request.post('/api/brain-dump', { data: { text: 42 } })).status()).toBe(400)
    expect((await request.post('/api/brain-dump', { data: {} })).status()).toBe(400)
  })

  test('the textarea stops input at the cap', async ({ page }) => {
    await page.goto('/brain-dump')
    const box = page.getByPlaceholder(/Just write/)
    await box.fill('y'.repeat(MAX_BRAIN_DUMP_CHARS + 500))
    expect(await box.inputValue()).toHaveLength(MAX_BRAIN_DUMP_CHARS)
  })
})

test('review and save, with the model response stubbed', async ({ page }) => {
  const title = `[e2e] stubbed brain dump ${Date.now()}`

  await page.route('**/api/brain-dump', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tasks: [
          {
            title,
            notes: 'Created by the e2e suite',
            category_id: null,
            horizon_precision: 'unplanned',
            horizon_year: null,
            horizon_quarter: null,
            horizon_month: null,
            horizon_week: null,
            horizon_day: null,
          },
        ],
      }),
    })
  })

  await page.goto('/brain-dump')
  await page.getByPlaceholder(/Just write/).fill('anything — the response is stubbed')
  await page.getByRole('button', { name: /Extract tasks/ }).click()

  await expect(page.getByText(title)).toBeVisible()

  // Confirm-and-save is NOT stubbed: this writes a real row.
  await page.getByRole('button', { name: /^Save \d+ task/ }).click()
  await page.waitForURL(/\/tasks/)

  await expect(taskRow(page, title).first()).toBeVisible()

  await deleteTaskRow(page, title)
  await expect(taskRow(page, title)).toHaveCount(0)
})

test('@live real extraction reaches Anthropic and returns tasks', async ({ request }) => {
  test.skip(!process.env.E2E_LIVE, 'set E2E_LIVE=1 to spend real tokens on this')

  const response = await request.post('/api/brain-dump', {
    data: { text: 'Book the dentist tomorrow. Sort the car insurance before the 3rd.' },
    timeout: 60_000,
  })

  expect(response.status()).toBe(200)
  const { tasks } = await response.json()
  expect(Array.isArray(tasks)).toBe(true)
  expect(tasks.length).toBeGreaterThan(0)
  // Deliberately no assertion on titles or horizons — those legitimately vary.
})
