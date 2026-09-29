import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Locator, type Page } from '@playwright/test';
import { cleanupWithFreshPage, gotoBuilds, measureTapTargets, testBuildName } from './helpers';

// Slice 5 of the build-profile redesign
// (docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md §5.2
// "Skills row", §10 slice 5; plan
// docs/superpowers/plans/2026-09-28-build-page-slice5-skills-rows.md): the
// Skills tab's stacked LoadoutCards (and the full-screen GemsSheet behind
// "Edit skills") are replaced by compact one-line rows, main skill first.
// Tapping a row shows its supports inline (read mode) or opens an editor for
// just that group (edit mode). Written FIRST — the app code lands in task 3 of
// the plan, so every test below is expected to fail until then, starting at
// the very first `skill-row` assertion, which does not exist yet.
//
// Contract this spec pins (plan Global Constraints):
//   - `skill-row` on one <button> per gem group, <= 64px tall at 375px, fully
//     inside 0..375, aria-label "<skill or Empty group>, level <n>, <k>
//     supports". The main skill's row is first and carries a badge whose text
//     is exactly "Main".
//   - Read mode: tapping a row toggles an inline `skill-detail` under it, one
//     open at a time, with one `skill-support` per support. No sheet, no
//     "+ Add skill group".
//   - Edit mode: tapping a row opens `gem-group-sheet` (close button "Close
//     skill group") holding the per-group editor GemsSheet's cards use today
//     (level spinbutton first, "/ max" cap text, skill button "Empty" when
//     unfilled, "Remove skill <n>"). "+ Add skill group" opens it on a fresh
//     empty group. Removing the group closes the sheet.
//
// Uses the 8-checkpoint PoB fixture pob-import.spec.ts already proves — its
// LAST checkpoint (level 94) has 5 skill groups / 20 gems (5-support groups
// with long names — the layout's worst case).
const CODE = readFileSync(path.join(__dirname, '..', 'src', 'lib', 'pob', '__fixtures__', 'sample-pob2-code.txt'), 'utf8');

/** Copied from build-page-gear.spec.ts — imports now land on the build page (slice 2). */
async function importFixture(page: Page, name: string): Promise<void> {
  await gotoBuilds(page);
  await page.getByTestId('open-import-sheet').click();
  const sheet = page.getByTestId('import-sheet');
  await sheet.getByTestId('import-input').fill(CODE);
  await sheet.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(sheet.getByTestId('import-preview')).toBeVisible({ timeout: 60_000 });
  await sheet.getByTestId('import-name').fill(name);
  await sheet.getByRole('button', { name: 'Import', exact: true }).click();
  await page.waitForURL(/\/(tree\?build=[0-9a-f-]{36}|builds\/)/, { timeout: 60_000 });
}

/** Copied from build-page-gear.spec.ts — imports are owner-only (unlisted), so flip to Private, read it, flip back. */
async function readShareToken(page: Page, name: string): Promise<string> {
  await page.goto('/builds');
  const row = page.locator('ul > li').filter({ has: page.locator(`a:has-text("${name}")`) }).first();
  await expect(row).toBeVisible();
  await row.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Private' }).click();
  const link = row.locator('a[href^="/builds/"]');
  await expect(link).toBeVisible({ timeout: 30_000 });
  const href = (await link.getAttribute('href'))!;
  await row.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Unlisted' }).click();
  await expect(link).toBeHidden({ timeout: 30_000 });
  return href.replace('/builds/', '');
}

/** `page.goto`, tolerant of one `net::ERR_ABORTED` (Next dev HMR reload race). Copied from build-page-gear.spec.ts. */
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

/** Opens the picker from `opener` and takes the first result, returning its name (minus the picker's " Unique" suffix). Same shape as sharing.spec.ts's pickFirstItem. */
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

/** A row's skill name: the aria-label up to ", level". */
async function rowName(row: Locator): Promise<string> {
  const label = (await row.getAttribute('aria-label')) ?? '';
  return label.replace(/, level \d+, \d+ supports?$/, '');
}

test.describe('build page skill rows', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  const name = testBuildName('skill-rows');
  let token = '';
  let lastCheckpointId = '';

  const readUrl = () => `/builds/${token}?checkpoint=${lastCheckpointId}&tab=skills`;
  const editUrl = () => `/builds/${token}?edit=1&tab=skills&checkpoint=${lastCheckpointId}`;

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('five compact rows fit a phone, main skill first', async ({ page }) => {
    await importFixture(page, name);
    token = await readShareToken(page, name);

    await goto(page, `/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('checkpoint-switcher').click();
    const options = page.getByTestId('checkpoint-option');
    await expect(options).toHaveCount(8);
    lastCheckpointId = (await options.last().getAttribute('data-checkpoint-id'))!;
    expect(lastCheckpointId, 'no last checkpoint id read from the switcher').toBeTruthy();

    await goto(page, readUrl());
    await expect(page.getByTestId('skills-tab')).toBeVisible({ timeout: 30_000 });
    const mainSkill = ((await page.getByTestId('build-main-skill').textContent()) ?? '').trim();
    expect(mainSkill.length, 'the imported fixture has no main skill in the header').toBeGreaterThan(0);

    const rows = page.getByTestId('skill-row');
    await expect(rows).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      const box = await rows.nth(i).boundingBox();
      expect(box, `skill row ${i} has no bounding box`).not.toBeNull();
      expect(box!.height, `skill row ${i} taller than 64px`).toBeLessThanOrEqual(64);
      expect(box!.x, `skill row ${i} left edge off-screen`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `skill row ${i} right edge off-screen`).toBeLessThanOrEqual(375);
    }
    expect(await horizontalOverflow(page), 'horizontal overflow on the Skills tab').toBeLessThanOrEqual(0);

    // The first row is the main skill: badge "Main" plus the header's name.
    await expect(rows.first().getByText('Main', { exact: true })).toBeVisible();
    await expect(rows.first()).toContainText(mainSkill);

    const result = await measureTapTargets(page, '[data-testid="skills-tab"]');
    expect(result.scanned, 'nothing was measured on the Skills tab').toBeGreaterThanOrEqual(5);
    expect(result.tooSmall, 'controls under 44px on the Skills tab').toEqual([]);
  });

  test('read mode: a tap shows the supports inline, one at a time, with no editor', async ({ page }) => {
    await goto(page, readUrl());
    await expect(page.getByTestId('skills-tab')).toBeVisible({ timeout: 30_000 });
    const rows = page.getByTestId('skill-row');
    await expect(rows).toHaveCount(5);

    // Precondition (fixture): row 2 really has supports, so the detail assertion below is not vacuous.
    const label2 = (await rows.nth(1).getAttribute('aria-label')) ?? '';
    const supports2 = Number(label2.match(/, (\d+) supports?$/)?.[1] ?? '0');
    expect(supports2, `row 2 ("${label2}") has no supports in the fixture`).toBeGreaterThanOrEqual(1);

    await expect(page.getByTestId('skill-detail')).toHaveCount(0);
    await rows.nth(1).click();
    const detail = page.getByTestId('skill-detail');
    await expect(detail).toHaveCount(1);
    await expect(detail).toBeVisible();
    await expect(detail.getByTestId('skill-support')).toHaveCount(supports2);
    const firstSupport = ((await detail.getByTestId('skill-support').first().textContent()) ?? '').trim();
    expect(firstSupport.length, 'the detail lists a support with no name').toBeGreaterThan(0);

    // Tapping another row moves the detail rather than stacking a second one.
    await rows.nth(2).click();
    await expect(detail).toHaveCount(1);
    await expect(detail).toBeVisible();

    // A reader gets no editor and no add button.
    await expect(page.getByTestId('gem-group-sheet')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '+ Add skill group' })).toHaveCount(0);
    expect(await horizontalOverflow(page), 'horizontal overflow with a detail open').toBeLessThanOrEqual(0);
  });

  test('edit mode: a level edit in the group sheet survives Save and a reload', async ({ page }) => {
    await goto(page, editUrl());
    await expect(page.getByTestId('skills-tab')).toBeVisible({ timeout: 30_000 });
    const rows = page.getByTestId('skill-row');
    await expect(rows).toHaveCount(5);

    await rows.first().click();
    const sheet = page.getByTestId('gem-group-sheet');
    await expect(sheet).toBeVisible();

    // The cap text ("/ 20") arrives from the gem's wiki data; wait for it so the value below is within it.
    const capText = sheet.getByText(/^\/ \d+$/);
    await expect(capText).toBeVisible({ timeout: 30_000 });
    const max = Number(((await capText.textContent()) ?? '').replace('/', '').trim());
    expect(max, 'no gem level cap shown').toBeGreaterThan(1);

    const levelInput = sheet.getByRole('spinbutton').first();
    const current = Number(await levelInput.inputValue());
    const next = current > 1 ? current - 1 : 2;
    expect(next, 'chose a level equal to the current one').not.toBe(current);
    expect(next, 'chose a level above the gem cap').toBeLessThanOrEqual(max);
    await levelInput.fill(String(next));
    await expect(levelInput).toHaveValue(String(next));

    await sheet.getByRole('button', { name: 'Close skill group' }).click();
    await expect(sheet).toBeHidden();
    await expect(rows.first()).toHaveAttribute('aria-label', new RegExp(`level ${next}\\b`));

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('save-status')).toHaveText(/^Saved /, { timeout: 30_000 });

    await goto(page, readUrl());
    await expect(page.getByTestId('skills-tab')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('skill-row').first()).toHaveAttribute('aria-label', new RegExp(`level ${next}\\b`));
  });

  test('edit mode: + Add skill group opens the sheet on an empty group; the picked skill persists', async ({ page }) => {
    await goto(page, editUrl());
    await expect(page.getByTestId('skills-tab')).toBeVisible({ timeout: 30_000 });
    const rows = page.getByTestId('skill-row');
    await expect(rows).toHaveCount(5);

    await page.getByRole('button', { name: '+ Add skill group' }).click();
    const sheet = page.getByTestId('gem-group-sheet');
    await expect(sheet).toBeVisible();
    // The new group is empty: its skill button still says "Empty".
    const emptySkillButton = sheet.getByRole('button', { name: /Empty/ });
    await expect(emptySkillButton).toBeVisible();

    const picked = await pickFirstResult(page, emptySkillButton);
    await expect(sheet).toContainText(picked);

    await sheet.getByRole('button', { name: 'Close skill group' }).click();
    await expect(sheet).toBeHidden();
    await expect(rows).toHaveCount(6);

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('save-status')).toHaveText(/^Saved /, { timeout: 30_000 });

    await goto(page, readUrl());
    await expect(page.getByTestId('skills-tab')).toBeVisible({ timeout: 30_000 });
    await expect(rows).toHaveCount(6);
    await expect(rows.filter({ hasText: picked }).first()).toBeVisible();
  });

  test('edit mode: removing the main group moves the Main badge to the next skill', async ({ page }) => {
    await goto(page, editUrl());
    await expect(page.getByTestId('skills-tab')).toBeVisible({ timeout: 30_000 });
    const rows = page.getByTestId('skill-row');
    await expect(rows).toHaveCount(6);

    const removed = await rowName(rows.first());
    expect(removed.length, 'the first row has no skill name').toBeGreaterThan(0);
    const labelsBefore = await rows.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
    const namedRemovedBefore = labelsBefore.filter((l) => l.startsWith(`${removed}, level`)).length;

    await rows.first().click();
    const sheet = page.getByTestId('gem-group-sheet');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: /^Remove skill \d+$/ }).click();
    // Removing the group closes its sheet.
    await expect(sheet).toBeHidden();
    await expect(rows).toHaveCount(5);

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('save-status')).toHaveText(/^Saved /, { timeout: 30_000 });

    await goto(page, readUrl());
    await expect(page.getByTestId('skills-tab')).toBeVisible({ timeout: 30_000 });
    await expect(rows).toHaveCount(5);

    const labelsAfter = await rows.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
    const namedRemovedAfter = labelsAfter.filter((l) => l.startsWith(`${removed}, level`)).length;
    expect(namedRemovedAfter, `the removed skill "${removed}" is still listed`).toBe(namedRemovedBefore - 1);

    // The badge is now on the first row only, and that row is the header's main skill.
    const newMain = ((await page.getByTestId('build-main-skill').textContent()) ?? '').trim();
    expect(newMain.length, 'no main skill in the header after the removal').toBeGreaterThan(0);
    await expect(rows.first().getByText('Main', { exact: true })).toBeVisible();
    await expect(rows.first()).toContainText(newMain);
    expect(await rowName(rows.first()), 'the first row is not the header main skill').toBe(newMain);
    await expect(page.getByTestId('skills-tab').getByText('Main', { exact: true })).toHaveCount(1);
  });
});
