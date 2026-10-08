import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  allocateNodes,
  cleanupWithFreshPage,
  gotoBuilds,
  importFixture,
  listedBuildNames,
  nodesNearStart,
  openBuildSettings,
  openEditor,
  openTree,
  pickGearItem,
  readBuildId,
  saveBuild,
  testBuildName,
  treeState,
  waitForDraft,
  waitForTreeApi,
} from './helpers';

// Slice 7b of the build-profile redesign (spec §7.3, plan docs/superpowers/
// plans/2026-09-29-build-page-slice7b-scratch-retire-editor.md). Written FIRST:
// it fails at the first `build-page` assertion on /tree until the scratch
// planner runs on the build page shell.
//
// Contract this spec pins:
//   - /tree with no ?build= is the build page in edit mode with no saved row:
//     header "Untitled build", every tab, and none of the saved-build chrome
//     (no checkpoint switcher, no Build settings, no Copy link, no Edit/Done).
//     Save is disabled until the build has a name, and says so.
//   - The first Save creates ONE build and lands on /builds/<token>?edit=1 with
//     the tab kept; tree, gear, gems and meta are all in the new row, and the
//     new page opens with no draft prompt. A double tap must not create two.
//   - The scratch draft survives a reload (Restore prompt) and is gone once the
//     first save succeeded.
//   - Two 7a minors: double Enter in New build creates one build, and deleting a
//     build clears its drafts from localStorage.

const RESTORE = /Unsaved changes from last time/;
const TABS = ['Overview', 'Gear', 'Skills', 'Tree', 'Stats'] as const;

/** How many /builds cards are named exactly `name`. */
async function countNamed(page: Page, name: string): Promise<number> {
  return (await listedBuildNames(page)).filter((n) => n === name).length;
}

/** Opens the picker from `opener` and takes the first result, returning its name (minus the picker's " Unique" suffix). */
async function pickFirstResult(page: Page, opener: Locator): Promise<string> {
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
  return name;
}

/** Fires two clicks in one task, before React can re-render between them: what a fast double tap does. */
async function doubleClick(button: Locator): Promise<void> {
  await button.evaluate((el) => {
    (el as HTMLElement).click();
    (el as HTMLElement).click();
  });
}

test.describe('scratch planner on the build page', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('scratch is the build page in edit mode with no saved-build chrome', async ({ page }) => {
    await openTree(page);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('build-page').locator('header').getByText('Untitled build')).toBeVisible();

    for (const tab of TABS) {
      await expect(page.getByRole('tab', { name: tab, exact: true })).toBeVisible();
    }
    // Nothing that needs a saved row.
    await expect(page.getByTestId('checkpoint-switcher')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Build settings', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Done', exact: true })).toHaveCount(0);

    // Save waits for a name, and says why.
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    await expect(page.getByText('Name your build to save it')).toBeVisible();
    await page.locator('#build-name').fill(testBuildName('scratch-hint'));
    await expect(page.getByText('Name your build to save it')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
    await page.locator('#build-name').fill('');
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();

    // (Per-tab horizontal overflow at 375px is asserted by build-page.spec.ts and
    // build-page-edit.spec.ts, which sweep the same tabs of the same page.)
  });

  test('first save creates the build and lands on its page with tree, gear, gems and meta', async ({ page }) => {
    const name = testBuildName('scratch-first');
    await openTree(page);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await allocateNodes(page, await nodesNearStart(page, 3));
    const allocated = (await treeState(page)).allocated.length;
    expect(allocated).toBeGreaterThan(0);

    await openEditor(page, 'gear');
    const gearName = await pickGearItem(page, 'ring1');

    await openEditor(page, 'gems');
    await page.getByRole('button', { name: '+ Add skill group' }).click();
    const sheet = page.getByTestId('gem-group-sheet');
    await expect(sheet).toBeVisible();
    const skillName = await pickFirstResult(page, sheet.getByRole('button', { name: /Empty/ }));
    await sheet.getByRole('button', { name: 'Close skill group' }).click();
    await expect(sheet).toBeHidden();

    await page.getByRole('tab', { name: 'Overview', exact: true }).click();
    await page.locator('#build-notes').fill('scratch notes');

    // Save from the Tree tab: it is the tab the redirect must keep.
    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await saveBuild(page, { name, level: 37, league: 'Standard' });

    await expect(page).toHaveURL(/\/builds\/[A-Za-z0-9_-]+\?/, { timeout: 30_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get('edit'), 'the redirect dropped edit=1').toBe('1');
    expect(url.searchParams.get('tab'), 'the redirect dropped the current tab').toBe('tree');
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#build-name')).toHaveValue(name);
    await expect(page.locator('#build-level')).toHaveValue('37');

    // Reloading the new page: everything is in the row, and there is no draft to offer.
    await page.reload();
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await waitForTreeApi(page);
    expect((await treeState(page)).allocated.length, 'the tree did not persist').toBe(allocated);
    await expect(page.getByText(RESTORE)).toBeHidden();
    await expect(page.locator('#build-name')).toHaveValue(name);

    await page.getByRole('tab', { name: 'Gear', exact: true }).click();
    await expect(page.getByTestId('doll-slot-ring1')).toContainText(gearName);
    await page.getByRole('tab', { name: 'Skills', exact: true }).click();
    await expect(page.getByTestId('skill-row').filter({ hasText: skillName }).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Overview', exact: true }).click();
    await expect(page.locator('#build-notes')).toHaveValue('scratch notes');

    expect(await countNamed(page, name)).toBe(1);
  });

  test('a double-tapped Save in scratch creates exactly one build', async ({ page }) => {
    const name = testBuildName('scratch-double');
    await openTree(page);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await allocateNodes(page, await nodesNearStart(page, 2));
    await page.locator('#build-name').fill(name);

    await doubleClick(page.getByRole('button', { name: 'Save', exact: true }));
    await expect(page).toHaveURL(/\/builds\/[A-Za-z0-9_-]+\?/, { timeout: 30_000 });

    expect(await countNamed(page, name), 'a double tap created more than one build').toBe(1);
  });

  test('unsaved scratch work offers Restore after a reload, and none after the first save', async ({ page }) => {
    await openTree(page);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await allocateNodes(page, await nodesNearStart(page, 3));
    const before = (await treeState(page)).allocated.length;
    expect(before).toBeGreaterThan(0);
    await waitForDraft(page);

    await page.reload();
    await waitForTreeApi(page);
    await expect(page.getByText(RESTORE)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect.poll(async () => (await treeState(page)).allocated.length).toBe(before);

    // Save it: the draft goes with the first successful save.
    await saveBuild(page, { name: testBuildName('scratch-draft') });
    await expect(page).toHaveURL(/\/builds\//, { timeout: 30_000 });
    expect(await page.evaluate(() => localStorage.getItem('vaal:tree-draft:scratch')), 'the scratch draft survived a successful save').toBeNull();

    await openTree(page);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(RESTORE)).toBeHidden();
  });

  test('double Enter in the New build sheet creates one build', async ({ page }) => {
    const name = testBuildName('new-double-enter');
    await gotoBuilds(page);
    await page.getByRole('button', { name: '+ New build', exact: true }).click();
    const sheet = page.getByTestId('new-build-sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Witch', exact: true }).click();
    const input = sheet.getByLabel('Build name');
    await input.fill(name);

    // Two Enters in one task, before React re-renders the disabled state.
    await input.evaluate((el) => {
      for (let i = 0; i < 2; i += 1) el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await expect(page).toHaveURL(/\/builds\/[A-Za-z0-9_-]+\?/, { timeout: 30_000 });

    expect(await countNamed(page, name), 'a double Enter created more than one build').toBe(1);
  });

  test('deleting a build clears every draft it had from localStorage', async ({ page }) => {
    const name = testBuildName('delete-drafts');
    const token = await importFixture(page, name);
    const id = await readBuildId(page, name);

    await page.goto(`/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('checkpoint-switcher').click();
    const options = page.getByTestId('checkpoint-option');
    const count = await options.count();
    expect(count, 'the imported build should have several checkpoints').toBeGreaterThan(1);
    const checkpointIds: string[] = [];
    for (let i = 0; i < count; i += 1) checkpointIds.push((await options.nth(i).getAttribute('data-checkpoint-id'))!);

    // Back to a closed menu, then a draft for every checkpoint plus one under
    // the bare (pre-checkpoint) key.
    await page.reload();
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await page.evaluate(
      ({ buildId, cps }) => {
        const draft = JSON.stringify({ tree: { classId: 1, className: 'Witch', ascendancyNodes: [], main: { allocated: [] } }, gear: {}, gem: {} });
        localStorage.setItem(`vaal:tree-draft:${buildId}`, draft);
        for (const cp of cps) localStorage.setItem(`vaal:tree-draft:${buildId}:${cp}`, draft);
      },
      { buildId: id, cps: checkpointIds },
    );
    const seeded = await page.evaluate((buildId) => Object.keys(localStorage).filter((k) => k.startsWith(`vaal:tree-draft:${buildId}`)).length, id);
    expect(seeded).toBe(count + 1);

    const menu = await openBuildSettings(page);
    await menu.getByRole('button', { name: 'Delete build', exact: true }).click();
    await menu.getByRole('button', { name: 'Confirm delete', exact: true }).click();
    await page.waitForURL((u) => u.pathname === '/builds', { timeout: 30_000 });

    const left = await page.evaluate((buildId) => Object.keys(localStorage).filter((k) => k.startsWith(`vaal:tree-draft:${buildId}`)), id);
    expect(left, 'drafts of a deleted build are still in localStorage').toEqual([]);
  });
});
