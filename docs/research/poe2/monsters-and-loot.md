# PoE2 Monsters and Loot Systems

## Last updated
2026-09-16 — patch **0.5.5 "Forbidden Rites"** (event/challenge league layered on base patch **0.5.0 "Return of the Ancients"**). Cross-referenced against `docs/research/poe2/endgame-and-atlas.md` for league-mechanic facts; no contradictions found.

---

## 1. Monster rarity tiers

PoE2 uses the same four-tier rarity naming as PoE1, but the design intent is heavier ("mini-boss" rather than "annoying elite pack"):

| Tier | Name color | Notes |
|---|---|---|
| Normal | White | Baseline monster, no affixes. |
| Magic | Blue | 1–2 affixes. Each affix adds to both threat *and* the rarity/quantity of its drops — a 2-affix magic monster is a better kill than a 1-affix one. |
| Rare | Yellow | Standard configuration is **3 affixes, one of which may be an aura mod**; sources vary between "2–4" and "up to 4" as the affix range, and **Atlas Passives can push rare-monster affix count higher still** ("Rare Monster Scaling" passives exist). Rares are explicitly designed to sometimes hit harder than uniques/bosses depending on rolled affixes. |
| Unique | Orange/gold | Named, scripted monsters (or unique-boss variants of an area). Highest baseline loot. |

**Design framing (community + GGG messaging):** rare monsters "feel like mini-bosses" — they get **chaos-damage auras, curses, and well-telegraphed attacks** that can kill an undergeared or inattentive player. This is a deliberate escalation from PoE1, where rares were mostly a loot-density lever rather than a genuine threat check.

### Do Magic/Rare monsters roll random prefix/suffix affixes like PoE1?
**Yes, functionally similar in spirit** — magic and rare monsters roll randomized modifiers from a shared monster-affix pool (speed buffs, damage buffs, defense buffs, environmental hazards, curses, minion-granting mods, auras), analogous to PoE1's rare-monster-mod system. It is **not** confirmed that PoE2 monster mods are split into a strict "prefix/suffix" structure the way *items* are (item rare affixes in PoE2 are explicitly prefix/suffix, up to 3+3 — see below) — the searchable sources describe monster mods as one flat pool of categories rather than a prefix/suffix taxonomy. Treat "prefix/suffix" framing as an **item** concept in PoE2, and "affix pool by category" as the **monster** concept, until a primary-source (patch notes / dev post) confirms otherwise.

### Item modifier structure (for contrast, not monster-specific)
- Rare **items** can hold up to **3 prefixes and 3 suffixes** (6 total), same ceiling as PoE1.
- Prefix mods generally = offense/defense stat rolls; suffix mods generally = resistances/attributes/utility — same convention as PoE1.

### Notable dangerous affix combos players warn about
- **Chaos damage rares/map mods**: called out repeatedly as the single worst combo, because **max chaos resistance is capped at 75%** while elemental resistances can be capped at 90% (via passive tree/gear), making chaos-damage-dealing rares disproportionately lethal relative to elemental ones.
- **Aura-carrying rares** (one of the 3 standard affixes can be an aura) stacking with pack density — an aura rare buffing its whole pack (e.g., extra damage/speed auras) is far more dangerous than the same rare alone.
- **Curse-applying rares** layered with damage-buff affixes — curses lower player defense/resistance right as damage output is also boosted.
- General community heuristic: **read affixes before engaging** — guides categorize monster mods into Speed / Damage / Defence / Environmental Hazard / Curse / Minion buckets specifically so players can eyeball a rare's mod string and decide fight-or-flight (or which map mods to avoid rolling in the first place).
- Map-level (Waystone) modifiers that add "monsters deal X% increased chaos damage" are flagged as especially punishing for the same 75%-cap reason above.

*(Caveat: a dedicated community reference, exiletown.com/monster-modifiers, was cited repeatedly across searches as the canonical categorized list of monster mods and dangerous combos, but the page itself was unreachable in this research pass — network egress to that domain was blocked. Treat specifics above as WebSearch-snippet synthesis, not a verified primary read.)*

---

## 2. Loot filters

- **No fully-native, GGG-authored strictness system replaces community filters** — the workflow is the same as PoE1: import a community filter file via **Options → Game → Item Filter**, selecting a filter you've "followed" on your PoE account.
- **NeverSink's Filter for PoE2** (GitHub: `NeverSinkDev/NeverSink-Filter-for-PoE2`) is the de facto community standard, continuously updated (handles runes, talismans, gold amulets, soul cores as of 0.5.x).
- **FilterBlade.xyz** is the standard customization front-end for NeverSink's filter, carried over from PoE1, officially supported.
- **poe2filter.com** exists as an alternative custom filter generator.
- **Strictness tiers**: filters commonly ship 4–7 levels — the PC ladder describes **Regular, Semi-Strict, Strict, Very Strict** (some breakdowns list up to 7, "Soft" through "Uber-Plus-Strict"). Guidance: stay on Regular/Semi-Strict through the campaign and early maps (keeps gems/currency/sockets/upgrades visible), move to Strict once gear stabilizes, and only go Very Strict once you're ignoring most visible drops.
- **Hidden-item reveal**: hold **Alt** on PC to reveal filtered-out items (their name text shrinks rather than fully disappearing at high strictness); on **console**, there's a dedicated item-filter panel toggle to reveal hidden items (relevant for Project Vaal's console-player audience).
- Framing from a 2026 source: "the loot filter system is not a comfort feature — it is load-bearing infrastructure" given PoE2's loot volume.

---

## 3. Item drop rarity/quantity mechanics

### Core rule: item level from monster rarity
- **Normal monsters**: drops match area (monster) level.
- **Magic monsters**: drops at **area level + 1**.
- **Rare and Unique monsters**: drops at **area level + 2**.
- This item-level delta determines the max modifier *tier* achievable on that drop — a materially different (simpler, monster-rarity-driven) system than PoE1's more convoluted item-level rules.

### Rarity vs. Quantity stat philosophy — a deliberate PoE1 departure
- GGG's stated intent (per Jonathan Rogers) is to lean on **Item Rarity** much more than **Item Quantity** as the loot-scaling lever in PoE2, a reversal of emphasis from late-PoE1 where Quantity dominated MF metas.
- **Waystone (map) modifiers**: prefix mods on a Waystone generally boost pack size / rarity / quantity of loot; suffix mods generally increase monster difficulty — mirroring the risk/reward framing of PoE1 map mods but now split cleanly along prefix/suffix lines.
- Community rule of thumb for endgame "juicing": target **100–150% increased Rarity of Items Found** across gear/tree/Waystone mods for meaningfully better currency and unique drop odds.

### The 0.2.0 / 0.2.0g "loot overhaul" (May 2025) — major, still-referenced turning point
- **Monster Item Rarity's numerical effect was halved** in the 0.2.0 update (May 2025) as part of rebalancing away from Quantity-stacking metas.
- Patch **0.2.0g** (same window) was the actual "big loot patch": reworked Monster Item Rarity scaling, guaranteed a **Rare item drop from all Unique/campaign bosses** (except a few Act 1 ones) on **first kill**, buffed Magic/Rare chests to guarantee a Magic/Rare item respectively with higher quantity, and rebalanced Rare-Currency (Exalt/Regal/Alchemy-tier) drop rates **up 20–30%** from high-rarity monsters. It also touched Strongbox, Trial, Delirium, Expedition, and pinnacle-encounter reward tables.
- The initial 0.2.0g rollout had a bug that dropped socketed gems from builds, forcing a same-day rollback/redeploy.
- **Ongoing community controversy**: the halving of Item Rarity's effect (and its outsized influence on currency-drop scaling specifically) has been a persistently hot Reddit/forum topic since mid-2025. Jonathan Rogers (GGG) has publicly stated a desire to **remove Item Rarity as a stat entirely**, pending finding a suitable replacement affix to fill the vacated prefix/suffix slots — as of patch 0.5.5 this replacement has **not** shipped; Item Rarity is still live and still contentious.

### Negative-rarity farming (notable emergent player strategy, not a GGG-designed feature)
- Players deliberately push **Item Rarity below 0%** (community benchmarks: -60% to start seeing effect, -80% to -100% for consistency) to **suppress magic/rare item generation and force more Normal ("white") item drops** from high-level monsters.
- Rationale: only **Normal-rarity base items are eligible to roll as "exceptional" bases** (high-tier crafting bases, e.g. iLvl 82 items with extra sockets/overquality), so flooding a rare monster's loot table with magic/rare items actively works against base-farming; negative Rarity corrects for this.
- This has become a recognized mid/late-endgame crafting-supply farming loop, distinct from MF play (see below) — worth Project Vaal documenting as a "why is my Rarity negative" explainer for confused players.

---

## 4. Magic Find (MF) — still exists, still viable, different flavor than PoE1

- MF is a real, named playstyle in PoE2: build around **Item Rarity + Item Quantity** gear/passives, at the cost of damage/survivability/resistances.
- **Viability, 2026**: considered viable, but the 0.2.0 halving of Item Rarity's effect makes it a smaller multiplier than PoE1's late-game MF metas were — it's a genuine trade-off build, not a free-loot cheese.
- **Minion/summoner builds** (Witch ascendancies) are called out as the strongest MF chassis, since minions carry the damage/clear load while the player's own gear is freed up to stack Rarity/Quantity affixes without personal damage loss.
- Both **character-gear Rarity/Quantity** and **Waystone-mod Rarity/Quantity** stack multiplicatively into the same drop-scaling system — a full MF setup combines both levers (juiced Waystone + MF gear) rather than relying on gear alone.
- Negative-rarity farming (above) is effectively "anti-MF" — the two are opposite ends of the same Item-Rarity dial, both intentionally exploited by different parts of the playerbase for different goals (chase-item odds vs. crafting-base supply).

---

## 5. Divination Cards — confirmed NOT in PoE2; nothing has directly replaced the design space

- **Verified: Divination Cards do not exist in PoE2** as of 0.5.5. A `poe2wiki.net` "Divination card" page exists but reflects speculative/community-requested content, not a shipped feature; a GGG forum thread ("A Divination Card System for Path of Exile 2") is a **player feature request**, not a dev announcement.
- **No single 1:1 replacement mechanic exists.** Community consensus (matches the task's stated expectation) is that PoE2 has **not** recreated the "collect a stack of a specific card, turn it in for a themed guaranteed reward" chase-item design space. Instead, the equivalent chase-item pressure is distributed across several other systems:
  - **Boss-locked unique drop pools** (Section 6) — direct farming target replaces "farm this card set."
  - **Reliquary Keys / Foiled Uniques** (Section 6) — a *targeted-acquisition* mechanic that is the closest functional analogue to "spend a currency-like item to guarantee a chosen unique," which is conceptually adjacent to what Divination Cards did (converting farming effort into a chosen specific item) even though the mechanics (key + vault vs. card-stack turn-in) are different.
  - **Essences** and **Omens** (crafting-currency systems) partially cover the "guaranteed specific outcome from a farmable token" niche that some Divination Cards filled (e.g., cards that guaranteed a specific base + mod).
  - Straight **unique item drop-rate weighting** off monster/boss loot pools is otherwise the primary chase-item vector, same as any pre-Divination-Card ARPG.
- **Open question**: whether GGG intends to add a Divination-Card-equivalent system before or at 1.0 (targeted 2026-12-11) is unknown; no roadmap statement found in this pass.

---

## 6. Boss-specific / boss-locked loot

### Act bosses (campaign)
- Act 1: **Count Geonor**, Act 2: **Jamanra the Risen King**, Act 3: **Doryani, Royal Thaumaturge** (names/order per campaign structure; cross-check `campaign-and-acts.md` for exact act-boss roster if needed).
- Act bosses drop **random loot from a boosted rarity pool** rather than a single guaranteed unique — e.g. Count Geonor is cited as having **~14,700% increased Item Rarity** on his personal loot roll, heavily weighting drops toward good-for-level gear without a specific "boss-exclusive unique."
- Since patch 0.2.0g: **all Unique/campaign bosses (except a few in Act 1) guarantee a Rare item drop on first kill** (not guaranteed on repeat farming kills).

### Citadel bosses (endgame "Uber" campaign-boss reprises)
- Endgame **Citadels** (Stone/Copper/Iron etc.) let players refight scaled-up versions of campaign Act bosses (Doryani, Jamanra, Count Geonor) via Waystone-gated Citadel maps — these are higher-difficulty, higher-reward versions of the campaign fights, not new bosses.

### Pinnacle bosses — each has its own exclusive unique-drop pool
| Pinnacle boss | Mechanic | Signature drop(s) |
|---|---|---|
| **Zarokh, the Temporal** | Trial of the Sekhemas | Conditional relic-driven rewards: Sekhema's Resolve (3 variants), Sandstorm Visage, **Temporalis**, Against the Darkness, Djinn Barya |
| **The Trialmaster** | Trial of Chaos | One of 5 uniques: Mahuxotl's Machination (shield), Glimpse of Chaos (helmet), Zerphi's Genesis (belt), Hateforge (gloves), The Adorned (jewel) |
| **Xesht, We That Are One** | Breach | **Uul-Netol's Embrace**; also drops Xesht's Reliquary Key |
| **The Bodach** | Ritual | Pinnacle-exclusive unique (specific item not confirmed in this pass — re-verify) |
| **Olroth, Origin of the Fall** | Expedition | Pinnacle-exclusive unique (specific item not confirmed in this pass — re-verify) |
| **Kosis, the Revelation** / **Omniphobia, Fear Manifest** | Delirium | Kosis has a unique loot table; Omniphobia explicitly has **no unique loot table of its own** (per endgame-and-atlas.md research) |
| **The Arbiter of Divinity** | Top-of-Atlas pinnacle | Gated behind Phya/Phyx sub-boss drops (Origin Spark/Origin Cradle) — see endgame-and-atlas.md |

Every mechanic-pinnacle boss's exclusive uniques are, per community framing, "unavailable elsewhere" — this is PoE2's direct structural equivalent to PoE1's boss-locked-unique design (e.g., Uber bosses in PoE1).

### Reliquary Keys and "Foiled" Uniques — targeted chase-item acquisition system
This is PoE2's standout **boss-loot innovation** and arguably its closest functional answer to "how do I guarantee farming toward a specific chase item":
- **Foiled Uniques**: cosmetic variant of a normal unique (glowing visual effect, supporter-chosen color scheme) — **identical stats** to the base unique, no power difference, purely a flex skin.
- **Twilight Reliquary Key**: a rare **global drop** (not boss-specific) that grants a **random** non-boss-exclusive Foiled Unique via the Reliquary Vault.
- **Boss-specific Reliquary Keys** (Xesht's, Zarokh's, The Trialmaster's, Olroth's, etc.): drop from their matching pinnacle boss and let the player **target that specific boss's exclusive unique** as a guaranteed-pool foiled pull, rather than relying on raw boss-kill RNG.
- **Reliquary Vault**: a unique, **combat-free** instanced map whose sole content is a "Twilight Order Chest" — open it with a Reliquary Key to receive one Foiled Unique.
- Net effect: Reliquary Keys function as a **currency-for-guaranteed-item conversion**, philosophically similar to what a Divination Card stack does in PoE1 (spend a farmable token to convert effort into a *specific* chosen item) — this is the strongest candidate for "what replaced the Divination Card design space" in PoE2, even though the underlying mechanic (key drop + vault) is structurally different from card-stacking.

---

## 7. Corrupted areas / special drop zones

- **Corruption** is an endgame Atlas activity, visually marked by a **red effect** on affected Waystone map zones.
- Killing monsters in tight clusters has a chance to spawn special **Corrupted monsters** mid-map.
- One Corrupted map per session becomes the **Corrupted Nexus**: plays like a normal Corrupted map, but after the map's rare monster dies, a **Corrupted Boss** spawns (3 possible variants) — each variant can drop a **unique item**.
- **Jiquani's Sanctum** (unlocked Act 3) houses the **Corruption Altar**, which lets players corrupt any normal item **for free** (risk/reward reroll into Corrupted-only outcomes) — the PoE2 equivalent of PoE1's Vaal Orb-on-item corruption, but centralized at a fixed hub location rather than a consumable-currency action alone (Vaal Orbs are also still a separate currency used on Waystones themselves — see endgame-and-atlas.md §2 on Waystone corruption, which is a **distinct** mechanic from map-area corruption described here).
- **Important distinction** (confirmed against endgame-and-atlas.md): "Corruption" as covered here (in-map hazard requiring clearing rares/uniques to cleanse, red zone effect, Corrupted Nexus/Boss) is **separate** from **Vaal-Orb-on-Waystone corruption** (which changes a Waystone's tier before you even enter the map). Don't conflate the two when documenting for Project Vaal.

---

## 8. Currency drop mechanics — world vs. specific content

### Baseline world drops
- **Gold** drops automatically from virtually all monster kills (scales with monster level/rarity) and auto-picks-up within range — a currency **not** shared with PoE1, used for repairs/vendor/respec costs rather than trading.
- **Common currency orbs** (Transmutation, Augmentation, Alchemy, etc.) drop broadly off any monster, but **rarer/higher orbs (Exalted, Regal, Divine, Chaos-tier)** are concentrated later in the campaign and especially in **endgame Waystone mapping**.
- **Essences**: dropped by dedicated **Essence monsters**, which spawn when players break Essence-containing crystal encounters scattered through zones (not a generic monster drop).
- Currency drop *volume/rarity* is **directly scaled by % increased Rarity of Items Found** on the player and the Waystone modifiers in use — same lever as item drops (Section 3), not a separate currency-specific formula.

### League-mechanic-specific currency (cross-referenced, consistent with endgame-and-atlas.md)
| Mechanic | Currency/token | Use |
|---|---|---|
| **Ritual** | Tribute (from sacrificing slain enemies in a ritual circle) | Exchanged for crafting Omens; also feeds the "Offering to the King" bar toward pinnacle boss The Bodach |
| **Breach** | Breach Splinters (dropped by Hiveborn inside Breaches), plus Catalysts and Breach Rings | 300 Splinters auto-combine toward a Breachstone (pinnacle-boss access); Catalysts used in quality-crafting |
| **Expedition** | Logbooks (need iLvl 79+ for pinnacle path), Runic Splinters | Detonate explosives to excavate rewards; Logbooks chance-spawn pinnacle boss Olroth |
| **Delirium** | Distilled Emotions / Simulacrum Splinters | 300 Splinters build a Simulacrum for the pinnacle Delirium encounter |
| **Abyss** | Desecrated Currency/Modifiers (guaranteed from Abyssal Depths mini-bosses as of 0.5.3), Abyss Jewels | Desecrated Modifiers revealed at the Well of Souls; Abyssal Trove chest (after sealing a full fissure chain) always contains ≥1 Abyss Jewel |

- These are **not interchangeable with generic orb currency** — each is a mechanic-gated token that only that mechanic's encounters produce, matching the PoE1 pattern (e.g., PoE1 Breach Splinters/Delirium Simulacrum Splinters) that PoE2 inherited directly.

---

## 9. Strongboxes

- Locked chests found in maps; **spawn unidentified** — use a **Scroll of Wisdom** to reveal type/rarity/rewards before deciding to open.
- Strongboxes themselves can roll **Normal, Magic, Rare, or Unique rarity**, and can be modified with currency to add more challenging affixes in exchange for better loot — i.e., strongboxes have their own mini rarity/affix system layered on top of the type-based guaranteed loot.
- **Loot scaling by difficulty**: strongbox rarity/quantity output is roughly **+50% in Cruel** and **+100% in endgame (mapping)** content relative to base/Normal-difficulty values.
- **Type determines guaranteed drop category** (Currency, Waystones, Armour, Jewellery, or Uniques, depending on strongbox type).
- **Notable Unique Strongboxes** (special named mechanics, not just stat variants):
  - **Ventor's Contraption** — can be opened up to 5 times; each reopen costs **Gold**, scaling up **to +1050%** per opening.
  - **Ogham's Legacy** — spawns a monster that gets **revived 3–6 times**; the best loot is attached to the **final** revival, incentivizing a full clear rather than a quick kill.

---

## 10. Monster design philosophy vs. PoE1 (and its effect on loot pacing)

- **Slower, heavier combat**: player movement and monster attack cadence are both intentionally slowed relative to PoE1's fast clear-speed meta. Bosses and many rares have **long-wind-up, clearly telegraphed attacks** (shoulder-drop before a lunge, ground shimmer before an AoE, light-flicker before a spell burst) — the game is explicitly designed to reward reading and dodging over pure defensive-stat stacking.
- **Smaller, smarter monster packs**: enemy density per pack is reduced relative to PoE1, but individual monster AI is more coordinated — archers reposition, casters shield, melee mobs flank — instead of PoE1's larger, more homogenous "swarm and facetank" packs.
- **Individual hits are more dangerous**: a single mistimed/un-dodged hit (especially from a rare with a damage-buff affix, or a boss telegraphed attack) can be lethal even to a well-built character, a deliberate departure from PoE1's more forgiving "death by a thousand cuts" damage model at endgame.
- **Effect on loot pacing**: because packs are smaller and kills take longer per-monster, **loot-per-minute is structurally lower than PoE1's zoom-and-explode playstyle**, which is part of why GGG has iterated so heavily (0.2.0g overhaul, 0.5.3 endgame reward overhaul, 0.5.5 Ritual/Expedition reshuffle) on boss/chest/strongbox guaranteed-drop rates — to compensate for slower clear speed with denser guaranteed rewards per encounter rather than relying on raw kill-volume the way PoE1 endgame builds do.
- Net framing from multiple 2025–2026 retrospectives: PoE2 trades PoE1's "explosive slaughter" clear-speed loot pacing for "intense, skill-based duel" pacing, and its loot-rate patches have been a repeated, contentious effort to find the right reward density for that slower cadence.

---

## 11. Recent (2025–2026) major loot/drop-rate patches of note

| Patch | Date | Loot-relevant changes |
|---|---|---|
| **0.2.0 / 0.2.0g** | May 2025 | The single biggest loot controversy/overhaul to date: Item Rarity's effect **halved**; guaranteed Rare drop from Unique/campaign bosses on first kill; Magic/Rare chests guarantee Magic/Rare items; Rare-currency (Exalt/Regal/Alch-tier) drops **+20–30%** from high-rarity monsters; touched Strongbox/Trial/Delirium/Expedition/pinnacle tables. Buggy initial rollout (gems vanishing from builds) forced a same-day rollback and redeploy. |
| **0.3.0** | 2025 | "Rise of the Abyssal" — added Abyss as a core (not just-league) mechanic with its own loot (Abyss Jewels, Desecrated Modifiers/Currency). |
| **0.5.0 "Return of the Ancients"** | 2026 (base patch for current era) | Overhauled Atlas Fortress, new endgame questlines, 40+ new uniques added; introduced/iterated the Runes of Aldur challenge league (later folded into core with 0.5.5). |
| **0.5.3** | 2026 | "Endgame Reward Overhaul" — e.g., Expedition's Styrn now **always** drops an Expedition Logbook in maps; Desecrated Currency guaranteed from Abyssal Depths mini-bosses. |
| **0.5.5 "Forbidden Rites"** | 2026-09-04 | Event/challenge league on the 0.5.0 base; Runes of Aldur folded into core game (including Standard); large Soul Core loot-pool expansion (13 new Jiquani's variants, 4 new Atziri's variants, several rebalanced/limited to 1); Ritual rewards reworked to prioritize foundational/early-game currency (Regal/Exalted Orbs from campaign Rituals); Expedition (Farrow/Dannig content) made **permanent Atlas content from Act 4 onward**, including in Standard League; new Wildwood/Wisp sub-mechanic added via Ritual-dropped Sacred Blooms. |

**Ongoing controversy thread across all of the above**: the Item Rarity stat's role in currency-drop scaling remains publicly contested; GGG's stated goal (per Jonathan Rogers) to eventually **remove Item Rarity as a stat** and replace it with something else has **not** been executed as of 0.5.5.

---

## Open questions / re-verify

1. **Monster-mod prefix/suffix structure**: could not confirm whether PoE2 monster affixes (as opposed to item affixes) are formally split into prefix/suffix categories the way PoE1's `List of innate rare monster modifiers` implies for PoE1. Treat as "categorized affix pool," not confirmed prefix/suffix, until checked against a current wiki/patch-note primary source.
2. **exiletown.com/monster-modifiers** — cited repeatedly as the best categorized dangerous-combo reference, but the domain was blocked by this sandbox's egress proxy and could not be directly read. A future session with unblocked access should pull it directly for a definitive dangerous-combo list.
3. **maxroll.gg and mobalytics.gg** — both blocked by egress proxy in this pass (maxroll's Boss Loot Table Cheat Sheet, Pinnacle Bosses page, and mobalytics' Negative Rarity Farming guide, Monster Modifiers guide). All info above from these sources is WebSearch-snippet synthesis only, not a direct primary read — re-verify specifics (especially exact boss-unique lists for The Bodach and Olroth, which could not be pinned down) when direct fetch access is available.
4. **The Bodach's and Olroth's exact exclusive-unique drop names** were not confirmed in this pass (only that they have exclusive pools per the general pinnacle-boss framing). Re-check maxroll's boss loot table when reachable.
5. **"Runes of Aldur" naming**: sources are inconsistent about whether "Runes of Aldur" is the 0.5.0 base-patch challenge league name or a separate named league layered on 0.5.0 — 0.5.5 patch notes describe "Runes of Aldur goes core," implying it was a preceding challenge league distinct from Forbidden Rites, consistent with the task's framing of 0.5.0 as "Return of the Ancients" base patch. Treat this as resolved/consistent but flag if a future primary source disagrees.
6. **Incursion in PoE2**: per endgame-and-atlas.md, one source lists Incursion among endgame mechanics but this is uncorroborated — do not assert Incursion exists in PoE2 loot contexts without re-checking.
7. **Divination-Card-equivalent roadmap for 1.0**: no evidence found either way on whether GGG plans to add a Divination-Card-style system before/at the 2026-12-11 1.0 release.
8. **Exact rare-monster affix count ceiling**: sources conflict between "3 affixes standard, 1 may be aura" and "up to 4, but often 2-3," plus a mention that Atlas Passives can raise this further ("Rare Monster Scaling"). Treat the exact numeric ceiling as approximate, not exact.

---

## Sources

- [Enemies | Path of Exile 2 Wiki (Fextralife)](https://pathofexile2.wiki.fextralife.com/Enemies)
- [Rarity - Path of Exile Wiki (Fandom)](https://pathofexile.fandom.com/wiki/Rarity)
- [Monster modifiers - Path of Exile Wiki (Fandom)](https://pathofexile.fandom.com/wiki/Monster_modifiers)
- [List of innate rare monster modifiers - Path of Exile Wiki (Fandom)](https://pathofexile.fandom.com/wiki/List_of_innate_rare_monster_modifiers)
- [PoE2 Prefix vs Suffix & Item Level — Modifier Guide (stratlore)](https://poe2.stratlore.com/en/guides/item-modifiers-item-level-prefix-suffix/)
- [How will the new monster affixes affect gameplay? (gamegenie)](https://gamegenie.com/games/path-of-exile-2/posts/how-will-the-new-monster-affixes-affect-gameplay)
- [PoE2 Item Tiers Explained: Mods, iLvl & Gear Value (MMOJUGG)](https://www.mmojugg.com/news/understanding-item-tiers-in-poe2.html)
- [Feedback and Suggestions - Rare monster mods in POE 2 (official forum)](https://www.pathofexile.com/forum/view-thread/3611823)
- [PoE 2 Monster Modifiers: Avoid & Headhunter Picks (exiletown.com)](https://exiletown.com/monster-modifiers) — *blocked in this pass, snippet-only*
- [PoE 2 Best Map Modifiers Guide (ggwtb.com)](https://ggwtb.com/blog/poe-2-best-map-modifiers-guide-increased-quantity-rare-monsters-rarity)
- [Path of Exile 2 Loot Filter: Complete Setup Guide 2026 (exitlag)](https://www.exitlag.com/blog/path-of-exile-2-loot-filter/)
- [GitHub - NeverSinkDev/NeverSink-Filter-for-PoE2](https://github.com/NeverSinkDev/NeverSink-Filter-for-PoE2)
- [Early Access Discussion - POE 2 Loot Filter (official forum)](https://www.pathofexile.com/forum/view-thread/3605018)
- [PoE 2 Filter Generator (poe2filter.com)](https://poe2filter.com/)
- [FilterBlade - PoE1&2 Filter Customizer](https://www.filterblade.xyz/)
- [PoE2 Loot Filter Guide 0.5.0 (Boostmatch)](https://boostmatch.gg/blog/poe-2/articles/poe2-loot-filter-guide-050-return-of-the-ancients)
- [PoE2 FilterBlade Guide 0.5 (Boostmatch)](https://boostmatch.gg/blog/poe-2/articles/poe2-filterblade-guide-05-runes-of-aldur)
- [Guide - PoE2 Loot Filter, FPS Settings and Controller Tips (jeu.video)](https://jeu.video/en/guide/path-of-exile-2-loot-filter-fps-settings-controller-tips)
- [PoE 2 Loot Filter Guide: Install, Follow and Choose Strictness (stratlore)](https://poe2.stratlore.com/en/guides/loot-filter-install-strictness/)
- [Path of Exile 2 Loot Filters Guide (Bamboo Gaming)](https://www.bamboogaming.net/poe2/loot-filters)
- [Divination Cards Explained (Maxroll)](https://maxroll.gg/poe/resources/divination-cards)
- [Divination card - Path of Exile 2 Wiki (poe2wiki.net)](https://www.poe2wiki.net/wiki/Divination_card)
- [Divination card - Path of Exile Wiki (Fandom)](https://pathofexile.fandom.com/wiki/Divination_card)
- [A Divination Card System for Path of Exile 2 (official forum feature request)](https://www.pathofexile.com/forum/view-thread/3492124)
- [Magic Find (MF) Explained (Game8)](https://game8.co/games/Path-of-Exile-2/archives/495180)
- [PoE 2 Best Magic Find Build for All Classes (aoeah)](https://www.aoeah.com/news/3720--poe-2-best-magic-find-build-for-all-classes--path-of-exile-2-mf-guide)
- [Path of Exile 2 League Starter Builds 2026 (Switchblade Gaming)](https://www.switchbladegaming.com/path-of-exile-2/league-starter-builds/)
- [PoE 2 Guide: Negative Rarity Farming (Medium mirror of mobalytics)](https://medium.com/@qiongw53/poe-2-guide-negative-rarity-farming-f150a7e22552)
- [PoE 2 Guide: Negative Rarity Farming (mobalytics)](https://mobalytics.gg/poe-2/guides/negative-rarity-farming) — *blocked in this pass, snippet-only*
- [Path of Exile 2: Negative Rarity Guide (p2pah)](https://www.p2pah.com/blog/path-of-exile-2/1819-path-of-exile-2-negative-rarity-guide.html)
- [Path of Exile 2: Negative Rarity and Breakpoints Explained (mmoexp)](https://www.mmoexp.com/News/path-of-exile-2-negative-rarity-and-breakpoints-explained.html)
- [Pinnacle Boss Drops and Guides (Game8)](https://game8.co/games/Path-of-Exile-2/archives/506607)
- [Pinnacle Bosses - Path of Exile 2 (Maxroll)](https://maxroll.gg/poe2/resources/pinnacle-bosses) — *blocked in this pass, snippet-only*
- [Boss Loot Table Cheat Sheet (Maxroll)](https://maxroll.gg/poe2/resources/boss-loot-table-cheat-sheet) — *blocked in this pass, snippet-only*
- [All Path of Exile 2 bosses, locations, and rewards (PCGamesN)](https://www.pcgamesn.com/path-of-exile-2/bosses)
- [Path of Exile 2 Loot Table — Boss Cheat Sheet (kami-labs.fr)](https://kami-labs.fr/en/path-of-exile-2/table-loot-poe2-boss-uniques-cheat-sheet-en/)
- [PoE2 Pinnacle Bosses Guide (timesaver.gg)](https://timesaver.gg/blog/poe2-pinnacle-bosses-guide)
- [PoE2 Xesht Guide (timesaver.gg)](https://timesaver.gg/blog/poe2-xesht-guide)
- [The Iron Citadel Count Geonor Boss Guide (Maxroll)](https://maxroll.gg/poe2/bosses/the-iron-citadel-count-geonor-boss-guide)
- [PoE 2 Guide - Count Geonor Act 1 Boss (mobalytics)](https://mobalytics.gg/poe-2/guides/count-geonor)
- [Act boss - Path of Exile 2 Wiki (poe2wiki.net)](https://www.poe2wiki.net/wiki/Act_boss)
- [PoE 2: Reliquary Keys (mobalytics)](https://mobalytics.gg/poe-2/guides/reliquary-keys)
- [The Trialmaster's Reliquary Key (poe2wiki.net)](https://www.poe2wiki.net/wiki/The_Trialmaster%27s_Reliquary_Key)
- [Xesht's Reliquary Key (poe2wiki.net)](https://www.poe2wiki.net/wiki/Xesht's_Reliquary_Key)
- [How to Use the Reliquary Vault in Path of Exile 2 (GameRant)](https://gamerant.com/path-of-exile-2-what-is-reliquary-vault-explained-poe2/)
- [PoE2 Reliquary Keys Guide (timesaver.gg)](https://timesaver.gg/blog/poe2-reliquary-keys-guide)
- [Corruption | Path of Exile 2 Wiki (Fextralife)](https://pathofexile2.wiki.fextralife.com/Corruption)
- [Corrupted Items Explained and How to Fix (Game8)](https://game8.co/games/Path-of-Exile-2/archives/491412)
- [Path of Exile 2: Corrupted Items Guide - Vaal Orb, Corruption Altar, Jiquani's Sanctum (gamesfuze)](https://gamesfuze.com/guides/path-of-exile-2-corrupted-items-guide-vaal-orb-corruption-altar-jiquanis-sanctum/)
- [Path of Exile 2 Corruption Mechanic Explained & Modifier List (odealo)](https://odealo.com/articles/path-of-exile-2-corruption-guide)
- [Strongboxes Guide (Game8)](https://game8.co/games/Path-of-Exile-2/archives/507292)
- [Strongbox | Path of Exile 2 Wiki (Fextralife)](https://pathofexile2.wiki.fextralife.com/Strongbox)
- [PoE 2 Guide: Strongboxes (mobalytics)](https://mobalytics.gg/poe-2/guides/strongbox) — *blocked in this pass, snippet-only*
- [Path of Exile 2: All Unique Strongboxes (& What They Do) (mmonfl)](https://www.mmonfl.com/News/path-of-exile-2-all-unique-strongboxes-what-they-do.html)
- [Endgame Activities - Path of Exile 2 (Maxroll)](https://maxroll.gg/poe2/resources/endgame-activities) — *blocked in this pass, snippet-only*
- [Delirium - Path of Exile 2 (Maxroll)](https://maxroll.gg/poe2/resources/delirium) — *blocked in this pass, snippet-only*
- [Path Of Exile 2 Patch 0.5.3: Endgame Reward Overhaul Explained (Epiccarry)](https://epiccarry.com/blogs/path-of-exile-2-patch-0-5-3-guide/)
- [Path of Exile 2 Patch 0.5 Delirium Endgame Guide (poecurrency)](https://www.poecurrency.com/news/poe-2-patch-0-5-delirium-endgame-guide-high-clear-speed-better-loot)
- [7 Biggest Differences Between Path Of Exile 2 And The Original Game (TheGamer)](https://www.thegamer.com/path-of-exile-2-poe2-biggest-differences-from-original-game/)
- [PoE 2 Mechanics Guide (mobalytics)](https://mobalytics.gg/poe-2/guides/mechanics) — *blocked in this pass, snippet-only*
- [How Path of Exile 2's Combat Became Its Strongest Feature Yet (techbuzzireland)](https://techbuzzireland.com/2025/12/15/how-path-of-exile-2s-combat-became-its-strongest-feature-yet/)
- [A Deep and Critical Review of Path of Exile 2 (Game Ignite)](https://game-ignite.com/games/a-deep-and-critical-review-of-path-of-exile-2/)
- [Path of Exile 2 Monster Damage System (MMOJUGG)](https://www.mmojugg.com/news/path-of-exile-2-monster-damage-system.html)
- [0.5.5 Forbidden Rites Patch Notes (Maxroll)](https://maxroll.gg/poe2/news/0-5-5-forbidden-rites-patch-notes) — *blocked in this pass, snippet-only*
- [0.5.5 Patch Notes and Summary (Game8)](https://game8.co/games/Path-of-Exile-2/archives/617539)
- [Path of Exile 2 0.5.5 Patch Notes (allthings.how)](https://allthings.how/path-of-exile-2-0-5-5-patch-notes-trial-of-chaos-rework-and-forbidden-rites-event/)
- [Path of Exile 2 0.5.5 patch notes (Sportskeeda)](https://www.sportskeeda.com/mmo/path-exile-2-0-5-5-patch-notes-forbidden-rites-event-runes-aldur-goes-core-ritual-changes-trial-chaos-rework)
- [Path of Exile 2 0.5.5 Patch Notes Breakdown (IGGM)](https://www.iggm.com/news/poe-2-0-5-5-patch-notes-how-ritual-expedition-reshape-forbidden-rites-farming)
- [Path of Exile 2 Patch 0.5.5 Forbidden Rites Currency Farming Guide (poecurrency)](https://www.poecurrency.com/news/poe-2-patch-0-5-5-forbidden-rites-league-currency-farming-master-mechanics-endgame-changes)
- [Path of Exile 2 0.5.5 Forbidden Rites Patch Full Update Guide (mmoexp)](https://www.mmoexp.com/News/path-of-exile-2-0-5-5-forbidden-rites-patch-sep-4-pdt-full-update-guide-gameplay-changes.html)
- [The much-requested Path of Exile 2 loot overhaul is finally here (PCGamesN, 0.2.0g)](https://www.pcgamesn.com/path-of-exile-2/update-020g-patch-notes)
- [New Update in Path of Exile 2 Drastically Changes Loot Drops (mein-mmo)](https://mein-mmo.de/en/new-update-in-path-of-exile-2-drastically-changes-loot-drops-across-the-game-the-key-patch-notes-of-0-2-0g,1254541/)
- [Path of Exile 2 Reveals Major Loot Overhaul in Latest Patch (GameRant)](https://gamerant.com/path-of-exile-2-update-020g-patch-notes/)
- [Path of Exile 2 Patch 0.2.0g Massive Loot Overhaul (N4G)](https://n4g.com/news/2664960/path-of-exile-2-patch-0-2-0g-massive-loot-overhaul-rarity-buffs-and-endgame-rewards)
- [Path of Exile 2 Patch 0.2.0g – Major Loot System Overhaul (poebuilds.net)](https://www.poebuilds.net/post/path-of-exile-2-patch-0-2-0g-major-loot-system-overhaul-and-quality-improvements)
- [Path of Exile 2 Update 0.2.0g Patch Notes (pvpbank)](https://www.pvpbank.com/poe-2-update-020g-patch-notes)
- [Path of Exile 2 Patch 0.2.0g: Loot Fixes & More (MMOJUGG)](https://www.mmojugg.com/news/path-of-exile-2-patch-020g-loot-fixes-more.html)
- [Mirror Mayhem: The Breach-Ritual Hybrid (u4gm)](https://www.u4gm.com/path-of-exile-2/blog-mirror-mayhem-the-breach-ritual-hybrid-that-nets-8-mirrors-worth-overnight-in-path-of-exile-2)
- [PoE 2 Endgame Guide: Atlas, Maps, Bosses & Mechanics (Boostmatch)](https://boostmatch.gg/blog/poe-2/articles/poe2-endgame-guide-atlas-maps-bosses)
- [Currency Guide - Path of Exile 2 (Maxroll)](https://maxroll.gg/poe2/resources/currency-guide) — *blocked in this pass, snippet-only*
- [Path of Exile 2: Complete Currency List (GameRant)](https://gamerant.com/path-of-exile-2-every-currency-list-all-poe-2-currencies/)
- [Path of Exile 2: Beginner's Guide to Currency System (mmogah)](https://www.mmogah.com/news/path-of-exile-2/path-of-exile-2-beginners-guide-to-mastering-the-currency-system)
- [Path Of Exile 2 Patch 0.4.0 - 6 Ways To Get Currency (IGGM)](https://www.iggm.com/news/poe-2-patch-0-4-0-how-to-earn-currency-early-with-6-ways)
- [Path Of Exile 2: How To Get And Utilize Currency (IGGM)](https://www.iggm.com/news/poe-2-how-to-get-utilize-currency)
- [Path of Exile 2 Abyss League Mechanics Explained (VULKK)](https://vulkk.com/2025/09/05/path-of-exile-2-abyss-league-mechanics-explained/)
- [Abyss - Path of Exile Wiki (Fandom)](https://pathofexile.fandom.com/wiki/Abyss)
- [Abyss for Path of Exile 2 Return of the Ancients 0.5.0 (Maxroll)](https://maxroll.gg/poe2/resources/abyss) — *blocked in this pass, snippet-only*
- [Abyss League Mechanic Guide (poe2hub.net)](https://poe2hub.net/mechanics/abyss/)
- [PoE2 Abyss Farming Guide (timesaver.gg)](https://timesaver.gg/blog/poe2-abyss-farming-guide)
- [How Does Path Of Exile 2 Patch 0.3.0 Rise Of The Abyssal Work (poecurrency)](https://www.poecurrency.com/news/poe-2-patch-0-3-0-how-does-rise-of-the-abyssal-league-mechanic-work)
- [Atlas Of Worlds And Mapping for Path of Exile 2 (Maxroll)](https://maxroll.gg/poe2/resources/atlas-of-worlds-and-mapping) — *blocked in this pass, snippet-only*
- [Rolling Waystones and Precursor Tablets (Maxroll)](https://maxroll.gg/poe2/resources/rolling-waystones-and-precursor-tablets) — *blocked in this pass, snippet-only*
- [Path of Exile 2 - Map Tier Item Level & Base Drop Tables (prodigygamers)](https://prodigygamers.com/2026/07/06/path-of-exile-2-map-tier-item-level-base-drop-tables-july-2026/)
- Internal cross-reference: `docs/research/poe2/endgame-and-atlas.md` (this repository)
