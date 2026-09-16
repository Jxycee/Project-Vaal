# PoE2 Campaign & Acts — Research Notes

## Last updated

2026-09-16. Reflects patch **0.5.5 "Forbidden Rites"** (released 2026-09-04). Full 1.0 launch is scheduled for **2026-12-11** and is expected to change large parts of this document (see [Upcoming: 1.0 launch](#upcoming-10-launch-2026-12-11) — not yet live, don't build against it).

> Research method note: WebFetch was blocked by this environment's egress proxy for every third-party gaming site attempted (maxroll.gg, poe2wiki.net, poewiki.net, game8.co, poe2db.tw, vulkk.com, fextralife, domistae.github.io, en.wikipedia.org, pathofexile2.com itself). All findings below come from WebSearch result summaries (which quote/paraphrase those same sites) rather than direct page reads. Treat zone-order and NPC-dialogue specifics as "high confidence, not verbatim-verified" — cross-check against the actual site or in-game before treating a specific quest text as authoritative. Core structural facts (act count, Cruel removal, Interludes, trial locations, ascendancy point math) are corroborated across multiple independent sources and are high-confidence.

---

## 1. Act structure overview

| Item | Current state (0.5.5, live) |
|---|---|
| Total acts | **4** (Act 1–4) |
| Cruel difficulty | **Removed** in patch 0.3.0 "The Third Edict" (2025-08-29). No second campaign playthrough anymore. |
| Replacement for Cruel | **3 Interludes** (I–III), added in the same 0.3.0 patch. Smaller "bite-sized" acts, ~19-20 new zones / ~9-12 new bosses total across the three, that carry a character from end-of-Act-4 to endgame instead of replaying Acts 1-3. |
| Post-campaign transition | **Epilogue** — "Siege of Oriath" quest, then the Ziggurat Refuge (map device / Atlas entry). |
| Route (current) | Act 1 → Act 2 → Act 3 → Act 4 → Interlude I → Interlude II → Interlude III → Epilogue (Siege of Oriath) → Atlas/maps. All 3 Interludes are **required** — maps unlock after Interlude III, not after Act 4. |
| Campaign length | ~12–30 hours depending on build/experience. |
| Character level at end of campaign | Roughly **level 60–65** by the time the Atlas/map device unlocks (after Interlude III). |

Historical note: PoE2 launched into Early Access (Dec 2024) with 3 acts + a Cruel repeat of those 3 acts (6 playthroughs' worth of zones total, PoE1-style). Act 4 was added with Cruel's removal in patch 0.3.0 (Aug 2025), simultaneously introducing the 3 Interludes as Cruel's replacement. Patch 0.5.0 "Return of the Ancients" (May 2026) did a further **non-structural** campaign pass (see §7) — no new acts, but zone/pacing reworks. As of this writing (0.5.5, Sept 2026) the act count has been stable at 4 since the 0.3.0 Third Edict patch.

**Important forward-looking caveat:** multiple secondary sources (as of Sept 2026) describe GGG's plan for full 1.0 (2026-12-11) as adding **Acts 5 and 6** for a **6-act total campaign with the Interludes removed/absorbed**, replacing the current Interlude bridge. Other sources say 0.6.0 was skipped and 1.0 will ship this content directly. This is **unreleased/planned, not live** as of 2026-09-16 — see §7.

---

## 2. Difficulty / repeat-playthrough mechanics

- No "Cruel" mode exists anymore (removed 0.3.0). There is one campaign playthrough per character, top to bottom.
- **SSF/Hardcore/Softcore** league-type distinctions are unaffected by this — they're separate from the difficulty question.
- The Interludes function as the pacing/power-curve replacement for Cruel: same purpose (bridge from campaign-level power to endgame-ready power) but without literally replaying the same zones. Confirmed permanent (non-repeatable-for-progress) content, not a temporary event league — distinct from the *unrelated* short-lived "Forbidden Rites" **event league** running alongside 0.5.5.

---

## 3. Checkpoints — PoE2's respawn system

PoE2 replaced PoE1's "die → return to last waypoint" flow with a denser **checkpoint** system:

- Checkpoints are placed throughout every campaign zone (not just at zone start/waypoints) — walking near one auto-activates it.
- Approaching/activating a checkpoint **refills flasks and charms**.
- On death (non-Hardcore), the player respawns at their **most recently activated checkpoint** in that zone, not necessarily the zone's waypoint. This is much denser than PoE1's all-or-nothing waypoint-only respawn.
- Manual respawn-at-checkpoint is available via the pause menu.
- Checkpoints, waypoints, and portals all persist until the zone instance is closed. Choosing "New Instance" on an area fully resets it (monsters, checkpoints, layout) as if entering fresh — useful for regenerating a zone to grind a specific optional boss/reward again.
- **Waypoints** remain the fast-travel network between towns/zones (as in PoE1); checkpoints are the finer-grained in-zone respawn/refill points layered on top. There is no renamed "Realmgate" for campaign travel — see §8.

---

## 4. Ascendancy classes & trials

### Trials (grant Ascendancy points)

| Trial | Unlocked in | How | Grants |
|---|---|---|---|
| **Trial of the Sekhemas** | Act 2 | Quest via Balbala's Barya; physical trial area reached through the **Traitor's Passage** (Vastiri Desert zone cluster) | First clear: unlocks chosen Ascendancy class + 2 Ascendancy points |
| **Trial of Chaos** | Act 3 | Quest via the Chimeral Inscribed Ultimatum; entrance in the **Chimeral Wetlands** area cluster | First clear: unlocks chosen Ascendancy class + 2 Ascendancy points |

- **8 Ascendancy points total**, granted in 4 pairs of 2.
- The first 4 points (2 pairs) come from **first clears** of the two campaign trials — you don't need to run both; either trial alone can eventually grant all 8 points if repeated.
- The remaining 4 points (2 more pairs) come from **repeating** the trials at higher difficulty in the **endgame**, after the campaign — this part of the progression is post-campaign, not part of the leveling-campaign trial visits.
- **Trial of Chaos was significantly reworked in patch 0.5.5** (Sept 2026): room-based rewards, a reward chest after every completed room (not just at the end), pause/resume support instead of forced full-run completion, and a reward pool now focused on Currency + Soul Cores (Corrupted Items removed from its pool).
- **Trial of the Ancestors** (Act 4) is a *separate, non-Ascendancy* optional trial — unlocked by defeating Krutog, Lord of Kin, in the Volcanic Warrens; involves 3 "Tests of Mettle" (Kaom's, Maata's, Rakiata's) and ties into the Hinekora/Eye of Hinekora storyline. It rewards **Weapon Set passive skill points**, not Ascendancy points — don't conflate it with Sekhemas/Chaos.

### Classes & Ascendancies (current, 0.5.5)

Currently playable base classes (7, pre-1.0): **Warrior, Witch, Ranger, Monk, Sorceress, Mercenary, Huntress.** Full 1.0 release is planned to expand this to **12 base classes** total (adding the classic PoE1 roster: Druid, Templar, Marauder, Duelist, Shadow), for a stated eventual total of **36 Ascendancy classes**. Not yet live as of 0.5.5 — treat as roadmap, not current state.

Known Ascendancies per class as of 0.5.5 (list evolves patch-to-patch; verify in-game before relying on this for build content):

| Class | Ascendancies |
|---|---|
| Warrior | Smith of Kitava, Titan, Warbringer |
| Witch | Infernalist, Blood Mage, Lich, Abyssal Lich |
| Ranger | Deadeye, Pathfinder |
| Monk | Invoker, Acolyte of Chayula, **Martial Artist** (new, 0.5.0) |
| Sorceress | Chronomancer, Stormweaver, Disciple of Varashta |
| Mercenary | Witch Hunter, Gemling Legionnaire, Tactician |
| Huntress | Amazon, Ritualist, **Spirit Walker** (new, 0.5.0) |

Patch 0.5.0 "Return of the Ancients" (2026-05-29) added the two bolded Ascendancies above plus "a new upgrade path" for the existing Acolyte of Chayula (Monk).

---

## 5. Per-act breakdown

Each table below lists zones in roughly campaign order (per community walkthroughs — GGG doesn't publish an official flowchart). "Finale" = the act's mandatory story-closing boss fight.

### Act 1

Theme: cold, gothic backwater — Clearfell/Ogham region. Hub town: **Clearfell Encampment**.

**Zone sequence (approx.):** Riverbank → Clearfell Encampment (town) → Clearfell → The Grelwood → The Red Vale → Grim Tangle → Cemetery of Eternals → Hunting Grounds → Freythorn (optional/recommended) → Ogham Farmlands → Ogham Village → Manor Ramparts → Ogham Manor.

**Notable NPCs:** Renly (armour/weapon merchant, Clearfell Encampment — personal connection to the player character, hints at prior relationship), Una (accessories/casting-gear merchant, Ogham; also disenchants items).

**Sample quests:** "Finding the Forge" (recover Renly's smithing tools), "The Lost Lute" (find Una's Lute in Ogham Farmlands, return to Una).

| Zone | Boss | Reward |
|---|---|---|
| Clearfell | Beira of the Rotten Pack | +10% Cold Resistance |
| Hunting Grounds | The Crowbell | 2 Weapon Set passive points |
| Freythorn (optional) | The King in the Mists | +30 Spirit |
| Ogham Farmlands | Una's Hut (quest turn-in) | 2 Weapon Set passive points |
| Ogham Manor | Candlemass, the Living Rite | +20 max Life |
| Ogham Manor | **Count Geonor** (act finale) | Story completion |

**Hidden/optional content:** Mysterious Campsite (loot chest) near a Clearfell checkpoint; Abandoned Stash (Clearfell) and Areagne's Hut (The Grelwood) drop Uncut Skill/Support gems; a random ring at the Ancient Ruins Grave Site; optional bosses Areagne the Forgotten Witch (Grelwood) and the Rotten Druid (Grim Tangle, drops an Uncut Support Gem) beyond the required Crowbell/King in the Mists/Beira/Candlemass fights.

### Act 2

Theme: desert/Maraketh region — Vastiri Desert. Hub/waypoint cluster: **Ardura Caravan**.

**Zone sequence (approx.):** Vastiri Outskirts → Ardura Caravan → Mawdun Quarry/Mine → Traitor's Passage (Trial of the Sekhemas entrance) → Halani Gates → Mastodon Badlands → The Bone Pits → Keth → The Lost City → Valley of the Titans → Deshar → Spires of Deshar → The Dreadnought (Vanguard).

**Notable NPCs:** Balbala (Barya questline, leads to Trial of the Sekhemas), Sekhema Asala (Ardura Caravan).

| Zone | Boss | Reward |
|---|---|---|
| Keth | Kabala, Constrictor Queen | 2 Weapon Set passive points |
| Keth (Heart of Keth) | Azarian | (secondary optional fight) |
| Spires of Deshar | Tor Gul, the Defiler | leads into Sisters of Garukhan / +10% Lightning Resistance |
| Valley of the Titans | Zalmarath (Titan Grotto) + Relic Altar | +1 Charm Slot, choice of Charm Charges/Duration buff |
| Deshar | Final Letter (quest item) | 2 Weapon Set passive points |
| The Dreadnought Vanguard | **Jamanra, the Abomination** (act finale) | Story completion |

**Hidden/optional content:** hidden Ascendancy-unlock boss fight inside Traitor's Passage (this *is* the Trial of Sekhemas access point); Shrine of Bones, Golden Chest, Guarded Sarcophagus events grant Uncut Skill/Support gems; Relics collected in Bone Pits + Keth turn in at Valley of the Titans for a permanent buff; Gilded Beetle (Lost City) guarantees a passive-tree Jewel.

### Act 3

Theme: jungle/Vaal ruins — Vaal-corrupted rainforest and the lost city of **Aggorat**. Hub towns: **Sandswept Marsh** (first) and **Ziggurat Encampment** (second).

**Zone sequence (approx.):** Sandswept Marsh (town) → Ziggurat Encampment (town) → Jungle Ruins → Chimeral Wetlands (Trial of Chaos entrance) → Matlan Waterways → The Azak Bog → Jiquani's Machinarium → The Venom Crypts → The Molten Vault → Aggorat → The Black Chambers.

**Notable NPCs:** Alva Valai (leads the search for lost Aggorat), Oswald (gives "The Treasures of Utzaal" side quest).

| Zone | Boss | Reward |
|---|---|---|
| Jungle Ruins | Mighty Silverfist | 2 Weapon Set passive points |
| The Venom Crypts | Venom Draught | choice of Stun Threshold / Ailment Threshold / Mana Regen buff |
| Jiquani's Machinarium | Blackjaw, the Remnant | +10% Fire Resistance |
| The Azak Bog (optional) | Ignagduk, the Bog Witch | +30 Spirit |
| The Molten Vault | (utility encounter) | Reforging Bench unlocked |
| The Molten Vault (side) | Mektul, the Forgemaster ("Treasures of Utzaal" quest) | The Hammer of Kamasa (unique) |
| Aggorat | Blood Sacrifice | 2 Weapon Set passive points |
| The Black Chambers | **Doryani, Royal Thaumaturge** (act finale) | Story completion |

**Hidden/optional content:** world-map "+" icons mark permanent-buff encounters once a zone is explored; the Reforging Bench (Molten Vault) is itself a permanent crafting-utility unlock, not just a stat.

### Act 4

Theme: Karui Archipelago (island-hopping, non-linear). Hub town: **Kingsmarch** (port town on Ngamakanui). Added in patch 0.3.0 "The Third Edict" (2025-08-29) alongside the removal of Cruel.

**Structure:** explicitly **non-linear** — up to ~8 explorable islands reachable by boat from Kingsmarch; the "required" path only needs Abandoned Prison, Whakapanu Island, Shrike Island, and Arastas, but other islands (e.g. Isle of Kin, Journey's End/Kedge Bay) are optional detours for extra permanent buffs/points. Weapon Fragments and an NPC named Matiki are randomized across islands per league/run.

**Notable NPCs:** The Hooded One (Kingsmarch, drives the endgame-transition questline), Ange (Kingsmarch, gives "Hostile Takeover" → unlocks the Shoreline Hideout), Matiki.

| Zone | Boss | Reward |
|---|---|---|
| Journey's End (Kedge Bay) | Captain Hartlin | 2 Weapon Set passive points, Lv 13 skill gem, Delirium drop |
| Isle of Kin (optional) | Blind Beast | 2 Weapon Set passive points |
| Isle of Kin — Volcanic Warrens | Krutog, Lord of Kin | unlocks Trial of the Ancestors |
| Whakapanu Island | Great White One | choice: Kaom's Lesson vs Rakiata's Lesson (major defensive keystone-style reward) |
| Eye of Hinekora | Navali's Rest | +5% max Mana |
| Halls of the Dead | Yama The White | 2 Weapon Set passive points |
| Trial of the Ancestors (Well of Passing → 3 Tests of Mettle) | Hinekora | 2 Weapon Set passive points |
| Halls of the Dead (Tawhoa's/Tasalio's/Ngamahu's Tests) | various | small attribute/resistance choices |
| Abandoned Prison | Goddess of Justice | choice: Life vs Mana flask recovery |
| Heart of the Tribe | **Tavakai, the Chieftain** (act finale) | Story completion |

**Hidden/optional content:** Meeting House (secret loot-chest room); Shoreline Hideout (personal hideout unlocked via "Hostile Takeover" quest, separate from the main story path); multiple optional islands beyond the four required ones, each with its own permanent buff.

### Interludes (I–III) — the post-Act-4, pre-Endgame bridge

Replaced the old Cruel-difficulty repeat (removed 0.3.0). All three are required to unlock the map device. ~19-20 new zones, ~9-12 new bosses total (≈6-7 areas and ≈4 bosses per Interlude).

**Interlude I — "Curse of Holten"** (return to the Ogham region)
- Ally: Renly. Goal: lift the corruption/darkness over the town of Holten.
- Zone: Wolvenhold (optional). Boss: **Oswin, the Dread Warden** — Physical/Cold, drops the Warden's Ledger, +2 Weapon Set passive points.

**Interlude II — "The Stolen Barya"** (return to the Vastiri Desert)
- Ally: Asala; introduces the Sel Khari (guardians of the Sacred Water). Goal: recover the First/Grand Barya.
- Zones: Vastiri Desert, Khari Crossing, Qimah Reservoir.
- Finale boss: **Azmadi, the Faridun Prince** — a mid-fight twist adds Zarokh, who stops time and grants Azmadi new temporal abilities at ~70% HP.
- Also involves the "Recruit the Maraketh" quest (part of assembling allies for the eventual Siege of Oriath).

**Interlude III — "Doryani's Contingency"** (Azmeri mountains)
- Goal: find Vaal descendants Doryani sealed away as a contingency against the Cataclysm.
- Zones: Howling Caves → Kriar Village/Peaks → Etched Ravine → The Cuachic Vault (maze-like, entrance opens only after killing its guardian).
- Bosses en route: The Abominable Yeti (Howling Caves, 2 Weapon Set passive points), Rakkar, Lythara (Kriar Village, +40 Spirit), Stormgore the Guardian (Etched Ravine, opens the Vault).
- Finale boss: **Zolin and Zelina** (The Cuachic Vault).

### Epilogue — Siege of Oriath → Endgame transition

- Triggers automatically once all 3 Interludes are complete (any order).
- Return to Kingsmarch, speak to **The Hooded One** → receive the **Book of Specialisation** (2 Weapon Set passive points).
- Speaking to The Hooded One again lets the player travel to Oriath / begin the "Siege of Oriath" finale whenever ready — this is the last story beat before endgame.
- After Siege of Oriath, the player arrives at **the Ziggurat Refuge**, where the Map Device and the Atlas (endgame progression system) unlock.

---

## 6. Optional/hidden content summary (cross-act)

- Every act's community "campaign secrets" guides mark permanent-buff hidden encounters distinctly from the mandatory finale bosses (Maxroll runs a dedicated "Act N Campaign Secrets" guide per act).
- Common hidden-content patterns: locked hut/chest rooms requiring a key found nearby, side-zones reachable only via an easy-to-miss path (Freythorn off Hunting Grounds, Azak Bog off Matlan Waterways), and "relic" collectible sets that combine for a buff at a specific altar (Act 2's Bone Pits/Keth relics → Valley of the Titans altar).
- Reward types split into: flat stat/resistance boosts, Weapon Set passive skill points (the PoE2-specific "two passive points per weapon set" mechanic), one-time crafting-utility unlocks (Reforging Bench, Act 3), and "choice" rewards where only one of several listed bonuses is actually granted.
- Optional bosses are typically gate-kept behind an easy-to-skip side path rather than hidden outright — the "secret" is usually that the path exists, not a puzzle.

---

## 7. Recent patch history affecting the campaign (2025-2026)

| Patch | Date | Campaign-relevant changes |
|---|---|---|
| 0.3.0 "The Third Edict" | 2025-08-29 | Added **Act 4** (Karui Archipelago). **Removed Cruel difficulty.** Added the **3 Interludes** as its replacement (~19-20 zones, ~9-12 bosses). |
| 0.5.0 "Return of the Ancients" | 2026-05-29 | No new acts — a large **non-structural** campaign pass: added environmental/directional guidance (locust trails, bloody footprints, NPC pointers) to reduce getting lost; shortened some zones; reduced monster density in the back half of the campaign to speed up leveling on league start. Also: full Atlas/endgame overhaul (Delirium, Breach, Ritual, Fate of the Vaal, Abyss, Expedition each got new hub/storyline content), 2 new Ascendancies (Spirit Walker/Huntress, Martial Artist/Monk) plus an Acolyte of Chayula upgrade path. Billed as the last major EA content patch before 1.0. |
| 0.5.5 "Forbidden Rites" | 2026-09-04 | Every campaign area now has a **guaranteed Ritual encounter** (Ritual mechanics moved into core game from the Runes of Aldur system). Major **Trial of Chaos rework**: room-based rewards, chest after every room, pause/resume support, reward pool refocused to Currency + Soul Cores (dropped Corrupted Items). Also opened the separate "Forbidden Rites" **event league** (temporary, cosmetic-challenge-focused, unrelated to the permanent campaign). |

### Upcoming: 1.0 launch (2026-12-11)

Not live as of this document's date (2026-09-16) — included for situational awareness only, do not implement against this yet:

- GGG reportedly **skipped a planned 0.6.0** patch, folding that content directly into the 1.0 launch.
- Secondary sources describe 1.0 as bringing **Acts 5 and 6**, for a stated eventual **6-act campaign**, with sources disagreeing on whether the current 3 Interludes are removed/replaced or retained alongside the new acts.
- Full class roster is planned to expand from the current 7 to **12 base classes** (adding Druid, Templar, Marauder, Duelist, Shadow), pushing total Ascendancies toward **36**.
- ExileCon 2026 (Nov 7-8) is expected to be where these details are confirmed ahead of the Dec 11 launch — re-verify all of §7's "upcoming" content and the act-count table in §1 after that event and after 1.0 actually ships.

---

## 8. Terminology notes for the tracker feature

- **No "Realmgate" exists for campaign travel.** "Realmgate" in PoE2 is an **endgame Atlas** feature used to access Pinnacle Bosses — a different system from the campaign's Waypoint/Checkpoint network. Don't rename the campaign tracker's travel concept to "Realmgate"; it would be factually wrong.
- Campaign travel = **Waypoints** (town-to-town/zone-to-zone fast travel, PoE1-style) + **Checkpoints** (dense in-zone respawn/refill points, PoE2-new — see §3). These are two distinct, coexisting systems, not a rename of one into the other.
- "Weapon Set passive skill points" is PoE2's own name for the common quest reward already modeled in `src/lib/campaign/data.ts` (`point()` reward kind) — confirmed as the single most common reward type across every act and interlude.

---

## Sources

- [Full Campaign Walkthrough and List of All Acts | Game8](https://game8.co/games/Path-of-Exile-2/archives/486659)
- [Path of Exile 2's campaign finale includes "more than one act" — PCGamesN](https://www.pcgamesn.com/path-of-exile-2/campaign-final-acts-interview-gamescom)
- [Path of Exile 2 Campaign Walkthrough — Maxroll](https://maxroll.gg/poe2/getting-started/path-of-exile-2-campaign-guide)
- [Path of Exile 2 Campaign Structure and How Many Acts in PoE2 — poe-2-builds.com](https://poe-2-builds.com/2026/02/13/how-many-acts-in-poe2/)
- [PoE 2 Campaign: 4 Acts Now, 6 Acts at 1.0 — lfcarry.com](https://lfcarry.com/guides/poe2-campaign)
- [PoE 2 Campaign Route: Four Acts, Three Interludes, Then Maps — neonsect.com](https://neonsect.com/path-of-exile-2/poe2-campaign-route-guide/)
- [Path of Exile 2 Patch 0.5.0 Changes Overview — VULKK.com](https://vulkk.com/2026/05/22/path-of-exile-2-patch-0-5-0-changes-overview/)
- [0.5.0b Patch Notes — patchbot.io](https://patchbot.io/games/path-of-exile-2/articles/371-050b-patch-notes)
- [PoE2 Patch Notes: Latest Updates & Patch History — Fextralife](https://pathofexile2.wiki.fextralife.com/Patch+Notes)
- [Path of Exile 2 — Wikipedia](https://en.wikipedia.org/wiki/Path_of_Exile_2)
- [Path of Exile 2 Patch Notes — Kami-labs.fr](https://kami-labs.fr/en/path-of-exile-2/patch-notes/)
- [Path of Exile 2 Patch 0.5.5 and 1.0 Explained — EZG](https://www.ezg.com/blog/poe-2-patch-0-5-5-and-1-0-explained-what-new-what-being-fixed-and-what-still-missing)
- [PoE 2 Next League Guide: 0.5.5 Patch Notes, New Classes, and 1.0 Release Date — mmoexp.com](https://www.mmoexp.com/News/poe-2-next-league-guide-0-5-5-patch-notes-new-classes-and-1-0-release-date-explained.html)
- [Path of Exile 2 The Third Edict Info — poe-vault.com](https://www.poe-vault.com/poe2/guides/path-of-exile-2-the-third-edict-info)
- [How Path Of Exile 2's Huge Third Edict Update Looks To Deal With "Every Problem" — GameSpot](https://www.gamespot.com/articles/how-path-of-exile-2-huge-third-edict-update-looks-to-deal-with-every-problem-upsetting-fans/1100-6534132/)
- [Cruel — Path of Exile 2 Wiki (poewiki.net)](https://www.poewiki.net/wiki/poe2wiki:Cruel)
- [How To Unlock Cruel Difficulty & PoE 2 Endgame — GameRant](https://gamerant.com/how-unlock-cruel-difficulty-poe-2-endgame-path-of-exile/)
- [Trials of Ascendancy Guide — Maxroll](https://maxroll.gg/poe2/getting-started/trials-of-ascendancy)
- [Trial of Chaos — Fextralife](https://pathofexile2.wiki.fextralife.com/Trial+of+Chaos)
- [Path of Exile 2 Trial of Sekhemas Guide — Skycoach](https://skycoach.gg/blog/path-of-exile-2/articles/trials-of-sekhema-guide)
- [PoE 2 [0.2.0] Trial of the Sekhemas Guide — rpgstash.com](https://www.rpgstash.com/blog/poe-2-trial-of-the-sekhemas-guide-tips-and-tricks-you-should-know)
- [Checkpoint — poe2wiki.net](https://www.poe2wiki.net/wiki/Checkpoint)
- [PoE 2 Campaign Guide: Fast Walkthrough & Rewards — leprestore.com](https://leprestore.com/guides/poe-2/campaign-guide/)
- [Path of Exile 2 Ogham Interlude Boss Mastery Guide — mmojugg.com](https://www.mmojugg.com/news/path-of-exile-2-ogham-interlude-boss-mastery-guide.html)
- [Patch 0.3.0 The Third Edict Reveal Summary — Maxroll](https://maxroll.gg/poe2/news/patch-0-3-0-the-third-edict-reveal-summary)
- [0.3.0 Patch Notes - The Third Edict — Maxroll](https://maxroll.gg/poe2/news/0-3-0-patch-notes-the-third-edict)
- [Path of Exile 2 0.3 patch notes: Everything new in The Third Edict — Sportskeeda](https://www.sportskeeda.com/mmo/path-exile-2-the-third-edict-patch-notes-patch-0-3-0)
- [Path of Exile 2: 0.3.0 The Third Edict All Details and Content — mmogah.com](https://www.mmogah.com/news/path-of-exile-2/path-of-exile-2-030-the-third-edict-all-details-and-content)
- [Path Of Exile 2 Patch 0.3.0 The Third Edict Update Notes Breakdown — poecurrency.com](https://www.poecurrency.com/news/poe-2-patch-0-3-0-the-third-edict-update-breakdown)
- [Act 4 and Interludes Campaign Walkthrough plus Boss Guides — Maxroll](https://maxroll.gg/poe2/news/act-4-and-interludes-campaign-walkthrough-plus-boss-guides)
- [Vastiri Interlude Boss Guide — poe-vault.com](https://www.poe-vault.com/poe2/guides/vastiri-interlude-boss-guide)
- [Ogham Interlude Boss Guide — poe-vault.com](https://www.poe-vault.com/poe2/guides/ogham-interlude-boss-guide)
- [Every Major Mission, Optional Rewards, and Interlude Chapters in PoE 2 Act 4 — GameRant](https://gamerant.com/path-of-exile-2-poe-complete-act-4-interludes-guide/)
- [Path of Exile 2 Interlude Act campaign guide — Sportskeeda](https://www.sportskeeda.com/mmo/path-exile-2-poe2-interlude-act-campaign-guide)
- [PoE 2 Interlude Acts — Mobalytics](https://mobalytics.gg/poe-2/guides/interlude-acts)
- [PoE 2 Interludes Guide — Acts 5.1–5.3 Permanent Rewards (0.5.5) — domistae.github.io](https://domistae.github.io/poe2-leveling/poe2_interludes_guide.html)
- [Act 1 Campaign Secrets Guide — Maxroll](https://maxroll.gg/poe2/getting-started/act-1-campaign-secrets)
- [PoE 2 Act 1 Walkthrough — Clearfell to Ogham (0.5.5) — domistae.github.io](https://domistae.github.io/poe2-leveling/poe2_act1_guide.html)
- [Path of Exile 2 Act 1 Progression Guide and Walkthrough — Destructoid](https://www.destructoid.com/path-of-exile-2-act-1-progression-guide-and-walkthrough/)
- [Act 1 Leveling Guide — poe2-leveling.com](https://www.poe2-leveling.com/act1)
- [Complete Act 2 Walkthrough — Game8](https://game8.co/games/Path-of-Exile-2/archives/488753)
- [Path of Exile 2 quest list — all main and side missions — PCGamesN](https://www.pcgamesn.com/path-of-exile-2/quests-missions)
- [PoE 2 Act 2 Walkthrough — Vastiri to Dreadnought (0.5.5) — domistae.github.io](https://domistae.github.io/poe2-leveling/poe2_act2_guide.html)
- [Path of Exile 2 Act 2 Campaign guide — Sportskeeda](https://www.sportskeeda.com/mmo/path-exile-2-act-2-campaign-guide-all-quests-locations-bosses-secrets)
- [Act 3 Campaign Secrets Guide — Maxroll](https://maxroll.gg/poe2/getting-started/act-3-campaign-secrets)
- [Complete Act 3 Walkthrough — Game8](https://game8.co/games/Path-of-Exile-2/archives/489757)
- [PoE 2 Act 3 Walkthrough — Sandswept Marsh to Ziggurat (0.5.5) — domistae.github.io](https://domistae.github.io/poe2-leveling/poe2_act3_guide.html)
- [Path of Exile 2 Act 3 Boss Mastery Guide — mmojugg.com](https://www.mmojugg.com/news/path-of-exile-2-act-3-boss-complete-mastery-guide.html)
- [PoE 2 Act 4 Walkthrough — Kingsmarch & The Four Islands (0.5.5) — domistae.github.io](https://domistae.github.io/poe2-leveling/poe2_act4_guide.html)
- [PoE 2 Campaign Layout Guide - Act 4 — Mobalytics](https://mobalytics.gg/poe-2/guides/campaign-layout-act-4)
- [Path of Exile 2 Act 4 Walkthrough Guide — GameRant](https://gamerant.com/path-of-exile-2-act-4-walkthrough-guide/)
- [Path of Exile 2 Act 4 and Interludes Walkthrough: Island Order to Endgame — 9Puz](https://9puz.com/4757-poe2-act-4-interludes/)
- [Path of Exile 2 Act 4 Guide: Master the Karui Archipelago — ssegold.com](https://www.ssegold.com/path-of-exile-2-act-4-guide)
- [Path of Exile 2: Trial of the Ancestors Quest Guide — Deltia's Gaming](https://deltiasgaming.com/path-of-exile-2-trial-of-the-ancestors-quest-guide/)
- [Trial of the Ancestors Quest Walkthrough — Game8](https://game8.co/games/Path-of-Exile-2/archives/547555)
- [Trial of the Ancestors — poe2wiki.net](https://www.poe2wiki.net/wiki/Trial_of_the_Ancestors)
- [Path of Exile 2 Atlas Of Worlds And Mapping (0.5.0) — Maxroll](https://maxroll.gg/poe2/resources/atlas-of-worlds-and-mapping)
- [The Ultimate Path of Exile 2 Endgame Progression Guide — Mobalytics](https://mobalytics.gg/poe-2/guides/endgame-progression-asmodeus)
- [Maps — Fextralife](https://pathofexile2.wiki.fextralife.com/Maps)
- [PoE2 Leveling Guide: How to Level Fast to Maps & Catch Up Late League (0.5) — timesaver.gg](https://timesaver.gg/blog/poe2-leveling-guide)
- [Realmgate Explained — Game8](https://game8.co/games/Path-of-Exile-2/archives/491521)
- [How to Find And Use The Realmgate in Path of Exile 2 — GameRant](https://gamerant.com/path-of-exile-2-realmgate-explained-poe2/)
- [Path of Exile 2: How To Find & Use The Realmgate — ScreenRant](https://screenrant.com/path-exile-2-find-use-realmgate/)
- [PoE 2 Ascendancy Points & Trials: Get All 8 (Sekhemas + Chaos) — poe2.stratlore.com](https://poe2.stratlore.com/en/guides/ascendancy-points-trials-guide/)
- [Ascendancy Classes And Trials In Path Of Exile 2 — LepreStore](https://leprestore.com/guides/poe-2/ascendancy-classes-and-trials-in-path-of-exile-2/)
- [PoE 2 How to Get All 8 Ascendancy Points — conquestcapped.com](https://conquestcapped.com/guides/path-of-exile-2/ascendancy-points-guide/)
- [PoE 2 Trials Guide 0.5: Sekhemas, Chaos & Madness — Boostmatch](https://boostmatch.gg/blog/poe-2/articles/poe2-trials-guide-patch-05-return-of-the-ancients)
- [PoE 2 Class Overview — Maxroll](https://maxroll.gg/poe2/resources/poe-2-class-overview)
- [Classes — Fextralife](https://pathofexile2.wiki.fextralife.com/Classes)
- [PoE 2 Classes - List of All Confirmed Classes & Their Breakdown — Mobalytics](https://mobalytics.gg/poe-2/guides/classes-breakdown)
- [Path of Exile 2: All Classes and Ascendancies Explained — VULKK.com](https://vulkk.com/2024/12/12/path-of-exile-2-all-classes-and-ascendancies-explained/)
- [List of Classes and Ascendancies — Game8](https://game8.co/games/Path-of-Exile-2/archives/485789)
- [PoE 2 Ascendancy Overview — Maxroll](https://maxroll.gg/poe2/resources/poe-2-ascendancy-overview)
- [Classes and Ascendancy Overview — poe-vault.com](https://www.poe-vault.com/poe2/guides/classes-ascendancy-overview)
- [Path of Exile 2 Character & Ascendancy tier list — Dexerto](https://www.dexerto.com/guides/all-character-ascendancy-classes-explained-in-path-of-exile-2-2998104/)
- [All Class Ascendancies In Path of Exile 2 — GameRant](https://gamerant.com/path-of-exile-2-all-class-ascensions-classes-ascendancies-poe-2-class-ascendancy-nodes/)
- [Path of Exile 2 0.5.0 Patch Notes – Return of the Ancients Changes — KeenGamer](https://www.keengamer.com/articles/guides/path-of-exile-2-0-5-0-patch-notes-return-of-the-ancients-changes/)
- [Patch 0.5 Return of the Ancients Reveal Summary — Maxroll](https://maxroll.gg/poe2/news/patch-0-5-return-of-the-ancients-reveal-summary)
- [Path of Exile 2 0.5.0 Return of the Ancients Guide Updates & More — Maxroll](https://maxroll.gg/poe2/news/path-of-exile-2-0-5-0-return-of-the-ancients-guide-updates-more)
- [Return of the Ancients — Patch 0.5.0 Codex — sidiadevelopment.github.io](https://sidiadevelopment.github.io/poe2-patch/)
- [Path of Exile 2 Patch 0.5.0 Complete Breakdown — mybiggaming.ge](https://mybiggaming.ge/en/article/poe2-0-5-0-return-of-the-ancients-complete-breakdown)
- [Path of Exile 2: Return of the Ancients Patch Notes — Titanquisitor](https://titanquisitor.com/2026/05/21/path-of-exile-2-return-of-the-ancients-patch-notes/)
- [Path of Exile 2 0.5.5 Patch Notes: Trial of Chaos Rework and Forbidden Rites Event — allthings.how](https://allthings.how/path-of-exile-2-0-5-5-patch-notes-trial-of-chaos-rework-and-forbidden-rites-event/)
- [PoE2 0.5.5 Forbidden Rites: All Challenge Rewards, Trial of Chaos Rework — InfinityBuilds](https://poe2.infinitybuilds.gg/en/news/poe2-0-5-5-forbidden-rites-all-challenge-rewards-trial-of-chaos-rework-and-what-s-new)
- [Path of Exile 2 Patch 0.5.5 Forbidden Rites Event League — IGGM](https://www.iggm.com/news/poe-2-patch-0-5-5-forbidden-rites-event-league-ritual-goes-core-trial-of-chaos-overhaul)
- [Path of Exile 2 0.5.5: Forbidden Rites Event, Trial of Chaos Rework & Duelist Guide — mmoexp.com](https://www.mmoexp.com/News/path-of-exile-2-0-5-5-forbidden-rites-event-trial-of-chaos-rework-duelist-guide.html)
- [PoE 2 Trial of Chaos Rework 0.5.5 | Rewards & Strategy — mmoso.com](https://www.mmoso.com/news/poe-2-trial-of-chaos-rework-rewards-and-strategy)
- [Legacy of the Precursors — Fextralife](https://pathofexile2.wiki.fextralife.com/Legacy+of+the+Precursors)
- [Siege of Oriath — Fextralife](https://pathofexile2.wiki.fextralife.com/Siege+of+Oriath)
- [Endgame — poe2wiki.net](https://www.poe2wiki.net/wiki/Endgame)
- [Renly — Fextralife](https://pathofexile2.wiki.fextralife.com/Renly)
- [Renly Location, Quests, and Services — Game8](https://game8.co/games/Path-of-Exile-2/archives/492044)
- [Path of Exile 2 Act 1 Campaign Guide — VULKK.com](https://vulkk.com/2025/11/12/path-of-exile-2-campaign-guide-act-1/)
- [PoE 2 The Search Quest — Fextralife](https://pathofexile2.wiki.fextralife.com/The+Search)
- [Path of Exile 2: All Act 4 side-objectives — Sportskeeda](https://www.sportskeeda.com/mmo/path-exile-2-act-4-campaign-guide-poe2)
- [Path of Exile 2 Act 2 Secrets & Hidden Rewards — ethugamer.com](https://ethugamer.com/path-of-exile-2/path-of-exile-2-act-2-secrets-hidden-rewards-complete-exploration-guide-and-walkthrough/)
- [Path of Exile 2 Act 2 Boss Guide — chaosboost.com](https://www.chaosboost.com/guides/path-of-exile-2-act-2-boss-guide)
- [Path of Exile 2 Secret Bosses and Permanent Upgrades Guide — gamefused.com](https://gamefused.com/guides/path-of-exile-2-secret-bosses-and-permanent-upgrades-guide-all-acts-1-3)
