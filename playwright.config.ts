import { defineConfig, devices } from '@playwright/test'
import fs from 'fs'
import path from 'path'

// Credentials live in .env.local (gitignored); in CI they come from the real
// environment instead, which is why nothing here is hard-coded. Parsed by hand
// rather than adding dotenv as a dependency for one file. Existing environment
// variables always win, so CI never has its values overwritten by a stray file.
function loadLocalEnv() {
  const file = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(file)) return
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(raw.trim())
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}
loadLocalEnv()

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  // One worker: every test signs in as the same account and writes to the same
  // dev workspace, so parallel runs would interfere with each other.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  // Every test drives a dev server that compiles routes on first hit and talks
  // to a hosted Supabase project, so timings vary a lot with connection quality —
  // the same spec has run in 7s locally and timed out at 30s over a slower link.
  // These are generous on purpose: a timeout here means "too slow to be useful",
  // not "wrong".
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    // Signs in once and writes the session to disk; every other project reuses it.
    // teardown runs after everything depending on setup has finished, and
    // sweeps up rows left behind by tests that failed before their cleanup.
    { name: 'setup', testMatch: /auth\.setup\.ts/, teardown: 'cleanup' },
    { name: 'cleanup', testMatch: /global\.teardown\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],

  // Starts the dev server unless one is already running, so `npm run test:e2e`
  // works from a cold start. Points at the dev Supabase project, never prod.
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
})
