import { test, expect } from '@playwright/test';
import {
  allocateNodes,
  cleanupWithFreshPage,
  MIN_TAP_PX,
  measureTapTargets,
  nodesNearStart,
  openTree,
  saveBuild,
  testBuildName,
  treeState,
  waitForTreeApi,
} from './helpers';

// Leveling checkpoints, end to end through the real UI (the test-grade
// CheckpointsSheet) and the real database.
//
// Written against the three ways a test on this branch has passed while
// broken (docs/superpowers/CURRENT-STATE.md, "Three ways a test here has
// passed while broken"):
//   1. A tap-target scan that matches nothing is green. So every scan asserts
//      how many controls it measured — and the sheet is asserted visible first,
//      because measureTapTargets silently falls back to document.body when its
//      selector matches nothing.
//   2. "Reads empty after reload" is equally true of a build that never saved.
//      So every assertion about one checkpoint is paired with a POPULATED
//      assertion about the other: two different, non-zero node counts.
//   3. The state a test runs in is part of the test. The tap-target scan here
//      runs against a sheet holding two real checkpoints, not an empty one.
//
// Writes real rows to the production-linked project under the shared test
// account. Everything created is prefixed E2E- and deleted in afterAll; the
// builds delete cascades to their checkpoints.

test.describe('leveling checkpoints', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.setTimeout(300_000);

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('checkpoints hold separate trees, reorder, and refuse to lose the last one', async ({ page }) => {
    const name = testBuildName('checkpoints');
    let buildId = '';
    let firstAlloc = 0;
    let secondAlloc = 0;
    let secondCheckpointId = '';

    const sheet = page.getByTestId('checkpoints-sheet');
    const rows = sheet.getByTestId('checkpoint-row');
    const openSheet = async () => {
      await page.getByRole('button', { name: /^Checkpoints/ }).click();
      await expect(sheet).toBeVisible();
    };

    await test.step('save a build — the database gives it checkpoint 0', async () => {
      await openTree(page);
      await allocateNodes(page, await nodesNearStart(page, 3));
      await saveBuild(page, { name, level: 31, league: 'Standard' });
      firstAlloc = (await treeState(page)).allocated.length;
      expect(firstAlloc).toBeGreaterThan(0);

      await page.goto('/builds');
      const href = await page.locator(`a:has-text("${name}")`).getAttribute('href');
      buildId = href!.split('build=')[1];

      await openTree(page, buildId);
      await expect.poll(async () => (await treeState(page)).allocated.length).toBe(firstAlloc);
      await openSheet();
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText('Level 31');
    });

    await test.step('add a second checkpoint as a copy, then make it diverge', async () => {
      await sheet.getByLabel('Checkpoint name').fill('Level 94');
      await sheet.getByLabel('Checkpoint level').fill('94');
      await sheet.getByRole('button', { name: 'Add checkpoint' }).click();

      await page.waitForURL(/[?&]checkpoint=/);
      await waitForTreeApi(page);
      secondCheckpointId = new URL(page.url()).searchParams.get('checkpoint')!;

      // Starts as a copy of the checkpoint it was made from.
      await expect.poll(async () => (await treeState(page)).allocated.length).toBe(firstAlloc);

      await allocateNodes(page, await nodesNearStart(page, 9));
      secondAlloc = (await treeState(page)).allocated.length;
      expect(secondAlloc).toBeGreaterThan(firstAlloc);
      await saveBuild(page, { level: 94 });
    });

    await test.step('each checkpoint comes back with its own tree after a full reload', async () => {
      // No ?checkpoint= means the first by position — still checkpoint 0.
      await openTree(page, buildId);
      await expect.poll(async () => (await treeState(page)).allocated.length).toBe(firstAlloc);

      await page.goto(`/tree?build=${buildId}&checkpoint=${secondCheckpointId}`);
      await waitForTreeApi(page);
      await expect.poll(async () => (await treeState(page)).allocated.length).toBe(secondAlloc);

      // Both populated AND different: neither passing value is the one an
      // unsaved build would also produce.
      expect(firstAlloc).toBeGreaterThan(0);
      expect(secondAlloc).not.toBe(firstAlloc);
    });

    await test.step('the sheet meets the tap-target floor with real checkpoints in it', async () => {
      await openSheet();
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(1)).toContainText('level 94');

      const { scanned, tooSmall } = await measureTapTargets(page, '[data-testid="checkpoints-sheet"]');
      expect(scanned, 'no controls found in the checkpoints sheet').toBeGreaterThan(4);
      expect(tooSmall, `controls under ${MIN_TAP_PX}px in the checkpoints sheet`).toEqual([]);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'horizontal scroll with the checkpoints sheet open').toBeLessThanOrEqual(0);
    });

    await test.step('reordering persists: the moved checkpoint becomes the default', async () => {
      await sheet.getByRole('button', { name: 'Move Level 94 up' }).click();
      await expect(rows.first()).toContainText('Level 94');
      await expect(rows.nth(1)).toContainText('Level 31');

      // A fresh load with no ?checkpoint= opens position 0 — now Level 94.
      await openTree(page, buildId);
      await expect.poll(async () => (await treeState(page)).allocated.length).toBe(secondAlloc);
    });

    await test.step('deleting down to one works; deleting the last is refused', async () => {
      await openSheet();
      const levelThirtyOne = rows.filter({ hasText: 'Level 31' });
      await levelThirtyOne.getByRole('button', { name: 'Delete' }).click();
      await levelThirtyOne.getByRole('button', { name: 'Confirm delete' }).click();
      await expect(rows).toHaveCount(1);

      const last = rows.first();
      await last.getByRole('button', { name: 'Delete' }).click();
      await last.getByRole('button', { name: 'Confirm delete' }).click();
      await expect(sheet.getByRole('alert')).toHaveText('A build must keep at least one checkpoint.');
      await expect(rows).toHaveCount(1);
    });
  });
});
