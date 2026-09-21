import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// .env.local is gitignored and holds the Supabase keys the dev server needs
// plus the e2e test account. Playwright does not read it the way Next does, and
// this repo has no dotenv dependency, so parse the handful of keys we need
// ourselves rather than adding one. Missing file is not fatal — the auth setup
// step reports a clear error instead.
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(path.join(__dirname, '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (!match) continue;
      const [, key, value] = match;
      if (process.env[key] === undefined) {
        process.env[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // Absent or unreadable; handled where the values are actually required.
  }
}
loadEnvLocal();

const PORT = Number(process.env.E2E_PORT ?? 3100);
export const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // These tests share one real Supabase account and create/delete rows in it,
  // so they must not run concurrently against each other.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],

  // Well above Playwright's 30s default, deliberately. Mounting the tree means
  // fetching a 5.1MB GGG export and running normalizeGggTree over it, against a
  // dev server that also compiles on first hit — and several of these tests
  // mount it three or four times while switching builds. The default timeout
  // fired mid-test and reported as "the hook never appeared", which reads like
  // an app fault rather than a budget one.
  timeout: 180_000,

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Signs in once and writes the session to disk; every other project reuses
    // it, so the suite pays for one login rather than one per test.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      // Mobile FIRST, deliberately: this app's users are console players on
      // phones, so a failure at 375px is a real failure, not a partial pass.
      name: 'mobile',
      use: { ...devices['Pixel 7'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],

  // Starts the dev server from THIS directory, which is the fix for a trap that
  // has produced false results repeatedly here: a server left running by
  // something else (or started from another checkout) silently serves different
  // code, and nothing warns you. reuseExistingServer is off outside CI-less
  // runs for exactly that reason.
  webServer: {
    command: `npm run dev -- -p ${PORT} --webpack`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
