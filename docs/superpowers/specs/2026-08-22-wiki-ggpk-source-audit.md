# Wiki GGPK Source Audit — Findings & Implementation Plan

**Status:** Search phase complete, approved by Jaycee 2026-08-22. Implementation in progress —
update this doc's "Implementation status" section as each piece lands, so a compaction mid-work
doesn't lose the plan.

## Why this doc exists

Started from a user report: Mageblood's "Legacy of Gold" mod had zero explanation anywhere on the
wiki. Investigating that turned up a real bug (leaked PoB debug lines) plus a wrong fix (aliasing
"Legacy of X" to a same-named Charm effect — reverted, see git history / `mentions.ts` — the user
correctly caught that Mage's Legacy is its own mechanic, not the Charm system). The *correct* fix
required finding real source data, which led to systematically searching PoE2's full GGPK schema
(571 tables total, via `poe-tool-dev/dat-schema`'s `dat-schema/poe2/_Core.gql` on GitHub) for
tables this project doesn't currently decode. This doc is that search's findings plus the plan to
act on them.

**Method**: fetched the full PoE2 schema, parsed every `type X { field: Type }` block, filtered for
types not in our current ~30-table decode list (`scripts/wiki/pathofexile-dat.config.json`) that
have a prose-shaped field (`Description`/`Definition`/`Text`/`DisplayText`/`Tooltip`/`FlavourText`/
`StatDescription`/`Term`) — 73 candidates. Checked ~15 of the most promising by actually decoding
them (scratch `pathofexile-dat` runs, throwaway config/output dirs, never touching the real
`scripts/wiki/.extract/`) and inspecting real row content. Two real wins, several confirmed dead
ends.

## Finding 1: `KeywordPopups` — GGG's own in-game glossary (BIG)

1,026 rows. This is the actual popup text you get hovering a blue-underlined keyword in-game
(damage types, ailments, named mechanics). Schema:

```
type KeywordPopups {
  Id: string @unique
  Term: string
  Definition: string
  ...
}
```

Same `[Key|Display]` bracket-markup convention as every other GGPK text field we already handle
(`stripBracketMarkup` in `src/lib/wiki/normalize.ts` works on it unchanged). Keyed by `Term` (exact
display text, e.g. `"Legacy of Gold"`), not `Id` (internal key, e.g. `"LegacyOfGold"`).

**Concrete win — Mageblood's Legacy lines**: `UniqueMagesLegacy` table (`Name`/`DisplayText`/
`Stats`/`StatValues`) gives the exact numeric bonus per Legacy variant, and `KeywordPopups` has a
dedicated term for each one already spelling it out in prose:

> "Legacy of Gold is a Mage's Legacy which grants 45% increased Rarity of Items found."

Verified this is a *different* mechanic than the Charm system (confirmed by the numeric join,
independently of the user's correction) — the earlier alias-to-Charm-effect fix was wrong and has
been reverted.

**Broader opportunity — same table, much wider reach**: cross-referenced `KeywordPopups.Term`
against every existing wiki entry name. Overlap:

| Kind | Names also a KeywordPopups Term | Total entries |
|---|---|---|
| effect | 99 | 1,225 |
| item | 35 | 4,975 |
| skill | 26 | 1,118 |
| mod | 20 | ~16,000 |

Example of the gap this closes — our "Bleeding" effect page currently shows one BuffDefinitions
sentence:

> "Debuff inflicts Physical damage over time. This Damage bypasses Energy Shield."

`KeywordPopups`'s own "Bleeding" term has a full mechanical writeup: exact duration (5s), the damage
formula (15% of pre-mitigation hit damage), the moving/Aggravated 100% damage bonus, what does/
doesn't contribute to magnitude, and cross-references to related mechanics ([Aggravate],
[Contributes], [BuffMagnitude] are themselves separate glossary terms — this table cross-links
itself, same as our own mention system already does).

**Dead-end check, for completeness**: searched `KeywordPopups` for the 3 already-known-unexplained
mods (Atziri's Influence, Transmogrification, Living Weapons, all in the `MapEclipse` mod family) —
confirmed no term exists for any of them, even in GGG's own glossary. These stay genuinely
unexplained; not a gap in what we're decoding, the explanation simply doesn't exist in the shipped
game data at all (very likely dead/unused mod definitions - `Mods` rows that were never turned into
live droppable content).

## Finding 2: `SoulCores` + `SoulCoreStats` — the Rune socket system (BIG)

295 items in our wiki are categorized `SoulCore` (Runes - "Lesser/Desert/Greater/Perfect Desert
Rune" etc.) with `description: null` across the board — one of our largest known no-use-text
category (see `2026-08-21-wiki-item-usetext-design.md`'s Phase 2 audit). Turns out there IS real
mechanical data for these, just not through `CurrencyItems` (which doesn't cover this category) —
through a completely separate join:

```
type SoulCores {
  BaseItemType: BaseItemTypes @unique
  RequiredLevel: i32
  Limit: SoulCoreLimits
  Type: SoulCoreTypes
  ...
}

type SoulCoreStats {
  SoulCore: SoulCores
  StatCategory: SoulCoreStatCategories   # "Martial Weapon" / "Wand or Staff" / "Armour" / etc.
  Stats: [Stats]
  StatsValues: [i32]
  ...
}

type SoulCoreStatCategories {
  Id: string @unique
  Display: string @localized              # e.g. "Wand or Staff", empty for some rows (fall back to Id)
}
```

Confirmed via a scratch decode: 295 `SoulCores` rows (one per rune item, joined to `BaseItemTypes`
exactly like `CurrencyItems` does), 507 `SoulCoreStats` rows giving the **exact numeric bonus per
rune, per equipment-socket-category** — e.g. a Desert Rune socketed into a Martial Weapon grants
flat added Fire damage, into a Wand/Staff grants a % of damage as Fire, into Armour grants Fire
Resistance - three different real, numeric effects for the *same* item depending on what it's
socketed into. This is the same "Place into an empty Augment Socket..." system we already saw on
Aldur's Legacy's item description - `SoulCoreLimits` even has a row literally named
`AldursLegacyLimit1`.

This needs real design work to render well (multiple stat blocks per item, grouped by socket
category) - it's not a one-line enrichment like the Legacy fix. See "Implementation plan" below.

## Dead ends (checked, confirmed, not worth pursuing further)

- **poe2wiki.net** — disqualified outright (their `robots.txt` blocks `ClaudeBot` explicitly; see
  `2026-08-22-wiki-community-sourcing-design.md`). Not revisited here.
- **The 15 uniques with zero mod data** (Loreweave, Megalomaniac, Against the Darkness, Brynabas,
  Flesh Crucible, From Nothing, Grip of Kulemak, Heart of the Well, Husk of Dreams, Prism of Belief,
  Sekhema's Resolve ×3, Splinter of Loratta, The Immortan) — confirmed absent from PathOfBuilding's
  raw `Uniques/*.lua` files directly (grepped every file, zero matches). `UniqueOrigins` (126 rows,
  `Unique: Words` → `Origin: Origin`) only had a match for 1 of the 15 (Flesh Crucible), and even
  that's just a drop-location reference, not mod values. No further GGPK avenue found for these 15.
- **QuestRewardType** (38 rows, `Reward: BaseItemTypes` + `Description`) — real join, real text, but
  it's generic quest-flow boilerplate ("This quest will give you gold.", "This quest will reward you
  with an Uncut Skill Gem.") not per-item lore/use-text. Doesn't touch the 295 QuestItem-category
  items lacking description - those are a different, larger set (quest *items themselves*, not
  reward-flow descriptions).
- **EssenceMods** (`Text: string @localized`) — real join to `Mods`, but every row's `Text` field is
  empty in a live decode. Unpopulated in the shipped game data.
- **RelicItemEffectVariations** — only 7 rows, cosmetic foil-color names ("Amethyst", "Verdant",
  "Ruby" as visual skin variants), not item descriptions.
- **No table at all** exists for the Heist (`HeistObjective`/`HeistEquipmentTool`), `VaultKey`,
  `AtlasUpgradeItem`, `HiddenItem`, or `Focus` item categories — grepped the full 571-table name
  list for each, zero matches. These categories' `description: null` is a confirmed structural gap
  in the shipped game data itself, not something we're failing to decode.
- **`UltimatumModifiers`** — has `Name`/`Icon` but no description-shaped field in its schema at all;
  not pursued further given `KeywordPopups` already covers general mechanic explanations broadly.

## Implementation plan

### 1. Extend the `KeywordPopups` enrichment beyond Mageblood (DONE for items' uniqueMods, not yet for effects/skills/mods)

Already shipped: `enrichKeywordLines` in `src/lib/wiki/normalize.ts`, wired into `normalizeItem` for
unique items' `explicitMods` only (what fixed Mageblood). `KeywordPopups` is already in
`scripts/wiki/pathofexile-dat.config.json` and `readKeywordDefinitions` in `scripts/sync-wiki.ts`
reads it.

**Not yet done**: using the *99/35/26/20 name-overlap* to enrich existing effect/item/skill/mod
detail pages generally (not just bare-line mod text) - e.g. showing the richer `KeywordPopups`
definition on the "Bleeding" effect page instead of (or alongside) the terse `BuffDefinitions` one.
Design question to settle before building: does the richer glossary text *replace* the terse
official description, or does it render as a distinct "In-depth" section underneath (probably the
right call — the short `BuffDefinitions` sentence is still the "official tooltip," the glossary
entry is genuinely longer supplementary detail, same spirit as the `CommunitySourceNote` visual
separation, but this one IS first-party GGPK data so it shouldn't get the "community-sourced"
styling - needs its own presentation, not reuse of that component).

### 2. `SoulCores` / `SoulCoreStats` rune enrichment (NOT STARTED)

Plan:
- Add `SoulCores`, `SoulCoreStats`, `SoulCoreStatCategories` to `pathofexile-dat.config.json`.
- New join function in `sync-wiki.ts` (mirrors `joinCurrencyByName`'s shape): key `SoulCores` rows
  by their joined `BaseItemTypes` name, gather each one's `SoulCoreStats` rows (there are 1-3 per
  rune, one per socket category), resolve `Stats` indices to real stat text (same resolution
  approach as `UniqueMagesLegacy` used for Mageblood - stat IDs read as raw internal names like
  `base_fire_damage_resistance_%`, need a readable-sentence mapping, NOT just displaying the raw
  stat ID - check whether `Stats` or a related table carries a display-text form of each stat ID
  before assuming raw IDs are the only option, this wasn't checked yet).
- New `WikiItemDetail` field (something like `soulCoreEffects: { category: string; stats: string[] }[]
  | null`) - needs its own type/normalize/render work, not a one-line text append like the Legacy
  fix.
- Render on the item detail page as a labeled block per socket category ("Socketed into a Martial
  Weapon:", "Socketed into Armour:", etc.), styled distinctly from the item's own base mods.
- Test coverage mirroring the `readEffectRows`/`readKeywordDefinitions` pattern (fixture-based,
  temp-dir tables).

### 3. Wiki-wide presentation/formatting pass (NOT STARTED, user-requested 2026-08-22)

Separate from data work: user asked to make sure "all of our presented data is properly formatted
to ensure clarity and the feel of game wiki," building on the current look (user said they like the
current direction). Needs its own pass across all four detail-page templates
(`src/app/wiki/{items,skills,mods,effects}/[slug]/page.tsx`) once the data-shape work above is
settled, since the new SoulCore/glossary content needs a place to live visually before a formatting
pass makes sense to do last (not first) - locking in a mismatched layout as "final" while data shape
is still moving would waste one of the two passes.

## Files touched so far (this investigation + the Mageblood fix)

- `scripts/wiki/pathofexile-dat.config.json` — added `KeywordPopups`.
- `scripts/sync-wiki.ts` — added `readKeywordDefinitions`.
- `src/lib/wiki/normalize.ts` — added `enrichKeywordLines`, wired into `normalizeItem`.
- `src/lib/wiki/mentions.ts` — the wrong Legacy→Charm alias was added then fully reverted here;
  no trace of it remains in the current code.
- Tests: `scripts/sync-wiki.test.ts` (`readKeywordDefinitions` describe block),
  `src/lib/wiki/normalize.test.ts` (`enrichKeywordLines` describe block).
- Scratch/throwaway (not committed, not part of the repo): schema fetch and scratch
  `pathofexile-dat` decodes lived under the session's temp scratchpad directory, never touched
  `scripts/wiki/.extract/`.

## Implementation status

- [x] `KeywordPopups` decode + Mageblood Legacy-line fix — done, synced, verified live.
- [x] `KeywordPopups` broad enrichment (items/skills/effects pages) — `attachKeywordDefinitions`
  (sync-wiki.ts) matches an entry's own `name` against the glossary and attaches
  `keywordDefinition`, rendered via `src/components/wiki/KeywordDefinitionNote.tsx` as an "In-Depth"
  block on the item/skill/effect detail pages. **Deliberately excludes mods** (see next item) — 99
  effects / 35 items / 28 skills got real entries, verified live (Bleeding effect page shows both
  its short `BuffDefinitions` line and the full glossary writeup).
  - **Precision bug found and fixed during verification**: the broad name-match was originally
    applied to mods too, and a real live check (the "Frozen" mod - a cold-damage prefix, not the
    Freeze ailment) showed it attaching the wrong glossary entry. Root cause: a mod's `name` is a
    shared flavor label reused across many unrelated mods (71 different mods are all named "Lucky"),
    not a definitive identity the way an item/skill/effect name is. Fixed by excluding `kind === 'mod'`
    from `attachKeywordDefinitions` in `writeKind` and instead wiring the already-existing, precise
    per-line `enrichKeywordLines` into `normalizeMod`'s `stats` array (exact whole-line match only,
    same mechanism that fixed Mageblood - safe because it only fires when a stat line IS just the
    bare term, never a name-based guess). Verified: 0 mods carry `keywordDefinition` after the fix,
    "Frozen" mod's stats render clean.
- [x] `SoulCores`/`SoulCoreStats` rune enrichment — `joinSoulCoresByName` (sync-wiki.ts) resolves
  each Rune's real numeric per-socket-category bonus through `@poe2-toolkit/ggpk`'s own
  `stat_descriptions.csd` engine (`buildStatIndex`/`renderBlock` - the same one every mod/gem stat
  line already renders through, not a hand-rolled formatter). Rendered on the item page as
  "Socketed in {category}" blocks. 287/295 SoulCore items got real effect data. One bug found and
  fixed during verification: `SoulCoreStatCategories.Display` carries GGPK bracket markup
  (`[MartialWeapon|Martial Weapon]`) that wasn't being stripped - fixed, verified 0 remaining
  bracket-markup leaks across the whole synced dataset (items/effects/mods/skills, all fields).
- [x] Wiki footer credit line updated — was missing "effect" from the data-kind list (added when
  effects shipped earlier this session, footer never updated); fixed in `src/app/wiki/layout.tsx`.
- [ ] Wiki-wide formatting/presentation pass — assessed live (screenshots of Bleeding effect page,
  Desert Rune item page, Frozen mod page) rather than a separate redesign: reusing the existing
  card/`TooltipDivider`/muted-uppercase-label component system already gave the new content a
  consistent, on-brand "In-Depth" / "Socketed in X" treatment with no visible clarity problems. No
  further formatting work identified as needed; revisit only if the user points at something
  specific.

## Verification method notes (for a future session)

Real-data problems in this work were consistently caught by **looking at actual rendered pages**,
not by the type system or unit tests alone - both precision bugs above (mod name-matching, bracket
markup in category labels) passed a full test+typecheck run and only surfaced on a live page
screenshot/read. Any further enrichment in this vein should get the same treatment: sync for real,
open a handful of pages across different entries (not just the one motivating example), and read
the actual text before calling it done.
