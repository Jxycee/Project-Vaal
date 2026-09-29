import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  cleanupWithFreshPage,
  closeGemEditor,
  gearSlotLocator,
  gotoBuilds,
  listedBuildNames,
  measureTapTargets,
  MIN_TAP_PX,
  openEditor,
  openGemGroup,
  openTree,
  pickGearItem,
  readShareToken,
  saveBuild,
  selectGearSlot,
  softOpenBuild,
  testBuildName,
  waitForTreeApi,
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

    // ---- Resting state on a fresh build -----------------------------------
    // Each tab shows its section even with nothing in it, so that the user can
    // see it exists at all — these are that promise.
    await openEditor(page, 'gear');
    await expect(page.getByText('No jewels recorded.')).toBeVisible();
    await openEditor(page, 'gems');
    await expect(page.getByTestId('skill-row')).toHaveCount(0);

    // ---- Gear: equip boots, and equip-then-clear a belt --------------------
    await openEditor(page, 'gear');
    await expect(gearSlotLocator(page, 'boots')).toContainText('Empty');
    const bootsName = await pickGearItem(page, 'boots');

    // The belt is deliberately equipped and then cleared. Asserting only "the
    // belt comes back Empty" after the reload would pass just as happily if
    // gear had not been saved at all — an unsaved build has an empty belt too.
    // It is the boots assertion further down that makes this one mean
    // "clearing persisted" rather than "nothing persisted".
    await pickGearItem(page, 'belt');
    // The clear button only renders once a slot is equipped.
    await page.getByTestId('gear-slot-detail').getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(gearSlotLocator(page, 'belt')).toContainText('Empty');

    // ---- Jewels: allocate a socket on the canvas, then fill it -------------
    // The tree is a WebGL canvas with no DOM per node, so allocation goes
    // through the dev-only hook (see src/lib/tree/testApi.ts), which exists
    // only while the Tree tab is showing.
    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await waitForTreeApi(page);
    const socketId = await page.evaluate(() => window.__vaalTree!.jewelSockets()[0]);
    expect(typeof socketId, 'the tree export exposed no jewel sockets').toBe('number');
    await page.evaluate((id) => window.__vaalTree!.allocate(id), socketId);

    await openEditor(page, 'jewels');
    const jewelsSheet = page.locator('.z-40').filter({ hasText: 'Jewels' });
    await expect(jewelsSheet).toBeVisible();
    // One allocated socket, nothing in it: the sheet's "0 of 1 filled".
    await expect(jewelsSheet.locator('ul li')).toHaveCount(1);
    const socketRow = jewelsSheet.locator('ul li').first();
    await expect(socketRow).toContainText('Empty');
    await expect(page.getByTestId('gear-tab')).toContainText('No jewels recorded.');
    const jewelName = await pickFirstItem(page, socketRow.getByRole('button').first(), socketRow);

    // ...and now "1 of 1 filled": the same single socket, holding the jewel.
    await expect(jewelsSheet.locator('ul li')).toHaveCount(1);
    await expect(socketRow).toContainText(jewelName);
    await expect(socketRow).not.toContainText('Empty');

    await jewelsSheet.getByRole('button', { name: 'Close jewels sheet' }).click();
    await expect(jewelsSheet).toBeHidden();
    await expect(page.getByTestId('gear-tab')).toContainText(jewelName);
    await expect(page.getByTestId('gear-tab')).not.toContainText('No jewels recorded.');

    // ---- Gems: a loadout with a support, marked as the main skill ----------
    await openEditor(page, 'gems');
    await page.getByRole('button', { name: '+ Add skill group' }).click();
    const gemsSheet = page.getByTestId('gem-group-sheet');
    await expect(gemsSheet).toBeVisible();
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

    await closeGemEditor(page);
    await expect(page.getByTestId('skill-row')).toHaveCount(1);

    // ---- Save once, with notes ----------------------------------------------
    const name = testBuildName('loadout');
    const notes = 'e2e loadout-persistence notes check';
    await saveBuild(page, { name, level: 15, league: 'Standard', notes });
    expect(await listedBuildNames(page)).toContain(name);

    // Real navigation into the saved row rather than a poll of in-memory
    // state: this is the /api/builds round trip plus the server-component load
    // path, and both have to carry gear_state and gem_state for any of the
    // assertions below to mean anything.
    await softOpenBuild(page, await readShareToken(page, name));

    // ---- Everything is still there -----------------------------------------
    // Gear is the Gear tab's paper doll (slice 4): the slot holders are doll
    // cells, and there is no sheet to close.
    await openEditor(page, 'gear');
    await expect(gearSlotLocator(page, 'boots')).toContainText(bootsName);
    await expect(gearSlotLocator(page, 'belt')).toContainText('Empty');

    // The socket row only exists if the passive allocation came back too, so
    // this quietly covers the tree half of the payload as well.
    await openEditor(page, 'jewels');
    const reopenedJewels = page.locator('.z-40').filter({ hasText: 'Jewels' });
    // Still one allocated socket, still filled ("1 of 1"), after a reload.
    await expect(reopenedJewels.locator('ul li')).toHaveCount(1);
    await expect(reopenedJewels.locator('ul li').first()).toContainText(jewelName);
    await expect(reopenedJewels.locator('ul li').first()).not.toContainText('Empty');
    await reopenedJewels.getByRole('button', { name: 'Close jewels sheet' }).click();
    await expect(reopenedJewels).toBeHidden();

    await openEditor(page, 'gems');
    // The groups are compact rows and the editor is a one-group sheet
    // (slice 5); the card inside is the GemLoadoutEditor.
    const reopenedCard = await openGemGroup(page, 0);
    await expect(reopenedCard).toContainText(skillName);
    await expect(reopenedCard).toContainText(supportName);
    await expect(reopenedCard.getByRole('button', { name: 'Main skill' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Gem level, set to 5 before the save above (default is 1 — see
    // gemState.ts — so this proves the round trip, not just the default).
    await expect(reopenedCard.getByRole('spinbutton').first()).toHaveValue('5');

    await closeGemEditor(page);

    // Notes, saved above: they live on Overview, and #build-notes is on screen
    // as soon as that tab is selected.
    await page.getByRole('tab', { name: 'Overview', exact: true }).click();
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

// A pick waits for the item's icon (its wiki detail file) before it lands.
// Closing the picker in that window used to be ignored: the pick landed a
// moment later anyway — replacing whatever was in the slot, craft and all —
// and its stale close then shut whichever picker was open by then
// (review 2026-09-26). The detail fetch is held back here so the window is
// wide enough to act in.
test('a pick cancelled while its icon loads never lands, and closes nothing else', async ({ page }) => {
  await openTree(page);
  await page.route('**/data/wiki/**/items/*.json', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await route.continue();
  });

  await openEditor(page, 'gear');
  await expect(gearSlotLocator(page, 'belt')).toContainText('Empty');

  const picker = page.locator('.z-50');
  await selectGearSlot(page, 'belt');
  await page.getByTestId('gear-slot-detail').getByRole('button', { name: 'Choose item', exact: true }).click();
  const firstResult = picker.locator('ul li button').first();
  await expect(firstResult).toBeVisible({ timeout: 15_000 });
  await firstResult.click();
  await page.getByRole('button', { name: 'Close item picker' }).click();

  // Open another picker while the cancelled pick's icon is still loading.
  await selectGearSlot(page, 'gloves');
  await page.getByTestId('gear-slot-detail').getByRole('button', { name: 'Choose item', exact: true }).click();
  await expect(picker.getByPlaceholder('Search items…')).toBeVisible();

  // Past the held-back fetch: the belt is still empty and the gloves picker still open.
  await page.waitForTimeout(4_500);
  await expect(picker.getByPlaceholder('Search items…')).toBeVisible();
  await expect(gearSlotLocator(page, 'belt')).toContainText('Empty');
});
