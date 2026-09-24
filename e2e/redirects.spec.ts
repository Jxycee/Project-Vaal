import { expect, test } from '@playwright/test';
import { e2eBaseUrl } from './baseUrl';

// src/proxy.ts's two redirect rules, end to end:
//   signed out on a protected path -> /login?redirect=<path+search>
//   signed in on /login or /signup -> the validated redirect, else /dashboard
//
// The second rule once dropped `redirect` entirely, stranding a user on the
// dashboard after any transient auth miss (seen in sharing.spec.ts's cleanup,
// 2026-09-23). Its target is attacker-controlled, so the hostile cases read
// the raw Location header instead of following it: a redirect that leaves the
// origin must be caught, not followed.

const ORIGIN = new URL(e2eBaseUrl()).origin;

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a protected path keeps its full destination in ?redirect=', async ({ page }) => {
    await page.goto('/builds?tab=mine');
    await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/builds?tab=mine');
  });
});

test.describe('signed in, on an auth page', () => {
  test('goes to the redirect target, query string intact', async ({ page }) => {
    await page.goto(`/login?redirect=${encodeURIComponent('/builds?tab=mine')}`);
    await expect.poll(() => new URL(page.url()).pathname).toBe('/builds');
    expect(new URL(page.url()).search).toBe('?tab=mine');
  });

  test('works from /signup too', async ({ page }) => {
    await page.goto(`/signup?redirect=${encodeURIComponent('/builds')}`);
    await expect.poll(() => new URL(page.url()).pathname).toBe('/builds');
  });

  test('falls back to /dashboard with no redirect', async ({ page }) => {
    await page.goto('/login');
    await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');
  });

  test('never bounces back into an auth page', async ({ page }) => {
    await page.goto(`/login?redirect=${encodeURIComponent('/signup?x=1')}`);
    await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');
  });

  const hostile = [
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    '/\t/evil.example',
    'javascript:alert(1)',
    'evil.example',
  ];
  for (const target of hostile) {
    test(`never leaves the site for ${JSON.stringify(target)}`, async ({ page }, testInfo) => {
      const res = await page.request.get(`/login?redirect=${encodeURIComponent(target)}`, { maxRedirects: 0 });
      const location = res.headers()['location'] ?? '';
      await testInfo.attach('response', {
        body: JSON.stringify({ target, status: res.status(), location }, null, 2),
        contentType: 'application/json',
      });
      expect(res.status()).toBeGreaterThanOrEqual(300);
      expect(res.status()).toBeLessThan(400);
      // Resolved the way a browser would resolve it.
      const resolved = new URL(location, ORIGIN);
      expect(resolved.origin).toBe(ORIGIN);
      expect(resolved.pathname).toBe('/dashboard');
    });
  }
});
