import { test } from '@playwright/test'

test('probe', async ({ page }) => {
  const res = await page.request.get('/api/workspaces')
  console.log('WORKSPACES', res.status(), await res.text())
})
