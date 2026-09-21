import { test, expect } from '@playwright/test';
import { cleanupTestBuilds, listedBuildNames, openTree, saveBuild, softNavigate, testBuildName } from './helpers';

// Regression cover for gear state actually persisting across a save/reload,
// the same shape of bug build-persistence.spec.ts guards against for the
// tree itself. Writes one real row to the production-linked Supabase
// project under the shared test account; cleaned up in afterAll.
//
// Drives the UI (Gear chip -> slot row -> item picker -> pick), not the
// gear_state column directly, so a break anywhere in that chain — the
// picker's search request, the icon-at-pick-time lookup, the sheet's own
// state, or the save payload — fails this test instead of being invisible.

test.describe('gear persistence', () => {
  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await cleanupTestBuilds(page);
    await page.close();
  });

  test('equipping a boots item survives a save and reload', async ({ page }) => {
    await openTree(page);

    await page.getByRole('button', { name: 'Gear' }).click();
    const gearSheet = page.locator('.z-40');
    await expect(gearSheet).toBeVisible();

    // The one row whose label is "Boots" — unambiguous among the 17 slots.
    const bootsRow = gearSheet.locator('ul li').filter({ hasText: 'Boots' }).first();
    await expect(bootsRow).toContainText('Empty');
    await bootsRow.getByRole('button').first().click();

    // The item picker sheet layers on top at z-50.
    const picker = page.locator('.z-50');
    await expect(picker.getByPlaceholder('Search items…')).toBeVisible();
    const firstResult = picker.locator('ul li button').first();
    await expect(firstResult).toBeVisible({ timeout: 15_000 });
    const rawName = (await firstResult.locator('span.truncate').first().textContent()) ?? '';
    // Strip the " Unique" suffix (see ItemPickerSheet's row markup) so the
    // name used for later assertions matches exactly what the gear row's
    // item-name span (rendered the same way) will show.
    const equippedName = rawName.replace(/\s*Unique\s*$/, '').trim();
    expect(equippedName.length).toBeGreaterThan(0);
    await firstResult.click();

    // Picking closes the picker; the gear sheet stays open with the row updated.
    await expect(picker.getByPlaceholder('Search items…')).toBeHidden();
    await expect(bootsRow).not.toContainText('Empty');
    await expect(bootsRow).toContainText(equippedName);

    await gearSheet.getByRole('button', { name: 'Close gear sheet' }).click();
    await expect(gearSheet).toBeHidden();

    const name = testBuildName('gear-boots');
    await saveBuild(page, { name, level: 15, league: 'Standard' });

    const names = await listedBuildNames(page);
    expect(names).toContain(name);

    // Real navigation into the saved build (not just poll the in-memory
    // state) — this is the /api/builds round trip and the server-component
    // load path, both of which must carry gear_state for this to mean anything.
    const href = await page.locator(`a:has-text("${name}")`).getAttribute('href');
    await softNavigate(page, href!);

    await page.getByRole('button', { name: 'Gear' }).click();
    const reopenedSheet = page.locator('.z-40');
    await expect(reopenedSheet).toBeVisible();
    const reopenedBootsRow = reopenedSheet.locator('ul li').filter({ hasText: 'Boots' }).first();
    await expect(reopenedBootsRow).toContainText(equippedName);
    await expect(reopenedBootsRow).not.toContainText('Empty');
  });

  test('clearing an equipped slot persists as empty', async ({ page }) => {
    await openTree(page);

    await page.getByRole('button', { name: 'Gear' }).click();
    const gearSheet = page.locator('.z-40');
    const beltRow = gearSheet.locator('ul li').filter({ hasText: 'Belt' }).first();
    await beltRow.getByRole('button').first().click();

    const picker = page.locator('.z-50');
    const firstResult = picker.locator('ul li button').first();
    await expect(firstResult).toBeVisible({ timeout: 15_000 });
    await firstResult.click();
    await expect(beltRow).not.toContainText('Empty');

    // The clear ("x") button only renders once a slot is equipped.
    await beltRow.getByRole('button', { name: /^Clear/ }).click();
    await expect(beltRow).toContainText('Empty');

    await gearSheet.getByRole('button', { name: 'Close gear sheet' }).click();

    const name = testBuildName('gear-clear');
    await saveBuild(page, { name, level: 15, league: 'Standard' });

    // Navigate to /builds before looking for this build's link. saveBuild
    // leaves the page on /tree, which has no such anchor, so locating it here
    // without navigating first simply waits until the test times out — which
    // is exactly how this read as a gear bug rather than a missing step.
    const names = await listedBuildNames(page);
    expect(names).toContain(name);

    const href = await page.locator(`a:has-text("${name}")`).getAttribute('href');
    await softNavigate(page, href!);

    await page.getByRole('button', { name: 'Gear' }).click();
    const reopenedBeltRow = page.locator('.z-40').locator('ul li').filter({ hasText: 'Belt' }).first();
    await expect(reopenedBeltRow).toContainText('Empty');
  });
});
