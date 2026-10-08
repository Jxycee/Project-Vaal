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

  // "Offers to restore unsaved work after a reload, and restores it" is covered by
  // scratch-planner.spec.ts ("unsaved scratch work offers Restore after a reload").

  test('edits made while the first scratch save is in flight reach the new build page', async ({ page }) => {
    // The save only carries the state at the moment it was sent. Clearing the
    // draft on success used to throw away anything allocated while it was in
    // flight (review 2026-09-26), and slice 7b's first scratch save moves the
    // user to the new build's page, which reads drafts keyed by the NEW build:
    // the in-flight work must be handed over there, and offered as a Restore.
    await openTree(page);
    await allocateNodes(page, await twoNodes(page));

    // Hold the POST until the in-flight edits are made, then let it through
    // and keep its body so the saved checkpoint can be inspected.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let saved: { checkpoint: { passive_state: { set1: number[]; set2: number[] } } } | null = null;
    await page.route('**/api/builds', async (route) => {
      await gate;
      const response = await route.fetch();
      saved = await response.json();
      await route.fulfill({ response });
    });

    await page.locator('#build-name').fill(testBuildName('in-flight'));
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // While the save is held back, allocate more. Walk outward rather than
    // take the start's own neighbours: some class starts have only two, both
    // already taken above, which made `more` empty and the test vacuous —
    // nothing changed in flight, so clearing the draft was correct (2026-09-26).
    const taken = new Set((await treeState(page)).allocated);
    const more = (await nodesNearStart(page, 6)).filter((id) => !taken.has(id)).slice(0, 2);
    expect(more.length, 'no unallocated nodes near the start to add in flight').toBe(2);
    const before = (await treeState(page)).allocated.length;
    await allocateNodes(page, more);
    const after = (await treeState(page)).allocated;
    expect(after.length, 'the in-flight allocation did not change the tree').toBeGreaterThan(before);
    for (const id of more) expect(after).toContain(id);
    release();

    // The first scratch save replaces the URL with the new build's page, in
    // edit mode.
    await page.waitForURL(/\/builds\/[A-Za-z0-9_-]+.*[?&]edit=1/, { timeout: 30_000 });
    await page.unroute('**/api/builds');

    // The row holds only what was sent: none of the in-flight nodes.
    expect(saved, 'the held POST never completed').not.toBeNull();
    const row = saved!.checkpoint.passive_state;
    for (const id of more) {
      expect(row.set1, `in-flight node ${id} leaked into the saved build`).not.toContain(id);
      expect(row.set2).not.toContain(id);
    }

    // ...so they must be offered on the new page as a draft.
    await expect(page.getByTestId('draft-notice')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Restore' }).click();
    await waitForTreeApi(page);
    await expect.poll(async () => (await treeState(page)).allocated).toEqual(expect.arrayContaining(more));
    expect((await treeState(page)).allocated.length).toBe(after.length);
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

  // "A saved build reopened unchanged does NOT prompt" (the bogus-prompt
  // regression) is covered by build-page-edit.spec.ts "no bogus restore prompt"
  // and by scratch-planner.spec.ts (no prompt after the first save).
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
