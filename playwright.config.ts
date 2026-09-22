import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { e2eBaseUrl, e2ePort } from './e2e/baseUrl';

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

// Read after loadEnvLocal(), which is why e2e/baseUrl.ts exports functions
// rather than constants: helpers.ts imports the same two so the cleanup context
// it builds by hand cannot drift from the server this config starts.
const PORT = e2ePort();
const BASE_URL = e2eBaseUrl();

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
      // It runs everything except the desktop-only geometry spec.
      name: 'mobile',
      testIgnore: /desktop-layout\.spec\.ts/,
      use: { ...devices['Pixel 7'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      // Deliberately narrow. This project used to re-run every spec at 1280px,
      // which cost roughly seventeen extra full /tree loads — each one a 5.1MB
      // GGG export fetched and parsed — to exercise five `md:` utilities that
      // none of those specs assert anything about. Their subject is server
      // state, not pixels, so the second pass re-proved the first one's result.
      //
      // The genuinely desktop-only behaviour (the sidebar, and the canvas
      // offset that has to match its width) is now measured directly, in one
      // spec, at a cost of one tree load. If a desktop-specific branch appears
      // somewhere else, add a check there rather than widening this back out.
      name: 'desktop',
      testMatch: /desktop-layout\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],

  // Starts the dev server from THIS directory, which is the fix for a trap that
  // has produced false results repeatedly here: a server left running by
  // something else (or started from another checkout) silently serves different
  // code, and nothing warns you. So reuse is OFF by default, and a full run
  // always pays a cold compile.
  //
  // E2E_REUSE=1 opts into reusing whatever is already on the port, for tight
  // iteration against a dev server you are already running (Fast Refresh keeps
  // it current as you edit, so this is genuinely fast). Only use it with a
  // server you started from THIS directory, and never to judge a full run —
  // that is exactly how the trap above bites.
  webServer: {
    command: `npm run dev -- -p ${PORT} --webpack`,
    url: BASE_URL,
    reuseExistingServer: process.env.E2E_REUSE === '1',
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
