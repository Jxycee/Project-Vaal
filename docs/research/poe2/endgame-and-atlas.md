# PoE2 Endgame & Atlas — Research Notes

## Last updated

2026-09-16. Game status: **Early Access**, patch **0.5.5 "Forbidden Rites"** (event league, launched 2026-09-04, running alongside base league **0.5.0 "Return of the Ancients"**, released 2026-05). **1.0 full release is scheduled for 2026-12-11** (not yet live as of this writing) — exits Early Access, adds Duelist class + swords, goes free-to-play on PC/PS5/Xbox Series X|S. Treat everything below as EA-version behavior; re-verify after 1.0 ships since GGG has stated 0.5.0 is the **last EA content patch** before 1.0 (no 0.6.0).

## TL;DR for future Claude sessions

- PoE2's endgame is **not** PoE1's Atlas of Worlds. Layout, terminology, and progression gating are substantially different, even though the goal (map → juice → pinnacle boss) rhymes.
- Maps are called **Waystones**, not "maps." Don't use PoE1 terminology in-app or in docs.
- The Atlas Passive Tree is real, large (~300 points), and **has no full respec** — it's an unlock-everything-eventually tree, not a build-your-own-specialization tree like PoE1's.
- Only 4 PoE1-style rotating league mechanics are core to PoE2 so far: **Breach, Ritual, Expedition, Delirium** (plus **Abyss**, added later as core content, not tied to a league). **Delve and Heist do not exist in PoE2.** Incursion's status is unclear/unconfirmed — do not assert it exists without re-checking.
- PoE2 has its own original endgame structures with no PoE1 equivalent: **Citadels**, **Crisis Fragments**, **Calamity Fragments**, **Precursor Towers/Tablets**, **Desecration/Well of Souls (Abyssal bone crafting)**, and a multi-stage pinnacle chain ending in **Arbiter of Ash → Arbiter of Divinity**.
- Level cap is 100, same as PoE1. Campaign gets you to roughly 60–65; 65→100 is pure endgame grind, exponential XP curve, death penalty (~10% of current level XP lost in maps).

---

## 1. The Atlas system (PoE2 vs PoE1)

| Aspect | PoE1 Atlas of Worlds | PoE2 Atlas (EA, 0.5.x) |
|---|---|---|
| Map unit name | "Maps" | **Waystones** |
| Tree shape | One large unified passive tree, all mechanics interleaved, heavy build-around-a-mechanic specialization | Central trunk + **5 dedicated mechanic sub-trees** (Breach, Ritual, Expedition, Delirium, Abyss), each 12–20 nodes deep, payoff clustered at the end of each branch |
| Points available | Variable, awarded via map completion + bonus objectives | **~300 points** (sources vary 200–301; the 0.5.0 "Return of the Ancients" patch massively expanded the tree from its pre-0.5 size) |
| Respec | Free/cheap respec via Orb of Regret-equivalent, always available | **No respec.** Design goal is "eventually unlock the whole tree" rather than committing to a build |
| Keystones | Available early, cheap to reach, defines your whole map strategy | Sit at the **end of long investment chains**, not early picks; as of 0.5 keystones have **multi-choice options** changeable at any time |
| How points are earned | Map completion bonus objectives, bonus atlas objectives | 1 point per map completed in that mechanic's region; **6 points per pinnacle boss kill** (including "quest" first-kill versions); **2 points per Citadel boss kill**; Doryani-related quests grant 2 points each; must beat pinnacle bosses at **4 difficulty levels** to fully unlock all 8 points tied to that mechanic's tree |
| Sextant equivalent | Sextants applied to Watchstone-controlled regions | **Precursor Tablets** applied at **Precursor Towers** — a tablet buffs a whole cluster of maps around a tower (regional map juice), not a single map |

### Atlas progression flow (0.5.x)
1. Complete campaign (Acts 1–3, then Cruel — see leveling section) to unlock the Atlas.
2. Run Waystones (Tier 1–15 base) radiating out from a start point; clearing map nodes and their bonus objectives grants Atlas Passive points region-by-region.
3. Distinct regions of the Atlas correspond to distinct league mechanics — Breach, Ritual, Expedition, Delirium, Abyss each have their own map-node cluster, questline, and dedicated pinnacle boss at the end.
4. **Citadels** (see §4) are separate large structures scattered on the Atlas map — each houses an "Uber Act Boss" that is the gate to the final pinnacle chain (Arbiter of Ash → Arbiter of Divinity).
5. Full Atlas completion (endgame-complete state) requires allocating points across all mechanic sub-trees, clearing all Citadels, and killing the top pinnacle(s).

---

## 2. Waystones (maps) — tiers, corruption, modifiers, sustain

**Naming**: PoE2 explicitly calls these **Waystones**, never "maps" in UI text (community still says "mapping" as a verb). Use "Waystone" in all Project Vaal copy referring to PoE2.

### Tiers
- **Tier 1–15** are the standard drop range. Tier 1 opens a level 65 area; each tier adds +1 area level, so **Tier 15 = level 79 area**. Tier 15 is the highest tier that drops naturally.
- **Tier 16**: only obtainable by using a **Vaal Orb** on a non-corrupted Tier 15 Waystone (see Corruption below).
- **"Tier 17/18/19"**: not real Waystone tiers — these are colloquial shorthand for a Tier 16 Waystone carrying the **Corrupted** or **Irradiated** Atlas-node modifiers, which push effective monster level up (~81+) without a literal higher tier number existing.

### Corruption (Vaal Orb on Waystones)
Using a Vaal Orb on a Tier 15 (non-corrupted) Waystone has 4 possible outcomes:
1. Converts to Tier 16 Waystone.
2. Converts down to Tier 14 Waystone.
3. Rerolls the Waystone's modifiers (no tier change).
4. Nothing happens.

Separately, **map-area corruption** (an in-map hazard, distinct from Vaal-Orb Waystone corruption) requires killing all powerful/rare/unique enemies to "cleanse" the corruption before an area is marked complete and further progression opens; corrupted areas carry an extra random special modifier stacked on top of the normal Waystone modifier, for more risk/reward.

### Modifiers & tablets
- Waystones roll modifiers like PoE1 maps (via Orb of Alchemy for a 4-mod roll, plus higher-tier crafting currencies).
- **Tablet slots scale with Waystone rarity**: white = 0 tablet slots, blue = 1, yellow = 2 (up to 3 if it rolls 6 modifiers).
- **Precursor Tablets** slot into **Precursor Towers** (fixed structures on the Atlas map, not per-Waystone) and buff every map node in that tower's radius — e.g., increased Breach frequency, extra rare monsters, more clasped hands (Ritual), increased monster density. Tablets themselves can be modified with up to 2 additional mods. This is the closest PoE2 analogue to PoE1 sextants, but it's tower-radius-based rather than watchstone-region-based.

### Map sustain
- Boss-containing map nodes have a **100% chance to drop a Waystone one tier higher** than the one used to enter.
- The final rare monster in a map without its own boss **always drops a same-tier Waystone**, so any fully-cleared map returns at least 1 same-tier Waystone.
- Best sustain practice per community guides: run your highest-rarity Waystones specifically on boss nodes, spec Atlas passives that boost Waystone drop chance/quantity, and roll maps to 4 mods with Orb of Alchemy. Even so, players report real RNG variance/dry spells sustaining Tier 15+ despite 150%+ waystone-drop-chance investment — sustain is a known pain point, not a solved problem, in 0.5.x.

---

## 3. League mechanics on the Atlas

### Confirmed core (ported/reworked from PoE1, present as of 0.5.x)
| Mechanic | Status in PoE2 | Notes |
|---|---|---|
| **Ritual** | Core Atlas mechanic | Rite/tribute system; "Offering to the King" bar fills from Ritual encounters → unlocks **The King in the Mists** fight (via "An Audience with the King" item + hidden Atlas zone "Crux of Nothingness") → drops "Head of the King" → deliver to effigy at Caer Tarth → complete 5-map "Rite of the Nameless," collect 5 "Call of the Shadows" pieces → fight pinnacle boss **The Bodach**. 0.5.5 (Forbidden Rites) reworked Ritual's farming meta further. |
| **Breach** | Core Atlas mechanic | Breach Splinters drop from Hiveborn inside Breaches → offered at the Realmgate (Atlas center) → 300 splinters auto-combine into a "Revelatory Wombgift" → taken to the Genesis Tree → becomes a **Breachstone** → used to fight pinnacle boss **Xesht, We That Are One** (questline: stabilize 5 Unstable Breaches first). |
| **Expedition** | Core Atlas mechanic | Uses **Logbooks** (need iLvl 79+ for the pinnacle path) instead of PoE1's Nemesis-faction dig sites in the same form; detonate explosives near map markers; ~15–25% chance per suitable Logbook to spawn pinnacle boss **Olroth, Origin of the Fall** in the Kalguuran Tomb (reached via Runic Splinters at a Realmgate). |
| **Delirium** | Core Atlas mechanic | Fog-based mechanic, "Distilled Emotions"/Simulacrum Splinters analogous to PoE1's Simulacrum Splinters; 300 Splinters build a **Simulacrum**, placed at the Atlas-center Realmgate; pinnacle fight can spawn **Kosis, the Revelation** (hardest) or **Omniphobia, Fear Manifest** (no unique loot table of its own) at wave 15; first clear per difficulty drops a "Deranging Book of Knowledge" (2 Delirium Atlas points). |
| **Abyss** | Core Atlas content (added patch 0.4.0, "Last of the Druids") | Not tied to a rotating "league" — folded straight into core Atlas as permanent content. Triggers a quest leading to Abyssal cracks radiating from the "Well of Souls"; clearing Abyss map nodes closes cracks + grants Abyss Atlas points; ends in **Abyssal Depths** with faction bosses. Abyss is also the resource engine for **Desecration/Well of Souls crafting** (see below). |

### PoE2-only endgame crafting system tied to Abyss
- **Desecration**: pick 1-of-3 hidden modifiers to add to a rare item, using **Preserved Bones / Abyssal Bones** currency dropped by Abyss content (Abyssal Troves, Abyssal Depths).
- **Well of Souls**: the crafting station where desecrated modifiers are applied.
- Abyssal Commanders **Tasgul** and **Vandroth** (level 79+ maps) plus the final Large Abyssal Trove reliably drop this currency (post-0.5.3).
- Defeating certain Abyss bosses grants a **Kulemak's Invitation**, gating a pinnacle boss called **Vessel of Kulemak**.
- Rare Precursor Tablets became craftable via this system after Arbiter of Ash is defeated (0.4.0+).

### Confirmed NOT in PoE2 (as of 0.5.x)
- **Delve** — not present. No sourced references to Delve/Azurite/Sulphite mechanics in PoE2.
- **Heist** — not present. Community forum feedback explicitly notes its absence ("Where is blight, betrayal, heist, delve, etc.").
- **Blight, Betrayal** — same forum thread lists these as absent too; treat as unconfirmed/not-present, re-verify before writing app copy that assumes otherwise.

### Uncertain / needs re-verification
- **Incursion**: one source's endgame-activities summary lists Breach/Ritual/Delirium/Expedition/Abyss/**Incursion** together as endgame activity types, but this was not independently corroborated with a dedicated Incursion mechanic page in this research pass. **Do not assert Incursion exists in PoE2 without checking a current patch-notes or wiki source first.**

### The current (Sept 2026) league mechanic: Forbidden Rites
- Event league (0.5.5), launched 2026-09-04, layered on top of the 0.5.0 "Return of the Ancients" base league — it does not replace the base league, runs its own economy/ladder for a shorter window.
- Mechanic: **Ritual Altars** now appear in every campaign zone (not just scattered special encounters). Interacting summons monsters in an effigy's circle; "plagues" spawn to hinder you; killing monsters offers their blood as **Tribute**.
- Bosses in these zones can be resurrected and refought while a plague effect spreads.
- Effigies are placed directly on top of that zone's normal boss fight (boss rooms double as ritual rooms).
- Tribute decays: each monster revival grants 25% less tribute than the previous.
- Multiplayer: each player gets **personal tribute** and picks their own rewards (not shared/rolled once per party).
- New reward type: **Sacred Blooms**, usable to add a **Viridian Wildwood** map cluster to your Atlas.
- Framing: PC Gamer described it as "oops, all bosses" — heavy rework/re-emphasis of Ritual as a boss-rush event, and GGG used it to also rework "its worst mode" (exact mode unspecified in the snippet available — re-check patch notes for which mode).

### How past mechanics fold into permanent content
- PoE2's permanent league is **Standard**: characters/items are never wiped; when a temporary Challenge League (~3–4 month cadence, PoE1-style fresh economy/ladder) ends, characters and items **migrate into Standard without a full wipe**.
- GGG's pattern: a mechanic ships as a temporary league's headline feature, then gets folded into **core Atlas content** for everyone (temporary and Standard alike) once the league ends — this is exactly how **Abyss** (originally a 0.4.0 league feature) became permanent core content. Expect the same fate for Forbidden Rites' surviving elements (e.g., Sacred Blooms/Viridian Wildwood) after the event league window closes.

---

## 4. Citadels

PoE2-original structure, **no PoE1 equivalent**. Citadels are large, randomly-generated structures on the Atlas map, each housing an "Uber Act Boss" — a much harder version of one of the campaign Act 1–3 final bosses.

| Citadel | Boss | Fragment dropped (normal) | Fragment dropped (10/10 Map Boss Atlas tree) |
|---|---|---|---|
| Stone Citadel | Doryani, Royal Thaumaturge | Ancient Crisis Fragment | Calamity Fragment (primary) |
| Copper Citadel | Jamanra, the Abomination | Faded Crisis Fragment | Secondary Calamity Fragment |
| Iron Citadel | Count Geonor | Weathered Crisis Fragment | Calamity Fragment (tertiary) |

- Citadel bosses grant **2 Atlas Passive points each** on kill (in addition to their fragment drop).
- Fragment drop **quantity** scales with the "Waystone Drop Chance" multiplier on the Waystone used to enter the Citadel.
- Collecting 1 of each Crisis Fragment (Ancient + Faded + Weathered) and bringing them to **The Burning Monolith** summons the first true pinnacle: **The Arbiter of Ash**.
- If all 10 points are allocated in the **Map Boss** Atlas sub-tree, Citadel bosses drop **Calamity Fragments** instead of Crisis Fragments — these gate the harder **Uber Arbiter** encounter and other Uber-tier Atlas boss content.

---

## 5. Pinnacle / endgame bosses — full reference

| Boss | Mechanic gated behind | Summon requirement (summary) |
|---|---|---|
| **Xesht, We That Are One** | Breach | Stabilize 5 Unstable Breaches (intro questline) → farm 300 Breach Splinters → auto-forms Revelatory Wombgift → birth into Breachstone at the Genesis Tree → use Breachstone |
| **The Bodach** | Ritual | Fill Ritual tribute bar → beat **The King in the Mists** (via "An Audience with the King" + Crux of Nothingness zone) → get "Head of the King" → deliver to effigy at Caer Tarth → clear 5-map "Rite of the Nameless" → collect 5 "Call of the Shadows" → attach to effigy → fight |
| **Olroth, Origin of the Fall** | Expedition | Find/buy iLvl 79+ Logbook → detonate charge at the map's skull icon → ~15–25% chance to open Kalguuran Tomb (reached via Runic Splinters at a Realmgate) |
| **Kosis, the Revelation** / **Omniphobia, Fear Manifest** | Delirium | Farm 300 Simulacrum/Distilled-Emotion Splinters → form Simulacrum → place at Atlas-center Realmgate → survive to Wave 15 (Kosis odds increase near wave 15; Omniphobia can spawn instead, no unique loot table of its own) |
| **Vessel of Kulemak** | Abyss / Desecration | Beat specific Abyss bosses for a "Kulemak's Invitation" |
| **Doryani, Royal Thaumaturge** | Citadel (Stone) | Enter Stone Citadel via Waystone |
| **Jamanra, the Abomination** | Citadel (Copper) | Enter Copper Citadel via Waystone |
| **Count Geonor** | Citadel (Iron) | Enter Iron Citadel via Waystone |
| **The Arbiter of Ash** | Citadel chain (all 3) | Collect all 3 Crisis Fragments (Ancient, Faded, Weathered) → bring to The Burning Monolith |
| **Uber Arbiter (of Ash)** | Citadel chain, hard mode | Collect 3 **Calamity Fragments** (requires 10/10 Map Boss Atlas tree, so Citadel bosses drop Calamity instead of Crisis fragments) → Burning Monolith |
| **The Arbiter of Divinity** | Top-of-Atlas pinnacle, gated behind Arbiter of Ash | Beat Arbiter of Ash → clear **Patriarch Hall** (needs T15 Waystone; boss **Phya** drops "Origin Spark") and **Matriarch Hall** (needs T15 Waystone; boss **Phyx** drops "Origin Cradle") → slot both into the Precursor Reactor at the **Origin Tower** → forge "Origin Core" → place atop tower → fight |
| **Zarokh, the Temporal** | Trial of Sekhemas (ascendancy trial, repeatable) | Complete Trial of Sekhemas rooms |
| **The Trialmaster** | Trial of Chaos (ascendancy trial, repeatable) | Complete Trial of Chaos rooms |

**Design note**: Arbiter of Ash used to be the *final* pinnacle pre-0.5.0; the 0.5.0 "Return of the Ancients" patch demoted it to a **gateway boss** and added **Arbiter of Divinity** at the Origin Tower as the new top-of-game pinnacle. The Arbiter of Ash fight itself was also rebalanced in 0.5.x (dropped "all elemental resistances," now has Fire Resistance + Cold Vulnerability specifically).

### Trials (ascendancy-point gates, also repeatable in endgame)
- **Trial of Sekhemas**: unlocked in Act 2 after defeating Balbala; roguelike gauntlet of challenge rooms + bosses culminating in Zarokh, the Temporal; signature reward is **Time-Lost Jewels** (modify passive-tree nodes in radius).
- **Trial of Chaos**: unlocked in Act 3 after defeating Xyclucian; culminates in The Trialmaster.
- Either trial alone can grant all **8 Ascendancy points**; you are not required to run both. Standard efficient route mixes both trials across character levels 60–75+ (uses a "Djinn Barya" item at 60+, and Trial of Sekhemas at 75+ or Trial of Chaos at 65+ with all 3 "Fates" active, to get points 7–8).
- These trials remain runnable post-campaign as a repeatable endgame activity for jewels/currency, distinct from the Atlas-mechanic pinnacles above.

---

## 6. Character level cap & endgame leveling

- **Level cap: 100** (same numeric cap as PoE1).
- Campaign (Acts 1–3, normal) gets a typical character to roughly **level 45**; a repeat "Cruel" difficulty pass (PoE2's structure, distinct from PoE1's old cruel/merciless triad — verify exact current campaign-difficulty structure before relying on this, it has changed across EA patches) pushes to roughly **level 60–65** by campaign's end.
- From there, **100% of further leveling happens in the endgame Atlas** (Waystone mapping + pinnacle bosses).
- XP curve is exponential: the jump from **99→100 costs roughly as much XP as levels 1–99 combined**.
- **Death penalty in maps**: losing a life strips **10% of current level's XP**, which can delete significant map-clearing progress at high level.
- Typical time investment to reach 100 is cited at **150–300+ hours**, with the great majority of that being the 90→100 stretch. Level 100 is widely treated as a prestige/ladder goal rather than a power requirement — most builds are "functionally complete" in the low-to-mid 90s.

---

## 7. Multiplayer / parties / guilds in endgame

- PoE2 is always-online; supports **guilds** and **parties**, full co-op through both campaign and endgame.
- **Party size cap: 6 players.**
- **Difficulty scaling**: more players in a party increases monster HP but also increases loot quantity (quantity-up/HP-up scaling, PoE-style).
- **Level scaling**: optional, toggled by the **party leader only**. When enabled, higher-level characters are scaled down to match lower-level content with **no XP penalty**, though a scaled-down character earns XP as if it were fighting monsters at its effective (scaled) level, not its true level.
- Loot allocation reportedly has **three allocation modes** (exact mode names not verified in this pass — re-check in-game options before writing app-facing copy).
- Community guidance: 3–4 players is the practical sweet spot for routine mapping; full 6-player parties are reserved for coordinated speed-clear/juiced-map groups where every slot is a fast, well-geared mapper (since HP scaling punishes slow/undergeared parties disproportionately).

---

## 8. Recent major endgame patches (2025–2026)

| Version | Name | Approx. date | Major endgame changes |
|---|---|---|---|
| 0.1.0 | Early Access launch | 2024-12-06 | Base game launch, 6 classes (Warrior, Witch, Ranger, Mercenary, Sorceress, Monk) |
| 0.2.0 | Dawn of the Hunt | 2025-04 | — (not deep-dived this pass) |
| 0.3.0 | The Third Edict | 2025-08 | Well of Souls / Desecration crafting system introduced |
| 0.4.0 | Last of the Druids | 2025-12 | **Abyss** promoted to core/permanent Atlas content; rare Precursor Tablet crafting unlocked post-Arbiter-of-Ash |
| 0.5.0 | Return of the Ancients | 2026-05 | **Atlas Passive Tree massive rework/expansion** (~200→~300 points, 5 dedicated mechanic sub-trees, multi-choice keystones, no more respec); Citadels/Arbiter chain restructured — Arbiter of Ash demoted to gateway boss; **Arbiter of Divinity** added as new top pinnacle at the Origin Tower; final EA content patch before 1.0 |
| 0.5.3 | (point release) | 2026 (pre-Sept) | Abyssal Commanders Tasgul/Vandroth + final Large Abyssal Trove made reliable Desecrated Currency sources |
| 0.5.4 | (point release) | 2026 (pre-Sept) | Referenced as adding "an even harder Arbiter of Divinity" difficulty tier — re-verify exact wording/scope in patch notes |
| 0.5.5 | Forbidden Rites (event league) | 2026-09-04 | New event league layered on 0.5.0 base league; Ritual/Expedition farming-meta changes; see §3 |
| 1.0 | (full release, unnamed as researched) | **2026-12-11 (scheduled, not yet live)** | Exits Early Access; adds Duelist class + swords, 12 base classes / 36 ascendancies total, 6 campaign acts, "100+ boss maps" claimed in endgame; game becomes free-to-play on PC/PS5/Xbox Series X\|S |

---

## 9. Open questions / things to re-verify before relying on this doc

- Exact current wording/scope of "Arbiter of Divinity" 0.5.4 difficulty change.
- Whether **Incursion** is actually a PoE2 mechanic (mixed signal, see §3).
- Exact 3 party loot-allocation modes' names/behavior.
- Current campaign difficulty structure (Normal/Cruel terminology may have changed since early EA).
- What exactly "0.5.5 reworked its worst mode" (PC Gamer headline) refers to.
- All of §3–§8 should be re-checked against 1.0 patch notes once it ships 2026-12-11 — GGG has signaled 1.0 includes an endgame overhaul ("100+ boss maps" claim needs decoding: likely marketing shorthand, not a literal new count of pinnacle-tier bosses).

---

## Sources

- https://massivelyop.com/2026/08/28/path-of-exile-2-previews-september-4s-forbidden-rites-league-and-1-0s-new-duelist-class/
- https://www.pcgamer.com/games/rpg/path-of-exile-2s-first-event-league-goes-oops-all-bosses-and-reworks-its-worst-mode-so-sane-people-can-finally-enjoy-it/
- https://massivelyop.com/2026/09/01/path-of-exile-2-answers-questions-about-its-upcoming-forbidden-rites-league/
- https://outof.games/news/9741-path-of-exile-2s-forbidden-rites-league-launches-september-4th-with-tons-of-changes/
- https://ggseason.com/blog/path-of-exile-2-all-leagues-dates/
- https://www.arpg-timeline.com/game/path-of-exile2
- https://egamersworld.com/blog/path-of-exile-2-forbidden-rites-league-start-time--FIhcm05hg
- https://www.slashskill.com/path-of-exile-current-league/
- https://game8.co/games/Path-of-Exile-2/archives/491366
- https://mobalytics.gg/poe-2/guides/endgame-progression-asmodeus
- https://www.pvpbank.com/poe-2-get-atlas-passive-points
- https://mmonster.co/blog/poe-2-atlas-tree-guide
- https://www.u4gm.com/path-of-exile-2/blog-path-of-exile-2-atlas-passive-points-guide
- https://www.playerauctions.com/path-of-exile-2-guide/tips-guides/complete-atlas-tree-passive-skills-list/
- https://www.g4mmo.com/poe-2-atlas-passive-skill-points-guide
- https://www.switchbladegaming.com/path-of-exile-2/atlas-progression-guide/
- https://pathofexile2.wiki.fextralife.com/Waystones
- https://gamerant.com/path-of-exile-2-how-to-get-tier-16-17-18-19-waystones-poe2/
- https://poe2path.com/guides/poe2-waystone-system-guide/
- https://www.poecurrency.com/news/poe-2-how-to-get-waystones-to-unlock-higher-tier-maps
- https://www.poecurrency.com/news/poe-2-patch-0-4-0-build-tier-16-maps-double-corrupt-gems-extract-idols-for-currency-saving
- https://odealo.com/articles/path-of-exile-2-corruption-guide
- https://expcarry.com/poe-2-waystone-mapping-guide
- https://maxroll.gg/poe2/resources/pinnacle-bosses
- https://www.sportskeeda.com/mmo/path-exile-2-poe2-pinnacle-boss
- https://www.sportskeeda.com/mmo/path-exile-2-arbiter-divinity-pinnacle-boss-guide
- https://epiccarry.com/blogs/poe-2-pinnacle-boss-guide/
- https://timesaver.gg/blog/poe2-pinnacle-bosses-guide
- https://dving.net/guides/path-of-exile-2-guides/pinnacle-bosses
- https://expcarry.com/poe2-boss-access
- https://maxroll.gg/poe2/news/0-5-5-forbidden-rites-patch-notes
- https://pathofexile.gg/0-5-5-patch-notes/
- https://www.iggm.com/news/poe-2-0-5-5-patch-notes-how-ritual-expedition-reshape-forbidden-rites-farming
- https://www.poecurrency.com/news/poe-2-patch-0-5-0-arbiter-of-ash-pinnacle-boss-remains-source-of-currency-farming
- https://www.ezg.com/blog/poe-2-patch-0-5-3-the-arbiter-of-ash-guide-entry-tickets-build-strategy
- https://timesaver.gg/blog/poe2-arbiter-of-ash-guide
- https://timesaver.gg/blog/poe2-citadel-guide
- https://pathofexile2.wiki.fextralife.com/Delirium
- https://maxroll.gg/poe2/resources/endgame-activities
- https://www.pathofexile.com/forum/view-thread/3711696
- https://poe2path.com/guides/poe2-delirium-mechanics-guide/
- https://poe2hub.net/mechanics/delirium/
- https://www.sportskeeda.com/mmo/path-exile-2-poe2-how-unlock-get-league-atlas-passive-delirium-breach-ritual-expedition-bossing
- https://www.sportskeeda.com/mmo/path-exile-2-poe2-delirium-guide
- https://game8.co/games/Path-of-Exile-2/archives/489082
- https://gamerant.com/path-of-exile-2-max-level-cap-poe2-maximum-level-milestones-leveling-progression/
- https://thebasedotaku.com/guides/level-up-path-of-exile-2/
- https://timesaver.gg/blog/poe2-how-long-to-reach-level-100
- https://www.aoeah.com/news/3689--poe-2-fast-1100-leveling-guide-earlymidlate-game-progression
- https://grindout.com/poe-2/guides/leveling
- https://leprestore.com/guides/poe-2/leveling-guide-how-to-reach-level-100/
- https://maxroll.gg/poe2/news/path-of-exile-2-1-0-to-launch-december-11th
- https://fextralife.com/path-of-exile-2-10-release-date-revealed-the-wait-is-almost-over-after/
- https://en.wikipedia.org/wiki/Path_of_Exile_2
- https://games.gg/news/path-of-exile-2-version-1-0-release-date/
- https://www.allkeyshop.com/blog/path-of-exile-2-1-0-release-date-news-r/
- https://www.gamenguide.com/articles/108875/20260826/path-exile-2-10-release-date-set-december-2026-pc-consoles.htm
- https://www.ezg.com/blog/poe-2-1-0-release-date-confirmed-december-11-duelist-and-swords-full-launch-details-revealed
- https://www.mmoexp.com/News/path-of-exile-2-1-0-full-release-date-duelist-class-free-to-play-everything-you-need-to-know.html
- https://gamerant.com/path-of-exile-2-best-atlas-skill-tree-setup-poe2/
- https://www.mmomax.com/news/path-of-exile-2-atlas-tree-best-nodes-build-suggestions.html
- https://timesaver.gg/blog/poe2-atlas-tree-currency-farming-guide
- https://eloking.com/blog/guide-to-atlas-skill-tree-in-poe-2
- https://www.switchbladegaming.com/path-of-exile-2/atlas-keystone-guide/
- https://boostmatch.gg/blog/poe-2/articles/poe2-atlas-tree-guide-0-5-0-return-of-the-ancients
- https://gamemarket.gg/news/path-of-exile-2/poe-2-atlas-tree-guide-0-5-best-routing-towers-citadel-path
- https://timesaver.gg/blog/poe2-atlas-guide
- https://www.exitlag.com/blog/path-of-exile-2-party-size/
- https://game8.co/games/Path-of-Exile-2/archives/497855
- https://gamerant.com/path-of-exile-2-poe2-is-there-level-scaling/
- https://www.pathofexile.com/forum/view-thread/3599092
- https://guildorder.com/games/poe2/guides/party-mapping-and-loot-rules
- https://rlhighscore.com/gaming/co-op-party-scaling-in-path-of-exile-monster-life-experience-loot-and-flasks/
- https://gamegenie.com/games/path-of-exile-2/posts/how-will-the-difficulty-scale-in-multiplayer
- https://maxroll.gg/poe2/getting-started/trials-of-ascendancy
- https://expertgamereviews.com/path-of-exile-2-complete-trials-of-ascendancy-guide/
- https://poe2.stratlore.com/en/guides/ascendancy-points-trials-guide/
- https://timesaver.gg/blog/poe2-trial-of-chaos-guide
- https://conquestcapped.com/guides/path-of-exile-2/ascendancy-points-guide/
- https://boostmatch.gg/blog/poe-2/articles/poe2-trials-guide-patch-05-return-of-the-ancients
- https://maxroll.gg/poe2/resources/olroth-origin-of-the-fall-boss-guide (via search snippet)
- https://www.poe-vault.com/poe2/guides/olroth-origin-of-the-fall-boss-guide
- https://www.poewiki.net/wiki/poe2wiki:Olroth,_Origin_of_the_Fall
- https://game8.co/games/Path-of-Exile-2/archives/492043
- https://poe2.stratlore.com/en/bosses/olroth-origin-of-the-fall/
- https://www.poecurrency.com/news/poe-2-how-to-get-the-many-loots-from-olroth-origin-of-the-fall
- https://www.mtmmo.com/news/2125--poe-2-olroth-guide-location-spawn-rate-drops-loot-table-and-combat-strategy
- https://www.sportskeeda.com/mmo/path-exile-2-olroth-origin-fall-boss-guide
- https://game8.co/games/Path-of-Exile-2/archives/495435
- https://onlyfarms.gg/guides/path-of-exile-2-delirium-league-guide/
- https://www.utnfl.com/News/path-of-exile-2-the-simulacrum-guide.html
- https://conquestcapped.com/guides/path-of-exile-2/delirium-league-guide/
- https://boostmatch.gg/blog/poe-2/articles/poe2-delirium-guide-0-5-fog-simulacrum-tangmazu
- https://mobalytics.gg/poe-2/guides/leagues
- https://www.arpgseasons.com/en/guides/poe-league-cycle
- https://poe2path.com/guides/poe2-seasonal-mechanics-guide/
- https://gamingcy.com/blog/poe2-leagues-all-dates
- https://www.aoeah.com/news/4294--poe-2-roadmap-2026-05-new-league-classes-full-release--more-leaks
- https://game8.co/games/Path-of-Exile-2/archives/604768
- https://pathofexile2.wiki.fextralife.com/Arbiter+of+Divinity
- https://poe2db.tw/us/
- https://timesaver.gg/blog/poe2-arbiter-of-divinity-guide
- https://expcarry.com/poe-2-arbiter-of-divinity-origin-tower-mechanics-drops-guide
- https://maxroll.gg/poe2/bosses/the-stone-citadel-doryani-royal-thaumaturge-boss-guide
- https://pathofexile2.wiki.fextralife.com/Citadel
- https://www.pcgamesn.com/path-of-exile-2/doryani-boss
- https://www.poe2wiki.net/wiki/Calamity_Fragment
- https://medium.com/@Komorebi101/how-to-fight-uber-arbiter-in-path-of-exile-2-fed57087635e
- https://www.poe2wiki.net/wiki/Secondary_Calamity_Fragment
- https://mobalytics.gg/poe-2/guides/uber-arbiter-calamity-fragments
- https://www.pathofexile.com/forum/view-thread/3811169/page/10
- https://pathofexile2.wiki.fextralife.com/Patch+Notes
- https://poe2hub.net/news/roadmap/
- https://gamerinsight.blog/latest-updates/path-of-exile-2-update-and-release-dates/
- https://poetrades.net/poe2-patch-notes/
- https://www.notebookcheck.net/Path-of-Exile-2-early-access-is-now-getting-delayed-to-December.910377.0.html
- https://maxroll.gg/poe2/resources/abyss
- https://pathofexile2.wiki.fextralife.com/Endgame+Guide
- https://www.sportskeeda.com/mmo/path-exile-2-best-abyss-atlas-tree-progression
- https://pathofexile.gg/path-of-exile-2-atlas-guide/
- https://boostmatch.gg/blog/poe-2/articles/path-of-exile-2-abyss-guide-0-4-0
- https://www.iggm.com/news/poe-2-patch-0-4-0-how-to-complete-abyss-to-earn-rewards
- https://pathofexile2.wiki.fextralife.com/Tablets
- https://mobalytics.gg/poe-2/guides/towers-and-tablets
- https://maxroll.gg/poe2/resources/rolling-waystones-and-precursor-tablets
- https://timesaver.gg/blog/poe2-tablets-and-towers-guide
- https://odealo.com/articles/path-of-exile-2-precursor-towers-and-tablets-guide
- https://static.odealo.com/articles/path-of-exile-2-precursor-towers-and-tablets-guide
- https://sportskeeda.com/mmo/path-exile-2-poe2-atlas-tips-and-tricks
- https://www.sportskeeda.com/mmo/path-exile-2-how-juice-maps-post-0-3-1-changes
- https://vulkk.com/2025/09/05/path-of-exile-2-abyss-league-mechanics-explained/
- https://vulkk.com/2025/09/05/path-of-exile-2-desecration-crafting-guide/
- https://expertgamereviews.com/path-of-exile-2-desecrated-modifiers-and-abyss-crafting-guide/
- https://timesaver.gg/blog/poe2-desecrated-currency-guide
- https://www.u4n.com/news/list-of-poe-2-desecrates-currency-ancient-bones.html
- https://www.iggm.com/news/poe-2-how-do-desecrated-items-and-well-of-souls-relate
- https://www.poecurrency.com/news/poe-2-patch-0-3-0-how-does-well-of-souls-crafting-system-work
- https://gamerant.com/path-of-exile-2-how-to-sustain-waystone-mapping-poe2/
- https://www.u4gm.com/path-of-exile-2/blog-path-of-exile-2-how-to-sustain-your-mapping-with-waystones
- https://timesaver.gg/blog/poe2-waystone-farming-guide
- https://www.iggm.com/news/poe-2-how-to-sustain-mapping-waystones-farming
- https://www.mmoexp.com/News/path-of-exile-2-how-to-sustain-waystones-while-mapping.html
- https://pathofexile2.wiki.fextralife.com/Forbidden+Rites
- https://guides-factory.com/guides/poe2-forbidden-rites-event-guide-0-5-5
- https://skycoach.gg/blog/path-of-exile-2/articles/forbidden-rites-guide
- https://overgear.com/guides/poe-2/forbidden-rites-overview/
- https://www.rpgstash.com/blog/poe-2-patch-update
- https://playhub.com/blog/poe2/forbidden-rites-event-guide-078408
- https://expcarry.com/poe-2-forbidden-rites-event-guide-farming-strategy

**Note on sourcing method**: Direct WebFetch access to most primary wikis (pathofexile2.wiki.fextralife.com, maxroll.gg, poe2wiki.net, poe2db.tw, pathofexile.com, game8.co, pathofexile.gg, pcgamer.com) was blocked by this session's network egress proxy. All findings above are synthesized from WebSearch result snippets (which quote/summarize these same primary sources) rather than full-page fetches. Re-verify load-bearing numbers (Atlas point totals, exact patch version numbers, fragment names) directly against pathofexile2.com and poe2wiki.net when direct fetch access is available.
