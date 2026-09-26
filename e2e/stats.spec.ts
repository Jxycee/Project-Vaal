import { test, expect, type Page } from '@playwright/test';
import { cleanupWithFreshPage, listedBuildNames, openTree, saveBuild, testBuildName, treeState } from './helpers';

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

async function readStat(page: Page, id: string): Promise<number> {
  await page.getByRole('button', { name: 'Stats', exact: true }).click();
  const cell = page.getByTestId('stats-sheet').getByTestId(id);
  await expect(cell).toHaveText(/^\d+$/, { timeout: 30_000 });
  const value = Number(await cell.textContent());
  await page.getByRole('button', { name: 'Close stats sheet' }).click();
  return value;
}

test.describe('defence stats', () => {
  test.setTimeout(300_000);

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('choosing Strength on an attribute passive adds exactly 5 Str and 10 Life, and survives a reload', async ({ page }) => {
    await openTree(page);
    const node = await nearestAttributeNode(page);
    expect(await page.evaluate((id) => window.__vaalTree!.allocate(id), node)).toBe(true);

    const lifeBefore = await readStat(page, 'stat-life');
    const strBefore = await readStat(page, 'stat-str');

    expect(await page.evaluate((id) => window.__vaalTree!.setAttributeChoice(id, 'str'), node)).toBe(true);
    expect(await readStat(page, 'stat-str')).toBe(strBefore + 5);
    expect(await readStat(page, 'stat-life')).toBe(lifeBefore + 10);

    const name = testBuildName('stats');
    await saveBuild(page, { name });
    expect(await listedBuildNames(page)).toContain(name);
    const href = await page.locator(`a:has-text("${name}")`).getAttribute('href');
    await openTree(page, new URL(href!, 'http://x').searchParams.get('build')!);

    expect((await treeState(page)).attributeChoices[node]).toBe('str');
    expect(await readStat(page, 'stat-life')).toBe(lifeBefore + 10);
  });
});
