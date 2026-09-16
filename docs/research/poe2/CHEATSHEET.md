# PoE2 Cheat Sheet — Read This First

One-page orientation for a Claude context that doesn't have time to read all 17 files in this folder. Every fact here is expanded, sourced, and sometimes corrected in a full doc — follow the pointer before hardcoding anything numeric. See `README.md` for the full file index and feature-relevance map.

## Where the game is right now (2026-09-16)

- **Early Access**, version **0.5.5 "Forbidden Rites"** (event league, since 2026-09-04), on base patch **0.5.0 "Return of the Ancients"** (challenge league "Runes of Aldur", since 2026-05-29). Standard also exists.
- **1.0 full release: 2026-12-11.** Free-to-play at that point (EA currently gates entry behind a ~$30 pack). Expected to add Acts 5-6 (campaign is 4 acts + Interludes + Epilogue right now, not 6), a Duelist class, and Swords. Not live — treat as roadmap.
- ExileCon 2026: Nov 7-8, Auckland.
- Full detail: `patch-history-and-meta.md`.

## Characters

- **8 base classes** live: Warrior, Ranger, Monk, Sorceress, Mercenary, Witch (launch six) + Huntress (added 0.2.0) + Druid (added 0.4.0). Duelist confirmed coming at 1.0.
- Every class starts with **29 total attribute points**, split either 15/7/7 (one dominant attribute) or 11/11/7 (hybrid). Confirmed straight from GGG's tree export — see `verified-corrections.md §1.1`.
- **22 ascendancies** across the 8 classes (not a flat 2-per-class — 6 classes have 3 ascendancies, Ranger and Druid still have 2). One hidden variant exists: Witch's Lich ascendancy has a secret "Abyssal Lich" upgrade path unlocked via an Abyss-boss drop — see `verified-corrections.md §1.3`.
- **8 ascendancy points total**, awarded 2 per full completion of Trial of the Sekhemas or Trial of Chaos (either trial, mixable), up to 4 completions. Confirmed via GGG's own tooling constants — `verified-corrections.md §1.2`.
- The tree is shared — class = starting position + starting attributes + weapon flavor only. Ascendancy choice is the one hard lock; everything else multiclasses by pathing.
- Full detail: `classes-and-ascendancies.md`, `passive-tree.md`.

## Campaign

- **4 acts + 3 Interludes + Epilogue** (not 6 acts, no PoE1-style "Cruel" repeat — Cruel was removed in patch 0.3.0). Route: Act 1→4 → Interlude I/II/III → Epilogue → maps.
- **Campaign difficulty is still "Normal" + "Cruel"** as an explicit, GGG-acknowledged EA placeholder (confirmed in `verified-corrections.md §3.2`) — this is a *different* Cruel than the pre-0.3.0 full-act-repeat; don't conflate the two if you see both terms in older material.
- Maps unlock after Interlude III, roughly character level 60-65.
- Full detail: `campaign-and-acts.md`.

## Items, crafting, currency

- Rarity: Normal / Magic (1-2 affixes) / Rare (3 affix slots) / Unique.
- **No gear sockets/links in the PoE1 sense.** Runes and Soul Cores are the new socketable gear-modification system. Skill gems live in a separate skill panel, not sockets in items.
- **Orb of Alchemy = 4 random modifiers** (confirmed exact count, `verified-corrections.md §2.1`). Chaos Orb ≠ base trade currency in PoE2 (it's scarcer, more a crafting tool); **Exalted Orb is the base trade unit**, Divine Orb is the premium tier, Mirror of Kalandra is the ceiling.
- **19 standard Essences** (4-tier ladder) + 6 special single-tier Essences (Hysteria/Delirium/Horror/Insanity/Abyss/Breach) — full list in `verified-corrections.md §2.2`.
- **44 Omens**, **12 Catalysts**. ⚠️ Catalyst names are the **PoE1-legacy set** (Reaver, Adaptive, Sibilant, Chayula's, Tul's, Carapace, Xoph's, Flesh, Esh's, Neural, Uul-Netol's, Skittering) — an earlier research pass guessed wrong placeholder names, corrected in `verified-corrections.md §2.2`. Catalysts only apply to **rings/amulets**, not belts.
- **No PoE1 "3 identical uniques → reroll" vendor recipe.** Fully replaced by the Reforging Bench (combine 3 items → 1 random-stat item). Confirmed absent, `verified-corrections.md §2.4`.
- **No Divination Cards.** Closest analogue: Reliquary Key + boss-locked unique pools. A rumor (single low-confidence source) says Div Cards might return in 1.1/1.2 — not confirmed.
- Trade: in-game **Currency Exchange** (NPC order-book, currency-only, Gold fee) is the main path; manual whisper-trade still exists for gear/uniques/gems (the Exchange doesn't cover those).
- Full detail: `items-and-crafting.md`, `currency-and-economy.md`, `monsters-and-loot.md`.

## Endgame

- **Waystones**, not "Maps." Tiers 1-15 native, T16 via Vaal Orb corruption only, "T17-19" via node mods on top of T16.
- **Atlas Passive Tree**: ~300 points, no respec, unlock-everything design (not build-around like PoE1's Atlas tree).
- Core league mechanics confirmed live: **Breach, Ritual, Expedition, Delirium, Abyss** (Abyss folded in as permanent content in 0.4.0). **Delve and Heist confirmed absent.** **Incursion's status is genuinely unresolved** — data-mining gives false positives here, see `verified-corrections.md §3.1` for why this one specific question resists verification.
- PoE2-original endgame structures: **Citadels** → Arbiter of Ash → **Arbiter of Divinity** (top pinnacle, 0.5.0, Origin Tower).
- Level cap 100; campaign gets you to ~60-65.
- Full detail: `endgame-and-atlas.md`.

## Combat & skills

- Gems live in a dedicated skill panel, not item sockets. 2→5 support-gem slots per skill via Uncut Gems.
- **Spirit** is a new resource (separate pool from Mana) for reservation of Persistent-tagged skills (auras, minions, banners) — replaces PoE1's mana-reservation-for-auras design.
- 6 ailments: ignite, chill, freeze, shock, bleed, poison — base magnitudes/durations documented in `gems-and-skills.md`.
- No Trap/Mine skill tag — Grenades (Mercenary) and Totems fill that design space instead. Don't assume PoE1 trap mechanics carry over.
- Full detail: `gems-and-skills.md`.

## Build sharing (feeds Project Vaal's own feature directly)

- **PoB2** (community Path of Building port, PathOfBuildingCommunity, desktop/Lua-only) is the de facto planning tool — its absence on console is exactly the gap Project Vaal exists to fill.
- GGG also ships an **official in-game Build Planner** producing `.build` JSON files with a documented schema (name/author/ascendancy/passives/skills/inventory_slots) — but it's a guide format (text hints, no rolled mods, no real gem-level field).
- 🔑 **Biggest finding of this whole research set:** GGG has a **working OAuth character API with `realm=poe2` support** (equipped gear + passive tree), already used live by Maxroll for character import. The `realm` parameter is confirmed to also accept `xbox` and `sony` values elsewhere in the API — strong evidence console-linked characters are queryable the same way, though the exact PoE2-specific mechanism is unconfirmed (`verified-corrections.md §4.2`). **This is the path to "import your real character" instead of manual build entry** — but OAuth app registration may currently be gated to new applicants (unconfirmed either way, `verified-corrections.md §4.1`); budget for a direct GGG contact rather than assuming self-service signup.
- Full detail: `build-sharing-ecosystem.md`.

## Console-specific (the whole reason Project Vaal exists)

- Console lacks: Path of Building desktop, price-check overlays (Exiled Exchange 2), community tree-planner import.
- Console has: in-game Trade/Market panel, Currency Exchange, Merchant Tab Instant Buyout.
- Full crossplay + cross-progression across PC/PS5/Xbox (not PS4). MTX/stash tabs are platform-locked to where purchased.
- Stash/tree/trade menus are the consistently-reported weak spot for controller UX; combat controls are fine.
- Console patch cadence: content patches ship simultaneously across platforms; hotfixes can lag on console pending platform cert.
- Full detail: `console-player-experience.md`, `accessibility-and-platform-notes.md`.

## Tooling this repo actually depends on

- `@poe2-toolkit` (rajtik76, MIT): passive tree via `tree-core`/`tree-react` (PixiJS), wiki data via a GGPK/patch-CDN extractor built on `pathofexile-dat` (the PyPoE successor). ⚠️ **This repo's pins are behind upstream** — upstream shipped a breaking `tree-core`/`tree-react` 1.0.0 and a breaking gem-extractor 2.0.0 in roughly the last two months. Worth a deliberate upgrade pass, not silent drift.
- poe2scout.com (feeds `/prices`): community-run, MIT, authenticates to GGG via OAuth rather than scraping.
- GGG's own API has uneven PoE2 coverage: League/Character/Ladder support `realm=poe2` (Ladder added 2026-07-21); there is **no PoE2 Public Stash Tab API**.
- Full detail: `data-tooling-ecosystem.md`.

## Known unresolved questions (don't state these as fact without a fresh check)

- Does Incursion exist as live PoE2 content? (`verified-corrections.md §3.1`)
- Exact rare-monster base affix ceiling (2-4 confirmed as the range, no single pinned number). (`verified-corrections.md §5.2`)
- Is GGG's OAuth app registration currently open to new third-party developers? (`verified-corrections.md §4.1`)
- Exact mechanism for querying a console-linked (PSN/Xbox) character via the GGG character API. (`verified-corrections.md §4.2`)
- Divination-Card-equivalent on the 1.1/1.2 roadmap — single low-confidence source only.

## Sandbox limitation that shaped this whole research set

WebFetch was blocked for essentially every non-GitHub domain in the sandbox these agents ran in (confirmed against `pathofexile.com`, wikis, Wikipedia, even `example.com`). What worked: WebSearch (budget-limited, ~200 calls/agent) and direct GitHub reads (`raw.githubusercontent.com`, `github.com`). The docs sourced from cloned GitHub repos that mirror GGG's actual game data (`passive-tree.md`, `build-sharing-ecosystem.md`, `data-tooling-ecosystem.md`, `verified-corrections.md`) are meaningfully more reliable than the ones relying on WebSearch-snippet synthesis alone. If a future session has working WebFetch to gaming-wiki domains, re-running the weakest files (`campaign-and-acts.md`, `endgame-and-atlas.md`) against primary wiki pages would raise confidence further.
