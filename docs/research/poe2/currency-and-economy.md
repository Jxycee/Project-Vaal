# Path of Exile 2 — Currency & Economy Research

Research notes for Project Vaal's `/prices` feature. Compiled by web research (see Sources);
not derived from GGG's private docs. Numbers are point-in-time snapshots and will drift —
treat exact figures as illustrative of scale/shape, not as data to hardcode.

## Last updated

**2026-09-16.** Game state reflected: patch **0.5.5 "Forbidden Rites"** (event league live since
2026-09-04, running on top of the still-active **0.5.0 "Return of the Ancients"** patch, whose
challenge league is **Runes of Aldur**, live since 2026-05-29). PoE2 is still in Early Access;
full **1.0 launch (free-to-play) is confirmed for 2026-12-11**, alongside a new Duelist class.

---

## 1. TL;DR for another Claude instance

- PoE2 replaced PoE1's chaos-orb-standard manual trade with an **NPC-run automated Currency
  Exchange** for stackable currency only. Non-currency items (gear, uniques, gems, etc.) still
  trade via the **external website trade site** (manual, whisper-based, ~90% of item trade volume).
- The de-facto base trading unit is the **Exalted Orb** (abundant, "everyday" denomination),
  with the **Divine Orb** as the premium/high-value denomination. **Chaos Orb exists but is NOT
  the base unit like in PoE1** — it's a scarcer, higher-value targeted-crafting orb worth roughly
  20-25x an Exalted Orb. Do not assume PoE1 conventions carry over.
- **Mirror of Kalandra** remains the top-of-market currency, priced in thousands of Divine Orbs,
  with prices reported inconsistently across trackers due to near-zero trade volume.
- **Gold** is a separate, untradeable, character-bound currency used for vendor buys, passive
  respec, and paying the Currency Exchange's transaction fee. It is never a price denomination.
- Project Vaal's `/prices` page sources data from **poe2scout.com**'s public API
  (`api.poe2scout.com`), pricing everything relative to Exalted Orb, per
  `src/lib/prices/poe2scout.ts` in this repo.
- As of this writing there are **three parallel, fully separate economies** live simultaneously:
  Standard Core, Runes of Aldur (the current permanent-ish challenge league), and Forbidden Rites
  (short event league, ends at 1.0 launch 2026-12-11) — each further split by Softcore/Hardcore/SSF.

---

## 2. The Currency Exchange system

### 2.1 What it is

An in-game, NPC-operated (kiosk-style), automated, order-book-based market for **stackable
currency items only**. It was carried over from Path of Exile 1's "Settlers of Kalguur" league
trial and made a core PoE2 feature. It fully replaces manual player-to-player trade *for currency*
— there is no whispering, no scams, no manual meetup for currency-for-currency trades.

### 2.2 Unlocking it

- Unlocks automatically upon **finishing the campaign (Act 3 / completing the story)** — no
  separate quest.
- No purchase, stash tab, or other gate required.

### 2.3 How a trade works

1. Player picks the currency they **want** (left side) and the currency they're **offering**
   (right side).
2. The UI shows the current **Market Ratio** — a single global exchange rate between the two
   items, computed server-side across all open orders for that pair, per realm/league (e.g. "6
   Lesser Jeweller's Orbs : 1 Exalted Orb").
3. Player can accept the current ratio or set a custom one and **Place Order** (a limit order).
4. If a matching opposite-direction order exists, the trade executes **instantly**, no counter-
   party interaction needed. Otherwise the order sits on the book until filled or cancelled.
5. This is effectively a **continuous double-auction / order-book market**, not a peer-to-peer
   listing board like the manual trade site.

### 2.4 Fees

- **Buyer pays a Gold fee** on top of the ask price — a system tax, not something sellers see
  deducted or that goes to another player.
- Fee **scales with the rarity/tier and quantity** of the currency being bought (small for
  Transmutation Orbs, much larger for Divine Orbs in volume).
- Fee is **shown up-front** on the listing/tooltip before confirming — no hidden cost.
- Since Gold is earned from monster kills/vendoring and is **not tradeable**, the Gold-fee design
  is GGG's chosen currency sink and also rate-limits high-frequency exchange abuse/bot flipping.

### 2.5 Scope and limitations

- Currency Exchange handles **only stackable currency-type items** (orbs, scarabs/fragments-like
  items, etc. — anything in the "Currency" family of tabs). It explicitly does **not** support:
  gear/weapons, unique items, skill/support gems, jewels, or other non-stacking items.
  Manual trade (the official website trade search + in-game whisper/party-invite flow) is still
  required for those and reportedly carries the large majority (~90%) of overall trade
  *transactions* by count, even though the Currency Exchange handles the bulk of pure
  currency-to-currency volume.
- Exchange rates and order books are **scoped per league/mode** — Standard, each challenge
  league, and Hardcore variants of each all have independent, non-interacting order books (see
  §4).

---

## 3. Currency hierarchy ("what is money" in PoE2)

**Important divergence from PoE1**: PoE1 used Chaos Orb as the base trading unit ("chaos
standard"). **PoE2 does not.** The practical hierarchy, low value → high value, as commonly used
for pricing on trade sites and price trackers:

| Tier | Item | Role | Notes |
|---|---|---|---|
| Low/bulk | **Exalted Orb** | The de-facto base trading denomination — abundant, used for small-to-mid trades, most listings priced "in Exalts." | Adds one new random modifier to a Rare item. |
| Mid, scarcer than Exalted per-unit-value | **Chaos Orb** | Exists as a currency item but is comparatively rare; worth substantially more per orb than an Exalted Orb (roughly 20-25x as of Sept 2026), used more as a crafting tool than a trade medium. | Removes one random modifier and adds a new random modifier to a Rare item (a "reroll one mod" tool, not PoE1's full-reroll Chaos). |
| High/premium | **Divine Orb** | The premium/high-value denomination; big-ticket items (most uniques, high-end rares) are priced "in Divines." | Rerolls the numeric values of a Rare item's existing modifiers (never adds/removes mods). |
| Mirror-tier | **Mirror of Kalandra** | Ultra-rare "money-no-object" ceiling; the single most valuable tradeable item in the game. Perfectly duplicates an item (with some restrictions). Priced in (thousands of) Divine Orbs since almost nothing else is a large enough unit. | So few change hands that trackers disagree by a wide margin. |
| Non-tradeable | **Gold** | Character/account-bound, cannot be given or sold to other players. Used for vendor purchases, passive-tree respec cost, and the Currency Exchange's buyer-side fee. | Farmed from kills and selling to vendors. |

Other notable currency items referenced in guides (non-exhaustive — full canonical list belongs
in GGG's own item data / poe2scout's category list, not reproduced in full here since it churns
every patch):
- **Orb of Transmutation / Augmentation / Alchemy / Regal Orb / Vaal Orb** — early-to-mid crafting
  currency, drop commonly, low individual value.
- **Greater / Perfect (tiered) Orbs** — patch 0.5 introduced tiered "Greater" and "Perfect"
  variants of several base currency types (e.g. Greater Jeweller's Orb, Perfect Jeweller's Orb),
  which are stronger/rarer versions used in higher-end crafting; they carry meaningfully higher
  trade value than their base version.
- **Fragments / Scarab-equivalents / Waystones (maps)** — endgame-access and juicing currency;
  Waystones (PoE2's renamed Maps) are also handled through the Currency/Fragment side of the
  exchange in some categorizations.

### 3.1 Live benchmark snapshot (Sept 2026, Runes of Aldur league, subject to constant drift)

| Pair | Approx. rate (mid-Sept 2026) |
|---|---|
| 1 Divine Orb | ≈ 263 Exalted Orbs |
| 1 Divine Orb | ≈ 10.76 Chaos Orbs |
| 1 Chaos Orb | ≈ 24 Exalted Orbs (derived) |
| Mirror of Kalandra | ≈ 2,000 Divine Orbs (estimates ranged 2,000–5,300 across the 0.5.x cycle; extremely low liquidity, trackers disagree by thousands) |

High-value equippable uniques (mid-Sept 2026 estimates, all "priced in Divines," expect large
swings and cross-tracker disagreement near the top):

| Item | Approx. price |
|---|---|
| Temporalis (teleport Silk Robe) | ~4,400 Divine |
| Hinekora's Lock | ~1,100 Divine |
| Voices | ~1,090 Divine |
| Mageblood | ~420 Divine |
| Headhunter | ~90 Divine |
| The Adorned | ~31 Divine |

Treat all of the above as **illustrative of relative scale only** — do not hardcode or cite as
current fact beyond this document's date.

---

## 4. Leagues, economies, and game modes

### 4.1 League cadence

- PoE2 entered Early Access **2024-12-06**. Since then it has run 5 leagues (4 completed + the
  current one as of writing), *not* on a fixed 3-month cadence:

| League / Patch | Approx. dates | Duration |
|---|---|---|
| 0.1.0 (EA launch league) | 2024-12-06 → ~2025-04-04 | ~119 days |
| 0.2.0 "Dawn of the Hunt" | 2025-04-04 → 2025-09-19 | 168 days (longest so far) |
| 0.3.0 | 2025-09-19 → 2025-12-12 | 84 days (shortest so far) |
| 0.4.0 | 2025-12-12 → ~2026-05-29 | ~168 days |
| 0.5.0 "Return of the Ancients" (league: **Runes of Aldur**) | 2026-05-29 → ongoing | ongoing (~110+ days and counting as of Sept 2026) |
| 0.5.5 "Forbidden Rites" (event league) | 2026-09-04 → 2026-12-11 (ends at 1.0 launch) | ~98 days |

- Average completed-league length has been **~128 days (~18 weeks)**, with real variance
  (84–168 days) — do not assume PoE1's fixed ~3-month rhythm applies. GGG has stated a
  4-5 month target cadence during EA but has not hit it consistently; the 0.4→0.5 gap ran closer
  to 6 months.
- **This will change at 1.0** (2026-12-11): full release moves PoE2 to the standard live-service
  league model (GGG has historically run ~3-month leagues for PoE1 post-launch), but the exact
  post-1.0 cadence has not been confirmed as of this research.

### 4.2 Current active leagues as of 2026-09-16

Per the 0.5.5 patch notes, there are now **three parallel, fully independent economies**, each
with Softcore/Hardcore/SSF splits:

1. **Standard Core** — the permanent, no-reset league; content from expired challenge leagues
   ("Runes of Aldur going core" folds its now-permanent mechanics/items into Standard once its
   challenge-league run ends).
2. **Runes of Aldur** — the 0.5.0 challenge league (started 2026-05-29), themed around
   Runesmithing/rune-crafting via ~100+ new runes, Ezomyte Remnants, and a reworked Atlas/endgame.
   Still the "main" challenge league as of Sept 2026.
3. **Forbidden Rites** — a short-lived **event league** (started 2026-09-04, ends with 1.0 launch
   2026-12-11). Fresh, from-scratch economy (all currency/market reset to zero). Mechanic: a
   King-in-the-Mists cult performs Ritual-style encounters throughout every campaign area (not
   just endgame), dropping crafting currency and gear useful for leveling. Includes reworked
   Trial of Chaos (rewards now Currency + Soul Cores only, no corrupted-item outcome) and
   Ritual/Expedition balance changes.

All three (and their Hardcore/SSF variants) have **completely separate order books** — a Currency
Exchange rate or trade listing in one has no bearing on another.

### 4.3 Standard vs. league economy

- **Standard** is the permanent realm; characters and stash persist forever, and it accumulates
  the largest overall item/currency supply over time (least volatile, generally cheapest per-item
  since supply is highest and demand/hype is lowest).
- **Challenge/event leagues** start every character and the entire market at zero. Prices are
  most volatile in the first days/weeks (scarcity of endgame currency), then stabilize as farming
  scales up, then often taper as players finish and migrate back to Standard at league end (when
  characters/stash merge into Standard).
- Poe2scout and other trackers report prices **per league** — Project Vaal's `/prices` sync must
  pick the correct current league string (poe2scout's `/Leagues` endpoint flags the active one
  via `IsCurrent: true`) rather than hardcoding a league name, since the "current" league changes
  every few months and sometimes (as now) there are multiple simultaneously-current leagues.

### 4.4 Softcore vs. Hardcore vs. Solo Self-Found (SSF)

| Mode | Trade eligibility | Notes |
|---|---|---|
| **Softcore (SC)** | Full trade — Currency Exchange + manual trade site | Default mode; largest population, deepest/most liquid economy. |
| **Hardcore (HC)** | Full trade, but **only with other players in the same Hardcore league** | Character death demotes the character to the parent Softcore league (it doesn't just delete). HC has its own separate Currency Exchange order book and its own trade-site listings — cannot trade with SC players directly. Generally smaller, less liquid economy; low-volume item prices are less reliable/more swingy than SC. |
| **Solo Self-Found (SSF)** | **No trading of any kind** — Currency Exchange and manual trade are both disabled | Also disables partying. Every item/currency must come from the player's own drops/crafting. Can be toggled on for a character and switched back to the parent (tradeable) league at will, but not the reverse mid-character in the way that matters for trade (once traded, effectively no longer "self-found" in spirit though the mechanical switch exists per official mechanics). No mechanical loot/rate bonus for SSF — it's a self-imposed challenge mode, not a buffed one. |

Hardcore and SSF can be **combined** (Hardcore SSF), which stacks both restriction sets.

---

## 5. Stash tabs relevant to trading

- Stash tab currency: **Points**, purchasable via the in-game Microtransaction shop or the
  official website store. **10 Points ≈ $1 USD.**
- Relevant premium tab types:

| Tab | Approx. price | Purpose |
|---|---|---|
| Premium (generic) Tab | ~30-40 Points | Basic tradeable/sellable tab (adds "public" listing style tagging used by the old manual-trade flow). |
| **Currency Tab** | ~75 Points | Auto-stacks/organizes currency items into a grid by type; the practical tab for anyone doing volume Currency Exchange trading. |
| **Map / Waystone Tab** | ~150 Points | Auto-organizes Waystones (PoE2's endgame maps) by tier; relevant to endgame-currency-adjacent trading (waystones/fragments trade heavily). |
| Quad Tab | ~150 Points | 4x capacity generic tab, popular for bulk currency/item storage. |
| Gem Tab / Flask Tab | ~40 Points each | Organizational, lower trading relevance. |

- Stash tab **sales** run periodically (~every 3 weeks, ~4-day sale window historically) —
  relevant only as general color, not to Project Vaal's price data.
- None of these tabs are **required** to use the Currency Exchange (that's an NPC UI, not
  tab-dependent), but a Currency Tab is the practical way active traders manage exchange-eligible
  stock.

---

## 6. poe2scout.com — Project Vaal's price data source

### 6.1 What it is

An independent (not GGG-affiliated), community-run market-tracking site/service for PoE2,
analogous to poe.ninja for PoE1. Tracks real-time-ish item and currency pricing, price history,
and Currency Exchange market metrics. MIT-licensed, open-source
(`github.com/poe2scout/poe2scout`).

### 6.2 Architecture (from its own repo)

- Monorepo: React Router frontend (`apps/new-web`, served at poe2scout.com; a legacy React app
  also lives at old.poe2scout.com), a .NET backend API, and Python worker services.
- Workers: **item-sync**, **price-fetch**, and **currency-exchange** services running
  continuously against a Postgres + Redis backing store.
- The workers authenticate to what the repo's env vars label `POEAPI_CLIENT_ID` /
  `POEAPI_CLIENT_SECRET`, strongly implying it pulls from GGG's **official Path of Exile
  API/OAuth** (the same public API family GGG exposes for trade/stash data) rather than scraping
  the website — i.e., it's built on top of official, GGG-sanctioned data access, not an
  unofficial scrape.
- Infra: Docker Compose for Postgres/Redis/observability; Caddy for public routing; blue/green
  API deploys.

### 6.3 Public API (used by Project Vaal)

- Canonical base: **`https://api.poe2scout.com`**. Legacy `poe2scout.com/api/*` URLs still work
  via a compatibility proxy but new integrations should use the canonical host.
- Swagger/OpenAPI docs published at `https://api.poe2scout.com/swagger`.
- Realm segment in the path: Project Vaal calls it as `.../poe2/...` (there's presumably a `poe1`
  realm too, given the site's PoE1 heritage as poe.ninja-adjacent tooling).
- **Confirmed-working endpoints** (verified against this repo's own client,
  `src/lib/prices/poe2scout.ts`, last rewritten 2026-06-13):
  - `GET /{realm}/Leagues` → array of `{ Value: string (league name), DivinePrice: number
    (1 Divine = N Exalted), IsCurrent: boolean }`.
  - `GET /{realm}/Leagues/{LeagueName}/Currencies/ByCategory?Category=...&ReferenceCurrency=...&Page=&PerPage=&DataPoints=&FrequencyHours=`
    → paginated `{ CurrentPage, Pages, Total, Items: [...] }` of currency items, each with
    `{ ApiId, Text, IconUrl, CurrentPrice, CategoryApiId, ItemMetadata }`.
  - `GET /{realm}/Leagues/{LeagueName}/Uniques/ByCategory?...` → same shape for unique items,
    keyed by `UniqueItemId`/`ItemId` instead of `ApiId`.
  - Query params are **PascalCase and required**: `Category`, `ReferenceCurrency`, `Page`,
    `PerPage`, `DataPoints`, `FrequencyHours` — omitting `ReferenceCurrency`, `DataPoints`, or
    `FrequencyHours` returns HTTP 422/400. `DataPoints` is constrained to a small enum (7 or 8
    observed; 7 used as the safe minimum).
  - `ReferenceCurrency` lets a caller get `CurrentPrice` expressed directly in a chosen unit
    (Project Vaal uses `exalted`, so `CurrentPrice` comes back already in Exalted-Orb terms;
    Exalted's own self-price row isn't returned by the API and must be synthesized as `1.0`
    client-side).
  - The broader third-party MCP wrapper (`vanzan01/poe2scout-mcp`) documents additional surface:
    `get_leagues`, `get_currency_items`, `get_unique_items`, `get_unique_base_items`,
    `get_uniques_by_base_name`, `get_item_categories`, `get_item_filters`, `analyze_price_history`
    (trend/volatility/signal analysis over history), `basic_search`, `get_api_status`
    (rate-limit/health), `get_landing_splash_info`. It also documents a **currency-exchange
    snapshot** capability returning market-wide **Volume** and **Market Cap** per league/pair,
    though the exact REST path for that wasn't independently confirmed here (check
    `api.poe2scout.com/swagger` directly for the authoritative route).
- **Rate limiting**: courtesy guidance is to stay under ~2 requests/second and to identify
  yourself with a contact email in the `User-Agent` header for sustained use (Project Vaal already
  does both — see `userAgent()` and the 600ms inter-page `sleep()` in `poe2scout.ts`). The
  third-party MCP wrapper documents an observed limit of "2 req/s with burst capacity of 5."
- **Coverage caveat**: poe2scout focuses on high-volume/liquid items; low-volume gear/rare-affix
  searches are explicitly noted (by the MCP wrapper docs) as often returning empty — it is a
  currency/notable-uniques tracker first, not a full item-search engine.

### 6.4 Update frequency

- Not formally documented by poe2scout itself, but its data model distinguishes:
  - **Raw History**: high-frequency logs, "typically hourly."
  - **Daily Stats**: aggregated Min/Max/Mean per day.
- Practical expectation: prices are near-real-time but not truly live — expect on the order of
  minutes-to-an-hour of lag versus the actual in-game Currency Exchange state, with more lag
  possible around major meta shifts or GGG API hiccups.

---

## 7. Recent economy-affecting changes (as of Sept 2026)

- **0.5.0 "Return of the Ancients" (2026-05-29)** — biggest patch of the EA cycle pre-1.0: full
  Atlas/endgame restructure, 2 new Ascendancies, and the **Runes of Aldur** league adding 100+
  new runes as a fresh gear-customization layer (meaningful new crafting-currency demand sink).
- **0.5.5 "Forbidden Rites" (2026-09-04)** — mid-cycle patch:
  - Full **economy reset** for the new event league (fresh order books).
  - **Runes of Aldur's mechanics went core** — i.e., folded permanently into Standard/base game
    rather than disappearing at league end, per GGG's now-common "good league mechanics become
    permanent content" pattern from PoE1.
  - **Trial of Chaos reworked** — rewards changed to Currency + Soul Cores only; corrupted items
    removed as a possible outcome (a supply-side change affecting corrupted-item scarcity/value).
  - Ritual encounters added **throughout the campaign** (not just endgame), front-loading
    currency drops for leveling characters — likely to soften early-league currency scarcity
    versus prior league starts.
  - Ritual/Expedition balance changes expected to reshape endgame currency-farming efficiency
    (specifics beyond this doc's scope; see patch notes sources below for detail if needed).
- **Announced but not yet live**: full **1.0 launch, 2026-12-11**, going free-to-play, adding the
  Duelist class and remaining campaign Acts, with more detail promised at ExileCon
  (2026-11-07). This will almost certainly trigger another full economy reset and likely a
  reset of league cadence/structure going forward — re-verify this document's League section
  after that date.

---

## Sources

- [Path Of Exile 2: Currency Exchange, Explained — TheGamer](https://www.thegamer.com/path-of-exile-2-currency-exchange-guide-unlock/)
- [Trade in Path of Exile 2 — Maxroll](https://maxroll.gg/poe2/resources/trade-in-path-of-exile-2)
- [Path Of Exile 2: How To Unlock And Use The Currency Exchange — GameSpot](https://www.gamespot.com/articles/path-of-exile-2-how-to-unlock-and-use-the-currency-exchange/1100-6528794/)
- [Path of Exile 2: How to use the Currency Exchange — Sportskeeda](https://www.sportskeeda.com/mmo/path-exile-2-poe2-currency-exchange-guide)
- [Path of Exile 2: How To Unlock & Use Currency Exchange — GameRant](https://gamerant.com/path-of-exile-2-currency-exchange-guide-unlock-walkthrough-poe2/)
- [Path of Exile 2: Currency Exchange Explained — pathofexile.gg](https://pathofexile2.gg/path-of-exile-2-currency-exchange-explained/)
- [POE2 Currency Guide — Exiled Tools](https://www.exiledtools.com/guides/poe2-currency)
- [PoE 2 Trade & Currency Exchange Guide — ConquestCapped](https://conquestcapped.com/guides/path-of-exile-2/poe-2-currency-trading/)
- [Currency Exchange & Value — Ludo.guide](https://www.ludo.guide/guide/path-of-exile-2/tips-secrets/trading-the-economy/currency-exchange-value)
- [Path of Exile 2 previews September 4's Forbidden Rites league and 1.0's new Duelist class — Massively OP](https://massivelyop.com/2026/08/28/path-of-exile-2-previews-september-4s-forbidden-rites-league-and-1-0s-new-duelist-class/)
- [Path of Exile 2's first event league goes 'oops, all bosses' — PC Gamer](https://www.pcgamer.com/games/rpg/path-of-exile-2s-first-event-league-goes-oops-all-bosses-and-reworks-its-worst-mode-so-sane-people-can-finally-enjoy-it/)
- [Path of Exile 2 answers questions about its upcoming Forbidden Rites league — Massively OP](https://massivelyop.com/2026/09/01/path-of-exile-2-answers-questions-about-its-upcoming-forbidden-rites-league/)
- [Path of Exile 2's Forbidden Rites League Launches September 4th — Out of Games](https://outof.games/news/9741-path-of-exile-2s-forbidden-rites-league-launches-september-4th-with-tons-of-changes/)
- [All Path of Exile 2 Leagues: Complete List & Dates (2026) — GGSeason](https://ggseason.com/blog/path-of-exile-2-all-leagues-dates/)
- [Path of Exile 2 Updates — aRPG Timeline](https://www.arpg-timeline.com/game/path-of-exile2)
- [Path of Exile 2 Forbidden Rites: League Start Time and Full Breakdown — eGamersWorld](https://egamersworld.com/blog/path-of-exile-2-forbidden-rites-league-start-time--FIhcm05hg)
- [Path of Exile Current League (August 2026) — SlashSkill](https://www.slashskill.com/path-of-exile-current-league/)
- [GitHub — poe2scout/poe2scout](https://github.com/poe2scout/poe2scout)
- [GitHub — vanzan01/poe2scout-mcp](https://github.com/vanzan01/poe2scout-mcp)
- [POE2 Scout — thegamercodex.com](https://thegamercodex.com/en/path-of-exile-2/tools/poe2-scout)
- [POE2 Scout (site)](https://poe2scout.com/)
- [Price History and League APIs — DeepWiki (poe2scout/poe2scout)](https://deepwiki.com/poe2scout/poe2scout/4.2-price-history-and-league-apis)
- [poe2scout/poe2scout overview — DeepWiki](https://deepwiki.com/poe2scout/poe2scout)
- [PoE2 Price Check — Currency Converter & Ratios — Timesaver](https://timesaver.gg/tools/poe-2/currency-price-check)
- [PoE2 Divine Orb vs Exalted Orb — Timesaver](https://timesaver.gg/blog/poe2-divine-vs-exalted-orb-guide)
- [PoE2 Currency Farming Guide — Timesaver](https://timesaver.gg/blog/poe-2-currency-farming-guide)
- [PoE2 Greater & Perfect Currency — Timesaver](https://timesaver.gg/blog/poe2-greater-perfect-currency-guide)
- [Path of Exile 2 Orbs Guide — ChaosBoost](https://www.chaosboost.com/guides/path-of-exile-2-orbs-guide)
- [PoE2 Currency Guide 2026: Every Orb Ranked — Switchblade Gaming](https://www.switchbladegaming.com/path-of-exile-2/currency-guide/)
- [Runes of Aldur League Guide — Fextralife PoE2 Wiki](https://pathofexile2.wiki.fextralife.com/Runes+of+Aldur)
- [Aldur's Legacy Rune Guide — Fextralife PoE2 Wiki](https://pathofexile2.wiki.fextralife.com/Aldur's+Legacy)
- [Runes of Aldur League Guide — PoE Vault](https://www.poe-vault.com/poe2/guides/runes-of-aldur-league-guide)
- [Path of Exile 2's Runes of Aldur League Reworked Expeditions — GameRant](https://gamerant.com/path-of-exile-2-poe2-runes-of-aldur-league-mechanic-explained/)
- [Path of Exile 2 Runes of Aldur League — Overgear](https://overgear.com/guides/poe-2/runes-of-aldur-league/)
- [PoE 2 0.5 Runes of Aldur Challenges, Rewards & Complete Guide — AOEAH](https://www.aoeah.com/news/4591--poe-2-05-runes-of-aldur-challenges-rewards--complete-guide)
- [PoE 2 Runes of Aldur Guide — Runeforging — ConquestCapped](https://conquestcapped.com/guides/path-of-exile-2/poe-2-runeforging/)
- [0.5.5 Forbidden Rites Patch Notes — Maxroll](https://maxroll.gg/poe2/news/0-5-5-forbidden-rites-patch-notes)
- [Path of Exile 2 0.5.5 Patch Notes: Trial of Chaos Rework and Forbidden Rites Event — All Things How](https://allthings.how/path-of-exile-2-0-5-5-patch-notes-trial-of-chaos-rework-and-forbidden-rites-event/)
- [Path of Exile 2 0.5.5 patch notes — Sportskeeda](https://www.sportskeeda.com/mmo/path-exile-2-0-5-5-patch-notes-forbidden-rites-event-runes-aldur-goes-core-ritual-changes-trial-chaos-rework)
- [Path of Exile 2: 0.5.5 Patch Notes - Forbidden Rites Event League — pathofexile.gg](https://pathofexile2.gg/0-5-5-patch-notes/)
- [Path of Exile 2 0.5.5 Patch Notes Breakdown — IGGM](https://www.iggm.com/news/poe-2-0-5-5-patch-notes-how-ritual-expedition-reshape-forbidden-rites-farming)
- [Path Of Exile 2 0.5.5 Patch Notes Are Out: Forbidden Rites Starts September 4 — GameFragger](https://gamefragger.com/multiplatform/action-rpg/path-of-exile-2-055-patch-notes-are-out-forbidden-rites-starts-september-4-a29728)
- [0.5.5 Forbidden Rites Event Launch Date and Endgame Changes — Maxroll](https://maxroll.gg/poe2/news/0-5-5-forbidden-rites-event-launch-date-and-endgame-changes)
- [PoE2 Forbidden Rites (Patch 0.5.5): Release Date and Everything New — Expert Game Reviews](https://expertgamereviews.com/poe2-forbidden-rites-0-5-5-event/)
- [Path of Exile 2 Patch 0.5.5 Preview | Economy Reset, Forbidden Rites and Endgame Changes — POECurrency](https://www.poecurrency.com/news/poe-2-patch-0-5-5-preview-economy-reset-forbidden-rites-endgame-changes)
- [Path of Exile 2 Patch 0.5.5: Confirmed Changes, Rumors and What's Not Coming Before Patch 1.0 — EZG](https://www.ezg.com/blog/poe-2-patch-0-5-5-confirmed-changes-rumors-and-not-coming-before-patch-1-0)
- [Return of the Ancients Expansion Guide — Fextralife PoE2 Wiki](https://pathofexile2.wiki.fextralife.com/Return+of+the+Ancients)
- [Path of Exile 2 0.5.0 Patch Notes – Return of the Ancients Changes — KeenGamer](https://www.keengamer.com/articles/guides/path-of-exile-2-0-5-0-patch-notes-return-of-the-ancients-changes/)
- [0.5.0 Patch Notes – Return of the Ancients — Maxroll](https://maxroll.gg/poe2/news/0-5-0-patch-notes-return-of-the-ancients)
- [Path of Exile 2 Patch 0.5.0 Return of the Ancients Announcement — POECurrency](https://www.poecurrency.com/news/poe-2-patch-0-5-0-return-of-the-ancients-announcement-may-21st-changes-content)
- [Path of Exile 2 gets free-to-play 1.0 launch in December 2026, adds new Duelist class — GosuGamers](https://www.gosugamers.net/entertainment/news/79049-path-of-exile-2-gets-free-to-play-1-0-launch-in-december-2026-adds-new-duelist-class)
- [Path of Exile 2 1.0 To Launch December 11th — Maxroll](https://maxroll.gg/poe2/news/path-of-exile-2-1-0-to-launch-december-11th)
- [Path of Exile 2 1.0 Release Date Confirmed: Gamescom 2026 Trailer — IGGM](https://www.iggm.com/news/poe-2-1-0-release-date-gamescom-2026-trailer-reveals-duelist-class-registration-rewards)
- [Path of Exile 2 1.0 Release Date Confirmed — EZG](https://www.ezg.com/blog/poe-2-patch-0-5-5-confirmed-changes-rumors-and-not-coming-before-patch-1-0)
- [Path of Exile 2 Version 1.0 Release Date and Duelist Class — Pixel Twelve](https://pixeltwelve.com/articles/path-of-exile-2-version-1-0-release-date)
- [Path of Exile 2: 1.0 Full Release Date, Duelist Class — MMOexp](https://www.mmoexp.com/News/path-of-exile-2-1-0-full-release-date-duelist-class-free-to-play-everything-you-need-to-know.html)
- [PoE2 Mirror of Kalandra Price Guide — Timesaver](https://timesaver.gg/blog/poe2-mirror-of-kalandra-price-guide)
- [PoE2 Mirror of Kalandra: How to Get It & Its Value — Timesaver](https://timesaver.gg/blog/poe2-mirror-of-kalandra-guide)
- [PoE2 Most Expensive Items (0.5) — Timesaver](https://timesaver.gg/blog/poe2-most-expensive-items-guide)
- [PoE2 Exalted Orb Price Guide — Timesaver](https://timesaver.gg/blog/poe2-exalted-orb-price-guide)
- [PoE2 Divine Orb Price Guide — Timesaver](https://timesaver.gg/blog/poe2-divine-orb-price-guide)
- [Currency Price History & Market Trends — PoE Overlay](https://www.poeoverlay.com/market-history/poe2/standard/divine/currency)
- [Path of Exile 2 Mirror of Kalandra Guide — MuleFactory](https://www.mulefactory.com/wiki_path_of_exile_ii_path_of_exile_2_mirror_of_kalandra_guide/)
- [Path Of Exile 2: Most Expensive Items, Ranked — GameRant](https://gamerant.com/path-exile-2-most-expensive-items-poe2/)
- [Most Expensive Unique Items in Path of Exile 2 — Suncoast Scribe](https://suncoastscribe.org/path-of-exile-2/most-expensive-unique-items-in-path-of-exile-2/)
- [The Best and Most Expensive Unique Items in Path of Exile 2 — Odealo](https://odealo.com/articles/best-path-of-exile-2-unique-items)
- [PoE 2 Most Expensive and Top Chase Unique Items — MMOPixel](https://www.mmopixel.com/news/poe-2-most-expensive-and-top-chase-unique-items)
- [PoE 2 Best Unique Items — Overgear](https://overgear.com/guides/poe-2/best-unique-items/)
- [PoE 2 Leagues & Game Modes Explained — Mobalytics](https://mobalytics.gg/poe-2/guides/leagues)
- [Should you Play SSF? — Mobalytics](https://mobalytics.gg/poe-2/guides/should-you-play-ssf)
- [What is Solo Self-Found (SSF)? — Game8](https://game8.co/games/Path-of-Exile-2/archives/512986)
- [Solo Self-Found — PoE Fandom Wiki](https://pathofexile.fandom.com/wiki/Solo_Self-Found)
- [Choose Solo Self-Found For A Solo Experience — Screen Plays Mag](https://screenplaysmag.com/blog/choose-solo-self-found-for-a-solo-experience-in-path-of-exile-2/)
- [Stash Tabs — Fextralife PoE2 Wiki](https://pathofexile2.wiki.fextralife.com/Stash+Tabs)
- [Stash Tab Guide — Maxroll](https://maxroll.gg/poe2/resources/stash-tab-guide)
- [Currency Stash Tab Details and Price — Game8](https://game8.co/games/Path-of-Exile-2/archives/493582)
- [Path of Exile 2 Stash Tabs Explained — VULKK](https://vulkk.com/2025/02/20/path-of-exile-2-stash-tabs-explained/)
- [Map Stash Tab Details and Price — Game8](https://game8.co/games/Path-of-Exile-2/archives/500002)
- [PoE 2 Stash Tabs Explained — Mobalytics](https://mobalytics.gg/poe-2/guides/stash-tabs)
- [Stash Tab Sale Schedule and Prices — Game8](https://game8.co/games/Path-of-Exile-2/archives/490434)
- [Path of Exile 2 shop — stash tabs (official)](https://pathofexile2.com/shop/stash-tabs)
- [Currency Items — Fextralife PoE2 Wiki](https://pathofexile2.wiki.fextralife.com/Currency+Items)
- [Every Currency Item And What It Does In Path Of Exile 2 — TheGamer](https://www.thegamer.com/path-of-exile-2-poe2-every-currency-item-guide/)
- [Path of Exile 2: Complete Currency List — GameRant](https://gamerant.com/path-of-exile-2-every-currency-list-all-poe-2-currencies/)
- [PoE 2 Currency Guide: Every Orb, Rarity and Trade Value — PlayPlex](https://playplex.com/blog/poe-2-currency-guide/)
- [Path Of Exile 2 Currency Guide — Epiccarry](https://epiccarry.com/blogs/poe-2-currencies-guide/)
- [Currency System in Path of Exile 2 — Odealo](https://odealo.com/articles/currency-system-in-path-of-exile-2)
- [PoE2 Divine Orb Price & Exalted Exchange Rate (Forbidden Rites 0.5.5) — Timesaver](https://timesaver.gg/blog/poe2-divine-exalted-exchange-rate-forbidden-rites-0-5-5)
- [PoE2 Chaos Orb Price Guide — Timesaver](https://timesaver.gg/blog/poe2-chaos-orb-price-guide)
- Project Vaal repo context: `src/lib/prices/poe2scout.ts` (internal, not a web source — documents the confirmed-working live API shape as of 2026-06-13)
