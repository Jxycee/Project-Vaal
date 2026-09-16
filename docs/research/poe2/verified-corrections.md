# Path of Exile 2 — Verified Corrections (Re-verification Pass)

## Last updated
2026-09-16

## Purpose & method
This document re-attempts verification of items flagged "uncertain / re-verify" in the five companion research docs (`classes-and-ascendancies.md`, `items-and-crafting.md`, `endgame-and-atlas.md`, `build-sharing-ecosystem.md`, `monsters-and-loot.md`). The prior research pass hit two sandbox limits: WebFetch was egress-blocked for gaming-wiki domains, and WebSearch had a budget several agents exhausted.

**What changed this pass:** WebFetch in this sandbox turned out to be blocked far more broadly than previously documented — it failed even for `pathofexile.com`, `poe-vault.com`, `steamcommunity.com`, `game8.co`, `repoe-fork.github.io`, and even `example.com` (tested directly). Effectively every non-GitHub domain is egress-blocked here. What *does* work: `raw.githubusercontent.com` / `api.github.com` for repositories added via `add_repo`, and `WebSearch` (used sparingly, with multiple independent-source cross-checks required before treating a claim as confirmed).

The highest-value new technique used here: **cloning and reading two GitHub repos that ship or mirror GGG's actual PoE2 client data**:
- `PathOfBuildingCommunity/PathOfBuilding-PoE2` (the community build-planning tool; its `src/TreeData/0_5/tree.json` is GGG's own official passive-tree export, and `changelog.txt` / `src/Modules/Build.lua` document exact hardcoded game constants)
- `SilkroadLabs/rePoE2` (a data-mining project that extracts item/mod/keyword/area definitions directly out of the PoE2 game client, in the same style as PoE1's long-standing RePoE project)

These are **primary-source-adjacent**: not GGG's own wiki or patch notes, but literal exports of GGG's game files, which is stronger evidence than aggregated community-blog snippets. Important caveat discovered and documented below: this data source is **not reliable for "does this mechanic exist as live PoE2 content"** questions, because it contains assets for mechanics independently confirmed absent from live PoE2 (Delve, Heist, Blight) marked identically to mechanics that are definitely live. It *is* reliable for exact names/counts/numbers of things that do exist (essences, omens, catalysts, attributes, currency effects).

---

## 1. classes-and-ascendancies.md

### 1.1 Exact per-class attribute totals
**Original claim:** "Treat exact attribute numbers as approximate/qualitative rather than exact digits — verify against in-game tooltips or `public/data/tree/` export before hardcoding numeric values."

**Verification:** Cloned `PathOfBuildingCommunity/PathOfBuilding-PoE2` and read `src/TreeData/0_5/tree.json` (GGG's own official 0.5-era tree export, the same kind of file the game's own passive-tree UI is built from). The `classes` array carries exact `base_str` / `base_dex` / `base_int` fields per class.

**Resolution: CONFIRMED**, with exact numbers:

| Class | Str | Dex | Int | Total |
|---|---|---|---|---|
| Warrior | 15 | 7 | 7 | 29 |
| Ranger | 7 | 15 | 7 | 29 |
| Huntress | 7 | 15 | 7 | 29 |
| Witch | 7 | 7 | 15 | 29 |
| Sorceress | 7 | 7 | 15 | 29 |
| Mercenary | 11 | 11 | 7 | 29 |
| Monk | 7 | 11 | 11 | 29 |
| Druid | 11 | 7 | 11 | 29 |

Clean, consistent design rule: every class starts with **29 total base attribute points**, split either 15/7/7 (single dominant attribute) or 11/11/7 (hybrid, tertiary attribute at 7). This can be hardcoded safely.

### 1.2 Exact ascendancy-point totals
**Original claim (§3):** "Ascendancy points total: same conceptual design as PoE1's 8-point cap carried over... exact current point cap and per-completion point counts were not independently re-verified live this session."

**Verification:** Two independent lines of evidence:
1. `PathOfBuilding-PoE2`'s `src/Modules/Build.lua` (line ~1030) hardcodes `ascMax, secondaryAscMax = 8, 8` as the tool's own validation constant for "too many ascendancy points allocated" warnings.
2. WebSearch cross-check against five independent current (2026) community guides (stratlore, conquestcapped, expcarry, vulkk, boostmatch) all agree: **maximum 8 ascendancy points total, awarded in pairs of 2 per full trial completion**, up to 4 completions, via **either** Trial of the Sekhemas or Trial of Chaos (mixable — you are not required to run both trial types).

**Resolution: CONFIRMED.** 8-point cap unchanged from PoE1's design, awarded 2 points per completion of either trial, up to 4 completions total.

### 1.3 Bonus finding (not originally flagged, but relevant to ascendancy-roster accuracy): Witch's hidden "Abyssal Lich" upgrade
While checking ascendancy data, the same tree export revealed Witch's 3rd ascendancy slot (`Witch3`, "Lich") has a `replaceBy`/`replace` relationship in GGG's own data with a second entry `Witch3b`, "Abyssal Lich". This is **not** a rename — WebSearch (VULKK, Mobalytics) confirms it is a **secret, optional upgrade path**: after ascending as a Lich, defeating Abyssal bosses in Abyss encounters drops "Kulemak's Invitation," which unlocks a hidden "Jump" option at the Well of Souls (Mastodon Badlands, Act 2) that transforms the character's Lich ascendancy in place into "Abyssal Lich" (some Lich passives are replaced with new Abyssal Lich-specific ones; PoB2 changelog confirms specific new nodes: "Eldritch Empowerment," "Umbral Well," "Unwilling Offering"). PoB2's changelog dates this Easter-egg mechanic to patch **0.3.0 "The Third Edict"** (~2025-09-02) — a patch not present anywhere in the doc's own patch timeline table. Worth adding to the doc as an addendum (Lich's name is still correct as the base ascendancy; Abyssal Lich is a bonus hidden variant, not a replacement).

---

## 2. items-and-crafting.md

### 2.1 Exact guaranteed-modifier count on Orb of Alchemy
**Original claim:** "The exact guaranteed mod count that Orb of Alchemy currently rolls could not be confirmed from reachable sources this session."

**Verification:** `SilkroadLabs/rePoE2`'s `data/keywords.json` contains GGG's own in-game keyword/glossary tooltip text (the same reference text shown via in-client keyword links), extracted directly from the client:

> `"OrbOfAlchemy": "Upgrades a Normal or Magic item to a Rare item with 4 random modifiers."`

**Resolution: CORRECTED/CONFIRMED → exactly 4 random modifiers.** (For comparison, the same file confirms Orb of Transmutation grants exactly 1 modifier when upgrading Normal→Magic.)

### 2.2 & 2.6: Complete 19-Essence list, full Omen list, full Catalyst list
**Original claim:** Only 3 named Catalyst examples, 9 named Omen examples, and an unverified/approximate 19-name Essence list were given.

**Verification:** Cross-checked two independent official-data sources — `PathOfBuilding-PoE2`'s auto-generated `src/Data/Essence.lua` (GGG item data, "do not edit" auto-gen header) and `rePoE2`'s `data/base_items.json` (GGPK-extracted GGG item data). Both agree exactly.

**Resolution: CONFIRMED**, with full lists now recorded:

**19 Essences with the standard 4-tier progression (Lesser → [blank] → Greater → Perfect):**

| Essence | Modifier family |
|---|---|
| Body | Life |
| Mind | Mana |
| Enhancement | Defences |
| Abrasion | Physical damage |
| Flames | Fire damage |
| Ice | Cold damage |
| Electricity | Lightning damage |
| Ruin | Chaos damage |
| Battle | Attack |
| Sorcery | Caster/Spell damage |
| Haste | (movement/attack) Speed |
| the Infinite | Attributes |
| Seeking | Critical |
| Insulation | Fire Resistance |
| Thawing | Cold Resistance |
| Grounding | Lightning Resistance |
| Alacrity | Cast Speed |
| Opulence | Item Rarity |
| Command | Ally/Minion damage |

Plus **6 special single-tier Essences** not on the standard ladder (new finding — not in the original doc at all): **Essence of Hysteria, Essence of Delirium, Essence of Horror, Essence of Insanity** (these are the "Corrupted Essence" tier the original doc referenced conceptually — obtained by Vaal-Orbing a Perfect Essence), plus **Essence of the Abyss** and **Essence of the Breach** (Abyss/Breach-mechanic-tied single-tier essences, previously undocumented).

**44 Omens** (full official list, up from 9 examples), extracted from `base_items.json`: Omen of Abyssal Echoes, Amelioration, Answered Prayers, Bartering, Catalysing Exaltation, Chance, Chaotic Monsters, Chaotic Quantity, Chaotic Rarity, Corruption, Dextral Alchemy, Dextral Annulment, Dextral Coronation, Dextral Crystallisation, Dextral Erasure, Dextral Exaltation, Dextral Necromancy, Gambling, Greater Annulment, Greater Exaltation, Homogenising Coronation, Homogenising Exaltation, Light, Putrefaction, Recombination, Refreshment, Reinforcements, Resurgence, Sanctification, Secret Compartments, Sinistral Alchemy, Sinistral Annulment, Sinistral Coronation, Sinistral Crystallisation, Sinistral Erasure, Sinistral Exaltation, Sinistral Necromancy, Whittling, the Ancients, the Blackblooded, the Blessed, the Hunt, the Liege, the Sovereign. (Confirms Sinistral=prefix-targeting / Dextral=suffix-targeting convention exactly as the original doc guessed. Also confirms an "Omen of Sinistral/Dextral Alchemy" pair exists, which biases Orb of Alchemy's 4 rolled mods toward max prefixes or max suffixes.)

**12 Catalysts** — **CORRECTED**, not confirmed as originally guessed. The doc's placeholder names ("Tempering, Turbulent, Imbued") do not match GGG's actual data. The real, current PoE2 Catalyst names (confirmed via `base_items.json` item descriptions, `release_state: "released"`) are the same names carried over from PoE1's Breach league:

| Catalyst | Modifier family boosted |
|---|---|
| Reaver Catalyst | Attack |
| Adaptive Catalyst | Attributes |
| Sibilant Catalyst | Caster/Spell |
| Chayula's Catalyst | Chaos |
| Tul's Catalyst | Cold |
| Carapace Catalyst | Defences |
| Xoph's Catalyst | Fire |
| Flesh Catalyst | Life |
| Esh's Catalyst | Lightning |
| Neural Catalyst | Mana |
| Uul-Netol's Catalyst | Physical |
| Skittering Catalyst | Speed |

**Additional correction:** every Catalyst's official description text reads "...on a ring or amulet" — **belts are not Catalyst-compatible.** The original doc's claim of "rings/amulets/belts" is corrected to **rings/amulets only**.

### 2.4 Does the PoE1-style "3 identical Uniques → reroll" vendor recipe exist in PoE2?
**Verification:** WebSearch (TheGamer's Reforging Bench guide, cross-checked against general community consensus) directly and explicitly addresses this: "There is no longer a three-to-one vendor recipe in Path of Exile 2. This feature has been replaced by the Reforging Bench... combine three items to create a new one with random stats."

**Resolution: CORRECTED → does not exist.** Fully superseded by the Reforging Bench mechanic the doc already documents elsewhere (§5), which is a broader "combine 3 → 1 random-stat item" system, not restricted to 3-identical-Uniques.

---

## 3. endgame-and-atlas.md

### 3.1 Does Incursion exist in PoE2? (asked across multiple files — attempted definitive resolution)
**Verification attempted two ways:**

1. **Data-mining `SilkroadLabs/rePoE2`:** `data/world_areas.json` contains real Incursion zone definitions (`IncursionTemple` = "Atziri's Temple", `IncursionTemplePresent` = "Lost Temple", `IncursionHub` = "Vaal Ruins") whose terrain file paths live under PoE2's genuine internal codename root (`Metadata/Terrain/Gallows/...` — confirmed real by cross-checking known PoE2 zones like Clearfell Encampment and Ogham Village, which use the identical `Gallows/Act1/...` path prefix). `base_items.json` also has ~37 Incursion-specific items (room-modifier "Arm"/"Leg" items, "Alva's Memory," Incursion currency) marked `release_state: "released"`.
2. **However**, the exact same data source, using the exact same "released" flag, also contains **Delve** (41 items), **Heist** (149 items), and **Blight** (8 items) assets — all marked `"released"` — despite the original doc having already confirmed via direct player forum testimony that Delve, Heist, and Blight are **not** present in live PoE2. This proves the data source's presence/`release_state` fields reflect a shared underlying GGG item/mod database (likely spanning both games' engines) and **cannot be used to determine whether a mechanic is actually accessible in current PoE2 gameplay.**
3. **WebSearch cross-check:** reproduces the exact same ambiguous signal the original research found — one aggregator (maxroll's "Endgame Activities" page) lists Incursion alongside Breach/Ritual/Delirium/Expedition/Abyss, but unlike those four (which each get dedicated deep-dive guide pages, confirmed elsewhere in the existing doc), no dedicated "Incursion in PoE2" guide page was found independent of that one list.

**Resolution: STILL UNVERIFIED — could not resolve definitively even with new tactics.** The data-mining approach that resolved several other questions this pass is specifically unreliable for this one (demonstrated false positives on Delve/Heist/Blight using the identical method). Net read: evidence leans slightly toward "not a live, distinct endgame mechanic in current PoE2" (matching the pattern of other confirmed-absent PoE1 legacy mechanics whose assets still ship in the client), but this is not a confirmation. Recommend a direct in-game or official-patch-notes check next time WebFetch access to `pathofexile2.com` or the wikis is available.

### 3.2 Exact current campaign-difficulty naming
**Verification:** WebSearch, cross-checking 3 independent sources (Dualshockers, GameRant, MyGamingTutorials): PoE2's Early Access campaign difficulty structure is exactly **two tiers: "Normal" and "Cruel."** Cruel unlocks upon finishing the (EA-length) campaign and is an NG+-style replay of the same acts at higher monster level, with a flat **-10% to all elemental resistances** penalty applied on entry. All three sources agree this is an **explicit, GGG-acknowledged placeholder** for Early Access — at 1.0 (2026-12-11) it is replaced by a single continuous 6-act campaign with no separate Cruel replay.

**Resolution: CONFIRMED.** "Normal" and "Cruel" terminology has **not** changed since early EA (the doc's speculation that it might have was unfounded) and is documented as intentionally temporary through 1.0.

### 3.3 Exact 3 party loot-allocation modes' names/behavior
**Verification:** WebSearch (guildorder.com, u4gm.com), consistent with PoE1's long-standing identical system (unchanged mechanic carried over).

**Resolution: CONFIRMED.** The three modes are:
- **Free For All** — any party member can loot any drop immediately.
- **Short Allocation** (also called "Temp Allocation") — only the player it dropped for can loot it for a short window, then it opens to anyone.
- **Permanent Allocation** — only the player it dropped for can ever loot it.

Selected via Options → Game → "Default Item Allocation."

---

## 4. build-sharing-ecosystem.md

### 4.1 GGG OAuth app registration status (open or closed to new apps), patch 0.5.5 / Sept 2026
**Verification attempted:** WebFetch to `pathofexile.com/developer/docs/*` and to the specific forum threads is blocked in this sandbox (confirmed directly — the domain is egress-blocked entirely, not just the docs path). WebSearch for any 2026-dated report of the registration gate reopening, or of any newly-approved third-party OAuth client since Maxroll's, returned nothing — only the same general documentation pages and the same original undated forum thread (`view-thread/3821465`).

**Resolution: STILL UNVERIFIED.** No new evidence found either way this pass. The original conservative treatment (treat as a real, current, unquantified blocker; budget for direct `oauth@grindinggear.com` contact rather than assuming self-service approval) should stand.

### 4.2 Console (PSN/Xbox-linked) accounts queryable via the same character API as Steam
**Verification:** WebSearch surfaced a concrete, useful data point not previously found: GGG's OAuth API's `realm` query parameter is documented to accept **`xbox`** and **`sony`** as valid values (this is pre-existing PoE1 API plumbing, used to select a platform-specific account/character list). This proves the underlying console-realm mechanism is real and functional infrastructure, not speculative.

**Resolution: PARTIALLY CONFIRMED — upgraded from "inferred only," but not fully resolved.** This strengthens the doc's existing inference (PoE2's account-unification/cross-progression model means a `realm=poe2` query should surface characters regardless of originating platform) by confirming GGG's API genuinely has first-class console-platform support elsewhere in its `realm` parameter design. However, no direct primary-source documentation or first-hand report was found confirming the *exact* mechanism for PoE2 specifically — i.e., whether a console-linked PoE2 account's characters are reachable via `realm=poe2` alone (consistent with the unified-account model) or require combining a platform-specific realm value with a PoE2 flag. This remains the single highest-value fact to test directly (a live query against a known console-linked test account) before building Project Vaal's import-by-account-name flow around it.

---

## 5. monsters-and-loot.md

### 5.1 Monster-mod prefix/suffix structure vs. categorized pool
**Verification:** `SilkroadLabs/rePoE2`'s `data/mods.json` (official GGG mod data, extracted from the client) has a `domain` field, and for `domain: "monster"` entries, an explicit `generation_type` field. The values found:

| generation_type | count | meaning |
|---|---|---|
| prefix | 110 | standard rare/magic monster affix, prefix slot |
| suffix | 70 | standard rare/magic monster affix, suffix slot |
| unique | 1555 | monster-specific (named/unique monster) mods |
| torment | 149 | Tormented Spirits mechanic |
| essence | 115 | Essence-monster mods |
| monster_affliction | 49 | general afflictions |
| bloodlines | 47 | Bloodlines mod pool |
| nemesis | 36 | Nemesis mod pool |
| bestiary | 24 | Bestiary-captured monster mods |
| talisman | 22 | Talisman monster mods |
| blight | 5 | Blight-specific monster mods |
| azmeri_empowered_monster | 3 | Azmeri-specific |

Example confirmed prefix mods: "Heated" (burning ground on death), "Frosted" (chilled ground on death). Example confirmed suffix mods: "of the Inferno" (fire damage gained), "of Frostbite" (cold damage gained).

**Resolution: CONFIRMED, and more precise than either of the doc's two hedged framings.** Standard rare/magic monster affixes **do** use a strict prefix/suffix split, structurally identical to item-affix generation (matching the doc's item-style hypothesis). Separately, special encounter-type mod sources (Nemesis, Bestiary, Torment, Talisman, Bloodlines, Blight, Essence-monster, and monster-only Uniques) each draw from their own non-prefix/suffix categorized pools (matching the doc's fallback "categorized pool" hypothesis). Both of the doc's competing framings were correct — for different mod sources.

### 5.2 Exact rare-monster affix count ceiling
**Verification:** WebSearch corroborates "2–4 affixes" as the base range (not a single fixed number like PoE1's "3, one may be an aura"). Separately, `rePoE2`'s `data/stat_translations/atlas_stat_descriptions.json` confirms real Atlas Passive Tree nodes with exact text "Rare Monsters in your Maps have two/three additional Modifiers" (plus % chance for a further one), proving Atlas-passive stacking on top of the base count is real and can add up to at least +3.

**Resolution: STILL PARTIALLY UNVERIFIED** — the *existence* and *scaling mechanism* of extra modifiers is now confirmed, but no single authoritative source pins the un-modified base ceiling to one exact number; treat "2–4, plus up to +3 more via Atlas passives" as the best-available approximate figure, not exact.

### 5.3 The Bodach's and Olroth's exact exclusive-unique drop names
**Verification:** WebSearch, cross-checked across independent aggregators.

**Resolution: CONFIRMED (partial).** The Bodach's exclusive uniques: **Vestige of Darkness** (common) and **Liminal Coil** (rare). Olroth, Origin of the Fall's exclusive uniques include (at least) **Olroth's Resolve** (an Ultimate Life Flask) — corroborated independently by GameRant and Sportskeeda; a complete exhaustive loot table for Olroth was not found in this pass.

### 5.4 Divination-Card-equivalent system planned for/before 1.0?
**Verification:** WebSearch surfaced one specific claim (from a roadmap-aggregator site, not a primary GGG source): "divination cards will return in the 1.1 or 1.2 post-launch updates... not arriving in 1.0."

**Resolution: STILL LARGELY UNVERIFIED — single-source, moderate confidence only.** No direct GGG quote was found to corroborate this specific 1.1/1.2 timeline claim; treat it as a plausible community rumor, not a confirmed roadmap fact.

### 5.5 "Runes of Aldur" naming ambiguity
Not re-investigated this pass (lower priority per task scope) — the original doc's own resolution ("Runes of Aldur" = a challenge league preceding/distinct from 0.5.5 "Forbidden Rites," consistent with 0.5.0 "Return of the Ancients" as the base patch) stands unchanged.

---

## Summary of resolutions

| # | Item | Resolution |
|---|---|---|
| 1 | Per-class attribute totals | CONFIRMED (exact numbers, official tree export) |
| 2 | Ascendancy point totals | CONFIRMED (8 total, 2 per trial completion) |
| 3 | Witch "Abyssal Lich" | New finding — hidden upgrade variant of Lich, not a rename |
| 4 | Orb of Alchemy mod count | CONFIRMED = 4 random modifiers |
| 5 | 19-Essence list | CONFIRMED, full list + 6 bonus special essences found |
| 6 | Omen list | CONFIRMED, 44 total (was 9 examples) |
| 7 | Catalyst list | CORRECTED — real names are PoE1-legacy (Reaver/Adaptive/etc.), not "Tempering/Turbulent"; ring/amulet only, not belts |
| 8 | 3-identical-Unique vendor recipe | CORRECTED — does not exist, replaced by Reforging Bench |
| 9 | Incursion in PoE2 | STILL UNVERIFIED (data-mining proved unreliable for this specific question) |
| 10 | Campaign difficulty naming | CONFIRMED — Normal/Cruel, explicit EA placeholder |
| 11 | Party loot modes | CONFIRMED — Free For All / Short (Temp) Allocation / Permanent Allocation |
| 12 | OAuth app registration status | STILL UNVERIFIED — no new evidence found |
| 13 | Console API queryability | PARTIALLY CONFIRMED — realm=xbox/sony proven to exist; PoE2-specific mechanism still untested |
| 14 | Monster mod prefix/suffix | CONFIRMED — both framings correct for different mod sources |
| 15 | Rare monster affix ceiling | STILL PARTIALLY UNVERIFIED — 2-4 base, +3 more via Atlas |
| 16 | Bodach/Olroth uniques | CONFIRMED (partial) — names found, not exhaustive |
| 17 | Divination cards roadmap | STILL LARGELY UNVERIFIED — single low-confidence source |

---

## Sources

**GitHub repositories read directly (cloned via `add_repo`, primary-source-adjacent — actual GGG game data):**
- https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2 — `src/TreeData/0_5/tree.json` (official GGG tree export), `src/Data/Essence.lua` (auto-generated GGG item data), `src/Modules/Build.lua` (ascendancy point cap constant), `src/Export/Scripts/passivetree_ggg.lua` (Lich/Abyssal Lich replacement mapping), `changelog.txt` / `CHANGELOG.md` (patch history)
- https://github.com/SilkroadLabs/rePoE2 — `data/base_items.json`, `data/mods.json`, `data/keywords.json`, `data/world_areas.json`, `data/stat_translations/atlas_stat_descriptions.json` (GGPK-extracted GGG client data)

**WebSearch (snippet-only, cross-checked against 2+ independent results where possible):**
- Ascendancy points: stratlore.com, conquestcapped.com, expcarry.com, vulkk.com, boostmatch.gg
- Witch/Abyssal Lich: vulkk.com, mobalytics.gg
- Catalyst names (initial, later corrected against official data): game8.co (via search snippet only, not fetched)
- Vendor recipe → Reforging Bench: thegamer.com
- Incursion ambiguity: maxroll.gg (endgame-activities), ludo.guide, poe2db.info, pathofexile.com forum (view-thread/3711696, snippet only)
- Campaign difficulty: dualshockers.com, gamerant.com, mygamingtutorials.com
- Party loot modes: guildorder.com, u4gm.com
- OAuth status: pathofexile.com/developer/docs (snippet only, fetch blocked), pathofexile.com/forum/view-thread/3821465 (snippet only)
- Console API realm parameter: search snippets referencing pathofexile.com/developer/docs/reference
- Monster affix ceiling: general WebSearch snippet aggregation
- Bodach/Olroth uniques: sportskeeda.com, gamerant.com
- Divination cards roadmap: dedicatedgameservers.net (single source, low confidence)

**Domains confirmed blocked (WebFetch) in this sandbox, tested directly this pass:**
pathofexile.com, poe-vault.com, steamcommunity.com, game8.co, repoe-fork.github.io, public-api.org, example.com (control test — confirms near-total non-GitHub egress block, not a gaming-specific denylist)
