import { test, expect, type Page } from '@playwright/test';
import {
  allocateNodes,
  cleanupWithFreshPage,
  importFixture,
  measureTapTargets,
  MIN_TAP_PX,
  nodesNearStart,
  testBuildName,
  treeState,
  waitForTreeApi,
} from './helpers';

// Slice 3 of the build-profile redesign (specs/2026-09-27-build-profile-
// redesign-design.md §3 decision 6, §6.4, §10 slice 3): checkpoint management
// (add/rename/reorder/delete) moves from the full-screen CheckpointsSheet
// into the header's checkpoint switcher menu. Written FIRST — the app code
// lands in later tasks of
// docs/superpowers/plans/2026-09-28-build-page-slice3-checkpoint-switcher.md,
// so every test below is expected to fail until then, starting at the very
// first "Manage" button, which does not exist yet.
//
// Contract this spec pins (task-1-brief.md): in edit mode the switcher menu
// (`checkpoint-menu`) has a button "Manage", which toggles to "Done
// managing", for the manage view (`data-testid="checkpoint-manager"`). Rows
// are `data-testid="checkpoint-row"` with `data-checkpoint-id`. Per row: the
// switch link (`checkpoint-option`), and buttons "Rename",
// `aria-label="Move <name> up"`, `aria-label="Move <name> down"`, and
// "Delete" (which becomes "Confirm delete" after the first tap). The rename
// input is `aria-label="New checkpoint name"` with "Save name" and "Cancel".
// The add form uses `aria-label="Checkpoint name"`, `aria-label="Checkpoint
// level"` and the button "Add checkpoint". Errors appear in `role="alert"`
// inside the menu.

/**
 * `page.goto`, tolerant of one `net::ERR_ABORTED`. Copied from
 * build-page-edit.spec.ts — Next's dev server can fire an HMR full reload of
 * the page being navigated away from at the exact moment `goto` is called.
 */
async function goto(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url);
  } catch (err) {
    if (!/ERR_ABORTED/.test(String(err))) throw err;
    await page.goto(url);
  }
}

function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** The order of checkpoints in whatever's currently rendering `checkpoint-row`s. */
async function rowOrder(page: Page): Promise<string[]> {
  return page
    .getByTestId('checkpoint-row')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-checkpoint-id') ?? ''));
}

/**
 * Opens a checkpoint switcher and taps "Manage", returning the manage view's
 * root locator. Each test does its own fresh `goto`, so the menu always
 * starts closed. `switcherTestId` defaults to the full header's switcher;
 * pass `checkpoint-switcher-compact` for the sticky bar's (BuildPage.tsx,
 * `align="right"`) — the two switchers on screen at once must not share a
 * test id, or Playwright's strict mode trips.
 */
async function openManage(page: Page, switcherTestId = 'checkpoint-switcher') {
  await page.getByTestId(switcherTestId).click();
  const menu = page.getByTestId('checkpoint-menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: 'Manage', exact: true }).click();
  await expect(menu.getByRole('button', { name: 'Done managing', exact: true })).toBeVisible();
  const manager = page.getByTestId('checkpoint-manager');
  await expect(manager).toBeVisible();
  return manager;
}

test.describe('build page checkpoint management (switcher)', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  const name = testBuildName('cp-switcher');
  let token = '';
  let copyTestCheckpointId = '';

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('manage view fits a phone', async ({ page }) => {
    token = await importFixture(page, name);

    await goto(page, `/builds/${token}?edit=1`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    await openManage(page);
    const rows = page.getByTestId('checkpoint-row');
    await expect(rows).toHaveCount(8);

    expect(await horizontalOverflow(page), 'horizontal overflow with the manage view open').toBeLessThanOrEqual(0);

    const { scanned, tooSmall } = await measureTapTargets(page, '[data-testid="checkpoint-menu"]');
    expect(scanned, 'nothing measured in the checkpoint menu').toBeGreaterThanOrEqual(8);
    expect(tooSmall, `controls under ${MIN_TAP_PX}px in the manage view`).toEqual([]);

    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const box = await rows.nth(i).boundingBox();
      expect(box, `checkpoint row ${i} has no bounding box`).not.toBeNull();
      expect(box!.x, `checkpoint row ${i} left edge off-screen`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `checkpoint row ${i} right edge off-screen`).toBeLessThanOrEqual(375);
    }
  });

  // Fix round 1 (final review): the full header's switcher was covered above,
  // but nothing exercised the compact sticky bar's own switcher
  // (align="right", BuildPage.tsx) in manage view. Gear is the tallest tab
  // (17 slots + jewels — same reasoning as build-page.spec.ts's own compact-bar
  // test), so it is the one guaranteed to scroll the full header out of view.
  test('compact-bar manage view fits a phone', async ({ page }) => {
    await goto(page, `/builds/${token}?edit=1&tab=gear`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const compactSwitcher = page.getByTestId('checkpoint-switcher-compact');
    await expect(compactSwitcher).toBeVisible();

    const manager = await openManage(page, 'checkpoint-switcher-compact');
    const rows = manager.getByTestId('checkpoint-row');
    await expect(rows).toHaveCount(8);

    expect(
      await horizontalOverflow(page),
      'horizontal overflow with the compact-bar manage view open',
    ).toBeLessThanOrEqual(0);

    const compactCount = await rows.count();
    for (let i = 0; i < compactCount; i++) {
      const box = await rows.nth(i).boundingBox();
      expect(box, `checkpoint row ${i} has no bounding box`).not.toBeNull();
      expect(box!.x, `checkpoint row ${i} left edge off-screen`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `checkpoint row ${i} right edge off-screen`).toBeLessThanOrEqual(375);
    }
  });

  test('reorder persists and the page stays put', async ({ page }) => {
    await goto(page, `/builds/${token}?edit=1`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    const activeId = new URL(page.url()).searchParams.get('checkpoint');
    expect(activeId, 'owner URL did not name a checkpoint').toBeTruthy();

    await openManage(page);
    const before = await rowOrder(page);
    expect(before.length, 'no checkpoint rows to reorder').toBe(8);
    const lastId = before[before.length - 1];

    const lastRow = page.getByTestId('checkpoint-row').last();
    await lastRow.getByRole('button', { name: /^Move .+ up$/ }).click();

    await expect
      .poll(async () => (await rowOrder(page)).indexOf(lastId), { message: 'reorder never moved the last row up', timeout: 30_000 })
      .toBe(before.length - 2);

    await goto(page, `/builds/${token}?edit=1&checkpoint=${activeId}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await openManage(page);
    const after = await rowOrder(page);
    expect(after.length).toBe(8);
    expect(after.indexOf(lastId), 'the moved checkpoint did not stay moved after a reload').toBe(before.length - 2);

    expect(new URL(page.url()).searchParams.get('checkpoint'), 'the page moved off the owner checkpoint').toBe(
      activeId,
    );
  });

  test('rename', async ({ page }) => {
    await goto(page, `/builds/${token}?edit=1`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await openManage(page);

    const secondRow = page.getByTestId('checkpoint-row').nth(1);
    await secondRow.getByRole('button', { name: 'Rename', exact: true }).click();
    const input = secondRow.getByLabel('New checkpoint name');
    await input.fill('Mapping');
    await secondRow.getByRole('button', { name: 'Save name', exact: true }).click();
    await expect(secondRow).toContainText('Mapping');

    await goto(page, `/builds/${token}?edit=1`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await openManage(page);
    await expect(page.getByTestId('checkpoint-row').nth(1)).toContainText('Mapping');

    const secondRowAgain = page.getByTestId('checkpoint-row').nth(1);
    await secondRowAgain.getByRole('button', { name: 'Rename', exact: true }).click();
    await secondRowAgain.getByLabel('New checkpoint name').fill('   ');
    await secondRowAgain.getByRole('button', { name: 'Save name', exact: true }).click();
    await expect(page.getByTestId('checkpoint-menu').getByRole('alert')).toBeVisible();

    await goto(page, `/builds/${token}?edit=1`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await openManage(page);
    await expect(page.getByTestId('checkpoint-row').nth(1)).toContainText('Mapping');
  });

  // Fix round 1 (final review): Escape and outside-click both used to close
  // the whole menu unconditionally, even mid-rename — unmounting the manage
  // view and silently dropping whatever had been typed into the rename
  // input. Escape must now cancel only the rename (menu stays open); an
  // outside click must not close the menu while the rename input holds text
  // that differs from the checkpoint's saved name.
  test('a rename in progress survives Escape and outside clicks', async ({ page }) => {
    await goto(page, `/builds/${token}?edit=1`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    const manager = await openManage(page);
    const row = manager.getByTestId('checkpoint-row').first();
    await row.getByRole('button', { name: 'Rename', exact: true }).click();
    const input = row.getByLabel('New checkpoint name');
    await input.fill('Half typed');

    // A real Escape keydown, dispatched on the input itself (bubbles to the
    // document listener the switcher attaches) — Playwright's keyboard.press
    // is fine here; the harness's computer tool is not, since this spec
    // drives a real browser context directly.
    await input.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await expect(page.getByTestId('checkpoint-menu'), 'Escape closed the whole menu, not just the rename').toBeVisible();
    await expect(row.getByLabel('New checkpoint name'), 'the rename input is still showing after Escape').toBeHidden();

    // Start again, type, then click somewhere else on the page entirely —
    // #build-name is a sibling higher up in BuildHeader, never under the
    // dropdown (which only ever renders below its own trigger).
    await row.getByRole('button', { name: 'Rename', exact: true }).click();
    await row.getByLabel('New checkpoint name').fill('Half typed');
    await page.locator('#build-name').click();
    await expect(page.getByTestId('checkpoint-menu'), 'an outside click closed the menu with unsaved rename text').toBeVisible();
    await expect(row.getByLabel('New checkpoint name')).toHaveValue('Half typed');

    // Cancel still works normally.
    await row.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(row.getByLabel('New checkpoint name')).toBeHidden();
  });

  test('add copies unsaved edits', async ({ page }) => {
    await goto(page, `/builds/${token}?edit=1&tab=tree`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await waitForTreeApi(page);
    const activeId = new URL(page.url()).searchParams.get('checkpoint');
    expect(activeId, 'owner URL did not name a checkpoint').toBeTruthy();

    const taken = new Set((await treeState(page)).allocated);
    const [nodeId] = (await nodesNearStart(page, 12)).filter((id) => !taken.has(id));
    expect(nodeId, 'no unallocated node near the start to add').toBeTruthy();
    const before = (await treeState(page)).allocated.length;
    await allocateNodes(page, [nodeId]);
    await expect
      .poll(async () => (await treeState(page)).allocated.length, { message: 'unsaved allocation never landed', timeout: 30_000 })
      .toBe(before + 1);

    // Deliberately no Save — the new checkpoint must copy this unsaved state.
    await page.getByTestId('checkpoint-switcher').click();
    const menu = page.getByTestId('checkpoint-menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: 'Manage', exact: true }).click();
    const manager = page.getByTestId('checkpoint-manager');
    await expect(manager).toBeVisible();

    await manager.getByLabel('Checkpoint name').fill('Copy test');
    await manager.getByLabel('Checkpoint level').fill('50');
    await manager.getByRole('button', { name: 'Add checkpoint', exact: true }).click();

    await page.waitForURL((url) => url.searchParams.get('checkpoint') !== activeId, { timeout: 30_000 });
    copyTestCheckpointId = new URL(page.url()).searchParams.get('checkpoint')!;
    expect(copyTestCheckpointId, 'add did not navigate to a new checkpoint').toBeTruthy();
    expect(copyTestCheckpointId).not.toBe(activeId);

    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await waitForTreeApi(page);
    const copiedTree = await treeState(page);
    expect(copiedTree.allocated, 'the new checkpoint did not copy the unsaved node').toContain(nodeId);

    // The header's editable level field — the new checkpoint's level.
    await expect(page.locator('#build-level')).toHaveValue('50');
  });

  test('delete the active checkpoint', async ({ page }) => {
    expect(copyTestCheckpointId, 'no checkpoint id carried over from the add test').toBeTruthy();
    await goto(page, `/builds/${token}?edit=1&checkpoint=${copyTestCheckpointId}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    await openManage(page);
    const targetRow = page.locator(`[data-testid="checkpoint-row"][data-checkpoint-id="${copyTestCheckpointId}"]`);
    await expect(targetRow).toBeVisible();
    await targetRow.getByRole('button', { name: 'Delete', exact: true }).click();
    await targetRow.getByRole('button', { name: 'Confirm delete', exact: true }).click();

    await page.waitForURL((url) => url.searchParams.get('checkpoint') !== copyTestCheckpointId, { timeout: 30_000 });
    const landedId = new URL(page.url()).searchParams.get('checkpoint');
    expect(landedId, 'delete did not land on another checkpoint').toBeTruthy();

    await openManage(page);
    const rows = page.getByTestId('checkpoint-row');
    await expect(rows).toHaveCount(8);
    const ids = await rowOrder(page);
    expect(ids, 'the checkpoint landed on is not in the remaining rows').toContain(landedId);
  });

  // "The last checkpoint cannot be deleted" is pinned end to end by the final
  // step of checkpoints.spec.ts (delete down to one, then the refusal alert).

  test('dirty hint', async ({ page }) => {
    await goto(page, `/builds/${token}?edit=1`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    // ---- Meta-only dirty (league, not drafted): "Save first…" hint.
    const league = page.locator('#build-league');
    const currentLeague = await league.inputValue();
    await league.fill(currentLeague === 'Hardcore' ? 'Standard' : 'Hardcore');

    await page.getByTestId('checkpoint-switcher').click();
    await expect(page.getByTestId('checkpoint-menu')).toContainText('Save first to keep name and notes changes.');

    // Reset: Done -> Discard (never window.confirm here).
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByTestId('unsaved-choice')).toBeVisible();
    await page.getByTestId('unsaved-choice').getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();

    // ---- Tree dirty (drafted): "Unsaved changes…" hint.
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await waitForTreeApi(page);
    const taken = new Set((await treeState(page)).allocated);
    const [nodeId] = (await nodesNearStart(page, 12)).filter((id) => !taken.has(id));
    expect(nodeId, 'no unallocated node near the start to add').toBeTruthy();
    const before = (await treeState(page)).allocated.length;
    await allocateNodes(page, [nodeId]);
    await expect
      .poll(async () => (await treeState(page)).allocated.length, { message: 'unsaved allocation never landed', timeout: 30_000 })
      .toBe(before + 1);

    await page.getByTestId('checkpoint-switcher').click();
    await expect(page.getByTestId('checkpoint-menu')).toContainText(
      'Unsaved changes stay as a draft on this checkpoint.',
    );

    // Leave the build clean for cleanup.
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByTestId('unsaved-choice')).toBeVisible();
    await page.getByTestId('unsaved-choice').getByRole('button', { name: 'Discard', exact: true }).click();
  });
});
