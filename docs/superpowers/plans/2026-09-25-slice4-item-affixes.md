# Slice 4 — Items with Everything Our Data Backs: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A stored gear or jewel item carries every property our data can back: rarity, name, item level, quality, corrupted, implicit and unique roll values, prefixes and suffixes with rolled values, and socketed runes or soul cores (competitor gap #3). PoB import keeps what it can match instead of reporting it all as dropped.

**Architecture:** An optional `craft` block on the stored item shape, parsed defensively, gated on write, and defaulted on read, so old rows never crash. Mod eligibility is decided server-side by a new authenticated route over the typed mod files, using the verified first-match spawn-tag rule. The Slice 3 validator gains the affix rules (warn, never block). A test-grade item editor sheet is opened from a gear row. PoB import joins crafted items' mods **by GGG id**, and falls back to text matching for pasted items.

**Tech Stack:** Next.js 16.2.9, TypeScript, vitest, Playwright. **No migration**: `gear_state` is jsonb.

**Anchor:** `docs/superpowers/CURRENT-STATE.md`. **Previous slice:** `plans/2026-09-24-slice3-structural-validation.md`.

---

## Global Constraints

Every constraint in `plans/2026-09-23-convergence-integration.md` applies, plus:

- **AGENTS.md:** failure modes first in every module; E2E is the primary verification.
- **The write gate (`src/lib/build/stateInput.ts`) projects every item to exactly five fields today (`cleanItem`).** Any new field must be added there in the same change, or every save silently **drops** it with a 200. That is worse than a refusal.
- **Gem items share `GearItem`.** `craft` is for gear slots and jewels only. A gem item carrying `craft` is refused.
- **Old rows lack `craft`.** Readers default it and never crash, the same discipline `parseGearState` already follows.
- **Server code reading `public/data` at request time must be traced.** After the build, check the new route's `.nft.json` lists the mod files. Slice 2's catalogue was missed by the tracer while the build stayed green (`outputFileTracingIncludes` in `next.config.ts`).
- **No UI redesign.** The item editor is TEST-GRADE.

---

## Decisions (user, 2026-09-24)

| # | Question | Answer |
|---|---|---|
| 1 | What a stored item carries | **Everything our data backs**, not a cherry-picked subset. The user asked why the first recommendation was narrower. It was a scope habit, not a data limit. |
| 2 | Roll values | **Exact number, clamped** to the chosen tier's `min`-`max`. |
| 3 | Affix limits (Magic 1+1, Rare 3+3, one mod per group) | **Warn**, never block. The same precedent as two-handed occupancy. |
| 4 | Runes and enchants | **Runes now, enchants later.** Corruption enchant outcomes are not typed anywhere in our mod data. |

---

## Verified facts this plan is built on

Checked 2026-09-24. "PoB2" = `PathOfBuildingCommunity/PathOfBuilding-PoE2`, `dev`, raw files read directly.

| Fact | How verified |
|---|---|
| **Spawn eligibility is first-match:** walk a mod's `spawnWeights` in order; the first tag the base carries decides the weight; 0 excludes. | PoB2 `src/Classes/Item.lua` `ItemClass:GetModSpawnWeight` (`break` on first match) |
| **Our data reproduces PoB2 exactly under that rule:** eligible Prefix/Suffix counts for Amethyst Ring 100/103, Vaal Greaves 44/85, Siege Crossbow 71/75, Stellar Amulet 81/128, Paragon Greathelm 59/78. They are identical when computed from our `mods/*.json` (matching `domain` to the item's `modDomain`) and from PoB2's `Data/ModItem.lua`. | script over both, 2026-09-24 |
| Our spawn weights are only **0 or 1** (7,113 zero, 6,023 one). The extractor keeps eligibility, not real weights, so **roll odds are not representable**, and nothing here needs them. | script over `mods/*.json` |
| Mod `domain` values look like PoE1 enum labels (jewel mods sit under `Atlas`; `Heist Trinket`, `Watchstone` and `Tincture` exist). Items' `modDomain` uses the same table, so the join is consistent. **The labels are not trusted as names.** | script; Emerald `modDomain: "Atlas"` |
| Mod records: `generationType` Prefix 2,150, Suffix 2,010, Unique 983, and others. Each carries `group`, `tier`, `level`, `stats[]` (display), and `rolls[{stat,min,max}]` (typed). | script |
| **PoB crafted items name their mods by GGG id**, e.g. `Prefix: {range:1}JewelProjectileSpeed`. All **35/35** ids in the fixture resolve to `mods/<id lowercased>.json`. | fixture decode, 2026-09-24 |
| PoB turns a range fraction into a value as `min + range × (max − min)`, per `(a-b)` in the line | PoB2 `src/Modules/ItemTools.lua:130` `itemLib.applyRange` |
| Of the fixture's 12 items, 10 are `Crafted: true` (every rare and magic). The 2 uniques carry only text. | fixture |
| **Implicits and unique mods are display text with ranges**, e.g. ring `"+(7-13)% to Chaos Resistance"`, Cloak of Flame `"+(30-50)% to Fire Resistance"`. They are not typed. | `items/amethyst-ring.json`, `items/cloak-of-flame.json` |
| **Uniques carry their base:** `uniqueMods.baseType` on 422 of 440, and 419 resolve by name. The other 3 resolve after stripping a `{variant:…}` prefix. | script |
| Runes and soul cores: **305** items in category `SoulCore` with `soulCoreEffects: [{category, lines[]}]`, e.g. Adept Rune `[{"category":"All Equipment","lines":["+9 to Dexterity"]}]` | script |
| **Augment socket count per base is not in our data.** PoB2's `socketLimit` is hand-set per base group in its export directives, not a GGPK table (`src/Export/Scripts/bases.lua:27`). Its values: **3** for one-hand weapons, sceptres, wands, shields, foci, helmets, gloves and boots; **4** for two-hand weapons and body armour; **none** for amulets, rings, belts and quivers. | PoB2 `Data/Bases/*.lua`, tabulated 2026-09-24 |
| `@poe2-toolkit` extracts no socket data | grep over its `dist/` |

### Unverified, and treated that way

- **Whether PoB2's `socketLimit` is the in-game maximum** or includes corruption. It is used only as a **warn-above** cap, documented as PoB2's.
- **The 0–20 quality bound** stays the existing assumption (`MAX_GEM_QUALITY`'s reasoning). It is not data-backed.
- ~~Magic 1+1 and Rare 3+3 affix limits: verify against PoB2.~~ **Verified 2026-09-24**, PoB2 `src/Classes/Item.lua:1750-1768`: Magic 1 prefix + 1 suffix. Rare 3 + 3, **except rare jewels at 2 + 2** (corrupted Abyss jewels excepted). Some items carry a per-side limit modifier (`prefixes.limit`/`suffixes.limit`), which we cannot represent. The warning says "limit for this rarity", and the modifier case is noted as unmodelled.

---

## The stored shape

```ts
// src/lib/build/craft.ts
export type ItemRarity = 'normal' | 'magic' | 'rare' | 'unique';

/** A chosen affix: the mod file's slug, and one value per entry of that mod's `rolls[]`, each clamped to [min, max]. */
export interface CraftedMod { slug: string; values: number[] }

export interface ItemCraft {
  rarity: ItemRarity;
  name: string | null;          // a rare or magic item's own name
  itemLevel: number | null;     // 1–100
  quality: number;              // 0–20
  corrupted: boolean;
  implicitValues: number[][];   // per implicitMods line, one value per "(a-b)" range in it
  uniqueValues: number[][];     // per uniqueMods.explicitMods line, same rule
  prefixes: CraftedMod[];
  suffixes: CraftedMod[];
  runes: string[];              // SoulCore item slugs, in socket order
}

export interface GearItem { slug; name; category; isUnique; iconUrl; craft?: ItemCraft }  // craft only on gear slots + jewels
```

~~A value outside its range is clamped on write, not refused. Unknown mod or rune slugs are refused by the write gate.~~ **Revised 2026-09-25, before any code.** Both would put mod data inside a gate that is pure and synchronous today. Refusing unknown slugs has a worse failure too: a future `sync:wiki` that renames one mod would make every build carrying it **unsavable**. So:
- **The write gate checks shape and bounds only**: a slug matches `^[a-z0-9_]{1,120}$`, lengths and counts are capped, and every value is a finite number.
- **The editor clamps** each value to the chosen tier's `min`–`max` as it is typed. That is the user's "exact number, clamped".
- **The validator warns** about an unknown mod or rune slug, or a value outside its tier range. Those can only arrive from an import, an old row or a direct POST. Nothing is dropped, per the never-discard rule jewels already follow.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/build/craft.ts` | `ItemCraft` types, `emptyCraft(isUnique)`, `parseCraft(raw)` (defensive read), `rangesIn(line)` (the `(a-b)` parser), clamp helpers. Pure. |
| `src/lib/build/gearState.ts` | parse `craft` on gear and jewel items |
| `src/lib/build/stateInput.ts` | gate `craft`: shape, bounds, counts, lengths; refuse it on gem items |
| `src/lib/wiki/modCatalogue.ts` | loads and caches the mod files once; `eligibleMods(itemSlug, kind)` → groups → tiers. Server-only. |
| `src/app/api/wiki/mods/route.ts` | `GET ?item=<slug>&kind=prefix\|suffix\|rune` (authenticated), ~KB responses |
| `src/lib/build/validate/affixRules.ts` | Slice 3 validator extension: affix count vs rarity, duplicate group, ineligible mod, tier level above item level, runes above `socketLimit` |
| `src/components/build/ItemEditorSheet.tsx` | TEST-GRADE editor opened from a filled gear row |
| `src/lib/pob/mapItems.ts` | keep rarity, name, quality, corrupted, crafted mods by id + range, implicit/unique values by text, runes; report what did not match |
| `src/components/builds/ReadOnlyGearList.tsx` | shared page lists rarity and mods (test-grade) |
| `e2e/item-craft.spec.ts` | the primary verification |

---

## Tasks (each: failure modes first → FAIL → implement → PASS → gates → commit)

1. **`craft.ts`**: `rangesIn` handles `+(7-13)%`, `Adds (1-2) to (3-5)`, decimals `(0.5-1.5)`, negatives `(-10--5)`, and a line with no range (→ `[]`). `parseCraft` defaults every missing field and drops malformed entries one at a time, never the whole item.
2. **`gearState` + write gate**: an old row with no `craft` reads exactly as today. A save carrying `craft` keeps it byte-for-byte (**the regression the handoff warns about: assert it is not projected away**). A gem item with `craft` is refused. Oversized arrays are refused: more than 6 affixes of a kind, more than 6 runes, more than 20 implicit lines. Values are clamped. `MAX_STATE_JSON_LENGTH` still holds for a full 17-slot crafted build (measure one).
3. **`modCatalogue.server.ts` + route**: real-data tests pin the five PoB2 count matches above. Plus: an unknown item gives 404-shaped `null`; a unique gives no prefixes or suffixes; a jewel gets jewel mods; `kind=rune` lists SoulCore items whose effect category fits the base. Route tests: 401 signed out, 400 for a bad kind. **After the build, `.nft.json` lists `mods/`.**
4. **`affixRules.ts`**: one test per rule, each paired with a clean case at exactly the limit.
5. **`ItemEditorSheet`** (TEST-GRADE): rarity, name, item level, quality, corrupted; implicit and unique value inputs per range; add a prefix or suffix (group list → tier → value inputs showing min–max); runes. The row shows rarity and affix count; warnings reuse the Slice 3 marker.
6. **PoB import**: fixture tests first. The Emerald keeps 3 mods (2 prefix slots, one `None`), 8%/4%/4% from `range=0.5`, re-derived from each mod's own min/max rather than assumed. Every magic and rare fixture item keeps all its `Prefix:`/`Suffix:` ids. The two uniques keep their unique values where a line matches the template. The report lists every line that did not match. The report's "mods not kept" entries for matched items disappear.
7. **E2E** `e2e/item-craft.spec.ts`: craft a rare Amethyst Ring with 4 prefixes (warning on the ring row), remove one (clean), set values, save, **full reload**, and read every value back. Import the fixture and check the Emerald's three mods on `/tree`. Tap-target scan of the editor with the scanned count asserted.
8. Update `CURRENT-STATE.md` in the same commit range.

---

## Open questions carried to Slice 5

1. **Implicit and unique lines are text.** The engine needs `stat → value` from them. That can come from matching their templates against typed `Unique`/`Item` mod files (983 `Unique` mods exist) rather than parsing prose. Measure the match rate in Slice 5 before promising numbers.
2. **Rune effects are text per equipment category** (`"All Equipment"`, …). Which category applies to which slot is needed for Slice 5, and for Task 3's rune filter. Tabulate the categories first.

---

## Rune applicability — researched 2026-09-25, deferred to Slice 5

- **PoB2's rule** (`src/Classes/Item.lua:2378`, `ItemClass:GetSocketedAugmentTypes`): a rune's effect applies when its slot key equals the item's **broad** type or its **specific** type. Broad is `weapon` (the base has weapon stats), `armour` (it has armour stats), or `caster` (tagged wand, staff or sceptre). Specific is the item type lowercased, with `warstaff` → `quarterstaff` and evasion shields → `buckler`. PoB2's `Data/ModRunes.lua` uses 21 keys (`armour` 79, `weapon` 113, `caster` 40, `helmet` 47, …).
- **Our data labels the same effects differently.** 29 display categories: `Martial Weapon` 77, `Armour` 63, `Wand or Staff` 51, `All Equipment` 16, `Caster Weapon` 4, …, each on `soulCoreEffects[].category`. A label→key mapping would be inference, not data.
- **Conflict:** PoB2 sets no `socketLimit` on amulets, rings or belts, yet marks 544 rune effects `canSocketInJewellery = true`.
- **So Slice 4:** the rune picker (a `runes` pseudo-slot on `/api/wiki/items`, category `SoulCore`) lists every rune and soul core. The count warning fires only for bases with a PoB2 `socketLimit`, and jewellery gets no count rule. **Which effect line applies to which slot is Slice 5's question**, since that is where it changes a number. It should start by building the label→key table and checking it against every rune that exists in both datasets.
