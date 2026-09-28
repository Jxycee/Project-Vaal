import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  allocateNodes,
  cleanupWithFreshPage,
  measureTapTargets,
  MIN_TAP_PX,
  nodesNearStart,
  openTree,
  saveBuild,
  testBuildName,
  treeState,
  waitForDraft,
  waitForTreeApi,
} from './helpers';

// Slice 2 of the build-profile redesign (specs/2026-09-27-build-profile-
// redesign-design.md §6, §7.2): the owner edits a saved build in place on
// /builds/[shareToken]?edit=1, in the one BuildSession the plan lifts out of
// TreeBuildSession. Written FIRST — the app code lands in later tasks of
// docs/superpowers/plans/2026-09-27-build-page-slice2-edit-in-place.md, so
// every test below is expected to fail until then, starting at the first
// ?edit=1 interaction ("Edit gear" does not exist yet).
//
// Contract this spec pins (ids the later tasks must render — see the plan's
// Task 1 section and task-1-brief.md):
//   - Edit toggle: "Edit" (owner, read mode) sets ?edit=1; edit mode shows
//     "Done" and a `role=button` "Save".
//   - data-testid="save-status": "Saved HH:MM:SS" / "Unsaved changes".
//   - Header inputs #build-name, #build-level, #build-league; Overview
//     #build-notes (textarea) in edit mode.
//   - Discard choice (Done while dirty): data-testid="unsaved-choice" with
//     "Save" / "Discard" / "Keep editing".
//   - Draft notice: data-testid="draft-notice" with "Restore" / "Discard".
//   - Gear tab (edit): "Edit gear" opens the existing gear sheet (.z-40,
//     "Close gear sheet"); "Edit jewels" opens the jewels sheet.
//   - Skills tab (edit): "Edit skills" opens the gems sheet.
//   - Tree tab (edit): editable PassiveTree (window.__vaalTree).
//   - Checkpoint switcher (edit): "Manage checkpoints" opens CheckpointsSheet
//     (data-testid="checkpoints-sheet").
//
// CONTROLLER RULING for test 3 ("no bogus restore prompt"): drafts hold only
// tree, gear and gems — name/level/league/notes are NOT in drafts, same as
// the old editor (Global Constraints in the plan). So the unsaved change that
// proves the positive case is a TREE edit made on the Tree tab in edit mode
// (one node allocated through the dev hook), not a notes edit.

/**
 * Opens the item picker from `opener`, takes the first result, and returns
 * its name (minus the picker's " Unique" suffix). Copied from
 * sharing.spec.ts's private helper of the same name — not shared via
 * helpers.ts since it is itself test-local there.
 */
async function pickFirstItem(page: Page, opener: Locator, subject: Locator): Promise<string> {
  await opener.click();
  const picker = page.locator('.z-50');
  await expect(picker.getByPlaceholder('Search items…')).toBeVisible();
  const firstResult = picker.locator('ul li button').first();
  await expect(firstResult).toBeVisible({ timeout: 15_000 });

  const raw = (await firstResult.locator('span.truncate').first().textContent()) ?? '';
  const name = raw.replace(/\s*Unique\s*$/, '').trim();
  expect(name.length, 'the picker returned a result with no name').toBeGreaterThan(0);

  await firstResult.click();
  await expect(picker.getByPlaceholder('Search items…')).toBeHidden();
  await expect(subject).toContainText(name);
  return name;
}

/** The level/league summary line, exactly as build-page.spec.ts locates it. */
function levelLine(page: Page): Locator {
  return page.locator('h1').locator('xpath=following-sibling::p[1]');
}

function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * `page.goto`, tolerant of one `net::ERR_ABORTED`.
 *
 * Next's dev server compiles routes on demand and can fire an HMR full
 * reload of the page we are navigating away from at the exact moment we
 * call `goto` — Chromium then reports the navigation we asked for as
 * aborted, even though nothing about the app or the test is wrong. A human
 * clicking a link a beat later never hits this; a script issuing the
 * navigation immediately after a save can. Retrying once is the same shape
 * of fix `gotoBuilds` in helpers.ts already applies to its own ERR_ABORTED
 * case.
 */
async function goto(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url);
  } catch (err) {
    if (!/ERR_ABORTED/.test(String(err))) throw err;
    await page.goto(url);
  }
}

test.describe('build page edit in place', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  const name = testBuildName('edit');
  let buildId = '';
  let token = '';
  let seededAllocated = 0;

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('seeds a build through the scratch editor', async ({ page }) => {
    await openTree(page);
    await allocateNodes(page, await nodesNearStart(page, 5));
    seededAllocated = (await treeState(page)).allocated.length;
    expect(seededAllocated, 'seeding never allocated anything').toBeGreaterThanOrEqual(5);

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/builds') && r.request().method() === 'POST'),
      saveBuild(page, { name, level: 20, league: 'Standard' }),
    ]);
    const body = (await response.json()) as { build: { id: string; share_token: string } };
    buildId = body.build.id;
    token = body.build.share_token;
    expect(buildId, 'save response carried no build id').toBeTruthy();
    expect(token, 'save response carried no share token').toBeTruthy();

    // The build page itself must already render (slice 1), independent of
    // whatever slice 2 does with the ?edit=1 it does not yet understand.
    await goto(page, `/builds/${token}?edit=1`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
  });

  test('gear edit without opening the tree', async ({ page }) => {
    await goto(page, `/builds/${token}?edit=1&tab=gear`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    const editGear = page.getByRole('button', { name: 'Edit gear' });
    await expect(editGear).toBeVisible();
    await editGear.click();

    const gearSheet = page.locator('.z-40');
    await expect(gearSheet).toBeVisible();
    const bootsRow = gearSheet.locator('ul li').filter({ hasText: 'Boots' }).first();
    const bootsName = await pickFirstItem(page, bootsRow.getByRole('button').first(), bootsRow);
    await gearSheet.getByRole('button', { name: 'Close gear sheet' }).click();
    await expect(gearSheet).toBeHidden();

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('save-status')).toHaveText(/^Saved /, { timeout: 30_000 });

    // Read mode, fresh load: the boots persisted.
    await goto(page, `/builds/${token}?tab=gear`);
    await expect(page.getByTestId('gear-tab')).toContainText(bootsName);

    // And the tree — never opened this whole test — is untouched. If save
    // ever wrote an empty tree (today's `TreeBuildSession` early-return bug,
    // relocated), this is where it would show up.
    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await waitForTreeApi(page);
    expect((await treeState(page)).allocated.length).toBe(seededAllocated);
  });

  test('tree survives tab switches', async ({ page }) => {
    await goto(page, `/builds/${token}?edit=1&tab=tree`);
    await waitForTreeApi(page);
    const before = (await treeState(page)).allocated.length;

    await allocateNodes(page, await nodesNearStart(page, 3));
    const afterAllocate = (await treeState(page)).allocated.length;
    expect(afterAllocate, 'allocating 3 nodes did not change the allocated count').toBe(before + 3);

    await page.getByRole('tab', { name: 'Gear', exact: true }).click();
    await expect(page.getByTestId('gear-tab')).toBeVisible();
    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await waitForTreeApi(page);
    expect((await treeState(page)).allocated.length, 'allocation did not survive a tab switch').toBe(afterAllocate);

    await page.locator('#build-league').fill('Hardcore');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('save-status')).toHaveText(/^Saved /, { timeout: 30_000 });

    await goto(page, `/builds/${token}?tab=tree`);
    await waitForTreeApi(page);
    expect((await treeState(page)).allocated.length, 'allocation did not survive a reload').toBe(afterAllocate);
    await expect(levelLine(page)).toContainText('Hardcore');
  });

  test('no bogus restore prompt', async ({ page, context }) => {
    const editUrl = `/builds/${token}?edit=1`;

    // ---- Negative: a clean revisit shows no draft notice at all.
    await goto(page, editUrl);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    const checkpointId = new URL(page.url()).searchParams.get('checkpoint') ?? undefined;

    // The mount-time echo draft (BuildSession's draft-write effect firing
    // once on load) must actually have landed before checking that revisiting
    // shows no bogus prompt — a fixed sleep here would let this half pass
    // vacuously if that write effect were slow or entirely broken.
    await waitForDraft(page, buildId, checkpointId);
    const second = await context.newPage();
    await second.goto(editUrl);
    await expect(second.getByTestId('draft-notice')).toBeHidden();
    await second.close();

    // ---- Positive: an actual unsaved change is a real draft. Per the
    // controller ruling, drafts hold only tree/gear/gems, so the edit that
    // proves this is a tree allocation, not a notes edit.
    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await waitForTreeApi(page);
    const savedCount = (await treeState(page)).allocated.length;
    const [nodeId] = await nodesNearStart(page, 1);
    await allocateNodes(page, [nodeId]);
    await expect
      .poll(async () => (await treeState(page)).allocated.length, { message: 'unsaved allocation never landed' })
      .toBe(savedCount + 1);

    await waitForDraft(page, buildId, checkpointId);
    await page.reload();
    await expect(page.getByTestId('draft-notice')).toBeVisible();
    await page.getByTestId('draft-notice').getByRole('button', { name: 'Restore' }).click();

    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await waitForTreeApi(page);
    const restored = await treeState(page);
    expect(restored.allocated, 'Restore did not bring back the drafted node').toContain(nodeId);
    expect(restored.allocated.length).toBe(savedCount + 1);

    // ---- Done -> Discard clears the draft and resets the tree.
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('unsaved-choice')).toBeVisible();
    await page.getByTestId('unsaved-choice').getByRole('button', { name: 'Discard' }).click();

    await page.reload();
    await expect(page.getByTestId('draft-notice')).toBeHidden();
    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await waitForTreeApi(page);
    expect((await treeState(page)).allocated.length, 'Discard did not roll the tree back to the saved state').toBe(
      savedCount,
    );
  });

  test('non-owner cannot edit (URL tampering)', async ({ page }) => {
    // Positive: the owner still gets edit controls after switching the build
    // to Public — Public/Private/Unlisted is a link-sharing setting, not an
    // ownership one, and edit=1 must still work for the owner regardless.
    await goto(page, '/builds');
    const row = page.locator('ul > li').filter({ has: page.locator(`a:has-text("${name}")`) }).first();
    await expect(row).toBeVisible();
    await row.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Public' }).click();

    await goto(page, `/builds/${token}?edit=1`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();

    // Negative: the reader path's refusal is the API's existing ownership
    // rule. Reused verbatim from api-contracts.spec.ts's "a well-formed id
    // that is not ours" case (validBody() there), which asserts 404.
    const res = await page.request.post('/api/builds', {
      data: {
        id: crypto.randomUUID(),
        name: 'x',
        class: 'Witch',
        level: 10,
        passive_state: { set1: [], set2: [], ascendancyNodes: [] },
      },
    });
    expect(res.status()).toBe(404);
  });

  test('/tree?build= redirects', async ({ page }) => {
    await goto(page, `/tree?build=${buildId}`);
    await expect(page).toHaveURL(new RegExp(`/builds/${token}\\?`));
    const url = new URL(page.url());
    expect(url.pathname).toBe(`/builds/${token}`);
    expect(url.searchParams.get('tab')).toBe('tree');
    expect(url.searchParams.get('edit')).toBe('1');
    expect(url.searchParams.get('checkpoint'), 'the redirect dropped the checkpoint').toBeTruthy();

    await goto(page, '/tree?build=00000000-0000-0000-0000-000000000000');
    await expect(page).toHaveURL(/\/tree(\?|$)/);
    await expect(page.getByText('That build could not be found.')).toBeVisible({ timeout: 30_000 });
  });

  test('375px while editing', async ({ page }) => {
    await goto(page, `/builds/${token}?edit=1`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    for (const tab of ['Overview', 'Gear', 'Skills', 'Stats'] as const) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute('aria-selected', 'true');

      expect(await horizontalOverflow(page), `horizontal overflow on the ${tab} tab while editing`).toBeLessThanOrEqual(0);

      const { scanned, tooSmall } = await measureTapTargets(page, '[data-testid="build-page"]');
      expect(scanned, `nothing measured on the ${tab} tab while editing`).toBeGreaterThan(0);
      expect(tooSmall, `controls under ${MIN_TAP_PX}px on the ${tab} tab while editing`).toEqual([]);
    }
  });
});
