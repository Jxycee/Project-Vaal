import { test, expect } from '@playwright/test';
import { MIN_TAP_PX, cleanupWithFreshPage, listedBuildNames, measureTapTargets, openTree, pickByName, saveBuild, testBuildName } from './helpers';

// Slice 4 — an item carries everything our data backs
// (plans/2026-09-25-slice4-item-affixes.md). Crafts a rare ring through the
// real editor, proves an over-limit warning appears AND clears, proves values
// clamp as typed, then proves every field survives a save and a full reload.
// Writes one E2E- build under the shared test account; deleted in afterAll.

test.describe('item craft', () => {
  test.setTimeout(420_000);

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('a crafted rare ring: warning at four prefixes, clamped values, everything back after a reload', async ({ page }) => {
    await openTree(page);
    await page.getByRole('button', { name: 'Gear' }).click();
    const gear = page.locator('.fixed.inset-0.z-40');
    const ringRow = gear.locator('ul li').filter({ hasText: 'Ring 1' }).first();
    await pickByName(page, ringRow.getByRole('button').first(), 'Amethyst Ring');
    await expect(ringRow).toContainText('Amethyst Ring');

    await gear.getByRole('button', { name: 'Edit Ring 1' }).click();
    const editor = page.getByTestId('item-editor');
    await expect(editor).toBeVisible();

    await editor.getByTestId('rarity-rare').click();
    await expect(editor.getByTestId('rarity-rare')).toHaveAttribute('aria-pressed', 'true');
    await editor.getByLabel('Item level').fill('82');
    await editor.getByLabel('Quality').fill('20');

    // The ring's implicit is "+(7-13)% to Chaos Resistance": 99 clamps to 13.
    const implicit = editor.getByLabel('Implicit 1 value 1');
    await implicit.fill('99');
    await expect(implicit).toHaveValue('13');

    // Four prefixes from four different groups — one more than a rare allows.
    const picked: string[] = [];
    for (let i = 0; i < 4; i++) {
      await editor.getByTestId('add-prefix').click();
      const picker = page.getByTestId('mod-picker');
      await expect(picker.getByTestId('mod-group').first()).toBeVisible({ timeout: 30_000 });
      await picker.getByTestId('mod-group').nth(i).click();
      const tier = picker.getByTestId('mod-tier').first();
      picked.push((await tier.getAttribute('data-slug'))!);
      await tier.click();
      await expect(picker).toBeHidden();
    }
    expect(new Set(picked).size).toBe(4);
    await expect(editor.getByTestId('affix-row')).toHaveCount(4);
    await expect(editor.getByTestId('item-warning')).toHaveCount(1);
    await expect(editor.getByTestId('item-warning')).toContainText('4 prefixes');

    // Remove one: the warning clears (paired with the positive just above).
    await editor.getByRole('button', { name: 'Remove prefix 4' }).click();
    await expect(editor.getByTestId('affix-row')).toHaveCount(3);
    await expect(editor.getByTestId('item-warning')).toHaveCount(0);

    // A typed value clamps to its roll.
    const firstValue = editor.getByTestId('affix-row').first().getByTestId('roll-value').first();
    await firstValue.fill('99999');
    await expect(firstValue).not.toHaveValue('99999');
    const clamped = await firstValue.inputValue();
    expect(Number(clamped)).toBeLessThan(99999);

    await pickByName(page, editor.getByTestId('add-rune'), 'Greater Body Rune');
    await expect(editor.getByTestId('rune-row')).toHaveCount(1);

    // Tap targets while crafted: close, 3 rarities, corrupted, 3 prefix
    // removes, add prefix, add suffix, 1 rune remove, add rune.
    const taps = await measureTapTargets(page, '[data-testid="item-editor"]');
    expect(taps.scanned).toBe(12);
    expect(taps.tooSmall, `controls under ${MIN_TAP_PX}px in the item editor`).toEqual([]);

    await editor.getByRole('button', { name: 'Close item editor' }).click();
    await expect(gear.getByTestId('gear-craft-ring1')).toHaveText('rare · 3 affixes · 1 rune');
    await gear.getByRole('button', { name: 'Close gear sheet' }).click();

    // ---- Save, then a FULL reload -----------------------------------------
    const name = testBuildName('craft');
    await saveBuild(page, { name });
    expect(await listedBuildNames(page)).toContain(name);
    const href = await page.locator(`a:has-text("${name}")`).getAttribute('href');
    await openTree(page, new URL(href!, 'http://x').searchParams.get('build')!);

    await page.getByRole('button', { name: 'Gear' }).click();
    await expect(gear.getByTestId('gear-craft-ring1')).toHaveText('rare · 3 affixes · 1 rune');
    await gear.getByRole('button', { name: 'Edit Ring 1' }).click();
    await expect(editor.getByTestId('rarity-rare')).toHaveAttribute('aria-pressed', 'true');
    await expect(editor.getByLabel('Item level')).toHaveValue('82');
    await expect(editor.getByLabel('Quality')).toHaveValue('20');
    await expect(editor.getByLabel('Implicit 1 value 1')).toHaveValue('13');
    const rows = editor.getByTestId('affix-row');
    await expect(rows).toHaveCount(3);
    for (let i = 0; i < 3; i++) await expect(rows.nth(i)).toHaveAttribute('data-slug', picked[i]);
    await expect(rows.first().getByTestId('roll-value').first()).toHaveValue(clamped);
    await expect(editor.getByTestId('rune-row')).toHaveText(['greater-body-rune']);
    await expect(editor.getByTestId('item-warning')).toHaveCount(0);
  });
});
