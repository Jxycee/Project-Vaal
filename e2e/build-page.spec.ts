import { test, expect, type Page, type Request } from '@playwright/test';
import {
  cleanupWithFreshPage,
  importFixture,
  measureTapTargets,
  MIN_TAP_PX,
  testBuildName,
} from './helpers';

// Slice 1 of the build-profile redesign (specs/2026-09-27-build-profile-
// redesign-design.md): /builds/[shareToken] becomes one tabbed page for the
// owner and readers. Seeded with the 8-checkpoint PoB fixture pob-import.spec
// already proves (first checkpoint level 31, last level 94 with Life 2692).
const TABS = ['Overview', 'Gear', 'Skills', 'Tree', 'Stats'] as const;

async function openTab(page: Page, tab: (typeof TABS)[number]): Promise<void> {
  await page.getByRole('tab', { name: tab, exact: true }).click();
  await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId(`${tab.toLowerCase()}-tab`)).toBeVisible();
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe('build page (read mode)', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  const name = testBuildName('page');
  let token = '';

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('owner opens their own owner-only build, and tabs switch without a server round trip', async ({ page }) => {
    token = await importFixture(page, name);

    await page.goto(`/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    // Owner URL names its checkpoint, so reorders cannot move the page under the owner.
    await expect(page).toHaveURL(/[?&]checkpoint=[0-9a-f-]{36}/);
    await expect(page.getByTestId('build-author')).toHaveText('You');
    await expect(page.getByTestId('build-visibility')).toContainText('Unlisted');
    await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');

    const serverHits: string[] = [];
    const onRequest = (r: Request) => {
      if (r.resourceType() === 'document' || 'rsc' in r.headers() || r.url().includes('_rsc=')) serverHits.push(r.url());
    };
    page.on('request', onRequest);
    for (const tab of ['Gear', 'Skills', 'Stats', 'Overview', 'Gear'] as const) await openTab(page, tab);
    page.off('request', onRequest);
    expect(serverHits, 'a tab switch reached the server').toEqual([]);
    await expect(page).toHaveURL(/[?&]tab=gear/);

    // Back returns to the previous TAB, not the previous page.
    await page.goBack();
    await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(new RegExp(`/builds/${token}`));
  });

  test('a deep link lands on the named tab and checkpoint', async ({ page }) => {
    await page.goto(`/builds/${token}`);
    await page.getByTestId('checkpoint-switcher').click();
    const options = page.getByTestId('checkpoint-option');
    await expect(options).toHaveCount(8);
    const firstId = (await options.first().getAttribute('data-checkpoint-id'))!;
    const lastId = (await options.last().getAttribute('data-checkpoint-id'))!;
    expect(firstId).not.toBe(lastId);

    const levelLine = page.locator('h1').locator('xpath=following-sibling::p[1]');

    await page.goto(`/builds/${token}?tab=stats&checkpoint=${lastId}`);
    await expect(page.getByRole('tab', { name: 'Stats', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(levelLine).toContainText('Level 94');
    await expect(page.getByTestId('stats-panel').getByTestId('stat-life')).toHaveText('2692', { timeout: 60_000 });
    await expect(page.getByTestId('header-stat-life')).toContainText('2692');

    // The pair: a different stage of the same link shows different numbers.
    await page.goto(`/builds/${token}?tab=stats&checkpoint=${firstId}`);
    await expect(levelLine).toContainText('Level 31');
    const firstLife = page.getByTestId('stats-panel').getByTestId('stat-life');
    await expect(firstLife).toHaveText(/^\d+$/, { timeout: 60_000 });
    expect(await firstLife.textContent()).not.toBe('2692');

    // A checkpoint id that is not this build's falls back to the first, and the URL is rewritten.
    await page.goto(`/builds/${token}?checkpoint=00000000-0000-0000-0000-000000000000`);
    await expect(levelLine).toContainText('Level 31');
    await expect(page).toHaveURL(new RegExp(`checkpoint=${firstId}`));
  });

  // "Main skill first on the Skills tab" is asserted by build-page-skills.spec.ts
  // ("five compact rows fit a phone, main skill first").

  test('without the tree export, the page still reads; stats and tree say why they are missing', async ({ page }) => {
    await page.route(/\/data\/tree\/[^/]+\/(lite|data)\.json$/, (route) => route.abort());
    await page.goto(`/builds/${token}`);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('header-stats')).toContainText('Stats unavailable', { timeout: 30_000 });
    const mainSkill = ((await page.getByTestId('build-main-skill').textContent()) ?? '').trim();
    expect(mainSkill.length, 'no main skill in the header').toBeGreaterThan(0);
    await expect(page.getByTestId('overview-tab')).toContainText(mainSkill);

    await openTab(page, 'Gear');
    await expect(page.getByTestId('gear-tab')).not.toContainText('No gear recorded.');
    await expect(page.getByTestId('gear-tab').locator('img').first()).toBeVisible();
    await openTab(page, 'Stats');
    await expect(page.getByTestId('stats-panel').getByRole('alert')).toContainText('Could not load stat data');
    await openTab(page, 'Tree');
    await expect(page.getByTestId('tree-tab')).toContainText("Couldn't load the passive tree");
  });

  test('375px: no horizontal scroll on any tab, and every control is at least 44px', async ({ page }) => {
    await page.goto(`/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    for (const tab of TABS) {
      await openTab(page, tab);
      expect(await horizontalOverflow(page), `horizontal overflow on the ${tab} tab`).toBeLessThanOrEqual(0);
      if (tab === 'Tree') continue; // canvas; its own controls are PassiveTree's, measured by mobile-layout.spec
      const { scanned, tooSmall } = await measureTapTargets(page, '[data-testid="build-page"]');
      expect(scanned, `nothing measured on the ${tab} tab`).toBeGreaterThanOrEqual(TABS.length);
      expect(tooSmall, `controls under ${MIN_TAP_PX}px on the ${tab} tab`).toEqual([]);
    }
    await page.getByTestId('checkpoint-switcher').click();
    const { scanned, tooSmall } = await measureTapTargets(page, '[data-testid="checkpoint-menu"]');
    expect(scanned).toBe(8);
    expect(tooSmall, `checkpoint options under ${MIN_TAP_PX}px`).toEqual([]);
    expect(await horizontalOverflow(page), 'horizontal overflow with the checkpoint menu open').toBeLessThanOrEqual(0);

    // The compact sticky bar (shown once the full header scrolls away) has its
    // own checkpoint switcher, right-aligned in a narrow trigger — the menu
    // must still land fully on screen, and the build name must stay visible
    // rather than being crowded out by the switcher and action buttons. Gear
    // is the tallest tab (17 slots + jewels), so it is the one guaranteed to
    // scroll the header out of view on this fixture's first checkpoint.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('checkpoint-menu')).toBeHidden();
    await openTab(page, 'Gear');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const compactName = page.getByTestId('compact-build-name');
    await expect(compactName).toBeVisible();
    const nameBox = await compactName.boundingBox();
    expect(nameBox, 'compact build name has no bounding box').not.toBeNull();
    expect(nameBox!.width, 'compact build name too narrow').toBeGreaterThanOrEqual(80);

    const compactSwitcher = page.getByTestId('checkpoint-switcher-compact');
    await expect(compactSwitcher).toBeVisible();
    await compactSwitcher.click();
    await expect(page.getByTestId('checkpoint-menu')).toBeVisible();
    expect(await horizontalOverflow(page), 'horizontal overflow with the compact checkpoint menu open').toBeLessThanOrEqual(0);

    const compactOptions = page.getByTestId('checkpoint-option');
    const compactOptionCount = await compactOptions.count();
    for (let i = 0; i < compactOptionCount; i++) {
      const box = await compactOptions.nth(i).boundingBox();
      expect(box, `checkpoint option ${i} has no bounding box`).not.toBeNull();
      expect(box!.x, `checkpoint option ${i} left edge off-screen`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `checkpoint option ${i} right edge off-screen`).toBeLessThanOrEqual(375);
    }
  });

  test('an unknown token is not found', async ({ page }) => {
    await page.goto('/builds/aaaaaaaaaaaaaaaaaaaaa');
    await expect(page.getByRole('heading', { name: 'Build not found' })).toBeVisible();
  });
});
