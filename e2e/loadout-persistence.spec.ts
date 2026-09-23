import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  MIN_TAP_PX,
  cleanupWithFreshPage,
  gotoBuilds,
  listedBuildNames,
  measureTapTargets,
  openTree,
  saveBuild,
  softNavigate,
  testBuildName,
} from './helpers';

// Regression cover for everything the build editor hangs off the tree — gear,
// jewels and gem loadouts — surviving a real save and a real reload. Writes one
// row to the production-linked Supabase project under the shared test account;
// deleted in afterAll.
//
// One test, not three, because there is only one thing being proved. Gear,
// jewels and gems are not three round trips: gear and jewels share the
// `gear_state` column (jewels live under `gear_state.jewels`), gems are
// `gem_state`, and TreeBuildSession's handleSave posts all of them in a single
// body. Three specs each doing equip -> save -> reopen therefore re-proved the
// same POST /api/builds and the same server-component load path three times
// over, at the price of four extra full /tree loads — and each of those refetches
// and reparses the 5.1MB GGG export. What is genuinely per-panel is everything
// BEFORE the save: the chip's resting label, the picker wiring, the clear and
// main-skill transitions. Those cost nothing extra to do on one page.
//
// Drives the real UI (chip -> row -> item picker -> pick) rather than writing
// the state columns directly, so a break anywhere in that chain — the picker's
// search request, the icon lookup at pick time, a sheet's own state, the save
// payload — fails here instead of being invisible.
//
// Which projects run this is decided in playwright.config.ts, not here: none of
// these sheets has an `md:` branch, so the desktop project deliberately does not
// run it.

/**
 * Opens the item picker from `opener`, takes the first result, and returns its
 * name once `subject` is showing it.
 *
 * Shared because all three panels reuse ItemPickerSheet, including its habit of
 * appending a " Unique" badge to the row's name — stripped here so the returned
 * name matches what the equipped row (rendered the same way) will show.
 */
async function pickFirstItem(page: Page, opener: Locator, subject: Locator): Promise<string> {
  await opener.click();

  // The picker layers on top of the sheet that opened it, at z-50.
  const picker = page.locator('.z-50');
  await expect(picker.getByPlaceholder('Search items…')).toBeVisible();
  const firstResult = picker.locator('ul li button').first();
  await expect(firstResult).toBeVisible({ timeout: 15_000 });

  const raw = (await firstResult.locator('span.truncate').first().textContent()) ?? '';
  const name = raw.replace(/\s*Unique\s*$/, '').trim();
  expect(name.length, 'the picker returned a result with no name').toBeGreaterThan(0);

  await firstResult.click();
  // Picking closes the picker and leaves the sheet underneath open.
  await expect(picker.getByPlaceholder('Search items…')).toBeHidden();
  await expect(subject).toContainText(name);
  return name;
}

test.describe('loadout persistence', () => {
  // This spec deliberately does in one pass what three separate specs used to
  // do in three: gear, a socketed jewel and a gem loadout, through one save and
  // one reload. That is the point — one POST and one server-component load
  // instead of three — but it also means one test legitimately runs longer than
  // the 180s per-test default, which it was overrunning.
  test.setTimeout(420_000);

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('gear, a socketed jewel and a gem loadout all survive one save and reload', async ({
    page,
  }, testInfo) => {
    await openTree(page);

    const gearChip = page.getByRole('button', { name: 'Gear' });
    const jewelsChip = page.getByRole('button', { name: /^Jewels/ });
    const gemsChip = page.getByRole('button', { name: /^Gems/ });

    // ---- Resting state on a fresh tree ------------------------------------
    // Each chip is always rendered, even with nothing in it, so that the user
    // can see the section exists at all — these labels are that promise.
    await expect(jewelsChip).toContainText('allocate a socket on the tree');
    await expect(gemsChip).toContainText('add a skill');

    // ---- Gear: equip boots, and equip-then-clear a belt --------------------
    await gearChip.click();
    const gearSheet = page.locator('.z-40');
    await expect(gearSheet).toBeVisible();

    const bootsRow = gearSheet.locator('ul li').filter({ hasText: 'Boots' }).first();
    await expect(bootsRow).toContainText('Empty');
    const bootsName = await pickFirstItem(page, bootsRow.getByRole('button').first(), bootsRow);

    // The belt is deliberately equipped and then cleared. Asserting only "the
    // belt comes back Empty" after the reload would pass just as happily if
    // gear had not been saved at all — an unsaved build has an empty belt too.
    // It is the boots assertion further down that makes this one mean
    // "clearing persisted" rather than "nothing persisted".
    const beltRow = gearSheet.locator('ul li').filter({ hasText: 'Belt' }).first();
    await pickFirstItem(page, beltRow.getByRole('button').first(), beltRow);
    // The clear ("x") button only renders once a slot is equipped.
    await beltRow.getByRole('button', { name: /^Clear/ }).click();
    await expect(beltRow).toContainText('Empty');

    await gearSheet.getByRole('button', { name: 'Close gear sheet' }).click();
    await expect(gearSheet).toBeHidden();

    // ---- Jewels: allocate a socket on the canvas, then fill it -------------
    // The tree is a WebGL canvas with no DOM per node, so allocation goes
    // through the dev-only hook (see src/lib/tree/testApi.ts).
    const socketId = await page.evaluate(() => window.__vaalTree!.jewelSockets()[0]);
    expect(typeof socketId, 'the tree export exposed no jewel sockets').toBe('number');
    await page.evaluate((id) => window.__vaalTree!.allocate(id), socketId);
    await expect(jewelsChip).toContainText('Jewels 0/1');

    await jewelsChip.click();
    const jewelsSheet = page.locator('.z-40').filter({ hasText: 'Jewels' });
    await expect(jewelsSheet).toBeVisible();
    const socketRow = jewelsSheet.locator('ul li').first();
    await expect(socketRow).toContainText('Empty');
    const jewelName = await pickFirstItem(page, socketRow.getByRole('button').first(), socketRow);

    await jewelsSheet.getByRole('button', { name: 'Close jewels sheet' }).click();
    await expect(jewelsSheet).toBeHidden();
    await expect(jewelsChip).toContainText('Jewels 1/1');

    // ---- Gems: a loadout with a support, marked as the main skill ----------
    await gemsChip.click();
    const gemsSheet = page.locator('.z-40').filter({ hasText: 'Gems' });
    await expect(gemsSheet).toBeVisible();
    await expect(gemsSheet).toContainText('No skills yet.');

    await gemsSheet.getByRole('button', { name: '+ Add skill' }).click();
    const card = gemsSheet.locator('ul > li').first();
    await expect(card).toBeVisible();

    const skillName = await pickFirstItem(page, card.getByRole('button', { name: /Empty/ }), card);
    await expect(card).not.toContainText('Empty');

    const supportName = await pickFirstItem(
      page,
      card.getByRole('button', { name: 'Add support' }),
      card,
    );
    await expect(card).toContainText('1 / 5 supports');

    const mainSkillButton = card.getByRole('button', { name: 'Main skill' });
    await expect(mainSkillButton).toBeEnabled();
    await mainSkillButton.click();
    await expect(mainSkillButton).toHaveAttribute('aria-pressed', 'true');

    // Gem level: default is 1 (see gemState.ts) — set it to something else so
    // the reload assertion below actually proves persistence rather than
    // just re-observing the default.
    const levelInput = card.getByRole('spinbutton').first();
    await levelInput.fill('5');
    await expect(levelInput).toHaveValue('5');

    await gemsSheet.getByRole('button', { name: 'Close gems sheet' }).click();
    await expect(gemsSheet).toBeHidden();
    await expect(gemsChip).toContainText('Gems 1');

    // ---- Save once, with notes ----------------------------------------------
    const name = testBuildName('loadout');
    const notes = 'e2e loadout-persistence notes check';
    await saveBuild(page, { name, level: 15, league: 'Standard', notes });
    expect(await listedBuildNames(page)).toContain(name);

    // Real navigation into the saved row rather than a poll of in-memory
    // state: this is the /api/builds round trip plus the server-component load
    // path, and both have to carry gear_state and gem_state for any of the
    // assertions below to mean anything.
    const href = await page.locator(`a:has-text("${name}")`).getAttribute('href');
    await softNavigate(page, href!);

    // ---- Everything is still there -----------------------------------------
    await expect(page.getByRole('button', { name: /^Jewels/ })).toContainText('Jewels 1/1');
    await expect(page.getByRole('button', { name: /^Gems/ })).toContainText('Gems 1');

    await page.getByRole('button', { name: 'Gear' }).click();
    const reopenedGear = page.locator('.z-40');
    await expect(reopenedGear).toBeVisible();
    await expect(reopenedGear.locator('ul li').filter({ hasText: 'Boots' }).first()).toContainText(
      bootsName,
    );
    await expect(reopenedGear.locator('ul li').filter({ hasText: 'Belt' }).first()).toContainText(
      'Empty',
    );
    await reopenedGear.getByRole('button', { name: 'Close gear sheet' }).click();
    await expect(reopenedGear).toBeHidden();

    // The socket row only exists if the passive allocation came back too, so
    // this quietly covers the tree half of the payload as well.
    await page.getByRole('button', { name: /^Jewels/ }).click();
    const reopenedJewels = page.locator('.z-40').filter({ hasText: 'Jewels' });
    await expect(reopenedJewels.locator('ul li').first()).toContainText(jewelName);
    await reopenedJewels.getByRole('button', { name: 'Close jewels sheet' }).click();
    await expect(reopenedJewels).toBeHidden();

    await page.getByRole('button', { name: /^Gems/ }).click();
    const reopenedGems = page.locator('.z-40').filter({ hasText: 'Gems' });
    const reopenedCard = reopenedGems.locator('ul > li').first();
    await expect(reopenedCard).toContainText(skillName);
    await expect(reopenedCard).toContainText(supportName);
    await expect(reopenedCard.getByRole('button', { name: 'Main skill' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Gem level, set to 5 before the save above (default is 1 — see
    // gemState.ts — so this proves the round trip, not just the default).
    await expect(reopenedCard.getByRole('spinbutton').first()).toHaveValue('5');

    await reopenedGems.getByRole('button', { name: 'Close gems sheet' }).click();
    await expect(reopenedGems).toBeHidden();

    // Notes, saved above — the save panel is the metadata surface (name,
    // level, league) and is collapsed to a chip by default; open it back up.
    await page.getByRole('button', { name: 'Saved build' }).click();
    await expect(page.locator('#build-notes')).toHaveValue(notes);

    // Tap targets on a POPULATED /builds. mobile-layout.spec.ts scans that
    // page too, but cleanup leaves the account empty, so there it only ever
    // measures the empty state — which is how a 24px-tall build-name link,
    // the primary action on the page, survived every previous green run. This
    // spec already has a saved build, so the scan costs nothing extra here.
    if (testInfo.project.name === 'mobile') {
      await gotoBuilds(page);
      const result = await measureTapTargets(page, 'main');
      expect(result.scanned, 'nothing was measured on /builds').toBeGreaterThan(0);
      expect(result.tooSmall, `controls under ${MIN_TAP_PX}px on a populated /builds`).toEqual([]);
    }
  });
});
