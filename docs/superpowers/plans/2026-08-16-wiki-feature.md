# Wiki Feature Implementation Plan

> **For agentic workers:** This plan spans multiple sessions. Read the **Skills Contract** and **Multi-Session Protocol** sections in full before Task 0. Steps use checkbox (`- [ ]`) syntax — the checkboxes are the progress ledger across sessions. Never mark a box you did not personally verify.
>
> **Save to:** `docs/superpowers/plans/2026-08-16-wiki-feature.md`

**Goal:** Ship a searchable PoE2 item + skill-gem wiki at `/wiki`, sourced from poe2wiki.net via a scheduled sync into versioned static JSON, with a slim mobile-first search index.

**Architecture:** A Node sync script queries poe2wiki.net's MediaWiki API, normalizes results, and emits two artifact tiers per entity type: a **slim search index** (name/slug/category/tags only — what a phone downloads to search) and **per-entity detail files** (fetched only when a detail page opens). Browse pages Fuse-search the slim index; detail pages are ISR-rendered from detail files. No Supabase table — this is read-only reference data with no RLS, per-user writes, or joins.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Fuse.js, vitest, GitHub Actions. Repo `C:\Dev\project-vaal`, alias `@/*` → `src/*`. Shell is **PowerShell**.

---

## Skills Contract

Skills are **not** read with file tools — invoke them through the `Skill` tool so they activate properly. Announce each invocation: *"Using [skill] to [purpose]."*

### Mandatory skills, by trigger

| When | Skill | Non-negotiable rule it carries |
|---|---|---|
| Start of every session on this plan | `using-superpowers` | If there's even a 1% chance a skill applies, invoke it. Process skills before implementation skills. |
| Resolving Decision Gates D1–D5 (before Task 1) | `brainstorming` | **HARD GATE** — no code, no scaffolding, no implementation skill until a design is presented and the user approves it. Terminal state is `writing-plans`, not implementation. |
| Loading and running this plan each session | `executing-plans` | Review the plan critically first; raise concerns before starting; stop when blocked rather than guessing; **never implement on `main` without explicit consent**. |
| Every task that writes production code (Tasks 1–6) | `test-driven-development` | **Iron Law: no production code without a failing test first.** Wrote code before the test? Delete it — delete means delete, not "keep as reference." Must *watch* RED fail for the right reason. |
| Before any completion/success claim, commit, or PR (every task) | `verification-before-completion` | **No completion claims without fresh verification evidence.** If you haven't run the command in this message, you cannot claim it passes. Applies to paraphrases and implications of success, not just the literal words. |
| Any test failure, bug, or unexpected behavior | `systematic-debugging` | **No fixes without root-cause investigation first.** Four phases in order. After 3 failed fixes: stop and question the architecture — do not attempt fix #4. |
| End of each task; before merging | `requesting-code-review` | Dispatch a reviewer subagent with `BASE_SHA`/`HEAD_SHA`. Fix Critical immediately, Important before proceeding. |

### Situationally useful

- **`frontend-design`** — Tasks 4 and 5 only, and **scoped**: consult it for component composition and hierarchy, but plan §15's locked token system overrides any styling advice. Aged gold is the sole lead accent; no hard-coded hex; `font-heading`/`font-sans` only. Do not let a "distinctive design direction" pull this feature away from the shipped app chrome.
- **`engineering:testing-strategy`** — useful when deciding *what* to test in Task 3's validation layer. Where it conflicts with `test-driven-development`, the user-installed skill wins (it's rigid; the plugin is advisory).
- **`engineering:documentation`** — optional aid for Task 0's recon doc and Task 7's plan-doc edits.

### Explicitly DO NOT use

- **`brightdata-plugin:*`** (scrape, scraper-builder, bright-data-mcp, brightdata-cli, brightdata-proxy, etc.). These exist and would technically defeat poe2wiki.net's bot protection. **That is exactly why they're off-limits here.** If Task 0 finds `api.php` is gated, the correct response is to contact the wiki operators or drop the source — not to route around it with residential proxies. Reaching for these skills to "unblock" Task 0 is a plan violation, not a clever workaround.
- **`web-artifacts-builder`** — this is a Next.js repo, not a claude.ai artifact.
- **`data:*`** analysis skills — the sync validation is code with tests, not an analysis deliverable.

### Known gaps — skills referenced but NOT installed

These are named as "REQUIRED SUB-SKILL" by installed skills but are absent. Do not stall trying to load them; use the fallback.

| Missing skill | Referenced by | Fallback |
|---|---|---|
| `subagent-driven-development` | `writing-plans` | Use `executing-plans` instead, with `requesting-code-review` dispatched manually after each task. |
| `using-git-worktrees` | `executing-plans` | Use the plain feature branch in the Multi-Session Protocol below. |
| `finishing-a-development-branch` | `executing-plans` | Use the merge procedure in the Multi-Session Protocol below (Option A merge, no squash). |

---

## Step Zero: Reassess This Plan's Skill Choices

**Do this immediately after reading this file, before Task 0 and before the Decision Gates.**

This Skills Contract was authored in a **different environment** — a Claude.ai Project session with its own installed skill set. Your environment is Claude Code, with its own plugins, marketplace installs, and possibly a complete `superpowers` install that fills the gaps listed above. **The contract above is a starting hypothesis, not a finding.** Treat it the way Task 0 treats the Cargo schema: verify against what's actually there.

- [ ] **Step 0.1: Inventory what you actually have.** List every available skill and plugin in this environment. Compare against the Skills Contract. Note anything present here that wasn't available to the author, and anything the contract names that you cannot load.

- [ ] **Step 0.2: Look specifically for skills covering these capability gaps.** The author had nothing well-matched to these, and made do:

| Gap | What the plan currently does | What would be better if a skill exists |
|---|---|---|
| MediaWiki / Cargo API client work | Hand-rolled `fetchAll` with manual pagination | A skill covering MediaWiki APIs, Cargo queries, or generic paginated-API client patterns |
| Next.js App Router specifics (ISR, `generateStaticParams`, build-time budgets) | Threshold heuristics measured in Task 0 | A Next.js or React framework skill with real guidance on ISR-vs-SSG at scale |
| Accessibility | Ad-hoc `aria-label` on the search input | A dedicated a11y skill — plan §15's accessibility floor deserves better than my spot checks |
| Licensing / CC compliance | A hand-written LICENSE.md and a footer | Any compliance or licensing skill |
| GitHub Actions workflow authoring | A hand-written YAML file | A CI/CD or workflow-authoring skill |
| Data-artifact schema design | Interfaces invented in Task 1 | A schema-design or data-modeling skill |

- [ ] **Step 0.3: Also reassess whether a better *process* skill applies.** If `subagent-driven-development` is installed here, prefer it over `executing-plans` — `writing-plans` names it as the recommended path, and per-task subagents with fresh context suit a plan this long. If `using-git-worktrees` and `finishing-a-development-branch` are installed, use them instead of the hand-written fallbacks in the Multi-Session Protocol.

- [ ] **Step 0.4: Report proposed changes to Jaycee before acting on them.** Present: what you'd add, what you'd substitute, what you'd drop, and why. Do not silently swap skills — the contract's rules (TDD Iron Law, verification-before-claims, root-cause-before-fixes) are the plan's spine, and a substitution that quietly drops one of them changes the plan's guarantees.

**Two things Step Zero cannot override:**

1. **The DO-NOT list stands regardless of what you find.** A better-looking scraping or proxy skill is still off-limits for defeating poe2wiki.net's bot protection. "I found a more capable tool" is not a reason to cross that line.
2. **`brainstorming`'s hard gate stands.** Finding a promising implementation skill is not permission to start implementing. D1–D5 close first.

If your inventory finds nothing better, say so plainly and proceed with the contract as written. A null result here is a real result — record it in the first session handoff so the next session doesn't redo the survey.

---

## Multi-Session Protocol

This plan will not finish in one session. Treat continuity as part of the work.

**Branch (once, at the very start):**

```powershell
cd C:\Dev\project-vaal
git checkout main
git pull
git checkout -b feature/wiki-m1
```

Never commit this work to `main`. Every task commits to `feature/wiki-m1`.

**Start of each session:**
1. Invoke `using-superpowers`, then `executing-plans`.
2. Re-read this plan file. Find the first unchecked box — that's the resume point.
3. Read the most recent handoff in `docs/superpowers/handoffs/`.
4. Confirm a clean baseline before writing anything: `npm run type-check` then `npm run lint`. If the branch is already red, fix that first — do not stack new work on a broken baseline.

**End of each session:**
1. Commit all completed work.
2. Write `docs/superpowers/handoffs/YYYY-MM-DD-wiki-<n>.md` containing: last completed task and step, current branch and HEAD SHA, any Task 0 findings that changed later tasks, open blockers, and the exact next action.
3. Commit the handoff.
4. Report status to Jaycee with evidence (per `verification-before-completion`) — never "should be working."

**When blocked:** stop and ask. `executing-plans` is explicit that guessing through a blocker is the failure mode. Blockers that warrant stopping: bot-gated API, Cargo schema absent, entity counts blowing past the thresholds in Task 0, or any decision gate reopening.

**Finishing (after Task 7):**

```powershell
npm run type-check ; npm run lint ; npm run build ; npx vitest run
git checkout main
git merge --no-ff feature/wiki-m1   # Option A: real merge commit, no squash
```

Do not merge until `requesting-code-review` has returned with no unresolved Critical or Important issues.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Mobile-first is binding.** No browse page may require downloading the full detail dataset.
- **No DPS calculation** or derived combat math — display source text only (plan §5).
- **No GGG or third-party art** (plan §15 / GGG ToS §7i). Text-only for M1 — see gate D3.
- **CC BY-NC-SA attribution required**: every detail page links its `sourceUrl`; the wiki layout carries a license notice.
- **Token-driven styling only**: `bg-card`, `text-muted-foreground`, `bg-primary`, `border`, `text-destructive`, `font-heading`, `font-sans`. Never hard-coded hex.
- **Verification gates before every commit**: `npm run type-check` → `npm run lint` → `npm run build`. State actual results, not expectations.
- **Outbound requests send a descriptive User-Agent with contact info**, following the existing `poe2scout.ts` `userAgent()` pattern — version read from `package.json`, never hardcoded (it has already drifted once in this codebase).
- **Never bypass bot protection.** See the Skills Contract.
- PowerShell commands, backslash paths.

---

## Decision Gates — resolve BEFORE Task 0 Step 6

**Invoke the `brainstorming` skill to work these.** They are design decisions, not implementation details, and its HARD GATE applies: present a design, get Jaycee's approval, write it to `docs/superpowers/specs/2026-08-16-wiki-design.md`, then return here. Ask one question at a time.

| ID | Decision | Why it blocks | Default if unanswered |
|---|---|---|---|
| **D1** | **Is `/wiki` public or account-gated?** Plan §2 ("SSG for wiki pages") and §7 (wiki sits outside `(dashboard)`) imply public. Plan §12 says "Anonymous access limited to the Prices tab." **These contradict.** | Determines whether `/wiki` joins `PROTECTED_PREFIXES` in `src/proxy.ts`, and whether SSG/SEO is meaningful at all. | **Public.** SSG behind auth is pointless. Requires a §12 edit in Task 7. |
| **D2** | **poe2db.tw scraping** (plan §13, open since before this plan). No public API found; no scraping-permission ToS located — only a privacy policy. | Mods/affix-tiers/weights exist only on poe2db.tw. | **Out of scope for M1.** Ship items + skills; `/wiki/mods` renders "Soon". |
| **D3** | **Icons/art.** Item and gem icons are GGG art. The tree's GGG sprites are a *scoped exception* (§12) justified by that export being GGG-sanctioned. No equivalent sanction covers wiki-sourced item icons. | Changes sync payload, detail-page design, and §15. | **Text-only M1.** Revisit as its own scoped-exception decision. |
| **D4** | **CC BY-NC-SA share-alike** on derived JSON committed to a public repo — the normalized data is a derivative work. | Affects repo licensing and whether artifacts can live in the public repo. | Ship `public/data/wiki/LICENSE.md` (Task 3 Step 6). Confirm before merge. |
| **D5** | **Sequencing.** The locked order puts Campaign Tracker before Wiki, and the `passive_state` schema reconciliation (§13) is the active blocker. | This plan jumps that order. | Confirm intentional, or shelve until Campaign Tracker ships. |

---

## Task 0: Reconnaissance — measure the source before building against it

**This task writes no production code**, so the TDD Iron Law does not bind it — `test-driven-development` explicitly permits throwaway exploration provided the exploration is discarded. It is discarded in Task 1 Step 6.

Its output parameterizes Tasks 2–6. An earlier draft of this plan assumed a Cargo/Semantic-MediaWiki schema based on 2016-era evidence about a *different* wiki. That assumption is unverified and must not reach code.

**Files:**
- Create: `scripts/wiki/recon.mjs` (throwaway — deleted in Task 1)
- Create: `docs/superpowers/specs/2026-08-16-wiki-source-recon.md` (permanent)

**Interfaces:**
- Consumes: nothing.
- Produces: recorded values consumed by Tasks 2 and 5 — exact Cargo table names, exact column names, per-kind entity counts, and the Task 5 SSG/ISR branch.

- [ ] **Step 1: Confirm the API is reachable and enumerate extensions**

```powershell
$ua = "ProjectVaal/0.2.0 (+https://www.project-vaal.xyz; contact: $env:PRICE_SYNC_CONTACT)"
curl.exe -A $ua "https://www.poe2wiki.net/api.php?action=query&meta=siteinfo&siprop=general%7Cextensions&format=json" -o recon-siteinfo.json
Get-Content recon-siteinfo.json -TotalCount 5
```

Expected: JSON containing `query.general.sitename` and an `extensions` array.

**STOP CONDITION:** if this returns HTML, a challenge page, or 403, the API is bot-gated. Record it and halt the plan. Do not reach for Bright Data or any proxy skill — see the Skills Contract. Escalate to Jaycee for a contact-the-operators decision.

- [ ] **Step 2: Record which structured-data extension is installed**

Search the extensions array for `Cargo` and `SemanticMediaWiki`. Record the finding verbatim. This picks the extraction strategy:

- **Cargo present** → `action=cargoquery` against declared tables. Structured, paginated, reliable.
- **SMW only** → `action=ask`.
- **Neither** → `action=query&generator=categorymembers` plus template/wikitext parsing. Markedly more fragile and roughly doubles Task 2. **Record this as a scope change and tell Jaycee — do not absorb it silently.**

- [ ] **Step 3: If Cargo is present, enumerate tables and columns**

```powershell
curl.exe -A $ua "https://www.poe2wiki.net/api.php?action=cargoquery&tables=_pageData&fields=_pageName&limit=5&format=json" -o recon-cargo.json
Get-Content recon-cargo.json
```

Then open `https://www.poe2wiki.net/wiki/Special:CargoTables` in a browser and record table names, row counts, and column names for anything item-, skill-, or mod-shaped. **Paste the actual names into the recon doc** — Task 2 substitutes them verbatim.

- [ ] **Step 4: Measure entity counts** — drives the Task 5 branch

Record: item bases, unique items, active skill gems, support gems.

Thresholds Task 5 applies:
- **< 500 per type** → full SSG via `generateStaticParams`.
- **500–3000** → `generateStaticParams` for a top-N subset plus `dynamicParams: true` with ISR.
- **> 3000** → ISR only; `generateStaticParams` returns `[]`.

- [ ] **Step 5: Measure payload size**

Fetch one representative entity's structured data. Record its serialized JSON byte size. Estimate the detail tier as `size × count`, and the slim index at roughly 120 bytes/entity.

**Gate:** if the estimated *slim index* exceeds ~500KB gzipped, client-side Fuse is not mobile-viable and needs a server-side search route instead. Record the decision and raise it — this changes Task 4.

- [ ] **Step 6: Confirm D1–D5 are closed, then write the recon doc and commit**

The doc must contain: API reachability, extension list, exact Cargo table/column names (or the fallback decision), entity counts, size estimates, the resulting Task 5 branch, and the D1–D5 resolutions.

```powershell
git add docs\superpowers\specs\2026-08-16-wiki-source-recon.md
git commit -m "docs: record poe2wiki.net source reconnaissance findings"
```

---

## Task 1: Types and fixtures

**Files:**
- Create: `src/lib/wiki/types.ts`
- Create: `src/lib/wiki/__fixtures__/sample-cargo-response.json`
- Test: `src/lib/wiki/types.test.ts`
- Delete: `scripts/wiki/recon.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `WikiEntryKind`, `WikiSearchEntry`, `WikiIndexFile`, `WikiItemDetail`, `WikiSkillDetail`, `isWikiSearchEntry()`, `WIKI_DATA_VERSION`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/wiki/types.test.ts
import { describe, it, expect } from 'vitest';
import { isWikiSearchEntry, WIKI_DATA_VERSION } from './types';

describe('WikiSearchEntry', () => {
  it('accepts a well-formed entry', () => {
    expect(isWikiSearchEntry({
      slug: 'shockburst-rounds',
      name: 'Shockburst Rounds',
      kind: 'skill',
      category: 'Active Skill Gem',
      tags: ['Lightning', 'Attack'],
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
});
```

- [ ] **Step 2: Run the test and watch it fail for the right reason**

```powershell
npx vitest run src/lib/wiki/types.test.ts
```

Expected: FAIL — cannot resolve `./types`. Per `test-driven-development`, confirm it fails because the module is missing, not because of a typo in the test.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/lib/wiki/types.ts

/**
 * Version stamp for the wiki data artifacts. Unlike the tree data (which
 * inherits GGG's export version) the wiki has no natural upstream version,
 * so we stamp the sync date. Used as the path segment under
 * public/data/wiki/<version>/ for cache-busting.
 */
export const WIKI_DATA_VERSION = '2026-08-16';

export type WikiEntryKind = 'item' | 'skill';

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
  /** poe2wiki.net page URL — REQUIRED for CC BY-NC-SA attribution. */
  sourceUrl: string;
  lastSynced: string;
}

export interface WikiItemDetail extends WikiDetailBase {
  kind: 'item';
  itemClass: string;
  isUnique: boolean;
  requirements: {
    level?: number;
    strength?: number;
    dexterity?: number;
    intelligence?: number;
  };
  implicitMods: string[];
  explicitMods: string[];
  flavourText?: string;
}

export interface WikiSkillDetail extends WikiDetailBase {
  kind: 'skill';
  gemType: 'active' | 'support';
  /**
   * GGG metadata id, e.g. "Metadata/Items/Gems/SkillGemLightningSpear".
   * Populated now although nothing reads it yet: the Full Builds milestone
   * needs it to match .build.json skill entries, and back-filling later
   * means a second full sync pass over the same source.
   */
  metadataId?: string;
  tags: string[];
  description: string;
  statText: string[];
}

const KINDS: readonly string[] = ['item', 'skill'];

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

- [ ] **Step 4: Run the test and watch it pass**

```powershell
npx vitest run src/lib/wiki/types.test.ts
```

Expected: PASS, 4 tests, no warnings in output.

- [ ] **Step 5: Save a real fixture**

Copy an **actual** API response captured in Task 0 into `src/lib/wiki/__fixtures__/sample-cargo-response.json`. Real data only — invented fixtures hide exactly the shape mismatches this file exists to catch.

- [ ] **Step 6: Verify, then commit**

Run each command and read its output before claiming anything (`verification-before-completion`):

```powershell
npm run type-check
npm run lint
npx vitest run
git add src\lib\wiki\
git rm scripts\wiki\recon.mjs
git commit -m "feat(wiki): add wiki data types and source fixture"
```

- [ ] **Step 7: Request code review**

Invoke `requesting-code-review` with `BASE_SHA` = the recon-doc commit, `HEAD_SHA` = this commit, `PLAN_OR_REQUIREMENTS` = Task 1 of this plan.

---

## Task 2: Source client — fetch and normalize

**Files:**
- Create: `src/lib/wiki/source.ts`
- Test: `src/lib/wiki/source.test.ts`

**Interfaces:**
- Consumes: `WikiItemDetail`, `WikiSkillDetail`, `WikiSearchEntry` from `@/lib/wiki/types`.
- Produces:
  - `slugify(name: string): string`
  - `normalizeItem(raw: Record<string, unknown>): WikiItemDetail`
  - `normalizeSkill(raw: Record<string, unknown>): WikiSkillDetail`
  - `toSearchEntry(detail: WikiItemDetail | WikiSkillDetail): WikiSearchEntry`
  - `fetchAll(kind: 'item' | 'skill'): Promise<Array<Record<string, unknown>>>`

> **Substitute the exact Cargo table and column names recorded in Task 0** wherever this task shows placeholder field names. If Task 0 found no Cargo, implement the wikitext-parsing fallback and expand this task accordingly — after telling Jaycee about the scope change.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/wiki/source.test.ts
import { describe, it, expect } from 'vitest';
import { slugify, normalizeSkill, toSearchEntry } from './source';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Shockburst Rounds')).toBe('shockburst-rounds');
  });
  it('strips apostrophes rather than encoding them', () => {
    expect(slugify("Falconer's Jacket")).toBe('falconers-jacket');
  });
  it('collapses runs of separators', () => {
    expect(slugify('Orb  of --Storms')).toBe('orb-of-storms');
  });
  it('trims leading and trailing hyphens', () => {
    expect(slugify(' -Blink- ')).toBe('blink');
  });
});

describe('normalizeSkill', () => {
  it('splits a pipe-delimited tag list', () => {
    const result = normalizeSkill({
      name: 'Lightning Spear',
      tags: 'Lightning|Attack|Projectile',
      description: 'Throws a spear.',
      gemType: 'active',
    });
    expect(result.tags).toEqual(['Lightning', 'Attack', 'Projectile']);
  });

  it('defaults missing tags to an empty array, not undefined', () => {
    expect(normalizeSkill({ name: 'Blink', gemType: 'active' }).tags).toEqual([]);
  });

  it('always sets a sourceUrl for attribution', () => {
    expect(normalizeSkill({ name: 'Blink', gemType: 'active' }).sourceUrl)
      .toBe('https://www.poe2wiki.net/wiki/Blink');
  });

  it('throws on a missing name rather than emitting a nameless entry', () => {
    expect(() => normalizeSkill({ gemType: 'active' })).toThrow(/name/i);
  });
});

describe('toSearchEntry', () => {
  it('drops detail-only fields from the slim entry', () => {
    const entry = toSearchEntry(normalizeSkill({
      name: 'Blink', gemType: 'active', description: 'A very long description.',
    }));
    expect(Object.keys(entry).sort()).toEqual(
      ['category', 'kind', 'name', 'slug', 'tags'],
    );
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

```powershell
npx vitest run src/lib/wiki/source.test.ts
```

Expected: FAIL — cannot resolve `./source`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/wiki/source.ts
import pkg from '../../../package.json';
import type {
  WikiItemDetail, WikiSkillDetail, WikiSearchEntry,
} from './types';

const WIKI_BASE = 'https://www.poe2wiki.net';
const API = `${WIKI_BASE}/api.php`;

/** Mirrors poe2scout.ts userAgent(): version read from package.json so it cannot drift. */
function userAgent(): string {
  const contact = process.env.PRICE_SYNC_CONTACT ?? 'unknown';
  return `ProjectVaal/${pkg.version} (+https://www.project-vaal.xyz; contact: ${contact})`;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function requireString(raw: Record<string, unknown>, field: string): string {
  const value = raw[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`wiki source: missing required field "${field}"`);
  }
  return value;
}

function splitList(value: unknown): string[] {
  if (typeof value !== 'string' || value.length === 0) return [];
  return value.split('|').map((s) => s.trim()).filter(Boolean);
}

function pageUrl(name: string): string {
  return `${WIKI_BASE}/wiki/${name.replace(/ /g, '_')}`;
}

export function normalizeSkill(raw: Record<string, unknown>): WikiSkillDetail {
  const name = requireString(raw, 'name');
  const gemType = raw.gemType === 'support' ? 'support' : 'active';
  return {
    kind: 'skill',
    slug: slugify(name),
    name,
    category: gemType === 'support' ? 'Support Gem' : 'Active Skill Gem',
    gemType,
    metadataId: typeof raw.metadataId === 'string' ? raw.metadataId : undefined,
    tags: splitList(raw.tags),
    description: typeof raw.description === 'string' ? raw.description : '',
    statText: splitList(raw.statText),
    sourceUrl: pageUrl(name),
    lastSynced: new Date().toISOString(),
  };
}

export function normalizeItem(raw: Record<string, unknown>): WikiItemDetail {
  const name = requireString(raw, 'name');
  const itemClass = typeof raw.itemClass === 'string' ? raw.itemClass : 'Unknown';
  const num = (field: string): number | undefined => {
    const v = raw[field];
    const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  return {
    kind: 'item',
    slug: slugify(name),
    name,
    category: itemClass,
    itemClass,
    isUnique: raw.rarity === 'Unique',
    requirements: {
      level: num('requiredLevel'),
      strength: num('requiredStrength'),
      dexterity: num('requiredDexterity'),
      intelligence: num('requiredIntelligence'),
    },
    implicitMods: splitList(raw.implicitMods),
    explicitMods: splitList(raw.explicitMods),
    flavourText: typeof raw.flavourText === 'string' ? raw.flavourText : undefined,
    sourceUrl: pageUrl(name),
    lastSynced: new Date().toISOString(),
  };
}

export function toSearchEntry(
  detail: WikiItemDetail | WikiSkillDetail,
): WikiSearchEntry {
  return {
    slug: detail.slug,
    name: detail.name,
    kind: detail.kind,
    category: detail.category,
    tags: detail.kind === 'skill' ? detail.tags : [detail.itemClass],
  };
}

/**
 * Paginated Cargo fetch. Serial, not parallel — MediaWiki etiquette is to wait
 * for one request to finish before issuing the next rather than fan out.
 */
export async function fetchAll(
  kind: 'item' | 'skill',
): Promise<Array<Record<string, unknown>>> {
  // TABLE and FIELDS MUST be replaced with the exact values recorded in Task 0.
  const TABLE = kind === 'item' ? 'items' : 'skill_gems';
  const FIELDS = kind === 'item'
    ? 'name,itemClass,rarity,requiredLevel,requiredStrength,requiredDexterity,requiredIntelligence,implicitMods,explicitMods,flavourText'
    : 'name,gemType,metadataId,tags,description,statText';

  const out: Array<Record<string, unknown>> = [];
  const limit = 500;
  let offset = 0;

  for (;;) {
    const url =
      `${API}?action=cargoquery&format=json&tables=${TABLE}` +
      `&fields=${encodeURIComponent(FIELDS)}&limit=${limit}&offset=${offset}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': userAgent(), 'Accept-Encoding': 'gzip' },
    });
    if (!res.ok) {
      throw new Error(`wiki source: ${res.status} ${res.statusText} for ${TABLE}`);
    }
    const body = (await res.json()) as {
      cargoquery?: Array<{ title: Record<string, unknown> }>;
    };
    const batch = body.cargoquery ?? [];
    out.push(...batch.map((row) => row.title));

    if (batch.length < limit) break;
    offset += limit;
    await new Promise((r) => setTimeout(r, 250)); // be a polite client
  }

  return out;
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```powershell
npx vitest run src/lib/wiki/source.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Verify, then commit**

```powershell
npm run type-check
npm run lint
npx vitest run
git add src\lib\wiki\source.ts src\lib\wiki\source.test.ts
git commit -m "feat(wiki): add poe2wiki source client and normalizers"
```

- [ ] **Step 6: Request code review** (`requesting-code-review`, BASE = Task 1 commit, HEAD = this commit).

---

## Task 3: Sync script with truncation guards

**Files:**
- Create: `scripts/sync-wiki.ts`
- Test: `scripts/sync-wiki.test.ts`
- Create: `public/data/wiki/LICENSE.md`

**Interfaces:**
- Consumes: `fetchAll`, `normalizeItem`, `normalizeSkill`, `toSearchEntry` from `@/lib/wiki/source`; `WIKI_DATA_VERSION`, `WikiSearchEntry` from `@/lib/wiki/types`.
- Produces: `validateSyncResult(entries: WikiSearchEntry[], previousCount: number): void`; writes `public/data/wiki/<version>/{item,skill}-index.json` and `.../{items,skills}/<slug>.json`.

**Why validation is load-bearing:** wiki content is community-edited, unlike poe2scout's API. This codebase has already been bitten twice by silent truncation (PostgREST's 1000-row default; poe2scout's `PerPage` pagination hiding Exalted Orb on page 2). A sync that "succeeds" while returning 40% of the data is the expected failure mode here, not an edge case.

- [ ] **Step 1: Write the failing tests**

```ts
// scripts/sync-wiki.test.ts
import { describe, it, expect } from 'vitest';
import { validateSyncResult } from './sync-wiki';

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
```

- [ ] **Step 2: Run the tests and watch them fail**

```powershell
npx vitest run scripts/sync-wiki.test.ts
```

Expected: FAIL — cannot resolve `./sync-wiki`.

- [ ] **Step 3: Write the implementation**

```ts
// scripts/sync-wiki.ts
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  fetchAll, normalizeItem, normalizeSkill, toSearchEntry,
} from '../src/lib/wiki/source';
import { WIKI_DATA_VERSION } from '../src/lib/wiki/types';
import type {
  WikiSearchEntry, WikiItemDetail, WikiSkillDetail,
} from '../src/lib/wiki/types';

const OUT_DIR = path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION);

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
      throw new Error(`wiki sync: duplicate slug "${e.slug}"`);
    }
    slugs.add(e.slug);
  }
  if (previousCount > 0 && entries.length < previousCount * 0.9) {
    throw new Error(
      `wiki sync: count dropped from ${previousCount} to ${entries.length} ` +
      `(>10%) — likely truncation, refusing to write`,
    );
  }
}

async function previousCount(kind: string): Promise<number> {
  try {
    const raw = await readFile(path.join(OUT_DIR, `${kind}-index.json`), 'utf8');
    return (JSON.parse(raw).entries as unknown[]).length;
  } catch {
    return 0;
  }
}

async function syncKind(kind: 'item' | 'skill'): Promise<number> {
  const raws = await fetchAll(kind);
  const details: Array<WikiItemDetail | WikiSkillDetail> = raws.map((r) =>
    kind === 'item' ? normalizeItem(r) : normalizeSkill(r),
  );
  const entries = details.map(toSearchEntry);

  validateSyncResult(entries, await previousCount(kind));

  await mkdir(path.join(OUT_DIR, `${kind}s`), { recursive: true });
  await writeFile(
    path.join(OUT_DIR, `${kind}-index.json`),
    JSON.stringify({
      version: WIKI_DATA_VERSION,
      generatedAt: new Date().toISOString(),
      entries,
    }),
  );
  for (const detail of details) {
    await writeFile(
      path.join(OUT_DIR, `${kind}s`, `${detail.slug}.json`),
      JSON.stringify(detail),
    );
  }
  return entries.length;
}

async function main(): Promise<void> {
  const items = await syncKind('item');
  const skills = await syncKind('skill');
  console.log(`wiki sync complete: ${items} items, ${skills} skills → ${OUT_DIR}`);
}

if (process.argv[1]?.includes('sync-wiki')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the tests and watch them pass**

```powershell
npx vitest run scripts/sync-wiki.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Run the sync for real and check it against Task 0's estimates**

```powershell
npx tsx scripts/sync-wiki.ts
Get-ChildItem public\data\wiki\2026-08-16 -Recurse -File | Measure-Object -Property Length -Sum
Get-Item public\data\wiki\2026-08-16\skill-index.json | Select-Object Length
```

Compare against the Task 0 Step 5 estimates. If the slim index exceeds ~500KB, stop — the search strategy needs revisiting before Task 4.

- [ ] **Step 6: Add the attribution file**

```powershell
@"
# Wiki data attribution

Content in this directory is derived from the Path of Exile 2 Wiki
(https://www.poe2wiki.net), licensed under CC BY-NC-SA.

Derived works — normalized JSON generated by scripts/sync-wiki.ts — are
redistributed under the same license. Each entry retains a ``sourceUrl``
field linking to its origin page.

Path of Exile 2 is a trademark of Grinding Gear Games. This project is
not affiliated with or endorsed by Grinding Gear Games.
"@ | Out-File -Encoding utf8 public\data\wiki\LICENSE.md
```

- [ ] **Step 7: Verify, then commit**

```powershell
npm run type-check
npm run lint
npx vitest run
git add scripts\sync-wiki.ts scripts\sync-wiki.test.ts public\data\wiki\
git commit -m "feat(wiki): add sync script with truncation guards and attribution"
```

- [ ] **Step 8: Request code review** (BASE = Task 2 commit, HEAD = this commit).

---

## Task 4: Browse pages with slim-index search

Consult `frontend-design` for composition here — but §15's tokens win on any styling conflict.

**Files:**
- Create: `src/app/wiki/layout.tsx`
- Create: `src/app/wiki/page.tsx`
- Create: `src/app/wiki/items/page.tsx`
- Create: `src/app/wiki/skills/page.tsx`
- Create: `src/components/wiki/WikiSearch.tsx`
- Test: `src/components/wiki/WikiSearch.test.tsx`

**Interfaces:**
- Consumes: `WikiSearchEntry`, `WikiIndexFile`, `WIKI_DATA_VERSION`.
- Produces: `filterEntries(entries, query)`, `<WikiSearch entries={...} basePath={...} />`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/wiki/WikiSearch.test.tsx
import { describe, it, expect } from 'vitest';
import { filterEntries } from './WikiSearch';

const entries = [
  { slug: 'lightning-spear', name: 'Lightning Spear', kind: 'skill' as const, category: 'Active Skill Gem', tags: ['Lightning'] },
  { slug: 'orb-of-storms', name: 'Orb of Storms', kind: 'skill' as const, category: 'Active Skill Gem', tags: ['Lightning'] },
  { slug: 'blink', name: 'Blink', kind: 'skill' as const, category: 'Active Skill Gem', tags: ['Travel'] },
];

describe('filterEntries', () => {
  it('returns everything for an empty query', () => {
    expect(filterEntries(entries, '')).toHaveLength(3);
  });
  it('matches on name', () => {
    expect(filterEntries(entries, 'lightning').map((e) => e.slug)).toContain('lightning-spear');
  });
  it('tolerates a typo', () => {
    expect(filterEntries(entries, 'lightnin sper').map((e) => e.slug)).toContain('lightning-spear');
  });
  it('returns an empty array for no match', () => {
    expect(filterEntries(entries, 'zzzzqqq')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```powershell
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

```powershell
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
        <span className="font-heading text-muted-foreground" aria-disabled="true">
          Mods — Soon
        </span>
      </nav>
      {children}
      <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">
        Wiki content derived from the{' '}
        <a href="https://www.poe2wiki.net" className="underline">Path of Exile 2 Wiki</a>,
        licensed CC BY-NC-SA. Not affiliated with Grinding Gear Games.
      </footer>
    </AppShell>
  );
}
```

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

- [ ] **Step 8: Write the wiki landing redirect**

```tsx
// src/app/wiki/page.tsx
import { redirect } from 'next/navigation';

export default function WikiHome() {
  redirect('/wiki/items');
}
```

- [ ] **Step 9: Verify, then commit**

```powershell
npm run type-check
npm run lint
npm run build
npx vitest run
git add src\app\wiki\ src\components\wiki\
git commit -m "feat(wiki): add browse pages with slim-index fuzzy search"
```

- [ ] **Step 10: Request code review** (BASE = Task 3 commit, HEAD = this commit).

---

## Task 5: Detail pages

**Apply the Task 0 Step 4 branch here.** Do not full-SSG thousands of pages.

**Files:**
- Create: `src/lib/wiki/load.ts`
- Test: `src/lib/wiki/load.test.ts`
- Create: `src/app/wiki/skills/[slug]/page.tsx`
- Create: `src/app/wiki/items/[slug]/page.tsx`

**Interfaces:**
- Consumes: `WikiItemDetail`, `WikiSkillDetail`, `WIKI_DATA_VERSION`.
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
});
```

- [ ] **Step 2: Run the test and watch it fail**

```powershell
npx vitest run src/lib/wiki/load.test.ts
```

Expected: FAIL — cannot resolve `./load`.

- [ ] **Step 3: Write the loader**

```ts
// src/lib/wiki/load.ts
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { WIKI_DATA_VERSION } from './types';
import type { WikiItemDetail, WikiSkillDetail } from './types';

const ROOT = path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION);
const SAFE_SLUG = /^[a-z0-9-]+$/;

export async function loadDetail(kind: 'item', slug: string): Promise<WikiItemDetail | null>;
export async function loadDetail(kind: 'skill', slug: string): Promise<WikiSkillDetail | null>;
export async function loadDetail(
  kind: 'item' | 'skill',
  slug: string,
): Promise<WikiItemDetail | WikiSkillDetail | null> {
  if (!SAFE_SLUG.test(slug)) return null;
  try {
    const raw = await readFile(path.join(ROOT, `${kind}s`, `${slug}.json`), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function loadAllSlugs(kind: 'item' | 'skill'): Promise<string[]> {
  try {
    const files = await readdir(path.join(ROOT, `${kind}s`));
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run the test and watch it pass**

```powershell
npx vitest run src/lib/wiki/load.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Write the skill detail page**

```tsx
// src/app/wiki/skills/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { loadDetail, loadAllSlugs } from '@/lib/wiki/load';

export const dynamicParams = true;
export const revalidate = 86400;

export async function generateStaticParams() {
  // Task 0 Step 4 branch: return [] here if the entity count exceeds 3000.
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
      <header>
        <h1 className="font-heading text-2xl text-primary">{skill.name}</h1>
        <p className="text-sm text-muted-foreground">{skill.category}</p>
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
      <p>{skill.description}</p>
      {skill.statText.length > 0 && (
        <ul className="space-y-1 text-sm">
          {skill.statText.map((stat) => <li key={stat}>{stat}</li>)}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Source:{' '}
        <a href={skill.sourceUrl} className="underline" rel="noreferrer">
          {skill.name} on the PoE2 Wiki
        </a>{' '}
        (CC BY-NC-SA)
      </p>
    </article>
  );
}
```

- [ ] **Step 6: Write the item detail page**

```tsx
// src/app/wiki/items/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { loadDetail, loadAllSlugs } from '@/lib/wiki/load';

export const dynamicParams = true;
export const revalidate = 86400;

export async function generateStaticParams() {
  // Task 0 Step 4 branch: return [] here if the entity count exceeds 3000.
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

  const reqs = Object.entries(item.requirements).filter(([, v]) => v !== undefined);

  return (
    <article className="space-y-4">
      <header>
        <h1 className="font-heading text-2xl text-primary">{item.name}</h1>
        <p className="text-sm text-muted-foreground">
          {item.itemClass}{item.isUnique ? ' — Unique' : ''}
        </p>
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
      {item.implicitMods.length > 0 && (
        <ul className="space-y-1 text-sm">
          {item.implicitMods.map((mod) => <li key={mod}>{mod}</li>)}
        </ul>
      )}
      {item.explicitMods.length > 0 && (
        <ul className="space-y-1 border-t pt-3 text-sm">
          {item.explicitMods.map((mod) => <li key={mod}>{mod}</li>)}
        </ul>
      )}
      {item.flavourText && (
        <p className="border-t pt-3 text-sm italic text-muted-foreground">{item.flavourText}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Source:{' '}
        <a href={item.sourceUrl} className="underline" rel="noreferrer">
          {item.name} on the PoE2 Wiki
        </a>{' '}
        (CC BY-NC-SA)
      </p>
    </article>
  );
}
```

- [ ] **Step 7: Verify build time specifically**

```powershell
Measure-Command { npm run build }
```

If the build exceeds ~5 minutes, the Task 0 threshold was misjudged — switch `generateStaticParams` to return `[]` and rely on ISR. Record the change.

- [ ] **Step 8: Verify, then commit**

```powershell
npm run type-check
npm run lint
npx vitest run
git add src\app\wiki\ src\lib\wiki\load.ts src\lib\wiki\load.test.ts
git commit -m "feat(wiki): add item and skill detail pages with ISR"
```

- [ ] **Step 9: Request code review** (BASE = Task 4 commit, HEAD = this commit).

---

## Task 6: CI sync workflow and navigation wiring

**Files:**
- Create: `.github/workflows/sync-wiki.yml`
- Modify: `src/components/layout/ShellChrome.tsx`
- Modify: `src/proxy.ts` — **only if D1 resolved to "gated"**

- [ ] **Step 1: Write the workflow**

```yaml
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
        env:
          PRICE_SYNC_CONTACT: ${{ secrets.PRICE_SYNC_CONTACT }}
      - uses: peter-evans/create-pull-request@v6
        with:
          commit-message: 'chore(wiki): refresh wiki data'
          title: 'chore(wiki): refresh wiki data'
          branch: chore/wiki-data-refresh
          body: |
            Automated poe2wiki.net sync. Review the diff before merging —
            wiki content is community-edited and this data ships to users.
```

**A PR rather than a direct push is deliberate.** Unlike poe2scout's API, the upstream is community-edited and can regress between runs. Task 3's guards catch truncation; a human catches vandalism.

- [ ] **Step 2: Trigger it manually and confirm it opens a PR**

```powershell
gh workflow run sync-wiki.yml
gh run watch
```

Expected: green run, one PR opened. If it fails on bot detection, invoke `systematic-debugging` — and note the STOP CONDITION from Task 0 Step 1 still applies.

- [ ] **Step 3: Flip the nav entry**

In `src/components/layout/ShellChrome.tsx`, change the Wiki entry from the dimmed "Soon" treatment to a live `/wiki` link, matching how Price Check is rendered.

- [ ] **Step 4: Apply the D1 gating decision**

If D1 resolved to **public**: no `proxy.ts` change; confirm `/wiki` is absent from `PROTECTED_PREFIXES`.
If D1 resolved to **gated**: add `'/wiki'` to `PROTECTED_PREFIXES` in `src/proxy.ts` and verify a signed-out request to `/wiki` redirects to `/login?redirect=/wiki`.

- [ ] **Step 5: Verify, then commit**

```powershell
npm run type-check
npm run lint
npm run build
npx vitest run
git add .github\workflows\sync-wiki.yml src\components\layout\ShellChrome.tsx src\proxy.ts
git commit -m "feat(wiki): add weekly sync workflow and enable wiki navigation"
```

- [ ] **Step 6: Request code review** (BASE = Task 5 commit, HEAD = this commit).

---

## Task 7: Update the plan doc

Targeted section edits only — never a full rewrite.

**Files:**
- Modify: `poe2-console-hub-plan.md`

- [ ] **Step 1: Correct §4.** The wiki source row names `poewiki.net`. That is the PoE1 wiki — its own PoE2 page still describes PoE2 as an upcoming expansion. Change to `poe2wiki.net`; note the MediaWiki API path, the bot-detection/User-Agent requirement, and CC BY-NC-SA attribution.
- [ ] **Step 2: Update §3's dated build-status note** — move the wiki out of "Not yet built"; state what shipped (items + skills, text-only) and what did not (mods, icons).
- [ ] **Step 3: Add §12 decision rows** — (a) static JSON over a Supabase table for read-only reference data; (b) the two-tier slim-index/detail split for mobile-first search; (c) PR-not-push sync for a community-edited source; (d) the D1 public-vs-gated resolution.
- [ ] **Step 4: Update §13** — add open items for mods/poe2db.tw (still blocked), wiki icons (D3), and any Task 0 findings needing follow-up. If D2 or D3 got resolved, strike the corresponding existing item rather than leaving a duplicate.
- [ ] **Step 5: Resolve the §12-vs-§7 access contradiction** in whichever direction D1 landed — edit the section that was wrong; do not add a third statement.
- [ ] **Step 6: Commit**

```powershell
git add poe2-console-hub-plan.md
git commit -m "docs: record wiki feature decisions and correct source wiki in section 4"
```

- [ ] **Step 7: Final verification before merge**

```powershell
npm run type-check
npm run lint
npm run build
npx vitest run
```

Read every output. Then request a final `requesting-code-review` across the whole branch (`BASE_SHA` = `origin/main`, `HEAD_SHA` = branch HEAD) before the merge procedure in the Multi-Session Protocol.

---

## Failure Protocol

When any step fails, **invoke `systematic-debugging` before touching anything.** Its Iron Law: no fixes without root-cause investigation.

1. **Phase 1 — Root cause.** Read the error completely. Reproduce it. Check what changed. For the sync pipeline specifically (API → fetch → normalize → validate → write), instrument each boundary and log what enters and exits before proposing anything — that's four components, exactly the multi-component case the skill calls out.
2. **Phase 2 — Pattern.** Compare against `poe2scout.ts`, the closest working analogue in this codebase.
3. **Phase 3 — Hypothesis.** One hypothesis, smallest possible test, one variable.
4. **Phase 4 — Fix.** Failing test first (`test-driven-development`), then the single fix, then verify.

**After 3 failed fixes: STOP.** Do not attempt a fourth. That pattern means the architecture is wrong, not the hypothesis. Raise it with Jaycee.

**Likely failure points, ranked:**
- Task 2 `TABLE`/`FIELDS` not matching the real Cargo schema → re-read the Task 0 recon doc; do not guess column names.
- Task 3 validation throwing on a legitimate upstream change → confirm against the live wiki before loosening a guard. Loosening a truncation guard to make a sync pass is how silent data loss ships.
- Task 5 build times → the Task 0 threshold branch.

---

## Self-Review Notes

- **Spec coverage:** §7's route skeleton is covered except `wiki/mods/page.tsx`, deliberately deferred by D2 and rendered as a "Soon" nav entry in Task 4 Step 5.
- **Type consistency:** `WikiSearchEntry`'s five fields are used identically in Tasks 1, 2, 3, and 4. `loadDetail(kind, slug)` matches between Task 5's loader and both detail pages. `validateSyncResult(entries, previousCount)` matches between its test and caller.
- **Known soft spot:** Task 2's `TABLE`/`FIELDS` constants and the `normalizeItem`/`normalizeSkill` field names are placeholders **pending Task 0's measured schema**. This is the single place the plan cannot be concrete without touching the live source — which is why Task 0 exists, why it has a hard STOP condition, and why skipping it produces a sync script that silently returns nothing.
