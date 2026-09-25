# Build Planner — Design

> ## ⚠️ SUPERSEDED IN PART — read `docs/superpowers/CURRENT-STATE.md` first
>
> This is the original design and still the best account of *why* the feature is
> shaped the way it is. Several of its factual claims are now false. Verified
> against the live database and real data on 2026-09-23:
>
> - **Visibility semantics are inverted here.** This document says `unlisted` =
>   reachable by share link and `private` = owner only. As of 2026-09-23 the
>   product means the opposite, and the database was migrated to match:
>   `private` = owner + anyone with the link, `unlisted` = owner only, and the
>   column defaults to `'unlisted'`. Everything this file says about
>   `get_build_by_share_token` (§"Verified ground truth", §"Task 4") reads
>   backwards — the live filter is `IN ('public','private')`.
> - **`increment_build_view_count` is now `= 'public'` only**, not the pair.
> - **`Focii` does not have 0 entries.** It holds the 8 *unique* focuses;
>   `Focus` holds 51 bases and 0 uniques. Appendix B's advice to filter on
>   `Focus` alone would hide every unique focus. `Talisman` (37 entries, the
>   Druid's weapon class) is missing from the weapon mapping entirely. See
>   `specs/2026-09-20-gear-data-corrections.md`.
> - **`'Spirit Gem'` does not identify Spirit-reserving gems.** It is the Meta
>   gem category: 39 entries, only 20 of which reserve, while 59 reserving gems
>   are `Active Skill Gem` (Herald of Ash among them). The spirit readout this
>   file proposes has no index-only implementation, and was cut from v1.


**Date:** 2026-09-16
**Status:** Approved design, pending implementation plan
**Branch:** `worktree-build-planner`
**Supersedes nothing.** Implements Tasks 1–4 of `docs/superpowers/handoffs/2026-09-16-build-feature-kickoff.md`.

## Problem

Project Vaal has no build-sharing UI. The DB schema for it (`public.builds`, `build_tags`, `build_bookmarks`, the `increment_build_view_count` RPC) has existed since `supabase/schema.sql` was written and is complete. The passive tree editor at `/tree` works but persists nothing — a refresh discards the entire allocation. The login page's own tagline promises "build tools" that do not exist.

This design closes that gap in four dependency-ordered pieces: persistence (Task 1), gear (Task 2), gems (Task 3), sharing (Task 4).

## Non-goals

Explicitly out of scope, and why:

- **Character linking.** `builds.character_id` stays NULL throughout. The `characters` table is empty and has no creation UI; linking is a separate unscoped feature.
- **GGG API / ladder / OAuth.** `ladder_entries` and `user_profiles.ggg_*` exist in the schema but nothing reads or writes them. This is 0% done, not half-done. Untouched here.
- **PoB2 import/export and `.build` JSON.** Alternate ways of filling the same editor. Worthless until the editor exists.
- **Rune / Soul Core sockets.** PoE2 does have rune sockets on gear (see Appendix A), but they are a separate item-pick interaction and add no value before base gear selection works. The socket counts are recorded in Appendix A so a later task can add them without re-researching.
- **Forks and likes.** The live database already models both (`forked_from*` columns with an index; a `build_likes` table whose RLS blocks accounts under a day old). Neither was in the kickoff scope and neither is built here. They are cheap follow-ups precisely because the server side is already done — noted so the next person does not rebuild what exists.
- **Jeweller's Orb socket-count progression.** Support sockets are modelled as "up to 5" rather than tracking a gem's current upgrade state. A planner describes the target build, not the current inventory.

## Verified ground truth

Every claim below was checked against source this session, not assumed from planning docs.

### ⚠️ `supabase/schema.sql` is stale — the live database is authoritative

The checked-in `supabase/schema.sql` does **not** describe the real `builds` table. Three migrations landed after it was written and it was never regenerated:

```
20260828024123  builds_visibility_forks_likes
20260828024222  builds_visibility_forks_likes_advisor_fixes
20260828024741  builds_get_author_name
```

The kickoff handoff verified its claims against that file and inherited its errors. Anyone reading `schema.sql` will be misled the same way. **Verify against the live database or `src/types/database.ts` (which is generated, and correct), never against `schema.sql`.** Regenerating `schema.sql` is tracked separately; it is not part of this work.

What actually differs, and what it means for this design:

| `schema.sql` claims | Live database | Consequence |
|---|---|---|
| `is_public boolean DEFAULT false` | `visibility text NOT NULL DEFAULT 'private'`, CHECK `('private','unlisted','public')` | Three states, not two. `unlisted` = reachable by share link, absent from the finder — exactly the right semantics for sharing. |
| `builds_public_idx (is_public, class, league)` | `builds_visibility_idx (visibility, class, league) WHERE visibility = 'public'` | Finder filters are still index-backed, on the new column. |
| — | `main_skill text` + `builds_main_skill_idx WHERE visibility='public'` | The finder is *designed* to filter by main skill. Task 3 should populate this when a primary skill is chosen. |
| — | `forked_from`, `forked_from_name`, `forked_from_user` + `builds_forked_from_idx` | Fork lineage is modelled. Not built here (see Non-goals). |
| — | `build_likes` table, RLS requires the liking account be ≥ 1 day old | Anti-spam already handled server-side. Not built here. |
| `passive_state` default includes `ascendancyNodes` | Live default is `{"set1": [], "set2": []}` | **Never rely on the column default.** Always write the complete three-key shape explicitly. |

**Server-side functions that already exist (all SECURITY DEFINER, all verified):**

| Function | Behaviour |
|---|---|
| `get_build_by_share_token(p_token text) → SETOF builds` | Returns the build where `share_token = p_token` **and** `visibility IN ('public','unlisted')`. This is the only path that can read an unlisted build — the RLS SELECT policy exposes `visibility = 'public'` only. The public view **must** use this RPC, not a plain select. |
| `increment_build_view_count(p_build_id uuid) → void` | Increments, guarded by the same `IN ('public','unlisted')` check. |
| `get_build_author_name(p_build_id uuid) → text` | Returns the author's `display_name` for public attribution. |

### Game mechanics (from `docs/research/poe2/`)

| Fact | Value | Source |
|---|---|---|
| Ascendancy point cap | 8 total, 2 per trial completion, max 4 completions | `verified-corrections.md` §1.2 — marked CONFIRMED |
| Classes / ascendancies | 8 classes, 22 ascendancies (patch 0.5.5) | `classes-and-ascendancies.md` |
| Flask slots | Exactly 2 (one Life, one Mana) | `items-and-crafting.md` — not flagged uncertain |
| Charm slots | 3 by default, belt mods can extend | `items-and-crafting.md` — not flagged uncertain |
| Support sockets per skill | Starts 2, max 5, uniform across skills | `gems-and-skills.md` |
| Spirit | Separate reservation pool; `Persistent` is a gem **tag** | `gems-and-skills.md` |
| Gear sockets | No PoE1 sockets/links. Rune sockets only, hold Runes/Soul Cores | `items-and-crafting.md` §9 |
| Off-hand types | Shield, Focus, Quiver (bow-only) | `items-and-crafting.md` |

### Codebase

| Fact | Detail |
|---|---|
| `/tree` auth | Already gated by `PROTECTED_PREFIXES` in `src/proxy.ts`. No signed-out path to handle. |
| Tree canvas | `fixed inset-x-0 bottom-16 top-20 touch-none select-none md:bottom-0 md:left-60 md:top-0`. `touch-none` on the outer div is what gives pixi.js gesture ownership. |
| Overlay pattern | `TreeControls` = `absolute left-3 top-3 z-10`, collapses to a chip by default so it does not eat tap area. `NodeInfoPanel` = `absolute inset-x-3 bottom-3 z-10`, `bg-card/95 backdrop-blur`. |
| Ascendancy cap enforcement | **Absent.** `tree-core`'s `toggleAscendancyAllocation` does no point counting. We must add it. |
| Tree state | `PassiveTree.tsx` holds `classId:number`, `ascendancyId:string\|undefined`, `main:WeaponSetAllocation`, `ascendancyNodes:number[]` as separate `useState` slices. |
| Wiki index | `fetchWikiIndex(kind)` → static JSON at `/data/wiki/2026-08-25/<kind>-index.json`. item 708KB / skill 172KB. **Not memoized** — refetched per mount. |
| `WikiSearchEntry` | `{slug, name, kind, category, tags, isUniqueItem}`. **No icon field.** |
| Icons | Only on full detail. Client-side access is `fetchWikiCardSnippet(kind, slug)` (`src/lib/wiki/fetchDetail.ts:74`), which returns icon + flavour + accent. `loadDetail` in `load.ts` is server-only (`node:fs`). |
| Search | `filterEntries(entries, query, fuse?)` exported from `WikiSearch.tsx:24`, fuse.js, keys `['name','category','tags']`. |
| Skill categories | Skill-kind entries carry `category` of `'Active Skill Gem' \| 'Support Gem' \| 'Spirit Gem' \| 'Unused / Removed'` — filterable from the index with no detail fetch. Do **not** confuse with the inert item-kind gem-token categories in `ITEM_CATEGORY_GROUPS['Skill Gems']`. |
| UI primitives | Only button/card/icon/input/label/select. `radix-ui` meta-package (`^1.5.0`) already a dependency — Tabs/Dialog/DropdownMenu need **zero npm installs**. |
| Nav | `/builds` already in `NAV` with `live:false`, renders as a non-clickable span with a "Soon" badge. Flip to `true` once the route exists. |
| House list style | `/prices` uses no `<table>` at any width — `<ul className="divide-y divide-border rounded-lg border border-border bg-card/40">` of `<li className="flex items-center gap-3 px-3 py-2.5">`. Identical markup at all breakpoints. |
| Form style | Login page: `Label`+`Input` at `h-12`, one derived `busy` flag disabling everything, inline `<p className="text-sm text-destructive" role="alert">`. |

## Architecture

### State ownership

The build is three JSON slices plus metadata, but passive allocation currently lives inside `PassiveTree`'s local state while gear and gems have no home. Rather than refactor `PassiveTree`'s internals, the page becomes the owner of the *build record* and `PassiveTree` reports upward:

```
/tree page (client)
├── build metadata state  { id, name, level, league, isPublic, shareToken, dirty }
├── gear state            GearState
├── gem state             GemState
└── <PassiveTree
      initialState={...}      // NEW optional prop — hydrate a loaded build
      onStateChange={...}     // NEW prop — fires {classId, ascendancyId, main, ascendancyNodes}
    />
```

Two new props on `PassiveTree`, no internal restructuring. The page holds everything Save needs.

**Why not lift allocation into context:** `PassiveTree` re-derives geometry and scene data from its own state on nearly every render path. Moving that state across a context boundary risks re-render churn on a pixi canvas for no benefit — the page only needs to *read* the allocation, never drive it.

### Gear and Gems are overlays, not tabs

Gear and Gems open as full-screen sheets layered over the tree canvas, not as tabs that swap the canvas out.

**Why:** the canvas is a `fixed` full-bleed div. Swapping it per tab unmounts `PassiveTree`, which (a) discards all allocation state and (b) re-runs `normalizeGggTree` over the multi-megabyte tree export on every switch. Overlaying keeps it mounted and matches the page's established `TreeControls`/`NodeInfoPanel` recipe.

The trigger is a single collapsible overlay control at a free corner of the canvas, defaulting to a minimal footprint for the same reason `TreeControls` collapses to a chip — on a phone the canvas *is* the interface and drag surface is scarce.

### Routes

| Route | Purpose | Task |
|---|---|---|
| `/tree` | Scratch editor, unchanged when no `?build=` | — |
| `/tree?build=<uuid>` | Loads that build, enables Save | 1 |
| `POST /api/builds` | Authenticated upsert. First user-write route handler in this repo. | 1 |
| `/builds` (Mine tab) | Private list — create / open / rename / delete | 1 |
| `/builds` (Public tab) | Finder — filter by class / league / tag | 4 |
| `/builds/[shareToken]` | Public read-only view, fires view-count RPC | 4 |

`/builds/[shareToken]` is a `nanoid` (21 chars) and `?build=` is a UUID (36 chars with dashes) — different shapes, no routing ambiguity.

### Data flow

```
editor state ──toPassiveState()──► { set1, set2, ascendancyNodes } ──┐
gear state ─────(already shaped)──────────────────────────────────────┤
gem state ──────(already shaped)──────────────────────────────────────┼──► POST /api/builds
metadata ─────────────────────────────────────────────────────────────┘         │
                                                                                 ▼
                                                            createClient() upsert, RLS-gated
                                                            insert → nanoid() share_token
```

**Security:** the route uses the cookie-scoped `createClient()` from `src/lib/supabase/server.ts`, never `createServiceClient()`. Ownership is enforced by the existing RLS policy (`auth.uid() = user_id`), not by application-level checks — an update for a build the caller does not own affects zero rows and returns 404. `user_id` is read from the validated session, never from the request body.

### Shared index cache (prerequisite)

`fetchWikiIndex` is unmemoized. With a gear sheet (many slots) and a gem sheet (many sockets) each mounting pickers, the 708KB item index would be re-fetched and re-parsed repeatedly. New `src/lib/wiki/indexCache.ts` wraps it in a module-level promise cache keyed by `kind`. Small, pure, testable, and a hard prerequisite for Tasks 2 and 3.

## Task 1 — Save to build

**New pure module** `src/lib/build/passiveState.ts`:

```ts
toPassiveState(main: WeaponSetAllocation, ascendancyNodes: number[]): PassiveState
fromPassiveState(state: PassiveState): { main: WeaponSetAllocation, ascendancyNodes: number[] }
```

Encoding: `weaponSets[nodeId]` of `1` → `set1` only; `2` → `set2` only; absent (shared/basic) → **both** `set1` and `set2`. Round-tripping is the primary test invariant. Unit-tested in `src/lib/build/__tests__/` per the existing `src/lib/tree/__tests__/` pattern.

**Ascendancy cap.** 8 points, enforced in `PassiveTree` at the toggle call site — the toggle is refused when it would allocate past 8. Enforced at the *interaction*, not at save: a save-time-only check lets a user paint 12 nodes and only discover the problem when they try to keep their work.

**Version stamping.** New exported constant for the current game version, passed explicitly on every save. The `builds.game_version` column default is `'0.2.0'` — three-and-a-half patches stale — and is never relied on.

**Draft persistence.** `localStorage` key `vaal:tree-draft:<classId>:<ascendancyId>`, written on allocation change, cleared on successful server save. This is the in-progress-edit safety net only; it is not the save mechanism and does not interact with `?build=` hydration. Reads are wrapped in try/catch — a private window or blocked site data must not break the editor.

**`/builds` Mine tab.** List, create, rename, delete. Direct Supabase calls from the client via `createClient()`, matching how other authenticated pages already read.

**Why saves go through a route handler but renames do not:** a save must mint a `share_token` server-side on first write, and server-side token generation is the one thing a client call cannot do trustworthily. Renames, deletes, and the visibility change touch no server-generated value, so they go direct and lean on RLS — adding a route for them would be ceremony with no security benefit. Nav's `/builds` entry flips to `live:true`.

## Task 2 — Gear

**Slot keys** (`GearState`, 17 slots):

```
head, body, gloves, boots, amulet, ring1, ring2, belt,
weapon1_main, weapon1_off, weapon2_main, weapon2_off,
flask1, flask2, charm1, charm2, charm3
```

`weapon1_*` / `weapon2_*` deliberately mirror Task 1's `set1`/`set2` — one weapon-set vocabulary across the whole feature.

**Per-slot stored shape.** `{ slug, name, category, isUnique, iconUrl }`. `slug`/`name`/`category`/`isUnique` come straight off `WikiSearchEntry`; `iconUrl` is resolved at pick time via `fetchWikiCardSnippet`, because the search entry carries no icon. Everything else is re-fetched by slug on demand rather than duplicated into `gear_state`.

**Picker.** A sheet per slot, filtered to that slot's literal `category` values (Appendix B), searched with the existing `filterEntries`. Reuses the shared index cache.

**Mobile.** Slot tiles in a 3-column grid; tapping opens a full-screen picker sheet. Not a character-silhouette paper doll — that needs roughly 500px to be legible and this app's primary viewport is a phone.

## Task 3 — Gems

**Shape.** `{ slots: [{ skill, supports: [...], weaponSet }] }`, `supports` capped at 5. Stored gem shape matches gear's: `{slug, name, category, iconUrl}`.

**Filtering.** Skill sockets filter the skill index to `category === 'Active Skill Gem'` (plus `'Spirit Gem'`); support sockets to `category === 'Support Gem'`. Index-only, no detail fetches.

**Weapon-set tagging.** Each loadout slot tags to set 1, set 2, or both — the same convention and the same colour language as the tree's node tagging. Not a second mechanism.

**Spirit readout — stretch, explicitly optional.** Feasible: `'Spirit Gem'` identifies the reserving gems from the index, and `WikiSkillDetail.scaling[].reservation` holds the cost. But `reservation` is on the *detail*, and no client-side typed detail fetcher exists — this needs a new wrapper plus one fetch per spirit gem. Ship the loadout first; add the readout only if it is cheap once the rest is working.

**Mobile.** Stacked cards, one per loadout slot, support gems wrapping within the card.

## Task 4 — Sharing

**Finder** (`/builds`, Public tab). Lists `visibility = 'public'`, filtered by class / league / main skill / tag. Class and league are served by `builds_visibility_idx`; main skill by `builds_main_skill_idx`; tags join `build_tags`. `unlisted` builds are deliberately absent — that is what unlisted means.

**Public view** (`/builds/[shareToken]`). Calls `get_build_by_share_token(token)`, **not** a plain select. This is not a style preference: the RLS SELECT policy exposes `visibility = 'public'` only, so a direct select returns nothing for an unlisted build and the share link would appear broken for exactly the builds most likely to be shared. Then fire `increment_build_view_count` once per view and render through the *same* Tree/Gear/Gems components with a `readOnly` prop threaded down. No second renderer. Author attribution via `get_build_author_name`.

**Visibility control.** Owner-only, three-way (private / unlisted / public), default `private`. The share token is minted on first save regardless of visibility, and is never regenerated. Moving to `private` revokes link access immediately — both the share-token RPC and the view-count RPC check `visibility IN ('public','unlisted')` server-side, so revocation needs no client cooperation.

**Bookmarks and tags.** Inserts/deletes against the complete `build_bookmarks` / `build_tags` tables. Tags are freeform, 1–32 chars per the existing CHECK constraint.

## Error handling

| Case | Behaviour |
|---|---|
| Save while signed out / session expired | Route returns 401. Editor surfaces an inline error and keeps the localStorage draft — never discards work on a failed save. |
| Save for a build the caller does not own | RLS matches zero rows → 404. Same inline error path. |
| `?build=` UUID not found or not owned | Editor loads empty with an inline notice rather than throwing. |
| Wiki index fetch fails | `fetchWikiIndex` already throws typed errors including `WikiSessionExpiredError`. Picker shows the error inline; the rest of the editor stays usable. |
| Icon snippet fetch fails at pick time | Store the item with `iconUrl: null` and render the slot's fallback. A missing icon must never block a gear pick. |
| `localStorage` unavailable | try/catch on every read and write; the editor works without drafts. |
| Unknown node ids on load (tree version drift) | Ignore unknown ids, keep the rest, surface a "saved under an older tree version" notice. Never silently drop the whole allocation. |

## Testing

Per repo convention: `npm run type-check` → `npm run lint` → `npm test` → `npm run build` before every commit, reporting actual output rather than expected.

- **Unit (vitest), the real coverage target:** `toPassiveState`/`fromPassiveState` round-trip including every weapon-set tagging case; ascendancy cap logic; slot-category mapping; the index cache's single-flight behaviour.
- **No DOM harness exists** in this repo (no jsdom / @testing-library). Component work is verified by type-check + lint + build plus a real browser click-through, same as the wiki and prices work.
- **Browser verification** uses the existing test account against a local dev server. Every flow is checked at a 375px viewport **first**, then desktop — mobile is the primary target, not the fallback. Note that this account writes to the real Supabase project; build rows created during verification are real and should be cleaned up.

## Appendix A — Rune socket counts (deferred, recorded so it need not be re-researched)

| Item type | Max rune sockets |
|---|---|
| Body armour, two-handed weapons | 2 |
| One-handed weapons, gloves, helmets, boots | 1 |
| Quivers, jewellery (rings/amulets/belts) | 0 |

Caster-weapon exclusions (wands/sceptres) are flagged unverified in the source doc — re-check before implementing.

## Appendix B — Slot to wiki category mapping

Literal `category` strings as they appear in the live index, verified against the data file.

| Slot | Categories |
|---|---|
| head | `Helmet` |
| body | `Body Armour` |
| gloves | `Gloves` |
| boots | `Boots` |
| amulet | `Amulet` |
| ring1, ring2 | `Ring` |
| belt | `Belt` |
| weapon*_main | `One Hand Sword`, `Two Hand Sword`, `One Hand Axe`, `Two Hand Axe`, `One Hand Mace`, `Two Hand Mace`, `Mace`, `Bow`, `Crossbow`, `Claw`, `Dagger`, `Flail`, `Spear`, `Sceptre`, `Wand`, `Staff`, `Warstaff` |
| weapon*_off | `Shield`, `Buckler`, `Focus`, `Quiver` |
| flask1 (Life) | `LifeFlask`, `Life Flask` |
| flask2 (Mana) | `ManaFlask`, `Mana Flask` |
| charm1–3 | `Charm`, `UtilityFlask` |

Verified against the live `item-index.json` (4,975 entries, 89 distinct categories), not inferred from the taxonomy file.

**Two traps in the flask/charm data:**

1. **Base items and uniques use different spellings of the same category.** Base flasks are concatenated (`LifeFlask` ×9: "Lesser Life Flask", "Medium Life Flask"…) while uniques are space-separated (`Life Flask` ×3: "Olroth's Resolve", "Blood of the Warrior"…). Filtering on only one spelling silently hides either every base item or every unique. Both must be included.
2. **`UtilityFlask` holds charms, not flasks.** Its 13 entries are named "Thawing Charm", "Staunching Charm", "Antidote Charm" — PoE1 utility flasks became PoE2 charms, but the category label was never renamed in the data. The charm slots must search `UtilityFlask` alongside `Charm`, or they will offer only the 12 unique charms and none of the ordinary ones.

`Focii` appears in `ITEM_CATEGORY_GROUPS` but is absent from live data (0 entries). Filter on `Focus` (51 entries).
