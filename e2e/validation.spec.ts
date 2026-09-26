import { test, expect } from '@playwright/test';
import {
  MIN_TAP_PX,
  cleanupWithFreshPage,
  listedBuildNames,
  measureTapTargets,
  openTree,
  pickByName,
  saveBuild,
  testBuildName,
} from './helpers';

// Slice 3 — structural validation (plans/2026-09-24-slice3-structural-validation.md).
// Drives the real gear and gem sheets, then proves the warnings are DERIVED
// from saved state by reloading the page and finding them again. Writes one
// row under the shared test account on the production-linked project; deleted
// in afterAll.
//
// Every "no warning" assertion is paired with a positive one that proves the
// thing being looked at is really there (trap 1 and 2 in CURRENT-STATE.md).

test.describe('structural validation', () => {
  test.setTimeout(420_000);

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('two-handed occupancy, dual wielding and reserved Spirit, across a save and a full reload', async ({ page }) => {
    await openTree(page);

    // ---- Gear, set I: a crossbow fills both hands ---------------------------
    await page.getByRole('button', { name: 'Gear' }).click();
    const gear = page.locator('.fixed.inset-0.z-40');
    await expect(gear).toBeVisible();
    const row = (label: string) => gear.locator('ul li').filter({ hasText: label }).first();
    const warningsList = gear.getByTestId('build-warning');

    await pickByName(page, row('Weapon').getByRole('button').first(), 'Siege Crossbow');
    await expect(row('Weapon')).toContainText('Siege Crossbow');
    // The game draws a two-hander in both slots; an empty off-hand says so.
    await expect(gear.getByTestId('gear-occupied-weapon1_off')).toHaveText('Occupied by Siege Crossbow');
    await expect(warningsList).toHaveCount(0);

    await pickByName(page, row('Off-hand').getByRole('button').first(), 'Braced Tower Shield');
    await expect(row('Off-hand')).toContainText('Braced Tower Shield');
    await expect(gear.getByTestId('gear-warning-weapon1_off')).toHaveCount(1);
    await expect(gear.getByTestId('gear-warning-weapon1_main')).toHaveCount(0);
    await expect(warningsList).toHaveCount(1);
    await expect(warningsList.first()).toContainText('Siege Crossbow is two-handed');

    // ---- Gear, set II: the other set is free --------------------------------
    await gear.getByRole('button', { name: 'Set II' }).click();
    // Paired positive: set II's two rows are really the ones on screen, empty
    // and NOT occupied — a two-hander in set I says nothing about set II.
    await expect(row('Weapon')).toContainText('Empty');
    await expect(row('Off-hand')).toContainText('Empty');
    await expect(gear.getByTestId('gear-occupied-weapon2_off')).toHaveCount(0);

    // Bow + quiver is legal.
    await pickByName(page, row('Weapon').getByRole('button').first(), 'Crude Bow');
    await pickByName(page, row('Off-hand').getByRole('button').first(), 'Blunt Quiver');
    await expect(row('Off-hand')).toContainText('Blunt Quiver');
    await expect(gear.getByTestId('gear-warning-weapon2_off')).toHaveCount(0);
    await expect(warningsList).toHaveCount(1);

    // A quiver without a bow is not — swap the bow for a dagger.
    await pickByName(page, row('Weapon').getByRole('button').first(), 'Simple Dagger');
    await expect(row('Weapon')).toContainText('Simple Dagger');
    await expect(gear.getByTestId('gear-warning-weapon2_off')).toHaveCount(1);
    await expect(warningsList).toHaveCount(2);
    await expect(warningsList.nth(1)).toContainText('needs a bow');

    // Dual wielding: the widened off-hand offers a dagger, and it is legal.
    await pickByName(page, row('Off-hand').getByRole('button').first(), 'Simple Dagger');
    await expect(row('Off-hand')).toContainText('Simple Dagger');
    await expect(gear.getByTestId('gear-warning-weapon2_off')).toHaveCount(0);
    await expect(warningsList).toHaveCount(1);

    await gear.getByRole('button', { name: 'Close gear sheet' }).click();
    await expect(gear).toBeHidden();

    // ---- Gems: reserved Spirit, set I only ----------------------------------
    await page.getByRole('button', { name: /^Gems/ }).click();
    const gems = page.locator('.fixed.inset-0.z-40').filter({ hasText: 'Gems' });
    await gems.getByRole('button', { name: '+ Add skill' }).click();
    const card = gems.locator('ul > li').first();
    await pickByName(page, card.getByRole('button', { name: /Empty/ }), "Alchemist's Boon");
    await pickByName(page, card.getByRole('button', { name: 'Add support' }), 'Clarity I');
    await expect(card).toContainText('1 / 5 supports');
    // A new loadout is tagged to both sets; untag set II.
    await card.getByRole('button', { name: 'Set II' }).click();
    // 30 (Alchemist's Boon) + 10 (Clarity I), verified against the skill files.
    await expect(gems.getByTestId('spirit-reserved')).toHaveText('Spirit reserved — Set I: 40 · Set II: 0');
    await gems.getByRole('button', { name: 'Close gems sheet' }).click();
    await expect(gems).toBeHidden();

    // ---- Save, then a FULL reload -------------------------------------------
    const name = testBuildName('validation');
    await saveBuild(page, { name, level: 60 });
    expect(await listedBuildNames(page)).toContain(name);
    const href = await page.locator(`a:has-text("${name}")`).getAttribute('href');
    await openTree(page, new URL(href!, 'http://x').searchParams.get('build')!);

    // ---- Everything is derived again from what was saved --------------------
    await page.getByRole('button', { name: 'Gear' }).click();
    await expect(gear).toBeVisible();
    await expect(row('Weapon')).toContainText('Siege Crossbow');
    await expect(row('Off-hand')).toContainText('Braced Tower Shield');
    await expect(gear.getByTestId('gear-warning-weapon1_off')).toHaveCount(1);
    await expect(warningsList).toHaveCount(1);

    // Tap targets with a warning showing: close, two set toggles, 15 slot rows,
    // and the Edit and clear buttons of set I's two equipped weapons (Edit
    // arrived with Slice 4's item editor).
    const taps = await measureTapTargets(page, '.fixed.inset-0.z-40');
    expect(taps.scanned).toBe(22);
    expect(taps.tooSmall, `controls under ${MIN_TAP_PX}px in the gear sheet`).toEqual([]);

    await gear.getByRole('button', { name: 'Set II' }).click();
    await expect(row('Weapon')).toContainText('Simple Dagger');
    await expect(row('Off-hand')).toContainText('Simple Dagger');
    await expect(gear.getByTestId('gear-warning-weapon2_off')).toHaveCount(0);
    await gear.getByRole('button', { name: 'Close gear sheet' }).click();

    await page.getByRole('button', { name: /^Gems/ }).click();
    await expect(gems.getByTestId('spirit-reserved')).toHaveText('Spirit reserved — Set I: 40 · Set II: 0');
  });
});
