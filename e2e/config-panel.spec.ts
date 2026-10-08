import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { cleanupWithFreshPage, importFixture, saveBuild, testBuildName } from './helpers';

// Board item 20: the Stats tab's Config panel (ConfigPanel.tsx, session setConfigCondition /
// setConfigMultiplier). The fixture is the public Deadeye in docs/superpowers/oracle/ordinary-deadeye.json: its
// PoB Configuration ticks "Moving" and sets Wind Dancer stacks to 3, and those two switch on its Wild Cat
// ("40% increased Evasion Rating while moving") and Wind Dancer modifiers (multiOracle.test.ts, failure mode 5:
// Evasion 8184 -> 13693). So Evasion is the instrument: it must move when Moving or the stacks move.
//
// How this can fail (decided first):
//   1. The imported Config is lost on import or on the first edit: Moving would not be ticked on arrival, stacks
//      would not read 3, and any "Also set" flag would vanish after a toggle.
//   2. A toggle changes the control but not the sheet (the setter never reaches computeDefences): Evasion would
//      not move when Moving is unticked.
//   3. The edit does not persist (draft only, or the save drops buildConfig): after Save and a full reload the
//      read view would still show Moving, and Evasion would be back at the imported figure.
//   4. A reader can change it: in view mode there must be no checkbox and no stacks input at all.
//   5. The hint lies: "Numbers use these settings" must list exactly what is ticked, before and after the edit.
// Artifact: playwright-report/results.json (the run's outcomes, as for every spec) plus the one E2E- build, which
// afterAll deletes.
//
// Not covered here: a signed-out reader (the whole of /builds is behind sign-in, e2e/draft-and-auth.spec.ts), so
// "reader" is the owner's view mode, which renders through the same read-only branch.

const FIXTURE = JSON.parse(readFileSync(path.join(__dirname, '..', 'docs', 'superpowers', 'oracle', 'ordinary-deadeye.json'), 'utf8')) as { pob: string };

const WIND_DANCER = 'config-stacks-WindDancerStacks';

test.describe('config panel', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(420_000);

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  const evasion = async (page: Page): Promise<number> => {
    const cell = page.getByTestId('stats-panel').getByTestId('stat-evasion');
    await expect(cell).toHaveText(/^\d+$/, { timeout: 60_000 });
    return Number(await cell.textContent());
  };

  test('Moving and the stacks move Evasion, the imported Config survives, the edit saves, a reader cannot change it', async ({ page }) => {
    const token = await importFixture(page, testBuildName('config'), FIXTURE.pob);

    await page.goto(`/builds/${token}?edit=1&tab=stats`);
    const panel = page.getByTestId('config-panel');
    await expect(panel).toBeVisible({ timeout: 60_000 });
    const moving = panel.getByTestId('config-condition-Moving');
    const stacks = panel.getByTestId(WIND_DANCER);
    const hint = page.getByTestId('stats-config-hint');

    // 1 + 5. What PoB had set arrives intact and the hint says so.
    await expect(moving).toBeChecked();
    await expect(stacks).toHaveValue('3');
    await expect(hint).toContainText('Numbers use these settings');
    await expect(hint).toContainText('Moving');
    await expect(hint).toContainText('Wind Dancer stacks 3');
    const withBoth = await evasion(page);
    expect(withBoth).toBeGreaterThan(0);
    // A flag this panel has no toggle for is kept through every edit (buildConfig.ts failure mode 7).
    const otherLine = page.getByTestId('config-other');
    const otherBefore = (await otherLine.count()) > 0 ? await otherLine.textContent() : null;

    // 2. Unticking Moving lowers Evasion at once, and the hint drops it.
    await moving.uncheck();
    await expect.poll(() => evasion(page), { timeout: 30_000 }).toBeLessThan(withBoth);
    const withoutMoving = await evasion(page);
    await expect(hint).not.toContainText('Moving');
    await expect(hint).toContainText('Wind Dancer stacks 3');

    // Ticking it again restores the imported figure exactly (nothing else drifted).
    await moving.check();
    await expect.poll(() => evasion(page), { timeout: 30_000 }).toBe(withBoth);

    // The stack count is an input too: taking the stacks away lowers Evasion, putting them back restores it.
    await stacks.fill('0');
    await expect.poll(() => evasion(page), { timeout: 30_000 }).toBeLessThan(withBoth);
    await expect(hint).not.toContainText('Wind Dancer');
    await stacks.fill('3');
    await expect.poll(() => evasion(page), { timeout: 30_000 }).toBe(withBoth);

    // Leave the build saved with Moving OFF (stacks 3), and the unknown flags unchanged.
    await moving.uncheck();
    await expect.poll(() => evasion(page), { timeout: 30_000 }).toBe(withoutMoving);
    if (otherBefore !== null) await expect(otherLine).toHaveText(otherBefore);
    await saveBuild(page);

    // 3. Full reload in view mode: the saved Config is what is read back.
    await page.goto(`/builds/${token}?tab=stats`);
    await expect(page.getByTestId('config-panel')).toBeVisible({ timeout: 60_000 });
    expect(await evasion(page)).toBe(withoutMoving);
    await expect(page.getByTestId('config-conditions-read')).not.toContainText('Moving');
    await expect(page.getByTestId(`${WIND_DANCER}-value`)).toHaveText('3');
    await expect(page.getByTestId('stats-config-hint')).not.toContainText('Moving');
    if (otherBefore !== null) await expect(page.getByTestId('config-other')).toHaveText(otherBefore);

    // 4. A reader sees values, never controls.
    await expect(page.getByTestId('config-panel').locator('input')).toHaveCount(0);

    // And back in edit mode the saved state is what the controls start from (not the import's).
    await page.goto(`/builds/${token}?edit=1&tab=stats`);
    await expect(page.getByTestId('config-condition-Moving')).not.toBeChecked({ timeout: 60_000 });
    await expect(page.getByTestId(WIND_DANCER)).toHaveValue('3');
  });
});
