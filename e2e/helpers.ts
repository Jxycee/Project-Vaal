import type { Browser, Locator, Page, Route } from '@playwright/test';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { TreeTestApi, TreeTestState } from '../src/lib/tree/testApi';
import type { GearSlot } from '../src/lib/build/gearSlots';
import type { BuildVisibility } from '../src/lib/build/types';
import { VISIBILITY_LABEL } from '../src/lib/build/visibility';
import { e2eBaseUrl } from './baseUrl';

const POB_FIXTURE_CODE = readFileSync(path.join(__dirname, '..', 'src', 'lib', 'pob', '__fixtures__', 'sample-pob2-code.txt'), 'utf8');

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
 * Opens `/tree` (the scratch planner, on its Tree tab) or `/tree?build=<id>`
 * (a saved build).
 *
 * With a `buildId`, an owned build with a share token redirects to the build
 * page's Tree tab in edit mode (slice 2) — `page.goto` follows that redirect
 * transparently, so this lands wherever the tree ends up and waits for the
 * same dev-only hook either way.
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
 * Opens the part of the build page that edits `section`: selects its tab and,
 * where there is one, opens its sheet. The same on a saved build and on the
 * scratch planner (`/tree`), which is the same page.
 *
 * `gear` has no sheet (slice 4): selecting the Gear tab shows the paper doll,
 * so this returns the `gear-tab` locator (doll, slot detail and warnings chip)
 * once the doll is on screen. Use `selectGearSlot`, `pickGearItem`,
 * `openItemEditor` and `gearSlotLocator` below to work on a slot.
 *
 * `stats` has no sheet either: StatsPanel renders directly in the tab
 * (`data-testid="stats-panel"`).
 *
 * `gems` has no sheet (slice 5): selecting the Skills tab shows the compact
 * skill rows, so this returns the `skills-tab` locator. Use `openGemGroup` /
 * `closeGemEditor` below to edit one group.
 *
 * `jewels` opens the Gear tab's "Edit jewels" sheet.
 *
 * `checkpoints` (slice 3): management lives in the switcher's own "Manage"
 * toggle, so this opens the switcher, taps Manage, and returns the
 * `checkpoint-manager` locator. Saved builds only: scratch has no checkpoints.
 */
export async function openEditor(page: Page, section: EditorSection): Promise<Locator | void> {
  const tab = SECTION_TAB[section];
  if (tab) await page.getByRole('tab', { name: tab, exact: true }).click();
  switch (section) {
    case 'gear': {
      const gearTab = page.getByTestId('gear-tab');
      await expect(page.getByTestId('paper-doll')).toBeVisible();
      return gearTab;
    }
    case 'jewels': {
      const button = page.getByRole('button', { name: /^(Edit jewels|Loading tree…)$/ });
      await expect(button).toHaveText('Edit jewels', { timeout: 30_000 });
      await button.click();
      break;
    }
    case 'gems': {
      const skillsTab = page.getByTestId('skills-tab');
      await expect(skillsTab).toBeVisible();
      return skillsTab;
    }
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
  // The library's cards link to `/builds/<token>`, and the owner's page adds
  // `?checkpoint=<id>` to that URL with a redirect, so only the path is compared.
  const isBuildPageLink = /^\/builds\/[A-Za-z0-9_-]+$/.test(href);
  // Plain /tree (Quick plan) redirects, server-side, to /tree?tab=tree: the
  // scratch planner opens on the Tree tab.
  const isScratchLink = href === '/tree';
  await page.waitForURL(
    (url) => {
      const current = url.pathname + url.search;
      return (
        current === href ||
        (isTreeBuildLink && url.pathname.startsWith('/builds/')) ||
        (isBuildPageLink && url.pathname === href) ||
        (isScratchLink && url.pathname === '/tree')
      );
    },
    { timeout: 30_000 },
  );
  // The URL changing is not the same as the tree being ready. The build
  // page's session (and the scratch planner's) remounts on a soft navigation,
  // which tears the hook down and reinstalls it. Reading state before that
  // finishes is how this helper produced "Cannot read properties of undefined".
  const landedPath = new URL(page.url()).pathname;
  if (landedPath === '/tree' || (isTreeBuildLink && landedPath.startsWith('/builds/'))) {
    await waitForTreeApi(page);
  }
}

/**
 * Saves the current editor state, on a saved build's page or on the scratch
 * planner (`/tree`).
 *
 * Fields are always on screen in edit mode: fills the header inputs directly,
 * switches to Overview for `#build-notes` (it does not exist on the other
 * tabs), clicks the single Save button, and waits for `save-status` to read
 * `Saved ...`. On the scratch planner the first save creates the build and
 * replaces the URL with its page, so "saved" there is that landing: the
 * helper waits for `/builds/<token>` and the build page.
 */
export async function saveBuild(
  page: Page,
  opts: { name?: string; level?: number; league?: string; notes?: string } = {},
): Promise<void> {
  if (opts.name !== undefined) await page.locator('#build-name').fill(opts.name);
  if (opts.level !== undefined) await page.locator('#build-level').fill(String(opts.level));
  if (opts.league !== undefined) await page.locator('#build-league').fill(opts.league);
  if (opts.notes !== undefined) {
    await page.getByRole('tab', { name: 'Overview', exact: true }).click();
    await page.locator('#build-notes').fill(opts.notes);
  }
  const scratch = new URL(page.url()).pathname === '/tree';
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  if (scratch) {
    // The first save lands on a route the dev server may still be compiling
    // (webpack, cold cache — seen at 30s+ in a screenshot's "Compiling" badge).
    await page.waitForURL(/\/builds\/[A-Za-z0-9_-]+/, { timeout: 120_000 });
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 60_000 });
    return;
  }
  await expect(page.getByTestId('save-status')).toHaveText(/^Saved /, { timeout: 30_000 });
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
  const ready = page.getByTestId('build-card').or(page.getByText('You have not saved a build yet.'));
  await expect(ready.first()).toBeVisible({ timeout: 30_000 });
}

/** Names currently shown on /builds (the library cards). */
export async function listedBuildNames(page: Page): Promise<string[]> {
  await gotoBuilds(page);
  if (await page.getByText('You have not saved a build yet.').isVisible().catch(() => false)) {
    return [];
  }
  return page.getByTestId('build-card-name').allInnerTexts();
}

/** The card for the build named `name` (exact) on /builds. */
export function buildCard(page: Page, name: string): Locator {
  return page.getByTestId('build-card').filter({ has: page.getByTestId('build-card-name').getByText(name, { exact: true }) });
}

/** A build's id, read off its /builds card (`data-build-id`). What `/tree?build=<id>` and the checkpoint URLs need. */
export async function readBuildId(page: Page, name: string): Promise<string> {
  await gotoBuilds(page);
  const card = buildCard(page, name).first();
  await expect(card).toBeVisible();
  const id = await card.getAttribute('data-build-id');
  expect(id, `no data-build-id on the card for ${name}`).toMatch(/^[0-9a-f-]{36}$/);
  return id!;
}

/**
 * Soft-navigates from /builds to a build's page by its card link, then puts it
 * where the old `/tree?build=<id>` redirect landed: edit mode on the Tree tab,
 * with the tree hook up. A real client-side route change, which is what the
 * stale-seed regressions need (see softNavigate).
 */
export async function softOpenBuild(page: Page, token: string): Promise<void> {
  await softNavigate(page, `/builds/${token}`);
  await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('tab', { name: 'Tree', exact: true }).click();
  await waitForTreeApi(page);
}

/** A build's share token, read off its /builds card link. Works for every visibility: the card links to the owner's page regardless. */
export async function readShareToken(page: Page, name: string): Promise<string> {
  await gotoBuilds(page);
  const card = buildCard(page, name).first();
  await expect(card).toBeVisible();
  const href = await card.getAttribute('href');
  expect(href, `no /builds/<token> link on the card for ${name}`).toMatch(/^\/builds\/[A-Za-z0-9_-]+$/);
  return href!.replace('/builds/', '');
}

/** Opens the build page's settings menu (owner only) and returns it. */
export async function openBuildSettings(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Build settings', exact: true }).click();
  const menu = page.getByTestId('build-settings');
  await expect(menu).toBeVisible({ timeout: 30_000 });
  return menu;
}

/** Sets a build's visibility through its settings menu, and leaves the menu closed. */
export async function setVisibility(page: Page, token: string, visibility: BuildVisibility): Promise<void> {
  await page.goto(`/builds/${token}`);
  await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
  const menu = await openBuildSettings(page);
  const radio = menu.getByRole('radio', { name: new RegExp(`^${VISIBILITY_LABEL[visibility]}`) });
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked', 'true', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Close build settings', exact: true }).click();
  await expect(menu).toBeHidden();
}

/**
 * Imports the vendored PoB2 fixture through the real Import sheet and returns
 * the new build's share token, read off the URL the import lands on
 * (`/builds/<token>?...edit=1`, slice 7a).
 */
export async function importFixture(page: Page, name: string, code: string = POB_FIXTURE_CODE): Promise<string> {
  await gotoBuilds(page);
  await page.getByTestId('open-import-sheet').click();
  const sheet = page.getByTestId('import-sheet');
  await sheet.getByTestId('import-input').fill(code);
  await sheet.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(sheet.getByTestId('import-preview')).toBeVisible({ timeout: 60_000 });
  await sheet.getByTestId('import-name').fill(name);
  await sheet.getByRole('button', { name: 'Import', exact: true }).click();
  await page.waitForURL(/\/builds\/[A-Za-z0-9_-]+/, { timeout: 60_000 });
  return new URL(page.url()).pathname.split('/').pop()!;
}

/**
 * Deletes every row this suite created. Runs through the real UI rather than
 * the database: each E2E- card -> its page -> Build settings -> Delete ->
 * Confirm delete, which exercises the delete path on the way past.
 *
 * The 5.1MB tree export the build page fetches after paint is aborted here:
 * nothing in this loop looks at the tree.
 */
export async function cleanupTestBuilds(page: Page): Promise<void> {
  await gotoBuilds(page);

  const cards = page.getByTestId('build-card').filter({ has: page.getByTestId('build-card-name').getByText(TEST_PREFIX) });
  const skipTree = (route: Route) => route.abort();
  await page.route(/\/data\/tree\/.*data\.json/, skipTree);
  try {
    for (let pass = 0; pass < 50; pass += 1) {
      const remaining = await cards.count();
      if (remaining === 0) return;

      const href = await cards.first().getAttribute('href');
      await page.goto(href!);
      const menu = await openBuildSettings(page);
      await menu.getByRole('button', { name: 'Delete build', exact: true }).click();
      await menu.getByRole('button', { name: 'Confirm delete', exact: true }).click();
      await page.waitForURL((url) => url.pathname === '/builds', { timeout: 30_000 });

      // deleteBuild revalidates /builds. Asserting the count actually fell is
      // what proves the delete landed, rather than failing silently and
      // looping to the cap.
      await expect(cards).toHaveCount(remaining - 1, { timeout: 30_000 });
    }
    throw new Error('Gave up deleting E2E- builds after 50 passes — check /builds by hand.');
  } finally {
    await page.unroute(/\/data\/tree\/.*data\.json/, skipTree);
  }
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

// ---- Gem groups -------------------------------------------------------------
// The build page shows compact `skill-row`s (slice 5) and, in edit mode, opens
// a `gem-group-sheet` for the tapped one. It renders the GemLoadoutEditor card.

/**
 * Opens gem group `index` (the row's position, main skill first; needs edit
 * mode) and returns its editor card: the `<li>` holding the skill button,
 * level input, supports, set toggles and Main skill.
 */
export async function openGemGroup(page: Page, index: number): Promise<Locator> {
  await page.getByTestId('skill-row').nth(index).click();
  const sheet = page.getByTestId('gem-group-sheet');
  await expect(sheet).toBeVisible();
  return sheet.locator('ul > li').first();
}

/** Closes the open gem group sheet. */
export async function closeGemEditor(page: Page): Promise<void> {
  const sheet = page.getByTestId('gem-group-sheet');
  await sheet.getByRole('button', { name: 'Close skill group' }).click();
  await expect(sheet).toBeHidden();
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

// ---- Gear slots ---------------------------------------------------------------
// The build page edits gear on the paper doll: a `doll-slot-<slot>` cell, with
// a `gear-slot-detail` panel below.

/** Shows weapon set `set` (I or II) on the paper doll. */
export async function setGearWeaponSet(page: Page, set: 1 | 2): Promise<void> {
  await page.getByTestId('paper-doll').getByRole('button', { name: set === 1 ? 'Set I' : 'Set II', exact: true }).click();
}

/** A slot's doll cell. Weapon cells are for the set currently showing. */
export function gearSlotLocator(page: Page, slot: GearSlot): Locator {
  return page.getByTestId(`doll-slot-${slot}`);
}

/** Makes `slot` the one being looked at: switches to its weapon set and taps its doll cell (opening the detail panel). */
export async function selectGearSlot(page: Page, slot: GearSlot): Promise<void> {
  if (slot.startsWith('weapon')) await setGearWeaponSet(page, slot.startsWith('weapon1') ? 1 : 2);
  await page.getByTestId(`doll-slot-${slot}`).click();
  await expect(page.getByTestId('gear-slot-detail')).toBeVisible();
}

/**
 * Picks an item into `slot` through the item picker, and returns the picked
 * name. With `name`, searches for and takes the row named exactly that; with
 * none, takes the first result (minus the picker's " Unique" suffix). Asserts
 * the slot's holder then shows the item. Call `openEditor(page, 'gear')` first.
 */
export async function pickGearItem(page: Page, slot: GearSlot, name?: string): Promise<string> {
  await selectGearSlot(page, slot);
  const holder = gearSlotLocator(page, slot);
  const opener = page.getByTestId('gear-slot-detail').getByRole('button', { name: 'Choose item', exact: true });

  if (name !== undefined) {
    await pickByName(page, opener, name);
    await expect(holder).toContainText(name);
    return name;
  }

  await opener.click();
  const picker = page.locator('.z-50');
  await expect(picker.getByPlaceholder('Search items…')).toBeVisible();
  const firstResult = picker.locator('ul li button').first();
  await expect(firstResult).toBeVisible({ timeout: 15_000 });
  const raw = (await firstResult.locator('span.truncate').first().textContent()) ?? '';
  const picked = raw.replace(/\s*Unique\s*$/, '').trim();
  expect(picked.length, 'the picker returned a result with no name').toBeGreaterThan(0);
  await firstResult.click();
  await expect(picker.getByPlaceholder('Search items…')).toBeHidden();
  await expect(holder).toContainText(picked);
  return picked;
}

/** Opens the item editor for the item in `slot` (`item-editor`). */
export async function openItemEditor(page: Page, slot: GearSlot): Promise<Locator> {
  await selectGearSlot(page, slot);
  await page.getByTestId('gear-slot-detail').getByRole('button', { name: 'Edit affixes', exact: true }).click();
  const editor = page.getByTestId('item-editor');
  await expect(editor).toBeVisible();
  return editor;
}

/**
 * Every structural warning on screen as `build-warning` items. They sit behind
 * the collapsed `gear-warnings` chip, so this expands it (if it is present and
 * closed) first.
 */
export async function gearWarningItems(page: Page): Promise<Locator> {
  const chip = page.getByTestId('gear-warnings');
  if ((await chip.count()) > 0 && (await chip.getAttribute('aria-expanded')) !== 'true') await chip.click();
  return page.getByTestId('gear-tab').getByTestId('build-warning');
}

// ---- Seeding and share-link proofs, without the UI ----------------------------

/**
 * Creates a build through POST /api/builds (the same route the editor saves
 * through) and returns its id and share token. Far cheaper than the UI for a
 * spec whose subject is not creation, and it never mounts the tree. New builds
 * are `unlisted` (owner only), the column default.
 */
export async function createBuildViaApi(
  page: Page,
  name: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; token: string }> {
  const res = await page.request.post('/api/builds', {
    data: {
      name,
      class: 'Witch',
      level: 12,
      league: 'Standard',
      passive_state: { set1: [], set2: [], ascendancyNodes: [] },
      ...overrides,
    },
  });
  expect(res.status(), `POST /api/builds for ${name}`).toBe(200);
  const { build } = (await res.json()) as { build: { id: string; share_token: string } };
  return { id: build.id, token: build.share_token };
}

/**
 * Reassembles the signed-in session's access token from the Supabase SSR auth
 * cookie (`sb-<project-ref>-auth-token`, chunked into `.0`/`.1` parts when
 * large, optionally `base64-` prefixed and base64url encoded).
 */
export async function accessToken(page: Page): Promise<string> {
  const parts = (await page.context().cookies())
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  let raw = decodeURIComponent(parts.map((c) => c.value).join(''));
  if (raw.startsWith('base64-')) raw = Buffer.from(raw.slice('base64-'.length), 'base64url').toString('utf8');
  return (JSON.parse(raw) as { access_token: string }).access_token;
}

/**
 * Calls the get_build_by_share_token RPC over PostgREST exactly as a signed-in
 * reader's browser would: anon apikey plus the caller's own bearer token.
 * Its empty result for an `unlisted` build is what proves a share link is
 * revoked (the owner can still open the page through the owner path, so a page
 * load alone proves nothing about a reader).
 */
export async function callShareTokenRpc(page: Page, shareToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  expect(
    supabaseUrl && supabaseAnonKey,
    'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be in .env.local',
  ).toBeTruthy();
  return page.request.post(`${supabaseUrl}/rest/v1/rpc/get_build_by_share_token`, {
    data: { p_token: shareToken },
    headers: {
      apikey: supabaseAnonKey!,
      authorization: `Bearer ${await accessToken(page)}`,
      'content-type': 'application/json',
    },
  });
}
