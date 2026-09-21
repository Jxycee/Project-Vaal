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
});
