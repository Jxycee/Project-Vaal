import { test, expect } from '@playwright/test';
import {
  cleanupTestBuilds,
  listedBuildNames,
  openTree,
  saveBuild,
  softNavigate,
  testBuildName,
  waitForTreeApi,
} from './helpers';

// Regression cover for the jewels panel: the chip's default ("no socket
// allocated") state on a fresh tree, allocating a socket via the dev-only
// tree hook (the canvas has no DOM per node — see testApi.ts), equipping a
// jewel through the sheet, and that surviving a real save/reload round trip.
// Writes one real row to the production-linked Supabase project under the
// shared test account; cleaned up in afterAll.

test.describe('jewels', () => {
  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await cleanupTestBuilds(page);
    await page.close();
  });

  test('chip is visible on a fresh tree, and equipping a jewel survives save and reload', async ({ page }) => {
    await openTree(page);

    const chip = page.getByRole('button', { name: /^Jewels/ });
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('allocate a socket on the tree');

    await waitForTreeApi(page);
    const socketId = await page.evaluate(() => window.__vaalTree!.jewelSockets()[0]);
    expect(typeof socketId).toBe('number');
    await page.evaluate((id) => window.__vaalTree!.allocate(id), socketId);

    await expect(chip).toContainText('Jewels 0/1');

    await chip.click();
    const jewelsSheet = page.locator('.z-40').filter({ hasText: 'Jewels' });
    await expect(jewelsSheet).toBeVisible();

    const socketRow = jewelsSheet.locator('ul li').first();
    await expect(socketRow).toContainText('Empty');
    await socketRow.getByRole('button').first().click();

    // The item picker sheet layers on top at z-50.
    const picker = page.locator('.z-50');
    await expect(picker.getByPlaceholder('Search items…')).toBeVisible();
    const firstResult = picker.locator('ul li button').first();
    await expect(firstResult).toBeVisible({ timeout: 15_000 });
    const rawName = (await firstResult.locator('span.truncate').first().textContent()) ?? '';
    const equippedName = rawName.replace(/\s*Unique\s*$/, '').trim();
    expect(equippedName.length).toBeGreaterThan(0);
    await firstResult.click();

    // Picking closes the picker; the jewels sheet stays open with the row updated.
    await expect(picker.getByPlaceholder('Search items…')).toBeHidden();
    await expect(socketRow).not.toContainText('Empty');
    await expect(socketRow).toContainText(equippedName);

    await jewelsSheet.getByRole('button', { name: 'Close jewels sheet' }).click();
    await expect(jewelsSheet).toBeHidden();
    await expect(chip).toContainText('Jewels 1/1');

    const name = testBuildName('jewels');
    await saveBuild(page, { name, level: 15, league: 'Standard' });

    const names = await listedBuildNames(page);
    expect(names).toContain(name);

    // Real navigation into the saved build (the /api/builds round trip + the
    // server-component load path), not just a poll of in-memory state.
    const href = await page.locator(`a:has-text("${name}")`).getAttribute('href');
    await softNavigate(page, href!);

    const reopenedChip = page.getByRole('button', { name: /^Jewels/ });
    await expect(reopenedChip).toContainText('Jewels 1/1');

    await reopenedChip.click();
    const reopenedSheet = page.locator('.z-40').filter({ hasText: 'Jewels' });
    await expect(reopenedSheet).toBeVisible();
    const reopenedRow = reopenedSheet.locator('ul li').first();
    await expect(reopenedRow).toContainText(equippedName);
    await expect(reopenedRow).not.toContainText('Empty');
  });
});
