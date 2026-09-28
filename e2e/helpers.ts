import type { Browser, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import path from 'node:path';
import type { TreeTestApi, TreeTestState } from '../src/lib/tree/testApi';
import { e2eBaseUrl } from './baseUrl';

/**
 * Every row these specs create is named with this prefix so cleanup can find
 * them unambiguously, and so a leftover row is obviously test debris rather
 * than something the account's owner made.
 */
export const TEST_PREFIX = 'E2E-';

/** Absolute, because the cleanup context below is built outside the config's cwd assumptions. */
const STORAGE_STATE = path.join(__dirname, '.auth', 'user.json');

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
export async function waitForDraft(page: Page, buildId?: string, checkpointId?: string): Promise<void> {
  // Mirrors draftKey() in src/lib/build/draft.ts, whose unit tests pin this
  // exact format — including that it is unchanged when there is no checkpoint.
  const base = `vaal:tree-draft:${buildId ?? 'scratch'}`;
  const key = checkpointId ? `${base}:${checkpointId}` : base;
  await page.waitForFunction((k) => localStorage.getItem(k) !== null, key, { timeout: 30_000 });
}

/** Allocates nodes by id through the app's real commit path, with BFS pathing. */
export async function allocateNodes(page: Page, ids: number[]): Promise<void> {
  await page.evaluate((nodeIds) => {
    for (const id of nodeIds) window.__vaalTree!.allocate(id);
  }, ids);
}

/**
 * Walks outward from the class start and returns `count` main-tree node ids.
 * Moved here from build-persistence.spec.ts once a second spec needed it.
 */
export async function nodesNearStart(page: Page, count: number): Promise<number[]> {
  return page.evaluate((want) => {
    const api = window.__vaalTree!;
    const start = api.startNode();
    const seen = new Set<number>([start]);
    const found: number[] = [];
    let frontier = [start];
    while (frontier.length > 0 && found.length < want) {
      const next: number[] = [];
      for (const id of frontier) {
        for (const n of api.neighbours(id)) {
          if (seen.has(n)) continue;
          seen.add(n);
          next.push(n);
          if (found.length < want) found.push(n);
        }
      }
      frontier = next;
    }
    return found;
  }, count);
}

/**
 * Opens `/tree` (scratch) or `/tree?build=<id>` (a saved build).
 *
 * With a `buildId`, an owned build with a share token now redirects here to
 * the build page's Tree tab in edit mode (slice 2) — `page.goto` follows that
 * redirect transparently, so this still lands wherever the tree ends up and
 * waits for the same dev-only hook either way.
 */
export async function openTree(page: Page, buildId?: string): Promise<void> {
  await page.goto(buildId ? `/tree?build=${buildId}` : '/tree');
  await waitForTreeApi(page);
}

/** Which build-page tab a given editor section lives under. */
const SECTION_TAB = {
  gear: 'Gear',
  jewels: 'Gear',
  gems: 'Skills',
  stats: 'Stats',
  checkpoints: null,
} as const;

export type EditorSection = keyof typeof SECTION_TAB;

/**
 * Opens an editor sheet (or, for `stats`, just the panel) for `section`.
 * Works on both UIs a saved build can be reopened on: the old `/tree` chips
 * (Gear / Jewels… / Gems… / Stats / Checkpoints…) and the build page's tabs +
 * "Edit gear" / "Edit jewels" / "Edit skills" / the checkpoint switcher.
 *
 * `stats` has no sheet on the build page — StatsPanel renders directly in the
 * tab (`data-testid="stats-panel"`), unlike `/tree`'s `stats-sheet`. Callers
 * must read the testid that matches wherever they ended up.
 *
 * For `checkpoints` on the build page (slice 3): management moved from a
 * "Manage checkpoints" sheet entry into the switcher's own "Manage" toggle,
 * so this opens the switcher, taps Manage, and returns the
 * `checkpoint-manager` locator — the only case with a return value, since
 * every other section (and the old `/tree` chips' `checkpoints` case, which
 * still opens CheckpointsSheet) has nothing worth handing back.
 */
export async function openEditor(page: Page, section: EditorSection): Promise<Locator | void> {
  const onBuildPage = new URL(page.url()).pathname.startsWith('/builds/');

  if (onBuildPage) {
    const tab = SECTION_TAB[section];
    if (tab) await page.getByRole('tab', { name: tab, exact: true }).click();
    switch (section) {
      case 'gear':
        await page.getByRole('button', { name: 'Edit gear' }).click();
        break;
      case 'jewels': {
        const button = page.getByRole('button', { name: /^(Edit jewels|Loading tree…)$/ });
        await expect(button).toHaveText('Edit jewels', { timeout: 30_000 });
        await button.click();
        break;
      }
      case 'gems':
        await page.getByRole('button', { name: 'Edit skills' }).click();
        break;
      case 'stats':
        // Selecting the Stats tab above is the whole job — no sheet to open.
        break;
      case 'checkpoints': {
        await page.getByTestId('checkpoint-switcher').click();
        const menu = page.getByTestId('checkpoint-menu');
        await expect(menu).toBeVisible();
        await menu.getByRole('button', { name: 'Manage', exact: true }).click();
        const manager = page.getByTestId('checkpoint-manager');
        await expect(manager).toBeVisible();
        return manager;
      }
    }
    return;
  }

  // Old /tree chips.
  switch (section) {
    case 'gear':
      await page.getByRole('button', { name: 'Gear', exact: true }).click();
      break;
    case 'jewels':
      await page.getByRole('button', { name: /^Jewels/ }).click();
      break;
    case 'gems':
      await page.getByRole('button', { name: /^Gems/ }).click();
      break;
    case 'stats':
      await page.getByRole('button', { name: 'Stats', exact: true }).click();
      break;
    case 'checkpoints':
      await page.getByRole('button', { name: /^Checkpoints/ }).click();
      break;
  }
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
  // A `/tree?build=<id>` link (still what /builds rows render, this slice)
  // for an owned build with a share token now redirects — server-side, but
  // followed by the client router without a full reload — to the build
  // page's Tree tab in edit mode. So the URL this soft nav lands on can
  // legitimately differ from `href`. Only that one redirect shape is
  // tolerated; anything else must still land exactly on `href`.
  const isTreeBuildLink = /^\/tree\?build=/.test(href);
  await page.waitForURL(
    (url) => {
      const current = url.pathname + url.search;
      return current === href || (isTreeBuildLink && url.pathname.startsWith('/builds/'));
    },
    { timeout: 30_000 },
  );
  // The URL changing is not the same as the tree being ready. TreeBuildSession
  // (and, for a redirected build-page landing, BuildSession) is keyed by
  // build id, so a soft navigation unmounts and remounts it, which tears the
  // hook down and reinstalls it. Reading state before that finishes is how
  // this helper produced "Cannot read properties of undefined".
  const landedPath = new URL(page.url()).pathname;
  if (landedPath === '/tree' || (isTreeBuildLink && landedPath.startsWith('/builds/'))) {
    await waitForTreeApi(page);
  }
}

/**
 * Saves the current editor state.
 *
 * On the build page (`/builds/…`, slice 2), fields are always on screen in
 * edit mode: fills the header inputs directly, switches to Overview for
 * `#build-notes` (it does not exist on the other tabs), clicks the single
 * Save button, and waits for `save-status` to read `Saved …`. On `/tree`
 * (scratch editor, unaffected by slice 2) it opens the save panel if
 * collapsed and behaves exactly as before.
 */
export async function saveBuild(
  page: Page,
  opts: { name?: string; level?: number; league?: string; notes?: string } = {},
): Promise<void> {
  const onBuildPage = new URL(page.url()).pathname.startsWith('/builds/');

  if (onBuildPage) {
    if (opts.name !== undefined) await page.locator('#build-name').fill(opts.name);
    if (opts.level !== undefined) await page.locator('#build-level').fill(String(opts.level));
    if (opts.league !== undefined) await page.locator('#build-league').fill(opts.league);
    if (opts.notes !== undefined) {
      await page.getByRole('tab', { name: 'Overview', exact: true }).click();
      await page.locator('#build-notes').fill(opts.notes);
    }
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('save-status')).toHaveText(/^Saved /, { timeout: 30_000 });
    return;
  }

  const panel = page.getByRole('button', { name: /^(Save build|Saved build)$/ });
  if (await panel.isVisible().catch(() => false)) await panel.click();

  if (opts.name !== undefined) await page.locator('#build-name').fill(opts.name);
  if (opts.level !== undefined) await page.locator('#build-level').fill(String(opts.level));
  if (opts.league !== undefined) await page.locator('#build-league').fill(opts.league);
  if (opts.notes !== undefined) await page.locator('#build-notes').fill(opts.notes);

  await page.getByRole('button', { name: /^(Save|Update)$/ }).click();
  await expect(page.getByText(/^Saved /)).toBeVisible({ timeout: 30_000 });
}

/** iOS/Android guidance both land on ~44px as the minimum comfortable target. */
export const MIN_TAP_PX = 44;

/**
 * Measures every rendered control under `rootSelector` and returns the ones
 * too small in EITHER dimension, plus how many were scanned.
 *
 * `scanned` matters: `expect(tooSmall).toEqual([])` over a querySelectorAll is
 * green whenever the selector matches nothing, so a caller must assert it
 * actually measured something. Injected per call rather than via an init
 * script so specs that did not opt into one can still use it.
 */
export async function measureTapTargets(
  page: Page,
  rootSelector: string,
): Promise<{ scanned: number; tooSmall: { text: string; width: number; height: number }[] }> {
  return page.evaluate(
    ({ sel, min }) => {
      const root = document.querySelector(sel) ?? document.body;
      const els = [...root.querySelectorAll<HTMLElement>('button, a[href]')]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0);
      return {
        scanned: els.length,
        tooSmall: els
          .filter(({ r }) => r.height < min || r.width < min)
          .map(({ el, r }) => ({
            text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40),
            width: Math.round(r.width),
            height: Math.round(r.height),
          })),
      };
    },
    { sel: rootSelector, min: MIN_TAP_PX },
  );
}

/**
 * Opens /builds and waits for it to have rendered its answer.
 *
 * Deliberately not `waitForLoadState('networkidle')`, which this file used to
 * do everywhere: the page registers a service worker and Next's dev server
 * keeps connections of its own open, so "500ms without a request" is a timing
 * coincidence rather than a statement about the DOM. The list or the empty
 * state appearing is the real signal — and since a signed-out visitor gets
 * neither, this also turns "this page is not actually authenticated" into a
 * loud failure instead of a silently empty result.
 */
export async function gotoBuilds(page: Page): Promise<void> {
  // A goto to the URL the page is ALREADY on can be aborted by Chromium as a
  // no-op navigation — `net::ERR_ABORTED`, which surfaces as a hard failure.
  // auth.setup.ts hits exactly that: it warms /builds and then, a few lines
  // later, sweeps leftover rows through this helper. The page is healthy in
  // that state (it is rendered and serving 200), so a reload is both the
  // correct intent and the thing that cannot be elided.
  if (new URL(page.url()).pathname === '/builds') {
    await page.reload();
  } else {
    await page.goto('/builds');
  }
  const ready = page
    .locator('ul > li a[href^="/tree?build="]')
    .or(page.getByText('You have not saved a build yet.'));
  await expect(ready.first()).toBeVisible({ timeout: 30_000 });
}

/** Names currently shown on /builds. */
export async function listedBuildNames(page: Page): Promise<string[]> {
  await gotoBuilds(page);
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
  await gotoBuilds(page);

  const rows = page
    .locator('ul > li')
    .filter({ has: page.locator(`a[href^="/tree?build="]:has-text("${TEST_PREFIX}")`) });

  for (let pass = 0; pass < 50; pass += 1) {
    const remaining = await rows.count();
    if (remaining === 0) return;

    const row = rows.first();
    // Two taps: the first arms the row's confirm state, the second commits.
    // Waiting for Cancel in between is what makes that reliable — without it
    // the second click can land before React has swapped the row's buttons,
    // re-arming the same confirm and leaving the row undeleted.
    await row.getByRole('button', { name: 'Delete' }).click();
    await expect(row.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await row.getByRole('button', { name: 'Delete' }).click();

    // deleteBuild revalidates /builds, so the row detaches in place and no
    // reload is needed. Asserting the count actually fell is also what proves
    // the delete landed, rather than failing silently and looping to the cap.
    await expect(rows).toHaveCount(remaining - 1, { timeout: 30_000 });
  }
  throw new Error('Gave up deleting E2E- builds after 50 passes — check /builds by hand.');
}

/**
 * Cleanup for an `afterAll` hook, which is the only place this is subtle.
 *
 * `afterAll` may take worker-scoped fixtures only, so it has to build its own
 * page from `browser` — and a context created that way inherits NONE of the
 * project's `use` options. Passing storageState and baseURL explicitly is not
 * a nicety: without them the cleanup page is signed out and has no base to
 * resolve `/builds` against, so every row the spec created stays in the shared
 * account.
 */
export async function cleanupWithFreshPage(browser: Browser): Promise<void> {
  const context = await browser.newContext({
    baseURL: e2eBaseUrl(),
    storageState: STORAGE_STATE,
  });
  try {
    await cleanupTestBuilds(await context.newPage());
  } finally {
    await context.close();
  }
}

/** Opens the picker from `opener`, searches for `name`, and picks the row whose name is exactly `name`. */
export async function pickByName(page: Page, opener: Locator, name: string): Promise<void> {
  await opener.click();
  const picker = page.locator('.z-50');
  const search = picker.getByPlaceholder('Search items…');
  await expect(search).toBeVisible();
  await search.fill(name);
  const exact = picker
    .locator('ul li button')
    .filter({ has: page.locator('span.truncate', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) });
  await expect(exact).toHaveCount(1, { timeout: 15_000 });
  await exact.click();
  await expect(search).toBeHidden();
}
