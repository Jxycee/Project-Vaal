import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { cleanupWithFreshPage, importFixture, openBuildSettings, testBuildName } from './helpers';

// Path of Building 2 export, end to end through the real UI: import the
// momentsZX level-98 Deadeye (docs/superpowers/handoffs, a real character with
// weapon sets, uniques, desecrated mods, runes and quest rewards), export it from Build settings, paste the code back into
// the Import sheet, and the second build must read the same as the first on
// every tab that carries data (stats, gear, skills). The export is the saved
// build, so nothing here depends on unsaved editor state.
//
// Artifact: <test output dir>/pob-export-roundtrip.json - the exported code,
// its report, and both builds' stat values and tab text, so a regression is a
// diff and the code can be pasted into Path of Building 2 by hand.
//
// Writes two E2E- builds to the shared test account; both are deleted in
// afterAll (the delete cascades to their checkpoints).

async function tabText(page: Page, tab: 'gear' | 'skills'): Promise<string> {
  await page.getByRole('tab', { name: tab === 'gear' ? 'Gear' : 'Skills', exact: true }).click();
  const panel = page.getByTestId(`${tab}-tab`);
  await expect(panel).toBeVisible();
  // The tab text, whitespace-normalised: item names, craft lines, gem names.
  return ((await panel.innerText()) ?? '').replace(/\s+/g, ' ').trim();
}

async function statValues(page: Page): Promise<Record<string, string>> {
  await page.getByRole('tab', { name: 'Stats', exact: true }).click();
  const panel = page.getByTestId('stats-panel');
  await expect(panel.getByTestId('stat-life')).toHaveText(/^\d+$/, { timeout: 60_000 });
  return panel.locator('[data-testid^="stat-"]').evaluateAll((els) =>
    Object.fromEntries(els.map((el) => [el.getAttribute('data-testid')!, (el.textContent ?? '').trim()])),
  );
}

const CODE = readFileSync(path.join(__dirname, '..', 'docs', 'superpowers', 'handoffs', '2026-09-27-momentsZX-pob2-code.txt'), 'utf8').trim();

test.describe('PoB export', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  const original = testBuildName('export-a');
  const copy = testBuildName('export-b');

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('export from Build settings, import the code back, and the copy reads the same', async ({ page }, testInfo) => {
    const token = await importFixture(page, original, CODE);
    await page.goto(`/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    const before = { stats: await statValues(page), gear: await tabText(page, 'gear'), skills: await tabText(page, 'skills') };

    const menu = await openBuildSettings(page);
    const section = menu.getByTestId('export-section');
    await section.getByRole('button', { name: 'Export to Path of Building', exact: true }).click();
    const box = section.getByTestId('export-code');
    await expect(box).toBeVisible({ timeout: 60_000 });
    const code = await box.inputValue();
    expect(code.length, 'the exported code is empty or tiny').toBeGreaterThan(2_000);
    expect(code).toMatch(/^[A-Za-z0-9_-]+=*$/);

    // The report block is shown when there is anything to say (a unit-mismatch mod, a gem PoB2 lacks...).
    const report = section.getByTestId('export-report');
    const reportLines = (await report.count()) > 0 ? (await report.locator('summary').click(), await report.locator('li').allInnerTexts()) : [];

    // 44px tap targets in the new section.
    for (const control of [section.getByRole('button', { name: 'Export to Path of Building', exact: true }), section.getByRole('button', { name: 'Copy code', exact: true })]) {
      const b = await control.boundingBox();
      expect(b!.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: 'Close build settings', exact: true }).click();

    // Paste the code into the Import sheet.
    const copyToken = await importFixture(page, copy, code);
    await page.goto(`/builds/${copyToken}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    const after = { stats: await statValues(page), gear: await tabText(page, 'gear'), skills: await tabText(page, 'skills') };

    writeFileSync(
      testInfo.outputPath('pob-export-roundtrip.json'),
      JSON.stringify({ original, copy, code, report: reportLines, before, after }, null, 2),
    );
    await testInfo.attach('pob-export-roundtrip', { path: testInfo.outputPath('pob-export-roundtrip.json'), contentType: 'application/json' });

    expect(Object.keys(before.stats).length, 'no stats were read').toBeGreaterThan(5);
    expect(after.stats).toEqual(before.stats);
    expect(after.gear).toEqual(before.gear);
    expect(after.skills.length).toBeGreaterThan(0);
    expect(after.skills).toEqual(before.skills);
  });
});
