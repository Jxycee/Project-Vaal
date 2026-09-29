import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { cleanupWithFreshPage, createBuildViaApi, measureTapTargets, testBuildName } from './helpers';

// Slice 7a of the build-profile redesign (spec §8.1 new build, §8.2 import,
// §8.3 library cards, §8.4 nav; plan docs/superpowers/plans/2026-09-28-build-
// page-slice7a-library-settings.md). Written FIRST, so it fails at the first
// `build-card` assertion until the library is rebuilt.
//
// Contract this spec pins:
//   - /builds' Mine list is `data-testid="my-builds"`; each build is ONE link
//     `data-testid="build-card"` to `/builds/<share_token>`. No Rename, Delete
//     or Copy button and no combobox anywhere in that list.
//   - Page actions: a button "+ New build" (opens `new-build-sheet`), a button
//     `open-import-sheet` ("Import"), and a link "Quick plan" to /tree.
//   - New build sheet: the 8 classes as buttons named after the class; the
//     chosen class's ascendancies as buttons; an input `aria-label="Build
//     name"`; "Create build" (disabled until a class and a name exist) which
//     lands on `/builds/<token>?...edit=1` at Overview. A button/link "or
//     import from Path of Building" swaps in the import form.
//   - Import: `import-summary` (one screen) first, the report behind a "Show
//     details" button (`import-details`); on success it lands on
//     `/builds/<token>` with edit=1. The title no longer says "(test UI)".
//   - Nav: no `nav a[href="/tree"]`; /tree still highlights Builds.
const CODE = readFileSync(path.join(__dirname, '..', 'src', 'lib', 'pob', '__fixtures__', 'sample-pob2-code.txt'), 'utf8');

const CLASSES = ['Witch', 'Ranger', 'Warrior', 'Sorceress', 'Huntress', 'Mercenary', 'Monk', 'Druid'] as const;

function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** `page.goto`, tolerant of one `net::ERR_ABORTED` (Next dev HMR reload race). */
async function goto(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url);
  } catch (err) {
    if (!/ERR_ABORTED/.test(String(err))) throw err;
    await page.goto(url);
  }
}

test.describe('build library, new build and import', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  const nameA = testBuildName('lib-a');
  const nameB = testBuildName('lib-b');
  let tokenA = '';
  let tokenB = '';

  test('cards: one link each, no management controls, 44px targets', async ({ page }) => {
    ({ token: tokenA } = await createBuildViaApi(page, nameA, { class: 'Witch', level: 33, league: 'Standard' }));
    ({ token: tokenB } = await createBuildViaApi(page, nameB, { class: 'Ranger', level: 21, league: 'Standard' }));

    await goto(page, '/builds');
    const list = page.getByTestId('my-builds');
    await expect(list).toBeVisible({ timeout: 30_000 });
    const cards = list.getByTestId('build-card');
    expect(await cards.count(), 'expected at least the two seeded builds').toBeGreaterThanOrEqual(2);

    // Every card is itself the link, and goes to a share-token page.
    for (const card of await cards.all()) {
      expect(await card.evaluate((el) => el.tagName)).toBe('A');
      await expect(card).toHaveAttribute('href', /^\/builds\/[A-Za-z0-9_-]+$/);
    }

    const cardA = list.getByTestId('build-card').filter({ hasText: nameA });
    await expect(cardA).toHaveCount(1);
    await expect(cardA).toHaveAttribute('href', `/builds/${tokenA}`);
    await expect(cardA).toContainText('Witch');
    await expect(cardA).toContainText('33');
    await expect(cardA).toContainText('Unlisted');
    await expect(list.getByTestId('build-card').filter({ hasText: nameB })).toHaveAttribute('href', `/builds/${tokenB}`);

    // Management left the card.
    await expect(list.getByRole('button', { name: /^(Rename|Delete|Copy)/ })).toHaveCount(0);
    await expect(list.getByRole('combobox')).toHaveCount(0);
    await expect(list.getByRole('button')).toHaveCount(0);

    const { scanned, tooSmall } = await measureTapTargets(page, '[data-testid="my-builds"]');
    expect(scanned, 'the tap-target scan matched nothing').toBeGreaterThanOrEqual(2);
    expect(tooSmall, 'library targets under 44px').toEqual([]);
    // The whole page, actions and tabs included (what mobile-layout.spec.ts scans as <main>).
    const whole = await measureTapTargets(page, 'main');
    expect(whole.scanned, 'the tap-target scan of <main> matched nothing').toBeGreaterThanOrEqual(6);
    expect(whole.tooSmall, '/builds controls under 44px').toEqual([]);
    expect(await horizontalOverflow(page), 'horizontal overflow on /builds').toBeLessThanOrEqual(0);

    // Page actions.
    await expect(page.getByRole('button', { name: /New build/ })).toBeVisible();
    await expect(page.getByTestId('open-import-sheet')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Quick plan', exact: true })).toHaveAttribute('href', '/tree');

    // Every card links to a page that opens.
    await cardA.click();
    await expect(page).toHaveURL(new RegExp(`/builds/${tokenA}`));
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
  });

  test('new build: class -> ascendancy -> name lands on Overview in edit mode, and it is saved', async ({ page }) => {
    await goto(page, '/builds');
    await page.getByRole('button', { name: /New build/ }).click();
    const sheet = page.getByTestId('new-build-sheet');
    await expect(sheet).toBeVisible();

    // The 8 classes, each a 44px+ button named after the class.
    for (const cls of CLASSES) {
      const button = sheet.getByRole('button', { name: cls, exact: true });
      await expect(button, cls).toBeVisible();
      const box = (await button.boundingBox())!;
      expect(box.height, `${cls} button height`).toBeGreaterThanOrEqual(44);
      expect(box.width, `${cls} button width`).toBeGreaterThanOrEqual(44);
    }
    expect(await horizontalOverflow(page), 'horizontal overflow with the new build sheet open').toBeLessThanOrEqual(0);

    // Create is not possible until a class and a name exist.
    const create = sheet.getByRole('button', { name: 'Create build', exact: true });
    await expect(create).toBeDisabled();

    await sheet.getByRole('button', { name: 'Witch', exact: true }).click();
    // Only that class's ascendancies.
    await expect(sheet.getByRole('button', { name: 'Infernalist', exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Deadeye', exact: true })).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Infernalist', exact: true }).click();

    const name = testBuildName('lib-new');
    await expect(create).toBeDisabled();
    await sheet.getByLabel('Build name').fill(name);
    await expect(create).toBeEnabled();
    await create.click();

    await page.waitForURL(/\/builds\/[A-Za-z0-9_-]+\?.*edit=1/, { timeout: 60_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get('edit')).toBe('1');
    const page1 = page.getByTestId('build-page');
    await expect(page1).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page1.locator('header')).toContainText('Infernalist');
    await expect(page.locator('#build-name')).toHaveValue(name);

    // A reload shows it saved (read-only header this time).
    await goto(page, `/builds/${url.pathname.split('/').pop()}`);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('build-page').locator('header')).toContainText('Infernalist');
  });

  test('import lands on the build page, summary first', async ({ page }) => {
    await goto(page, '/builds');
    // From "+ New build", through its "or import from Path of Building" link.
    await page.getByRole('button', { name: /New build/ }).click();
    await expect(page.getByTestId('new-build-sheet')).toBeVisible();
    await page.getByTestId('new-build-sheet').getByRole('button', { name: /import from Path of Building/i }).click();

    const sheet = page.getByTestId('import-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).not.toContainText('(test UI)');
    await sheet.getByTestId('import-input').fill(CODE);
    await sheet.getByRole('button', { name: 'Preview', exact: true }).click();

    await expect(sheet.getByTestId('import-summary')).toBeVisible({ timeout: 60_000 });
    // The report is behind "Show details".
    await expect(sheet.getByTestId('import-details')).toBeHidden();
    await sheet.getByRole('button', { name: 'Show details', exact: true }).click();
    await expect(sheet.getByTestId('import-details')).toBeVisible();

    const name = testBuildName('lib-import');
    await sheet.getByTestId('import-name').fill(name);
    await sheet.getByRole('button', { name: 'Import', exact: true }).click();

    await page.waitForURL(/\/builds\/[A-Za-z0-9_-]+\?.*edit=1/, { timeout: 60_000 });
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('#build-name')).toHaveValue(name);
    await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
  });

  test('nav has no Tree link, and /tree still highlights Builds', async ({ page }) => {
    await goto(page, '/builds');
    await expect(page.getByTestId('my-builds')).toBeVisible({ timeout: 30_000 });
    // Both navs (desktop sidebar and mobile bottom bar) are in the DOM at any width.
    await expect(page.locator('nav')).toHaveCount(2);
    await expect(page.locator('nav a[href="/tree"]')).toHaveCount(0);
    await expect(page.locator('nav a[href="/builds"]')).toHaveCount(2);

    await page.goto('/tree', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('nav a[href="/tree"]')).toHaveCount(0);
    // The mobile bar colours the active item's label.
    await expect(page.locator('nav.fixed a[href="/builds"] span').first()).toHaveClass(/text-primary/);
  });
});
