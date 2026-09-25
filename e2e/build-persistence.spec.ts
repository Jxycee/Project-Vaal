import { test, expect } from '@playwright/test';
import {
  allocateNodes,
  cleanupWithFreshPage,
  listedBuildNames,
  nodesNearStart,
  openTree,
  saveBuild,
  softNavigate,
  testBuildName,
  treeState,
} from './helpers';

// Regression cover for the data-loss bugs that took six fix rounds to stabilise
// during Task 1, and for the server-side migration that was supposed to make
// them structurally unreachable rather than merely defended against.
//
// The shared root cause: the /tree route component used to survive soft
// navigation, so its state could go stale relative to the URL, while
// PassiveTree consumes `initialState` as one-shot lazy state it never re-reads.
// Every test below therefore navigates via a real <Link> click. Using
// page.goto() would do a full reload, remount everything, and prove nothing.
//
// These write real rows to the production-linked Supabase project under the
// shared test account. Everything created is prefixed E2E- and deleted in
// afterAll.

test.afterAll(async ({ browser }) => {
  await cleanupWithFreshPage(browser);
});

test('saving twice from scratch updates one row instead of creating two', async ({ page }) => {
  const name = testBuildName('double-save');
  await openTree(page);
  await allocateNodes(page, await nodesNearStart(page, 3));

  await saveBuild(page, { name, level: 42, league: 'Standard' });
  // The second tap is the actual regression: it must update the row the first
  // tap created, not insert a duplicate.
  await saveBuild(page);

  const names = await listedBuildNames(page);
  expect(names.filter((n) => n === name)).toHaveLength(1);
});

test('switching between two builds shows the second one, not the first', async ({ page }) => {
  const nameA = testBuildName('A');
  const nameB = testBuildName('B');

  await openTree(page);
  await allocateNodes(page, await nodesNearStart(page, 2));
  await saveBuild(page, { name: nameA, level: 10, league: 'Standard' });
  const allocA = (await treeState(page)).allocated.length;

  await openTree(page);
  await allocateNodes(page, await nodesNearStart(page, 8));
  await saveBuild(page, { name: nameB, level: 20, league: 'Standard' });
  const allocB = (await treeState(page)).allocated.length;

  expect(allocB).toBeGreaterThan(allocA);

  // Open A, then soft-navigate straight to B. PassiveTree seeds its state
  // exactly once, so if the route component survives with A's data in hand, B
  // renders A's allocation — silently and permanently.
  await page.goto('/builds');
  const idA = await page.locator(`a:has-text("${nameA}")`).getAttribute('href');
  const idB = await page.locator(`a:has-text("${nameB}")`).getAttribute('href');

  // Route A -> /builds -> B, every hop a real <Link> click. There is no link
  // from one build straight to another, so this is also what a user actually
  // does; going via /builds is what exercises the client router cache that
  // made the route component outlive its URL in the first place.
  await softNavigate(page, idA!);
  await expect.poll(async () => (await treeState(page)).allocated.length).toBe(allocA);

  await softNavigate(page, '/builds');
  await softNavigate(page, idB!);
  await expect.poll(async () => (await treeState(page)).allocated.length).toBe(allocB);

  // And back again, to catch a stale seed in the other direction.
  await softNavigate(page, '/builds');
  await softNavigate(page, idA!);
  await expect.poll(async () => (await treeState(page)).allocated.length).toBe(allocA);
});

test('leaving a build for scratch mode does not overwrite that build', async ({ page }) => {
  const name = testBuildName('scratch-guard');

  await openTree(page);
  await allocateNodes(page, await nodesNearStart(page, 6));
  await saveBuild(page, { name, level: 33, league: 'Standard' });
  const saved = (await treeState(page)).allocated.length;

  await page.goto('/builds');
  const href = await page.locator(`a:has-text("${name}")`).getAttribute('href');
  await softNavigate(page, href!);
  await expect.poll(async () => (await treeState(page)).allocated.length).toBe(saved);

  // Soft-navigate to plain /tree. This must be an empty scratch editor, and a
  // save here must create a NEW row rather than silently overwriting the one
  // above with whatever scratch happens to hold.
  await softNavigate(page, '/tree');
  await expect.poll(async () => (await treeState(page)).allocated.length).toBe(0);

  const scratchName = testBuildName('scratch-new');
  await allocateNodes(page, await nodesNearStart(page, 2));
  await saveBuild(page, { name: scratchName, level: 5, league: 'Standard' });

  const names = await listedBuildNames(page);
  expect(names).toContain(name);
  expect(names).toContain(scratchName);

  // And the original is untouched.
  await openTree(page, href!.split('build=')[1]);
  await expect.poll(async () => (await treeState(page)).allocated.length).toBe(saved);
});

test('a build id that is malformed or not ours reports not-found without a 500', async ({
  page,
}) => {
  for (const bad of ['00000000-0000-0000-0000-000000000000', 'garbage']) {
    const response = await page.goto(`/tree?build=${bad}`);
    expect(response?.status(), `GET /tree?build=${bad}`).toBeLessThan(500);
    await expect(page.getByText('That build could not be found.')).toBeVisible({
      timeout: 30_000,
    });
  }
});

test('saving from a not-found state clears the stale error', async ({ page }) => {
  // Regression cover for a bug found in review on 2026-09-20: loadError became
  // a server prop, and nothing could clear it, so a SUCCESSFUL save still
  // showed "That build could not be found." for the rest of the session — with
  // the saved confirmation suppressed, because it renders only when there is no
  // error. Indistinguishable from a hard failure.
  await openTree(page, '00000000-0000-0000-0000-000000000000');
  await expect(page.getByText('That build could not be found.')).toBeVisible({ timeout: 30_000 });

  await allocateNodes(page, await nodesNearStart(page, 2));
  await saveBuild(page, { name: testBuildName('after-notfound'), level: 7, league: 'Standard' });

  await expect(page.getByText('That build could not be found.')).toBeHidden();
});
