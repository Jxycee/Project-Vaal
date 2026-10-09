import { test, expect, type Page } from '@playwright/test';
import { cleanupWithFreshPage, importFixture, testBuildName } from './helpers';

// Board item 43. A Path of Building file holds ONE skill set for every
// checkpoint, so the importer copies the final checkpoint's gems onto all of
// them. A gem cannot exceed the level its character level allows (gem level N
// needs character level >= levelRequirement[N - 1], public/data/wiki/<version>/
// gem-level-requirements.json), so on the level-31 first checkpoint the Stats
// tab must not count level-20 gems' Spirit, and the Skills tab must say which
// rows were lowered. The numbers are READ from the page, never hard-coded: the
// claim is the relation between the two checkpoints, not a figure.
//
// Failure modes this guards: the table never loads or is not applied (first
// checkpoint reserves as much as the last); the stored level is rewritten
// instead of only displayed (the last checkpoint, whose level allows every
// stored level, would then show a hint or a different number); the hint
// overflows a phone row.

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** The "N reserved" figure in the Spirit row, or null while the sheet has not loaded. */
async function reservedSpirit(page: Page): Promise<number | null> {
  const text = await page.getByTestId('stats-panel').getByTestId('stat-spirit').textContent({ timeout: 5_000 }).catch(() => null);
  const m = /\((\d+) reserved\)/.exec(text ?? '');
  return m ? Number(m[1]) : null;
}

test.describe('gem level gating by character level', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  const name = testBuildName('gem-gating');
  let token = '';
  let firstId = '';
  let lastId = '';
  let lastReserved = 0;

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('the final checkpoint shows the file as stored: full Spirit, no lowered hint', async ({ page }) => {
    token = await importFixture(page, name);
    await page.goto(`/builds/${token}`);
    await page.getByTestId('checkpoint-switcher').click();
    const options = page.getByTestId('checkpoint-option');
    await expect(options).toHaveCount(8);
    firstId = (await options.first().getAttribute('data-checkpoint-id'))!;
    lastId = (await options.last().getAttribute('data-checkpoint-id'))!;
    expect(firstId).not.toBe(lastId);

    await page.goto(`/builds/${token}?tab=stats&checkpoint=${lastId}`);
    await expect(page.locator('h1').locator('xpath=following-sibling::p[1]')).toContainText('Level 94');
    await expect(page.getByTestId('stats-panel').getByTestId('stat-spirit')).toContainText('reserved', { timeout: 60_000 });
    // Give the level table time to arrive and be applied; a level-94 character allows every stored level, so nothing moves.
    await page.waitForTimeout(1_500);
    lastReserved = (await reservedSpirit(page))!;
    expect(lastReserved, 'the imported build reserves some Spirit at the final checkpoint').toBeGreaterThan(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await page.goto(`/builds/${token}?tab=skills&checkpoint=${lastId}`);
    await expect(page.getByTestId('skill-row').first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1_500);
    await expect(page.getByTestId('skill-level-lowered')).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('the first checkpoint (level 31) reserves less Spirit and does not warn', async ({ page }) => {
    const lastOver = await (async () => {
      await page.goto(`/builds/${token}?tab=stats&checkpoint=${lastId}`);
      await expect(page.getByTestId('stats-panel').getByTestId('stat-spirit')).toContainText('reserved', { timeout: 60_000 });
      return page.getByTestId('stat-spirit-over').count();
    })();

    await page.goto(`/builds/${token}?tab=stats&checkpoint=${firstId}`);
    await expect(page.locator('h1').locator('xpath=following-sibling::p[1]')).toContainText('Level 31');
    // Retries until the level table has loaded and replaced the first (ungated) figure.
    await expect
      .poll(() => reservedSpirit(page), { timeout: 60_000, message: 'first checkpoint reserved Spirit stays at the final checkpoint figure' })
      .toBeLessThan(lastReserved);
    // (b) the warning is absent on the first checkpoint whenever the last has none.
    if (lastOver === 0) await expect(page.getByTestId('stat-spirit-over')).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('the first checkpoint lowers gem levels on the Skills tab, and its gem card says so', async ({ page }) => {
    await page.goto(`/builds/${token}?tab=skills&checkpoint=${firstId}`);
    await expect(page.getByTestId('skill-row').first()).toBeVisible({ timeout: 60_000 });
    const lowered = page.getByTestId('skill-level-lowered');
    await expect(lowered.first()).toBeVisible({ timeout: 60_000 });

    // The row shows the lowered level and names the file's level in its hint.
    const row = page.getByTestId('skill-row').filter({ has: lowered }).first();
    const hint = (await row.getByTestId('skill-level-lowered').textContent())!;
    const fileLevel = Number(/file Lv (\d+)/.exec(hint)![1]);
    const shownLevel = Number(/Lv (\d+)/.exec((await row.textContent())!)![1]);
    expect(shownLevel).toBeLessThan(fileLevel);
    await expect(row.getByTestId('skill-level-lowered')).toHaveAttribute('title', `Lv ${shownLevel} at character level 31; the file has Lv ${fileLevel}`);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    // Opening the row: the gem card header says the same.
    await row.click();
    await expect(page.getByTestId('gem-card-level-lowered')).toHaveText(`Lv ${shownLevel} at character level 31; the file has Lv ${fileLevel}`);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
