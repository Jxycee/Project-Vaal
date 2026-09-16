# Path of Exile 2 — Classes & Ascendancies Research

## Last updated
2026-09-16, reflecting game version **0.5.5 "Forbidden Rites"** (released September 4, 2026). Game is still in Early Access; full 1.0 release is slated for later in 2026 (ExileCon reveal Nov 7, 2026 confirmed further classes — Duelist and a Sword weapon type — are coming with 1.0, not yet in-game as of this writing).

> **Confidence note for downstream use (build-sharing / tree viewer):** Class roster, ascendancy roster, and patch/timeline facts below were live-verified against multiple current (2026) sources this session. Base-class attribute weightings, exact tree start coordinates, and some older ascendancy skill/passive names come from stable pre-2026 design knowledge that has not been contradicted by anything found live (0.5.5 patch notes explicitly state no ascendancy balance changes shipped in that patch). Treat exact attribute numbers as approximate/qualitative rather than exact digits — verify against in-game tooltips or `public/data/tree/` export before hardcoding numeric values into Project Vaal.

---

## 1. Base Class Roster (current, 8 classes)

PoE2 launched Early Access (Dec 2024) with 6 classes. Two more were added post-launch:

| # | Class | Added | Patch | Primary Attributes | Weapon Archetype | Resource Identity |
|---|-------|-------|-------|---------------------|-------------------|--------------------|
| 1 | **Warrior** | Launch | 0.1.0 | Str (dominant), minor Dex | Two-handed maces / Str stat-sticks | Melee slam/AoE, armor stacking |
| 2 | **Ranger** | Launch | 0.1.0 | Dex (dominant), minor Int | Bow | Projectiles, mobility |
| 3 | **Monk** | Launch | 0.1.0 | Dex/Int hybrid | Quarterstaff (also unarmed) | Spirit (persistent buffs), melee-spell combo |
| 4 | **Sorceress** | Launch | 0.1.0 | Int (dominant), minor Dex | Wand / Staff / Sceptre | Elemental spellcasting |
| 5 | **Mercenary** | Launch | 0.1.0 | Str/Dex hybrid | Crossbow (unique to class) | Ammo types (bolts/grenades), reload mechanic |
| 6 | **Witch** | Launch | 0.1.0 | Int (dominant), minor Str | Sceptre / Wand | Minions, life-as-resource, chaos/fire |
| 7 | **Huntress** | Apr 4, 2025 | 0.2.0 "Dawn of the Hunt" | Dex (dominant), minor Str | Spear + Buckler (new weapon type) | Melee/ranged spear-throw combo |
| 8 | **Druid** | Dec 12, 2025 | 0.4.0 "The Last of the Druids" | Str/Int hybrid | Talisman (incl. two-handed "Animal Talisman") | Shapeshifting (Bear/Wolf/Wyvern forms) + human-form nature spells |

Total ascendancies currently live: **22** (see per-class tables below). Ranger and Druid remain at 2 ascendancies each; the other six classes have all received a 3rd ascendancy since launch.

**Upcoming (announced, NOT in-game as of Sept 16, 2026):** Duelist confirmed for 1.0 (Dec 11, 2026 target), alongside a new Sword weapon system. Full name/mechanics to be revealed at ExileCon, Nov 7, 2026. Templar, Marauder, and Shadow are speculative/community-expected (legacy PoE1 class names) but **not officially confirmed** — do not treat as verified.

---

## 2. Per-Class Detail

### Warrior
- **Attributes:** Str-dominant, small Dex, negligible Int. Starts in the Str region of the shared passive tree.
- **Weapon:** Two-handed maces / Str-scaling weapons; melee slam skills (Earthquake, Sunder-style AoE).
- **Playstyle:** Heavy melee bruiser — high armor, big single-hit/AoE slams, tanky.
- **Ascendancies (3):**

| Ascendancy | Added | Theme | Signature Mechanic | Notable Passives |
|---|---|---|---|---|
| **Titan** | Launch | Str-stacking colossus | Grows in size, huge armor/stun threshold, unstoppable trample through enemies | Size-scaling AoE, high stun avoidance, armor-to-damage conversion |
| **Warbringer** | Launch | Tribal warlord | Totem-based buffs, aggression/Rage generation, party-wide war-cry amplification | Totem empowerment, leech/Rage synergy nodes |
| **Smith of Kitava** | 0.2.0 (Apr 2025) | Demonic-corruption berserker | Molten/fire self-buffs, trades defense for offense (self-debuff → damage payoff), heavy weapon-combo focus | Fire conversion nodes, self-vulnerability-for-damage trade-offs |

### Ranger
- **Attributes:** Dex-dominant, small Int. Starts in the Dex region.
- **Weapon:** Bow (primary), quiver support items.
- **Playstyle:** Ranged projectile carry, high mobility and evasion, ailment/status application.
- **Ascendancies (2 — no 3rd added as of 0.5.5):**

| Ascendancy | Added | Theme | Signature Mechanic | Notable Passives |
|---|---|---|---|---|
| **Deadeye** | Launch | Projectile specialist | Ricochet/fork/pierce scaling, "Far Shot" (more damage at range), Mirage Archer-style projectile clones | High attack/movement speed, projectile-return nodes |
| **Pathfinder** | Launch | Alchemist/flask master | Permanent flask uptime, poison/ailment scaling, elemental infusion via flask effects | Flask charge generation, ailment magnitude/duration nodes |

*Note: community leaks (e.g. "Arcane Archer") for a Ranger 3rd ascendancy were unconfirmed rumors as of the 0.5.0 reveal and did not materialize — Ranger's 3rd ascendancy has not shipped.*

### Monk
- **Attributes:** Dex/Int hybrid. Starts between the Dex and Int regions.
- **Weapon:** Quarterstaff (also strong unarmed/martial-arts skill support).
- **Resource:** Spirit (the universal PoE2 reservation-style resource; Monk's kit leans heavily on Spirit-cost persistent skills combined with melee combo attacks).
- **Playstyle:** Martial-arts combo fighter blending melee strikes with elemental/chaos "technique" effects.
- **Ascendancies (3):**

| Ascendancy | Added | Theme | Signature Mechanic | Notable Passives |
|---|---|---|---|---|
| **Invoker** | Launch | Elemental spirit channeler | Alternates/combines cold + lightning effects via combo hits, elemental spirit stances | Combo-hit elemental discharge, stance-switch buffs |
| **Acolyte of Chayula** | Launch | Chaos/evasion ascetic | Stacks "Doom" on enemies for detonation, chaos damage-over-time embrace, stun immunity while channeling | Evasion-chaos hybrid defense, Doom-detonation nodes |
| **Martial Artist** | 0.5.0 (May 29, 2026) | Illusory technique master | Attuned to 3 of 7 "Hollow" techniques; manifests spiritual energy into physical constructs — self-clones to perform skills, or summonable damage-dealing bells | Illusion/clone-skill nodes, bell-summon amplification |

### Sorceress
- **Attributes:** Int-dominant, small Dex. Starts in the Int region.
- **Weapon:** Wand / Staff / Sceptre.
- **Playstyle:** Elemental spellcaster, combo-based elemental application (ignite/freeze/shock stacking).
- **Ascendancies (3):**

| Ascendancy | Added | Theme | Signature Mechanic | Notable Passives |
|---|---|---|---|---|
| **Stormweaver** | Launch | Elemental combo archmage | Converts mana into damage, chains casts to build elemental "Static"-style stacks for detonation | Mana-to-damage conversion, cast-speed scaling nodes |
| **Chronomancer** | Launch | Time manipulator | Slows/rewinds time — action-speed distortion on enemies, self temporal-echo buffs | Action speed debuff amplification, temporal-echo utility nodes |
| **Disciple of Varashta** | 0.4.0 (Dec 12, 2025) | Djinn commander | Summons up to 3 **invulnerable** Djinns (Fire, Water, Assassin variants); each grants a command ability; commanding them triggers burst damage windows | Command-cooldown reduction, multi-Djinn nodes; frees all defensive investment from minions since Djinns can't die |

### Mercenary
- **Attributes:** Str/Dex hybrid. Starts between the Str and Dex regions.
- **Weapon:** Crossbow (class-exclusive weapon type) — swappable ammo (standard bolts, grenades), reload-as-skill mechanic.
- **Playstyle:** Ranged skirmisher mixing grenade AoE/utility with precision bolt damage.
- **Ascendancies (3):**

| Ascendancy | Added | Theme | Signature Mechanic | Notable Passives |
|---|---|---|---|---|
| **Witchhunter** | Launch | Anti-caster hunter | Marks/burns enemy mana, silences/interrupts casters, executes high-mana targets via bolt effects | Mana-burn scaling, caster-interrupt nodes |
| **Gemling Legionnaire** | Launch | Gem-augmentation specialist | Extra support-gem slots; gem level/quality converts into flat stat bonuses | Support-gem slot nodes, gem-quality-to-stat conversion |
| **Tactician** | 0.2.0 (Apr 2025) | Battlefield commander | Grenade/turret specialist, deploys explosive traps, buffs from combining grenade types | Grenade-type synergy nodes, turret/trap amplification |

### Witch
- **Attributes:** Int-dominant, small Str. Starts in the Int region (opposite side of the wheel from Sorceress' Int cluster, adjacent to Str/Int border shared with Druid).
- **Weapon:** Sceptre / Wand.
- **Playstyle:** Minion commander and chaos/fire caster; life-as-resource builds.
- **Ascendancies (3):**

| Ascendancy | Added | Theme | Signature Mechanic | Notable Passives |
|---|---|---|---|---|
| **Infernalist** | Launch | Demon-fire summoner | "Demonform" resource — transforms for boosted spellcasting at a life/degeneration cost; summons Abyssal demon minions | Demonform uptime nodes, fire/chaos DoT amplification |
| **Blood Mage** | Launch | Blood magic | Spends life instead of mana ("Sanguimancy"); self-harm-for-power skill interactions | Life-pool scaling, life-cost-skill amplification |
| **Lich** | 0.2.0 (Apr 2025) | Undeath / chaos DoT | Converts incoming damage-over-time into an "Essence" resource for buffs; heavy chaos resistance and DoT immunity themes | Essence-generation nodes, chaos DoT conversion |

### Huntress
- **Attributes:** Dex-dominant, small Str. Starts in the Dex region, adjacent to Ranger/Mercenary.
- **Weapon:** Spear (new weapon type introduced with the class) wielded with a Buckler (small shield) in the off-hand — supports both melee slashes and ranged spear-throws in the same kit.
- **Playstyle:** In-and-out dynamic combat, chaining melee-into-ranged (or vice versa) combos that stack elemental effects, bleed, and explosions.
- **Ascendancies (3):**

| Ascendancy | Added | Theme | Signature Mechanic | Notable Passives |
|---|---|---|---|---|
| **Amazon** | 0.2.0 (Apr 2025) | Spear duelist | Melee/ranged stance-switching combo attacks, precision strikes, evasion-based | Stance-switch damage buffs, throw-and-retrieve spear nodes |
| **Ritualist** | 0.2.0 (Apr 2025) | Blood-ritual caster | Sacrifice/curse mechanics, chaos and bleed synergy, ritual-altar damage buffs | Sacrifice-for-buff nodes, curse/bleed amplification |
| **Spirit Walker** | 0.5.0 (May 29, 2026) | Azmerian spirit-caller | Summons animal spirits — Stag (attack-triggered stampedes), Owl (attack enhancement buff), Bear (attacking companion); can summon unique beast-boss companions | Companion-summon nodes, spirit-type synergy passives |

### Druid
- **Attributes:** Str/Int hybrid. Starts in the top-left Str/Int border region of the tree.
- **Weapon:** Talisman — a new weapon class; two-handed "Animal Talismans" unlock a specific Shapeshift form (Bear, Wolf, or Wyvern), each with its own resource (Rage, Moon Energy, or Power Charges respectively) and attack set. In human form, Talismans instead cast nature spells (Volcano, Entangle, Thunderstorm, Spell Totem).
- **Playstyle:** Shapeshifter hybrid — swaps between human-form spellcasting and beast-form melee/AoE combat.
- **Ascendancies (2):**

| Ascendancy | Added | Theme | Signature Mechanic | Notable Passives |
|---|---|---|---|---|
| **Shaman** | 0.4.0 (Dec 12, 2025) | Elemental/rage hybrid | Unifies Rage generation with spellcasting; melee and magic amplify each other | Rage-to-spell-damage conversion nodes |
| **Oracle** | 0.4.0 (Dec 12, 2025) | Predictive battlefield controller | Predictive magic, crowd control / battlefield-state manipulation | Control-duration and prediction-buff nodes |

---

## 3. Ascendancy Unlock System: Trial of the Sekhemas & Trial of Chaos

- Two parallel labyrinth-style, rogue-lite trial zones exist (functional replacement for PoE1's Labyrinth): **Trial of the Sekhemas** (Act 2, desert/sand-castle theme; uses an **Honour** resource — you lose Honour when hit, and the run ends early if Honour hits zero, distinct from a life-based fail state) and **Trial of Chaos** (endgame, Vaal/corruption theme, run by the Trialmaster).
- Each trial is a sequence of rooms/floors with combat and puzzle encounters. At set intervals, **Ascendancy Altar** rooms appear, letting you allocate points into your chosen ascendancy's own small passive mini-tree (not a fixed linear order like PoE1's Lab — nodes are chosen freely, similar in spirit to the main passive tree but scoped to the ascendancy).
- First completion of a trial lets you **choose your ascendancy class** (pick one of the 2–3 available for your base class) and grants your first ascendancy point(s); repeat completions (including at higher trial difficulty/depth) grant further points up to the overall cap.
- **0.5.5 "Forbidden Rites" reworked Trial of Chaos significantly** (verified, live-checked this session):
  - Can now leave and resume a run later from the same room (previously an all-or-nothing run).
  - Trialmaster time-stop now triggers only at run start, not in nearly every room — doors/elevators/levers are much faster.
  - A **reward chest at the end of every room** — dying is far less punishing since you keep already-earned rewards instead of losing the whole run's loot.
  - Run rewards are now Currency + Soul Cores only; **corrupted items removed** from the Trial of Chaos reward pool.
  - Trial of Chaos now scales with **inherent bonuses tied to Area Level**.
  - Extended to **up to Room 30**, introducing **Wager Modifiers** (risk/reward wagering on later rooms, Sanctum/Delve-style).
  - Large batch of new Soul Cores added to the loot pool (13 Jiquani's variants, 4 Atziri's variants).
  - Patch explicitly shipped **no ascendancy passive/skill-gem balance changes** alongside this rework.
- Ascendancy points total: same conceptual design as PoE1's 8-point cap carried over to PoE2's system of incremental trial completions feeding a per-ascendancy passive mini-tree (exact current point cap and per-completion point counts were not independently re-verified live this session — cross-check against current maxroll "Trials of Ascendancy" guide or in-game UI before hardcoding into Project Vaal's build-sharing feature).

---

## 4. Dual-Class / Hybrid Build Viability

PoE2 uses a single shared passive skill tree for all classes (no per-class trees). A base class only determines:
1. Your **starting node/location** on the shared tree (near your class's primary attribute cluster).
2. Your **starting attribute allocation** (a head start in Str/Dex/Int, not a permanent restriction).
3. Your **starting weapon** handed to you at character creation (cosmetic/flavor — any class can switch weapon types).
4. Which **ascendancy classes** you can pick from (this is the one hard restriction — ascendancy choice is locked to your base class's 2–3 options; you cannot take another class's ascendancy).

Because of the shared tree, "multiclassing" in PoE2 is really a matter of **how far you path across the wheel**: any class can walk to any other class's attribute/keystone clusters and use any weapon type or skill gem, provided they invest enough passive points and meet the (attribute-based, not class-based) stat requirements on gear/gems. E.g., a Witch can path to Dex and run a bow build, or a Warrior can stack Int and cast spells — the tree does not gate this by class, only by point-investment distance and attribute thresholds. The practical limit is passive-point efficiency (pathing across the wheel costs points that a "pure" build wouldn't spend) rather than any hard lock.

The only irreducible class identity is therefore the **ascendancy** — pick Warrior and you are permanently limited to Titan/Warbringer/Smith of Kitava for your ascendancy-tree bonuses, even if your main-tree pathing and gear make the character play like a caster. This makes ascendancy choice the highest-leverage decision for defining a hybrid build's core identity, while the base class + starting attributes are more of a convenience/head-start than a hard constraint.

---

## 5. Class-Specific Unique Mechanics Summary

| Class | Unique Mechanic |
|---|---|
| Witch | Minion command (Sceptre-summoned zombies/skeletons/demons), life-as-resource (Blood Mage), Demonform transformation (Infernalist) |
| Monk | Spirit-resource persistent skills combined with melee combo/technique chains; martial-arts illusions (Martial Artist) |
| Mercenary | Crossbow reload-as-skill, swappable ammo types (standard bolts vs. grenades), grenade-AoE utility layered on precision ranged damage |
| Huntress | Spear+Buckler dual-mode kit — single weapon supports both melee slashes and ranged throws, combo-chaining between the two |
| Druid | Full shapeshifting via Animal Talismans (Bear/Wolf/Wyvern forms, each with a distinct resource: Rage/Moon Energy/Power Charges) plus separate human-form nature spellcasting |
| Sorceress | Elemental ailment stacking/combo detonation (Stormweaver), invulnerable-minion command play (Disciple of Varashta) |
| Ranger | Highest mobility/evasion kit, flask-economy specialization (Pathfinder) |
| Warrior | Highest base armor/Str-stacking, totem-buff tribal playstyle (Warbringer) |

**Universal system note:** "Spirit" is a PoE2-wide resource (not Monk-exclusive) — it replaced PoE1's mana-reservation system for auras/minions/persistent buffs across all classes, but Monk and Witch (minion side) interact with it most heavily by kit design.

---

## 6. Recent Balance & Content Timeline (2025–2026)

| Date | Patch | Class/Ascendancy Content |
|---|---|---|
| Dec 2024 | 0.1.0 (EA launch) | 6 base classes, 12 ascendancies (2 per class) |
| Apr 4, 2025 | 0.2.0 "Dawn of the Hunt" | + **Huntress** class (Amazon, Ritualist); + 3rd ascendancies: **Smith of Kitava** (Warrior), **Tactician** (Mercenary), **Lich** (Witch). Large ascendancy balance pass (Warbringer received the era's biggest buff pass after sub-0.5% pick rate in 0.1). |
| Dec 12, 2025 | 0.4.0 "The Last of the Druids" | + **Druid** class (Shaman, Oracle); + **Disciple of Varashta** (Sorceress 3rd ascendancy) |
| May 29, 2026 | 0.5.0 "Return of the Ancients" | + **Spirit Walker** (Huntress 3rd), + **Martial Artist** (Monk 3rd). Framed as the last major EA content patch before 1.0. Rebuilt Atlas/endgame. |
| Sep 4, 2026 | 0.5.5 "Forbidden Rites" | No new classes/ascendancies; no ascendancy balance changes. Major **Trial of Chaos** QoL rework (see Section 3); Forbidden Rites event league; Runes of Aldur made core; Ritual changes. |
| Nov 7, 2026 (scheduled) | ExileCon reveal | Expected reveal of Duelist class + Sword weapon mechanics ahead of 1.0. |
| Dec 11, 2026 (target) | 1.0 full release | Duelist class confirmed to ship; further classes/ascendancies possible but unconfirmed. |

---

## Sources

- [Huntress Class Guide And Ascendancies In Path Of Exile 2 — TheGamer](https://www.thegamer.com/path-of-exile-2-poe2-huntress-class-ascendancies-guide/)
- [Huntress | Path of Exile 2 Wiki - Fextralife](https://pathofexile2.wiki.fextralife.com/Huntress)
- [Path of Exile 2's Dawn of the Hunt Brings Huntress, Five New Ascendancy Classes On April 4th — MMORPG.com](https://www.mmorpg.com/features/path-of-exile-2s-dawn-of-the-hunt-brings-huntress-five-new-ascendancy-classes-on-april-4th-2000134498)
- [Classes | Path of Exile 2 Wiki - Fextralife](https://pathofexile2.wiki.fextralife.com/Classes)
- [Huntress Ascendancies and Class Guide | Game8](https://game8.co/games/Path-of-Exile-2/archives/507290)
- [PoE 2 Class Overview - Maxroll.gg](https://maxroll.gg/poe2/resources/poe-2-class-overview)
- [PoE 2 Huntress Class Overview | Epiccarry](https://epiccarry.com/blogs/poe2-huntress-class-overview/)
- [Path of Exile 2 Huntress Guide — Skycoach](https://skycoach.gg/blog/path-of-exile-2/articles/huntress-guide)
- [Path of Exile 2 Huntress Class — SseGold](https://www.ssegold.com/poe-2-huntress)
- [List of Classes and Ascendancies | Game8](https://game8.co/games/Path-of-Exile-2/archives/485789)
- [PoE 2 Ascendancy Overview - Maxroll.gg](https://maxroll.gg/poe2/resources/poe-2-ascendancy-overview)
- [Best PoE 2 Class in 2026: Full Tier List and Beginner Guide — Eneba](https://www.eneba.com/hub/games/best-poe-2-class/)
- [PoE 2 Classes - List of All Confirmed Classes & Their Breakdown — Mobalytics](https://mobalytics.gg/poe-2/guides/classes-breakdown)
- [Ascendancies | Path of Exile 2 Wiki - Fextralife](https://pathofexile2.wiki.fextralife.com/Ascendancies)
- [PoE2 Classes and Ascendancies Explained - Complete Guide | PoE2Path](https://poe2path.com/guides/poe2-classes-and-ascendancies-explained/)
- [PoE 2 Ascendancy Classes & Tier List — Interactive Explorer (0.5.4b) | Timesaver](https://timesaver.gg/tools/poe-2/ascendancy)
- [PoE 2 Ascendancy Classes: Overview of All 12 Ascendancies — Dving.net](https://dving.net/guides/path-of-exile-2-guides/ascendancies-overview)
- [0.5.5 Patch Notes and Summary | Game8](https://game8.co/games/Path-of-Exile-2/archives/617539)
- [Path of Exile 2 Patch Notes — Every Update, Version by Version - Kami-labs.fr](https://kami-labs.fr/en/patch-notes-poe2/)
- [PoE2 Roadmap 2026: 0.5.5 Update, ExileCon & 1.0 Release – Expert Game Reviews](https://expertgamereviews.com/poe2-roadmap-0-5-5-exilecon-1-0-release/)
- [Path of Exile 2 Gamescom 2026 Guide: 0.5.5 Patch Details & 1.0 Launch Timeline — MMOExp](https://www.mmoexp.com/News/path-of-exile-2-gamescom-2026-guide-0-5-5-patch-details-1-0-launch-timeline.html)
- [Path of Exile 2 2026 Full Roadmap: Gamescom Reveal, 0.5.5 Update & 1.0 F2P Launch — MMOExp](https://www.mmoexp.com/News/path-of-exile-2-2026-full-roadmap-gamescom-reveal-0-5-5-update-1-0-f2p-launch.html)
- [Path of Exile 2 0.5.5 Forbidden Rites Update: Full Patch Breakdown & 2026 Endgame Roadmap — MMOExp](https://www.mmoexp.com/News/path-of-exile-2-0-5-5-forbidden-rites-update-full-patch-breakdown-2026-endgame-roadmap.html)
- [PoE 2 Patch 0.5.5 Release Date and Forbidden Rites — ExpCarry](https://expcarry.com/path-of-exile-2-patch-0-5-5-release-date-patch-notes)
- [0.5.5 Forbidden Rites Patch Notes - Maxroll.gg](https://maxroll.gg/poe2/news/0-5-5-forbidden-rites-patch-notes)
- [Path of Exile 2 0.5.5 Patch Notes: Trial of Chaos Rework and Forbidden Rites Event — AllThings.How](https://allthings.how/path-of-exile-2-0-5-5-patch-notes-trial-of-chaos-rework-and-forbidden-rites-event/)
- [Path of Exile 2 0.5.5 patch notes — Sportskeeda](https://www.sportskeeda.com/mmo/path-exile-2-0-5-5-patch-notes-forbidden-rites-event-runes-aldur-goes-core-ritual-changes-trial-chaos-rework)
- [Path of Exile 2: 0.5.5 Patch Notes - pathofexile.gg](https://pathofexile.gg/0-5-5-patch-notes/)
- [PoE2 0.5.5 Forbidden Rites: All Challenge Rewards, Trial of Chaos Rework — InfinityBuilds](https://poe2.infinitybuilds.gg/en/news/poe2-0-5-5-forbidden-rites-all-challenge-rewards-trial-of-chaos-rework-and-what-s-new)
- [Path of Exile 2 0.5.5 Forbidden Rites Patch (Sep 4 PDT) — MMOExp](https://www.mmoexp.com/News/path-of-exile-2-0-5-5-forbidden-rites-patch-sep-4-pdt-full-update-guide-gameplay-changes.html)
- [Path of Exile 2: The Last of the Druids Release Date & Start Times — Insider Gaming](https://insider-gaming.com/path-of-exile-2-the-last-of-the-druids-release-date-times/)
- [The new Path of Exile 2 Druid class... — PCGamesN](https://www.pcgamesn.com/path-of-exile-2/the-last-of-the-druids-release-date)
- [The Last of the Druids Release Date and Latest Information | Game8](https://game8.co/games/Path-of-Exile-2/archives/569166)
- [Path of Exile 2 — Wikipedia](https://en.wikipedia.org/wiki/Path_of_Exile_2)
- [Path of Exile 2: The Last of the Druids release date, timings & more — KhelNow](https://khelnow.com/gaming/path-of-exile-2-the-last-of-the-druids-release-date-timings-202512)
- [Path of Exile 2 brings the Druid class... — MassivelyOP](https://massivelyop.com/2025/12/12/path-of-exile-2-brings-the-druid-class-latest-league-and-free-trial-with-todays-last-of-the-druids-update/)
- [Path of Exile 2: The Last of the Druids Release & Patch 0.4.0 — RPGStash](https://www.rpgstash.com/blog/path-of-exile-2-the-last-of-the-druids-what-we-know-so-far)
- [Path of Exile 2 druids page — pathofexile2.com](https://pathofexile2.com/druids)
- [Path of Exile 2 Druid Guide — Overgear](https://overgear.com/guides/poe-2/druid-class-guide/)
- [Path of Exile 2 Druid Guide — Skycoach](https://skycoach.gg/blog/path-of-exile-2/articles/poe2-druid-guide)
- [Path Of Exile 2 Patch 0.4.0 New Druid Class Ultimate Overview — IGGM](https://www.iggm.com/news/poe-2-patch-0-4-0-druid-overview-skills-powers-ascendancy-classes)
- [PoE 2 Druid Ascendancy Classes Explained [0.5.0] — RPGStash](https://www.rpgstash.com/blog/poe-2-druid-ascendancy-classes-explained)
- [3rd Ascendancy Release Date | Game8](https://game8.co/games/Path-of-Exile-2/archives/490426)
- [Trials of Ascendancy Guide - Maxroll.gg](https://maxroll.gg/poe2/getting-started/trials-of-ascendancy)
- [Path of Exile 2: Return of the Ancients – New Ascendancy Classes & Meta Analysis — RPGStash](https://www.rpgstash.com/blog/path-of-exile-2-return-of-the-ancients-new-ascendancy-classes-revealed)
- [PoE 2 0.5 New Ascendancy Class and Weapon Leaks (Ranger & Huntress) — AOEAH](https://www.aoeah.com/news/4499--poe-2-05-new-ascendancy-class-and-weapon-leaks-ranger--huntress)
- [Return of the Ancients Release Date and Latest Information | Game8](https://game8.co/games/Path-of-Exile-2/archives/598661)
- [Path of Exile 2 Drops Its Final Pre-1.0 Patch in May... — WCCFTech](https://wccftech.com/path-of-exile-2-return-of-the-ancients-patch-may-2026/)
- [Return of the Ancients Expansion Guide | Path of Exile 2 Wiki - Fextralife](https://pathofexile2.wiki.fextralife.com/Return+of+the+Ancients)
- [PoE 2 Return of the Ancients 0.5 Guide: Endgame, Ascendancies — Games.gg](https://games.gg/path-of-exile-2/guides/poe-2-patch-05-return-of-the-ancients-rundown/)
- [Path of Exile 2: Huntress and Monk Ascendancies Unveiled — EZG](https://www.ezg.com/blog/poe2-patch-0-5-0-huntress-and-monk-ascendancies-spirit-walker-and-martial-artist-unveiled)
- [PoE 2 Ascendancy Guide: Mastering the Spirit Walker and Martial Artist — SseGold](https://www.ssegold.com/poe-2-ascendancy-guide-spirit-walker-martial-artist)
- [PoE 2 0.5 Spirit Walker Skills & Best Builds — AOEAH](https://www.aoeah.com/news/4547--poe-2-05-spirit-walker-skills--best-builds-leveling--endgame)
- [PoE 2 0.5 Class Tier List: Runes of Aldur — Boostmatch](https://boostmatch.gg/blog/poe-2/articles/poe2-05-class-tier-list-runes-of-aldur)
- [Path of Exile 2 Ascendancy Guide: The Spirit Walker and The Martial Artist — MMOExp](https://www.mmoexp.com/News/path-of-exile-2-ascendancy-guide-the-spirit-walker-and-the-martial-artist.html)
- [League Starter Ascendancy Tier List - Maxroll.gg](https://maxroll.gg/poe2/tierlists/league-starter-ascendancy-tier-list)
- [All New Ascendancies | Game8](https://game8.co/games/Path-of-Exile-2/archives/513806)
- [Path of Exile 2 Ascendancy Tier List 2026 — RankedMeta](https://rankedmeta.com/poe-2/ascendancy-tier-list)
- [All PoE 2 Ascendancies Explained (0.5.5): Every Class Ascendancy, Ranked — Timesaver](https://timesaver.gg/blog/poe2-all-ascendancies-explained-0-5-5)
- [Disciple of Varashta Ascendancy Overview and Skills | Game8](https://game8.co/games/Path-of-Exile-2/archives/570950)
- [Disciple of Varashta Ascendancy Guide – Fextralife](https://pathofexile2.wiki.fextralife.com/Disciple+of+Varashta)
- [Disciple of Varashta Ascendancy Overview — Maxroll.gg](https://maxroll.gg/poe2/resources/disciple-of-varashta-ascendancy-overview)
- [Path of Exile 2 Reveals Disciple of Varashta Ascendancy — PoE-Vault](https://www.poe-vault.com/poe2/news/path-of-exile-2-reveals-disciple-of-varashta-ascendancy)
- [Path of Exile 2 is getting a new Sorceress Ascendancy, Disciple of Varashta — The Escapist](https://www.escapistmagazine.com/news-path-of-exile2-sorceress-ascendancy/)
- [Path of Exile 2: Disciple of Varashta leveling build guide — Sportskeeda](https://www.sportskeeda.com/mmo/path-exile-2-disciple-varashta-leveling-build-guide)
- [PoE 2 Disciple Of Varashta Guide (Patch 0.4) | Epiccarry](https://epiccarry.com/blogs/poe-2-patch-0-4-disciple-of-varashta-guide/)
- [Path Of Exile 2 Patch 0.4.0 Sand Djinn Disciple Of Varashta Build — IGGM](https://www.iggm.com/news/poe-2-patch-0-4-0-sand-djinn-disciple-of-varashta-build-gameplay-skills-ascendancy-node-selection)
- [Ranger - Path of Exile 2 Wiki - Fextralife](https://pathofexile2.wiki.fextralife.com/Ranger)
- [Ranger Ascendancies and Class Guide | Game8](https://game8.co/games/Path-of-Exile-2/archives/486657)
- [Path of Exile 3.28 reveal may have teased new PoE 2 Ranger Ascendancy — Sportskeeda](https://www.sportskeeda.com/mmo/path-exile-3-28-reveal-may-teased-new-poe-2-ranger-ascendancy)
