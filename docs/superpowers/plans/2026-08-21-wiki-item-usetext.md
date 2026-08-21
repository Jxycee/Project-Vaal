# Wiki Item Use-Text + Stack Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give currency-shaped wiki items (Blacksmith's Whetstone, orbs, omens, soul cores, etc.) their in-game use-text description, usage directions, and stack size on the item detail page, sourced from PoE2's `CurrencyItems` GGPK table.

**Architecture:** `@poe2-toolkit/item-extractor` has no field for this (confirmed reading its shipped `.d.ts`). Read PoE2's `CurrencyItems` table ourselves via the same `pathofexile-dat`-decode step `scripts/sync-wiki.ts` already runs, join it to `BaseItemTypes` by row index (same join shape `item-extractor`'s own `buildItems.js` uses internally), key the result by item display name, and merge it into `normalizeItem`'s output before it reaches `WikiItemDetail`.

**Tech Stack:** TypeScript, Vitest, `pathofexile-dat` (GGPK table decoder), Next.js App Router (Server Component).

## Global Constraints

- No new data source, no new license/attribution obligations — everything stays MIT/GGPK, same as the rest of the wiki (per [2026-08-16-wiki-design.md](../specs/2026-08-16-wiki-design.md) D4).
- Existing 4-arg `normalizeItem(name, item, iconUrl, lastSynced)` call sites (all of `normalize.test.ts`) must keep compiling unchanged — the new parameter is optional, defaulting to `null`.
- No DOM-rendering test coverage for the page.tsx change — this repo has no `jsdom`/`@testing-library/react` (documented gap, [wiki-data-gating-report.md](../handoffs/wiki-data-gating-report.md)). Verify Task 3 by reading real data through the pipeline directly (Node script), not a rendered DOM.
- Verified against a real, live GGPK decode during design (not assumed): `CurrencyItems` has 1,518 rows / 1,007 distinct item names; joins cleanly to `BaseItemTypes` by row index; `Description`/`Directions` use inline `[Key]` / `[Key|Display]` markup that must be stripped to plain text; `StackSize` is always populated (never `null`), with `1` as a real, common value for non-stackable currency (e.g. Orb of Imprinting).

---

### Task 1: `stripBracketMarkup` + currency-aware `normalizeItem`

**Files:**
- Modify: `src/lib/wiki/types.ts` (add fields to `WikiItemDetail`)
- Modify: `src/lib/wiki/normalize.ts` (add `stripBracketMarkup`, `CurrencyText`, extend `normalizeItem`)
- Test: `src/lib/wiki/normalize.test.ts`

**Interfaces:**
- Consumes: nothing new — pure addition to existing `WikiItemDetail`/`normalizeItem`.
- Produces: `export interface CurrencyText { stackSize: number; description: string | null; directions: string | null }` and `export function stripBracketMarkup(text: string): string`, both from `src/lib/wiki/normalize.ts` — Task 2 imports both. `normalizeItem`'s new 5th parameter: `currency: CurrencyText | null = null`.

- [ ] **Step 1: Add the three new fields to `WikiItemDetail`**

In `src/lib/wiki/types.ts`, inside `export interface WikiItemDetail extends WikiDetailBase { ... }`, immediately after the existing `iconUrl: string | null;` line, add:

```ts
  description: string | null;
  directions: string | null;
  stackSize: number | null;
```

- [ ] **Step 2: Write the failing tests for `stripBracketMarkup`**

In `src/lib/wiki/normalize.test.ts`, add near the top (after the existing `slugify` import — update the import line to also pull in `stripBracketMarkup`):

```ts
import { slugify, normalizeItem, normalizeSkill, normalizeMod, toSearchEntry, stripBracketMarkup } from './normalize';
```

Then add a new `describe` block (real strings captured from a live decode of PoE2's `CurrencyItems` table during design — not synthetic):

```ts
describe('stripBracketMarkup', () => {
  it('keeps the display half of a [Key|Display] tag', () => {
    expect(stripBracketMarkup('Improves the [Quality|quality] of a [MartialWeapon|martial weapon]'))
      .toBe('Improves the quality of a martial weapon');
  });

  it('keeps the key itself for a bare [Key] tag with no pipe', () => {
    expect(stripBracketMarkup('Creates a [Mirrored] copy of an item')).toBe('Creates a Mirrored copy of an item');
  });

  it('leaves plain text with no markup unchanged', () => {
    expect(stripBracketMarkup('Reforges a Rare item with new modifiers')).toBe('Reforges a Rare item with new modifiers');
  });

  it('strips multiple tags in one string', () => {
    expect(stripBracketMarkup('Upgrades a [Flask|flask] to a higher [ItemRarity|Magic] rarity'))
      .toBe('Upgrades a flask to a higher Magic rarity');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/wiki/normalize.test.ts`
Expected: FAIL — `stripBracketMarkup` is not exported from `./normalize`.

- [ ] **Step 4: Implement `stripBracketMarkup`**

In `src/lib/wiki/normalize.ts`, add near the top, after the `slugify` function:

```ts
/**
 * Strips PoE's inline `[Key]` / `[Key|Display]` markup from GGPK text.
 * `CurrencyItems.Description`/`.Directions` carry this formatting; no
 * @poe2-toolkit extractor renders it for us (unlike gem/mod stat text,
 * which the toolkit already returns pre-formatted), since this table isn't
 * one any extractor package reads. `[Key|Display]` keeps `Display`; a bare
 * `[Key]` (no pipe) keeps `Key` itself, e.g. `[Mirrored]` -> `Mirrored`.
 * Verified against a live decode: 409/1518 Description rows and 19/1518
 * Directions rows contain this markup.
 */
export function stripBracketMarkup(text: string): string {
  return text.replace(/\[([^\]|]+)(?:\|([^\]]+))?\]/g, (_match, key: string, display?: string) => display ?? key);
}
```

- [ ] **Step 5: Run the tests to verify `stripBracketMarkup` passes**

Run: `npx vitest run src/lib/wiki/normalize.test.ts`
Expected: the four new `stripBracketMarkup` tests PASS. The rest of the file still fails to compile yet (next steps fix that) if TypeScript strict-checks the now-missing `WikiItemDetail` fields — that's expected at this point; keep going to Step 6 before worrying about it.

- [ ] **Step 6: Write the failing tests for currency-aware `normalizeItem`**

In `src/lib/wiki/normalize.test.ts`, inside the existing `describe('normalizeItem', ...)` block (after the `'sets lastSynced to a real ISO timestamp'` test, before the `"stamps the caller's timestamp verbatim..."` test — anywhere in that block is fine), add:

```ts
  it('defaults description, directions, and stackSize to null when no currency row is given', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT);
    expect(result.description).toBeNull();
    expect(result.directions).toBeNull();
    expect(result.stackSize).toBeNull();
  });

  it('carries currency text through, stripped of bracket markup, when a currency row is given', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT, {
      stackSize: 20,
      description: 'Improves the [Quality|quality] of a [MartialWeapon|martial weapon]',
      directions: 'Right click this item then left click a martial weapon to apply it.',
    });
    expect(result.description).toBe('Improves the quality of a martial weapon');
    expect(result.directions).toBe('Right click this item then left click a martial weapon to apply it.');
    expect(result.stackSize).toBe(20);
  });

  it('passes stackSize through even when it is 1 (real value for non-stackable currency) rather than nulling it', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT, {
      stackSize: 1,
      description: null,
      directions: 'Right click this item then left click on the imprinted original item to restore its modifiers.',
    });
    expect(result.stackSize).toBe(1);
    expect(result.description).toBeNull();
  });
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npx vitest run src/lib/wiki/normalize.test.ts`
Expected: FAIL — `normalizeItem` doesn't accept a 5th argument yet, and/or `result.description`/`.directions`/`.stackSize` are `undefined`, not matching the assertions.

- [ ] **Step 8: Implement the `CurrencyText` type and extend `normalizeItem`**

In `src/lib/wiki/normalize.ts`, add the type just above `normalizeItem`:

```ts
/**
 * One item's joined `CurrencyItems` row, keyed by display name in
 * scripts/sync-wiki.ts's own join (see that file's `joinCurrencyByName`) —
 * this module only shapes it onto `WikiItemDetail`, it doesn't do the join.
 */
export interface CurrencyText {
  stackSize: number;
  description: string | null;
  directions: string | null;
}
```

Then change the `normalizeItem` signature and body:

```ts
export function normalizeItem(
  name: string,
  item: Item,
  iconUrl: string | null,
  lastSynced: string,
  currency: CurrencyText | null = null,
): WikiItemDetail {
  return {
    kind: 'item',
    slug: slugify(name),
    name,
    category: item.itemClass ?? item.category ?? 'Unknown',
    rarity: item.rarity,
    itemClass: item.itemClass,
    twoHanded: item.twoHanded,
    requirements: {
      strength: item.req.str,
      dexterity: item.req.dex,
      intelligence: item.req.int,
    },
    armour: item.armour,
    weapon: item.weapon,
    spirit: item.spirit,
    dropLevel: item.dropLevel,
    flavourText: item.flavourText,
    modDomain: item.modDomain,
    tags: item.tags,
    iconUrl,
    description: currency?.description != null ? stripBracketMarkup(currency.description) : null,
    directions: currency?.directions != null ? stripBracketMarkup(currency.directions) : null,
    stackSize: currency?.stackSize ?? null,
    lastSynced,
  };
}
```

- [ ] **Step 9: Run the full test file and the type-checker**

Run: `npx vitest run src/lib/wiki/normalize.test.ts && npm run type-check`
Expected: every test in the file PASSES (including the pre-existing ones — the new parameter is optional so the old 4-arg calls still compile and behave identically), and `type-check` is clean.

- [ ] **Step 10: Commit**

```bash
git add src/lib/wiki/types.ts src/lib/wiki/normalize.ts src/lib/wiki/normalize.test.ts
git commit -m "$(cat <<'EOF'
feat(wiki): add currency description/directions/stackSize to item normalization

item-extractor exposes no field for a currency item's use-text (confirmed
reading its .d.ts) — PoE2's CurrencyItems GGPK table has it, joined to
BaseItemTypes by row index, so normalizeItem now accepts that joined row
directly. stripBracketMarkup handles the table's inline [Key]/[Key|Display]
formatting, verified against real decoded strings.
EOF
)"
```

---

### Task 2: Join `CurrencyItems` in the sync script

**Files:**
- Modify: `scripts/wiki/pathofexile-dat.config.json` (add the `CurrencyItems` table)
- Modify: `scripts/sync-wiki.ts` (add `joinCurrencyByName`, wire into `syncItems`)
- Test: `scripts/sync-wiki.test.ts`

**Interfaces:**
- Consumes: `CurrencyText` type from `src/lib/wiki/normalize.ts` (Task 1).
- Produces: `export function joinCurrencyByName(tablesDir: string): Map<string, CurrencyText>` from `scripts/sync-wiki.ts`.

- [ ] **Step 1: Add the `CurrencyItems` table to the decode config**

In `scripts/wiki/pathofexile-dat.config.json`, add a new entry to the `"tables"` array (anywhere — alphabetically after `"BaseItemTypes"` is fine, matching the file's rough grouping):

```json
    { "name": "CurrencyItems", "columns": ["BaseItemType", "StackSize", "Description", "Directions"] },
```

`BaseItemTypes` already lists `"Name"` in its own columns — no change needed there; `joinCurrencyByName` (below) reads that existing column.

- [ ] **Step 2: Write the failing test for `joinCurrencyByName`**

In `scripts/sync-wiki.test.ts`, add `joinCurrencyByName` to the existing import from `./sync-wiki`:

```ts
import {
  validateSyncResult,
  ddsPathToIconKey,
  dedupeSlug,
  findPreviousVersionDir,
  findPreviousCount,
  joinCurrencyByName,
} from './sync-wiki';
```

Then add a new `describe` block at the end of the file (real row shapes captured from a live decode during design — `_index`, `BaseItemType`-as-row-index, and the exact Blacksmith's Whetstone / "Mirrored" values are genuine, not invented):

```ts
describe('joinCurrencyByName', () => {
  let root: string;

  const writeTables = (baseItemTypes: object[], currencyItems: object[]) => {
    const dir = path.join(root, 'tables', 'English');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'BaseItemTypes.json'), JSON.stringify(baseItemTypes));
    writeFileSync(path.join(dir, 'CurrencyItems.json'), JSON.stringify(currencyItems));
    return dir;
  };

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'wiki-currency-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('joins a CurrencyItems row to its BaseItemTypes name by row index', () => {
    const dir = writeTables(
      [{ _index: 0, Id: 'Metadata/Items/Currency/CurrencyWeaponQuality', Name: "Blacksmith's Whetstone" }],
      [{ _index: 15, BaseItemType: 0, StackSize: 20, Directions: 'Right click this item then left click a martial weapon to apply it.', Description: 'Improves the [Quality|quality] of a [MartialWeapon|martial weapon]' }],
    );

    const result = joinCurrencyByName(dir);

    expect(result.get("Blacksmith's Whetstone")).toEqual({
      stackSize: 20,
      description: 'Improves the [Quality|quality] of a [MartialWeapon|martial weapon]',
      directions: 'Right click this item then left click a martial weapon to apply it.',
    });
  });

  it('leaves bracket markup un-stripped — that is normalizeItem/stripBracketMarkup\'s job, not the join\'s', () => {
    const dir = writeTables(
      [{ _index: 0, Id: 'Metadata/Items/Currency/CurrencyMirroredItem', Name: 'Mirror of Kalandra' }],
      [{ _index: 5, BaseItemType: 0, StackSize: 1, Directions: null, Description: 'Creates a [Mirrored] copy of an item' }],
    );

    expect(joinCurrencyByName(dir).get('Mirror of Kalandra')?.description).toBe('Creates a [Mirrored] copy of an item');
  });

  it('returns an empty map when a name has no matching currency row', () => {
    const dir = writeTables(
      [{ _index: 0, Id: 'Metadata/Items/Gear/Sword', Name: 'Rusted Sword' }],
      [],
    );

    expect(joinCurrencyByName(dir).size).toBe(0);
  });

  it('keeps the first row on a name collision, same convention as ItemData itself', () => {
    const dir = writeTables(
      [
        { _index: 0, Id: 'Metadata/Items/Currency/A', Name: 'Duplicate Name' },
        { _index: 1, Id: 'Metadata/Items/Currency/B', Name: 'Duplicate Name' },
      ],
      [
        { _index: 0, BaseItemType: 0, StackSize: 10, Directions: null, Description: 'first' },
        { _index: 1, BaseItemType: 1, StackSize: 99, Directions: null, Description: 'second' },
      ],
    );

    expect(joinCurrencyByName(dir).get('Duplicate Name')?.description).toBe('first');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run scripts/sync-wiki.test.ts`
Expected: FAIL — `joinCurrencyByName` is not exported from `./sync-wiki`.

- [ ] **Step 4: Implement `joinCurrencyByName`**

In `scripts/sync-wiki.ts`, add the import (extend the existing normalize import line):

```ts
import { normalizeItem, normalizeSkill, normalizeMod, toSearchEntry, slugify } from '../src/lib/wiki/normalize';
import type { CurrencyText } from '../src/lib/wiki/normalize';
```

Then add the function, placed after `ddsPathToIconKey` and before `dedupeSlug` (grouping it with the other small pure/IO helpers near the top of the file):

```ts
/**
 * Joins PoE2's `CurrencyItems` table to `BaseItemTypes` by row index — the
 * same `BaseItemType`-keyed join `@poe2-toolkit/item-extractor`'s own
 * `buildItems.js` already uses internally for `AttributeRequirements`/
 * `ArmourTypes`/`WeaponTypes`/`ItemSpirit` — then re-keys the result by
 * display `Name` so it lines up with `extractItems()`'s `ItemData` keys
 * (item-extractor exposes no row index on its own `Item` type, so `Name`
 * is the only join key available on the consuming side).
 *
 * Reads the tables directly off disk rather than through `GgpkSource`:
 * `item-extractor` doesn't read this table at all, so there's no extractor
 * API to ask for it — `pathofexile-dat` already decoded it to
 * `<tablesDir>/CurrencyItems.json` as a flat JSON array (same place/shape
 * every other table in `scripts/wiki/pathofexile-dat.config.json` lands),
 * so a plain read is the whole job.
 *
 * Verified against a live decode (2026-08-21): 1,518 CurrencyItems rows /
 * 1,007 distinct names, covering StackableCurrency (437/437), SoulCore
 * (260/295), MapFragment (125/132), Omen (49/50), Incubator (30/30),
 * Breachstone (26/26), the three UncutXGemStackable classes, and several
 * smaller categories. Does not cover QuestItem, Jewel, flasks, or gear —
 * consistent with those genuinely carrying no in-game use-text.
 */
export function joinCurrencyByName(tablesDir: string): Map<string, CurrencyText> {
  const baseRows: { _index: number; Name: string }[] =
    JSON.parse(readFileSync(path.join(tablesDir, 'BaseItemTypes.json'), 'utf8'));
  const currencyRows: { BaseItemType: number; StackSize: number; Description: string | null; Directions: string | null }[] =
    JSON.parse(readFileSync(path.join(tablesDir, 'CurrencyItems.json'), 'utf8'));

  const nameByIndex = new Map(baseRows.map((r) => [r._index, r.Name]));
  const result = new Map<string, CurrencyText>();
  for (const row of currencyRows) {
    const name = nameByIndex.get(row.BaseItemType);
    // First row wins on a name collision — same convention `extractItems()`
    // itself uses for ItemData (see normalize.ts's module docstring).
    if (name && !result.has(name)) {
      result.set(name, { stackSize: row.StackSize, description: row.Description, directions: row.Directions });
    }
  }
  return result;
}
```

- [ ] **Step 5: Wire it into `syncItems`**

In `scripts/sync-wiki.ts`, change `syncItems`:

```ts
async function syncItems(lastSynced: string): Promise<number> {
  const source = await createCdnSource({ patch: WIKI_PATCH_VERSION, cacheDir: path.join(EXTRACT_DIR, '.cache'), tablesDir: TABLES_DIR });
  const { data, icons } = await extractItems(source);
  const currencyByName = joinCurrencyByName(TABLES_DIR);
  const usedSlugs = new Set<string>();
  const details: WikiItemDetail[] = [];
  for (const [name, item] of Object.entries(data)) {
    const slug = dedupeSlug(slugify(name), name, usedSlugs);
    const iconUrl = item.icon
      ? await writeIcon('item', slug, ddsPathToIconKey(item.icon), icons.icons)
      : null;
    details.push({ ...normalizeItem(name, item, iconUrl, lastSynced, currencyByName.get(name) ?? null), slug });
  }
  return writeKind('item', details);
}
```

(Only the added `const currencyByName = ...` line and the extra argument on the `normalizeItem(...)` call change — everything else in the function is unchanged.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run scripts/sync-wiki.test.ts && npm run type-check`
Expected: all tests PASS (new and pre-existing), `type-check` clean.

- [ ] **Step 7: Commit**

```bash
git add scripts/wiki/pathofexile-dat.config.json scripts/sync-wiki.ts scripts/sync-wiki.test.ts
git commit -m "$(cat <<'EOF'
feat(wiki): join CurrencyItems into the sync script's item pipeline

Adds CurrencyItems to the pathofexile-dat decode config and joins it to
BaseItemTypes by row index (same join shape item-extractor's own
buildItems.js uses internally), re-keyed by display name so syncItems can
look each item's currency row up by the same key extractItems() returns.
EOF
)"
```

---

### Task 3: Render description, directions, drop level, and stack size

**Files:**
- Modify: `src/app/wiki/items/[slug]/page.tsx`

**Interfaces:**
- Consumes: `WikiItemDetail.description`, `.directions`, `.stackSize`, `.dropLevel` (all already present on the type after Task 1; `dropLevel` already existed, just wasn't rendered).
- Produces: nothing new for other tasks — this is the leaf UI change.

- [ ] **Step 1: Add the meta (drop level / stack size) and description/directions blocks**

In `src/app/wiki/items/[slug]/page.tsx`, change the body of `ItemDetailPage`. First, add a `meta` array next to the existing `reqs` line:

```tsx
  const reqs = Object.entries(item.requirements).filter(([, v]) => v > 0);
  const meta: [string, number][] = [];
  if (item.dropLevel > 0) meta.push(['Drop Level', item.dropLevel]);
  if (item.stackSize != null && item.stackSize > 1) meta.push(['Stack Size', item.stackSize]);
```

Then, immediately after the `</header>` closing tag and before the existing `{reqs.length > 0 && (...)}` block, add:

```tsx
      {meta.length > 0 && (
        <ul className="space-y-1 text-sm">
          {meta.map(([label, value]) => (
            <li key={label} className="text-muted-foreground">
              {label}: {value}
            </li>
          ))}
        </ul>
      )}
```

Then, after the existing weapon `<ul>` block and before the existing `{item.flavourText && ...}` block, add:

```tsx
      {item.description && (
        <p className="text-sm">{item.description}</p>
      )}
      {item.directions && (
        <p className="text-sm italic text-muted-foreground">{item.directions}</p>
      )}
```

Functional text (`description`/`directions`) is placed above flavour text, matching in-game tooltip ordering and the reference screenshot's layout (blue use-text, then italic directions, then flavour/lore last).

- [ ] **Step 2: Type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: both clean.

- [ ] **Step 3: Verify against real data without needing an authenticated browser session**

This repo has no DOM test harness (documented gap — see Global Constraints), and `/wiki` is auth-gated so a plain `curl`/dev-server hit won't reach the page. Verify the full pipeline end to end with a direct Node script instead — this exercises `loadDetail` (unchanged) reading a real detail JSON file that Task 4 will regenerate with the new fields:

```bash
npx tsx -e "
import('./src/lib/wiki/load.ts').then(async ({ loadDetail }) => {
  const item = await loadDetail('item', 'blacksmiths-whetstone');
  console.log(JSON.stringify(item, null, 2));
});
"
```

Expected at this point in the plan (before Task 4 regenerates the file): the existing `public/data/wiki/2026-08-21/items/blacksmiths-whetstone.json` on disk still predates this change, so `description`/`directions`/`stackSize` will be `undefined` when logged (not part of the file yet, and `loadDetail`'s `isDetailFor` check doesn't require them) — that's expected and not a failure; Task 4 is what regenerates the file for real. This step exists to confirm `loadDetail`/the page component compile and read the new optional fields without throwing, ahead of the real data existing.

- [ ] **Step 4: Commit**

```bash
git add "src/app/wiki/items/[slug]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(wiki): render item description, directions, drop level, and stack size

Functional use-text and directions render above the existing flavour-text
block, matching in-game tooltip ordering. dropLevel was already synced but
never displayed — small free addition alongside this work.
EOF
)"
```

---

### Task 4: Real sync run, coverage audit, and end-to-end verification

**Files:**
- Modify (generated, not hand-written): `public/data/wiki/2026-08-21/items/**` (regenerated in place — same `WIKI_DATA_VERSION`, matching the existing weekly-recync-in-place pattern `findPreviousCount`'s own tests document)

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Produces: real, currently-deployed-shape wiki item data with the new fields populated — the actual Phase 2 audit from the design spec.

- [ ] **Step 1: Run the real sync**

```bash
npm run sync:wiki
```

This downloads/decodes GGPK tables (network access to GGG's own patch CDN — same thing CI's `sync-wiki.yml` does weekly) and regenerates every `public/data/wiki/2026-08-21/{items,skills,mods}/*.json` plus the three index files and icons. Expect this to take several minutes. If `validateSyncResult` throws a `>10%` drop error, that means something upstream shrank unexpectedly — stop and investigate rather than re-running with `--allow-shrink`; this task isn't expected to change entity counts, only add fields to existing items.

- [ ] **Step 2: Confirm the target item now carries the new fields**

```bash
npx tsx -e "
import('./src/lib/wiki/load.ts').then(async ({ loadDetail }) => {
  const item = await loadDetail('item', 'blacksmiths-whetstone');
  console.log(JSON.stringify({ description: item?.description, directions: item?.directions, stackSize: item?.stackSize, dropLevel: item?.dropLevel }, null, 2));
});
"
```

Expected output:

```json
{
  "description": "Improves the quality of a martial weapon",
  "directions": "Right click this item then left click a martial weapon to apply it.",
  "stackSize": 20,
  "dropLevel": 5
}
```

(Matches the reference screenshot exactly — this is the concrete acceptance check for the whole plan.)

- [ ] **Step 3: Run the real coverage audit (Phase 2 from the design spec)**

```bash
node -e "
const fs = require('fs');
const dir = 'public/data/wiki/2026-08-21/items';
const files = fs.readdirSync(dir);
const byCat = {};
for (const f of files) {
  const it = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8'));
  const cat = it.category || 'Unknown';
  if (!byCat[cat]) byCat[cat] = { count: 0, described: 0 };
  byCat[cat].count++;
  if (it.description) byCat[cat].described++;
}
const rows = Object.entries(byCat).filter(([, s]) => s.described > 0).sort((a, b) => b[1].described - a[1].described);
for (const [cat, s] of rows) console.log(cat.padEnd(30), 'described=' + s.described, '/', s.count);
console.log('TOTAL described', rows.reduce((a, [, s]) => a + s.described, 0));
"
```

Report the real output. Expected to closely match the design-time spike (StackableCurrency 437/437, SoulCore ~260/295, MapFragment ~125/132, Omen ~49/50, Incubator 30/30, Breachstone 26/26, plus the uncut-gem-stackable and smaller classes, ~1000 items total) — this run is against the exact same live patch data the spike already sampled, so it should reproduce those numbers almost exactly, not diverge from them. If the total is meaningfully lower than the spike's ~1,004, that's worth investigating (a join-key mismatch) before treating this task as done. Confirming the numbers here is what determines whether Phase 3 (poe2wiki.net fallback, its own future spec) is even worth pursuing — do not start that work as part of this plan.

- [ ] **Step 4: Full test suite and build**

```bash
npx vitest run && npm run type-check && npm run lint && npm run build
```

Expected: all clean. `npm run build` in particular re-confirms the `outputFileTracingExcludes` function-bundle scoping (next.config.ts) still keeps the items function under Vercel's size cap with the (unchanged-in-count, just larger-per-record) item detail JSON files.

- [ ] **Step 5: Commit the regenerated data**

```bash
git add public/data/wiki/2026-08-21
git commit -m "$(cat <<'EOF'
chore(wiki): resync item data with currency description/directions/stackSize

Real sync run against the live patch CDN — same WIKI_DATA_VERSION, in-place
refresh. Confirmed Blacksmith's Whetstone and ~1,000 other currency-shaped
items now carry description/directions/stackSize; category coverage matches
the design-time spike.
EOF
)"
```

- [ ] **Step 6: Ask the user to click through in their authenticated browser**

This plan's automated verification (Steps 2–4) confirms the data pipeline end to end but cannot exercise the auth-gated `/wiki` route the way a real signed-in visit does (same limitation noted throughout the wiki-data-gating handoff). Ask the user to reload `/wiki/items/blacksmiths-whetstone` (or any other now-covered item) in their own logged-in session and confirm it matches the reference screenshot layout — description, directions, drop level, and stack size all visible.
