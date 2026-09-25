# Task 2 — Gear: Design

**Date:** 2026-09-20
**Status:** Proposed. Two decisions at the end need the human before implementation starts.
**Builds on:** `docs/superpowers/specs/2026-09-16-build-planner-design.md` ("Task 2 — Gear" + Appendix A/B)
**Corrects:** that spec's Appendix B — see `docs/superpowers/specs/2026-09-20-gear-data-corrections.md`
**Informed by:** `docs/superpowers/specs/2026-09-20-competitor-build-planner-recon.md`
**Depends on:** the server-side migration (D1/D5/D2), which is complete on `worktree-server-migration`.

---

## The one substantive change from the original spec

The original spec has the gear picker fetch the **722KB item index to the browser** and filter it client-side, with a new `src/lib/wiki/indexCache.ts` module-level promise cache as a "hard prerequisite" so that many mounted pickers do not each re-fetch it.

**This design does that on the server instead**, for two reasons that both point the same way:

1. **It is what was asked for.** The migration exists because the user asked for as much as possible to move server-side, having watched client-side data handling cause repeated bugs. Shipping a brand-new 722KB client-side data pipeline immediately afterwards works against that.
2. **Mobile.** Project Vaal's primary audience is console players on phones. A gear picker that costs 722KB before it can show its first row is the single most expensive thing in the app. A filtered server response for one slot is roughly **5KB** — around a 99% reduction, on the interaction a user performs 17 times to fill a character.

The index files are already auth-gated (`/data/wiki/` is in `PROTECTED_PREFIXES`), so nothing is lost in reach. And reading wiki JSON from disk server-side is already a proven pattern in this repo — `src/lib/wiki/load.ts`'s `loadDetail` does exactly that with `node:fs` and ships in production.

**Consequence: `src/lib/wiki/indexCache.ts` is not needed.** The module-level cache moves to the server, where one warm instance serves every user instead of every browser holding its own copy. Drop it from the plan rather than building it.

---

## Architecture

### Search route

New Route Handler: `GET /api/wiki/items`

| Param | Meaning |
|---|---|
| `slot` | one of the 17 slot keys; the server maps it to categories (see mapping below) |
| `q` | optional search text |
| `limit` | optional, default 50, hard cap 100 |

Returns `{ entries: WikiSearchEntry[], total: number }` — `total` is the pre-limit match count, so the sheet can say "50 of 421".

Implementation notes:

- **Authenticate.** `/api/` is **not** in `PROTECTED_PREFIXES`. The static index this route reads *is* gated, so this route must not become an unauthenticated side door around that. Check the session with `getCachedUser()` and return 401 otherwise — same as `POST /api/builds`.
- **Load the index server-side.** Add `loadIndex(kind)` to `src/lib/wiki/load.ts`, alongside `loadDetail`, reading `public/data/wiki/<version>/<kind>-index.json` with `node:fs`. Note the file's shape is `{ entries: [...] }`, not a bare array — `fetchIndex.ts` reads `data.entries`, and so must this.
- **Cache it at module scope** in a promise keyed by `kind`. This is the server-side equivalent of the cache the original spec wanted in the browser, and it is strictly better: one warm instance serves everyone.
- **Reuse `filterEntries`** from `src/components/wiki/WikiSearch.tsx:24`. It is already pure and already exported, and fuse.js runs in node. Do **not** write a second search implementation — divergent ranking between the wiki and the gear picker is a bug users would feel without being able to name.
- **Validate `slot` against the known key list** and 400 on anything else. Never let a caller pass arbitrary category strings through to the filter.

### Where gear state lives

`TreeBuildSession` (created by D1) already owns everything build-scoped and is keyed by `buildId ?? 'scratch'`. Gear state goes there, next to `editorState`. Nothing else needs to change structurally — that is the payoff from doing the migration first.

`handleSave` gains `gear_state` in its POST body. **`POST /api/builds` already handles this correctly** and its comment explains why: on update it writes `gear_state` only when the key is present in the body, precisely so a tree-only save cannot wipe gear. Once gear exists, the editor should send it on every save.

### Overlay, not tabs — unchanged, and now externally corroborated

The original spec opens gear as a full-screen sheet layered over the canvas rather than a tab that swaps the canvas out, because swapping unmounts `PassiveTree`, which discards allocation state and re-runs `normalizeGggTree` over a 5.1MB export on every switch.

The competitor recon independently recommends a "bottom tab bar or icon grid" for planner sections, having watched poeplanner's tab strip clip on a phone. **Take the trigger, not the mechanism:** a compact icon row is a good affordance, but each entry opens an overlay sheet. The canvas stays mounted. Tabs that unmount the tree are not an option here regardless of how they look.

---

## Slot model

17 slots, unchanged:

```
head, body, gloves, boots, amulet, ring1, ring2, belt,
weapon1_main, weapon1_off, weapon2_main, weapon2_off,
flask1, flask2, charm1, charm2, charm3
```

`weapon1_*` / `weapon2_*` mirror the tree's `set1`/`set2` deliberately — one weapon-set vocabulary across the whole feature, with the same colour language the tree already uses for node tagging.

**Per-slot stored shape:** `{ slug, name, category, isUnique, iconUrl }`. The first four come straight off `WikiSearchEntry`. `iconUrl` is resolved at pick time via the existing client-side `fetchWikiCardSnippet` (`src/lib/wiki/fetchDetail.ts:74`), because **`WikiSearchEntry` has no icon field** — re-confirmed against the live data 2026-09-20. A failed icon fetch stores `iconUrl: null` and renders the slot's fallback; a missing icon must never block a gear pick.

### Slot → category mapping

**Use the corrected table in `2026-09-20-gear-data-corrections.md`, not the original Appendix B.** Two categories were missing and both are load-bearing:

- **`Talisman` (37 entries)** belongs in `weapon*_main`. Despite the name it is not jewellery — it is the **Druid's weapon class** (patch 0.4.0). Omitting it, as the original mapping does, leaves one of the eight classes with no selectable weapon at all.
- **`Focii` (8 entries)** belongs in `weapon*_off`. The original spec declares it dead with 0 entries and says to filter on `Focus` alone. In the current data `Focus` holds 51 bases and **0 uniques**, while `Focii` holds the 8 unique focuses. Filtering on `Focus` alone silently hides every unique focus in the game.

The general rule, now observed three times in this dataset (`LifeFlask`/`Life Flask`, `ManaFlask`/`Mana Flask`, `Focus`/`Focii`): **a category whose unique count is 0 almost certainly has a sibling spelling holding its uniques.** Before adding any category to a slot, check the split.

The two traps the original spec *did* document are still live and still correct: base and unique flasks use different spellings of the same category, and **`UtilityFlask` contains charms, not flasks** — so charm slots must search `Charm` *and* `UtilityFlask` or they offer only the 12 unique charms.

---

## Mobile interaction

This is the part the recon says every competitor gets wrong, so it is specified rather than left to implementation taste.

**Slot list.** Labelled rows — icon, slot name, equipped item name or "Empty" — at a full-width tap target, not a character-silhouette paper doll. Two independent reasons: a silhouette needs roughly 500px to be legible, and d4builds (the one competitor whose mobile gearing actually worked) reaches the same answer. Maxroll and poeplanner both keep a desktop paper doll at 375px and both are cramped.

**Picker sheet.** Tapping a slot opens a **full-width, single-column, search-first sheet**. Search input focused at the top, results as one column of rows: name, a rarity/unique marker, category. Not a two-pane category-tree-plus-results layout — that is precisely the desktop-shrunk pattern that fails on Maxroll and poeplanner.

**Tag filter pills**, secondary to the search box. `WikiSearchEntry` already carries `tags` and `filterEntries` already searches them, so this is close to free.

**Weapon set switch** at the top of the gear sheet — one control switching the four weapon slots between set 1 and set 2, using the tree's existing colour language rather than a second visual vocabulary.

**Desktop** gets a wider sheet and more rows visible. It does not get a different component. Unprefixed Tailwind must be a complete phone experience; `md:` adds density.

---

## Error handling

| Case | Behaviour |
|---|---|
| Search route returns 401 | Sheet shows "Session expired — please sign in again." and a `/login` link, matching `WikiSessionExpiredError`'s existing treatment |
| Search route fails otherwise | Inline error inside the sheet; the rest of the editor stays usable |
| Icon snippet fetch fails at pick time | Store with `iconUrl: null`, render the fallback. Never block the pick. |
| A saved build references a slug no longer in the index | Render the stored `name` with a "no longer in this patch's data" marker. Never silently drop the slot — the same principle the original spec applies to unknown tree node ids. |
| Save while signed out | 401 from `POST /api/builds`; inline error, draft preserved. Unchanged from Task 1. |

---

## Testing

- **Unit (vitest) — the real coverage target:** the slot→category mapping (including that `Talisman` and `Focii` are present, as regression cover for exactly the defect found on 2026-09-20); the route's param validation and `limit` clamping; `loadIndex`'s shape validation and its single-flight cache behaviour.
- **No DOM harness exists** in this repo — no jsdom, no testing-library. Component work is verified by type-check + lint + build plus a real browser click-through, as the wiki and prices work were.
- **Browser verification at 375px first**, then desktop. Note the traps in `browser-verification-gotchas`: synthetic key events arrive empty, `form_input` does not update a React controlled input, and the console buffer is sticky per tab.

---

## Deferred, and why

- **Rune / Soul Core sockets.** Counts are recorded in the original spec's Appendix A (body armour and two-handers 2; one-handers, gloves, helmets, boots 1; quivers and jewellery 0). A separate pick interaction; no value before base gear selection works. The caster-weapon exclusions are flagged unverified in the source — re-check before implementing.
- **Item mods / affixes.** A planner describes which item, not which rolls. Large scope, no dependency on this work.
- **`FishingRod`** (1 entry) is deliberately excluded as a joke item, recorded so nobody rediscovers it as a missing weapon category.

---

## Decisions needed before implementation

**1. Jewels have no home.** `Jewel` has 22 entries (13 unique), including Timeless Jewel. PoE2 sockets jewels into the **passive tree**, not into gear — so excluding them from the 17 gear slots is correct. But the original spec does not mention jewels anywhere else either, so they are currently *unplanned* rather than deliberately deferred, and `passive_state` does not model tree jewel sockets. Adding them means extending `passive_state`'s shape, which is schema-adjacent. Options: defer explicitly and record it; or scope it into a later task; or add a flat "jewels" list to `gear_state` now as a stopgap (cheap, but models the game wrongly).

**2. `Talisman` is a weapon, but is it also two-handed?** The research notes two-handed "Animal Talismans" that unlock shapeshift forms. All 37 live under the single `Talisman` category with no one-hand/two-hand split, so the picker cannot distinguish them from the index alone. If the gear UI ever enforces "a two-hander occupies the off-hand slot too", that rule needs a per-item source this index does not provide. **Not a blocker** — v1 does not enforce two-handed occupancy for any weapon — but it should be a conscious deferral rather than a surprise later.
