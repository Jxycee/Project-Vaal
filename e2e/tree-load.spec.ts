import { writeFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { cleanupWithFreshPage, importFixture, testBuildName, waitForTreeApi } from './helpers';

// Performance contract: the 5.1 MB passive-tree export (data.json) is the
// WebGL canvas's alone. Overview / Gear / Skills / Stats run on lite.json
// (~190 KB) and must never fetch it; the Tree tab fetches it exactly once.
// Correctness rides along: the stats panel must still compute numbers off lite
// data (exact fixture values are pinned by pob-import.spec).
// Artifact: <test output dir>/tree-load-requests.json — every tree-file
// request in order, with sizes, so a regression is a diff, not a guess.
const TABS = ['Overview', 'Gear', 'Skills', 'Stats'] as const;
const TREE_FILE = /\/data\/tree\/[^/]+\/(lite|data)\.json$/;

async function openTab(page: Page, tab: string): Promise<void> {
  await page.getByRole('tab', { name: tab, exact: true }).click();
  await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId(`${tab.toLowerCase()}-tab`)).toBeVisible();
}

test.describe('tree file loading', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(300_000);

  const name = testBuildName('treeload');
  let token = '';

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('data.json is fetched only by the Tree tab; the other tabs run on lite.json', async ({ page }, testInfo) => {
    token = await importFixture(page, name);

    const log: { phase: string; file: string; bytes: number }[] = [];
    let phase = 'load';
    const pending: Promise<void>[] = [];
    page.on('requestfinished', (req) => {
      const m = TREE_FILE.exec(new URL(req.url()).pathname);
      if (!m) return;
      const at = phase;
      pending.push(req.sizes().then((z) => void log.push({ phase: at, file: `${m[1]}.json`, bytes: z.responseBodySize })));
    });
    const count = (file: string, p?: string) => log.filter((e) => e.file === file && (!p || e.phase === p)).length;

    // Fresh load straight onto the Stats tab: lite for the numbers, never data.json.
    phase = 'stats-first-load';
    await page.goto(`/builds/${token}?tab=stats`);
    const stats = page.getByTestId('stats-panel');
    // The default checkpoint is the first (level 31); exact fixture numbers are pinned by pob-import.spec.
    await expect(stats.getByTestId('stat-life')).toHaveText(/^\d+$/, { timeout: 60_000 });
    await expect(stats.getByTestId('stat-mana')).toHaveText(/^\d+$/);

    for (const tab of TABS) {
      phase = `tab:${tab}`;
      await openTab(page, tab);
      await page.waitForTimeout(1_500);
    }
    await Promise.all(pending);
    expect(count('data.json'), 'a non-tree tab fetched the 5 MB export').toBe(0);
    expect(log.filter((e) => e.file === 'lite.json' && e.phase !== 'stats-first-load'), 'lite.json refetched while switching tabs').toEqual([]);

    // The Tree tab is what pays for the big file, and only once.
    phase = 'tab:Tree';
    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await expect(page.getByTestId('tree-tab')).toBeVisible();
    await expect.poll(() => count('data.json'), { timeout: 60_000 }).toBe(1);
    await waitForTreeApi(page);

    // Back to Stats and Tree again: module cache, no second download.
    phase = 'return';
    await openTab(page, 'Stats');
    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await waitForTreeApi(page);
    await Promise.all(pending);
    expect(count('data.json'), 'the full export was fetched again after the first Tree visit').toBe(1);
    await expect(page.getByTestId('tree-tab')).toBeVisible();

    const lite = { bytes: Math.max(...log.filter((e) => e.file === 'lite.json').map((e) => e.bytes)) };
    const full = log.find((e) => e.file === 'data.json')!;
    expect(lite.bytes).toBeLessThan(250_000);
    expect(full.bytes, 'transfer size (compressed)').toBeGreaterThan(400_000);
    expect(full.bytes).toBeGreaterThan(lite.bytes * 5);

    const artifact = testInfo.outputPath('tree-load-requests.json');
    writeFileSync(artifact, JSON.stringify({ build: name, requests: log, liteTransferBytes: lite.bytes, fullTransferBytes: full.bytes }, null, 2));
    await testInfo.attach('tree-load-requests', { path: artifact, contentType: 'application/json' });
  });
});
