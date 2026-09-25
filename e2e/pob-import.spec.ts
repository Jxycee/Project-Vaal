import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { cleanupWithFreshPage, gotoBuilds, MIN_TAP_PX, measureTapTargets, openTree, testBuildName, treeState, waitForTreeApi } from './helpers';

// Path of Building 2 import, end to end through the real UI (the test-grade
// ImportSheet), the real Server Functions and the real database.
//
// Uses the VENDORED code, so CI never depends on a third-party site. The
// expected numbers were verified before any code was written (see
// docs/superpowers/plans/2026-09-24-slice2-pob-import.md, Task 10): the tree
// hook's `allocated` is main-tree only, and PoB's lists include the class
// and ascendancy start nodes our editor never stores — so spec 1 imports as
// 35 main-tree nodes and spec 8 as 116.
//
// Guards against the ways a test here has passed while broken
// (docs/superpowers/CURRENT-STATE.md): the tap-target scan asserts how many
// controls it measured, and the two checkpoints are asserted populated AND
// different, so an import that saved nothing cannot pass.
//
// Writes real rows to the production-linked project under the shared test
// account. The build is named E2E-… and deleted in afterAll; the delete
// cascades to its checkpoints.

const CODE = readFileSync(path.join(__dirname, '..', 'src', 'lib', 'pob', '__fixtures__', 'sample-pob2-code.txt'), 'utf8');

test.describe('Path of Building 2 import', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.setTimeout(300_000);

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('previews the report, imports 8 checkpoints, and each comes back with its own tree', async ({ page }) => {
    const name = testBuildName('pob-import');
    const sheet = page.getByTestId('import-sheet');
    let buildId = '';

    await test.step('preview states what came across and what did not', async () => {
      await gotoBuilds(page);
      await page.getByTestId('open-import-sheet').click();
      await expect(sheet).toBeVisible();
      await sheet.getByTestId('import-input').fill(CODE);
      await sheet.getByRole('button', { name: 'Preview', exact: true }).click();

      const preview = sheet.getByTestId('import-preview');
      await expect(preview).toBeVisible({ timeout: 60_000 });
      await expect(sheet.getByTestId('import-summary')).toContainText('8 checkpoints, 5 skills with 20 gems, 12 items, 2 jewels');
      await expect(sheet.getByTestId('import-checkpoints').locator('li')).toHaveCount(8);
      await expect(sheet.getByTestId('import-checkpoints').locator('li').first()).toContainText('level 31, 35 passives, 2 ascendancy');
      await expect(sheet.getByTestId('import-checkpoints').locator('li').last()).toContainText('level 94, 116 passives, 8 ascendancy');

      const notes = sheet.getByTestId('import-report-note');
      await expect(notes).toContainText('13 gem(s) are known by a different name');
      await expect(notes).toContainText('Artillery Ballista → Siege Ballista');
      await expect(notes).toContainText('one set of gear and one set of skill gems');

      const dropped = sheet.getByTestId('import-report-dropped');
      await expect(dropped).toContainText('15671');
      // Slice 5 keeps attribute choices; the one still reported is spec 8's
      // choice for 15671, the node this patch's tree does not have.
      await expect(dropped).toContainText('attribute choice(s) were not kept');
      await expect(dropped).toContainText('15671');
      // Ring 3 is empty in this build, so nothing may be said about it.
      await expect(sheet).not.toContainText('Ring 3');
    });

    await test.step('the sheet meets the tap-target floor with a real preview in it', async () => {
      const { scanned, tooSmall } = await measureTapTargets(page, '[data-testid="import-sheet"]');
      // Buttons and links only (measureTapTargets): close, Preview, Import.
      expect(scanned, 'controls measured in the import sheet').toBe(3);
      expect(tooSmall, `controls under ${MIN_TAP_PX}px in the import sheet`).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'horizontal scroll with the import sheet open').toBeLessThanOrEqual(0);
    });

    await test.step('import lands on the new build in the editor', async () => {
      await sheet.getByTestId('import-name').fill(name);
      await sheet.getByRole('button', { name: 'Import', exact: true }).click();
      await page.waitForURL(/\/tree\?build=/, { timeout: 60_000 });
      buildId = new URL(page.url()).searchParams.get('build')!;
      expect(buildId).toMatch(/^[0-9a-f-]{36}$/);
    });

    await test.step('first and last checkpoints come back after a full reload, different and non-zero', async () => {
      await openTree(page, buildId);
      await expect.poll(async () => (await treeState(page)).allocated.length, { timeout: 30_000 }).toBe(35);
      // Slice 5: spec 1's eleven "+attribute" choices came across and saved.
      expect(Object.keys((await treeState(page)).attributeChoices)).toHaveLength(11);

      await page.getByRole('button', { name: /^Checkpoints/ }).click();
      const cpSheet = page.getByTestId('checkpoints-sheet');
      await expect(cpSheet).toBeVisible();
      const rows = cpSheet.getByTestId('checkpoint-row');
      await expect(rows).toHaveCount(8);
      await expect(rows.first()).toContainText('Nivel 31 - Empezamos con Balista');
      await expect(rows.last()).toContainText('Nivel 94');
      const lastId = await rows.last().getAttribute('data-checkpoint-id');

      await page.goto(`/tree?build=${buildId}&checkpoint=${lastId}`);
      await waitForTreeApi(page);
      await expect.poll(async () => (await treeState(page)).allocated.length, { timeout: 30_000 }).toBe(116);
      expect(Object.keys((await treeState(page)).attributeChoices)).toHaveLength(27);
    });

    // Slice 4: items arrive with their craft, not as bases only. Values are
    // pinned in src/lib/pob/__tests__/mapItems.test.ts; this proves they
    // survive the import write, the gate and a full reload into the editor.
    await test.step('imported items keep their crafts through the save and a reload', async () => {
      await page.getByRole('button', { name: 'Gear' }).click();
      const gear = page.locator('.fixed.inset-0.z-40');
      await expect(gear.getByTestId('gear-craft-weapon1_main')).toHaveText('rare · 6 affixes · 2 runes');
      await expect(gear.getByTestId('gear-craft-body')).toHaveText('unique · 0 affixes · 2 runes');

      await gear.getByRole('button', { name: 'Edit Weapon' }).first().click();
      const editor = page.getByTestId('item-editor');
      await expect(editor.getByTestId('affix-row')).toHaveCount(6);
      await expect(editor.locator('[data-testid="affix-row"][data-slug="localaddedphysicaldamagetwohand7"]')).toBeVisible();
      await editor.getByRole('button', { name: 'Close item editor' }).click();
      await gear.getByRole('button', { name: 'Close gear sheet' }).click();
    });

    await test.step('the build lists under its name', async () => {
      await gotoBuilds(page);
      await expect(page.locator(`a:has-text("${name}")`)).toBeVisible();
    });
  });

  // Opt-in: reaches a real third-party site. The only share id verified live
  // (2026-09-24) is a Path of EXILE 1 build, so this proves the live path —
  // allowlist, fetch, decode — end to end by its refusal message.
  test('a live pobb.in link is fetched and judged (E2E_NETWORK=1 only)', async ({ page }) => {
    test.skip(process.env.E2E_NETWORK !== '1', 'set E2E_NETWORK=1 to reach pobb.in');
    await gotoBuilds(page);
    await page.getByTestId('open-import-sheet').click();
    const sheet = page.getByTestId('import-sheet');
    await sheet.getByTestId('import-input').fill('https://pobb.in/eQVFNoqVZrza');
    await sheet.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(sheet.getByRole('alert')).toContainText('not a Path of Building 2 build', { timeout: 30_000 });
  });
});
