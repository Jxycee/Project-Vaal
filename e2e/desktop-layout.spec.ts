import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { cleanupWithFreshPage, gotoBuilds, openTree, testBuildName } from './helpers';

// Copied from build-page.spec.ts — helpers stay test-local here by convention.
const CODE = readFileSync(path.join(__dirname, '..', 'src', 'lib', 'pob', '__fixtures__', 'sample-pob2-code.txt'), 'utf8');

async function importFixture(page: Page, name: string): Promise<void> {
  await gotoBuilds(page);
  await page.getByTestId('open-import-sheet').click();
  const sheet = page.getByTestId('import-sheet');
  await sheet.getByTestId('import-input').fill(CODE);
  await sheet.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(sheet.getByTestId('import-preview')).toBeVisible({ timeout: 60_000 });
  await sheet.getByTestId('import-name').fill(name);
  await sheet.getByRole('button', { name: 'Import', exact: true }).click();
  await page.waitForURL(/\/tree\?build=/, { timeout: 60_000 });
}

/** Imports are owner-only (`unlisted`) and /builds hides the link then, so flip to Private, read it, flip back. */
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

// The reason the `desktop` Playwright project still exists at all.
//
// It used to re-run every persistence spec at 1280px. That bought nothing: the
// whole app carries 43 `md:` utilities, and the part of it those specs drive —
// the tree, the save panel, the gear/jewels/gems sheets — accounts for five of
// them. Every assertion in those specs is about server state, not pixels, so
// the desktop pass re-proved mobile's result at the cost of ~17 extra full
// /tree loads, each one a 5.1MB export fetch and parse.
//
// What IS desktop-only is the shell's sidebar: `md:w-60` in shell-chrome.tsx
// and the matching `md:left-60` that offsets the tree canvas in TreeEditor.tsx.
// Two numbers, in two files, that have to agree, with nothing to notice when
// they stop — the tree would simply render underneath the sidebar. That is what
// this file is for, and playwright.config.ts scopes the desktop project to it.

test.describe('desktop layout', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'desktop project only');
  test.setTimeout(300_000);

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('the tree canvas starts where the sidebar ends', async ({ page }) => {
    await openTree(page);
    // openTree only waits for the dev hook, which PassiveTree installs on
    // mount — pixi attaches its <canvas> a tick later, so measuring straight
    // after it found no canvas and reported "both must be present".
    await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });

    const geometry = await page.evaluate(() => {
      const aside = document.querySelector('aside');
      const canvas = document.querySelector('canvas');
      if (!aside || !canvas) return null;
      const a = aside.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      return {
        sidebarWidth: a.width,
        sidebarRight: a.right,
        canvasLeft: c.left,
        canvasWidth: c.width,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    // Without this, every comparison below would be skipped rather than failed
    // if the sidebar or the canvas stopped rendering.
    expect(geometry, 'the desktop sidebar and the tree canvas must both be present').not.toBeNull();
    expect(geometry!.sidebarWidth, 'the desktop sidebar collapsed').toBeGreaterThan(0);
    expect(geometry!.canvasWidth, 'the tree canvas has no width').toBeGreaterThan(0);

    // 1px of slack for subpixel layout; anything more and the sidebar is
    // sitting on top of the tree.
    expect(geometry!.canvasLeft, 'the tree canvas starts under the sidebar').toBeGreaterThanOrEqual(
      geometry!.sidebarRight - 1,
    );
    expect(geometry!.overflow, 'horizontal overflow on /tree').toBeLessThanOrEqual(0);
  });

  test('no horizontal page scroll on /builds', async ({ page }) => {
    // Cheap by design — no tree mount. The shell's centred `max-w-6xl` column
    // plus the sidebar is the one combination /tree never exercises.
    await gotoBuilds(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal overflow on /builds').toBeLessThanOrEqual(0);
  });

  test('the build page shows the stats rail beside the tab content, with no horizontal scroll', async ({ page }) => {
    const name = testBuildName('page-desktop');
    await importFixture(page, name);
    const token = await readShareToken(page, name);
    await page.goto(`/builds/${token}`);
    const rail = page.getByTestId('stats-rail');
    await expect(rail).toBeVisible({ timeout: 30_000 });
    const content = await page.getByTestId('overview-tab').boundingBox();
    const railBox = await rail.boundingBox();
    expect(railBox!.x, 'the rail is not to the right of the tab content').toBeGreaterThanOrEqual(content!.x + content!.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await expect(rail).toBeHidden();
  });
});
