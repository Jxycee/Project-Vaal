import { test, expect, type Page } from '@playwright/test';
import {
  cleanupWithFreshPage,
  listedBuildNames,
  openEditor,
  allocateNodes,
  nodesNearStart,
  openTree,
  readBuildId,
  saveBuild,
  testBuildName,
  treeState,
  waitForTreeApi,
} from './helpers';

// Slice 5 — attribute choices feed the defence sheet
// (plans/2026-09-25-slice5-defence-engine.md). Choosing Strength on a
// "+5 to any Attribute" passive must raise Strength by exactly 5 and Life by
// exactly 10 (PoB2: +2 Life per Strength), and the choice must survive a save
// and a full reload. Writes one E2E- build; deleted in afterAll.

/** The nearest generic attribute node to the class start, walked through the dev hook. */
async function nearestAttributeNode(page: Page): Promise<number> {
  return page.evaluate(() => {
    const api = window.__vaalTree!;
    const start = api.startNode();
    const seen = new Set([start]);
    let frontier = [start];
    while (frontier.length > 0) {
      const next: number[] = [];
      for (const id of frontier) {
        for (const n of api.neighbours(id)) {
          if (seen.has(n)) continue;
          if (api.isAttributeNode(n)) return n;
          seen.add(n);
          next.push(n);
        }
      }
      frontier = next;
    }
    throw new Error('no generic attribute node reachable from the start');
  });
}

/**
 * Reads a stat cell. Works before AND after a save+reload, on the scratch
 * planner and on a saved build: Stats is its own tab (stats-panel). The tree
 * hook lives only while the Tree tab shows, so this returns to that tab (and
 * waits for the hook) before handing back, leaving the caller where it was.
 */
async function readStat(page: Page, id: string): Promise<number> {
  await openEditor(page, 'stats');
  const cell = page.getByTestId('stats-panel').getByTestId(id);
  await expect(cell).toHaveText(/^\d+$/, { timeout: 30_000 });
  const value = Number(await cell.textContent());
  await page.getByRole('tab', { name: 'Tree', exact: true }).click();
  await waitForTreeApi(page);
  return value;
}

test.describe('defence stats', () => {
  test.setTimeout(300_000);

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('choosing Strength on an attribute passive adds exactly 5 Str and 10 Life, survives a reload, and a choice never comes back by itself', async ({ page }) => {
    await openTree(page);
    const node = await nearestAttributeNode(page);
    const choice = () => treeState(page).then((s) => s.attributeChoices[node]);

    // Deallocate, then allocate again: the node is fresh, not pre-chosen.
    expect(await page.evaluate((id) => window.__vaalTree!.allocate(id), node)).toBe(true);
    expect(await page.evaluate((id) => window.__vaalTree!.setAttributeChoice(id, 'dex'), node)).toBe(true);
    expect(await choice()).toBe('dex');
    await page.evaluate((id) => window.__vaalTree!.allocate(id), node);
    expect((await treeState(page)).allocated).not.toContain(node);
    await page.evaluate((id) => window.__vaalTree!.allocate(id), node);
    expect((await treeState(page)).allocated).toContain(node);
    expect(await choice()).toBeUndefined();

    // Switch class (to the same one — any switch clears the allocation), then
    // allocate the node again: the old choice must not reappear.
    expect(await page.evaluate((id) => window.__vaalTree!.setAttributeChoice(id, 'int'), node)).toBe(true);
    const classId = (await treeState(page)).classId;
    await page.evaluate((id) => window.__vaalTree!.setClass(id), classId);
    expect((await treeState(page)).allocated).toEqual([]);
    await page.evaluate((id) => window.__vaalTree!.allocate(id), node);
    expect(await choice()).toBeUndefined();

    // The node is allocated again and fresh (no choice) going into the measured part.

    const lifeBefore = await readStat(page, 'stat-life');
    const strBefore = await readStat(page, 'stat-str');

    expect(await page.evaluate((id) => window.__vaalTree!.setAttributeChoice(id, 'str'), node)).toBe(true);
    expect(await readStat(page, 'stat-str')).toBe(strBefore + 5);
    expect(await readStat(page, 'stat-life')).toBe(lifeBefore + 10);

    const name = testBuildName('stats');
    await saveBuild(page, { name });
    expect(await listedBuildNames(page)).toContain(name);
    await openTree(page, await readBuildId(page, name));

    expect((await treeState(page)).attributeChoices[node]).toBe('str');
    expect(await readStat(page, 'stat-life')).toBe(lifeBefore + 10);
  });
});

// Quest rewards (QuestChoices on the Stats tab, session setQuestChoice): a choice reward counts
// once the owner picks it, survives Save and a view-mode reload, and an unreached or unpicked
// quest adds nothing. Ngamahu's Test (area level 52): "+5 to Strength" vs "+5% to Fire
// Resistance"; PoB2 gives +2 Life per Strength, so +5 Str is exactly +10 Life.
test.describe('quest reward choices', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  const statValue = async (page: Page, id: string): Promise<number> => {
    const cell = page.getByTestId('stats-panel').getByTestId(id);
    await expect(cell).toHaveText(/^\d+$/, { timeout: 30_000 });
    return Number(await cell.textContent());
  };

  test('choosing a quest reward changes the sheet by exactly its amount, saves, and shows on reload', async ({ page }) => {
    // Seed at level 55: Ngamahu's Test (52) is reached, Seven Pillars (63) is not.
    await openTree(page);
    await allocateNodes(page, await nodesNearStart(page, 5));
    await saveBuild(page, { name: testBuildName('quest'), level: 55 });
    const token = new URL(page.url()).pathname.split('/').pop()!;

    await page.goto(`/builds/${token}?edit=1&tab=stats`);
    await expect(page.getByTestId('quest-choices')).toBeVisible({ timeout: 60_000 });
    const quest = page.getByTestId('quest-choice-ngamahus-test').locator('select');
    await expect(quest).toHaveValue('');
    // Negative pair: a quest above this level is not offered at all.
    await expect(page.getByTestId('quest-choice-seven-pillars')).toHaveCount(0);

    const strBase = await statValue(page, 'stat-str');
    const lifeBase = await statValue(page, 'stat-life');

    await quest.selectOption('strength');
    await expect(page.getByTestId('save-status')).toHaveText('Unsaved changes');
    await expect(page.getByTestId('stats-panel').getByTestId('stat-str')).toHaveText(String(strBase + 5), { timeout: 30_000 });
    expect(await statValue(page, 'stat-life')).toBe(lifeBase + 10);

    // The other reward of the same quest is not Strength: it must take the +5 back off.
    await quest.selectOption('fire-resistance');
    await expect(page.getByTestId('stats-panel').getByTestId('stat-str')).toHaveText(String(strBase), { timeout: 30_000 });
    expect(await statValue(page, 'stat-life')).toBe(lifeBase);
    await quest.selectOption('strength');
    await expect(page.getByTestId('stats-panel').getByTestId('stat-str')).toHaveText(String(strBase + 5), { timeout: 30_000 });

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('save-status')).toHaveText(/^Saved /, { timeout: 30_000 });

    // View mode, fresh load: the choice text shows (read-only) and the stat holds.
    await page.goto(`/builds/${token}?tab=stats`);
    await expect(page.getByTestId('quest-choice-ngamahus-test-value')).toHaveText('+5 to Strength', { timeout: 60_000 });
    await expect(page.getByTestId('quest-choice-ngamahus-test').locator('select')).toHaveCount(0);
    // Negative pair: a quest left unpicked records nothing.
    await expect(page.getByTestId('quest-choice-tawhoas-test-value')).toHaveText('No choice recorded');
    expect(await statValue(page, 'stat-str')).toBe(strBase + 5);
    expect(await statValue(page, 'stat-life')).toBe(lifeBase + 10);
  });
});
