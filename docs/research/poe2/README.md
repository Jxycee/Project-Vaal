# PoE2 Research — Index

Encyclopedic reference on Path of Exile 2, gathered for Project Vaal (PoE2 console companion app). Written for a Claude context to load quickly, not for prose reading. Each file is independently useful; cross-reference by filename, not by memorizing this index.

**In a hurry? Read `CHEATSHEET.md` instead of this whole index — it's the condensed version of everything below.**

**Baseline facts true across all files as of 2026-09-16** (re-verify before trusting long-term — this game moves fast):
- PoE2 is **Early Access**, not 1.0. Current patch: **0.5.5 "Forbidden Rites"** (event league, started 2026-09-04), running alongside base patch **0.5.0 "Return of the Ancients"** (challenge league "Runes of Aldur", started 2026-05-29).
- **1.0 full release targeted 2026-12-11** — free-to-play, expected to add Acts 5-6, a Duelist class + Swords. Not live yet; treat as roadmap, not current state.
- ExileCon 2026: Nov 7-8, Auckland — expect 1.0 reveals there.
- 8 base classes currently live: Warrior, Ranger, Monk, Sorceress, Mercenary, Witch, Huntress (added 0.2.0), Druid (added 0.4.0).
- Campaign is **4 acts + 3 Interludes + Epilogue**, not 6 acts and not a PoE1-style "Cruel" repeat (Cruel was removed in 0.3.0).

## Files

| File | Covers | Strongest source |
|---|---|---|
| `passive-tree.md` | Node types, keystones, ascendancy unlock, jewel sockets, GGG's actual tree-export JSON schema | **Verified directly against GGG's public data repo** (github.com/grindinggear/poe2-skilltree-export) — most reliable doc in the set |
| `gems-and-skills.md` | Gem/socket system, Spirit resource, ailments, combat mechanics, weapon sets | Cross-checked against repo's own `public/data/wiki/2026-08-25/skills/*.json` |
| `items-and-crafting.md` | Rarity tiers, affixes, currency orbs, Runes/Soul Cores, essences, trade | WebSearch synthesis; flags open items to re-verify |
| `currency-and-economy.md` | Currency Exchange mechanics, currency hierarchy, leagues, poe2scout.com API shape | Cross-checked against repo's own `src/lib/prices/poe2scout.ts` client |
| `campaign-and-acts.md` | Per-act zones/bosses/NPCs, ascendancy trial locations, checkpoints | WebSearch synthesis (WebFetch blocked this run) |
| `endgame-and-atlas.md` | Waystones, Atlas passive tree, league mechanics, pinnacle bosses, Citadels | WebSearch synthesis (WebFetch blocked this run) |
| `classes-and-ascendancies.md` | Per-class attributes/weapons/playstyle, all 22 ascendancies | WebSearch synthesis; flags 2 unverified specifics |
| `patch-history-and-meta.md` | Full EA version timeline (0.1.0→0.5.5), current league, community sentiment | WebSearch synthesis — fills the ~8-month gap past model training cutoff |
| `console-player-experience.md` | What PC tools console lacks, controller UX pain points, crossplay/cross-save, patch-cadence parity | WebSearch synthesis, partial (search quota hit) |
| `glossary.md` | ~70-term alphabetical PoE2 jargon lookup, notes what PoE1 concepts do NOT carry over | WebSearch + trained knowledge |
| `build-sharing-ecosystem.md` | PoB2 community tool + share-code format, GGG's official `.build` planner file schema, **GGG's OAuth character API with realm=poe2 support** (live character import — used by Maxroll today) | Read PoB2 and poe2-build-planner source directly off GitHub — first-party-grade, not snippets |
| `monsters-and-loot.md` | Monster rarity/affixes, loot filters, no Divination Cards (Reliquary Key is the closest analogue), boss-locked uniques, Item Rarity nerf controversy | WebSearch synthesis; cross-checked against `endgame-and-atlas.md` for consistency |
| `data-tooling-ecosystem.md` | How `@poe2-toolkit` actually extracts data (GGPK/patch-CDN via `pathofexile-dat`, PyPoE's successor), poe2scout.com's stack, GGG API's per-endpoint PoE2 coverage, **this repo's toolkit pins are behind upstream** (breaking 1.0.0/2.0.0 releases already shipped) | Read `@poe2-toolkit`, poe2scout, and `pathofexile-dat` source directly off GitHub |
| `accessibility-and-platform-notes.md` | Colorblind/QoL settings, known bugs process, monetization (confirmed F2P; **EA's $30 entry paywall drops at 1.0**), crossplay/cross-progression, Twitch drops | WebSearch synthesis, partial (search quota hit) |

## Known research gaps / re-verify list

Every wave-1 agent hit the same two sandbox limits: **WebFetch was egress-blocked for nearly all gaming domains** (poe2wiki.net, poe2db.tw, maxroll.gg, fextralife, game8, pathofexile2.com, even Wikipedia), and **WebSearch has a ~200-call/session budget** that several agents exhausted. Everything not sourced from the repo's own data or GGG's public GitHub rests on search-result-snippet synthesis, not full-page reads. Treat exact numbers (attribute totals, ascendancy point counts, exact currency ratios, essence/omen counts) as approximate until re-verified with a working fetch path. Each file's own "Sources" section flags its weakest specific claims.

## Relevance map to Project Vaal features

- **Passive tree viewer** (`src/components/tree`, `src/lib/tree`, `public/data/tree/`) → `passive-tree.md`
- **Item/gem/skill wiki** (`src/app/wiki`, `src/lib/wiki`, `public/data/wiki/`) → `items-and-crafting.md`, `gems-and-skills.md`
- **Price check** (`src/app/prices`, `src/lib/prices`) → `currency-and-economy.md`
- **Campaign tracker** (`src/components/campaign`, `src/lib/campaign`) → `campaign-and-acts.md`
- **Build sharing** → `build-sharing-ecosystem.md` (start here — has the GGG character-API finding), `classes-and-ascendancies.md`, `gems-and-skills.md`, `passive-tree.md`
- **Console-first positioning / UX rationale** → `console-player-experience.md`, `accessibility-and-platform-notes.md`
- **`@poe2-toolkit` upgrade planning / wiki-sync tooling** → `data-tooling-ecosystem.md` (flags this repo's pinned versions are behind upstream)
- **Anything else, jargon lookup** → `glossary.md`, `patch-history-and-meta.md`, `monsters-and-loot.md`

## Wave 2 additions (2026-09-16, same session)

Added after the initial 9: `build-sharing-ecosystem.md`, `monsters-and-loot.md`, `data-tooling-ecosystem.md`, `accessibility-and-platform-notes.md`. Same sandbox limitations applied (WebFetch egress-blocked for gaming-wiki domains, generally still worked for raw GitHub). Where an agent could substitute a GitHub source read for a blocked wiki page, sourcing quality is notably higher (see `build-sharing-ecosystem.md`, `data-tooling-ecosystem.md`, and `passive-tree.md`) — prefer those three when you need a citable fact instead of a synthesized one.

## Wave 3 additions (2026-09-16, same session)

- `lore-and-worldbuilding.md` — story/setting/factions/villains, and the Vaal-as-lore-concept section this app's own name invites. Corrects one wrong premise from the original research brief: **Sekhema Asala is an ally, not a villain.**
- `verified-corrections.md` — **read this before trusting a flagged claim in any other file.** A dedicated re-verification pass that resolved 17 items previously marked uncertain, mostly by cloning `PathOfBuildingCommunity/PathOfBuilding-PoE2` and `SilkroadLabs/rePoE2` off GitHub and reading GGG's actual exported game data (tree JSON, item/mod/essence/catalyst data) instead of wiki snippets. Confirmed exact per-class attribute totals (29 total, split 15/7/7 or 11/11/7), the 8-point ascendancy cap, and full Essence/Omen/Catalyst lists; **corrected** the Catalyst name list (real names are PoE1-legacy: Reaver/Adaptive/Chayula's/etc — ring/amulet only, not belts) and confirmed the PoE1 3-identical-uniques vendor recipe does **not** exist in PoE2 (fully replaced by the Reforging Bench). Also flags a technique caveat: this data-mining approach gives false positives for "does this mechanic exist" questions (Delve/Heist/Blight assets ship in the client despite being confirmed absent from live PoE2) — use it for exact names/numbers, not existence questions.

This verification agent hit a session-wide API rate limit partway through and had to be resumed — 2 items (Incursion's existence in PoE2, exact rare-monster affix ceiling, GGG OAuth registration status) remain genuinely unresolved despite the extra effort; see that file's own summary table for the full CONFIRMED/CORRECTED/STILL UNVERIFIED breakdown.

## Wave 4 addition (2026-09-16, same session)

- `pvp-and-competitive.md` — the one genuine gap left after waves 1-3. Short and conclusive: **PoE2 has no PvP in Early Access** (no duels, arena, PvP ladder, or PvP league — PoE1 had all of these and none carried over). "Competitive" content is entirely PvE: per-league level ladders and periodic fixed-seed race events, including an ExileCon 2026 qualifier series. Guilds are chat + shared stash only, no guild-vs-guild content.
- `CHEATSHEET.md` — a one-page condensed cross-reference of every file's key findings and corrections, written directly (not by a subagent) for a Claude context that needs fast orientation without reading all 17 content files. **Start here.**
