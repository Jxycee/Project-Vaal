# GGPK Table Catalog — Decoded, Considered, and Still Untapped

**Purpose:** a running reference of what this project has found in PoE2's full GGPK schema (571
tables, via `poe-tool-dev/dat-schema`'s `dat-schema/poe2/_Core.gql`), so future work can check this
doc before re-deriving the same research. Update it whenever a new table gets decoded, evaluated and
rejected, or flagged for later - the point is to stop re-discovering the same things and to have one
place to check "have we already looked at X" before spending an hour re-confirming it.

Companion docs: [2026-08-22-wiki-ggpk-source-audit.md](2026-08-22-wiki-ggpk-source-audit.md) (the
original systematic schema sweep - 73 candidates, methodology), the two named tables' full research
trail. This doc is the living index; that one is the narrative of the first big sweep.

## Currently decoded (in `scripts/wiki/pathofexile-dat.config.json`)

| Table | Columns we read | What it feeds |
|---|---|---|
| `BaseItemTypes`, `ItemClasses`, `ItemVisualIdentity`, `UniqueStashLayout`, `Words`, `UniqueStashTypes`, `FlavourText`, `AttributeRequirements`, `ArmourTypes`, `ShieldTypes`, `WeaponTypes`, `ItemSpirit`, `Tags` | (item extraction internals, mostly consumed via `@poe2-toolkit/item-extractor`) | Items |
| `CurrencyItems` | BaseItemType, StackSize, Description, Directions, XBoxDirections | Item use-text/directions (Phase 1, `2026-08-21-wiki-item-usetext-design.md`) |
| `BuffDefinitions` | Id, Name, Description, **BuffCategory** | Effects kind + quick-filter tags (2026-08-24/25) |
| `KeywordPopups` | Id, Term, Definition | Mageblood Legacy fix + broad item/skill/effect "In-Depth" enrichment (2026-08-22) |
| `SoulCores`, `SoulCoreStats`, `SoulCoreStatCategories` | BaseItemType; SoulCore/StatCategory/Stats/StatsValues; Id/Display | Rune per-socket-category effects (2026-08-22) |
| `Stats`, `Mods`, `ModType`, `ModFamily` | (mod extraction internals) | Mods |
| `SkillGems`, `ActiveSkills`, `GrantedEffects`, `GrantedEffectsPerLevel`, `SupportGems`, `GemEffects`, `GemTags`, `GrantedEffectStatSets`, `GrantedEffectStatSetsPerLevel`, `GrantedEffectQualityStats` | (gem extraction internals) | Skills |

## Found and used

### `BuffDefinitions.BuffCategory` (added 2026-08-25)

Undocumented raw `i32` enum, no reference table anywhere in the schema. Reverse-mapped by
cross-referencing known effect names against a live decode - see `BUFF_CATEGORY_TAG` in
`src/lib/wiki/normalize.ts` for the full mapping and reasoning. Distribution (1,489 pre-dedup rows):

| Value | Mapped label | Count | Sample names |
|---|---|---|---|
| 1 | Buff | 499 | Onslaught, Righteous Fire, Immortal Call, Unholy Might |
| 2 | Debuff | 545 | Bleeding, Ignited, Chilled, Frozen, Shocked, Poisoned |
| 3 | Charge | 18 | Frenzy/Endurance/Power/Spirit Charges |
| 4 | Buff (folded) | 49 | "Increased Armour/Evasion/..." stat lines |
| 5 | Curse | 11 | Vulnerability, Temporal Chains, Elemental Weakness, Enfeeble |
| 6 | Buff (folded) | 40 | Mid-channel skill-state markers (Reave, Incinerate, ...) |
| 7, 9 | Shrine | 40 | "___ Shrine" |
| 8, 10 | *(unmapped)* | 9 | PvP/event team-color flags |
| 11, 14 | *(unmapped)* | 2 | Single stray entries |
| 13 | Buff (folded) | 7 | Heralds |
| 15 | Buff (folded) | 11 | Unique-item mechanics (Headhunter, ...) |
| 16 | Buff (folded) | 12 | Link mechanics (Soul/Flame/Vampiric/Protective Link) |
| 17 | Charm | 15 | The 13 Charm types |
| 18 | Immunity | 231 | Chill/Freeze/Ignite/Shock/Bleeding Immunity + some internal-state entries already filtered by name (Grace Period, Cutscene in Progress) |

Layered on top: "Ailment" tag for the 6 canonical names GGPK's own `KeywordPopups` glossary lists
under "Ailments" (Bleeding, Ignite→Ignited, Chill→Chilled, Freeze→Frozen, Shock→Shocked,
Poison→Poisoned - "Electrocute" has no matching effect entry in this patch), and "Aura" for any name
ending " Aura" (BuffCategory doesn't distinguish auras from other buffs - both "Speed Aura" and
"Onslaught" are category 1).

**Superseded finding:** the earlier `2026-08-22-wiki-ggpk-source-audit.md`/`2026-08-24-wiki-site-qa.md`
claim that only ~75/1,225 effects were cleanly classifiable (based on a weak "does the description
start with the word Buff/Debuff" text heuristic) was wrong - it just hadn't found this column yet.
`BuffCategory` alone covers essentially all 1,225.

## Found and evaluated — needs a scope decision, not yet built

### `EndgameMaps.FlavourText` (found 2026-08-25) — real, substantial, blocked on a scope call

173 rows, 172 with real flavor text (checked a live decode) - one per actual map LAYOUT ("Blooming
Field", "Savannah", "Fortress", "Sulphuric Caverns", ...), keyed by `WorldArea`, not by any item.
`SpecialMapText`/`SpecialMapFlavourText`/`SpecialMapHelpText` exist too (not yet checked for
population).

**Why this doesn't just slot into the existing item pipeline**: our `Waystone (Tier N)` items are
the *currency-shaped* thing that opens a random map - confirmed via a live check, they carry no
`flavourText` today (correctly - a generic tiered Waystone isn't tied to any one specific layout).
The 172 flavor texts belong to the *map layouts themselves* ("Blooming Field" as a place), which
aren't any of our four current wiki kinds (item/skill/mod/effect). Using this data means either (a)
a new fifth wiki kind ("Map"/"Area"), similar in shape to how "Effect" itself got added, or (b) some
other integration nobody has designed yet. **Not built - needs Jaycee's call on whether a Maps/Areas
kind is worth adding**, same as the effects-taxonomy question earlier needed a design decision before
building anything.

## Found and evaluated as dead ends (don't re-check these without new information)

- **`QuestRewardType`** (`Reward: BaseItemTypes` + `Description`) - real join, real text, but generic
  quest-flow boilerplate ("This quest will give you gold"), not per-item lore. 38 rows.
- **`EssenceMods.Text`** - real join to `Mods`, but every row's `Text` is empty in a live decode.
- **`RelicItemEffectVariations`** - only 7 rows, cosmetic foil-color names, not item descriptions.
- **No table at all** for Heist (`HeistObjective`/`HeistEquipmentTool`), `VaultKey`,
  `AtlasUpgradeItem`, `HiddenItem`, or `Focus` item categories - their `description: null` is a
  confirmed structural gap in the shipped game data, not a decode gap.
- **The 15 uniques with zero PathOfBuilding mod data** (Loreweave, Megalomaniac, etc.) - confirmed
  absent from PoB's raw `Uniques/*.lua` directly; `UniqueOrigins` only had 1/15 (drop-location only,
  not mod values).
- **`UltimatumModifiers`** - has `Name`/`Icon` but no description-shaped field in its own schema.
- **`RitualRuneTypes`** (`BuffDefinitionsKey`, `ModsKey`) - the `BuffDefinitionsKey` just points back
  into a `BuffDefinitions` row we likely already have via effects; `ModsKey` was an empty array on
  every row checked in a live decode (12 rows total). Nothing new here.
- **`SanctumFloors.Description`** - only 4 rows ("Contains Rattlecage, the Earthbreaker" etc.), and
  Sanctum isn't part of any current wiki kind. Too small/niche to act on.
- **`DelveFeatures.Description`** - 246 rows but real content is sparse (most sampled rows had empty
  `Name`/`Description`); Delve isn't part of any current wiki kind either. Not pursued further.
- **`Incursion2Medallions`** (`Name`, `Description`) - only 9 real rows with content ("Juatalotli's
  Medallion" etc., real use-text like "Use to prevent the next Destabilisation of a Room"). Cross-
  checked: none of these names appear in our synced item index at all (only unrelated "Atziri's
  Medallion" and "Medallion Trap" do) - these aren't current droppable items in this patch. Dead end.
- **`AlternateQualityTypes.Description`** (Catalyst quality-modifier types, 26 rows, joins to real
  `BaseItemTypes`) - cross-checked our own Catalyst items: they already carry richer, more detailed
  description text via the existing `CurrencyItems` pipeline ("Adds quality that enhances Chaos
  modifiers on a ring or amulet / Replaces other quality types" vs. this table's terse "Quality
  (Chaos Modifiers)"). No new information.
- **`SupportGemFamily.Text`** - just an Id→display-name lookup ("FirePenetration" → "Fire
  Penetration"), the exact same transformation `humanizeCategory` already does programmatically. No
  new information.

## Flagged, not yet pursued (revisit if a real need comes up - don't chase speculatively)

These turned up during the systematic sweep or since, look potentially useful, but weren't checked
against live data because nothing currently needs them. Check the real row content before building
anything on top of a name alone - several "promising" tables turned out empty or useless.

- **`GrantedEffectLabels`** (`Id`, `Text`) - short labels for granted effects; unclear if these are
  more useful than what `ActiveSkills`/`GemEffects` already give skills.
- **`ModEffectStats`** (`Stat`, `Tags`, `ApplyToExplicit`/`ApplyToImplicit`, `Multiplier`) - might
  clarify which stats apply to implicit vs explicit mod rolls; not checked against real data.
- **`KeywordPopupModReference`** (`Mod`, `StatDescription` file ref) - only 37 rows in a live decode,
  narrowly scoped to Genesis Tree crafting mods; low general value but not zero.
- **`DelveCraftingModifiers`, `HarvestCraftOptions`, `EssenceTargetItemCategories`** - crafting-bench
  mechanics; could matter if a "crafting" wiki section is ever built, irrelevant otherwise.
- **`NPCMaster.AreaDescription`** - Atlas Master descriptions (Doryani's Science, etc.) - not part of
  any current wiki kind.
- **`PassiveSkills.FlavourText`, `Ascendancy.FlavourText`, `AtlasClassPassives.FlavourText`** - flavor
  text for passive tree nodes / ascendancies. Could matter for the Tree feature
  (`public/data/tree/`), unrelated to the wiki - flagged for whoever next touches Tree content.
- **`UniqueMagesLegacy`** - already used for the Mageblood fix's cross-check (Stats/StatValues
  matched `KeywordPopups`'s prose exactly); no other unique currently has an equivalent
  per-variant-stats table found yet - worth checking if another multi-variant unique surfaces a
  similar "Legacy of X"-shaped mystery.

## How to add to this doc

When a new table gets decoded or evaluated: add one row/entry in the right section (Currently
decoded / Found and used / dead end / flagged). Include real row counts and a couple of sample values
from an actual decode, not just the schema shape - the schema alone doesn't tell you whether a field
is populated (see `EssenceMods.Text`, empty despite a real column).
