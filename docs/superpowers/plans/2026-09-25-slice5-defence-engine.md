# Slice 5 — Defence Stat Engine: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** For each checkpoint, compute Life, Mana, Energy Shield, Armour, Evasion, Strength/Dexterity/Intelligence, the four resistances and Spirit from class + level + tree + gear. Compare Spirit with the reserved total from Slice 3. This closes competitor gaps #1 (numbers), #2 (numeric validation) and #8 (campaign penalty).

**Architecture:** One stat vocabulary, from GGG's own game data: tree nodes, item mods, implicits and runes all resolve to typed `(statId, value)` pairs. No display text is parsed where a typed source exists. A pure engine sums them the way PoB2's calc modules do, with every formula cited to the PoB2 line it follows. Test-grade stat sheet per checkpoint.

**Anchor:** `docs/superpowers/CURRENT-STATE.md`. **Previous:** `plans/2026-09-25-slice4-item-affixes.md`.

---

## Decisions (user)

| # | Question | Answer |
|---|---|---|
| 1 | Attribute choices ("+5 to any Attribute" nodes, PoB's `AttributeOverride`) | **Stored, in this slice** (asked 2026-09-24). `PassiveState` gains them; editor, write gate, readers and PoB import all learn them. |
| 2 | Campaign progress (resistance penalty + fixed quest rewards) | **Derived from the checkpoint's level** (2026-09-25). No storage. Shown as "assumed Act N". |
| 3 | Quest rewards that are a player's choice | **Not counted, and said so** (2026-09-25). |
| 4 | Where tree stats come from | **Extracted from GGPK** (`PassiveSkills`) through our own pipeline (2026-09-25), not parsed from display text. |

---

## Verified facts

"PoB2" = `PathOfBuildingCommunity/PathOfBuilding-PoE2`, `dev`, raw files read directly (2026-09-24/25). MIT, "Copyright (c) 2016 David Gowor" (the root `LICENSE.md`, re-read raw). Ported arithmetic carries that attribution.

### The tree spike (2026-09-25, scratch extract, nothing committed)

| Fact | How verified |
|---|---|
| PoE2's `PassiveSkills` table has typed stats: `Stats: [Stats]`, `Stat1Value…Stat5Value`, and `PassiveSkillGraphId` ("Id used by PassiveSkillGraph.psg") | `poe-tool-dev/dat-schema` `dat-schema/poe2/_Core.gql:5567` |
| `pathofexile-dat` extracts it with a two-table config (`PassiveSkills` + `Stats`) at patch `4.5.5.3`. It downloads one bundle per table from GGG's patch CDN; 9,731 rows. | ran in the session scratchpad |
| **Every one of our tree's 5,150 nodes joins** by `PassiveSkillGraphId` = our node key (the 5,151st key is `root`) | `measure.js` |
| **No value drift between our tree export (0.5.2) and the extract (4.5.5.3):** on 5,056 of 5,150 nodes every typed value appears in the display text. All 94 others are unit transforms (per-minute vs per-second, permyriad vs %, ms) or hidden values the text does not show (node 110: `base_physical_damage_reduction_rating_no_display` 200). The 123 name differences are all unused nodes with a blank tree name. | `drift.js` |
| Spot checks: `5733` "+10 to Spirit" → `base_spirit` 10; `29162` "8% increased Spirit" → `spirit_+%` 8; `1352` → `maximum_life_+%` 3; Giant's Blood → `keystone_giants_blood` 1 | `measure.js` |
| Every defensive stat the engine needs is on the tree as a typed id: `base_maximum_life`, `maximum_life_+%`, `base_maximum_mana`, `maximum_mana_+%`, `base_maximum_energy_shield`, `maximum_energy_shield_+%`, `base_physical_damage_reduction_rating`, `physical_damage_reduction_rating_+%`, `base_evasion_rating`, `evasion_rating_+%`, the four `base_*_damage_resistance_%`, `base_spirit`, `spirit_+%`, `additional_all_attributes` | `measure.js` |
| Attribute nodes: `base_strength` 43, `base_dexterity` 36, `base_intelligence` 27, `additional_all_attributes` 14, `base_strength_and_dexterity` 3, `base_strength_and_intelligence` 2. **The 293 "+5 to any Attribute" nodes are `display_passive_attribute_text`**: the choice is the player's, not in the data. | `drift.js` |

### Constants and formulas

| Fact | Source |
|---|---|
| Life `12 × level + 16` (28 at level 1), Mana `4 × level + 30` (34 at level 1). Built as a BASE mod with `{ type = "Multiplier", var = "Level", base = … }`. | PoB2 `CalcSetup.lua:955-956`; `life_per_level` 12, `mana_per_level` 4 in PoB2 `Data/Misc.lua:156-157` (GGG-exported) |
| +2 Life per Strength, +2 Mana per Intelligence, +6 Accuracy per Dexterity (`AccuracyPerDexBase`). Flags that change them (`HalvesLifeFromStrength` for Giant's Blood, `NoStrBonusToLife`, …) are read from the tree. | PoB2 `CalcPerform.lua:494-519` |
| Class base attributes are in our tree's `classes[].base_str/dex/int` (Marauder 15/7/7) | `public/data/tree/0.5.2/data.json` |
| Base evasion rating 7, resistance cap 75, `MaxResistCap` 90, physical damage reduction cap 90 | PoB2 `Data/Misc.lua:149-155`, `Data.lua:249` |
| **Armour mitigation uses `data.misc.ArmourRatio = 10`**, `armour / (armour + raw × 10)`. The feasibility report's "12", from Maxroll, **does not match PoB2 today**. | PoB2 `Data.lua` `ArmourRatio = 10`; `CalcDefence.lua:62-64` |
| Base Spirit 0, and each item's base spirit is added unless `CannotGainSpiritFromEquipment` | PoB2 `CalcSetup.lua:958, 1470-1476, 1684-1685` |
| Elemental resistances start at `configInput.resistancePenalty`, default -60 (Endgame). PoB2's list: Act 1 0, Act 2 -10, … Act 6 -50, Endgame -60. | PoB2 `CalcSetup.lua:965-967`, `ConfigOptions.lua:113` |
| **Item defences:** `round((base + local flat) × (1 + (local increased + defences increased)/100) × (1 + quality/100))`, per Armour/Evasion/ES; quality is a separate multiplier | PoB2 `Classes/Item.lua:2586-2590` |
| Quest rewards per area, with area levels: +10% Cold (Act 1, AL2), +30 Spirit (AL11), +20 Life (AL15), +10% Lightning (AL30), +30 Spirit (AL36), +10% Fire (AL37), 5% increased Mana (AL51), 5% increased Life (AL61), +40 Spirit (AL61). Choice rewards at AL26, 35, 51, 52 ×3, 51, 63. | PoB2 `Data/QuestRewards.lua` (tabulated by `quests.js`) |

### Not verified yet — each task below verifies its own before use

- How PoB2 maps a character's act to the penalty for PoE2's current acts and interludes (it lists Acts 1–6 + Endgame; our quest data has Acts 1–4, Interludes 1–3, Epilogue).
- Whether our **mod stat ids** (items) and **passive stat ids** (tree) are one vocabulary. Both are `Stats.Id` from the same table, so it is expected; Task 1 asserts it on real data.
- Which item stats are **local**. Expected to be the `local_*` ids, as `base_physical_damage_reduction_rating` vs `local_base_physical_damage_reduction_rating` suggest. Task 4 verifies on real items before relying on it.
- Unique mods and implicits are display text in our data. Task 1 extracts base implicits typed (`BaseItemTypes.Implicit_Mods` → `Mods`), and measures how many unique lines match a typed `Unique` mod before promising anything for uniques.

---

## Tasks (each: failure modes first → FAIL → implement → PASS → gates → commit)

1. **Data: typed stats through our pipeline.** `scripts/sync-stats.ts`, separate from `sync:wiki`, which rewrites a whole dataset version:
   - Extract `PassiveSkills` + `Stats` (+ `BaseItemTypes.Implicit_Mods` and `Mods` rolls for implicits).
   - Write `public/data/tree/0.5.2/node-stats.json` (`{ patch, extracted, nodes: { id: [[statId, value], …] } }`) and a base-implicit stats file beside the wiki data.
   - The transforms are pure and tested first.
   - Real-data tests: 5,150 nodes, the spot checks above, and every passive stat id also known to `Stats`.
   - **Tell the user before the run**; it is the approved read-only extract.
2. **Attribute choices.** `PassiveState.attributeChoices: Record<nodeId, 'str' | 'dex' | 'int'>`, defaulted on read (`{}`).
   - Write gate: known node ids only, the three values only, bounded size.
   - Test-grade picker when a generic attribute node is allocated.
   - PoB import keeps `AttributeOverride` (it currently reports it dropped).
   - Readers: draft, checkpoints, the shared page.
   - An unchosen generic node counts nothing, and the sheet says how many are unchosen.
3. **Campaign progress from level** (pure): `level → { act, resistPenalty, rewards[], choiceRewardsNotCounted }`. It uses the quest table above, each row cited, and resolves the first unverified item (act ↔ penalty mapping) against PoB2 before coding.
4. **Stat collection** (pure):
   - tree + attribute choices → `(stat, value)`;
   - gear → item defences via PoB2's item formula, local vs global split verified on real items, implicit and explicit values in roll units;
   - quest rewards;
   - runes only where their category label maps unambiguously (the label→slot table from the Slice 4 plan, built first);
   - every source whose stats were **not counted** is listed by name.
5. **Engine** (pure, `src/lib/build/stats/`): attributes, Life, Mana, ES, Armour, Evasion, resistances (capped, with max-res mods), Spirit, Accuracy.
   - Each formula carries its PoB2 file:line.
   - Failure modes first: zero level, empty tree, a cannot-gain-spirit flag, Giant's Blood halving Str life, resist over cap.
   - **Golden test:** the vendored fixture build, imported, against the defensive numbers pobb.in displays for the same code (`https://pobb.in/TUsV2f6hi8cg`). Read that page once and record the numbers with the date. Where a number cannot match (a config condition PoB applies and we do not), say which and why, not "close enough".
6. **TEST-GRADE stat sheet** per checkpoint on `/tree` and the shared page: the numbers, "assumed Act N", the not-counted list, and Spirit vs reserved (the comparison Slice 3 deferred).
7. **E2E**: import the fixture, open the last checkpoint, assert the golden numbers after a full reload, switch to the first checkpoint and assert different numbers. Choose one generic attribute and assert Life or Mana moves by the exact expected amount.
8. `CURRENT-STATE.md` and a result section here.

---

## Open questions carried forward

- **Unique mods** are text. If Task 1's measurement shows they cannot be typed reliably, the stat sheet lists each unique as "mods not counted" rather than guessing.
- **Offence/DPS** stays out of scope (`CalcOffence.lua`, 364KB).

---

## Findings during implementation (2026-09-25)

- **The golden test cannot be "match PoB's saved numbers".** The fixture's `<PlayerStat>` values were computed on an older game version (`targetVersion="0_1"`). Its Cloak of Flame reads 73 ES, which implies a Silk Robe base of about 21, while PoB2's current `Data/Bases/body.lua` and our data both say 64. Its Amethyst Ring lists `Prefix: IncreasedMana13` but shows no Mana line, so that PoB never applied the mod and its Mana 494 excludes 2 × 189. Comparing against another patch's numbers would prove nothing.
  **So `src/lib/build/stats/__tests__/fixture.test.ts` checks what is exact.** Each armour piece's defences are derived by hand from PoB2's current bases through PoB2's item formula: Paragon Greathelm 428, Vaal Greaves 322, Blueflame Bracers 59 / 42, Cloak of Flame 125. The same test covers what no patch changes: Spirit 100, which PoB saved too, the endgame penalty, and the named runes and choices.
- **Unique lines are typed by wording** (`unique-stats.json`, 1,144 of 2,068 lines), not left out. The plan had allowed for listing uniques as not counted.
- **Two defence stats were missing from the stat table** until the fixture found them: `evasion_and_physical_damage_reduction_rating_+%` (Battle-hardened) and `all_attributes_+%` (Polymathy).
- **The spike missed PassiveSkills' Stat6Value/Stat7Value** (the end of the PoE2 struct). The extraction's refuse-to-guess guard caught it on node 51546.
