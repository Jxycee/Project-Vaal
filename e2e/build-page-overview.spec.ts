import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  allocateNodes,
  cleanupWithFreshPage,
  gotoBuilds,
  measureTapTargets,
  nodesNearStart,
  openTree,
  saveBuild,
  testBuildName,
} from './helpers';

// Slice 6 of the build-profile redesign
// (docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md §5.2
// "Overview", §8.1 empty-state CTAs, §10 slice 6; plan
// docs/superpowers/plans/2026-09-28-build-page-slice6-overview.md): the
// Overview tab reads like the build's front page — main skill card, key items
// as a compact icon grid, the checkpoints at a glance, notes — and an empty
// build gets calls to action instead of blank boxes. Written FIRST, before
// the app code, so it fails at the very first `overview-main-skill`
// assertion until slice 6 lands.
//
// Contract this spec pins (ids the implementation must render):
//   - `overview-main-skill`: ONE <button> (the whole card) that opens the
//     Skills tab. Absent on a build with no main skill.
//   - `overview-key-items`: a grid; `overview-key-item`: one <button> per key
//     item, >= 44px, fully inside 0..375, opens the Gear tab.
//   - `overview-checkpoints`: the list, only with 2+ checkpoints; one <Link>
//     (server navigation, current tab kept) per checkpoint.
//   - `overview-notes`: the Notes section (top edge = end of the summary).
//   - `overview-cta-skills` / `overview-cta-gear`: owner-only buttons on an
//     empty build ("Pick your main skill" / "Add gear"). They switch tab
//     in-page — pushState, never a remount — and enter edit mode
//     (replaceState `edit=1`) when not already editing, so unsaved work
//     (a half-typed note) survives the tap.
//   - Height budget: overview-tab top -> overview-notes top <= 812px at
//     375x812 on the 8-checkpoint fixture's last checkpoint.
//
// Reader rule ("a non-owner never sees a CTA") cannot be driven end to end —
// the suite has one account. The implementation renders CTAs only when the
// session's `canEdit` is true and the final review verifies it.
const CODE = readFileSync(path.join(__dirname, '..', 'src', 'lib', 'pob', '__fixtures__', 'sample-pob2-code.txt'), 'utf8');

/** Copied from build-page-skills.spec.ts — imports land on the build page (slice 2). */
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

/** Copied from build-page-skills.spec.ts — imports are owner-only (unlisted), so flip to Private, read it, flip back. */
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

/** `page.goto`, tolerant of one `net::ERR_ABORTED` (Next dev HMR reload race). Copied from build-page-edit.spec.ts. */
async function goto(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url);
  } catch (err) {
    if (!/ERR_ABORTED/.test(String(err))) throw err;
    await page.goto(url);
  }
}

/** The level/league summary line, exactly as build-page.spec.ts locates it. */
function levelLine(page: Page): Locator {
  return page.locator('h1').locator('xpath=following-sibling::p[1]');
}

function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** The current URL's query params, for asserting on `tab`, `edit` and `checkpoint`. */
function params(page: Page): URLSearchParams {
  return new URL(page.url()).searchParams;
}

/** Marks the live document so a later read proves no full navigation or remount of the page happened. */
async function markDocument(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __overviewMarker?: number }).__overviewMarker = 1;
  });
}
async function documentMarked(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as { __overviewMarker?: number }).__overviewMarker === 1);
}

test.describe('build page overview', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  const fixtureName = testBuildName('overview-fixture');
  const emptyName = testBuildName('overview-empty');
  let fixtureToken = '';
  let lastCheckpointId = '';
  let emptyToken = '';

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('fixture overview: main skill, key items grid, checkpoints, notes fit one phone screen', async ({ page }) => {
    await importFixture(page, fixtureName);
    fixtureToken = await readShareToken(page, fixtureName);

    await goto(page, `/builds/${fixtureToken}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('checkpoint-switcher').click();
    const options = page.getByTestId('checkpoint-option');
    await expect(options).toHaveCount(8);
    lastCheckpointId = (await options.last().getAttribute('data-checkpoint-id'))!;
    expect(lastCheckpointId, 'no last checkpoint id read from the switcher').toBeTruthy();

    await goto(page, `/builds/${fixtureToken}?checkpoint=${lastCheckpointId}`);
    const overview = page.getByTestId('overview-tab');
    await expect(overview).toBeVisible({ timeout: 30_000 });

    // Main skill: one card that is a button.
    const mainSkill = page.getByTestId('overview-main-skill');
    await expect(mainSkill).toBeVisible();
    expect(await mainSkill.evaluate((el) => el.tagName), 'the main skill card is not a <button>').toBe('BUTTON');

    // Key items: a grid of tiles, each a comfortable, on-screen tap target.
    await expect(page.getByTestId('overview-key-items')).toBeVisible();
    const tiles = page.getByTestId('overview-key-item');
    const tileCount = await tiles.count();
    expect(tileCount, 'the fixture has no key items').toBeGreaterThanOrEqual(1);
    for (let i = 0; i < tileCount; i++) {
      const box = await tiles.nth(i).boundingBox();
      expect(box, `key item tile ${i} has no bounding box`).not.toBeNull();
      expect(box!.width, `key item tile ${i} narrower than 44px`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `key item tile ${i} shorter than 44px`).toBeGreaterThanOrEqual(44);
      expect(box!.x, `key item tile ${i} left edge off-screen`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `key item tile ${i} right edge off-screen`).toBeLessThanOrEqual(375);
    }

    // Checkpoints: one link per checkpoint, all eight.
    const checkpoints = page.getByTestId('overview-checkpoints');
    await expect(checkpoints).toBeVisible();
    await expect(checkpoints.getByRole('link')).toHaveCount(8);

    // Height budget: the summary above Notes is one screen.
    const overviewBox = await overview.boundingBox();
    const notesBox = await page.getByTestId('overview-notes').boundingBox();
    expect(overviewBox, 'overview-tab has no bounding box').not.toBeNull();
    expect(notesBox, 'overview-notes has no bounding box').not.toBeNull();
    const summaryHeight = notesBox!.y - overviewBox!.y;
    expect(summaryHeight, 'Overview summary above Notes is taller than one 812px screen').toBeLessThanOrEqual(812);

    expect(await horizontalOverflow(page), 'horizontal overflow on Overview').toBeLessThanOrEqual(0);
    const result = await measureTapTargets(page, '[data-testid="overview-tab"]');
    expect(result.scanned, 'nothing was measured on Overview').toBeGreaterThanOrEqual(3);
    expect(result.tooSmall, 'controls under 44px on Overview').toEqual([]);

    // Tapping the main skill card selects the Skills tab, in-page (no reload).
    await markDocument(page);
    await mainSkill.click();
    await expect(page.getByRole('tab', { name: 'Skills', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('skills-tab')).toBeVisible();
    expect(params(page).get('tab')).toBe('skills');
    expect(await documentMarked(page), 'tapping the main skill reloaded the page').toBe(true);
  });

  test('a checkpoint link switches checkpoint and keeps the Overview tab', async ({ page }) => {
    await goto(page, `/builds/${fixtureToken}?checkpoint=${lastCheckpointId}`);
    await expect(page.getByTestId('overview-tab')).toBeVisible({ timeout: 30_000 });
    const before = ((await levelLine(page).textContent()) ?? '').trim();
    expect(before).toContain('Level 94');

    const links = page.getByTestId('overview-checkpoints').getByRole('link');
    await expect(links).toHaveCount(8);
    await links.nth(1).click();

    await expect.poll(() => params(page).get('checkpoint'), { timeout: 30_000 }).not.toBe(lastCheckpointId);
    expect(params(page).get('checkpoint'), 'the URL lost its checkpoint').toBeTruthy();
    await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('overview-tab')).toBeVisible();
    expect(params(page).get('tab'), 'the tab changed with the checkpoint').toBeNull();
    await expect(levelLine(page)).not.toHaveText(before);
    await expect(levelLine(page)).not.toContainText('Level 94');
  });

  test('an empty build shows its owner both CTAs; Add gear opens Gear in edit mode', async ({ page }) => {
    // Seed the way build-page-edit.spec.ts does: allocate a few nodes in the
    // scratch editor and save — no gear, no gems.
    await openTree(page);
    await allocateNodes(page, await nodesNearStart(page, 3));
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/builds') && r.request().method() === 'POST'),
      saveBuild(page, { name: emptyName, level: 20, league: 'Standard' }),
    ]);
    const body = (await response.json()) as { build: { id: string; share_token: string } };
    emptyToken = body.build.share_token;
    expect(emptyToken, 'save response carried no share token').toBeTruthy();

    await goto(page, `/builds/${emptyToken}?edit=1`);
    await expect(page.getByTestId('overview-tab')).toBeVisible({ timeout: 30_000 });

    const ctaSkills = page.getByTestId('overview-cta-skills');
    const ctaGear = page.getByTestId('overview-cta-gear');
    await expect(ctaSkills).toBeVisible();
    await expect(ctaGear).toBeVisible();
    await expect(page.getByTestId('overview-main-skill')).toHaveCount(0);
    await expect(page.getByTestId('overview-key-item')).toHaveCount(0);
    await expect(page.getByText('No skills yet')).toBeVisible();
    await expect(page.getByText('No gear yet')).toBeVisible();
    expect(await horizontalOverflow(page), 'horizontal overflow on an empty Overview').toBeLessThanOrEqual(0);
    const result = await measureTapTargets(page, '[data-testid="overview-tab"]');
    expect(result.tooSmall, 'controls under 44px on an empty Overview').toEqual([]);

    await markDocument(page);
    await ctaGear.click();
    await expect(page.getByRole('tab', { name: 'Gear', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('gear-tab')).toBeVisible();
    expect(params(page).get('tab')).toBe('gear');
    expect(params(page).get('edit')).toBe('1');
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    expect(await documentMarked(page), 'the CTA reloaded the page').toBe(true);
  });

  test('a CTA keeps unsaved notes', async ({ page }) => {
    await goto(page, `/builds/${emptyToken}?edit=1`);
    await expect(page.getByTestId('overview-tab')).toBeVisible({ timeout: 30_000 });

    const notes = page.locator('#build-notes');
    const text = `overview cta notes ${Date.now()}`;
    await notes.fill(text);
    await expect(notes).toHaveValue(text);

    await markDocument(page);
    await page.getByTestId('overview-cta-skills').click();
    await expect(page.getByRole('tab', { name: 'Skills', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('skills-tab')).toBeVisible();
    expect(params(page).get('tab')).toBe('skills');
    expect(params(page).get('edit')).toBe('1');

    await page.getByRole('tab', { name: 'Overview', exact: true }).click();
    await expect(page.getByTestId('overview-tab')).toBeVisible();
    await expect(page.locator('#build-notes')).toHaveValue(text);
    expect(await documentMarked(page), 'the CTA reloaded the page and dropped unsaved work').toBe(true);
    await expect(page.getByTestId('save-status')).toHaveText('Unsaved changes');
  });

  test('an owner in view mode sees the CTAs; tapping one enters edit mode in place', async ({ page }) => {
    await goto(page, `/builds/${emptyToken}`);
    await expect(page.getByTestId('overview-tab')).toBeVisible({ timeout: 30_000 });
    expect(params(page).get('edit')).toBeNull();
    await expect(page.getByTestId('overview-cta-skills')).toBeVisible();
    await expect(page.getByTestId('overview-cta-gear')).toBeVisible();
    // No editor UI yet: read mode.
    await expect(page.locator('#build-notes')).toHaveCount(0);

    await markDocument(page);
    await page.getByTestId('overview-cta-gear').click();
    await expect.poll(() => params(page).get('edit'), { timeout: 15_000 }).toBe('1');
    expect(params(page).get('tab')).toBe('gear');
    await expect(page.getByTestId('gear-tab')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    expect(await documentMarked(page), 'entering edit mode reloaded the page').toBe(true);
  });
});
