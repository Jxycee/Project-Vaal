import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const AUTH_FILE = path.join(__dirname, '.auth', 'user.json');

// Signs in once for the whole suite. Credentials come from .env.local (which is
// gitignored) and must never be written into a committed file.
//
// This account writes to the REAL production-linked Supabase project. Every
// spec that creates rows is responsible for deleting them again; see
// `cleanupTestBuilds` in helpers.ts.
setup('authenticate', async ({ page }) => {
  // Far above the per-test default: this step signs in AND warms every heavy
  // dev-mode compile (see the warm-up block below). It runs once per suite, so
  // spending its time here is the whole point — it keeps compile latency out
  // of the real assertions.
  setup.setTimeout(600_000);

  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  expect(
    email && password,
    'E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set in .env.local (gitignored). ' +
      'See the test-account entry in the project memory for the values.',
  ).toBeTruthy();

  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(email!);
  await page.getByPlaceholder('Your password').fill(password!);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // The app lands on /dashboard once the session cookie is set.
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });

  // ---- Warm the dev server --------------------------------------------------
  //
  // `next dev` compiles each route on its first request, and compiles queue
  // behind one another. /tree is heavy (pixi.js plus the tree toolkit), so an
  // API route first hit while /tree is still compiling waits behind it: the
  // first POST /api/builds of a run was measured at 35.3s — past every
  // assertion timeout — against 1.5s on a server where nothing else was
  // compiling. That surfaced as "the first test in each file fails", which
  // reads like an app regression and is nothing of the kind.
  //
  // Hitting every route here, once, before any spec runs moves that cost out
  // of the assertions entirely. None of these writes a row: the POST carries an
  // empty body and is rejected with 400 "Name is required" by validation that
  // runs before any database call.
  await page.goto('/tree');
  await page.waitForFunction(() => Boolean(window.__vaalTree), null, { timeout: 180_000 });
  await page.goto('/builds');

  const warm = await Promise.all([
    page.request.post('/api/builds', { data: {}, timeout: 180_000 }),
    page.request.get('/api/wiki/items?slot=head', { timeout: 180_000 }),
  ]);
  expect(warm[0].status(), 'warm-up POST /api/builds must be rejected, not written').toBe(400);
  expect(warm[1].status(), 'warm-up GET /api/wiki/items').toBe(200);
});
