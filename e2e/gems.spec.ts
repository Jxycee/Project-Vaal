import { test, expect } from '@playwright/test';
import {
  cleanupTestBuilds,
  listedBuildNames,
  openTree,
  saveBuild,
  softNavigate,
  testBuildName,
} from './helpers';

// Regression cover for the gems panel: the chip's default ("no loadouts")
// state on a fresh tree, adding a loadout, picking a skill and a support
// through the reused ItemPickerSheet, marking it the main skill, and all of
// that surviving a real save/reload round trip. Writes one real row to the
// production-linked Supabase project under the shared test account; cleaned
// up in afterAll — see e2e/jewels.spec.ts, which this mirrors.
//
// Scoped to the mobile project only (see the `test.skip` below): the gems UI
// has no `md:` branch, so a desktop run would be duplicate coverage at full
// tree-mount price. See docs/superpowers/plans/2026-09-22-task3-gems.md,
// Task 9.

test.describe('gems', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await cleanupTestBuilds(page);
    await page.close();
  });

  test('add a skill loadout with a support, set it as main skill, and survive save/reload', async ({ page }) => {
    await openTree(page);

    const chip = page.getByRole('button', { name: /^Gems/ });
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('add a skill');

    await chip.click();
    const gemsSheet = page.locator('.z-40').filter({ hasText: 'Gems' });
    await expect(gemsSheet).toBeVisible();
    await expect(gemsSheet).toContainText('No skills yet.');

    await gemsSheet.getByRole('button', { name: '+ Add skill' }).click();
    const card = gemsSheet.locator('ul > li').first();
    await expect(card).toBeVisible();

    // ---- Pick a skill --------------------------------------------------
    const skillRow = card.getByRole('button', { name: /Empty/ });
    await skillRow.click();

    const picker = page.locator('.z-50');
    await expect(picker.getByPlaceholder('Search items…')).toBeVisible();
    const firstSkillResult = picker.locator('ul li button').first();
    await expect(firstSkillResult).toBeVisible({ timeout: 15_000 });
    const skillName = ((await firstSkillResult.locator('span.truncate').first().textContent()) ?? '').trim();
    expect(skillName.length).toBeGreaterThan(0);
    await firstSkillResult.click();

    await expect(picker.getByPlaceholder('Search items…')).toBeHidden();
    await expect(card).not.toContainText('Empty');
    await expect(card).toContainText(skillName);

    // ---- Attach a support -----------------------------------------------
    await card.getByRole('button', { name: 'Add support' }).click();
    await expect(picker.getByPlaceholder('Search items…')).toBeVisible();
    const firstSupportResult = picker.locator('ul li button').first();
    await expect(firstSupportResult).toBeVisible({ timeout: 15_000 });
    const supportName = ((await firstSupportResult.locator('span.truncate').first().textContent()) ?? '').trim();
    expect(supportName.length).toBeGreaterThan(0);
    await firstSupportResult.click();

    await expect(picker.getByPlaceholder('Search items…')).toBeHidden();
    await expect(card).toContainText(supportName);
    await expect(card).toContainText('1 / 5 supports');

    // ---- Set as main skill -----------------------------------------------
    const mainSkillButton = card.getByRole('button', { name: 'Main skill' });
    await expect(mainSkillButton).toBeEnabled();
    await mainSkillButton.click();
    await expect(mainSkillButton).toHaveAttribute('aria-pressed', 'true');

    await gemsSheet.getByRole('button', { name: 'Close gems sheet' }).click();
    await expect(gemsSheet).toBeHidden();
    await expect(chip).toContainText('Gems 1');

    // ---- Save and reload ---------------------------------------------------
    const name = testBuildName('gems');
    await saveBuild(page, { name, level: 15, league: 'Standard' });

    const names = await listedBuildNames(page);
    expect(names).toContain(name);

    const href = await page.locator(`a:has-text("${name}")`).getAttribute('href');
    await softNavigate(page, href!);

    const reopenedChip = page.getByRole('button', { name: /^Gems/ });
    await expect(reopenedChip).toContainText('Gems 1');

    await reopenedChip.click();
    const reopenedSheet = page.locator('.z-40').filter({ hasText: 'Gems' });
    await expect(reopenedSheet).toBeVisible();
    const reopenedCard = reopenedSheet.locator('ul > li').first();
    await expect(reopenedCard).toContainText(skillName);
    await expect(reopenedCard).toContainText(supportName);
    await expect(reopenedCard.getByRole('button', { name: 'Main skill' })).toHaveAttribute('aria-pressed', 'true');
  });
});
