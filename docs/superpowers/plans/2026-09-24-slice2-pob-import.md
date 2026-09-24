# Slice 2 — PoB2 Import: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paste a Path of Building 2 share code or a pobb.in / maxroll / poe.ninja / poe2db link, see exactly what will and will not come across, and create a Project Vaal build with one leveling checkpoint per PoB tree spec.

**Architecture:** A pure, fetch-free decode-and-map pipeline in `src/lib/pob/` (unit-tested, failure modes written first per AGENTS.md), a small allowlisted fetch module, two Server Functions (preview, then import), one SECURITY INVOKER database function that writes the build and all its checkpoints in a single transaction, and a test-grade import sheet on `/builds`. The import report — what was dropped and why — is a first-class output, not a log line.

**Tech Stack:** Next.js 16.2.9, Supabase Postgres + RLS, TypeScript, vitest, Playwright, `@xmldom/xmldom` (added as a direct dependency).

**Spec inputs:** `docs/superpowers/specs/2026-09-23-pob2-decode-findings.md` (the decode spike) and the research recorded in this document's "Verified facts". **Anchor:** `docs/superpowers/CURRENT-STATE.md`.

---

## Global Constraints

Every constraint in `plans/2026-09-23-convergence-integration.md` applies. In particular:

- **Next.js 16.2.9** — read `node_modules/next/dist/docs/` before App Router code. `refresh()` from `next/cache` works only inside Server Actions.
- **AGENTS.md testing rules.** Never write unit tests after the code. Prefer E2E. When testing in isolation, **write every way it could fail first**, then the code.
- **Every schema change is a file in `supabase/migrations/` and an `apply_migration` call, in the same commit.** Pending migrations for the merge live in `docs/superpowers/pending-migrations/`; do not disturb them.
- **`src/lib/build/stateInput.ts` refuses unknown gear and gem fields.** Imported state must pass through it unchanged in shape; if import needs a new stored field, add it there in the same change.
- **E2E writes to the production database** under the test account. Prefix every build `E2E-`; `afterAll` cleans up; verify the table afterwards.
- **Gates before every commit:** type-check, lint, test, build. Report real output.

---

## Verified facts this plan is built on

Checked on 2026-09-24 against the vendored fixture (`src/lib/pob/__fixtures__/sample-pob2-code.txt`), our data on disk, and PoB2's own MIT source.

| Fact | How verified |
|---|---|
| Share code = URL-safe base64 of zlib-deflated XML, root `<PathOfBuilding2>` | decoded the fixture: 11,140 chars → 36,691 bytes |
| `<Build level className ascendClassName mainSocketGroup>` — class and ascendancy arrive as **names** | fixture: `level="94" className="Mercenary" ascendClassName="Witchhunter" mainSocketGroup="2"` |
| Our tree resolves those names: `Mercenary` → ascendancy `Mercenary2` = "Witchhunter" | `public/data/tree/0.5.2/data.json` `classes[].ascendancies` |
| `<Tree activeSpec>` holds N `<Spec title nodes classId ascendClassId treeVersion masteryEffects>`; the fixture has 8 | fixture |
| `nodes` lists **every** allocated node; set-specific ones are listed again in child `<WeaponSet1 nodes>` / `<WeaponSet2 nodes>`; unlisted = shared | PoB2 `src/Classes/PassiveSpec.lua` `Save` (lines ~252–320) and its loader (~152–160) |
| Node ids match our 0.5.2 tree at **99.50%** (600/603), one unknown id `15671` | decode spike |
| `<Spec>` children include `<AttributeOverride strNodes dexNodes intNodes>` — which attribute each "+attribute" node was set to | fixture: `dexNodes="45969,…" intNodes="51921,…" strNodes="28510,25374"` |
| **Our `PassiveState` has no field for attribute choices** | `src/lib/build/types.ts` — `set1`, `set2`, `ascendancyNodes` only |
| `<SkillSet>` holds `<Skill>` elements, **some of which are empty label rows** (`label="^6--- Spirit Gems ---"`, no gems) | fixture, parsed with a real XML parser: 8 `<Skill>`, 3 empty, 5 with gems |
| `mainSocketGroup` indexes **all** `<Skill>` elements, label rows included, 1-based | fixture: `mainSocketGroup="2"` is the first real group, Artillery Ballista |
| Each real group: one active gem (e.g. `@20/20`) then supports (`@1/0`); largest has 5 supports = our `MAX_SUPPORTS_PER_SKILL` | fixture; `src/lib/build/gemSlots.ts:52` |
| `<Gem gemId>` last segment matches `WikiSkillDetail.gemId` **20/20** | re-measured after the 2026-09-23 sync |
| `skill-index.json` entries carry **no** `gemId` — only the 1,118 detail files do | `public/data/wiki/2026-08-25/skill-index.json` |
| Items: UNIQUE = line 2 unique name, line 3 base; RARE = line 2 author's name, line 3 base; **MAGIC = line 2 is the whole affixed name and line 3 is not a base** (`"Crafted: true"`) | fixture: 2 unique, 7 rare, 3 magic |
| Item names are unique across our 4,994-entry index | script over `item-index.json` |
| One `<ItemSet>` and one `<SkillSet>` against eight `<Spec>`s — **PoB checkpoints are tree-only** | fixture |
| `<Notes>` present, 1,892 chars; our cap is `MAX_NOTES_LENGTH = 4000` | fixture; `src/lib/build/constants.ts:22` |
| `@xmldom/xmldom@0.8.13` is installed only **transitively** (via `pixi.js`) | `npm ls @xmldom/xmldom` |

### Unverified, and treated that way

- **A possible PoB2 export bug.** `PassiveSpec:Save` guards the weapon-set block with Lua's `#weaponSets > 0`. For a table holding only key `2`, `#` is typically `0`, so a build whose only set-specific nodes are on set 2 may export them as shared. Inferred from reading the code; not seen in a real export. The importer cannot recover what PoB did not write, so it imports faithfully and the report says nothing false either way.
- **Checkpoint levels.** PoB specs carry no level, only a free-text `title` ("Nivel 31 - Empezamos con Balista"). A number is inferred from the title (below) and the report marks every inferred level as inferred.

---

## Design decisions (and why)

1. **Import creates a new build; it never overwrites one.** Merging into an existing build is a different feature with its own conflict questions.
2. **Checkpoint order = PoB spec order; position 0 = the first spec.** `/tree` and shared links default to position 0, so the build opens on its earliest stage. PoB's `activeSpec` (the author's last view) is reported, not used.
3. **Gear and gems are copied into every checkpoint**, because PoB carries one item set and one skill set. The report says so plainly; otherwise a user would reasonably assume gear varied per stage and was lost.
4. **Gems join on `gemId`, never on name.** Name joining measured 40–60%; `gemId` measured 20/20. Because `skill-index.json` carries no `gemId`, a small server-side map `gemId → {slug, name, gemType, iconUrl}` is built once from the detail files and cached in memory, the same pattern as `/api/wiki/items`' cached slot index.
5. **Items join on base name.** Unique → the unique's name first, then its base. Rare / normal → line 3 / line 2 exactly. **Magic → the longest base name found inside the affixed name**, reported as inferred. Rolled mods, variants, runes, enchants and quality are **dropped and reported** — reading them is `ModParser.lua`'s job and belongs to Slice 4.
6. **Flasks map by category, not by PoB slot number.** Our `flask1` is Life, `flask2` is Mana. A second life flask, `Ring 3`, and anything else with no home is reported, not forced into a wrong slot.
7. **Checkpoint level:** the first integer 1–100 in the spec title, else the build's `level`, clamped 1–100. Always shown as inferred.
8. **Attribute choices (`AttributeOverride`) are dropped and reported.** Storing them needs a `PassiveState` extension, which touches the editor, `stateInput.ts` and every reader — a decision for the controller, recorded as an open question, not smuggled into an import slice.
9. **One database function writes everything** — the build row and every checkpoint — in one transaction, SECURITY INVOKER so it runs under the caller's RLS. A partially imported build (the row plus three of eight checkpoints) must be impossible.
10. **Fetching a link is server-side and allowlisted.** Exact hosts only (`pobb.in`, `maxroll.gg`, `poe.ninja`, `poe2.ninja`, `poe2db.tw`), HTTPS only, the documented raw-code path for each, a response size cap, a timeout, and no redirects followed off-allowlist. Anything else is refused before a request is made — this route would otherwise be an SSRF primitive.
11. **Decompression is bounded.** `inflateSync(..., { maxOutputLength })` caps the XML at 2 MB (the fixture is 36 KB), so a crafted code cannot become a zip bomb.
12. **Preview, then import.** `previewPobImport` decodes, maps and returns the full report **without writing**. `importPobBuild` re-runs the same pipeline server-side (never trusting a client-sent mapping), then writes.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/pob/decode.ts` | code string → XML string. Base64url, bounded inflate, root check. Pure. |
| `src/lib/pob/parse.ts` | XML string → a typed `PobBuild` (build, specs, skill groups, items, slots, notes). Pure. No knowledge of our data. |
| `src/lib/pob/mapTree.ts` | `PobSpec` + our tree → `PassiveState` + report entries. Pure. |
| `src/lib/pob/mapGems.ts` | `PobSkillGroup[]` + gem catalogue → `GemState` + report entries. Pure. |
| `src/lib/pob/mapItems.ts` | `PobItem[]` + `PobSlot[]` + item catalogue → `GearState` + report entries. Pure. |
| `src/lib/pob/mapBuild.ts` | orchestrates the above into an `ImportPlan` (build fields, ordered checkpoints, report). Pure. |
| `src/lib/pob/report.ts` | the `ImportReport` type and its helpers. |
| `src/lib/pob/source.ts` | input string → code string: recognise a raw code vs an allowlisted URL; fetch with limits. The only module that touches the network. |
| `src/lib/pob/catalogue.server.ts` | builds and caches the tree, gem and item lookups from `public/data`. Server-only. |
| `src/app/(dashboard)/builds/importActions.ts` | `previewPobImport`, `importPobBuild` Server Functions. |
| `supabase/migrations/<ts>_import_build.sql` | `import_build(p_build jsonb, p_checkpoints jsonb)` — one transaction. |
| `src/components/builds/ImportSheet.tsx` | TEST-GRADE: textarea, Preview, the report, Import. |
| `e2e/pob-import.spec.ts` | imports the vendored fixture through the UI and checks the created build. |

---

## Task 1: `decode.ts` — failure modes first

**Files:** Create `src/lib/pob/decode.ts`, `src/lib/pob/__tests__/decode.test.ts`

**Produces:** `decodePobCode(code: string): { ok: true; xml: string } | { ok: false; error: DecodeError }` where `DecodeError = 'empty' | 'not-base64' | 'not-zlib' | 'too-large' | 'not-pob2'`.

- [ ] **Step 1: Write every way decoding can fail, as tests, before any code.**

```ts
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePobCode, MAX_XML_BYTES } from '../decode';

const toCode = (xml: string) =>
  deflateSync(Buffer.from(xml)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

describe('decodePobCode — every way it can fail', () => {
  it('refuses an empty or whitespace-only string', () => {
    expect(decodePobCode('')).toEqual({ ok: false, error: 'empty' });
    expect(decodePobCode('   \n')).toEqual({ ok: false, error: 'empty' });
  });
  it('refuses text that is not base64 at all', () => {
    expect(decodePobCode('this is a sentence, not a code!')).toEqual({ ok: false, error: 'not-base64' });
  });
  it('refuses valid base64 that is not zlib data', () => {
    expect(decodePobCode(Buffer.from('plain text').toString('base64'))).toEqual({ ok: false, error: 'not-zlib' });
  });
  it('refuses a payload that inflates past the cap (zip-bomb shape)', () => {
    const bomb = toCode('<PathOfBuilding2>' + 'A'.repeat(MAX_XML_BYTES + 1) + '</PathOfBuilding2>');
    expect(decodePobCode(bomb)).toEqual({ ok: false, error: 'too-large' });
  });
  it('refuses a PoE1 code (root <PathOfBuilding>, not <PathOfBuilding2>)', () => {
    expect(decodePobCode(toCode('<?xml version="1.0"?><PathOfBuilding><Build/></PathOfBuilding>'))).toEqual({
      ok: false,
      error: 'not-pob2',
    });
  });
  it('refuses inflated text that is not XML', () => {
    expect(decodePobCode(toCode('{"json": true}'))).toEqual({ ok: false, error: 'not-pob2' });
  });
});

describe('decodePobCode — success', () => {
  it('decodes the real vendored code', () => {
    const code = readFileSync('src/lib/pob/__fixtures__/sample-pob2-code.txt', 'utf8');
    const result = decodePobCode(code);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.xml.length).toBe(36691);
      expect(result.xml).toContain('<PathOfBuilding2>');
    }
  });
  it('tolerates surrounding whitespace and standard (non-URL-safe) base64', () => {
    const std = deflateSync(Buffer.from('<PathOfBuilding2></PathOfBuilding2>')).toString('base64');
    expect(decodePobCode(`\n  ${std}  \n`).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module not found).** `npx vitest run src/lib/pob/__tests__/decode.test.ts`
- [ ] **Step 3: Implement.** `MAX_XML_BYTES = 2 * 1024 * 1024`. Trim; map `-`→`+`, `_`→`/`; reject characters outside the base64 alphabet (`not-base64`); `inflateSync(buf, { maxOutputLength: MAX_XML_BYTES })` — a `RangeError` with code `ERR_BUFFER_TOO_LARGE` (verified on Node 26.3 on 2026-09-24) is `too-large`, any other inflate error is `not-zlib`; then require the root element to be `<PathOfBuilding2>` after an optional XML declaration (`not-pob2`).
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Gates, commit.**

## Task 2: `parse.ts` — failure modes first

**Files:** Create `src/lib/pob/parse.ts`, `src/lib/pob/__tests__/parse.test.ts`. Add `@xmldom/xmldom` to `dependencies` pinned to the version already in the tree, **then run `npx patch-package`** — `npm install` silently reverts the `@poe2-toolkit` patches, and type-check then fails in files nobody touched.

**Produces:**
```ts
export interface PobBuild {
  level: number | null; className: string | null; ascendClassName: string | null;
  mainSocketGroup: number | null; // 1-based over ALL <Skill> elements, label rows included
  activeSpec: number | null;      // 1-based
  specs: PobSpec[]; skillGroups: PobSkillGroup[]; items: PobItem[]; slots: PobSlot[];
  notes: string | null;
}
export interface PobSpec { title: string; nodes: number[]; weaponSet1: number[]; weaponSet2: number[]; attributeOverrides: { str: number[]; dex: number[]; int: number[] }; jewelSockets: Array<{ nodeId: number; itemId: number }>; }
export interface PobSkillGroup { index: number; label: string; enabled: boolean; gems: PobGem[] } // index: 1-based position among ALL <Skill>
export interface PobGem { gemId: string | null; nameSpec: string | null; level: number | null; quality: number | null; enabled: boolean }
export interface PobItem { id: number; raw: string }
export interface PobSlot { name: string; itemId: number }
export function parsePobXml(xml: string): { ok: true; build: PobBuild } | { ok: false; error: 'malformed-xml' | 'no-build' };
```

- [ ] **Step 1: Failure-mode tests first.** Malformed XML → `malformed-xml`; a `<PathOfBuilding2>` with no `<Build>` → `no-build`; a `<Spec>` whose `nodes` contains non-numeric ids → those ids dropped, not the spec; a missing `nodes` attribute → an empty spec, not a crash; **an XML external entity (`<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>`) is never resolved** — the parsed notes must not contain file content; an `<Item>` with no text → dropped; a `<Slot>` whose `itemId` is `0` → treated as empty, not as item 0.
- [ ] **Step 2: Fixture tests** — against the vendored code: 8 specs with the exact titles from the decode findings, spec 8 has 127 nodes, 8 `<Skill>` elements of which the gem-bearing ones are indexes 2, 4, 5, 7, 8; `mainSocketGroup` 2; 12 items; `notes` 1,892 chars; spec 1's `attributeOverrides.dex` is `[45969, 27439, 42350, 22975, 8600, 36629]`.
- [ ] **Step 3: Run — FAIL. Step 4: implement with `DOMParser` from `@xmldom/xmldom`** (its NodeLists are not iterable — index them). **Step 5: Run — PASS. Gates, commit.**

## Task 3: `catalogue.server.ts`

**Produces:** `getCatalogue(): Promise<Catalogue>` where
```ts
interface Catalogue {
  tree: { nodeIds: Set<number>; ascendancyNodeIds: Set<number>; ascendancyIdFor(className: string, ascendancyName: string): string | null };
  gems: Map<string, { slug: string; name: string; gemType: 'active' | 'support' | 'spirit'; iconUrl: string | null }>; // keyed by gemId
  items: { byName: Map<string, { slug: string; name: string; category: string; isUnique: boolean; iconUrl: string | null }>; baseNamesLongestFirst: string[] };
}
```
Built once per server process from `public/data/tree/0.5.2/data.json`, the 1,118 skill detail files and the item index + details, then cached. `import 'server-only'` at the top.

- [ ] **Step 1: Failure-mode tests first:** a gemId absent from the catalogue returns `undefined`, not a guess; `ascendancyIdFor('Mercenary', 'Witchhunter')` is `'Mercenary2'` and `ascendancyIdFor('Mercenary', 'Lich')` is `null` (right name, wrong class); every `iconUrl` in the catalogue starts with `/data/wiki/` (so `stateInput.ts` will accept it).
- [ ] **Steps 2–5:** run FAIL, implement, run PASS, gates, commit.

## Task 4: `mapTree.ts`, `mapGems.ts`, `mapItems.ts` — one per commit, failure modes first each

Each returns `{ value, report: ReportEntry[] }` and never throws.

- [ ] **mapTree failure modes:** an unknown node id is dropped and reported by id; an ascendancy node for a **different** ascendancy than the build's is dropped and reported; `WeaponSet1` nodes land in `set1` only, `WeaponSet2` in `set2` only, all others in both; an empty spec yields an empty `PassiveState`, not an error; `attributeOverrides` present → one report entry saying how many attribute choices were dropped. **Fixture:** spec 8 → 126 of 127 nodes kept (117 main-tree, 9 ascendancy), `15671` reported.
- [ ] **mapGems failure modes:** empty label groups are skipped silently; a group whose first gem is a support (per catalogue `gemType`) is reported and skipped; an unknown `gemId` is reported by `nameSpec`; more than `MAX_SUPPORTS_PER_SKILL` supports → the extras reported by name; a disabled gem is dropped and reported; gem level is clamped to 1–40 and quality to 0–20, each clamp reported; `mainSocketGroup` pointing at a label row or a dropped group → no primary, reported. **Fixture:** 5 loadouts, 20/20 gems resolved, primary = the Artillery Ballista loadout.
- [ ] **mapItems failure modes:** `Ring 3` reported, never forced into `ring2`; a second life flask reported; a magic item whose name contains no known base reported; rolled mods, `Variant`, `Rune`, enchant and `Quality` lines counted and reported per item, never silently discarded; an unknown unique name falls back to its base line before reporting. **Fixture:** every slot in the decode findings' slot table maps as listed there.

## Task 5: `mapBuild.ts` + `report.ts`

- [ ] Failure modes first: no specs → one checkpoint from the build level with an empty tree, reported; class not in our tree → the whole import refused with a clear message, because a tree cannot be placed on an unknown class; checkpoint levels inferred per design decision 7 and each marked inferred; notes over `MAX_NOTES_LENGTH` truncated and reported; build name defaults to `"<Ascendancy> — imported"` when none is given.
- [ ] **Fixture:** 8 checkpoints in spec order named by their titles (colour codes like `^5` stripped), levels `31, 37, 44, 49, 56, 63, 70, 94` all inferred from titles, identical gear and gems in all eight, and a report stating gear and gems were shared across checkpoints because PoB stores one set of each.

## Task 6: the migration — `import_build`

- [ ] Write `supabase/migrations/<ts>_import_build.sql`: `import_build(p_build jsonb, p_checkpoints jsonb) returns uuid`, **SECURITY INVOKER**, `set search_path to 'public'`. Inserts the build (`user_id = auth.uid()`, a share token passed in — minted in the Server Function with `nanoid`, same as `POST /api/builds`); the `create_initial_build_checkpoint` trigger then makes checkpoint 0, so the function **updates** checkpoint 0 with the first entry and inserts the rest at positions 1..n-1. Revoke EXECUTE from `public, anon`; grant to `authenticated`.
- [ ] **Load the `supabase-postgres-best-practices` skill before writing it.**
- [ ] Apply it; verify in a DO block **as the `authenticated` role with RLS in force**, rolled back by raising the result: 3 checkpoints in → 1 build and exactly 3 checkpoints out in order; a malformed checkpoint (level 0) aborts the whole call with nothing persisted; `auth.uid()` null → refused. Confirm the table is clean afterwards. Run the security advisors.
- [ ] **Reconcile with the pending mirror-sync migration** (`docs/superpowers/pending-migrations/20260923235500_…`): once applied, its triggers point the build at the most recently saved checkpoint. State in this migration's comment which checkpoint the build row mirrors after an import, and re-verify after the pending migrations land at merge.
- [ ] `npm run db:types`; commit the migration and types together.

## Task 7: `source.ts` — failure modes first

**Produces:** `resolvePobInput(input: string): Promise<{ ok: true; code: string; sourceUrl: string | null } | { ok: false; error: string }>`

- [ ] Failure modes first, with the network stubbed: `http://pobb.in/...` refused (HTTPS only); `https://evil.example/pob/x`, `https://pobb.in.evil.example/x`, `https://user@pobb.in/x`, an IP literal and `file:///x` all refused **without a request being made**; a redirect to a host off the allowlist refused; a response over 1 MB refused; a timeout reported as a timeout; a non-200 reported with its status; a raw code (no `://`) passed through untouched.
- [ ] Per-site raw endpoints come from PoB2's own `src/Modules/BuildSiteTools.lua` (see `docs/research/poe2/build-sharing-ecosystem.md` §2.3). **Verify each against a live request once before relying on it** and record the result; do not assume the research table is current.

## Task 8: the Server Functions

- [ ] `previewPobImport(input)` — session check, `resolvePobInput`, decode, parse, `getCatalogue`, map; returns `{ ok: true; summary; report }` and **writes nothing**.
- [ ] `importPobBuild(input, name?)` — the same pipeline re-run server-side; every checkpoint's state passed through `cleanPassiveStateInput` / `cleanGearStateInput` / `cleanGemStateInput` before the RPC; `import_build` called once; `refresh()`; returns the new build id.
- [ ] Failure modes first, mocked like `checkpointActions.test.ts`: signed out → not found, nothing fetched; an allowlist refusal surfaces as a user-readable message; a state the write gate refuses aborts the import with nothing written.

## Task 9: TEST-GRADE import UI

- [ ] `ImportSheet.tsx`, opened by an "Import from PoB" button on `/builds`. A textarea, Preview, the report rendered as plain lists (**kept**, **dropped**, **inferred**), a name input, Import. On success, navigate to `/tree?build=<id>`. Portal at `z-40`, 44px controls, marked TEST-GRADE in its header comment.

## Task 10: E2E — the primary verification

- [ ] `e2e/pob-import.spec.ts`: paste the **vendored** code (no network dependency in CI), Preview, assert the report states 8 checkpoints, 20/20 gems, node `15671` dropped, attribute choices dropped, gear and gems shared across checkpoints, and `Ring 3` unoccupied; Import; on `/tree?build=<id>` assert **8** checkpoints in the sheet, and that the first and last checkpoints come back after a full reload with **different, non-zero** node counts. The tree hook's `allocated` is **main-tree only**, so the expected values are not the raw spec totals (39 and 127): verified on 2026-09-24 against our 0.5.2 tree, spec 1 is **36** main-tree nodes (+3 ascendancy) and spec 8 is **117** (+9 ascendancy, +1 unknown dropped). Before hard-coding them, confirm by one manual import that the editor keeps every stored node on seeding rather than re-pathing or dropping disconnected ones — if it does not, that is a finding to record, not a number to adjust until green. Tap-target scan of the sheet with the scanned count asserted. `E2E-` name; `afterAll` cleanup; verify the table afterwards.
- [ ] One **opt-in** test (`test.skip` unless `E2E_NETWORK=1`) that imports by pobb.in URL, so the live path is exercisable without making CI depend on a third-party site.
- [ ] Update `CURRENT-STATE.md` in the same commit range: what is built, what the report drops, the open questions below.

---

## Open questions for the controller — do not resolve by guessing

1. **Attribute choices.** PoB records which attribute each "+attribute" node was set to; we have nowhere to store it. Extending `PassiveState` touches the editor, `stateInput.ts` and every reader, and the Slice 5 stat engine needs it for Life and Mana. Build it before Slice 5, or now?
2. **GGG `.build` import.** Now cheap in principle: its skills key on the same `Metadata/Items/Gems/…` ids that `gemId` joins exactly. Its passives key on `id` strings like `"melee17"`, which our tree's `nodes` would need to be checked against before anything is promised.
3. **Export.** Slice 2 is import only. PoB2 code export needs the reverse maps plus a decision on what to write for data we do not hold (rolled mods).
