import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { TreeTestApi, TreeTestState } from '../src/lib/tree/testApi';

/**
 * Every row these specs create is named with this prefix so cleanup can find
 * them unambiguously, and so a leftover row is obviously test debris rather
 * than something the account's owner made.
 */
export const TEST_PREFIX = 'E2E-';

export function testBuildName(label: string): string {
  return `${TEST_PREFIX}${label}-${Date.now().toString(36)}`;
}

declare global {
  interface Window {
    __vaalTree?: TreeTestApi;
  }
}

/**
 * Waits for the dev-only automation hook PassiveTree installs.
 *
 * The tree is a pixi/WebGL canvas with no DOM per node, so this hook is the
 * only reliable way to drive allocation. If it never appears, the most likely
 * causes are that the server is running a production build (where the hook is
 * deliberately eliminated) or that the tree failed to mount at all — both are
 * worth failing loudly on rather than timing out on a later assertion.
 */
export async function waitForTreeApi(page: Page): Promise<void> {
  await page
    .waitForFunction(() => Boolean(window.__vaalTree), null, { timeout: 60_000 })
    .catch(() => {
      throw new Error(
        'window.__vaalTree never appeared. The dev-only tree hook is missing — ' +
          'is the server running a production build, or did PassiveTree fail to mount?',
      );
    });
}

export async function treeState(page: Page): Promise<TreeTestState> {
  // Waits internally rather than trusting the caller to have done so. The tree
  // remounts on every build switch, so the hook comes and goes constantly, and
  // "Cannot read properties of undefined" here reads like an app fault when it
  // is really just a missed await.
  await waitForTreeApi(page);
  return page.evaluate(() => window.__vaalTree!.getState());
}

/**
 * Waits until the editor has actually written a draft to localStorage.
 *
 * The draft is written from an effect, i.e. after React commits — so a reload
 * issued immediately after allocating can beat it and legitimately find
 * nothing. A human cannot refresh that fast, but a test can, and without this
 * the resulting failure looks like "draft restore is broken".
 */
export async function waitForDraft(page: Page, buildId?: string): Promise<void> {
  const key = `vaal:tree-draft:${buildId ?? 'scratch'}`;
  await page.waitForFunction((k) => localStorage.getItem(k) !== null, key, { timeout: 30_000 });
}

/** Allocates nodes by id through the app's real commit path, with BFS pathing. */
export async function allocateNodes(page: Page, ids: number[]): Promise<void> {
  await page.evaluate((nodeIds) => {
    for (const id of nodeIds) window.__vaalTree!.allocate(id);
  }, ids);
}

export async function openTree(page: Page, buildId?: string): Promise<void> {
  await page.goto(buildId ? `/tree?build=${buildId}` : '/tree');
  await waitForTreeApi(page);
}

/**
 * Soft navigation — a real client-side route change, which is what several of
 * the bugs this suite guards against actually require. Typing a URL into the
 * address bar does a full reload and proves nothing about them.
 */
export async function softNavigate(page: Page, href: string): Promise<void> {
  await page.evaluate((target) => {
    const link = document.querySelector<HTMLAnchorElement>(`a[href="${target}"]`);
    if (!link) throw new Error(`No <a href="${target}"> on the page to soft-navigate with`);
    link.click();
  }, href);
  await page.waitForURL((url) => url.pathname + url.search === href, { timeout: 30_000 });
  // The URL changing is not the same as the tree being ready. TreeBuildSession
  // is keyed by build id, so a soft navigation unmounts and remounts it, which
  // tears the hook down and reinstalls it. Reading state before that finishes
  // is how this helper produced "Cannot read properties of undefined".
  if (new URL(page.url()).pathname === '/tree') await waitForTreeApi(page);
}

/** Saves the current editor state through the save panel. */
export async function saveBuild(
  page: Page,
  opts: { name?: string; level?: number; league?: string } = {},
): Promise<void> {
  const panel = page.getByRole('button', { name: /^(Save build|Saved build)$/ });
  if (await panel.isVisible().catch(() => false)) await panel.click();

  if (opts.name !== undefined) await page.locator('#build-name').fill(opts.name);
  if (opts.level !== undefined) await page.locator('#build-level').fill(String(opts.level));
  if (opts.league !== undefined) await page.locator('#build-league').fill(opts.league);

  await page.getByRole('button', { name: /^(Save|Update)$/ }).click();
  await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 30_000 });
}

/** Names currently shown on /builds. */
export async function listedBuildNames(page: Page): Promise<string[]> {
  await page.goto('/builds');
  await page.waitForLoadState('networkidle');
  if (await page.getByText('You have not saved a build yet.').isVisible().catch(() => false)) {
    return [];
  }
  return page.locator('ul > li a[href^="/tree?build="]').allInnerTexts();
}

/**
 * Deletes every row this suite created. Runs through the real UI rather than
 * the database, both because delete is a Server Function with no direct HTTP
 * shape and because it exercises the delete path on the way past.
 */
export async function cleanupTestBuilds(page: Page): Promise<void> {
  for (let pass = 0; pass < 25; pass += 1) {
    await page.goto('/builds');
    await page.waitForLoadState('networkidle');

    const row = page
      .locator('ul > li')
      .filter({ has: page.locator(`a[href^="/tree?build="]:has-text("${TEST_PREFIX}")`) })
      .first();
    if ((await row.count()) === 0) return;

    await row.getByRole('button', { name: 'Delete' }).click();
    await row.getByRole('button', { name: 'Delete' }).click();
    await page.waitForLoadState('networkidle');
  }
  throw new Error('Gave up deleting E2E- builds after 25 passes — check /builds by hand.');
}
