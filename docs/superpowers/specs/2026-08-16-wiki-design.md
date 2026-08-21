# Wiki Feature (M1) — Design

**Status:** Approved by Jaycee 2026-08-21. Supersedes the data-source architecture in `docs/superpowers/plans/2026-08-16-wiki-feature.md` (that file's Skills Contract, Multi-Session Protocol, and Global Constraints still apply; its Task 0–7 breakdown is superseded by the implementation plan this spec produces).

**Goal:** Ship a searchable PoE2 item + skill-gem + mod wiki at `/wiki`, sourced entirely from `@poe2-toolkit`'s GGPK extractors, with a slim mobile-first search index and icon-bearing detail pages.

## Why this supersedes the original plan

The original plan sourced items/skills from poe2wiki.net (MediaWiki/Cargo) and left mods out of scope pending a poe2db.tw access decision. Recon during the D1–D5 decision-gate conversation found that `@poe2-toolkit` — already a project dependency for the passive tree (`tree-core`, `tree-react`) — ships three more packages that make poe2wiki.net and poe2db.tw both unnecessary for M1:

| Package | Provides |
|---|---|
| `@poe2-toolkit/item-extractor` | Item name, rarity, class, requirements, armor/weapon stats, flavor text, tags, icon (PNG) |
| `@poe2-toolkit/gem-extractor` | Gem name, kind (active/support/spirit), description, per-level stat scaling, tags, icon (PNG) |
| `@poe2-toolkit/mod-extractor` | Affix name, domain, generationType, group, tier, level, stat rolls, families, spawn weights — data only, no icon |

All three read from GGG's own patch server via `@poe2-toolkit/ggpk`'s `createCdnSource({ patch, tablesDir, cacheDir })` — no auth, no game install, confirmed CI-safe (ESM, Node 18+, no disk writes of their own).

**What this eliminates:** MediaWiki Cargo schema recon, poe2wiki.net bot-detection risk, CC BY-NC-SA attribution/share-alike obligations, the "community-edited, might be vandalized" sync rationale, and the D2 poe2db.tw access question entirely.

**What this requires:** editing [AGENTS.md](../../../AGENTS.md)'s GGG-art guardrail, which currently scopes GGG-art use to the passive tree only ("a documented scoped exception... do not generalize it to other features"). Wiki icons generalize it. This is a deliberate, explicit exception widening — see §7.

## Decision Gate Resolutions (D1–D5)

| Gate | Resolution |
|---|---|
| D1 | **Gated.** `/wiki` joins `PROTECTED_PREFIXES` in `src/proxy.ts` — same tier as Tree/Builds/Campaign. Not public; no SSG/SEO benefit sought. |
| D2 | **Resolved via poe2-toolkit, not poe2db.tw.** `mod-extractor` supplies affix data directly from GGG's files. poe2db.tw is dropped from scope, not just deferred. |
| D3 | **In scope for M1.** Item/gem icons ship via `item-extractor`/`gem-extractor`. Requires the AGENTS.md guardrail edit (§7). |
| D4 | **Moot.** No CC BY-NC-SA content in the pipeline (poe2wiki.net dropped). All wiki data is MIT via `@poe2-toolkit`, covered by extending the existing `THIRD-PARTY-NOTICES.md` entry (§7) rather than a new `LICENSE.md`. |
| D5 | **Proceed now.** Campaign Tracker shipped (`0712bbf`). The still-open `passive_state` reconciliation (Tree/Builds Save-to-Build) is a different data domain and doesn't block Wiki. |

## 1. Architecture

One source (`@poe2-toolkit`), three entity kinds (item, skill, mod), each emitted as a **slim search-index tier** (name/slug/category/tags, what ships to the browser for Fuse search) and a **per-entity detail tier** (fetched only when a detail page opens) — same two-tier split as the original plan, just fed by GGPK extraction instead of MediaWiki.

```
scripts/sync-wiki.ts
  → createCdnSource({ patch: WIKI_PATCH_VERSION, tablesDir, cacheDir })
  → extractItems(source) / extractGems(source) / extractMods(source)
  → normalizeItem / normalizeSkill / normalizeMod
  → validateSyncResult (empty-check, duplicate-slug, >10%-drop guards)
  → write public/data/wiki/<version>/{item,skill,mod}-index.json
  → write public/data/wiki/<version>/{items,skills,mods}/<slug>.json
  → write public/data/wiki/<version>/icons/<slug>.webp  (items + skills only)
```

## 2. Patch version pinning

`createCdnSource` requires an explicit `patch` string (e.g. `'4.5.4.10'`). A `"latest"` resolution mechanism exists inside poe2-toolkit's own build scripts (a raw two-byte handshake against `patch.pathofexile2.com:13060`) but isn't exposed as a public API — reimplementing it is its own spike, not pursued for M1. Store `WIKI_PATCH_VERSION = '4.5.4.10'` (current per poe2-toolkit's own docs, dated 2026-08-15) as a manually-bumped constant next to `WIKI_DATA_VERSION` in `src/lib/wiki/types.ts`. The weekly sync PR (§6) is the review point where a human bumps it after a game patch — same manual-but-reviewed pattern already used for `WIKI_DATA_VERSION`.

`createCdnSource`'s `tablesDir` is not self-produced — it requires a separate `pathofexile-dat`-decode step first, driven by a `config.json` (exact working table/column list captured in the recon doc, lifted verbatim from poe2-toolkit's own test fixtures). The sync script runs this as a first stage before calling the extractors.

## 3. Data model

**Corrected against verified `@poe2-toolkit` type signatures** (recon: `docs/superpowers/specs/2026-08-16-wiki-source-recon.md`) — the shapes below match what the extractors actually return, not the poe2wiki.net-shaped guess in the original plan.

```ts
export type WikiEntryKind = 'item' | 'skill' | 'mod';

export interface WikiSearchEntry {
  slug: string;
  name: string;
  kind: WikiEntryKind;
  category: string;
  tags: string[];
}

interface WikiDetailBase {
  slug: string;
  name: string;
  category: string;
  lastSynced: string;
}

export interface WikiItemDetail extends WikiDetailBase {
  kind: 'item';
  rarity: 'normal' | 'unique';
  itemClass: string | null;
  twoHanded: boolean;
  requirements: { strength: number; dexterity: number; intelligence: number };
  armour: { armour: number; evasion: number; energyShield: number; ward: number; block: number } | null;
  weapon: { damageMin: number; damageMax: number; critical: number; attackTime: number; rangeMax: number; reloadTime: number } | null;
  spirit: number;
  dropLevel: number;
  flavourText: string[] | null;
  modDomain: string | null;
  tags: string[];
  iconUrl: string | null;
}

export interface WikiSkillDetail extends WikiDetailBase {
  kind: 'skill';
  gemType: 'active' | 'support' | 'spirit';
  color: 'r' | 'g' | 'b' | 'w';
  tags: string[];
  description: string | null;
  requirement: { strength: number; dexterity: number; intelligence: number; level: number };
  scaling: { level: number; cost: number | null; castTime: number | null; cooldown: number | null; reservation: number | null; stats: { text: string; min: number; max: number }[] }[];
  iconUrl: string | null;
}

export interface WikiModDetail extends WikiDetailBase {
  kind: 'mod';
  domain: string;
  generationType: string;
  group: string | null;
  tier: number | null;
  level: number;
  stats: string[];
  rolls: { stat: string; min: number; max: number }[];
  families: string[];
  spawnWeights: { tag: string; weight: number }[];
}
```

**Known limitation — no explicit/implicit mod text on unique items.** `item-extractor`'s `Item` type has no mods field; GGG's `.dat` files carry no unique→rolled-affix link. `exile2exile` (the reference project built on this same toolkit) sources unique mod values from Path of Building's community data instead, not GGPK. **This M1 pipeline cannot show a unique item's actual affix values** — the item detail page shows class/requirements/base-stats/flavor/icon only. This is the single biggest open item for a follow-up milestone (see "Open items" below) — flagging prominently since a unique's mod lines are arguably the most-wanted fact on its page.

`sourceUrl` (present in the original plan, for wiki-page attribution) is dropped — there is no wiki page. Attribution is handled once, at the license-notice level (§7), not per entity. `metadataId` (originally speculative, for a future Full Builds milestone) is dropped too — GGPK data doesn't need a bridge to GGG's own metadata ids the way a third-party wiki did; revisit only if a future milestone shows an actual need.

## 4. Sync validation & CI

Keep the original plan's `validateSyncResult` guards (empty result, duplicate slugs, >10% count drop vs. previous run) — this repo has hit silent truncation twice before (PostgREST's 1000-row default, poe2scout's paginated `Exalted Orb` bug) and these guards are pipeline-correctness checks, not source-trust checks.

Keep the **PR-not-push** workflow shape from the original plan, but re-scope the rationale in the PR body text: no longer "wiki content is community-edited, a human catches vandalism" — instead "catch extraction-pipeline bugs or a stale `WIKI_PATCH_VERSION` before they reach users," which holds regardless of how trustworthy the source is.

## 5. Routes & UI

- `/wiki/items`, `/wiki/skills`, `/wiki/mods` — all three go live (`/wiki/mods` was "Soon" in the original plan; no longer deferred).
- Icons render on **detail pages only**, not in the browse/search list. Keeps the slim index at its original ~120 bytes/entity budget and avoids turning a 100-row filtered browse result into 100 image requests.
- Nav flips from dimmed "Soon" to a live `/wiki` link, gated behind auth.

## 6. Access control

`/wiki` added to `PROTECTED_PREFIXES` in `src/proxy.ts`.

## 7. Licensing & guardrail edits

- No new `LICENSE.md`. Extend the existing `@poe2-toolkit` entry in `THIRD-PARTY-NOTICES.md` to note it now also supplies wiki item/skill/mod data and icons, not just the tree.
- Edit `AGENTS.md`'s guardrail line (currently: *"the passive tree's use of GGG's sanctioned tree-export sprites is a documented scoped exception... do not generalize it to other features"*) to explicitly cover wiki item/gem icons as a second named exception, sourced the same way (official GGG patch-server data via the same MIT toolkit) — not a general license to use GGG art anywhere.

## 8. Testing

Same TDD shape as the original plan: `types.test.ts`, `source.test.ts` (now testing `normalizeItem`/`normalizeSkill`/`normalizeMod` against real extractor output shapes, not Cargo rows), `sync-wiki.test.ts` (validation guards, unchanged), `WikiSearch.test.tsx` (unchanged — Fuse search logic is source-agnostic), `load.test.ts` (unchanged).

## Open items for a later milestone (not M1)

- **Unique item mod values.** Not derivable from this pipeline (see §3's "known limitation"). Would need Path of Building's community unique dataset (MIT, per its own credit in `exile2exile`) as a second source joined by item name — a real follow-up task, not a stretch goal.
- Community build/trivia context that GGPK data can't provide — poe2wiki.net could still be added later as a secondary enrichment source per entity, if this ends up feeling thin. Not pursued now; no bot-protection workaround implied if it ever is.
- Icon storage is per-entity webp files, not a sprite atlas like the tree's. Fine at expected item/gem counts; revisit only if entity counts are large enough that per-file HTTP overhead matters (measure during implementation, not guessed here).
- `"patch": "latest"` auto-resolution (§2) — reimplementing poe2-toolkit's patch-server handshake would remove the manual-bump step entirely. Not pursued for M1.
- `extractGems`'s icon-bundling behavior (single-call data+icons like `extractItems`, or separate `buildGems`/`buildGemIcons` calls) wasn't fully confirmed in recon — verify in Task 1's real fixture capture, not assumed here.
