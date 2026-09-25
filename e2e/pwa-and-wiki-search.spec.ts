import { expect, test } from '@playwright/test';

// Two small user-facing contracts that unit tests used to cover by restating
// constants: the PWA manifest (what a phone needs to install the app) and the
// wiki search's typo tolerance.

test.describe('PWA manifest', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('is served signed out and every icon it lists actually loads', async ({ page }, testInfo) => {
    const res = await page.request.get('/manifest.webmanifest');
    expect(res.ok()).toBe(true);
    const manifest = (await res.json()) as {
      name: string;
      start_url: string;
      display: string;
      icons: Array<{ src: string; sizes: string; purpose?: string }>;
    };
    await testInfo.attach('manifest', { body: JSON.stringify(manifest, null, 2), contentType: 'application/json' });

    expect(manifest.name).toBe('Project Vaal');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');

    // Installability needs a 192 and a 512 "any" icon, plus a 512 maskable one
    // for Android's adaptive launcher.
    const has = (sizes: string, purpose: string) =>
      manifest.icons.some((i) => i.sizes === sizes && (i.purpose ?? 'any') === purpose);
    expect(has('192x192', 'any')).toBe(true);
    expect(has('512x512', 'any')).toBe(true);
    expect(has('512x512', 'maskable')).toBe(true);

    // A manifest pointing at a missing file installs with a blank icon.
    for (const icon of manifest.icons) {
      const img = await page.request.get(icon.src);
      expect(img.status(), icon.src).toBe(200);
      expect(img.headers()['content-type'], icon.src).toContain('image/png');
    }
  });
});

test.describe('wiki search', () => {
  test('finds a skill despite a typo, and links to it', async ({ page }) => {
    await page.goto('/wiki');
    await page.getByLabel('Search the wiki').fill('ise nva');

    // Wait for the FILTERED results before looking for the link. WikiSearch
    // renders from useDeferredValue, so it paints once with the previous
    // (empty) query first — the unfiltered list, whose very first entry is the
    // Ice Nova skill. Waiting on that link alone was satisfied by the
    // unfiltered list before any search had run, which made this test pass or
    // fail depending on timing (2026-09-24: failed, then passed unchanged).
    // "Disengage" is this typo's top match and is not near the top of the
    // unfiltered list, so seeing it proves the search result is on screen.
    await expect(page.locator('a[href="/wiki/skills/disengage"]')).toBeVisible({ timeout: 30_000 });

    const result = page.locator('a[href="/wiki/skills/ice-nova"]');
    await expect(result).toBeVisible();
    await result.click();
    // 30s, not expect.poll's 5s default: the first visit to a route compiles it
    // on the dev server, and a soft navigation only updates the URL once that
    // route's payload arrives. The other navigation helpers allow 30s too.
    await page.waitForURL('**/wiki/skills/ice-nova', { timeout: 30_000 });
  });

  test('shows nothing for a query that matches nothing', async ({ page }) => {
    await page.goto('/wiki');
    await page.getByLabel('Search the wiki').fill('zzzzqqqxxj');
    // The recent-searches strip keeps its own links on screen whatever the
    // query, so assert the search's own empty state rather than a link count.
    await expect(page.getByText(/^No matches/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/^0 of \d+$/)).toBeVisible();
  });
});
