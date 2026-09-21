import { test, expect } from '@playwright/test';
import {
  allocateNodes,
  cleanupTestBuilds,
  openTree,
  saveBuild,
  testBuildName,
  treeState,
  waitForDraft,
  waitForTreeApi,
} from './helpers';

const RESTORE = /Unsaved changes from last time/;

async function twoNodes(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const api = window.__vaalTree!;
    return api.neighbours(api.startNode()).slice(0, 2);
  });
}

test.describe('draft restore', () => {
  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await cleanupTestBuilds(page);
    await page.close();
  });

  test('offers to restore unsaved work after a reload, and restores it', async ({ page }) => {
    await openTree(page);
    await allocateNodes(page, await twoNodes(page));
    const before = (await treeState(page)).allocated.length;
    expect(before).toBeGreaterThan(0);
    await waitForDraft(page);

    // Reload without saving — the draft safety net is the whole point.
    await page.reload();
    await waitForTreeApi(page);
    await expect(page.getByText(RESTORE)).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Restore' }).click();
    await expect.poll(async () => (await treeState(page)).allocated.length).toBe(before);
  });

  test('discard clears the draft and does not ask again', async ({ page }) => {
    await openTree(page);
    await allocateNodes(page, await twoNodes(page));
    await waitForDraft(page);

    await page.reload();
    await waitForTreeApi(page);
    await expect(page.getByText(RESTORE)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByText(RESTORE)).toBeHidden();

    await page.reload();
    await waitForTreeApi(page);
    await expect(page.getByText(RESTORE)).toBeHidden();
  });

  test('a saved build reopened unchanged does NOT prompt', async ({ page }) => {
    // The bogus-prompt regression. PassiveTree reports its freshly-seeded state
    // upward on mount, and the draft-save effect writes that straight to
    // localStorage — so without comparing the draft against the build, every
    // single visit to a saved build would offer to restore an "unsaved change"
    // that is really just an echo of what was loaded.
    await openTree(page);
    await allocateNodes(page, await twoNodes(page));
    await saveBuild(page, { name: testBuildName('no-prompt'), level: 12, league: 'Standard' });

    await page.reload();
    await waitForTreeApi(page);
    await expect(page.getByText(RESTORE)).toBeHidden();
  });
});

test.describe('auth gating', () => {
  // Signed-out: start from a context with no stored session.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('/builds is public and invites sign-in rather than redirecting', async ({ page }) => {
    // /builds is deliberately NOT in PROTECTED_PREFIXES — the public build
    // finder lands there later. A signed-out visitor must get a real page.
    const response = await page.goto('/builds');
    expect(response?.status()).toBeLessThan(400);
    expect(new URL(page.url()).pathname).toBe('/builds');
    await expect(page.getByText('Sign in to see your saved builds.')).toBeVisible();
    // Scoped to <main>: the signed-out header carries its own "Sign in" link,
    // so an unscoped role query matches two elements and fails strict mode.
    await expect(page.getByRole('main').getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('/tree redirects to login', async ({ page }) => {
    await page.goto('/tree');
    await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
  });
});
