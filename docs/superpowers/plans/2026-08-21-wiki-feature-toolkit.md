# Wiki Feature (M1, poe2-toolkit source) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> This plan supersedes `docs/superpowers/plans/2026-08-16-wiki-feature.md`'s Task 0–7 breakdown. That file's Skills Contract, Multi-Session Protocol, and Global Constraints still apply. Read `docs/superpowers/specs/2026-08-16-wiki-design.md` (the design) and `docs/superpowers/specs/2026-08-16-wiki-source-recon.md` (verified API recon) before Task 1 — every type and function signature below is copied from those, not re-derived.

**Goal:** Ship a searchable PoE2 item + skill-gem + mod wiki at `/wiki`, sourced entirely from `@poe2-toolkit`'s GGPK extractors (already a project dependency via `tree-core`/`tree-react`), gated behind auth, with a slim mobile-first search index and icon-bearing detail pages.

**Architecture:** `scripts/sync-wiki.ts` runs a two-stage pipeline — `pathofexile-dat` decodes named GGPK tables to local JSON, then `@poe2-toolkit/{item,gem,mod}-extractor` join those tables into flat typed data (+ PNG icons for items/skills). The sync normalizes into a slim search-index tier and a per-entity detail tier per kind, writes them under `public/data/wiki/<version>/`, and opens a PR (not a direct push) for review. Browse pages Fuse-search the slim index; detail pages are ISR-rendered from the detail tier.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Fuse.js, vitest, GitHub Actions, `@poe2-toolkit/{ggpk,item-extractor,gem-extractor,mod-extractor}` (all `1.0.0`), `pathofexile-dat` (already present as `@poe2-toolkit/ggpk`'s dependency — installed as a devDependency here for its CLI). Repo `C:\Dev\project-vaal`, worktree `C:\Dev\project-vaal\.claude\worktrees\feature+wiki-m1`, alias `@/*` → `src/*`. Shell is **PowerShell** outside this worktree's Bash tool sessions — match whichever the executing session actually uses.

## Global Constraints

- **Mobile-first is binding.** No browse page may require downloading the full detail dataset. Icons render on detail pages only, never in the browse/search list (design §5).
- **No DPS calculation** or derived combat math — display source text/numbers only, no formulas.
- **`/wiki` is gated**, not public (D1). Joins `PROTECTED_PREFIXES` in `src/proxy.ts` alongside `/tree`, `/campaign`, etc.
- **GGG art use is a named, scoped exception** (AGENTS.md) — wiki item/gem icons are the second instance of it (Task 7), sourced only via the same MIT `@poe2-toolkit` already used for the tree. Never add any other GGG art source.
- **No unique item mod values.** Not derivable from this pipeline (design §3 "known limitation"). Do not invent or approximate them — omit the field entirely rather than showing wrong or empty-looking data.
- **Token-driven styling only**: `bg-card`, `text-muted-foreground`, `bg-primary`, `border`, `text-destructive`, `font-heading`, `font-sans`. Never hard-coded hex.
- **Verification gates before every commit**: `npm run type-check` → `npm run lint` → `npm run build` (build only where a task touches App Router routes — Tasks 4–6). State actual results, not expectations.
- `WIKI_PATCH_VERSION = '4.5.4.10'` is a manually-bumped constant (design §2) — do not attempt to auto-resolve "latest" in this plan; that's an explicit later-milestone item.
- PowerShell commands, backslash paths, when the executing session is outside this worktree's Bash tool.

---

## File Structure

```
scripts/wiki/
  pathofexile-dat.config.json   Static config for the pathofexile-dat table-decode stage (Task 3)
  capture-fixtures.mjs          Throwaway — real recon script, deleted end of Task 1
scripts/sync-wiki.ts            Orchestrates decode -> extract -> normalize -> validate -> write (Task 3)
scripts/sync-wiki.test.ts       validateSyncResult tests (Task 3)
src/lib/wiki/
  types.ts                      WikiEntryKind, WikiSearchEntry, WikiIndexFile, WikiItemDetail, WikiSkillDetail, WikiModDetail, isWikiSearchEntry, WIKI_DATA_VERSION, WIKI_PATCH_VERSION (Task 1)
  types.test.ts                 (Task 1)
  __fixtures__/
    sample-item.json            Real extractItems() output, one item (Task 1)
    sample-gem.json             Real extractGems() output, one gem (Task 1)
    sample-mod.json             Real extractMods() output, one mod (Task 1)
  normalize.ts                  slugify, normalizeItem, normalizeSkill, normalizeMod, toSearchEntry (Task 2)
  normalize.test.ts             (Task 2)
  load.ts                       loadDetail, loadAllSlugs (Task 5)
  load.test.ts                  (Task 5)
src/components/wiki/
  WikiSearch.tsx                filterEntries, <WikiSearch> (Task 4)
  WikiSearch.test.tsx           (Task 4)
src/app/wiki/
  layout.tsx                    Nav + license footer (Task 4)
  page.tsx                      Redirect to /wiki/items (Task 4)
  items/page.tsx                Browse (Task 4)
  items/[slug]/page.tsx         Detail (Task 5)
  skills/page.tsx                Browse (Task 4)
  skills/[slug]/page.tsx        Detail (Task 5)
  mods/page.tsx                 Browse (Task 4)
  mods/[slug]/page.tsx          Detail (Task 5)
.github/workflows/sync-wiki.yml Weekly cron -> PR (Task 6)
src/proxy.ts                    Modify: add '/wiki' to PROTECTED_PREFIXES (Task 6)
src/components/layout/ShellChrome.tsx  Modify: Wiki nav Soon -> live link (Task 6)
THIRD-PARTY-NOTICES.md          Modify: extend @poe2-toolkit entry (Task 7)
AGENTS.md                       Modify: generalize GGG-art guardrail (Task 7)
```

---

## Task 1: Types, real fixture capture, and package installation

**Files:**
- Create: `src/lib/wiki/types.ts`
- Test: `src/lib/wiki/types.test.ts`
- Create: `scripts/wiki/capture-fixtures.mjs` (throwaway)
- Create: `scripts/wiki/pathofexile-dat.config.json`
- Create: `src/lib/wiki/__fixtures__/sample-item.json`, `sample-gem.json`, `sample-mod.json`
- Modify: `package.json` (add real dependencies)
- Delete: `scripts/wiki/capture-fixtures.mjs` (end of task)

**Interfaces:**
- Consumes: nothing.
- Produces: `WikiEntryKind`, `WikiSearchEntry`, `WikiIndexFile`, `WikiItemDetail`, `WikiSkillDetail`, `WikiModDetail`, `isWikiSearchEntry()`, `WIKI_DATA_VERSION`, `WIKI_PATCH_VERSION`. Real captured fixtures for Task 2.

- [ ] **Step 1: Install real dependencies (not `--no-save` this time)**

```bash
npm install @poe2-toolkit/ggpk@1.0.0 @poe2-toolkit/item-extractor@1.0.0 @poe2-toolkit/gem-extractor@1.0.0 @poe2-toolkit/mod-extractor@1.0.0
npm install --save-dev pathofexile-dat@15.2.0
```

Expected: `package.json` gains four `@poe2-toolkit/*` dependencies and one `pathofexile-dat` devDependency, matching the versions already verified working in `docs/superpowers/specs/2026-08-16-wiki-source-recon.md`.

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/wiki/types.test.ts
import { describe, it, expect } from 'vitest';
import { isWikiSearchEntry, WIKI_DATA_VERSION, WIKI_PATCH_VERSION } from './types';

describe('WikiSearchEntry', () => {
  it('accepts a well-formed entry', () => {
    expect(isWikiSearchEntry({
      slug: 'ice-nova',
      name: 'Ice Nova',
      kind: 'skill',
      category: 'Active Skill Gem',
      tags: ['Spell', 'AoE', 'Cold'],
    })).toBe(true);
  });

  it('rejects an entry missing a slug', () => {
    expect(isWikiSearchEntry({ name: 'X', kind: 'skill', category: 'c', tags: [] })).toBe(false);
  });

  it('rejects an unknown kind', () => {
    expect(isWikiSearchEntry({
      slug: 'x', name: 'X', kind: 'monster', category: 'c', tags: [],
    })).toBe(false);
  });

  it('exposes a dated data version string', () => {
    expect(WIKI_DATA_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('exposes a patch version string', () => {
    expect(WIKI_PATCH_VERSION).toMatch(/^\d+(\.\d+)+$/);
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

```bash
npx vitest run src/lib/wiki/types.test.ts
```

Expected: FAIL — cannot resolve `./types`.

- [ ] **Step 4: Write the minimal implementation**

```ts
// src/lib/wiki/types.ts

/**
 * Version stamp for the wiki data artifacts (sync date). Path segment under
 * public/data/wiki/<version>/ for cache-busting. Manually bumped, reviewed
 * via the weekly sync PR (scripts/sync-wiki.ts).
 */
export const WIKI_DATA_VERSION = '2026-08-21';

/**
 * GGPK patch version passed to createCdnSource. No public "latest" endpoint
 * exists for PoE2; this is bumped by hand when the sync PR shows stale data.
 * See docs/superpowers/specs/2026-08-16-wiki-source-recon.md.
 */
export const WIKI_PATCH_VERSION = '4.5.4.10';

export type WikiEntryKind = 'item' | 'skill' | 'mod';

/** Slim entry — this is what ships to the browser for search. Keep it small. */
export interface WikiSearchEntry {
  slug: string;
  name: string;
  kind: WikiEntryKind;
  category: string;
  tags: string[];
}

export interface WikiIndexFile {
  version: string;
  generatedAt: string;
  entries: WikiSearchEntry[];
}

interface WikiDetailBase {
  slug: string;
  name: string;
  category: string;
  lastSynced: string;
}

export interface WikiItemArmour {
  armour: number;
  evasion: number;
  energyShield: number;
  ward: number;
  block: number;
}

export interface WikiItemWeapon {
  damageMin: number;
  damageMax: number;
  critical: number;
  attackTime: number;
  rangeMax: number;
  reloadTime: number;
}

export interface WikiItemDetail extends WikiDetailBase {
  kind: 'item';
  rarity: 'normal' | 'unique';
  itemClass: string | null;
  twoHanded: boolean;
  requirements: { strength: number; dexterity: number; intelligence: number };
  armour: WikiItemArmour | null;
  weapon: WikiItemWeapon | null;
  spirit: number;
  dropLevel: number;
  flavourText: string[] | null;
  modDomain: string | null;
  tags: string[];
  iconUrl: string | null;
}

export interface WikiSkillStatLine {
  text: string;
  min: number;
  max: number;
}

export interface WikiSkillLevelScaling {
  level: number;
  cost: number | null;
  castTime: number | null;
  cooldown: number | null;
  reservation: number | null;
  stats: WikiSkillStatLine[];
}

export interface WikiSkillDetail extends WikiDetailBase {
  kind: 'skill';
  gemType: 'active' | 'support' | 'spirit';
  color: 'r' | 'g' | 'b' | 'w';
  tags: string[];
  description: string | null;
  requirement: { strength: number; dexterity: number; intelligence: number; level: number };
  scaling: WikiSkillLevelScaling[];
  iconUrl: string | null;
}

export interface WikiModRoll {
  stat: string;
  min: number;
  max: number;
}

export interface WikiModSpawnWeight {
  tag: string;
  weight: number;
}

export interface WikiModDetail extends WikiDetailBase {
  kind: 'mod';
  domain: string;
  generationType: string;
  group: string | null;
  tier: number | null;
  level: number;
  stats: string[];
  rolls: WikiModRoll[];
  families: string[];
  spawnWeights: WikiModSpawnWeight[];
}

const KINDS: readonly string[] = ['item', 'skill', 'mod'];

export function isWikiSearchEntry(value: unknown): value is WikiSearchEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.slug === 'string' && v.slug.length > 0 &&
    typeof v.name === 'string' && v.name.length > 0 &&
    typeof v.kind === 'string' && KINDS.includes(v.kind) &&
    typeof v.category === 'string' &&
    Array.isArray(v.tags) && v.tags.every((t) => typeof t === 'string')
  );
}
```

- [ ] **Step 5: Run the test and watch it pass**

```bash
npx vitest run src/lib/wiki/types.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Write the pathofexile-dat table config**

Copy verbatim from `docs/superpowers/specs/2026-08-16-wiki-source-recon.md`'s "config.json for pathofexile-dat" section (already trimmed to items/gems/mods tables) into:

```
scripts/wiki/pathofexile-dat.config.json
```

Replace its `"patch"` value with `WIKI_PATCH_VERSION` from Step 4 (`4.5.4.10`) if it differs.

- [ ] **Step 7: Write the throwaway fixture-capture script**

This is real recon exploration — per `test-driven-development`, throwaway exploration is permitted here provided it's discarded (it is, at Step 10).

```js
// scripts/wiki/capture-fixtures.mjs
import { mkdirSync, writeFileSync, cpSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const EXTRACT_DIR = path.join(ROOT, '.extract');
const TABLES_DIR = path.join(EXTRACT_DIR, 'tables', 'English');

mkdirSync(EXTRACT_DIR, { recursive: true });
cpSync(
  path.join(ROOT, 'pathofexile-dat.config.json'),
  path.join(EXTRACT_DIR, 'config.json'),
);

if (!existsSync(TABLES_DIR)) {
  console.log('Running pathofexile-dat to decode tables (this hits the real patch CDN)...');
  execFileSync('npx', ['pathofexile-dat'], { cwd: EXTRACT_DIR, stdio: 'inherit' });
}

const { createCdnSource } = await import('@poe2-toolkit/ggpk');
const { extractItems } = await import('@poe2-toolkit/item-extractor');
const { extractGems } = await import('@poe2-toolkit/gem-extractor');
const { extractMods } = await import('@poe2-toolkit/mod-extractor');

const source = await createCdnSource({
  patch: '4.5.4.10',
  cacheDir: path.join(EXTRACT_DIR, '.cache'),
  tablesDir: TABLES_DIR,
});

const items = await extractItems(source);
const gems = await extractGems(source);
const mods = await extractMods(source);

const firstItemName = Object.keys(items.data).find((k) => items.data[k].rarity === 'unique') ?? Object.keys(items.data)[0];
const firstGemKey = Object.keys(gems.data.gems)[0];
const firstModKey = Object.keys(mods.data)[0];

writeFileSync(
  path.join(ROOT, '..', '..', 'src', 'lib', 'wiki', '__fixtures__', 'sample-item.json'),
  JSON.stringify({ name: firstItemName, ...items.data[firstItemName] }, null, 2),
);
writeFileSync(
  path.join(ROOT, '..', '..', 'src', 'lib', 'wiki', '__fixtures__', 'sample-gem.json'),
  JSON.stringify({
    key: firstGemKey,
    gem: gems.data.gems[firstGemKey],
    requirement: gems.data.requirements[firstGemKey] ?? null,
    scaling: gems.data.scaling[firstGemKey] ?? null,
  }, null, 2),
);
writeFileSync(
  path.join(ROOT, '..', '..', 'src', 'lib', 'wiki', '__fixtures__', 'sample-mod.json'),
  JSON.stringify({ id: firstModKey, ...mods.data[firstModKey] }, null, 2),
);

console.log('Fixtures captured:', { firstItemName, firstGemKey, firstModKey });
console.log('Item icon count:', Object.keys(items.icons.icons).length, items.icons.report);
console.log('Gem icon count:', Object.keys(gems.icons.icons).length, gems.icons.report);
```

- [ ] **Step 8: Run it for real**

```bash
node scripts/wiki/capture-fixtures.mjs
```

Expected: downloads/decodes tables (may take a few minutes on first run — real network I/O against GGG's patch CDN), then prints the three captured keys and icon counts. **If this fails**, do not guess a fix — invoke `systematic-debugging`, starting with reading the actual error (auth/network/missing table/column typo are the likely first causes; cross-check the `pathofexile-dat.config.json` table/column names against the recon doc for typos before anything else).

- [ ] **Step 9: Inspect the three fixture files**

Open each and confirm it matches the shape documented in `docs/superpowers/specs/2026-08-16-wiki-source-recon.md`'s "Extractor APIs" section — same top-level keys (`rarity`/`icon`/`itemClass`/... for the item; `name`/`kind`/`tags`/... for the gem; `name`/`domain`/`generationType`/... for the mod). If a real field is missing or named differently than the recon doc says, **update the recon doc now** — Task 2's normalize functions must match the fixtures, not the doc, and the doc must not go stale.

- [ ] **Step 10: Delete the throwaway script, keep the fixtures**

```bash
rm scripts/wiki/capture-fixtures.mjs
rmdir /s /q scripts\wiki\.extract 2>nul || rm -rf scripts/wiki/.extract
```

The `.extract/` cache directory is throwaway (downloaded tables + decode cache) — do not commit it. Add it to `.gitignore` if not already covered by an existing pattern.

- [ ] **Step 11: Verify, then commit**

```bash
npm run type-check
npm run lint
npx vitest run
git add package.json package-lock.json src/lib/wiki/types.ts src/lib/wiki/types.test.ts src/lib/wiki/__fixtures__/ scripts/wiki/pathofexile-dat.config.json .gitignore
git commit -m "feat(wiki): add wiki data types and real poe2-toolkit fixtures"
```

- [ ] **Step 12: Request code review**

Invoke `requesting-code-review` with `BASE_SHA` = the design-spec-commit (`4f3a346`), `HEAD_SHA` = this commit, `PLAN_OR_REQUIREMENTS` = Task 1 of this plan.

---

## Task 2: Normalization — real extractor output to wiki types

**Files:**
- Create: `src/lib/wiki/normalize.ts`
- Test: `src/lib/wiki/normalize.test.ts`

**Interfaces:**
- Consumes: `WikiItemDetail`, `WikiSkillDetail`, `WikiModDetail`, `WikiSearchEntry` from `@/lib/wiki/types`; the three fixture files from Task 1; the real `Item`/`Gem`/`Mod` shapes from `@poe2-toolkit/{item,gem,mod}-extractor` (import their types directly — do not redeclare).
- Produces:
  - `slugify(name: string): string`
  - `normalizeItem(name: string, item: Item, iconUrl: string | null): WikiItemDetail`
  - `normalizeSkill(key: string, gem: Gem, requirement: GemRequirement | null, scaling: GemScaling | null, iconUrl: string | null): WikiSkillDetail`
  - `normalizeMod(id: string, mod: Mod): WikiModDetail`
  - `toSearchEntry(detail: WikiItemDetail | WikiSkillDetail | WikiModDetail): WikiSearchEntry`

- [ ] **Step 1: Write the failing tests, using the real Task 1 fixtures**

```ts
// src/lib/wiki/normalize.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { slugify, normalizeItem, normalizeSkill, normalizeMod, toSearchEntry } from './normalize';

const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(__dirname, '__fixtures__', name), 'utf8'));

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Ice Nova')).toBe('ice-nova');
  });
  it('strips apostrophes rather than encoding them', () => {
    expect(slugify("Kaom's Heart")).toBe('kaoms-heart');
  });
  it('collapses runs of separators', () => {
    expect(slugify('Orb  of --Storms')).toBe('orb-of-storms');
  });
  it('trims leading and trailing hyphens', () => {
    expect(slugify(' -Blink- ')).toBe('blink');
  });
});

describe('normalizeItem', () => {
  const raw = fixture('sample-item.json');

  it('produces a slug and kind from the real fixture', () => {
    const result = normalizeItem(raw.name, raw, null);
    expect(result.kind).toBe('item');
    expect(result.slug).toBe(slugify(raw.name));
    expect(result.name).toBe(raw.name);
  });

  it('carries requirements through as a flat strength/dexterity/intelligence object', () => {
    const result = normalizeItem(raw.name, raw, null);
    expect(result.requirements).toEqual({
      strength: raw.req.str,
      dexterity: raw.req.dex,
      intelligence: raw.req.int,
    });
  });

  it('passes the icon URL through unchanged when provided', () => {
    const result = normalizeItem(raw.name, raw, '/data/wiki/2026-08-21/icons/kaoms-heart.png');
    expect(result.iconUrl).toBe('/data/wiki/2026-08-21/icons/kaoms-heart.png');
  });

  it('sets lastSynced to a real ISO timestamp', () => {
    const result = normalizeItem(raw.name, raw, null);
    expect(new Date(result.lastSynced).toISOString()).toBe(result.lastSynced);
  });
});

describe('normalizeSkill', () => {
  const raw = fixture('sample-gem.json');

  it('produces a slug and kind from the real fixture', () => {
    const result = normalizeSkill(raw.key, raw.gem, raw.requirement, raw.scaling, null);
    expect(result.kind).toBe('skill');
    expect(result.slug).toBe(slugify(raw.gem.name));
    expect(result.gemType).toBe(raw.gem.kind);
  });

  it('defaults scaling to an empty array when the fixture has none', () => {
    const result = normalizeSkill(raw.key, raw.gem, null, null, null);
    expect(result.scaling).toEqual([]);
  });
});

describe('normalizeMod', () => {
  const raw = fixture('sample-mod.json');

  it('produces a slug from the mod id, not a display name (mods can be unnamed)', () => {
    const result = normalizeMod(raw.id, raw);
    expect(result.kind).toBe('mod');
    expect(result.slug).toBe(slugify(raw.id));
  });

  it('carries rolls and spawnWeights through unchanged', () => {
    const result = normalizeMod(raw.id, raw);
    expect(result.rolls).toEqual(raw.rolls);
    expect(result.spawnWeights).toEqual(raw.spawnWeights);
  });
});

describe('toSearchEntry', () => {
  it('drops detail-only fields from an item', () => {
    const raw = fixture('sample-item.json');
    const entry = toSearchEntry(normalizeItem(raw.name, raw, null));
    expect(Object.keys(entry).sort()).toEqual(['category', 'kind', 'name', 'slug', 'tags']);
  });

  it('drops detail-only fields from a mod', () => {
    const raw = fixture('sample-mod.json');
    const entry = toSearchEntry(normalizeMod(raw.id, raw));
    expect(Object.keys(entry).sort()).toEqual(['category', 'kind', 'name', 'slug', 'tags']);
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

```bash
npx vitest run src/lib/wiki/normalize.test.ts
```

Expected: FAIL — cannot resolve `./normalize`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/wiki/normalize.ts
import type { Item } from '@poe2-toolkit/item-extractor';
import type { Gem, GemRequirement, GemScaling } from '@poe2-toolkit/gem-extractor';
import type { Mod } from '@poe2-toolkit/mod-extractor';
import type {
  WikiItemDetail, WikiSkillDetail, WikiModDetail, WikiSearchEntry,
} from './types';

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeItem(name: string, item: Item, iconUrl: string | null): WikiItemDetail {
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
    lastSynced: new Date().toISOString(),
  };
}

export function normalizeSkill(
  key: string,
  gem: Gem,
  requirement: GemRequirement | null,
  scaling: GemScaling | null,
  iconUrl: string | null,
): WikiSkillDetail {
  const level1 = requirement?.levels[1];
  return {
    kind: 'skill',
    slug: slugify(gem.name),
    name: gem.name,
    category: gem.kind === 'support' ? 'Support Gem' : gem.kind === 'spirit' ? 'Spirit Gem' : 'Active Skill Gem',
    gemType: gem.kind,
    color: gem.color,
    tags: gem.tags,
    description: gem.description,
    requirement: {
      strength: level1?.str ?? 0,
      dexterity: level1?.dex ?? 0,
      intelligence: level1?.int ?? 0,
      level: level1?.requiredLevel ?? 1,
    },
    scaling: (scaling?.levels ?? []).map((l) => ({
      level: l.level,
      cost: l.cost,
      castTime: l.castTime,
      cooldown: l.cooldown,
      reservation: l.reservation,
      stats: l.stats.map((s) => ({ text: s.text, min: s.min, max: s.max })),
    })),
    iconUrl,
    lastSynced: new Date().toISOString(),
  };
}

export function normalizeMod(id: string, mod: Mod): WikiModDetail {
  return {
    kind: 'mod',
    slug: slugify(id),
    name: mod.name ?? id,
    category: mod.generationType,
    domain: mod.domain,
    generationType: mod.generationType,
    group: mod.group,
    tier: mod.tier,
    level: mod.level,
    stats: mod.stats,
    rolls: mod.rolls,
    families: mod.families,
    spawnWeights: mod.spawnWeights,
    lastSynced: new Date().toISOString(),
  };
}

export function toSearchEntry(
  detail: WikiItemDetail | WikiSkillDetail | WikiModDetail,
): WikiSearchEntry {
  const tags = detail.kind === 'item' ? detail.tags
    : detail.kind === 'skill' ? detail.tags
    : detail.families;
  return {
    slug: detail.slug,
    name: detail.name,
    kind: detail.kind,
    category: detail.category,
    tags,
  };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
npx vitest run src/lib/wiki/normalize.test.ts
```

Expected: PASS, all tests. If `normalizeMod`'s slug test fails because `raw.id` isn't present at the fixture's top level, check Step 9 of Task 1 — the fixture-capture script writes `{ id: firstModKey, ...mods.data[firstModKey] }`, so `id` should be there; a failure here means the fixture shape drifted and the recon doc needs updating, not this test loosened.

- [ ] **Step 5: Verify, then commit**

```bash
npm run type-check
npm run lint
npx vitest run
git add src/lib/wiki/normalize.ts src/lib/wiki/normalize.test.ts
git commit -m "feat(wiki): add normalize functions for poe2-toolkit item/gem/mod data"
```

- [ ] **Step 6: Request code review** (BASE = Task 1 commit, HEAD = this commit).

---

## Task 3: Sync script — two-stage pipeline with truncation guards

**Files:**
- Create: `scripts/sync-wiki.ts`
- Test: `scripts/sync-wiki.test.ts`

**Interfaces:**
- Consumes: `normalizeItem`, `normalizeSkill`, `normalizeMod`, `toSearchEntry` from `@/lib/wiki/normalize`; `WIKI_DATA_VERSION`, `WIKI_PATCH_VERSION`, `WikiSearchEntry` from `@/lib/wiki/types`; `createCdnSource` from `@poe2-toolkit/ggpk`; `extractItems` from `@poe2-toolkit/item-extractor`; `extractGems` from `@poe2-toolkit/gem-extractor`; `extractMods` from `@poe2-toolkit/mod-extractor`.
- Produces: `validateSyncResult(entries: WikiSearchEntry[], previousCount: number): void`; `ddsPathToIconKey(ddsPath: string): string`; writes `public/data/wiki/<version>/{item,skill,mod}-index.json`, `.../{items,skills,mods}/<slug>.json`, `.../icons/<slug>.png`.

**Why validation is load-bearing:** even though this source is GGG's own patch server (not community-edited), this repo has been bitten by silent truncation twice before (PostgREST's 1000-row default; poe2scout's pagination hiding Exalted Orb). A pipeline bug or a stale `WIKI_PATCH_VERSION` producing a truncated result is the realistic failure mode here, not vandalism — the guards below catch that regardless of cause.

- [ ] **Step 1: Write the failing tests**

```ts
// scripts/sync-wiki.test.ts
import { describe, it, expect } from 'vitest';
import { validateSyncResult, ddsPathToIconKey } from './sync-wiki';

const entry = (slug: string) => ({
  slug, name: slug, kind: 'skill' as const, category: 'Active Skill Gem', tags: [],
});

describe('validateSyncResult', () => {
  it('passes when the count is stable', () => {
    expect(() => validateSyncResult([entry('a'), entry('b')], 2)).not.toThrow();
  });

  it('throws on an empty result', () => {
    expect(() => validateSyncResult([], 100)).toThrow(/empty/i);
  });

  it('throws when the count drops more than 10 percent', () => {
    const entries = Array.from({ length: 80 }, (_, i) => entry(`s${i}`));
    expect(() => validateSyncResult(entries, 100)).toThrow(/dropped/i);
  });

  it('allows growth without complaint', () => {
    const entries = Array.from({ length: 200 }, (_, i) => entry(`s${i}`));
    expect(() => validateSyncResult(entries, 100)).not.toThrow();
  });

  it('throws on duplicate slugs', () => {
    expect(() => validateSyncResult([entry('a'), entry('a')], 2)).toThrow(/duplicate/i);
  });

  it('skips the drop check on a first run', () => {
    expect(() => validateSyncResult([entry('a')], 0)).not.toThrow();
  });
});

describe('ddsPathToIconKey', () => {
  it('replaces the dds extension with png, case-insensitively', () => {
    expect(ddsPathToIconKey('Art/2DArt/SkillIcons/SorceressIceNova.dds')).toBe('Art/2DArt/SkillIcons/SorceressIceNova.png');
  });
  it('leaves a path with no dds extension unchanged', () => {
    expect(ddsPathToIconKey('Art/2DArt/SkillIcons/SorceressIceNova')).toBe('Art/2DArt/SkillIcons/SorceressIceNova');
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

```bash
npx vitest run scripts/sync-wiki.test.ts
```

Expected: FAIL — cannot resolve `./sync-wiki`.

- [ ] **Step 3: Write the implementation**

```ts
// scripts/sync-wiki.ts
import { mkdirSync, writeFileSync, readFileSync, cpSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createCdnSource } from '@poe2-toolkit/ggpk';
import { extractItems } from '@poe2-toolkit/item-extractor';
import { extractGems } from '@poe2-toolkit/gem-extractor';
import { extractMods } from '@poe2-toolkit/mod-extractor';
import { normalizeItem, normalizeSkill, normalizeMod, toSearchEntry } from '../src/lib/wiki/normalize';
import { WIKI_DATA_VERSION, WIKI_PATCH_VERSION } from '../src/lib/wiki/types';
import type { WikiSearchEntry, WikiItemDetail, WikiSkillDetail, WikiModDetail } from '../src/lib/wiki/types';

const OUT_DIR = path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION);
const EXTRACT_DIR = path.join(process.cwd(), 'scripts', 'wiki', '.extract');
const TABLES_DIR = path.join(EXTRACT_DIR, 'tables', 'English');

export function validateSyncResult(
  entries: WikiSearchEntry[],
  previousCount: number,
): void {
  if (entries.length === 0) {
    throw new Error('wiki sync: result set is empty — refusing to write');
  }
  const slugs = new Set<string>();
  for (const e of entries) {
    if (slugs.has(e.slug)) {
      throw new Error(`wiki sync: duplicate slug "${e.slug}" (kind: ${e.kind})`);
    }
    slugs.add(e.slug);
  }
  if (previousCount > 0 && entries.length < previousCount * 0.9) {
    throw new Error(
      `wiki sync: count dropped from ${previousCount} to ${entries.length} ` +
      `(>10%) — likely truncation or a bad WIKI_PATCH_VERSION, refusing to write`,
    );
  }
}

/** Icon PNG results are keyed by "<dds path minus extension>.png" (@poe2-toolkit/ggpk convention). */
export function ddsPathToIconKey(ddsPath: string): string {
  return /\.dds$/i.test(ddsPath) ? ddsPath.replace(/\.dds$/i, '.png') : ddsPath;
}

function ensureTablesDecoded(): void {
  if (existsSync(TABLES_DIR)) return;
  mkdirSync(EXTRACT_DIR, { recursive: true });
  cpSync(
    path.join(process.cwd(), 'scripts', 'wiki', 'pathofexile-dat.config.json'),
    path.join(EXTRACT_DIR, 'config.json'),
  );
  execFileSync('npx', ['pathofexile-dat'], { cwd: EXTRACT_DIR, stdio: 'inherit' });
}

async function previousCount(kind: string): Promise<number> {
  try {
    const raw = readFileSync(path.join(OUT_DIR, `${kind}-index.json`), 'utf8');
    return (JSON.parse(raw).entries as unknown[]).length;
  } catch {
    return 0;
  }
}

function writeIcon(slug: string, iconKey: string | null, icons: Record<string, Buffer>): string | null {
  if (!iconKey) return null;
  const buf = icons[iconKey];
  if (!buf) return null;
  mkdirSync(path.join(OUT_DIR, 'icons'), { recursive: true });
  writeFileSync(path.join(OUT_DIR, 'icons', `${slug}.png`), buf);
  return `/data/wiki/${WIKI_DATA_VERSION}/icons/${slug}.png`;
}

async function syncItems(): Promise<number> {
  const source = await createCdnSource({ patch: WIKI_PATCH_VERSION, cacheDir: path.join(EXTRACT_DIR, '.cache'), tablesDir: TABLES_DIR });
  const { data, icons } = await extractItems(source);
  const details: WikiItemDetail[] = Object.entries(data).map(([name, item]) => {
    const slug = normalizeItem(name, item, null).slug;
    const iconUrl = item.icon ? writeIcon(slug, ddsPathToIconKey(item.icon), icons.icons) : null;
    return normalizeItem(name, item, iconUrl);
  });
  return writeKind('item', details);
}

async function syncSkills(): Promise<number> {
  const source = await createCdnSource({ patch: WIKI_PATCH_VERSION, cacheDir: path.join(EXTRACT_DIR, '.cache'), tablesDir: TABLES_DIR });
  const { data, icons } = await extractGems(source);
  const details: WikiSkillDetail[] = Object.entries(data.gems).map(([key, gem]) => {
    const slug = normalizeSkill(key, gem, null, null, null).slug;
    const iconUrl = gem.icon ? writeIcon(slug, ddsPathToIconKey(gem.icon), icons.icons) : null;
    return normalizeSkill(key, gem, data.requirements[key] ?? null, data.scaling[key] ?? null, iconUrl);
  });
  return writeKind('skill', details);
}

async function syncMods(): Promise<number> {
  const source = await createCdnSource({ patch: WIKI_PATCH_VERSION, cacheDir: path.join(EXTRACT_DIR, '.cache'), tablesDir: TABLES_DIR });
  const { data } = await extractMods(source);
  const details: WikiModDetail[] = Object.entries(data).map(([id, mod]) => normalizeMod(id, mod));
  return writeKind('mod', details);
}

async function writeKind(
  kind: 'item' | 'skill' | 'mod',
  details: Array<WikiItemDetail | WikiSkillDetail | WikiModDetail>,
): Promise<number> {
  const entries = details.map(toSearchEntry);
  validateSyncResult(entries, await previousCount(kind));

  mkdirSync(path.join(OUT_DIR, `${kind}s`), { recursive: true });
  writeFileSync(
    path.join(OUT_DIR, `${kind}-index.json`),
    JSON.stringify({ version: WIKI_DATA_VERSION, generatedAt: new Date().toISOString(), entries }),
  );
  for (const detail of details) {
    writeFileSync(path.join(OUT_DIR, `${kind}s`, `${detail.slug}.json`), JSON.stringify(detail));
  }
  return entries.length;
}

async function main(): Promise<void> {
  ensureTablesDecoded();
  const items = await syncItems();
  const skills = await syncSkills();
  const mods = await syncMods();
  console.log(`wiki sync complete: ${items} items, ${skills} skills, ${mods} mods -> ${OUT_DIR}`);
}

if (process.argv[1]?.includes('sync-wiki')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
npx vitest run scripts/sync-wiki.test.ts
```

Expected: PASS, 8 tests (these test the pure functions only — `validateSyncResult` and `ddsPathToIconKey` — not the network-touching `main()`, which Step 5 exercises for real).

- [ ] **Step 5: Run the sync for real**

```bash
npx tsx scripts/sync-wiki.ts
```

Expected: reuses `scripts/wiki/.extract/tables/English` if Task 1 left it (delete it first if you want a clean decode). Prints final counts. This is a real, potentially slow network operation — do not fake or skip it. Compare item/skill/mod counts against expectations (there is no Task-0-style pre-measurement here since recon didn't run the full extraction — this run *is* the first real measurement).

- [ ] **Step 6: Check output against the mobile-first budget**

```bash
du -sh public/data/wiki/2026-08-21/*-index.json 2>/dev/null || powershell -Command "Get-Item public\data\wiki\2026-08-21\*-index.json | Select-Object Name,Length"
```

**Gate:** if any slim index exceeds ~500KB gzipped, client-side Fuse is not mobile-viable — stop and raise it before Task 4, don't proceed silently.

- [ ] **Step 7: Add `.extract/` to `.gitignore`** if Task 1 didn't already, and verify `public/data/wiki/` icon/json output is not accidentally ignored by an existing broad `public/data/**` pattern — check `.gitignore` for one before assuming it's clean.

- [ ] **Step 8: Verify, then commit**

```bash
npm run type-check
npm run lint
npx vitest run
git add scripts/sync-wiki.ts scripts/sync-wiki.test.ts public/data/wiki/ .gitignore
git commit -m "feat(wiki): add sync script — pathofexile-dat decode + poe2-toolkit extract + validate"
```

- [ ] **Step 9: Request code review** (BASE = Task 2 commit, HEAD = this commit).

---

## Task 4: Browse pages with slim-index search

**Files:**
- Create: `src/app/wiki/layout.tsx`
- Create: `src/app/wiki/page.tsx`
- Create: `src/app/wiki/items/page.tsx`
- Create: `src/app/wiki/skills/page.tsx`
- Create: `src/app/wiki/mods/page.tsx`
- Create: `src/components/wiki/WikiSearch.tsx`
- Test: `src/components/wiki/WikiSearch.test.tsx`

**Interfaces:**
- Consumes: `WikiSearchEntry`, `WikiIndexFile`, `WIKI_DATA_VERSION` from `@/lib/wiki/types`.
- Produces: `filterEntries(entries, query)`, `<WikiSearch entries={...} basePath={...} />`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/wiki/WikiSearch.test.tsx
import { describe, it, expect } from 'vitest';
import { filterEntries } from './WikiSearch';

const entries = [
  { slug: 'ice-nova', name: 'Ice Nova', kind: 'skill' as const, category: 'Active Skill Gem', tags: ['Cold'] },
  { slug: 'orb-of-storms', name: 'Orb of Storms', kind: 'skill' as const, category: 'Active Skill Gem', tags: ['Lightning'] },
  { slug: 'blink', name: 'Blink', kind: 'skill' as const, category: 'Active Skill Gem', tags: ['Travel'] },
];

describe('filterEntries', () => {
  it('returns everything for an empty query', () => {
    expect(filterEntries(entries, '')).toHaveLength(3);
  });
  it('matches on name', () => {
    expect(filterEntries(entries, 'ice').map((e) => e.slug)).toContain('ice-nova');
  });
  it('tolerates a typo', () => {
    expect(filterEntries(entries, 'ise nva').map((e) => e.slug)).toContain('ice-nova');
  });
  it('returns an empty array for no match', () => {
    expect(filterEntries(entries, 'zzzzqqq')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
npx vitest run src/components/wiki/WikiSearch.test.tsx
```

Expected: FAIL — cannot resolve `./WikiSearch`.

- [ ] **Step 3: Write the component**

```tsx
// src/components/wiki/WikiSearch.tsx
'use client';

import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import Link from 'next/link';
import type { WikiSearchEntry } from '@/lib/wiki/types';

export function filterEntries(
  entries: WikiSearchEntry[],
  query: string,
): WikiSearchEntry[] {
  if (query.trim() === '') return entries;
  const fuse = new Fuse(entries, {
    keys: ['name', 'category', 'tags'],
    threshold: 0.4,
    ignoreLocation: true,
  });
  return fuse.search(query).map((r) => r.item);
}

export function WikiSearch({
  entries,
  basePath,
}: {
  entries: WikiSearchEntry[];
  basePath: string;
}) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => filterEntries(entries, query), [entries, query]);

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search…"
        aria-label="Search the wiki"
        className="w-full rounded-md border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
      />
      <p className="text-sm text-muted-foreground">
        {results.length} of {entries.length}
      </p>
      <ul className="divide-y divide-border">
        {results.slice(0, 100).map((entry) => (
          <li key={entry.slug}>
            <Link
              href={`${basePath}/${entry.slug}`}
              className="flex flex-col gap-0.5 py-3 hover:bg-card"
            >
              <span className="font-heading text-primary">{entry.name}</span>
              <span className="text-sm text-muted-foreground">{entry.category}</span>
            </Link>
          </li>
        ))}
      </ul>
      {results.length > 100 && (
        <p className="text-sm text-muted-foreground">
          Showing the first 100 results — refine your search to narrow them.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run src/components/wiki/WikiSearch.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Write the layout**

```tsx
// src/app/wiki/layout.tsx
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';

const NAV = [
  { href: '/wiki/items', label: 'Items' },
  { href: '/wiki/skills', label: 'Skills' },
  { href: '/wiki/mods', label: 'Mods' },
];

export default function WikiLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <nav className="mb-6 flex gap-4" aria-label="Wiki sections">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="font-heading text-primary hover:underline">
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
      <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">
        Item, skill, and mod data extracted from Path of Exile 2's own game files via the{' '}
        <a href="https://github.com/rajtik76/poe2-toolkit" className="underline">poe2-toolkit</a>{' '}
        library (MIT). Path of Exile 2 is a trademark of Grinding Gear Games. This project is
        not affiliated with or endorsed by Grinding Gear Games.
      </footer>
    </AppShell>
  );
}
```

Check `src/components/layout/AppShell.tsx` exists with this export before assuming the import path — if the actual export name or path differs, use the real one (this repeats the tree/campaign pages' existing pattern; do not invent a new shell).

- [ ] **Step 6: Write the skills browse page**

```tsx
// src/app/wiki/skills/page.tsx
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { WikiSearch } from '@/components/wiki/WikiSearch';
import { WIKI_DATA_VERSION } from '@/lib/wiki/types';
import type { WikiIndexFile } from '@/lib/wiki/types';

export default async function SkillsPage() {
  const raw = await readFile(
    path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION, 'skill-index.json'),
    'utf8',
  );
  const index = JSON.parse(raw) as WikiIndexFile;
  return (
    <>
      <h1 className="mb-4 font-heading text-2xl text-primary">Skill Gems</h1>
      <WikiSearch entries={index.entries} basePath="/wiki/skills" />
    </>
  );
}
```

- [ ] **Step 7: Write the items browse page**

```tsx
// src/app/wiki/items/page.tsx
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { WikiSearch } from '@/components/wiki/WikiSearch';
import { WIKI_DATA_VERSION } from '@/lib/wiki/types';
import type { WikiIndexFile } from '@/lib/wiki/types';

export default async function ItemsPage() {
  const raw = await readFile(
    path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION, 'item-index.json'),
    'utf8',
  );
  const index = JSON.parse(raw) as WikiIndexFile;
  return (
    <>
      <h1 className="mb-4 font-heading text-2xl text-primary">Items</h1>
      <WikiSearch entries={index.entries} basePath="/wiki/items" />
    </>
  );
}
```

- [ ] **Step 8: Write the mods browse page**

```tsx
// src/app/wiki/mods/page.tsx
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { WikiSearch } from '@/components/wiki/WikiSearch';
import { WIKI_DATA_VERSION } from '@/lib/wiki/types';
import type { WikiIndexFile } from '@/lib/wiki/types';

export default async function ModsPage() {
  const raw = await readFile(
    path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION, 'mod-index.json'),
    'utf8',
  );
  const index = JSON.parse(raw) as WikiIndexFile;
  return (
    <>
      <h1 className="mb-4 font-heading text-2xl text-primary">Mods</h1>
      <WikiSearch entries={index.entries} basePath="/wiki/mods" />
    </>
  );
}
```

- [ ] **Step 9: Write the wiki landing redirect**

```tsx
// src/app/wiki/page.tsx
import { redirect } from 'next/navigation';

export default function WikiHome() {
  redirect('/wiki/items');
}
```

- [ ] **Step 10: Verify, then commit**

```bash
npm run type-check
npm run lint
npm run build
npx vitest run
git add src/app/wiki/ src/components/wiki/
git commit -m "feat(wiki): add browse pages with slim-index fuzzy search"
```

- [ ] **Step 11: Request code review** (BASE = Task 3 commit, HEAD = this commit).

---

## Task 5: Detail pages

**Files:**
- Create: `src/lib/wiki/load.ts`
- Test: `src/lib/wiki/load.test.ts`
- Create: `src/app/wiki/items/[slug]/page.tsx`
- Create: `src/app/wiki/skills/[slug]/page.tsx`
- Create: `src/app/wiki/mods/[slug]/page.tsx`

**Interfaces:**
- Consumes: `WikiItemDetail`, `WikiSkillDetail`, `WikiModDetail`, `WIKI_DATA_VERSION`.
- Produces: `loadDetail(kind, slug)`, `loadAllSlugs(kind)`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/wiki/load.test.ts
import { describe, it, expect } from 'vitest';
import { loadDetail } from './load';

describe('loadDetail', () => {
  it('returns null for an unknown slug instead of throwing', async () => {
    expect(await loadDetail('skill', 'not-a-real-gem')).toBeNull();
  });
  it('rejects a path-traversal slug', async () => {
    expect(await loadDetail('skill', '../../../etc/passwd')).toBeNull();
  });
  it('rejects a path-traversal slug in an item lookup too', async () => {
    expect(await loadDetail('item', '..%2f..%2fetc')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
npx vitest run src/lib/wiki/load.test.ts
```

Expected: FAIL — cannot resolve `./load`.

- [ ] **Step 3: Write the loader**

```ts
// src/lib/wiki/load.ts
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { WIKI_DATA_VERSION } from './types';
import type { WikiItemDetail, WikiSkillDetail, WikiModDetail } from './types';

const ROOT = path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION);
const SAFE_SLUG = /^[a-z0-9-]+$/;

export async function loadDetail(kind: 'item', slug: string): Promise<WikiItemDetail | null>;
export async function loadDetail(kind: 'skill', slug: string): Promise<WikiSkillDetail | null>;
export async function loadDetail(kind: 'mod', slug: string): Promise<WikiModDetail | null>;
export async function loadDetail(
  kind: 'item' | 'skill' | 'mod',
  slug: string,
): Promise<WikiItemDetail | WikiSkillDetail | WikiModDetail | null> {
  if (!SAFE_SLUG.test(slug)) return null;
  try {
    const raw = await readFile(path.join(ROOT, `${kind}s`, `${slug}.json`), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function loadAllSlugs(kind: 'item' | 'skill' | 'mod'): Promise<string[]> {
  try {
    const files = await readdir(path.join(ROOT, `${kind}s`));
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run src/lib/wiki/load.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Write the skill detail page**

```tsx
// src/app/wiki/skills/[slug]/page.tsx
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { loadDetail, loadAllSlugs } from '@/lib/wiki/load';

export const dynamicParams = true;
export const revalidate = 86400;

export async function generateStaticParams() {
  const slugs = await loadAllSlugs('skill');
  return slugs.map((slug) => ({ slug }));
}

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const skill = await loadDetail('skill', slug);
  if (!skill) notFound();

  return (
    <article className="space-y-4">
      <header className="flex items-start gap-3">
        {skill.iconUrl && (
          <Image src={skill.iconUrl} alt="" width={48} height={48} className="rounded border bg-card" unoptimized />
        )}
        <div>
          <h1 className="font-heading text-2xl text-primary">{skill.name}</h1>
          <p className="text-sm text-muted-foreground">{skill.category}</p>
        </div>
      </header>
      {skill.tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {skill.tags.map((tag) => (
            <li key={tag} className="rounded border bg-card px-2 py-0.5 text-xs text-muted-foreground">
              {tag}
            </li>
          ))}
        </ul>
      )}
      {skill.description && <p>{skill.description}</p>}
      {skill.scaling.length > 0 && (
        <div className="space-y-2 border-t pt-3 text-sm">
          {skill.scaling.map((level) => (
            <div key={level.level}>
              <p className="text-muted-foreground">Level {level.level}</p>
              <ul className="space-y-1">
                {level.stats.map((stat) => <li key={stat.text}>{stat.text}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Extracted from Path of Exile 2's game files via poe2-toolkit (MIT).
      </p>
    </article>
  );
}
```

- [ ] **Step 6: Write the item detail page**

```tsx
// src/app/wiki/items/[slug]/page.tsx
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { loadDetail, loadAllSlugs } from '@/lib/wiki/load';

export const dynamicParams = true;
export const revalidate = 86400;

export async function generateStaticParams() {
  const slugs = await loadAllSlugs('item');
  return slugs.map((slug) => ({ slug }));
}

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await loadDetail('item', slug);
  if (!item) notFound();

  const reqs = Object.entries(item.requirements).filter(([, v]) => v > 0);

  return (
    <article className="space-y-4">
      <header className="flex items-start gap-3">
        {item.iconUrl && (
          <Image src={item.iconUrl} alt="" width={48} height={48} className="rounded border bg-card" unoptimized />
        )}
        <div>
          <h1 className="font-heading text-2xl text-primary">{item.name}</h1>
          <p className="text-sm text-muted-foreground">
            {item.itemClass ?? item.category}{item.rarity === 'unique' ? ' — Unique' : ''}
          </p>
        </div>
      </header>
      {reqs.length > 0 && (
        <ul className="space-y-1 text-sm">
          {reqs.map(([key, value]) => (
            <li key={key} className="text-muted-foreground">
              <span className="capitalize">{key}</span>: {value}
            </li>
          ))}
        </ul>
      )}
      {item.armour && (
        <ul className="space-y-1 text-sm">
          {Object.entries(item.armour).filter(([, v]) => v > 0).map(([key, value]) => (
            <li key={key}><span className="capitalize">{key}</span>: {value}</li>
          ))}
        </ul>
      )}
      {item.weapon && (
        <ul className="space-y-1 text-sm">
          <li>Damage: {item.weapon.damageMin}-{item.weapon.damageMax}</li>
          <li>Attack time: {(item.weapon.attackTime / 1000).toFixed(2)}s</li>
        </ul>
      )}
      {item.flavourText && (
        <p className="border-t pt-3 text-sm italic text-muted-foreground">
          {item.flavourText.join(' ')}
        </p>
      )}
      {item.rarity === 'unique' && (
        <p className="border-t pt-3 text-xs text-muted-foreground">
          This item's actual modifier values aren't available yet — see the wiki design doc's
          known limitation on unique items.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Extracted from Path of Exile 2's game files via poe2-toolkit (MIT).
      </p>
    </article>
  );
}
```

Note the explicit unique-mods caveat rendered in the UI — don't drop it; showing a bare unique page with no mod lines and no explanation reads as broken.

- [ ] **Step 7: Write the mod detail page**

```tsx
// src/app/wiki/mods/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { loadDetail, loadAllSlugs } from '@/lib/wiki/load';

export const dynamicParams = true;
export const revalidate = 86400;

export async function generateStaticParams() {
  const slugs = await loadAllSlugs('mod');
  return slugs.map((slug) => ({ slug }));
}

export default async function ModDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mod = await loadDetail('mod', slug);
  if (!mod) notFound();

  return (
    <article className="space-y-4">
      <header>
        <h1 className="font-heading text-2xl text-primary">{mod.name}</h1>
        <p className="text-sm text-muted-foreground">
          {mod.generationType} · Tier {mod.tier ?? '—'} · Item level {mod.level}
        </p>
      </header>
      {mod.stats.length > 0 && (
        <ul className="space-y-1 text-sm">
          {mod.stats.map((stat) => <li key={stat}>{stat}</li>)}
        </ul>
      )}
      {mod.spawnWeights.length > 0 && (
        <div className="border-t pt-3 text-sm">
          <p className="text-muted-foreground">Can roll on:</p>
          <ul className="flex flex-wrap gap-2 pt-1">
            {mod.spawnWeights.filter((w) => w.weight > 0).map((w) => (
              <li key={w.tag} className="rounded border bg-card px-2 py-0.5 text-xs text-muted-foreground">
                {w.tag}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Extracted from Path of Exile 2's game files via poe2-toolkit (MIT).
      </p>
    </article>
  );
}
```

- [ ] **Step 8: Verify build time**

```bash
node -e "const t=Date.now();require('child_process').execSync('npm run build',{stdio:'inherit'});console.log('build ms:', Date.now()-t)"
```

If it exceeds ~5 minutes, `generateStaticParams` needs to return `[]` for one or more kinds (rely on ISR + `dynamicParams: true` instead) — check the entity counts from Task 3 Step 5's real sync output first, don't guess which kind is the culprit.

- [ ] **Step 9: Verify, then commit**

```bash
npm run type-check
npm run lint
npx vitest run
git add src/app/wiki/ src/lib/wiki/load.ts src/lib/wiki/load.test.ts
git commit -m "feat(wiki): add item/skill/mod detail pages with icons and ISR"
```

- [ ] **Step 10: Request code review** (BASE = Task 4 commit, HEAD = this commit).

---

## Task 6: Access gating, nav wiring, CI sync workflow

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/components/layout/ShellChrome.tsx`
- Create: `.github/workflows/sync-wiki.yml`

- [ ] **Step 1: Gate `/wiki` (D1)**

In `src/proxy.ts`, current state (verified this session):

```ts
const PROTECTED_PREFIXES = ['/dashboard', '/characters', '/settings', '/tree', '/campaign']
```

Change to:

```ts
const PROTECTED_PREFIXES = ['/dashboard', '/characters', '/settings', '/tree', '/campaign', '/wiki']
```

- [ ] **Step 2: Flip the nav entry**

Read `src/components/layout/ShellChrome.tsx` first to find the exact current "Soon" treatment for Wiki (matches how Tree/Campaign looked before they shipped — follow that same live-link pattern verbatim, don't invent a new one) and change it to a live `/wiki` link.

- [ ] **Step 3: Write the CI workflow**

```yaml
# .github/workflows/sync-wiki.yml
name: Sync wiki data
on:
  schedule:
    - cron: '0 4 * * 1'   # weekly, Monday 04:00 UTC — patch cadence, not price cadence
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx tsx scripts/sync-wiki.ts
      - uses: peter-evans/create-pull-request@v6
        with:
          commit-message: 'chore(wiki): refresh wiki data'
          title: 'chore(wiki): refresh wiki data'
          branch: chore/wiki-data-refresh
          body: |
            Automated poe2-toolkit GGPK extraction. Review the diff before merging —
            this catches extraction-pipeline bugs or a stale WIKI_PATCH_VERSION before
            they reach users, not vandalism (the source is GGG's own patch server, not
            a community-edited wiki).
```

No `PRICE_SYNC_CONTACT`/secrets needed — unlike the wiki-via-poe2wiki.net version of this plan, `@poe2-toolkit` talks to GGG's patch CDN directly with no custom User-Agent contract to honor.

- [ ] **Step 4: Verify, then commit**

```bash
npm run type-check
npm run lint
npm run build
npx vitest run
git add .github/workflows/sync-wiki.yml src/components/layout/ShellChrome.tsx src/proxy.ts
git commit -m "feat(wiki): gate /wiki, wire nav link, add weekly sync workflow"
```

- [ ] **Step 5: Do NOT trigger the workflow or push to remote yet.** `workflow_dispatch` and any `git push` need Jaycee's explicit go-ahead — this plan's Multi-Session Protocol and the standing safety rules both require it. Flag this as done-locally-not-pushed in the session handoff.

- [ ] **Step 6: Request code review** (BASE = Task 5 commit, HEAD = this commit).

---

## Task 7: Licensing and guardrail doc edits

**Files:**
- Modify: `THIRD-PARTY-NOTICES.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Extend the `@poe2-toolkit` entry in `THIRD-PARTY-NOTICES.md`**

Read the file first (verified this session to contain a `## @poe2-toolkit (tree-core, tree-react)` section, MIT, crediting `rajtik76`). Add a sentence noting the same toolkit now also supplies wiki item/skill/mod data and icons via `item-extractor`/`gem-extractor`/`mod-extractor` — extend the existing section, don't create a second one for the same project.

- [ ] **Step 2: Generalize the GGG-art guardrail in `AGENTS.md`**

Current text (verified this session, line ~52):

> GGG ToS §7i: no scraping cosmetics/store, no GGG or third-party art. All Project Vaal assets are original. The passive tree's use of GGG's sanctioned tree-export sprites is a documented **scoped exception** (plan §12/§15) — do not generalize it to other features.

Replace with wording that names wiki icons as a second explicit exception, still bounded — not a general license. Example direction (write the actual final wording to fit the surrounding paragraph, don't paste this verbatim without reading context):

> GGG ToS §7i: no scraping cosmetics/store, no GGG or third-party art beyond two named, scoped exceptions — the passive tree's GGG-sanctioned tree-export sprites, and wiki item/gem icons extracted via the same MIT `@poe2-toolkit` library (design: `docs/superpowers/specs/2026-08-16-wiki-design.md`). Both exceptions are sourced only through that toolkit's official patch-server extraction; do not use this as license for any other GGG art source.

- [ ] **Step 3: Verify, then commit**

```bash
npm run type-check
npm run lint
git add THIRD-PARTY-NOTICES.md AGENTS.md
git commit -m "docs: extend GGG-art guardrail to cover wiki icons, credit poe2-toolkit for wiki data"
```

- [ ] **Step 4: Flag the main plan-doc update as unresolved, don't guess it**

The original wiki-feature plan's Task 7 called for editing `poe2-console-hub-plan.md` (§4 wiki source, §12 decisions, §13 open items). This session confirmed no file exists at that exact path — the closest match is `docs/superpowers/plans/poe2-console-hub-plan7_12_2026.md`, a dated file, and the repo's actual `AGENTS.md` currently names no "source of truth" doc at all (that pointer only exists in an unreviewed `CLAUDE.md` draft in Jaycee's Downloads folder, not yet adopted into the repo). **Do not edit either file without Jaycee confirming which one is actually current** — this is exactly the kind of ambiguity `executing-plans` says to stop on rather than guess through.

- [ ] **Step 5: Request final code review** (BASE = `origin/main`, HEAD = branch tip) before merge, per `requesting-code-review`.

---

## Failure Protocol

Same as the original plan: invoke `systematic-debugging` before touching anything on any failure. Root cause first, one hypothesis at a time, stop after 3 failed fixes and raise it.

**Likely failure points, ranked:**
- Task 1 Step 8: `pathofexile-dat` table/column typos vs. the real schema — re-check against the recon doc's verbatim config, don't guess corrections.
- Task 3: icon key mismatch (`ddsPathToIconKey` producing a key not present in `icons.icons`) — log the actual keys present and compare, don't assume the transform is right.
- Task 5 Step 8: build time — apply the `generateStaticParams: []` fallback per real measured counts, not a guess.

## Self-Review Notes

- **Spec coverage:** every section of `docs/superpowers/specs/2026-08-16-wiki-design.md` maps to a task — §1/§2 → Task 3, §3 → Tasks 1–2, §4 → Task 3, §5 → Tasks 4–5, §6 → Task 6, §7 → Task 7. The "known limitation" (unique mods) is explicitly not implemented anywhere — correct, since the data doesn't exist in this pipeline; Task 5 Step 6 renders an explicit in-UI note instead of a silent gap.
- **Type consistency:** `WikiItemDetail`/`WikiSkillDetail`/`WikiModDetail` field names match between Task 1's type definitions, Task 2's normalize functions, and Task 5's detail pages (checked `item.armour`/`item.weapon`/`item.requirements`, `skill.scaling[].stats[].text`, `mod.spawnWeights[].tag` usages against the Task 1 interfaces). `loadDetail(kind, slug)` overloads in Task 5 match the three kinds defined in Task 1.
- **Known soft spot:** Task 1 Step 7's fixture-capture script and Task 3's sync script both assume `extractItems`/`extractGems`/`extractMods` behave exactly as their `.d.ts` signatures describe (verified by reading the shipped declaration files, not by running them against live data before this plan was written). Task 1 Steps 8–9 are where that assumption gets its first real test — if the real output shape differs, update the recon doc and this plan's Task 2 code to match reality, not the other way around.
