import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { cleanupWithFreshPage, importFixture, measureTapTargets, testBuildName } from './helpers';

// Board item 26: the Stats tab's "Defences" group (DefencesGroup.tsx) shows the engine's derived stats. The fixture is
// the public Deadeye in docs/superpowers/oracle/ordinary-deadeye.json; docs/superpowers/oracle/results.json (written by
// the multi-oracle vitest run) records, per derived key, the PoB2 figure ("want") and whether the engine matched it
// ("ok"). Every key the engine matches is asserted on screen; the ones it does not match (evade chance, EHP, ...) are
// deliberately NOT asserted, so this spec cannot go red for an accuracy gap the oracle already tracks.
//
// How this can fail (decided first):
//   1. The group does not render, or renders "—" / "NaN" for a stat (the engine's `derived` not reaching the panel).
//   2. The panel shows a value other than the oracle's for a stat the oracle says we match (wrong field wired to a row).
//   3. The explanations cannot be opened by tap (hover-only tooltip), the help toggle is under 44px, or the rows are taller
//      than the main sheet's (once each row carried its own 44px button: twice as tall as the rows above, seen on a phone).
//   4. A long row or a large number overflows a 375px screen horizontally.
//   5. A zero-ES build would still list recharge rows: this build has ES, so it only proves the rows appear here.
// Reads only; the one E2E- build is deleted in afterAll. Reader parity is the same component with no edit branch,
// covered by config-panel.spec.ts's view-mode pass.

const ORACLE = path.join(__dirname, '..', 'docs', 'superpowers', 'oracle');
const FIXTURE = JSON.parse(readFileSync(path.join(ORACLE, 'ordinary-deadeye.json'), 'utf8')) as { pob: string };
const RESULTS = JSON.parse(readFileSync(path.join(ORACLE, 'results.json'), 'utf8')) as Record<string, { derived: Record<string, { want: number; ok: boolean }> }>;

// results.json key -> [row test id, how the row prints the number]
const ROWS: Record<string, [string, (n: number) => string]> = {
  deflectionRating: ['stat-deflection-rating', (n) => String(n)],
  manaRegen: ['stat-mana-regen', (n) => `${n}/s`],
  esRecharge: ['stat-es-recharge', (n) => `${n}/s`],
  esRechargeDelay: ['stat-es-delay', (n) => `${n}s`],
  movementSpeed: ['stat-move-speed', (n) => `${n}%`],
  enduranceCharges: ['stat-endurance-charges', (n) => String(n)],
  frenzyCharges: ['stat-frenzy-charges', (n) => String(n)],
  powerCharges: ['stat-power-charges', (n) => String(n)],
  fireMaxHit: ['stat-maxhit-fire', (n) => String(n)],
  coldMaxHit: ['stat-maxhit-cold', (n) => String(n)],
  lightningMaxHit: ['stat-maxhit-lightning', (n) => String(n)],
  chaosMaxHit: ['stat-maxhit-chaos', (n) => String(n)],
};

test.describe('derived defence stats', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('the Defences group shows the oracle numbers, keeps the main rows spacing, has one 44px help toggle, opens the explanations by tap, and does not overflow', async ({ page }) => {
    const matched = Object.entries(RESULTS['ordinary-deadeye.json'].derived).filter(([key, v]) => v.ok && key in ROWS);
    // Guard against a results.json that lost the derived block: an empty list would make the loop below vacuous.
    expect(matched.length, 'oracle-matched derived keys for the fixture').toBeGreaterThanOrEqual(8);

    const token = await importFixture(page, testBuildName('derived'), FIXTURE.pob);
    await page.goto(`/builds/${token}?tab=stats`);
    const group = page.getByTestId('stat-defences');
    await expect(group).toBeVisible({ timeout: 90_000 });
    // The main sheet has finished calculating before we read anything (Life is a number, not "Calculating…").
    await expect(page.getByTestId('stats-panel').getByTestId('stat-life')).toHaveText(/^\d+$/, { timeout: 60_000 });

    // The main numbers must equal the oracle's too. They did not once: the persistence reader dropped the craft
    // fields the importer writes (verbatim / runeLines / baseSlug), so a SAVED build computed lower than a fresh
    // import (life 2248 vs 2267, ES 1136 vs 1746). This is the guard for that whole class of leak.
    const MAIN: Record<string, string> = { life: 'stat-life', mana: 'stat-mana', energyShield: 'stat-energy-shield', evasion: 'stat-evasion', str: 'stat-str', dex: 'stat-dex', int: 'stat-int' };
    const mainStats = (RESULTS['ordinary-deadeye.json'] as unknown as { stats: Record<string, { want: number; ok: boolean }> }).stats;
    for (const [key, testId] of Object.entries(MAIN)) {
      expect(mainStats[key]?.ok, key + ' should be matched by the oracle for this fixture').toBe(true);
      await expect(page.getByTestId('stats-panel').getByTestId(testId), key).toHaveText(String(mainStats[key].want));
    }

    for (const [key, v] of matched) {
      const [id, format] = ROWS[key];
      // Rows still on DefencesGroup's APPROXIMATE list print a leading "≈"; the oracle number must still follow it.
      await expect(group.getByTestId(id), key).toHaveText(new RegExp(`^≈?${format(v.want)}$`));
    }

    // No row anywhere in the group prints a broken number.
    const text = (await group.innerText()).replace(/\s+/g, ' ');
    expect(text).not.toMatch(/NaN|undefined|Infinity|—/);

    // The honesty line is present.
    await expect(group.getByTestId('stat-defences-not-counted')).toContainText('Not counted');

    // Row spacing: a Defences value row is no taller than 1.6x a main stat row (they use the same grid and text size).
    const mainRow = (await page.getByTestId('stats-panel').getByTestId('stat-life').boundingBox())!.height;
    const defRow = (await group.getByTestId('stat-ehp').boundingBox())!.height;
    expect(defRow, 'Defences rows are as compact as the main rows').toBeLessThanOrEqual(mainRow * 1.6);

    // The only control in the group is the help toggle, and it is at least 44px each way.
    const taps = await measureTapTargets(page, '[data-testid="stat-defences"]');
    expect(taps.scanned).toBeGreaterThanOrEqual(1);
    expect(taps.tooSmall).toEqual([]);

    // The explanations open by tap and close by tapping again.
    const toggle = group.getByTestId('stat-defences-help-toggle');
    const hint = group.getByTestId('stat-ehp-hint');
    await expect(hint).toHaveCount(0);
    await toggle.click();
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('adjusted for resistances and armour');
    expect(await toggle.getAttribute('aria-expanded')).toBe('true');
    await toggle.click();
    await expect(hint).toHaveCount(0);

    // No horizontal overflow, with the longest hint open.
    await toggle.click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal overflow on the Stats tab').toBeLessThanOrEqual(0);
  });
});
