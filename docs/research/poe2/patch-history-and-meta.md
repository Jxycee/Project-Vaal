# Path of Exile 2 — Patch History & Meta Snapshot

## Last updated
2026-09-16

## Purpose
Fills the knowledge gap between Claude's training cutoff (~Jan 2026) and today. Covers release timeline, chronological changelog (Jan–Sep 2026), current league, current version, community sentiment, platform notes for PS5/Xbox, and a dated meta snapshot. Written for future Claude sessions working on Project Vaal (a fan companion app for PoE2 console players) — verify dates against official sources before relying on anything time-sensitive, since GGG's roadmap has shifted before.

---

## 1. Versioning scheme

GGG uses **decimal Early Access versioning**: `0.1.0` → `0.5.5`, with letter-suffixed hotfixes (`0.4.0c`, `0.5.4b`, etc.) between numbered content patches. There is **no 1.0 yet** — the game is still in paid Early Access as of today. Full release will be versioned **`1.0.0`**, launching **December 11, 2026**. Post-1.0, GGG has stated the plan is a new league roughly every 3–4 months (matching PoE1's cadence), so expect `1.1`, `1.2`, etc. going forward from Dec 2026.

## 2. Release timeline recap

| Version | Date | Name / League | Notes |
|---|---|---|---|
| 0.1.0 | Dec 6, 2024 | Early Access launch | 3 acts, 6 classes (Warrior, Monk, Ranger, Sorceress, Mercenary, Witch), paid EA on PC, PS5, Xbox Series X\|S simultaneously. Originally slated Nov 15, 2024, delayed ~3 weeks. |
| 0.1.0f + hotfixes | Dec 2024 – early 2025 | — | Includes fixes for a severe PS5/Xbox controller input-lag bug (see §7). |
| 0.2.0 | Apr 4, 2025 | **Dawn of the Hunt** | Huntress class (spear, ranged+melee hybrid), 5 new Ascendancies, 25 new skills, 100+ support gems, 100+ uniques, fresh-start league. **Major community backlash** — see §6. |
| 0.3.0 | Aug 29, 2025 | **The Third Edict** — Rise of the Abyssals league | Added Act 4; Abyss league mechanic. |
| 0.3.0c + hotfixes | Sep–Nov 2025 | — | Balance/bugfix iteration on Act 4 and Abyss. |
| 0.4.0 | Dec 12, 2025 | **The Last of the Druids** — Fate of the Vaal league | Druid class (Int/hybrid shapeshifter: 3 animal forms) with Shaman and Oracle Ascendancies; Fate of the Vaal league (Vaal Temple / Lira Vaal, sacrifice mechanic tied to Atziri); Abyss promoted to a core (permanent) mechanic. |
| 0.4.0c – 0.4.0i | Dec 2025 – May 2026 | — | Nine incremental hotfix/balance patches bridging to 0.5.0 (Vaal Temple tuning, skill bug fixes, reward-chest rework for boss-less encounters, etc.). |
| 0.5.0 | May 29, 2026 | **Return of the Ancients** — Runes of Aldur league | **Largest EA update to date.** Kalguuran runesmithing theme; Runeforging system with 100+ new Runes; new Runic Ward defensive layer; massive Atlas of Worlds / endgame rework; Ezomyte Remnant league encounters (fight → resurrect empowered → refight for loot, results saved to a permanent Runebook). |
| 0.5.1 | Jun 2026 | — | +24 Atlas Passive Skills (top section, biome-specific), more Atlas points from Fortress Towers/Gateways/Enigma Chambers/Halls, new Lineage Support Gem, new elemental Atlas passives, Breach density fix (now stacks additively with Pack Size). |
| 0.5.2 | Jun 2026 | — | Runes of Aldur buffs, Delirium monster tuning (less tanky/less damage), endgame buffs, new "On the Wind" multichoice Atlas Keystone, general bugfixes. |
| 0.5.3 | Jun 18, 2026 | — | Iteration patch (balance/bugfix). |
| 0.5.4 | Jun 24, 2026 | — | Iteration patch. |
| 0.5.4b | Jul 2, 2026 | — | Hotfix. |
| 0.5.5 | Sep 4, 2026 | **Forbidden Rites** event league | **Current patch.** Ritual mechanic spread into the entire campaign (every zone gets an Effigy/Ritual encounter); Ritual chaining (consecutive clears stack extra bosses into one fight, full chain guarantees a Unique); per-player Tribute in parties (no more one player hoovering rewards); Trial of Chaos overhaul; Expedition (from 0.5.0's Aldur content) promoted to a core mechanic with Expedition Tablets in the endgame; new Viridian Wildwood endgame content. Event league runs *alongside* the existing 0.5 (Runes of Aldur) league rather than replacing it — players can keep their 0.5 character or start fresh in Forbidden Rites. |
| (unnamed 2nd event league) | Expected Oct–Nov 2026 | — | GGG confirmed a second short temporary event league before 1.0, reportedly remixing existing content and adding "dozens" of missing mid-game unique items. Name/date not yet announced as of Sep 16, 2026 — **check for updates**. |
| ExileCon 2026 | Nov 7–8, 2026 | Auckland, NZ | GGG's third ExileCon. Expected venue for the biggest 1.0 reveals; unreleased content playable on-site; keynote streamed publicly. Ticket sales opened Feb 10, 2026. |
| **1.0.0** | **Dec 11, 2026** | Full release | Leaves Early Access. **Free-to-play** on PC (Steam/Epic), PS5, Xbox Series X\|S. Adds Acts 5 & 6 (replacing the 3 campaign Interludes used as placeholders in EA) for a total of 6 acts, no interludes. Adds the **Duelist** class (Str/Dex hybrid, sword-and-shield, starts from the Mercenary's tree region) and the new **Sword** weapon type (stance/combo/parry-based melee system, not exclusive to Duelist — showcased with Cyclone, dual-wielding swords, parries). Swords had been a long-running community meme as PoE2's "missing" weapon type. |

## 3. Chronological changelog, Jan–Sep 2026 (the training-data gap)

- **Jan–May 2026**: Lived mostly under **0.4.0 "The Last of the Druids" / Fate of the Vaal** league, with hotfix patches 0.4.0c through 0.4.0i tuning the Vaal Temple mechanic, Druid skills (Walking Calamity, Lunar Blessing, Rolling Magma, etc.), and reward distribution.
- **May 29, 2026 — 0.5.0 Return of the Ancients**: Biggest content drop of the year. New league (Runes of Aldur), full Atlas/endgame rework, Runeforging crafting layer, Runic Ward mechanic. Widely called the "bridge to 1.0" — GGG stated everything after this patch is polish/balance toward launch, with no numbered 0.6 planned.
- **Jun 2026 — 0.5.1 / 0.5.2 / 0.5.3 / 0.5.4 / 0.5.4b**: Rapid iteration cycle (roughly weekly) fixing Runes of Aldur balance, Atlas passive additions, Delirium tuning, and general bugs. GGG shipped hotfixes "sometimes multiple times a day" in the weeks right after 0.5.0 due to bug volume.
- **Jul–Aug 2026**: Relatively quiet patch-wise (0.5.4b was Jul 2); GGG's messaging shifted to previewing the Duelist/Swords reveal and the Forbidden Rites event, culminating in the Gamescom ONL 2026 presentation (week of Aug 26, 2026) where the **Dec 11, 2026 1.0 date** and Duelist class were officially confirmed.
- **Sep 4, 2026 — 0.5.5 Forbidden Rites**: Event league launch (see table above). This is the **current patch** as of today (Sep 16, 2026).

## 4. Current active league (as of Sep 16, 2026)

- **Name**: Forbidden Rites (event league)
- **Mechanic**: Campaign-wide Ritual — every main-campaign zone now contains a Ritual/Effigy encounter; consecutive clears chain into stacked multi-boss fights with a guaranteed Unique on a full chain completion; Tribute is now tracked per-player in parties. Endgame also gets Expedition promoted to a core mechanic (Expedition Tablets) plus the new Viridian Wildwood content.
- **Started**: September 4, 2026, 1 PM PDT
- **Expected end**: Runs until the 1.0.0 full release on **December 11, 2026** (it is a bridge/event league, not a standard 3-month challenge league, and coexists with the ongoing 0.5 Runes of Aldur league rather than resetting it).
- Note: a second, still-unnamed short event league is expected to launch between Forbidden Rites and ExileCon 2026 (Nov 7–8) — watch for an announcement in Oct/Nov 2026.

## 5. Current game version

**0.5.5** ("Forbidden Rites"), Early Access, as of September 16, 2026. Next major milestone is **1.0.0** on December 11, 2026.

## 6. Community sentiment / controversies

- **Historical benchmark (context, pre-window)**: The worst community blowup in PoE2's history was **0.2.0 "Dawn of the Hunt"** (Apr 2025) — nerfs intended to hit top-end endgame builds also gutted campaign pacing, made the new Huntress feel weak, and triggered Steam reviews collapsing to "Mostly Negative" plus heavy review-bombing. GGG published a "What We're Working On" post admitting "blatant f\*\*\*-ups" (e.g., unintended monster HP bloat) and rushed emergency hotfixes. Community reaction to GGG's mea culpa was itself skeptical ("like reading a Blizzard post on fixing Diablo 4"). This event still shapes community trust going into 1.0.
- **0.5.0 "Return of the Ancients" (May 2026)**: Reception notably better than 0.2.0 — praised as the game's biggest and most ambitious update — but not without complaints: perceived over-complexity for newcomers, performance/compatibility issues at launch, and balance imbalance around map enhancement and Pinnacle Bosses. GGG responded with an unusually fast hotfix cadence (multiple fixes per day in the first weeks).
- **Monetization**: GGG continues to frame PoE2 as "ethical free-to-play" — cosmetics-only, no loot boxes/gacha, Early Access purchase grants access not power. Recurring friction point: cosmetic MTX releases perceived as poorly timed against active bug complaints, and PoE1 cosmetics not automatically carrying over to PoE2 (some players report large historical PoE1 spend with no PoE2 equivalent).
- **1.0 hype**: Strong positive anticipation around (a) the Duelist class and long-memed "missing" Sword weapon type, (b) full free-to-play conversion removing the EA paywall, (c) Acts 5–6 completing the 6-act campaign, and (d) ExileCon 2026 (Nov 7–8, Auckland) as the venue for further 1.0 reveals. GGG has said it is "confident" in the Dec 11 date but has not ruled out slipping into early 2027 if needed — worth rechecking closer to the date.

## 7. Platform-specific notes (PS5 / Xbox) — relevant to Project Vaal

- PoE2 has shipped on **PC, PS5, and Xbox Series X\|S simultaneously since Early Access day one** (0.1.0, Dec 6 2024) — unlike PoE1, which was PC-first for years before console ports. This is structurally different from most cross-platform ARPGs and generally reduces the odds of long console patch-parity lag, since GGG builds/tests for console from the start of each patch cycle.
- **Known historical issue**: at EA launch, PS5/Xbox suffered a severe controller input-lag bug (reported over 1000ms delay between input and action), rendering the game barely playable on console for a short period; fixed via a rapid hotfix (0.1.0f-era).
- **Current-cycle console specifics (0.4.x/0.5.x)**: could not confirm via available sources whether 0.5.0–0.5.5 shipped exactly same-day on all platforms or whether console saw any cert-driven delay — general pattern from prior patches is simultaneous or near-simultaneous release, with occasional platform-specific crash hotfixes shipped shortly after (e.g., earlier PS5-specific crash-prevention tweaks bundled into point patches). **This is a gap — verify directly against patch-note release posts (they typically state "available now on PC, PlayStation 5, and Xbox Series X/S") before relying on it for Project Vaal's own patch-tracking features.**
- Practical implication for Project Vaal: since GGG's own release cadence is console-day-one, a "PC-only for now, console coming later" caveat is generally **not** needed for PoE2 patch notes — but Project Vaal should still watch each patch announcement for the explicit platform list, since exceptions have happened (crash hotfixes sometimes target one platform first).

## 8. Meta snapshot — Sep 2026 (patch 0.5.5, Forbidden Rites)

*Goes stale fast; snapshot dated to this patch only.*

- **S-tier builds**: Ice Shot Deadeye (Ranger), Ice Strike Martial Artist (Monk), Explosive Shot Invoker (Mercenary/Witch Ascendancy), Demon Recoup Infernalist (Witch).
- **Other strong meta builds**: Twister Spirit Walker (Druid), Twisters Deadeye, Whirling Assault Martial Artist, Galvanic/Stormblast Buff Stacker Tactician, CoC Spark/Frostbolt Comet Recoup Infernalist.
- **Top class by playstyle**:
  - Ranged: **Deadeye** (Ranger ascendancy) — considered the undisputed top ranged option.
  - Spellcaster: **Sorceress** — top elemental scaling across fire/cold/lightning.
  - Melee: **Monk** — highest ceiling and build flexibility (Dex/Int hybrid, staff or unarmed).
- **Beginner-friendly league starters**: Plant Oracle Druid, Ice Shot Deadeye, ED (Essence Drain) Lich (Witch ascendancy).

## Sources

- [PoE2 Patch Notes: Latest Path of Exile 2 Updates & Patch History (Fextralife)](https://pathofexile2.wiki.fextralife.com/Patch+Notes)
- [0.5.5 Patch Notes and Summary (Game8)](https://game8.co/games/Path-of-Exile-2/archives/617539)
- [0.5.4 Patch Notes and Summary (Game8)](https://game8.co/games/Path-of-Exile-2/archives/606723)
- [0.5.3 Full Patch Notes and Summary (Game8)](https://game8.co/games/Path-of-Exile-2/archives/605971)
- [0.5 Return of the Ancients Patch Notes and Summary (Game8)](https://game8.co/games/Path-of-Exile-2/archives/601782)
- [All PoE 2 Patch Notes (Updated) (Game8)](https://game8.co/games/Path-of-Exile-2/archives/489485)
- [0.3.0c Patch Notes and Summary (Game8)](https://game8.co/games/Path-of-Exile-2/archives/550597)
- [0.3.0 Full Patch Notes (Game8)](https://game8.co/games/Path-of-Exile-2/archives/536361)
- [Path of Exile 2 Patch Notes — Every Update, Version by Version (Kami-labs.fr)](https://kami-labs.fr/en/patch-notes-poe2/)
- [POE2 Patch Notes: Complete History of Every Path of Exile (Poetrades)](https://poetrades.net/poe2-patch-notes/)
- [0.5.4b Patch Notes · Path of Exile 2 update for 2 July 2026 (SteamDB)](https://steamdb.info/patchnotes/24028803/)
- [Path of Exile 2 update for 3 January 2026 (SteamDB)](https://steamdb.info/patchnotes/21370307/)
- [Path of Exile 2 gets a full 1.0 release date, and a sword class (PCGamesN)](https://www.pcgamesn.com/path-of-exile-2/1-0-release-date)
- [Path of Exile 2 1.0 To Launch December 11th (Maxroll)](https://maxroll.gg/poe2/news/path-of-exile-2-1-0-to-launch-december-11th)
- [Path of Exile 2 Leaves Early Access for Full 1.0 Release on December 11 (AllKeyShop)](https://www.allkeyshop.com/blog/path-of-exile-2-1-0-release-date-news-r/)
- [Path of Exile 2 previews September 4's Forbidden Rites league and 1.0's new Duelist class (MassivelyOP)](https://massivelyop.com/2026/08/28/path-of-exile-2-previews-september-4s-forbidden-rites-league-and-1-0s-new-duelist-class/)
- [Path of Exile 2's first event league goes 'oops, all bosses' and reworks its worst mode (PC Gamer)](https://www.pcgamer.com/games/rpg/path-of-exile-2s-first-event-league-goes-oops-all-bosses-and-reworks-its-worst-mode-so-sane-people-can-finally-enjoy-it/)
- [Path of Exile 2 answers questions about its upcoming Forbidden Rites league (MassivelyOP)](https://massivelyop.com/2026/09/01/path-of-exile-2-answers-questions-about-its-upcoming-forbidden-rites-league/)
- [Path of Exile 2's Forbidden Rites League Launches September 4th With Tons of Changes (Out of Games)](https://outof.games/news/9741-path-of-exile-2s-forbidden-rites-league-launches-september-4th-with-tons-of-changes/)
- [GGS — All Path of Exile 2 Leagues: Complete List & Dates (2026) (ggseason.com)](https://ggseason.com/blog/path-of-exile-2-all-leagues-dates/)
- [Path of Exile 2 Updates (aRPG Timeline)](https://www.arpg-timeline.com/game/path-of-exile2)
- [Path of Exile 2 Forbidden Rites: League Start Time and Full Breakdown (egamersworld)](https://egamersworld.com/blog/path-of-exile-2-forbidden-rites-league-start-time--FIhcm05hg)
- [Path of Exile Current League (August 2026) (slashskill)](https://www.slashskill.com/path-of-exile-current-league/)
- [Path of Exile 2 0.5.0 Return of the Ancients Guide Updates & More (Maxroll)](https://maxroll.gg/poe2/news/path-of-exile-2-0-5-0-return-of-the-ancients-guide-updates-more)
- [Return of the Ancients Expansion Guide (Fextralife wiki)](https://pathofexile2.wiki.fextralife.com/Return+of+the+Ancients)
- [Path of Exile 2 0.5.0 Patch Notes – Return of the Ancients Changes (KeenGamer)](https://www.keengamer.com/articles/guides/path-of-exile-2-0-5-0-patch-notes-return-of-the-ancients-changes/)
- [Path of Exile 2 0.5.0 Patch Notes – Return of the Ancients (Maxroll)](https://maxroll.gg/poe2/news/0-5-0-patch-notes-return-of-the-ancients)
- [PoE 2 0.5 Return of the Ancients: Content Livestream Summary (Mobalytics)](https://mobalytics.gg/poe-2/guides/0-5-return-of-the-ancients-content-livestream-summary)
- [Path of Exile 2 0.5.0 Return of the Ancients Preview (ComicBook.com)](https://comicbook.com/gaming/feature/path-of-exile-2-0-5-0-return-of-the-ancients-preview-everything-to-know-about-the-massive-foundational-update/)
- [Path of Exile 2 Release Date: Early Access and Final Release (noping.com)](https://noping.com/blog/path-of-exile-2-release-date)
- [Path of Exile 2 Early Access Announcement - December 6 Launch Details (poe2game.com)](https://poe2game.com/en/news-announcement)
- [PoE 2 Patch 0.4.0 Is Launching in Early December! (poe-vault)](https://www.poe-vault.com/poe2/news/poe-2-patch-0-4-0-is-launching-in-early-december)
- [Path of Exile 2 Briefs (Update 0.4 Cycle) (VULKK.com)](https://vulkk.com/2025/12/04/path-of-exile-2-briefs-update-0-4-cycle/)
- [PoE 2 0.4 Release Date & Patch Notes (The Last of Druids) (aoeah)](https://www.aoeah.com/news/4147--poe-2-04-release-date--next-league-update-leaks)
- [PoE2 Leagues Guide: All Dates and Key Features (gamingcy)](https://gamingcy.com/blog/poe2-leagues-all-dates)
- [0.4.0 Patch Notes – The Last of the Druids (Maxroll)](https://maxroll.gg/poe2/news/0-4-0-patch-notes-the-last-of-the-druids)
- [Patch Notes for 0.4.0c (Maxroll)](https://maxroll.gg/poe2/news/patch-notes-for-0-4-0c)
- [PoE 2 Delivers Major Fate of the Vaal Improvements in Patch 0.4.0c (mmoexp)](https://www.mmoexp.com/News/poe-2-delivers-major-fate-of-the-vaal-improvements-in-patch-0-4-0c.html)
- [Path of Exile 2 0.5.2 Patch Notes (Maxroll)](https://maxroll.gg/poe2/news/0-5-2-patch-notes)
- [Path of Exile 2 patch 0.5.2 notes: What's changed (Sportskeeda)](https://www.sportskeeda.com/mmo/path-exile-2-patch-0-5-2-notes)
- [Path of Exile 2 Duelist Revealed: New Sword Combat, Cyclone, Parry, Forbidden Rites and 0.5.5 Update (mmoexp)](https://www.mmoexp.com/News/path-of-exile-2-duelist-revealed-new-sword-combat-cyclone-parry-forbidden-rites-and-0-5-5-update.html)
- [Path of Exile 2 1.0 Release Date Confirmed: Duelist Class, Swords and Full Launch Details Revealed (EZG)](https://www.ezg.com/blog/poe-2-1-0-release-date-confirmed-december-11-duelist-and-swords-full-launch-details-revealed)
- [Path of Exile 2 gets free-to-play 1.0 launch in December 2026, adds new Duelist class (GosuGamers)](https://www.gosugamers.net/entertainment/news/79049-path-of-exile-2-gets-free-to-play-1-0-launch-in-december-2026-adds-new-duelist-class)
- [Gamescom ONL 2026: Path Of Exile 2 Announces Its Official 1.0 Release (Yahoo Tech)](https://tech.yahoo.com/gaming/articles/gamescom-onl-2026-path-exile-195650711.html)
- [PoE 2 Campaign: 4 Acts Now, 6 Acts at 1.0 (December 11, 2026) (lfcarry)](https://lfcarry.com/guides/poe2-campaign)
- [Full Campaign Walkthrough and List of All Acts (Game8)](https://game8.co/games/Path-of-Exile-2/archives/486659)
- [Path of Exile 2 Campaign Structure and How Many Acts in PoE2 (poe-2-builds.com)](https://poe-2-builds.com/2026/02/13/how-many-acts-in-poe2/)
- [Path of Exile 2's Nerf-Update Caused Backlash (80.lv)](https://80.lv/articles/path-of-exile-2-faces-backlash-for-making-the-combat-soulless)
- [Path of Exile 2's nerf-happy update has the playerbase revolting (PC Gamer)](https://www.pcgamer.com/games/strategy/path-of-exile-2s-nerf-happy-update-has-the-playerbase-revolting-review-bombing-their-baby-and-scorning-the-developers-promises-like-reading-a-blizzard-post-on-fixing-diablo-4/)
- [Path Of Exile 2's Latest Nerfs Cause Uproar In Community (TheGamer)](https://www.thegamer.com/path-of-exile-2-players-are-deleting-characters-after-huge-round-of-nerfs/)
- [Path of Exile 2 Now Has 'Mostly Negative' Reviews (GameRant)](https://gamerant.com/path-of-exile-2-negative-reviews-why-backlash-dawn-of-hunt-bad-difficult/)
- [Path Of Exile 2 Devs Respond To Unpopular Update (GameSpot)](https://www.gamespot.com/articles/path-of-exile-2-devs-respond-to-unpopular-update-there-were-some-blatant-f-ups/1100-6530736/)
- [Path Of Exile 2 Dev Reflects After Update Gets Review-Bombed (Kotaku)](https://kotaku.com/path-exile-2-poe-nerfs-patch-notes-dawn-hunt-1851775526)
- [Path of Exile 2 faces fan backlash after latest update results in review bombs (Windows Central)](https://www.windowscentral.com/gaming/as-path-of-exile-2s-review-score-continues-to-plummet-another-arpg-overtakes-it-on-steam)
- ["There were some blatant f**k-ups": devs rush emergency patches (Yahoo Tech)](https://tech.yahoo.com/gaming/articles/were-blatant-f-k-ups-153928182.html)
- [Path of Exile 2 Patch 0.5 Pros and Cons (EZG)](https://www.ezg.com/blog/poe-2-patch-0-5-pros-and-cons-performance-compatibility-map-enhancement-process)
- [PoE 2 Patch 0.5.0: Players Are Gaining 40+ FPS With One Simple Setting (EZG)](https://www.ezg.com/blog/poe-2-patch-0-5-0-return-of-the-ancient-players-gaining-40-fps-one-simple-setting)
- [Path of Exile 2 is sticking to its 'ethical free-to-play' model (PC Gamer)](https://www.pcgamer.com/games/rpg/path-of-exile-2-is-sticking-to-its-ethical-f2p-live-service-model-instead-of-chasing-diablo-4s-success/)
- [Players Are Not Happy About Path of Exile 2's New Microtransactions (GameRant)](https://gamerant.com/path-of-exile-2-microtransactions-player-frustration/)
- [PoE2 Build Tier List - Best Path of Exile 2 Guides for current Patch (Odealo)](https://odealo.com/articles/path-of-exile-2-build-tier-list)
- [PoE 2 0.5.5 Best Builds (Game8)](https://game8.co/games/Path-of-Exile-2/archives/487634)
- [League Starter Build Tier List (Maxroll)](https://maxroll.gg/poe2/tierlists/league-starter-build-tier-list)
- [Best PoE 2 Class in 2026: Full Tier List and Beginner Guide (Eneba)](https://www.eneba.com/hub/games/best-poe-2-class/)
- [Path of Exile 2 Tier List - Expert (September 2026) Guide (ofzenandcomputing)](https://www.ofzenandcomputing.com/path-of-exile-2-tier-list/)
- [Path of Exile 2 Tier List (September 2026) Ultimate Builds Ranked (boundbyflame)](https://boundbyflame.com/path-of-exile-2-tier-list/)
- [Path of Exile 2 Best Builds, PoE 2 Builds Tier List (Overgear)](https://overgear.com/guides/poe-2/builds-tier-list/)
- [Path of Exile 2 0.5.5 Forbidden Rites Update: Full Patch Breakdown & 2026 Endgame Roadmap (mmoexp)](https://www.mmoexp.com/News/path-of-exile-2-0-5-5-forbidden-rites-update-full-patch-breakdown-2026-endgame-roadmap.html)
- [0.5.5 Forbidden Rites Event Launch Date and Endgame Changes (Maxroll)](https://maxroll.gg/poe2/news/0-5-5-forbidden-rites-event-launch-date-and-endgame-changes)
- [0.5.5 Forbidden Rites Patch Notes (Maxroll)](https://maxroll.gg/poe2/news/0-5-5-forbidden-rites-patch-notes)
- [Forbidden Rites: What Changes on September 4 (Kami-labs.fr)](https://kami-labs.fr/en/path-of-exile-2/forbidden-rites-poe2-ce-qui-change/)
- [Path of Exile 2 0.5.5 Patch Notes Breakdown (IGGM)](https://www.iggm.com/news/poe-2-0-5-5-patch-notes-how-ritual-expedition-reshape-forbidden-rites-farming)
- [Path of Exile 2's final major update before 1.0 is Return of the Ancients (GosuGamers)](https://www.gosugamers.net/entertainment/news/78400-path-of-exile-2-s-final-major-content-update-before-1-0-is-return-of-the-ancients-expands-endgame)
- [PoE2 Roadmap 2026: 0.5.5 Update, ExileCon & 1.0 Release (Expert Game Reviews)](https://expertgamereviews.com/poe2-roadmap-0-5-5-exilecon-1-0-release/)
- [Path of Exile 2 Roadmap 2026 Explained (IGGM)](https://www.iggm.com/news/poe-2-roadmap-2026-explained-1-0-launch-window-patch-0-5-0-endgame-rework)
- [PoE 2 2026 Roadmap: 0.5.0 Launch, 1.0 Release Date & What's Coming (rpgstash)](https://www.rpgstash.com/blog/poe-2-2026-roadmap-upcoming-updates-and-endgame-plans)
- [Path of Exile in 2026: Mirage League, PoE 2 Roadmap, and What to Play (slashskill)](https://www.slashskill.com/path-of-exile-in-2026-mirage-league-poe-2-roadmap-and-what-to-play/)
- [Path of Exile on X — ExileCon 2026 announcement](https://x.com/pathofexile/status/2016271424147829130)
- [GGG Announce Third Exilecon to be held this November (poe-vault)](https://www.poe-vault.com/poe2/news/ggg-announce-third-exilecon-to-be-held-this-november)
- [ExileCon 2026 - Path of Exile 2 (official)](https://pathofexile2.com/exilecon)
- [PoE2 ExileCon 2026: Dates, Race Qualifiers, Twitch Drops & the Road to 1.0 (timesaver.gg)](https://timesaver.gg/blog/poe2-exilecon-2026-guide)
- [Path of Exile 2 patch 0.2.0 - Dawn of The Hunt release date, Huntress class, Spears (Sportskeeda)](https://sportskeeda.com/mmo/path-exile-2-patch-0-2-0-release-date-dawn-of-the-hunt-poe2-huntress-spear)
- [Patch 0.2.0 Dawn of the Hunt Reveal Megapost (Maxroll)](https://maxroll.gg/poe2/news/patch-0-2-0-dawn-of-the-hunt-reveal-megapost)
- [PoE2 Patch 0.3.0 Drops August 29 (poe-vault)](https://www.poe-vault.com/poe2/news/poe2-patch-0-3-0-drops-august-29-small-update-out-now)
- [Path of Exile 2 Patch 0.3.0 Release Date Revealed (rpgstash)](https://www.rpgstash.com/blog/poe-2-patch-0-3-0-release-date-announced)
