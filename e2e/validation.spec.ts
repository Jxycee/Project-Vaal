import { test, expect } from '@playwright/test';
import {
  cleanupWithFreshPage,
  closeGemEditor,
  gearSlotLocator,
  gearWarningItems,
  listedBuildNames,
  measureTapTargets,
  MIN_TAP_PX,
  openEditor,
  openTree,
  pickByName,
  pickGearItem,
  readBuildId,
  saveBuild,
  setGearWeaponSet,
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
    await openEditor(page, 'gear');

    await pickGearItem(page, 'weapon1_main', 'Siege Crossbow');
    // The game draws a two-hander in both slots; an empty off-hand says so.
    await expect(page.getByTestId('gear-occupied-weapon1_off')).toHaveText('Occupied by Siege Crossbow');
    await expect(await gearWarningItems(page)).toHaveCount(0);

    await pickGearItem(page, 'weapon1_off', 'Braced Tower Shield');
    await expect(page.getByTestId('gear-warning-weapon1_off')).toHaveCount(1);
    await expect(page.getByTestId('gear-warning-weapon1_main')).toHaveCount(0);
    await expect(await gearWarningItems(page)).toHaveCount(1);
    await expect((await gearWarningItems(page)).first()).toContainText('Siege Crossbow is two-handed');

    // ---- Gear, set II: the other set is free --------------------------------
    await setGearWeaponSet(page, 2);
    // Paired positive: set II's two cells are really the ones on screen, empty
    // and NOT occupied — a two-hander in set I says nothing about set II.
    await expect(gearSlotLocator(page, 'weapon2_main')).toContainText('Empty');
    await expect(gearSlotLocator(page, 'weapon2_off')).toContainText('Empty');
    await expect(page.getByTestId('gear-occupied-weapon2_off')).toHaveCount(0);

    // Bow + quiver is legal.
    await pickGearItem(page, 'weapon2_main', 'Crude Bow');
    await pickGearItem(page, 'weapon2_off', 'Blunt Quiver');
    await expect(page.getByTestId('gear-warning-weapon2_off')).toHaveCount(0);
    await expect(await gearWarningItems(page)).toHaveCount(1);

    // A quiver without a bow is not — swap the bow for a dagger.
    await pickGearItem(page, 'weapon2_main', 'Simple Dagger');
    await expect(page.getByTestId('gear-warning-weapon2_off')).toHaveCount(1);
    await expect(await gearWarningItems(page)).toHaveCount(2);
    await expect((await gearWarningItems(page)).nth(1)).toContainText('needs a bow');

    // Dual wielding: the widened off-hand offers a dagger, and it is legal.
    await pickGearItem(page, 'weapon2_off', 'Simple Dagger');
    await expect(page.getByTestId('gear-warning-weapon2_off')).toHaveCount(0);
    await expect(await gearWarningItems(page)).toHaveCount(1);

    // ---- Gems: reserved Spirit, set I only ----------------------------------
    await openEditor(page, 'gems');
    await page.getByRole('button', { name: '+ Add skill group' }).click();
    const gems = page.getByTestId('gem-group-sheet');
    await expect(gems).toBeVisible();
    const card = gems.locator('ul > li').first();
    await pickByName(page, card.getByRole('button', { name: /Empty/ }), "Alchemist's Boon");
    await pickByName(page, card.getByRole('button', { name: 'Add support' }), 'Clarity I');
    await expect(card).toContainText('1 / 5 supports');
    // A new loadout is tagged to both sets; untag set II.
    await card.getByRole('button', { name: 'Set II' }).click();
    await closeGemEditor(page);
    // 30 (Alchemist's Boon) + 10 (Clarity I), verified against the skill files:
    // Set I reserves 40 and Set II nothing, on the Skills tab's line and on the
    // Stats tab's per-set view.
    await expect(page.getByTestId('skills-tab')).toContainText('Spirit reserved (Set I): 40');
    await openEditor(page, 'stats');
    const draftStats = page.getByTestId('stats-panel');
    await draftStats.getByRole('button', { name: 'Set I', exact: true }).click();
    await expect(draftStats.getByTestId('stat-spirit')).toContainText('(40 reserved)', { timeout: 30_000 });
    await draftStats.getByRole('button', { name: 'Set II', exact: true }).click();
    await expect(draftStats.getByTestId('stat-spirit')).toContainText('(0 reserved)');

    // ---- Save, then a FULL reload -------------------------------------------
    const name = testBuildName('validation');
    await saveBuild(page, { name, level: 60 });
    expect(await listedBuildNames(page)).toContain(name);
    await openTree(page, await readBuildId(page, name));

    // ---- Everything is derived again from what was saved --------------------
    // A saved build with a share token now reopens on the build page (slice
    // 2's /tree?build= redirect), where gear is the Gear tab's paper doll
    // (slice 4) and gems are the Skills tab's compact rows (slice 5) rather than the old /tree
    // chips. The doll's warning markers are the cells' own, its list is the
    // collapsed `gear-warnings` chip's (expanded by gearWarningItems).
    await openEditor(page, 'gear');
    await setGearWeaponSet(page, 1);
    await expect(gearSlotLocator(page, 'weapon1_main')).toContainText('Siege Crossbow');
    await expect(gearSlotLocator(page, 'weapon1_off')).toContainText('Braced Tower Shield');
    await expect(page.getByTestId('gear-warning-weapon1_off')).toHaveCount(1);
    await expect(await gearWarningItems(page)).toHaveCount(1);

    // Tap targets with a warning showing: the warnings chip, two set toggles,
    // 15 doll cells and "Edit jewels". No sheet, so nothing else is open.
    const taps = await measureTapTargets(page, '[data-testid="gear-tab"]');
    expect(taps.scanned).toBe(19);
    expect(taps.tooSmall, `controls under ${MIN_TAP_PX}px on the Gear tab`).toEqual([]);

    await setGearWeaponSet(page, 2);
    await expect(gearSlotLocator(page, 'weapon2_main')).toContainText('Simple Dagger');
    await expect(gearSlotLocator(page, 'weapon2_off')).toContainText('Simple Dagger');
    await expect(page.getByTestId('gear-warning-weapon2_off')).toHaveCount(0);

    // Gems: the Skills tab's spirit line reads the headline set (the main
    // skill's first tagged set, here Set I) — 40 reserved, and the one group
    // carries only the Set I dot, so Set II reserves nothing.
    const skills = await openEditor(page, 'gems');
    if (!skills) throw new Error('openEditor("gems") returned no locator — not on the build page?');
    await expect(skills).toContainText('Spirit reserved (Set I): 40');
    await expect(skills.getByTestId('skill-row')).toHaveCount(1);
    await expect(skills.getByTestId('skill-set-dot')).toHaveCount(1);
    await expect(skills.getByTestId('skill-set-dot')).toHaveAttribute('data-set', '1');

    // Exact per-set check through the Stats tab: Set I reserves 40, Set II nothing.
    await openEditor(page, 'stats');
    const statsPanel = page.getByTestId('stats-panel');
    await statsPanel.getByRole('button', { name: 'Set I', exact: true }).click();
    await expect(statsPanel.getByTestId('stat-spirit')).toContainText('(40 reserved)', { timeout: 30_000 });
    await statsPanel.getByRole('button', { name: 'Set II', exact: true }).click();
    await expect(statsPanel.getByTestId('stat-spirit')).toContainText('(0 reserved)');
  });
});
