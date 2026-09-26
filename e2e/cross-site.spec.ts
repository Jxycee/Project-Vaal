import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { cleanupWithFreshPage, measureTapTargets, testBuildName } from './helpers';

// Cross-site build data (handoff 2026-09-26-cross-site-build-data-handoff.md,
// §3 D and F): the dashboard lists the Build Planner as a live tool and shows
// the user's recent builds, and build headers show ascendancy display names.
//
// builds.ascendancy can hold two vocabularies (verified 2026-09-26): the
// editor saves the display name ("Infernalist"); the PoB importer saved GGG's
// raw id ("Mercenary2") until the same day, so older imported rows still do.
// Both are seeded here through POST /api/builds, which stores the value as
// sent, so each page is checked against both.
//
// Mobile project only: every assertion is about content, and 375px is where
// the dashboard's list rows are tightest.

interface CreatedBuild {
  id: string;
  name: string;
  ascendancy: string | null;
  share_token: string | null;
}

async function createBuild(
  page: Page,
  testInfo: TestInfo,
  body: { name: string; class: string; ascendancy: string; level: number },
): Promise<CreatedBuild> {
  const res = await page.request.post('/api/builds', {
    data: { ...body, passive_state: { set1: [], set2: [], ascendancyNodes: [] } },
  });
  const json = (await res.json()) as { build: CreatedBuild };
  await testInfo.attach(`create ${body.ascendancy}`, {
    body: JSON.stringify({ status: res.status(), body: json }, null, 2),
    contentType: 'application/json',
  });
  expect(res.ok(), `POST /api/builds answered ${res.status()}`).toBe(true);
  return json.build;
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

test.describe('cross-site build data', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.setTimeout(240_000);

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('the dashboard lists the planner and recent builds by ascendancy name, and so does the shared page', async ({
    page,
  }, testInfo) => {
    // ---- Seed one build in each vocabulary. The importer's is created
    // second, so it is the most recent and heads the dashboard list.
    const editorName = testBuildName('xsite-editor');
    const importerName = testBuildName('xsite-import');
    const editorBuild = await createBuild(page, testInfo, {
      name: editorName,
      class: 'Witch',
      ascendancy: 'Infernalist',
      level: 12,
    });
    const importerBuild = await createBuild(page, testInfo, {
      name: importerName,
      class: 'Mercenary',
      ascendancy: 'Mercenary2',
      level: 42,
    });
    // The precondition this whole test rests on: the raw id really is what
    // is stored. If the route ever starts normalising it, the label checks
    // below would pass without proving anything.
    expect(importerBuild.ascendancy).toBe('Mercenary2');
    expect(editorBuild.ascendancy).toBe('Infernalist');

    // ---- Dashboard.
    await page.goto('/dashboard');
    const main = page.locator('main');

    // Build Planner is a live tool linking to /builds; the "Coming next"
    // section it used to sit in is gone.
    const plannerCard = main.locator('a[href="/builds"]').filter({ hasText: 'Build Planner' });
    await expect(plannerCard).toBeVisible();
    await expect(plannerCard).toContainText('Live');
    await expect(main.getByText('Coming next')).toHaveCount(0);
    await expect(main.getByText('Build Planner coming soon')).toHaveCount(0);

    const recent = main.locator('section[aria-labelledby="recent-builds-heading"]');
    await expect(recent.getByRole('heading', { name: 'Recent builds' })).toBeVisible();
    const rows = recent.locator('ul > li');
    await expect(rows.first()).toContainText(importerName);

    const importerRow = rows.filter({ hasText: importerName });
    const editorRow = rows.filter({ hasText: editorName });
    await expect(importerRow).toContainText('Witchhunter · Level 42 · 1 checkpoint');
    await expect(editorRow).toContainText('Infernalist · Level 12 · 1 checkpoint');
    await expect(recent).not.toContainText('Mercenary2');

    // Each row opens its own build in the editor.
    await expect(importerRow.locator('a')).toHaveAttribute('href', `/tree?build=${importerBuild.id}`);
    await expect(editorRow.locator('a')).toHaveAttribute('href', `/tree?build=${editorBuild.id}`);

    const taps = await measureTapTargets(page, 'section[aria-labelledby="recent-builds-heading"]');
    expect(taps.scanned, 'the tap-target scan found no links in Recent builds').toBeGreaterThanOrEqual(3);
    expect(taps.tooSmall).toEqual([]);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal overflow on /dashboard').toBeLessThanOrEqual(0);
    await attachScreenshot(page, testInfo, 'dashboard');

    // ---- Shared page header. Private = link-shareable here (the vocabulary
    // is inverted on purpose — src/lib/build/visibility.ts). Set through the
    // real /builds control, as sharing.spec.ts does.
    await page.goto('/builds');
    const listRow = page.locator('ul > li').filter({ has: page.locator(`a:has-text("${importerName}")`) }).first();
    await expect(listRow).toBeVisible({ timeout: 30_000 });
    await expect(listRow).toContainText('Witchhunter · Level 42');
    await expect(listRow).not.toContainText('Mercenary2');
    await listRow.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Private' }).click();
    const shareLink = listRow.locator('a[href^="/builds/"]');
    await expect(shareLink).toBeVisible({ timeout: 30_000 });
    const href = await shareLink.getAttribute('href');
    expect(href).toBe(`/builds/${importerBuild.share_token}`);

    await page.goto(href!);
    await expect(page.getByRole('heading', { level: 1, name: importerName })).toBeVisible();
    await expect(page.getByText('Witchhunter · Level 42')).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Mercenary2');
    await attachScreenshot(page, testInfo, 'shared page');
  });
});
