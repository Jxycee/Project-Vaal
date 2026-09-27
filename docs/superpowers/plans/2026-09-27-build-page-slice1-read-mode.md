# Build Page — Slice 1 (Read Mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long-scroll shared page at `/builds/[shareToken]` with a tabbed build page (Overview · Gear · Skills · Tree · Stats) for the owner and for readers, including the owner's own `unlisted` builds, with a compact header, a checkpoint switcher, header stats and a desktop stats rail. Read only; editing stays in `/tree` until slice 2.

**Architecture:** The Server Component tries an **owner path** first (`builds` row by `share_token` + `user_id`, the owner's own RLS), then falls back to today's **reader path** (share-token RPCs only). It renders one client `BuildPage`, keyed by checkpoint. `BuildPage` reads `?tab=` from `useSearchParams` and switches tabs with `window.history.pushState`, so a tab tap never reaches the server. The 5.1 MB tree export is fetched once, after first paint, and feeds the stats engine and the Tree tab.

**Tech Stack:** Next.js 16.2.9 (App Router), React, TypeScript, Tailwind, Supabase, Playwright (E2E), Vitest (pure logic only).

**Spec:** `docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md` — §3 decisions, §4 routes, §5 anatomy, §6.5 tree export, §7.1 owner/reader, §10 slice 1.

## Global Constraints

- Mobile first. The unprefixed classes are the complete 375px layout; `md:` adds the rail.
- **No horizontal page scroll at 375px, anywhere** (user, 2026-09-27: "horizontal scrolling should be a no no (unless it's like a chip tab design to scroll through tabs)"). Some vertical scroll is fine.
- Every `button` and `a[href]` ≥ 44px in both dimensions (`h-11`, `min-w-11`).
- Tab and URL changes for `tab` use `window.history.pushState`; **never** `router.push`/`<Link>` for tabs (the server page increments the view count).
- Checkpoint changes are `<Link>` navigations (server), as today.
- Visibility words exactly as `src/lib/build/visibility.ts` (`VISIBILITY_LABEL`, `VISIBILITY_HINT`). `unlisted` = owner only, `private` = anyone with the link. Do not "fix".
- Readers reach a build only through `get_build_by_share_token` / `get_build_checkpoints_by_share_token`. Owner queries always carry `.eq('user_id', user.id)`. Signed-out → `redirect('/login')` before any load. The view count is never incremented for the owner or a non-public build.
- Wiki icons render with plain `<img>` (not `next/image`): they are under the auth-gated `/data/wiki/` prefix.
- No GGG art beyond the wiki gem/item icons already used. Visual styling is placeholder (existing tokens: `border-border`, `bg-card/40`, `text-muted-foreground`, `font-heading`).
- Edit button (owner) links to the existing editor `/tree?build=<id>&checkpoint=<id>` in this slice.
- `/builds` (MyBuildsList) is **not** changed in this slice; E2E cleanup depends on its `a[href^="/tree?build="]` rows.
- Do not run `prettier` (no config; rewrites quotes). Do not run `npm install` (reverts patches; if you must, run `npx patch-package` after).
- Two `next dev` servers must never run from this directory at once (they share `.next`). Stop any server on port 3000 before `npx playwright test` (which starts its own on 3100).

## Review Focus

1. **Owner opening their own `unlisted` build** — must render (today it 404s). Covered: Task 1 test "owner opens their own owner-only build".
2. **A tab tap re-running the server page** (view count inflation, lost scroll) — Task 1 test asserts zero document/RSC requests across five tab taps.
3. **Tree export failing** (slow phone network, 544 KB gz) — Overview/Gear/Skills must still render; Stats and Tree show errors, not an endless "Calculating…". Task 1 test "tree export blocked".
4. **A checkpoint id in the URL that is not this build's** (stale link after delete) — falls back to the first checkpoint and the owner URL is rewritten to name it. Task 5 implements; Task 1 test "owner URL names its checkpoint" plus the deep-link test.
5. **Header wider than 375px** with a long build name, long ascendancy and eight resistances — truncation/wrapping, not overflow. Task 1 layout test runs on the imported build, whose name is `E2E-page-xxxxxxxx`; Task 4 header code truncates the name and wraps the stat strip.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `e2e/build-page.spec.ts` | Create | Slice 1 E2E (mobile) |
| `e2e/desktop-layout.spec.ts` | Modify | Desktop rail + no overflow on the build page |
| `e2e/sharing.spec.ts`, `e2e/checkpoints.spec.ts` | Modify | Follow the new page's selectors |
| `src/lib/build/buildPage.ts` | Create | Pure: tabs, main-first order, headline set, key items, query-string patching |
| `src/lib/build/buildPage.test.ts` | Create | Unit tests for the above |
| `src/components/build/StatsPanel.tsx` | Create | The stats body (set toggle, rows, not-counted, assumed), inline |
| `src/components/build/StatsSheet.tsx` | Modify | Becomes a portal wrapper around `StatsPanel` |
| `src/components/buildpage/useTreeExport.ts` | Create | One fetch of the tree export after paint |
| `src/components/buildpage/BuildPage.tsx` | Create | Client root: parse state, stats, tab routing, layout |
| `src/components/buildpage/BuildHeader.tsx` | Create | Identity, author, badge, tags, main skill, stats strip, actions, compact sticky bar |
| `src/components/buildpage/CheckpointSwitcher.tsx` | Create | Chip + menu of checkpoint links |
| `src/components/buildpage/BuildTabs.tsx` | Create | Tab strip, `pushState` |
| `src/components/buildpage/HeaderStats.tsx` | Create | Life/ES/Mana/res/Spirit strip with skeleton/error |
| `src/components/buildpage/StatsRail.tsx` | Create | Desktop right rail |
| `src/components/buildpage/tabs/OverviewTab.tsx` | Create | Main skill, key items, notes, tags |
| `src/components/buildpage/tabs/GearTab.tsx` | Create | `ReadOnlyGearList` + jewels |
| `src/components/buildpage/tabs/SkillsTab.tsx` | Create | Spirit line + `ReadOnlyGemList` (main first) |
| `src/components/buildpage/tabs/TreeTab.tsx` | Create | Read-only `PassiveTree` sized to the viewport |
| `src/components/buildpage/tabs/StatsTab.tsx` | Create | `StatsPanel` |
| `src/components/builds/ReadOnlyGemList.tsx` | Modify | Render main skill first |
| `src/app/(dashboard)/builds/[shareToken]/load.ts` | Create | Owner and reader loaders |
| `src/app/(dashboard)/builds/[shareToken]/page.tsx` | Modify | Owner → reader → 404; renders `BuildPage` |
| `src/components/builds/SharedBuildView.tsx`, `SharedTreePanel.tsx`, `SharedStatsPanel.tsx` | Delete | Replaced |

---

### Task 1: E2E spec for the build page (written first, fails)

**Files:**
- Create: `e2e/build-page.spec.ts`

**Interfaces (test ids the later tasks must render):**
`build-page` (root), `build-author`, `build-visibility`, `build-main-skill`, `header-stats`, `header-stat-life`, `checkpoint-switcher` (button), `checkpoint-option` (each menu link, with `data-checkpoint-id`), `overview-tab`, `gear-tab`, `skills-tab`, `tree-tab`, `stats-tab` (panel roots), `stats-panel` (inside Stats tab, holds `stat-life` etc.), `stats-rail` (desktop). Tabs are `role="tab"` buttons named Overview/Gear/Skills/Tree/Stats with `aria-selected`. Header: `h1` is the build name, and the `p` right after it reads `<Class/Asc> · Level <n> · <league>`.

- [ ] **Step 1: Write the spec**

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page, type Request } from '@playwright/test';
import { cleanupWithFreshPage, gotoBuilds, measureTapTargets, MIN_TAP_PX, testBuildName } from './helpers';

// Slice 1 of the build-profile redesign (specs/2026-09-27-build-profile-
// redesign-design.md): /builds/[shareToken] becomes one tabbed page for the
// owner and readers. Seeded with the 8-checkpoint PoB fixture pob-import.spec
// already proves (first checkpoint level 31, last level 94 with Life 2498).
const CODE = readFileSync(path.join(__dirname, '..', 'src', 'lib', 'pob', '__fixtures__', 'sample-pob2-code.txt'), 'utf8');
const TABS = ['Overview', 'Gear', 'Skills', 'Tree', 'Stats'] as const;

async function importFixture(page: Page, name: string): Promise<void> {
  await gotoBuilds(page);
  await page.getByTestId('open-import-sheet').click();
  const sheet = page.getByTestId('import-sheet');
  await sheet.getByTestId('import-input').fill(CODE);
  await sheet.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(sheet.getByTestId('import-preview')).toBeVisible({ timeout: 60_000 });
  await sheet.getByTestId('import-name').fill(name);
  await sheet.getByRole('button', { name: 'Import', exact: true }).click();
  await page.waitForURL(/\/tree\?build=/, { timeout: 60_000 });
}

/** Imports are owner-only (`unlisted`) and /builds hides the link then, so flip to Private, read it, flip back. */
async function readShareToken(page: Page, name: string): Promise<string> {
  await page.goto('/builds');
  const row = page.locator('ul > li').filter({ has: page.locator(`a:has-text("${name}")`) }).first();
  await expect(row).toBeVisible();
  await row.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Private' }).click();
  const link = row.locator('a[href^="/builds/"]');
  await expect(link).toBeVisible({ timeout: 30_000 });
  const href = (await link.getAttribute('href'))!;
  await row.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Unlisted' }).click();
  await expect(link).toBeHidden({ timeout: 30_000 });
  return href.replace('/builds/', '');
}

async function openTab(page: Page, tab: (typeof TABS)[number]): Promise<void> {
  await page.getByRole('tab', { name: tab, exact: true }).click();
  await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId(`${tab.toLowerCase()}-tab`)).toBeVisible();
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe('build page (read mode)', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(300_000);

  const name = testBuildName('page');
  let token = '';

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('owner opens their own owner-only build, and tabs switch without a server round trip', async ({ page }) => {
    await importFixture(page, name);
    token = await readShareToken(page, name);

    await page.goto(`/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    // Owner URL names its checkpoint, so reorders cannot move the page under the owner.
    await expect(page).toHaveURL(/[?&]checkpoint=[0-9a-f-]{36}/);
    await expect(page.getByTestId('build-author')).toHaveText('You');
    await expect(page.getByTestId('build-visibility')).toContainText('Unlisted');
    await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');

    const serverHits: string[] = [];
    const onRequest = (r: Request) => {
      if (r.resourceType() === 'document' || 'rsc' in r.headers() || r.url().includes('_rsc=')) serverHits.push(r.url());
    };
    page.on('request', onRequest);
    for (const tab of ['Gear', 'Skills', 'Stats', 'Overview', 'Gear'] as const) await openTab(page, tab);
    page.off('request', onRequest);
    expect(serverHits, 'a tab switch reached the server').toEqual([]);
    await expect(page).toHaveURL(/[?&]tab=gear/);

    // Back returns to the previous TAB, not the previous page.
    await page.goBack();
    await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(new RegExp(`/builds/${token}`));
  });

  test('a deep link lands on the named tab and checkpoint', async ({ page }) => {
    await page.goto(`/builds/${token}`);
    await page.getByTestId('checkpoint-switcher').click();
    const options = page.getByTestId('checkpoint-option');
    await expect(options).toHaveCount(8);
    const firstId = (await options.first().getAttribute('data-checkpoint-id'))!;
    const lastId = (await options.last().getAttribute('data-checkpoint-id'))!;
    expect(firstId).not.toBe(lastId);

    const levelLine = page.locator('h1').locator('xpath=following-sibling::p[1]');

    await page.goto(`/builds/${token}?tab=stats&checkpoint=${lastId}`);
    await expect(page.getByRole('tab', { name: 'Stats', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(levelLine).toContainText('Level 94');
    await expect(page.getByTestId('stats-panel').getByTestId('stat-life')).toHaveText('2498', { timeout: 60_000 });
    await expect(page.getByTestId('header-stat-life')).toContainText('2498');

    // The pair: a different stage of the same link shows different numbers.
    await page.goto(`/builds/${token}?tab=stats&checkpoint=${firstId}`);
    await expect(levelLine).toContainText('Level 31');
    const firstLife = page.getByTestId('stats-panel').getByTestId('stat-life');
    await expect(firstLife).toHaveText(/^\d+$/, { timeout: 60_000 });
    expect(await firstLife.textContent()).not.toBe('2498');

    // A checkpoint id that is not this build's falls back to the first, and the URL is rewritten.
    await page.goto(`/builds/${token}?checkpoint=00000000-0000-0000-0000-000000000000`);
    await expect(levelLine).toContainText('Level 31');
    await expect(page).toHaveURL(new RegExp(`checkpoint=${firstId}`));
  });

  test('the main skill is listed first on the Skills tab', async ({ page }) => {
    await page.goto(`/builds/${token}?tab=skills`);
    const main = (await page.getByTestId('build-main-skill').textContent())?.trim() ?? '';
    expect(main.length, 'the imported fixture has no main skill in the header').toBeGreaterThan(0);
    const first = page.getByTestId('skills-tab').locator('ul > li').first();
    await expect(first).toContainText('Main skill');
    await expect(first).toContainText(main);
  });

  test('without the tree export, the page still reads; stats and tree say why they are missing', async ({ page }) => {
    await page.route('**/data/tree/*/data.json', (route) => route.abort());
    await page.goto(`/builds/${token}`);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('header-stats')).toContainText('Stats unavailable', { timeout: 30_000 });
    await expect(page.getByTestId('overview-tab')).toContainText((await page.getByTestId('build-main-skill').textContent())!.trim());

    await openTab(page, 'Gear');
    await expect(page.getByTestId('gear-tab')).not.toContainText('No gear recorded.');
    await openTab(page, 'Stats');
    await expect(page.getByTestId('stats-panel').getByRole('alert')).toContainText('Could not load stat data');
    await openTab(page, 'Tree');
    await expect(page.getByTestId('tree-tab')).toContainText("Couldn't load the passive tree");
  });

  test('375px: no horizontal scroll on any tab, and every control is at least 44px', async ({ page }) => {
    await page.goto(`/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    for (const tab of TABS) {
      await openTab(page, tab);
      expect(await horizontalOverflow(page), `horizontal overflow on the ${tab} tab`).toBeLessThanOrEqual(0);
      if (tab === 'Tree') continue; // canvas; its own controls are PassiveTree's, measured by mobile-layout.spec
      const { scanned, tooSmall } = await measureTapTargets(page, '[data-testid="build-page"]');
      expect(scanned, `nothing measured on the ${tab} tab`).toBeGreaterThanOrEqual(TABS.length);
      expect(tooSmall, `controls under ${MIN_TAP_PX}px on the ${tab} tab`).toEqual([]);
    }
    await page.getByTestId('checkpoint-switcher').click();
    const { scanned, tooSmall } = await measureTapTargets(page, '[data-testid="checkpoint-menu"]');
    expect(scanned).toBe(8);
    expect(tooSmall, `checkpoint options under ${MIN_TAP_PX}px`).toEqual([]);
    expect(await horizontalOverflow(page), 'horizontal overflow with the checkpoint menu open').toBeLessThanOrEqual(0);
  });

  test('an unknown token is not found', async ({ page }) => {
    await page.goto('/builds/aaaaaaaaaaaaaaaaaaaaa');
    await expect(page.getByRole('heading', { name: 'Build not found' })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails for the right reason**

Stop any dev server on port 3000 first (see Global Constraints). Then:
Run: `npx playwright test e2e/build-page.spec.ts --project=mobile`
Expected: the first test FAILS at `getByTestId('build-page')` (the owner-only build 404s today: "Build not found"). Later tests fail or skip because `token` depends on the first. Any failure *before* that line (import, token read) is a harness problem: fix it before continuing.

- [ ] **Step 3: Commit**

```bash
git add e2e/build-page.spec.ts
git commit -m "test(e2e): build page read mode (fails until slice 1 lands)"
```

---

### Task 2: Pure helpers

**Files:**
- Create: `src/lib/build/buildPage.ts`
- Test: `src/lib/build/buildPage.test.ts`

**Interfaces — Produces:**
```ts
export const BUILD_TABS: readonly ['overview','gear','skills','tree','stats'];
export type BuildTab = (typeof BUILD_TABS)[number];
export const BUILD_TAB_LABELS: Record<BuildTab, string>;
export function parseTab(raw: string | null | undefined): BuildTab;
export function mainSkillLoadout(gems: GemState): GemLoadout | null;
export function loadoutsMainFirst(gems: GemState): GemLoadout[];
export function headlineSet(gems: GemState): WeaponSet; // 1 | 2
export function keyItems(gear: GearState, set: WeaponSet): GearItem[];
export function patchQuery(search: string, patch: Record<string, string | null>): string; // returns '' or '?a=b'
```

- [ ] **Step 1: Write the failing tests (the ways these can go wrong)**

```ts
import { describe, expect, it } from 'vitest';
import { emptyGearState } from './gearState';
import type { GearItem } from './gearSlots';
import type { GemLoadout, GemState } from './gemState';
import { headlineSet, keyItems, loadoutsMainFirst, mainSkillLoadout, parseTab, patchQuery } from './buildPage';

const item = (name: string, isUnique = false): GearItem => ({ slug: name.toLowerCase().replace(/\s+/g, '-'), name, isUnique }) as GearItem;
const loadout = (id: string, skill: string | null, sets: (1 | 2)[] = [1, 2]): GemLoadout =>
  ({ id, skill: skill ? item(skill) : null, supports: [], sets, level: 1, quality: 0 }) as GemLoadout;

describe('parseTab', () => {
  it('accepts the five tabs', () => {
    for (const t of ['overview', 'gear', 'skills', 'tree', 'stats']) expect(parseTab(t)).toBe(t);
  });
  it('falls back to overview for missing, unknown, and differently-cased values', () => {
    expect(parseTab(null)).toBe('overview');
    expect(parseTab(undefined)).toBe('overview');
    expect(parseTab('')).toBe('overview');
    expect(parseTab('Gear')).toBe('overview');
    expect(parseTab('notes')).toBe('overview');
    expect(parseTab('__proto__')).toBe('overview');
  });
});

describe('main skill ordering', () => {
  const a = loadout('a', 'Arc');
  const b = loadout('b', 'Lightning Arrow', [2]);
  const c = loadout('c', 'Pounce');
  it('puts the primary loadout first and keeps the rest in stored order', () => {
    const gems: GemState = { loadouts: [a, b, c], primaryId: 'b' };
    expect(loadoutsMainFirst(gems).map((l) => l.id)).toEqual(['b', 'a', 'c']);
  });
  it('leaves order alone when the primary id points at nothing (a removed loadout)', () => {
    const gems: GemState = { loadouts: [a, b, c], primaryId: 'gone' };
    expect(mainSkillLoadout(gems)).toBeNull();
    expect(loadoutsMainFirst(gems).map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });
  it('does not treat an empty-skill loadout as the main skill', () => {
    const empty = loadout('e', null);
    const gems: GemState = { loadouts: [a, empty], primaryId: 'e' };
    expect(mainSkillLoadout(gems)).toBeNull();
    expect(loadoutsMainFirst(gems).map((l) => l.id)).toEqual(['a', 'e']);
  });
  it('never duplicates or drops a loadout', () => {
    const gems: GemState = { loadouts: [a, b, c], primaryId: 'c' };
    expect(loadoutsMainFirst(gems)).toHaveLength(3);
  });
});

describe('headlineSet', () => {
  it('uses the set the main skill is tagged for', () => {
    expect(headlineSet({ loadouts: [loadout('b', 'LA', [2])], primaryId: 'b' })).toBe(2);
  });
  it('uses Set I when the main skill is in both sets, or there is none', () => {
    expect(headlineSet({ loadouts: [loadout('b', 'LA', [1, 2])], primaryId: 'b' })).toBe(1);
    expect(headlineSet({ loadouts: [], primaryId: null })).toBe(1);
    expect(headlineSet({ loadouts: [loadout('b', 'LA', [])], primaryId: 'b' })).toBe(1);
  });
});

describe('keyItems', () => {
  it('is empty for no gear', () => {
    expect(keyItems(emptyGearState(), 1)).toEqual([]);
  });
  it("takes the headline set's weapons, not the other set's, plus every unique", () => {
    const gear = {
      ...emptyGearState(),
      weapon1_main: item('Nettle Talisman'),
      weapon2_main: item('Obliterator Bow'),
      weapon2_off: item("Cadiro's Gambit", true),
      belt: item('Headhunter', true),
      head: item('Grinning Mask'),
    };
    expect(keyItems(gear, 2).map((i) => i.name)).toEqual(['Obliterator Bow', "Cadiro's Gambit", 'Headhunter']);
    expect(keyItems(gear, 1).map((i) => i.name)).toEqual(['Nettle Talisman', 'Headhunter']);
  });
  it('includes unique jewels once', () => {
    const well = item('Heart of the Well', true);
    const gear = { ...emptyGearState(), jewels: { '100': well, '200': item('Emerald') } };
    expect(keyItems(gear, 1).map((i) => i.name)).toEqual(['Heart of the Well']);
  });
});

describe('patchQuery', () => {
  it('sets, replaces and removes keys while keeping the others', () => {
    expect(patchQuery('?checkpoint=abc&tab=gear', { tab: 'stats' })).toBe('?checkpoint=abc&tab=stats');
    expect(patchQuery('?checkpoint=abc&tab=gear', { tab: null })).toBe('?checkpoint=abc');
    expect(patchQuery('', { tab: 'gear' })).toBe('?tab=gear');
  });
  it('returns an empty string when nothing is left', () => {
    expect(patchQuery('?tab=gear', { tab: null })).toBe('');
  });
  it('encodes values', () => {
    expect(patchQuery('', { tab: 'a b&c' })).toBe('?tab=a+b%26c');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/build/buildPage.test.ts`
Expected: FAIL, "Failed to resolve import ./buildPage".

- [ ] **Step 3: Implement**

```ts
// Pure helpers for the build page (/builds/[shareToken]). No React, no fetch.
// Spec: docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md §4-§5.
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import { GEAR_SLOTS, type GearItem, type GearSlot } from './gearSlots';
import type { GearState } from './gearState';
import type { GemLoadout, GemState } from './gemState';

export const BUILD_TABS = ['overview', 'gear', 'skills', 'tree', 'stats'] as const;
export type BuildTab = (typeof BUILD_TABS)[number];

export const BUILD_TAB_LABELS: Record<BuildTab, string> = {
  overview: 'Overview',
  gear: 'Gear',
  skills: 'Skills',
  tree: 'Tree',
  stats: 'Stats',
};

/** `?tab=` → a tab. Anything unknown (including other casings) is Overview, the default. */
export function parseTab(raw: string | null | undefined): BuildTab {
  return (BUILD_TABS as readonly string[]).includes(raw ?? '') ? (raw as BuildTab) : 'overview';
}

/** The loadout flagged Main, if it still exists and holds a skill. */
export function mainSkillLoadout(gems: GemState): GemLoadout | null {
  return gems.loadouts.find((l) => l.id === gems.primaryId && l.skill !== null) ?? null;
}

/** Main skill first, everything else in stored order. */
export function loadoutsMainFirst(gems: GemState): GemLoadout[] {
  const main = mainSkillLoadout(gems);
  return main ? [main, ...gems.loadouts.filter((l) => l !== main)] : gems.loadouts;
}

/** The weapon set the header's stats describe: the main skill's first tagged set, else Set I. */
export function headlineSet(gems: GemState): WeaponSet {
  return mainSkillLoadout(gems)?.sets[0] ?? 1;
}

const OTHER_SET_WEAPONS: Record<WeaponSet, readonly GearSlot[]> = {
  1: ['weapon2_main', 'weapon2_off'],
  2: ['weapon1_main', 'weapon1_off'],
};
const SET_WEAPONS: Record<WeaponSet, readonly GearSlot[]> = {
  1: ['weapon1_main', 'weapon1_off'],
  2: ['weapon2_main', 'weapon2_off'],
};

/** What Overview shows as "key items": this set's weapons, then every unique (gear, then jewels), each once. */
export function keyItems(gear: GearState, set: WeaponSet): GearItem[] {
  const out: GearItem[] = [];
  const add = (i: GearItem | null) => {
    if (i && !out.includes(i)) out.push(i);
  };
  for (const slot of SET_WEAPONS[set]) add(gear[slot]);
  for (const slot of GEAR_SLOTS) {
    if (OTHER_SET_WEAPONS[set].includes(slot)) continue;
    const i = gear[slot];
    if (i?.isUnique) add(i);
  }
  for (const i of Object.values(gear.jewels)) if (i.isUnique) add(i);
  return out;
}

/** `search` with `patch` applied (null deletes). Returns '' or a string starting with '?'. */
export function patchQuery(search: string, patch: Record<string, string | null>): string {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/build/buildPage.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Type-check and commit**

Run: `npm run type-check` → clean.
```bash
git add src/lib/build/buildPage.ts src/lib/build/buildPage.test.ts
git commit -m "feat(build-page): pure helpers for tabs, main-first order, key items"
```

---

### Task 3: Extract `StatsPanel` from `StatsSheet`

**Files:**
- Create: `src/components/build/StatsPanel.tsx`
- Modify: `src/components/build/StatsSheet.tsx` (whole file)

**Interfaces — Produces:**
```ts
export default function StatsPanel(props: {
  sheets: { 1: SetResult; 2: SetResult } | { error: string } | null;
  reserved: ReservedSpiritResult | null;
  initialSet?: WeaponSet; // default 1
}): JSX.Element; // root has data-testid="stats-panel"
```
`StatsSheet`'s props and behaviour do not change; its test ids (`stats-sheet`, `stat-*`, `stat-act`, `stat-spirit-over`, `stat-not-counted`, `stat-assumed`, "Close stats sheet") are all kept. `stats.spec.ts`, `pob-import.spec.ts` and the editor keep working untouched.

- [ ] **Step 1: Create `StatsPanel.tsx`** — the body of today's `StatsSheet`, with the set toggle, inline (no portal):

```tsx
'use client';

// The defence sheet's content — set toggle, the 13 rows, and what the numbers
// do not count or assume. Inline, so the build page's Stats tab and the
// editor's StatsSheet (a portal around this) show the same thing.
import { useState } from 'react';
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import type { Resistance } from '@/lib/build/stats/engine';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';
import type { SetResult } from '@/components/build/useDefenceSheets';

function resistanceText(r: Resistance): string {
  return r.uncapped === r.value ? `${r.value}% (max ${r.max}%)` : `${r.value}% (max ${r.max}%, ${r.uncapped}% before the cap)`;
}

export default function StatsPanel({
  sheets,
  reserved,
  initialSet = 1,
}: {
  sheets: { 1: SetResult; 2: SetResult } | { error: string } | null;
  reserved: ReservedSpiritResult | null;
  initialSet?: WeaponSet;
}) {
  const [set, setSet] = useState<WeaponSet>(initialSet);

  const body = (() => {
    if (sheets === null) return <p className="p-3 text-sm text-muted-foreground">Calculating…</p>;
    if ('error' in sheets) return <p className="p-3 text-sm text-destructive" role="alert">Could not load stat data: {sheets.error}</p>;
    const { sheet, collected } = sheets[set];
    const reservedHere = reserved ? reserved.total[set === 1 ? 'set1' : 'set2'] : null;
    const rows: [string, string, string][] = [
      ['Life', String(sheet.life), 'stat-life'],
      ['Mana', String(sheet.mana), 'stat-mana'],
      ['Energy Shield', String(sheet.energyShield), 'stat-energy-shield'],
      ['Armour', String(sheet.armour), 'stat-armour'],
      ['Evasion', String(sheet.evasion), 'stat-evasion'],
      ['Strength', String(sheet.str), 'stat-str'],
      ['Dexterity', String(sheet.dex), 'stat-dex'],
      ['Intelligence', String(sheet.int), 'stat-int'],
      ['Fire Resistance', resistanceText(sheet.fire), 'stat-fire'],
      ['Cold Resistance', resistanceText(sheet.cold), 'stat-cold'],
      ['Lightning Resistance', resistanceText(sheet.lightning), 'stat-lightning'],
      ['Chaos Resistance', resistanceText(sheet.chaos), 'stat-chaos'],
      ['Spirit', reservedHere === null ? String(sheet.spirit) : `${sheet.spirit} (${reservedHere} reserved)`, 'stat-spirit'],
    ];
    return (
      <>
        <p className="px-3 pt-3 text-xs text-muted-foreground" data-testid="stat-act">
          Assumed campaign progress: {collected.act} (from the checkpoint&apos;s level)
        </p>
        {reservedHere !== null && reservedHere > sheet.spirit ? (
          <p className="px-3 pt-2 text-sm text-destructive" data-testid="stat-spirit-over" role="alert">
            ⚠ Gems reserve {reservedHere} Spirit, but this set has {sheet.spirit}.
          </p>
        ) : null}
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-3 py-3 text-sm">
          {rows.map(([label, value, id]) => (
            <div key={id} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd data-testid={id} className="text-right text-foreground tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {collected.notCounted.length > 0 ? (
          <section className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <h3 className="mb-1 text-foreground">Not counted</h3>
            <ul data-testid="stat-not-counted">
              {collected.notCounted.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {collected.assumed.length > 0 ? (
          <section className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <h3 className="mb-1 text-foreground">Assumed</h3>
            <ul data-testid="stat-assumed">
              {collected.assumed.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </>
    );
  })();

  return (
    <div data-testid="stats-panel">
      <div className="flex gap-1.5 border-b border-border px-3 py-3">
        {([1, 2] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === set}
            onClick={() => setSet(s)}
            className={`flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-xs font-medium ${s === set ? 'bg-primary text-primary-foreground' : 'bg-background/60 text-muted-foreground'}`}
          >
            Set {s === 1 ? 'I' : 'II'}
          </button>
        ))}
      </div>
      {body}
    </div>
  );
}
```

- [ ] **Step 2: Replace `StatsSheet.tsx`** with the portal wrapper:

```tsx
'use client';

// The editor's defence sheet: a full-screen portal around StatsPanel.
// Portaled to document.body at z-40 for the stacking-context reason
// GearSheet.tsx's header gives.
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import StatsPanel from '@/components/build/StatsPanel';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';
import type { SetResult } from '@/components/build/useDefenceSheets';

export default function StatsSheet({
  open,
  sheets,
  reserved,
  onClose,
}: {
  open: boolean;
  sheets: { 1: SetResult; 2: SetResult } | { error: string } | null;
  reserved: ReservedSpiritResult | null;
  onClose: () => void;
}) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-background" data-testid="stats-sheet">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <span className="font-heading text-sm text-foreground">Stats</span>
        <button type="button" onClick={onClose} aria-label="Close stats sheet" className="flex h-11 w-11 items-center justify-center text-muted-foreground">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <StatsPanel sheets={sheets} reserved={reserved} />
      </div>
    </div>,
    document.body,
  );
}
```

Note: the set toggle now scrolls with the content instead of staying fixed above it. Accepted: the sheet is retired from the build page, and the editor's version goes in slice 2.

- [ ] **Step 3: Verify nothing regressed**

Run: `npm run type-check && npm run lint` → clean.
Run (port 3000 free): `npx playwright test e2e/stats.spec.ts --project=mobile`
Expected: PASS (it drives the editor's Stats sheet through the same test ids).

- [ ] **Step 4: Commit**

```bash
git add src/components/build/StatsPanel.tsx src/components/build/StatsSheet.tsx
git commit -m "refactor(stats): extract StatsPanel so the build page can show stats inline"
```

---

### Task 4: Build page client components

**Files:** create everything under `src/components/buildpage/`; modify `src/components/builds/ReadOnlyGemList.tsx`.

**Interfaces:**
- Consumes: Task 2 (`BUILD_TABS`, `BUILD_TAB_LABELS`, `parseTab`, `mainSkillLoadout`, `loadoutsMainFirst`, `headlineSet`, `keyItems`, `patchQuery`), Task 3 (`StatsPanel`).
- Produces (Task 5 renders this):
```ts
export interface BuildPageProps {
  mode: 'owner' | 'reader';
  row: SharedBuildRow;              // already substituted with the active checkpoint's state and level
  authorName: string;               // 'You' for the owner
  tags: string[] | null;            // null = not visible to this viewer; omit the section
  shareToken: string;
  checkpoints: { id: string; name: string; level: number }[];
  activeCheckpointId: string | undefined;
}
export default function BuildPage(props: BuildPageProps): JSX.Element;
```

- [ ] **Step 1: `useTreeExport.ts`**

```ts
'use client';

// The 5.1 MB passive-tree export (544 KB gzipped), fetched once per mount.
// useEffect runs after the first paint, so the page's text is on screen
// before this starts. BuildPage is keyed by checkpoint, so a checkpoint
// switch refetches; the browser's HTTP cache serves that repeat.
import { useEffect, useState } from 'react';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { TREE_VERSION } from '@/lib/tree/version';

export function useTreeExport(): { tree: GggTreeJson | null; error: string | null } {
  const [tree, setTree] = useState<GggTreeJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/data/tree/${TREE_VERSION}/data.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<GggTreeJson>;
      })
      .then((json) => {
        if (!cancelled) setTree(json);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { tree, error };
}
```


- [ ] **Step 2: `ReadOnlyGemList.tsx`**: render main first. Change the import line and the map in the default export:

```tsx
import { loadoutsMainFirst } from '@/lib/build/buildPage';
```
```tsx
      {loadoutsMainFirst(gemState).map((loadout, i) => (
        <LoadoutCard key={loadout.id} loadout={loadout} index={i} isPrimary={loadout.id === gemState.primaryId} />
      ))}
```

- [ ] **Step 3: `BuildTabs.tsx`**

```tsx
'use client';

// The tab strip. Tabs are client-only: pushState updates ?tab= without a
// server request (Next syncs it into useSearchParams), so Back returns to the
// previous tab and a tap never re-runs the server page — which would re-count
// a view on public builds. Never swap this for <Link> or router.push.
import { BUILD_TABS, BUILD_TAB_LABELS, patchQuery, type BuildTab } from '@/lib/build/buildPage';

export default function BuildTabs({ active }: { active: BuildTab }) {
  function select(tab: BuildTab) {
    if (tab === active) return;
    const query = patchQuery(window.location.search, { tab: tab === 'overview' ? null : tab });
    window.history.pushState(null, '', `${window.location.pathname}${query}`);
  }
  return (
    <div role="tablist" aria-label="Build sections" className="grid grid-cols-5 border-b border-border">
      {BUILD_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={tab === active}
          aria-controls={`${tab}-tab`}
          onClick={() => select(tab)}
          className={`flex h-11 min-w-11 items-center justify-center border-b-2 text-sm font-medium ${
            tab === active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
          }`}
        >
          {BUILD_TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: `CheckpointSwitcher.tsx`**

```tsx
'use client';

// The checkpoint chip: "Lvl 94 · Endgame ▾". Choosing one is a server
// navigation (<Link>), so the page re-reads that checkpoint's rows and
// BuildPage remounts (it is keyed by checkpoint). The current tab is kept.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { patchQuery } from '@/lib/build/buildPage';

export default function CheckpointSwitcher({
  shareToken,
  checkpoints,
  activeCheckpointId,
  fallbackLevel,
}: {
  shareToken: string;
  checkpoints: { id: string; name: string; level: number }[];
  activeCheckpointId: string | undefined;
  /** Shown when checkpoints failed to load. */
  fallbackLevel: number;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const active = checkpoints.find((c) => c.id === activeCheckpointId) ?? checkpoints[0];
  const label = active ? `Lvl ${active.level} · ${active.name}` : `Lvl ${fallbackLevel}`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        data-testid="checkpoint-switcher"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 min-w-11 max-w-full items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 text-sm font-medium text-foreground"
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div
          role="menu"
          data-testid="checkpoint-menu"
          className="absolute left-0 top-12 z-30 flex max-h-[60dvh] w-[min(18rem,calc(100vw-2rem))] flex-col overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {checkpoints.map((c) => (
            <Link
              key={c.id}
              role="menuitem"
              data-testid="checkpoint-option"
              data-checkpoint-id={c.id}
              aria-current={c.id === active?.id ? 'true' : undefined}
              href={`/builds/${shareToken}${patchQuery(searchParams.toString(), { checkpoint: c.id })}`}
              onClick={() => setOpen(false)}
              className={`flex h-11 min-w-11 items-center justify-between gap-3 rounded-md px-3 text-sm ${
                c.id === active?.id ? 'bg-accent text-foreground' : 'text-muted-foreground'
              }`}
            >
              <span className="truncate">{c.name}</span>
              <span className="shrink-0 tabular-nums">Lvl {c.level}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: `HeaderStats.tsx` and `StatsRail.tsx`**

```tsx
'use client';

// At-a-glance stats for the header: Life, ES, Mana, the four resistances and
// Spirit, for one weapon set. A skeleton until the tree export and stat data
// arrive; "Stats unavailable" if either failed.
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import type { SetResult } from '@/components/build/useDefenceSheets';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';

export type Sheets = { 1: SetResult; 2: SetResult } | { error: string } | null;

export function statLine(sheets: Sheets, set: WeaponSet, reserved: ReservedSpiritResult | null) {
  if (sheets === null || 'error' in sheets) return null;
  const s = sheets[set].sheet;
  const r = reserved ? reserved.total[set === 1 ? 'set1' : 'set2'] : null;
  return {
    life: s.life,
    es: s.energyShield,
    mana: s.mana,
    res: `${s.fire.value}/${s.cold.value}/${s.lightning.value}/${s.chaos.value}`,
    spirit: r === null ? String(s.spirit) : `${r}/${s.spirit}`,
  };
}

export default function HeaderStats({ sheets, set, reserved }: { sheets: Sheets; set: WeaponSet; reserved: ReservedSpiritResult | null }) {
  if (sheets !== null && 'error' in sheets) {
    return (
      <p data-testid="header-stats" className="text-xs text-muted-foreground">
        Stats unavailable
      </p>
    );
  }
  const line = statLine(sheets, set, reserved);
  if (!line) {
    return (
      <div data-testid="header-stats" aria-busy="true" className="flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-4 w-16 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }
  const items: [string, string, string][] = [
    ['Life', String(line.life), 'header-stat-life'],
    ['ES', String(line.es), 'header-stat-es'],
    ['Mana', String(line.mana), 'header-stat-mana'],
    ['Res', line.res, 'header-stat-res'],
    ['Spirit', line.spirit, 'header-stat-spirit'],
  ];
  return (
    <dl data-testid="header-stats" className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {items.map(([label, value, id]) => (
        <div key={id} className="flex gap-1">
          <dt className="text-muted-foreground">{label}</dt>
          <dd data-testid={id} className="tabular-nums text-foreground">
            {value}
          </dd>
        </div>
      ))}
      <div className="text-muted-foreground">· Set {set === 1 ? 'I' : 'II'}</div>
    </dl>
  );
}
```

```tsx
'use client';

// Desktop-only right rail (md:+): the headline set's defences, visible on
// every tab except Tree.
import type { ReactNode } from 'react';
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';
import type { Sheets } from './HeaderStats';

export default function StatsRail({ sheets, set, reserved }: { sheets: Sheets; set: WeaponSet; reserved: ReservedSpiritResult | null }) {
  let body: ReactNode;
  if (sheets === null) body = <p className="text-muted-foreground">Calculating…</p>;
  else if ('error' in sheets) body = <p className="text-muted-foreground">Stats unavailable</p>;
  else {
    const s = sheets[set].sheet;
    const r = reserved ? reserved.total[set === 1 ? 'set1' : 'set2'] : null;
    const rows: [string, string][] = [
      ['Life', String(s.life)],
      ['Energy Shield', String(s.energyShield)],
      ['Mana', String(s.mana)],
      ['Armour', String(s.armour)],
      ['Evasion', String(s.evasion)],
      ['Fire', `${s.fire.value}%`],
      ['Cold', `${s.cold.value}%`],
      ['Lightning', `${s.lightning.value}%`],
      ['Chaos', `${s.chaos.value}%`],
      ['Spirit', r === null ? String(s.spirit) : `${r} / ${s.spirit}`],
    ];
    body = (
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="text-right tabular-nums text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <aside data-testid="stats-rail" className="hidden self-start rounded-lg border border-border bg-card/40 p-3 text-sm md:sticky md:top-4 md:block">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stats · Set {set === 1 ? 'I' : 'II'}</h2>
      {body}
    </aside>
  );
}
```

- [ ] **Step 6: `BuildHeader.tsx`**

```tsx
'use client';

// The build's profile header. Full block at the top of the page; once it has
// scrolled out of view, a one-line sticky bar (name, checkpoint, action)
// takes its place above the tab strip — see BuildPage.
import { useState } from 'react';
import Link from 'next/link';
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import type { GemLoadout } from '@/lib/build/gemState';
import type { SharedBuildRow, BuildVisibility } from '@/lib/build/types';
import { VISIBILITY_HINT, VISIBILITY_LABEL, isBuildVisibility } from '@/lib/build/visibility';
import { ascendancyLabel } from '@/lib/tree/ascendancyNames';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';
import CheckpointSwitcher from './CheckpointSwitcher';
import HeaderStats, { type Sheets } from './HeaderStats';

export interface HeaderProps {
  mode: 'owner' | 'reader';
  row: SharedBuildRow;
  authorName: string;
  tags: string[] | null;
  shareToken: string;
  checkpoints: { id: string; name: string; level: number }[];
  activeCheckpointId: string | undefined;
  mainSkill: GemLoadout | null;
  sheets: Sheets;
  set: WeaponSet;
  reserved: ReservedSpiritResult | null;
}

function editHref(row: SharedBuildRow, checkpointId: string | undefined): string {
  return checkpointId ? `/tree?build=${row.id}&checkpoint=${checkpointId}` : `/tree?build=${row.id}`;
}

export function HeaderActions({ mode, row, shareToken, activeCheckpointId }: Pick<HeaderProps, 'mode' | 'row' | 'shareToken' | 'activeCheckpointId'>) {
  const [copied, setCopied] = useState(false);
  const linkLive = row.visibility !== 'unlisted';
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/builds/${shareToken}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="flex shrink-0 items-center gap-2">
      {linkLive ? (
        <button type="button" onClick={copy} className="flex h-11 min-w-11 items-center rounded-lg border border-border px-3 text-sm text-foreground">
          {copied ? 'Copied' : 'Copy link'}
        </button>
      ) : null}
      {mode === 'owner' ? (
        <Link href={editHref(row, activeCheckpointId)} className="flex h-11 min-w-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
          Edit
        </Link>
      ) : null}
    </div>
  );
}

export default function BuildHeader(props: HeaderProps) {
  const { mode, row, authorName, tags, shareToken, checkpoints, activeCheckpointId, mainSkill, sheets, set, reserved } = props;
  const visibility: BuildVisibility | null = isBuildVisibility(row.visibility) ? row.visibility : null;
  return (
    <header className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-heading text-xl font-bold text-foreground">{row.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {ascendancyLabel(row.class, row.ascendancy)} · Level {row.level} · {row.league}
          </p>
        </div>
        <HeaderActions mode={mode} row={row} shareToken={shareToken} activeCheckpointId={activeCheckpointId} />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          by <span data-testid="build-author" className="text-foreground">{authorName}</span>
        </span>
        {mode === 'owner' && visibility ? (
          <span data-testid="build-visibility" className="rounded-full border border-border px-2 py-0.5">
            {VISIBILITY_LABEL[visibility]} · {VISIBILITY_HINT[visibility]}
          </span>
        ) : null}
        {mode === 'reader' && row.visibility === 'public' ? <span>{row.view_count.toLocaleString()} views</span> : null}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <CheckpointSwitcher shareToken={shareToken} checkpoints={checkpoints} activeCheckpointId={activeCheckpointId} fallbackLevel={row.level} />
        {mainSkill?.skill ? (
          <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
            <span className="h-7 w-7 shrink-0 overflow-hidden rounded border border-border bg-card/60">
              {mainSkill.skill.iconUrl ? (
                // Plain <img>: /data/wiki/ is auth-gated, which next/image's optimizer cannot follow.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mainSkill.skill.iconUrl} alt="" className="h-full w-full object-contain" />
              ) : null}
            </span>
            <span data-testid="build-main-skill" className="truncate">
              {mainSkill.skill.name}
            </span>
          </span>
        ) : null}
      </div>

      <HeaderStats sheets={sheets} set={set} reserved={reserved} />

      {tags !== null && tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </header>
  );
}
```

`BuildVisibility` is exported from `@/lib/build/types` (verified).

- [ ] **Step 7: Tab bodies** (`src/components/buildpage/tabs/`)

`OverviewTab.tsx`:
```tsx
// Overview: what a reader needs in one screen — main skill group, key items, notes.
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import { keyItems } from '@/lib/build/buildPage';
import type { GearState } from '@/lib/build/gearState';
import type { GemLoadout } from '@/lib/build/gemState';

function Icon({ src, size = 'h-9 w-9' }: { src: string | null; size?: string }) {
  return (
    <span className={`${size} shrink-0 overflow-hidden rounded-md border border-border bg-card/60`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-contain" />
      ) : null}
    </span>
  );
}

export default function OverviewTab({ mainSkill, gear, set, notes }: { mainSkill: GemLoadout | null; gear: GearState; set: WeaponSet; notes: string | null }) {
  const items = keyItems(gear, set);
  return (
    <div id="overview-tab" role="tabpanel" data-testid="overview-tab" className="flex flex-col gap-4">
      <section className="rounded-lg border border-border bg-card/40 p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Main skill</h2>
        {mainSkill?.skill ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Icon src={mainSkill.skill.iconUrl} size="h-11 w-11" />
              <div className="min-w-0">
                <p className="truncate text-base font-medium text-foreground">{mainSkill.skill.name}</p>
                <p className="text-xs text-muted-foreground">
                  Level {mainSkill.level}
                  {mainSkill.quality > 0 ? ` · ${mainSkill.quality}% quality` : ''}
                </p>
              </div>
            </div>
            {mainSkill.supports.length > 0 ? (
              <ul className="flex flex-col gap-1.5 pl-14">
                {mainSkill.supports.map((s, i) => (
                  <li key={`${s.slug}-${i}`} className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                    <Icon src={s.iconUrl} size="h-6 w-6" />
                    <span className="truncate">{s.name}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No main skill set.</p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card/40 p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key items</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No key items yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.map((item, i) => (
              <li key={`${item.slug}-${i}`} className="flex min-w-0 items-center gap-3">
                <Icon src={item.iconUrl} />
                <span className="truncate text-sm text-foreground">
                  {item.name}
                  {item.isUnique ? (
                    <span className="ml-1.5 text-xs font-medium" style={{ color: 'var(--wiki-unique)' }}>
                      Unique
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card/40 p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</h2>
        {notes ? (
          <p className="whitespace-pre-line break-words text-sm text-foreground">{notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        )}
      </section>
    </div>
  );
}
```

`GearTab.tsx` (moves the jewels list out of `SharedBuildView`):
```tsx
import ReadOnlyGearList from '@/components/builds/ReadOnlyGearList';
import type { GearState } from '@/lib/build/gearState';

export default function GearTab({ gear }: { gear: GearState }) {
  const jewels = Object.values(gear.jewels);
  return (
    <div id="gear-tab" role="tabpanel" data-testid="gear-tab" className="flex flex-col gap-4">
      <ReadOnlyGearList gear={gear} />
      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Jewels</h2>
        {jewels.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No jewels recorded.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card/40">
            {jewels.map((item, i) => (
              <li key={`${item.slug}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card/60">
                  {item.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.iconUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </span>
                <span className="min-w-0 truncate text-sm text-foreground">
                  {item.name}
                  {item.isUnique ? (
                    <span className="ml-1.5 text-xs font-medium" style={{ color: 'var(--wiki-unique)' }}>
                      Unique
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

`SkillsTab.tsx`:
```tsx
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import ReadOnlyGemList from '@/components/builds/ReadOnlyGemList';
import type { GemState } from '@/lib/build/gemState';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';
import type { Sheets } from '../HeaderStats';

export default function SkillsTab({ gemState, reserved, sheets, set }: { gemState: GemState; reserved: ReservedSpiritResult | null; sheets: Sheets; set: WeaponSet }) {
  const reservedHere = reserved ? reserved.total[set === 1 ? 'set1' : 'set2'] : null;
  const spirit = sheets && !('error' in sheets) ? sheets[set].sheet.spirit : null;
  return (
    <div id="skills-tab" role="tabpanel" data-testid="skills-tab" className="flex flex-col gap-3">
      {reservedHere !== null ? (
        <p className="text-sm text-muted-foreground">
          Spirit reserved (Set {set === 1 ? 'I' : 'II'}): <span className="tabular-nums text-foreground">{reservedHere}</span>
          {spirit !== null ? <span className="tabular-nums"> / {spirit}</span> : null}
        </p>
      ) : null}
      <ReadOnlyGemList gemState={gemState} />
    </div>
  );
}
```

`TreeTab.tsx`:
```tsx
'use client';

// Read-only passive tree, sized to the space under the header and tabs.
import dynamic from 'next/dynamic';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { fromPassiveState } from '@/lib/build/passiveState';
import type { PassiveState } from '@/lib/build/types';

// Module scope, same reasoning as TreeEditor.tsx: pixi/WebGL is heavy and browser-only.
const PassiveTree = dynamic(() => import('@/components/tree/PassiveTree'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading passive tree…</div>,
});

export default function TreeTab({
  tree,
  error,
  className,
  ascendancyId,
  passiveState,
  level,
}: {
  tree: GggTreeJson | null;
  error: string | null;
  className: string;
  ascendancyId: string | null;
  passiveState: PassiveState;
  level: number;
}) {
  return (
    <div
      id="tree-tab"
      role="tabpanel"
      data-testid="tree-tab"
      className="relative h-[calc(100dvh-17rem)] min-h-[22rem] w-full touch-none select-none overflow-hidden rounded-lg border border-border md:h-[calc(100dvh-13rem)]"
    >
      {error ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">Couldn&apos;t load the passive tree ({error}).</div>
      ) : !tree ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading passive tree…</div>
      ) : (
        <PassiveTree
          raw={tree}
          initialState={{ className, ascendancyId: ascendancyId ?? undefined, ...fromPassiveState(passiveState) }}
          readOnly
          level={level}
        />
      )}
    </div>
  );
}
```

`StatsTab.tsx`:
```tsx
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import StatsPanel from '@/components/build/StatsPanel';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';
import type { Sheets } from '../HeaderStats';

export default function StatsTab({ sheets, reserved, set }: { sheets: Sheets; reserved: ReservedSpiritResult | null; set: WeaponSet }) {
  return (
    <div id="stats-tab" role="tabpanel" data-testid="stats-tab" className="rounded-lg border border-border bg-card/40">
      <StatsPanel sheets={sheets} reserved={reserved} initialSet={set} />
    </div>
  );
}
```

- [ ] **Step 8: `BuildPage.tsx`**

```tsx
'use client';

// /builds/[shareToken] — the build's page, for its owner and for readers.
// Spec: docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md.
//
// Keyed by checkpoint in the server page, so every hook below belongs to one
// checkpoint for its whole life. The tab lives only in the URL (?tab=, set by
// BuildTabs with pushState), so switching tabs re-renders this component and
// never reaches the server.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseGearState } from '@/lib/build/gearState';
import { parseGemState } from '@/lib/build/gemState';
import { parsePassiveState } from '@/lib/build/passiveState';
import { headlineSet, mainSkillLoadout, parseTab } from '@/lib/build/buildPage';
import type { SharedBuildRow } from '@/lib/build/types';
import { useDefenceSheets } from '@/components/build/useDefenceSheets';
import { useReservedSpirit } from '@/components/build/useReservedSpirit';
import { useTreeExport } from './useTreeExport';
import BuildHeader, { HeaderActions } from './BuildHeader';
import BuildTabs from './BuildTabs';
import CheckpointSwitcher from './CheckpointSwitcher';
import StatsRail from './StatsRail';
import OverviewTab from './tabs/OverviewTab';
import GearTab from './tabs/GearTab';
import SkillsTab from './tabs/SkillsTab';
import TreeTab from './tabs/TreeTab';
import StatsTab from './tabs/StatsTab';
import type { Sheets } from './HeaderStats';

export interface BuildPageProps {
  mode: 'owner' | 'reader';
  row: SharedBuildRow;
  authorName: string;
  tags: string[] | null;
  shareToken: string;
  checkpoints: { id: string; name: string; level: number }[];
  activeCheckpointId: string | undefined;
}

export default function BuildPage(props: BuildPageProps) {
  const { mode, row, shareToken, checkpoints, activeCheckpointId } = props;
  const tab = parseTab(useSearchParams().get('tab'));

  const gear = parseGearState(row.gear_state);
  const gemState = parseGemState(row.gem_state);
  const passiveState = parsePassiveState(row.passive_state);
  const mainSkill = mainSkillLoadout(gemState);
  const set = headlineSet(gemState);

  const { tree, error: treeError } = useTreeExport();
  const defence = useDefenceSheets({ tree, className: row.class, level: row.level, passive: passiveState, gear });
  // useDefenceSheets waits forever for a tree that will never come; surface the fetch error instead.
  const sheets: Sheets = treeError ? { error: treeError } : defence;
  const reserved = useReservedSpirit(gemState);

  // The compact sticky bar appears once the full header has scrolled away.
  const headerRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), { rootMargin: '-80px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div data-testid="build-page" className="flex min-w-0 flex-col gap-3">
      <div ref={headerRef}>
        <BuildHeader {...props} mainSkill={mainSkill} sheets={sheets} set={set} reserved={reserved} />
      </div>

      <div className="sticky top-20 z-20 bg-background/95 backdrop-blur md:top-0">
        {compact ? (
          <div className="flex min-w-0 items-center justify-between gap-2 py-1">
            <span className="min-w-0 truncate font-heading text-sm font-semibold text-foreground">{row.name}</span>
            <div className="flex shrink-0 items-center gap-2">
              <CheckpointSwitcher shareToken={shareToken} checkpoints={checkpoints} activeCheckpointId={activeCheckpointId} fallbackLevel={row.level} />
              <HeaderActions mode={mode} row={row} shareToken={shareToken} activeCheckpointId={activeCheckpointId} />
            </div>
          </div>
        ) : null}
        <BuildTabs active={tab} />
      </div>

      <div className={tab === 'tree' ? '' : 'md:grid md:grid-cols-[minmax(0,1fr)_16rem] md:gap-6'}>
        <div className="min-w-0">
          {tab === 'overview' ? <OverviewTab mainSkill={mainSkill} gear={gear} set={set} notes={row.notes} /> : null}
          {tab === 'gear' ? <GearTab gear={gear} /> : null}
          {tab === 'skills' ? <SkillsTab gemState={gemState} reserved={reserved} sheets={sheets} set={set} /> : null}
          {tab === 'tree' ? (
            <TreeTab tree={tree} error={treeError} className={row.class} ascendancyId={row.ascendancy} passiveState={passiveState} level={row.level} />
          ) : null}
          {tab === 'stats' ? <StatsTab sheets={sheets} reserved={reserved} set={set} /> : null}
        </div>
        {tab === 'tree' ? null : <StatsRail sheets={sheets} set={set} reserved={reserved} />}
      </div>
    </div>
  );
}
```

On the compact bar: two copies of `HeaderActions` and of the switcher exist while it shows. That is fine for tests, because `checkpoint-switcher` is only clicked while the page is scrolled to the top, where the compact bar is not rendered. Keep it this way. Don't add `.first()` workarounds.

- [ ] **Step 9: Type-check and lint**

Run: `npm run type-check && npm run lint` → clean. (Nothing renders these yet; Task 5 wires them in.)

- [ ] **Step 10: Commit**

```bash
git add src/components/buildpage src/components/builds/ReadOnlyGemList.tsx
git commit -m "feat(build-page): header, tabs, checkpoint switcher, stats and tab bodies"
```

---

### Task 5: Server page — owner path, reader path, `BuildPage`

**Files:**
- Create: `src/app/(dashboard)/builds/[shareToken]/load.ts`
- Modify: `src/app/(dashboard)/builds/[shareToken]/page.tsx` (whole file)
- Delete: `src/components/builds/SharedBuildView.tsx`, `SharedTreePanel.tsx`, `SharedStatsPanel.tsx`

**Interfaces:**
- Consumes: Task 4 `BuildPage`, `BuildPageProps`; Task 2 `patchQuery`.
- Produces:
```ts
export interface LoadedBuild { mode: 'owner' | 'reader'; row: SharedBuildRow; checkpoints: BuildCheckpoint[]; authorName: string; tags: string[] | null }
export async function loadBuildForViewer(shareToken: string, userId: string, opts: { countView: boolean }): Promise<LoadedBuild | null>;
```

- [ ] **Step 1: `load.ts`**

```ts
// Loading /builds/[shareToken] for one signed-in viewer. Owner first, then reader.
//
// OWNER: a plain select scoped by share_token AND user_id. It goes through
// the owner's own RLS policies, and it is the only way an owner can open an
// `unlisted` build here: get_build_by_share_token filters
// visibility IN ('public','private') and would 404 it.
//
// READER: exactly the pre-redesign path. Only the share-token RPCs, author
// name, tags for public builds only, and the view count for public builds only.
// Never a plain select keyed off anything the client sent besides the token.
import { createClient } from '@/lib/supabase/server';
import { SHARE_TOKEN_RE } from '@/lib/build/constants';
import { parseCheckpoints, type BuildCheckpoint } from '@/lib/build/checkpointState';
import type { SharedBuildRow } from '@/lib/build/types';

export interface LoadedBuild {
  mode: 'owner' | 'reader';
  row: SharedBuildRow;
  checkpoints: BuildCheckpoint[];
  authorName: string;
  /** null = this viewer cannot see tags (a link-shared build); the page omits the section. */
  tags: string[] | null;
}

async function loadAsOwner(shareToken: string, userId: string): Promise<LoadedBuild | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from('builds')
    .select('*')
    .eq('share_token', shareToken)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) console.error('Failed to load own build by share token:', error);
  if (error || !row) return null;

  const [checkpointsResult, tagsResult] = await Promise.all([
    supabase.from('build_checkpoints').select('*').eq('build_id', row.id).order('position'),
    supabase.from('build_tags').select('tag').eq('build_id', row.id),
  ]);
  if (checkpointsResult.error) console.error('Failed to load build checkpoints:', checkpointsResult.error);
  if (tagsResult.error) console.error('Failed to load build tags:', tagsResult.error);

  return {
    mode: 'owner',
    row: row as SharedBuildRow,
    checkpoints: checkpointsResult.error ? [] : parseCheckpoints(checkpointsResult.data),
    authorName: 'You',
    tags: tagsResult.error ? [] : tagsResult.data.map((r: { tag: string }) => r.tag),
  };
}

async function loadAsReader(shareToken: string, userId: string, countView: boolean): Promise<LoadedBuild | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase.rpc('get_build_by_share_token', { p_token: shareToken }).maybeSingle();
  if (error || !row) return null;

  const [authorResult, tagsResult, viewCountResult, checkpointsResult] = await Promise.allSettled([
    supabase.rpc('get_build_author_name', { p_build_id: row.id }),
    row.visibility === 'public' ? supabase.from('build_tags').select('tag').eq('build_id', row.id) : Promise.resolve(null),
    countView && row.user_id !== userId && row.visibility === 'public'
      ? supabase.rpc('increment_build_view_count', { p_build_id: row.id })
      : Promise.resolve(null),
    supabase.rpc('get_build_checkpoints_by_share_token', { p_token: shareToken }),
  ]);

  // display_name has no write path in the app, so null is common. Never fall
  // back to anything identifying (the viewer's email is in a request header).
  const authorName =
    authorResult.status === 'fulfilled' && !authorResult.value.error && authorResult.value.data ? authorResult.value.data : 'Anonymous';
  if (authorResult.status === 'rejected' || authorResult.value.error) {
    console.error('Failed to load build author name:', authorResult.status === 'rejected' ? authorResult.reason : authorResult.value.error);
  }

  let tags: string[] | null = null;
  if (row.visibility === 'public') {
    if (tagsResult.status === 'fulfilled' && tagsResult.value && !tagsResult.value.error) {
      tags = tagsResult.value.data.map((r: { tag: string }) => r.tag);
    } else {
      tags = [];
      console.error('Failed to load build tags:', tagsResult.status === 'rejected' ? tagsResult.reason : tagsResult.value?.error);
    }
  }

  if (viewCountResult.status === 'rejected') {
    console.error('Failed to increment build view count:', viewCountResult.reason);
  } else if (viewCountResult.value && 'error' in viewCountResult.value && viewCountResult.value.error) {
    console.error('Failed to increment build view count:', viewCountResult.value.error);
  }

  let checkpoints: BuildCheckpoint[] = [];
  if (checkpointsResult.status === 'fulfilled' && !checkpointsResult.value.error) {
    checkpoints = parseCheckpoints(checkpointsResult.value.data);
  } else {
    console.error('Failed to load build checkpoints:', checkpointsResult.status === 'rejected' ? checkpointsResult.reason : checkpointsResult.value.error);
  }

  return { mode: 'reader', row, checkpoints, authorName, tags };
}

/**
 * Owner, else reader, else null (-> notFound). "Unlisted and not yours", a bad
 * token and a missing build all return null alike.
 * `countView: false` for callers that must not count (generateMetadata).
 */
export async function loadBuildForViewer(shareToken: string, userId: string, opts: { countView: boolean }): Promise<LoadedBuild | null> {
  if (!SHARE_TOKEN_RE.test(shareToken)) return null;
  return (await loadAsOwner(shareToken, userId)) ?? (await loadAsReader(shareToken, userId, opts.countView));
}
```

Before relying on the `authorResult.value.error` access on a fulfilled result, check that the TypeScript narrowing compiles. If it doesn't, rewrite the condition the way the current `page.tsx` does (`authorResult.status === 'rejected' || (authorResult.status === 'fulfilled' && authorResult.value.error)`).

- [ ] **Step 2: `page.tsx`**

```tsx
// /builds/[shareToken] — the build's page, for its owner and for readers.
//
// Server Component. Signed-in check -> owner or reader load (load.ts) ->
// checkpoint choice -> BuildPage. force-dynamic for the reason the previous
// version gave: a dynamic segment under a layout that calls headers() must
// opt out of on-demand static generation, and the result is per-viewer anyway.
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCachedUser } from '@/lib/supabase/server';
import { activeCheckpoint } from '@/lib/build/checkpointState';
import { patchQuery } from '@/lib/build/buildPage';
import type { SharedBuildRow } from '@/lib/build/types';
import type { Json } from '@/types/database';
import BuildPage from '@/components/buildpage/BuildPage';
import { loadBuildForViewer } from './load';

export const dynamicParams = true;
export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ shareToken: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shareToken } = await params;
  const { data } = await getCachedUser();
  if (!data.user) return { title: 'Build not found' };
  const loaded = await loadBuildForViewer(shareToken, data.user.id, { countView: false });
  return loaded ? { title: `${loaded.row.name} — Project Vaal` } : { title: 'Build not found' };
}

/** searchParams -> a plain query string, keeping single string values only. */
function toQuery(sp: { [key: string]: string | string[] | undefined }): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string') params.set(k, v);
  return params.toString();
}

export default async function BuildRoutePage({ params, searchParams }: PageProps) {
  const { shareToken } = await params;
  const sp = await searchParams;

  // Checked before any load, so every query below runs as a signed-in user
  // (anon holds no EXECUTE on the share-token RPCs). proxy.ts also guards
  // /builds, but its matcher is documented as not airtight.
  const { data: userData } = await getCachedUser();
  const user = userData.user;
  if (!user) redirect('/login');

  const loaded = await loadBuildForViewer(shareToken, user.id, { countView: true });
  if (!loaded) notFound();

  const checkpointParam = typeof sp.checkpoint === 'string' ? sp.checkpoint : null;
  const { checkpoints } = loaded;

  // Owner URLs always name their checkpoint (the rule /tree has used since
  // 2026-09-26): "the first by position" moves when checkpoints are
  // reordered. An unknown id (e.g. one just deleted) is replaced the same way.
  // Readers are not redirected: the view count above has already run, and a
  // redirect would run the page, and the count, a second time.
  if (loaded.mode === 'owner' && checkpoints.length > 0 && !checkpoints.some((c) => c.id === checkpointParam)) {
    const target = activeCheckpoint(checkpoints, checkpointParam)!;
    redirect(`/builds/${shareToken}${patchQuery(toQuery(sp), { checkpoint: target.id })}`);
  }

  const active = activeCheckpoint(checkpoints, checkpointParam);
  const row: SharedBuildRow = active
    ? {
        ...loaded.row,
        level: active.level,
        passive_state: active.passive_state as unknown as Json,
        gear_state: active.gear_state as Json,
        gem_state: active.gem_state as Json,
      }
    : loaded.row;

  return (
    <BuildPage
      // Keyed by checkpoint so no stage's state (tree export use, stats,
      // open menus) outlives a switch to another stage.
      key={active?.id ?? 'none'}
      mode={loaded.mode}
      row={row}
      authorName={loaded.authorName}
      tags={loaded.tags}
      shareToken={shareToken}
      checkpoints={checkpoints.map(({ id, name, level }) => ({ id, name, level }))}
      activeCheckpointId={active?.id}
    />
  );
}
```

**Deviation from spec §4, recorded:** readers are not redirected to a URL that names the checkpoint. The spec's reason for the rule (reorders moving the owner's page) applies to owners only. A redirect would also run the reader path, and its view count, twice.

- [ ] **Step 3: Delete the replaced components**

```bash
git rm src/components/builds/SharedBuildView.tsx src/components/builds/SharedTreePanel.tsx src/components/builds/SharedStatsPanel.tsx
```
Run: `npx tsc --noEmit` and grep `rg "SharedBuildView|SharedTreePanel|SharedStatsPanel" src` → no hits (comments mentioning them in other files: update the wording to "the build page").

- [ ] **Step 4: Run the new spec**

Run (port 3000 free): `npx playwright test e2e/build-page.spec.ts --project=mobile`
Expected: all 6 PASS. If the Tree tab's height makes the page overflow at 375px, adjust the `h-[calc(100dvh-17rem)]` in `TreeTab.tsx`. Measure `document.querySelector('[data-testid=tree-tab]').getBoundingClientRect()` against `innerHeight - 64` (bottom nav), don't guess.

- [ ] **Step 5: Type-check, lint, unit tests, commit**

Run: `npm run type-check && npm run lint && npm test` → clean / all pass.
```bash
git add -A src/app/'(dashboard)'/builds/'[shareToken]' src/components/builds
git commit -m "feat(build-page): owner and reader paths render the tabbed build page"
```

---

### Task 6: Move the old specs to the new page; desktop check; full suite

**Files:**
- Modify: `e2e/sharing.spec.ts`, `e2e/checkpoints.spec.ts`, `e2e/desktop-layout.spec.ts`

- [ ] **Step 1: `sharing.spec.ts`**: after `await page.goto(href!)`, the page opens on Overview. Replace the block from `await expect(page.getByText(bootsName)).toBeVisible();` through the stats step with:

```ts
    await page.getByRole('tab', { name: 'Gear', exact: true }).click();
    await expect(page.getByTestId('gear-tab').getByText(bootsName)).toBeVisible();
    await page.getByRole('tab', { name: 'Skills', exact: true }).click();
    await expect(page.getByTestId('skills-tab').getByText(skillName).first()).toBeVisible();

    // Slice 5: the shared page's stats match the owner's. Now a tab, not a tap-to-open sheet.
    await page.getByRole('tab', { name: 'Stats', exact: true }).click();
    const sharedStats = page.getByTestId('stats-panel');
    await expect(sharedStats.getByTestId('stat-life')).toHaveText(lifeOnTree!, { timeout: 60_000 });
    await expect(sharedStats.getByTestId('stat-act')).toContainText('Act 2');
```
Keep the rest (overflow check, Unlisted revoke) as is. Also read the remainder of the file below this block. If anything else there targets the old page's markup (`h1` is unchanged, the "Build not found" heading is unchanged), update it the same way.

- [ ] **Step 2: `checkpoints.spec.ts`**: replace the shared-page picker assertions (the `picker` block through the `measureTapTargets` call around lines 180-197) with:

```ts
      await page.goto(shareHref);
      const header = page.locator('h1').locator('xpath=following-sibling::p[1]');
      // Position 0 after the reorder is Level 94, so that is the default stage.
      await expect(header).toContainText('Level 94', { timeout: 30_000 });

      await page.getByTestId('checkpoint-switcher').click();
      const options = page.getByTestId('checkpoint-option');
      await expect(options).toHaveCount(2);
      const { scanned, tooSmall } = await measureTapTargets(page, '[data-testid="checkpoint-menu"]');
      expect(scanned, 'no checkpoint options found on the build page').toBe(2);
      expect(tooSmall, `checkpoint options under ${MIN_TAP_PX}px`).toEqual([]);

      await options.filter({ hasText: 'Lvl 31' }).click();
      await page.waitForURL(/[?&]checkpoint=/, { timeout: 30_000 });
      // The pair: the same share link now renders a DIFFERENT, populated stage.
      await expect(header).toContainText('Level 31');
```
Note: this spec's viewer is the owner, so the page now opens in owner mode, and the owner URL gets `?checkpoint=` added by redirect. The Level 94 default still holds: the redirect names position 0.

- [ ] **Step 3: `desktop-layout.spec.ts`**: add a test that imports the fixture (copy `importFixture` and `readShareToken` from `build-page.spec.ts`, since helpers stay test-local here by convention). Add `cleanupWithFreshPage` in `afterAll` if the file doesn't already have it. Then:

```ts
  test('the build page shows the stats rail beside the tab content, with no horizontal scroll', async ({ page }) => {
    const name = testBuildName('page-desktop');
    await importFixture(page, name);
    const token = await readShareToken(page, name);
    await page.goto(`/builds/${token}`);
    const rail = page.getByTestId('stats-rail');
    await expect(rail).toBeVisible({ timeout: 30_000 });
    const content = await page.getByTestId('overview-tab').boundingBox();
    const railBox = await rail.boundingBox();
    expect(railBox!.x, 'the rail is not to the right of the tab content').toBeGreaterThanOrEqual(content!.x + content!.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await expect(rail).toBeHidden();
  });
```

- [ ] **Step 4: Full suite**

Stop any server on port 3000. Run: `npm run test:e2e`
Expected: all pass except the known opt-in skip. Record the counts. `playwright-report/results.json` is the artifact. A failure in a spec this slice did not touch: re-run that spec alone once. If it passes alone, record it as a known flake per `CURRENT-STATE.md`. Otherwise fix it.

- [ ] **Step 5: Build**

Run: `npm run build` → clean.

- [ ] **Step 6: Commit**

```bash
git add e2e
git commit -m "test(e2e): sharing, checkpoints and desktop specs follow the tabbed build page"
```

---

## Finish (controller)

- Final branch review (fresh reviewer) against the spec's slice-1 list and this plan's Review Focus.
- Update `docs/superpowers/CURRENT-STATE.md`: the shared page section, the test counts, and the doc drift the handoff noted (Slices 3–5 marked "not yet merged").
- Merge `build-profile-redesign` into `main` locally and push. This push carries code plus the spec, handoff and plan (memory: never push docs-only).
