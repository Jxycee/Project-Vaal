import { writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { cleanupWithFreshPage, importFixture, selectGearSlot, testBuildName } from './helpers';

// The reader's item card on the Gear tab: tapping a slot shows every mod with
// its tier tag (P/S + number, 1 = best), range and roll bar, the rune box and
// the legend, instead of the old one-line "rare · 6 affixes · 2 runes".
// Uses the vendored fixture (a rare two-hand crossbow with 2 runes, a unique
// Cloak of Flame). The owner viewing outside edit mode sees exactly what a
// reader sees. Artifact: card-crossbow-375.png, card-cloak-1280.png and a JSON
// of what the card showed, in the test output directory.

test.describe('item card', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(240_000);

  const name = testBuildName('itemcard');
  let token = '';

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('a rare shows every mod with tier tags, rolls, runes and the legend, at 375px with no sideways scroll', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    token = await importFixture(page, name);
    await page.goto(`/builds/${token}?tab=gear`);
    await selectGearSlot(page, 'weapon1_main');

    const card = page.getByTestId('gear-slot-detail').getByTestId('item-card');
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(card).toHaveAttribute('data-rarity', 'rare');
    await expect(card.getByTestId('item-card-name')).toBeVisible();

    const mods = card.getByTestId('item-card-mod');
    await expect(mods).toHaveCount(6);
    const tags = await mods.evaluateAll((els) => els.map((el) => el.getAttribute('data-tag') ?? ''));
    expect(tags.filter((t) => /^P[1-9]\d*$/.test(t)).length, 'prefix tags: ' + tags.join(',')).toBe(3);
    expect(tags.filter((t) => /^S[1-9]\d*$/.test(t)).length, 'suffix tags: ' + tags.join(',')).toBe(3);

    // Mod text is the stored roll, never the template range.
    const text = (await mods.allInnerTexts()).join('\n');
    expect(text).toContain('150% increased Physical Damage');
    expect(text).not.toMatch(/\(\d+-\d+\)%? (increased|to)/);

    await expect(card.getByTestId('item-card-rune')).toHaveCount(1);
    await expect(card.getByTestId('item-card-rune')).toContainText('2 ×');
    expect(await card.getByTestId('item-card-roll').count(), 'no roll bars').toBeGreaterThan(0);
    await expect(card).toContainText('P prefix · S suffix');
    await expect(card).toContainText('Requires: Level');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'the card makes the page scroll sideways').toBe(0);

    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('card-crossbow-375.png') });
    writeFileSync(testInfo.outputPath('card-crossbow.json'), JSON.stringify({ tags, text }, null, 2));
  });

  test('a unique shows its own lines without tier tags, its flavour text and a rune box; desktop width', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/builds/${token}?tab=gear`);
    await selectGearSlot(page, 'body');

    const card = page.getByTestId('gear-slot-detail').getByTestId('item-card');
    await expect(card).toBeVisible({ timeout: 60_000 });
    await expect(card).toHaveAttribute('data-rarity', 'unique');
    await expect(card.getByTestId('item-card-name')).toHaveText('Cloak of Flame');
    const mods = card.getByTestId('item-card-mod');
    expect(await mods.count()).toBeGreaterThan(3);
    const tags = await mods.evaluateAll((els) => els.map((el) => el.getAttribute('data-tag') ?? ''));
    expect(tags.every((t) => t === ''), 'a unique line carries a tier tag: ' + tags.join(',')).toBe(true);
    await expect(card).toContainText('He who sows an ember');
    await expect(card.getByTestId('item-card-rune')).toBeVisible();
    await expect(card).not.toContainText('P prefix');

    await page.screenshot({ path: testInfo.outputPath('card-cloak-1280.png') });
  });

  test('desktop: hovering a slot floats the card beside it and leaving hides it; phone width never shows it', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/builds/${token}?tab=gear`);
    const cell = page.getByTestId('doll-slot-head');
    await expect(cell).toBeVisible({ timeout: 60_000 });
    await cell.hover();
    const hover = page.getByTestId('item-hover-card');
    await expect(hover).toBeVisible({ timeout: 30_000 });
    await expect(hover.getByTestId('item-card-name')).toBeVisible();
    await expect(hover.getByTestId('item-card-rune')).toBeVisible();
    // It is inside the viewport and does not cover the cell that opened it.
    const box = (await hover.boundingBox())!;
    const cellBox = (await cell.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(1280);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x >= cellBox.x + cellBox.width - 1 || box.x + box.width <= cellBox.x + 1, 'the card covers its own cell').toBe(true);
    await page.screenshot({ path: testInfo.outputPath('card-hover-1280.png') });

    await page.mouse.move(5, 5);
    await expect(hover).toBeHidden();

    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await page.getByTestId('doll-slot-head').hover();
    await page.waitForTimeout(600);
    await expect(page.getByTestId('item-hover-card')).toHaveCount(0);
  });
});
