import { test, expect } from '@playwright/test';
import {
  allocateNodes,
  cleanupWithFreshPage,
  nodesNearStart,
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
    await cleanupWithFreshPage(browser);
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

  test('edits made while a save is in flight keep their draft', async ({ page }) => {
    // The save only carries the state at the moment it was sent. Clearing the
    // draft on success used to throw away anything allocated while it was in
    // flight (review 2026-09-26); the prompt must still offer it afterwards.
    await openTree(page);
    await allocateNodes(page, await twoNodes(page));
    await page.route('**/api/builds', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      await route.continue();
    });

    const panel = page.getByRole('button', { name: /^(Save build|Saved build)$/ });
    if (await panel.isVisible().catch(() => false)) await panel.click();
    await page.locator('#build-name').fill(testBuildName('in-flight'));
    await page.getByRole('button', { name: /^(Save|Update)$/ }).click();

    // While the save is held back, allocate more. Walk outward rather than
    // take the start's own neighbours: some class starts have only two, both
    // already taken above, which made `more` empty and the test vacuous —
    // nothing changed in flight, so clearing the draft was correct (2026-09-26).
    const taken = new Set((await treeState(page)).allocated);
    const more = (await nodesNearStart(page, 6)).filter((id) => !taken.has(id)).slice(0, 2);
    expect(more.length, 'no unallocated nodes near the start to add in flight').toBe(2);
    const before = (await treeState(page)).allocated.length;
    await allocateNodes(page, more);
    const after = (await treeState(page)).allocated.length;
    expect(after, 'the in-flight allocation did not change the tree').toBeGreaterThan(before);
    await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 30_000 });
    await page.unroute('**/api/builds');

    await page.reload();
    await waitForTreeApi(page);
    await expect(page.getByText(RESTORE)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect.poll(async () => (await treeState(page)).allocated.length).toBe(after);
  });

  test('a tampered draft restores to something that still saves', async ({ page }) => {
    // localStorage is not ours: a draft can hold what the write gate refuses —
    // a junk attribute choice, or an item whose craft is null. Restoring it
    // must clean both, or every later save fails with "Malformed ..." until
    // the user clears site data by hand.
    await openTree(page);
    const [a, b] = await twoNodes(page);
    await allocateNodes(page, [a, b]);
    await waitForDraft(page);
    await page.evaluate(
      ({ node }) => {
        const key = 'vaal:tree-draft:scratch';
        const draft = JSON.parse(localStorage.getItem(key)!);
        draft.tree.attributeChoices = { [node]: 'foo', '12': 7 };
        draft.gear.ring1 = { slug: 'amethyst-ring', name: 'Amethyst Ring', category: 'Ring', isUnique: false, iconUrl: null, craft: null };
        localStorage.setItem(key, JSON.stringify(draft));
      },
      { node: a },
    );

    await page.reload();
    await waitForTreeApi(page);
    await expect(page.getByText(RESTORE)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect.poll(async () => (await treeState(page)).allocated).toContain(b);
    expect((await treeState(page)).attributeChoices).toEqual({});

    await saveBuild(page, { name: testBuildName('tampered-draft') });
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

  test('/builds redirects to /login when signed out', async ({ page }) => {
    // Task 4 AMENDMENT (2026-09-22): the product decision reversed — "No user
    // that is signed out should even be able to see a public build" — so
    // /builds moved INTO PROTECTED_PREFIXES (src/proxy.ts). This test used to
    // assert the opposite (a real page inviting sign-in); it now asserts the
    // redirect, because the requirement changed, not because the old
    // behaviour was wrong at the time.
    await page.goto('/builds');
    await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
  });

  test('/builds/<any-token> redirects to /login when signed out', async ({ page }) => {
    // Same product decision, applied to the shared-build viewer specifically:
    // a signed-out visitor must never reach the read-only page for ANY
    // build, public or unlisted — the redirect happens at the proxy, before
    // the route ever checks whether the token resolves to anything.
    await page.goto('/builds/nonexistent-token-000000');
    await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
  });

  test('/tree redirects to login', async ({ page }) => {
    await page.goto('/tree');
    await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
  });
});

// The class chips reset the tree on a class CHANGE. Tapping the class that is
// already selected — the natural way to dismiss the panel — used to run the
// same reset, with no confirm, and the draft followed it at once
// (review 2026-09-26).
test('tapping the class that is already selected keeps the tree', async ({ page }) => {
  await openTree(page);
  const nodes = await page.evaluate(() => {
    const api = window.__vaalTree!;
    return api.neighbours(api.startNode()).slice(0, 2);
  });
  await allocateNodes(page, nodes);
  const { className, allocated } = await treeState(page);
  expect(allocated.length).toBeGreaterThan(0);

  // The collapsed chip names the class; opening it lists every class chip.
  await page.getByRole('button', { name: className, exact: true }).first().click();
  const classChips = page.getByRole('button', { name: className, exact: true });
  await expect(classChips).toHaveCount(2);
  await classChips.last().click();

  await expect.poll(async () => (await treeState(page)).allocated.length).toBe(allocated.length);
});
