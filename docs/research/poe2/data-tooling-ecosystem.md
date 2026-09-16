# Path of Exile 2 — Data-Tooling Ecosystem Research

Research notes on the external tools/services Project Vaal's own data pipeline depends on:
`@poe2-toolkit` (passive tree + wiki extraction), GGG's patch server/CDN, and poe2scout.com
(price data). Compiled by web research (GitHub repos, READMEs, npm/jsDelivr metadata) plus
this repo's own vendored provenance files. Treat exact version numbers, star counts, and
commit dates as point-in-time snapshots.

## Last updated

**2026-09-16.**

---

## 0. TL;DR for another Claude instance

- **Two separate data-acquisition paths exist in this repo, not one:**
  1. **Passive tree** (`public/data/tree/<ver>/`): vendored *directly* from GGG's own official
     GitHub repo **`grindinggear/poe2-skilltree-export`** (pre-computed `data.json` + sprite
     atlases, released as GitHub Releases per patch, tag pattern `skilltree-<version>`). This is
     GGG's one explicit, sanctioned "data export" carve-out — see §2.4. `@poe2-toolkit/tree-core`
     only **normalizes** that GGG JSON into engine geometry (`normalizeGggTree`); `tree-react`
     only **renders** it. `@poe2-toolkit/tree-extractor` (the sub-package that pulls tree data
     from the live CDN instead) is **not** a dependency of this repo at all.
  2. **Wiki** (`public/data/wiki/<date>/` — items/gems/mods/skills): pulled by
     `scripts/sync-wiki.ts` using `@poe2-toolkit/ggpk`'s `createCdnSource` to fetch and decode
     bundles **live from GGG's patch CDN** (`patch-poe2.poecdn.com`), then run through
     `@poe2-toolkit/item-extractor`, `gem-extractor`, `mod-extractor`. This is the classic
     "parse the game's own shipped data files" approach — GGG does not sanction or export this
     data itself; it is a community reverse-engineering pipeline (see §1.2).
- `@poe2-toolkit` (github.com/rajtik76/poe2-toolkit) is an actively maintained (commits through
  Sept 2026), MIT-licensed, code-only npm-workspaces monorepo of 8 packages. It builds its GGPK
  access on **`pathofexile-dat`** (SnosMe, MIT) — the actively-maintained successor to the
  now-discontinued **PyPoE** for parsing GGG's bundle format. No data or art is ever committed
  to the toolkit's own repo; every consumer extracts fresh from the live patch server at build
  time, which means the pipeline is only as stable as GGG's current patch and can break on any
  content update, without warning, until re-run.
- Project Vaal pins **older-than-current** toolkit versions: `tree-core@0.4.1` and
  `tree-react@0.7.2` (pre-1.0, everything else `@poe2-toolkit/*` at `1.0.0`), while upstream cut
  a **1.0.0 stable line for every package on 2026-07-30**, then shipped `ggpk@1.1.0` and a
  **breaking** `gem-extractor@2.0.0` on 2026-09-05. Project Vaal has not picked up either the
  1.0.0 tree-core/tree-react line or the Sept 5 ggpk/gem-extractor bump — worth checking before
  any dependency bump, since gem-extractor 2.0.0 is explicitly breaking (hover-art sprite-name
  handling changed).
- `poe2scout.com` (github.com/poe2scout/poe2scout, MIT, C#/.NET + Python monorepo) is
  community-run by an org with no public member list; its price-fetch workers authenticate
  with `POEAPI_CLIENT_ID`/`POEAPI_CLIENT_SECRET`, i.e. it is itself built on **GGG's official
  OAuth API**, not scraping. Public API + Swagger docs at `api.poe2scout.com/swagger`. (Full
  currency/economy detail already lives in `docs/research/poe2/currency-and-economy.md` §6 —
  this doc adds the tooling/API depth, not the economic content.)
- GGG's own official Path of Exile API (`api.pathofexile.com`, docs at
  `pathofexile.com/developer/docs`) has **uneven PoE2 coverage** as of Sept 2026: `poe2` was
  added as a realm to the **League** and **Character** endpoints and, as of **2026-07-21**, to
  **Ladder** (capped at top 1000 entries vs. PoE1's top 15000) — but **not** to the **Stash**
  endpoint (OAuth stash only supports `xbox`/`sony` realms; the older legacy character-window
  route accepts `realm=poe2` in the URL but silently returns PoE1 data). No official PoE2
  Public Stash Tab API exists as of this writing.
- `poe2db.tw` (already used by this repo for hand-verified `communitySource` overrides, see
  `THIRD-PARTY-NOTICES.md`) and `poe2wiki.net` are both **unofficial, community-run** sites —
  neither is a GGG-run wiki, despite some low-quality web sources conflating them with the
  official game. Exact hosting/CMS details for `poe2wiki.net` could not be independently
  confirmed this session (egress-blocked); see Open Questions.

---

## 1. `@poe2-toolkit` (github.com/rajtik76/poe2-toolkit)

### 1.1 What it is

A framework-agnostic, **code-only** npm-workspaces monorepo by Vladislav Rajtmajer
(`rajtik76`) providing shared GGPK/patch-server access, five data extractors, and a headless
geometry engine + React renderer for PoE2's passive tree. Explicitly positioned as filling a
gap between full "planner" apps that bundle stale data snapshots, and `pathofexile-dat` (see
§2.2), which extracts but doesn't render.

Tagline from its own README: *"The only framework-agnostic, code-only Path of Exile 2 passive
tree renderer on npm."* Live demo: poe.rajtik.com/tree. Powers a separate first-party app,
**exile2exile** (github.com/rajtik76/exile2exile) — a free, open-source PoE2 build
planner/loot-filter generator built entirely on these packages.

### 1.2 Package structure

| Package | Role | Touches network? | Status (upstream, Sept 2026) | Version pinned by Project Vaal |
|---|---|---|---|---|
| `@poe2-toolkit/ggpk` | Shared GGPK/patch-server access layer: fetches + decodes bundles, GGPK image formats (BC1/BC2/BC3/BC7 DDS), and stat-description (`.csd`) rendering. **The only package that makes network requests.** | Yes | `1.1.0` (2026-09-05: sprite-icon/hover-art decoding, fixed a concurrent-sprite race) | `1.0.0` |
| `@poe2-toolkit/tree-extractor` | Builds passive-tree `data.json` + sprite atlases straight from a live GGPK source. | Via `ggpk` | Ready | **not used** by Project Vaal — tree data comes from GGG's own `poe2-skilltree-export` repo instead (§0, §2.4) |
| `@poe2-toolkit/tree-core` | Headless, zero-dependency geometry engine: `TreeData` in, positioned `Scene` out (`normalizeGggTree`, `buildScene`). | No | `1.0.0` (2026-07-30, API-stability milestone) | `0.4.1` — patched, see §5 |
| `@poe2-toolkit/tree-react` | React/PixiJS renderer: draws the `Scene`, owns pan/zoom/click/hover. | No | `1.0.0` (2026-07-30) | `0.7.2` — patched, see §5 |
| `@poe2-toolkit/item-extractor` | Builds item data + icons from a GGPK source (base stats, armour/evasion/ES/ward/block, spirit levels — several of these added mid-July 2026). | Via `ggpk` | `1.0.0` | `1.0.0` |
| `@poe2-toolkit/gem-extractor` | Builds gem/skill data + icons, incl. tooltip scaling and hover art. | Via `ggpk` | **`2.0.0`** (2026-09-05, **breaking**: DDS-path + UIImage sprite-name handling for hover art changed) | `1.0.0` — not yet on the breaking 2.0 line |
| `@poe2-toolkit/rune-extractor` | Builds rune/soul-core data + icons. | Via `ggpk` | Ready | **not used** — this repo's wiki sync joins `SoulCores`/`SoulCoreStats` tables by hand instead (see `scripts/sync-wiki.ts`, `joinSoulCoresByName`) |
| `@poe2-toolkit/mod-extractor` | Item-mod data only: affix ranges, tiers, spawn tags (no icons). | Via `ggpk` | `1.0.0` | `1.0.0` |

All packages are ESM-only, require Node 18+, ship their own TypeScript types, and are released
independently under semver with per-package `CHANGELOG.md`s. The "how it fits together" data
flow per the README:

```
@poe2-toolkit/ggpk (fetch + decode)
   -> tree-extractor / item-extractor / gem-extractor / rune-extractor / mod-extractor (typed data out)
        -> tree-core -> tree-react (geometry -> pixels)
```

### 1.3 How it actually extracts data (the critical part)

This is **not** scraping a wiki or a third-party mirror. `@poe2-toolkit/ggpk`'s
`createCdnSource()` talks directly to GGG's live patch CDN:

```ts
const source = await createCdnSource({
  patch: '4.5.4.10',        // GGG's internal client build number, NOT the public "0.5.x" patch name
  tablesDir: './tables/English',  // pathofexile-dat's decoded <Name>.json output
  cacheDir: './.cache',
});
```

Key technical facts, confirmed against the package README and this repo's own
`scripts/sync-wiki.ts` (which imports `createCdnSource`, `buildStatIndex`, `renderBlock` from
`@poe2-toolkit/ggpk` directly):

- **Default CDN host**: `https://patch-poe2.poecdn.com` (overridable via a `cdnHost` param) —
  this is GGG's real, public patch-content CDN, the same family of host PoE1's client and
  community tools have used for years to pull the game's asset bundles.
- **Patch version is an opaque, ever-changing string** (e.g. `4.5.4.10`) distinct from the
  public marketing patch number (`0.5.2`, `0.5.5`, etc. — see `public/data/tree/0.5.2/SOURCE.md`
  in this repo for that distinction in practice). **The CDN serves only the currently-live
  patch — requesting a stale version 404s.** There is no version pinning on GGG's side; a sync
  script must always resolve "whatever is live right now."
- **`tablesDir` is NOT produced by `@poe2-toolkit` itself.** It requires a separate, one-time,
  external step: running `pathofexile-dat`'s own CLI (see §2.2) to decode GGG's `.datc64` table
  schema into `<TableName>.json` files. `@poe2-toolkit/ggpk` then reads those JSON tables
  (`source.table(...)`) plus raw bundle files (`source.file(...)`) for things tables don't
  cover, like `data/statdescriptions/stat_descriptions.csd` (UTF-16-encoded despite the
  extension — confirmed directly in this repo's `loadStatIndex`).
- **Stat-text rendering re-implements GGG's own client logic**: `renderBlock`/`buildStatIndex`
  turn raw `(stat_id, value)` pairs into the human-readable lines every item/gem/mod tooltip
  shows, by reading the same `stat_descriptions.csd` file GGG's own client (and
  `mod-extractor`/`gem-extractor` internally) read — this repo's own comment confirms it
  verified that by reading the extractors' published `dist/buildMods.js` /
  `dist/buildGems.js` source directly.
- **Caching**: `createCdnSource`'s `cacheDir` persists downloaded bundles on disk under a
  `<patch>/` subdirectory; concurrent requests for the same uncached bundle are coalesced into
  one fetch; writes are atomic (temp file + rename).
- **No mention of Oodle/`oo2core`/`ooz` decompression** in `@poe2-toolkit`'s own docs — that
  layer is handled inside its `pathofexile-dat` dependency (see §2.2), not reimplemented here.
- Because everything is pulled live and nothing is bundled ("code only... not even test
  fixtures" — the toolkit's own README states this as a hard rule, enforced via
  `CONTRIBUTING.md`), **any GGG content patch is a potential breaking change** for a consumer
  like Project Vaal's `sync-wiki.ts`: new/renamed tables, changed column layouts, or GGPK
  format tweaks all flow straight through with no compatibility shim from the toolkit itself.
  `sync-wiki.ts`'s own `validateSyncResult` (refusing to publish on >10% entry-count drop) is
  Project Vaal's own defense against exactly this failure mode, not something GGPK/extractor
  guarantees.

### 1.4 Maintenance activity

Actively developed as of Sept 2026 — this is a live, single-maintainer-plus-community project,
not an abandoned toolkit:

| Date (2026) | Activity |
|---|---|
| Jul 14 | Gem-extractor tooltip scaling + hover-art; item-extractor armour/evasion/ES/ward/block base stats |
| Jul 17–20 | Parallel DDS/bundle fetching perf work; tree-react rendering bug fixes; CI improvements; item-extractor base weapon/armor stats, spirit levels |
| Jul 30 | **All packages cut a 1.0.0 stable release** — API-stability milestone, no breaking changes from prior versions |
| Aug 15 | `CONTRIBUTING.md`/`SECURITY.md` added; fixture-cost docs; live-patch-resolution fixes |
| Sep 5 | `ggpk@1.1.0` (hover-art/sprite decoding, race-condition fix) + **`gem-extractor@2.0.0`** (breaking) |

Repo stats (as fetched): MIT license, ~95 commits on `main`, low but real community traction
(reported ~6 stars/2 forks/1 watcher at repo level — small project, single primary author).
CI badge present (GitHub Actions), tests split into unit (no game data needed) vs.
integration/"1:1 verification" tests that require a locally-generated GGPK extract + golden
fixtures (gitignored, never committed, never run in CI) — i.e. the project's own test suite
depends on the same live-CDN extraction it ships, and can't verify correctness without network
access to GGG's servers at test time either.

Also runs a **public patch-change webhook** as a value-add for consumers: subscribe a URL at
`poe.rajtik.com/patch-webhook`, and it polls `patch.pathofexile2.com` every 5 minutes, POSTing
an HMAC-SHA256-signed `patch.released` event (with `version` + `released_at`) the moment a new
PoE2 client version appears — a way to trigger a re-sync automatically instead of polling
yourself. Project Vaal does not currently appear to consume this webhook (not found in repo
search); worth considering for `sync-wiki.ts` automation.

### 1.5 License

MIT (toolkit itself, and its `pathofexile-dat` dependency). Standard GGG-IP disclaimer in
`NOTICE.md`/README: unofficial, fan-made, not affiliated with/endorsed by GGG; "Path of Exile"
and "Path of Exile 2" are GGG trademarks; the toolkit ships no game content, only code that
decodes it at runtime.

---

## 2. GGG's patch server / CDN and the historical community-tooling lineage

### 2.1 Patch server / CDN structure

- **PoE2's patch CDN**: `patch-poe2.poecdn.com` (per `@poe2-toolkit/ggpk`'s default `cdnHost`).
  This follows the same `*.poecdn.com` family GGG has used for PoE1 assets for years
  (`patch.pathofexile2.com` is the separate host `@poe2-toolkit`'s webhook polls for *version*
  detection — likely the lightweight version-check endpoint vs. the bulk-content CDN).
- **Format**: GGG's game data ships as `Content.ggpk` (a container) holding **bundled**
  (`Bundles2`-format, since PoE1 moved off flat GGPK-only storage years ago), compressed asset
  and table data. Community tooling has to (a) locate/download the relevant bundle(s) from the
  CDN, (b) **Oodle-decompress** them (GGG uses RAD Game Tools' Oodle compression —
  historically requiring an extracted `oo2core`/`ooz` binary, since Oodle itself isn't
  open-source), then (c) parse the resulting `.dat`/`.dat64` binary table format using a
  **schema** (column names/types aren't self-describing — they're maintained externally by the
  community, e.g. the `poe-tool-dev` schema project PyPoE-successor tools consume).
- This three-step pattern (locate bundle → Oodle-decompress → apply external schema to `.dat`)
  is exactly what both the old PyPoE (PoE1) and the current `pathofexile-dat`/`@poe2-toolkit`
  stack (PoE1+PoE2) do — the *method* hasn't fundamentally changed since GGG introduced the
  bundle format; only the specific tools implementing it have.

### 2.2 Community extraction tooling — history and current state

| Tool | Scope | Status (Sept 2026) | Notes |
|---|---|---|---|
| **PyPoE** (`OmegaK2/PyPoE`) | PoE1 only | **Discontinued.** README states "Development is currently discontinued" outright. | The original, most widely-cited GGPK/bundle parser; Python. Required an external `ooz.exe`/`libooz.dll` for Oodle decompression. No PoE2 support ever added. |
| **RePoE** (`brather1ng/RePoE`, forks) | PoE1 | Depends on a PyPoE fork to run at all | Downstream consumer, not an independent extractor — inherits PyPoE's PoE1-only, discontinued status. |
| **`pathofexile-dat`** / **poe-dat-viewer** (`SnosMe/poe-dat-viewer`) | **PoE1 + PoE2** | Actively used (is `@poe2-toolkit`'s own GGPK dependency) | The de-facto PyPoE successor for the modern bundle era. MIT. Has both a browser-based `.dat` viewer/schema-explorer UI and a reusable `pathofexile-dat` library/CLI that decodes `.datc64` tables into JSON given a schema (community-maintained, from the `poe-tool-dev` schema repo per search results) — this is exactly the tool `@poe2-toolkit/ggpk`'s README tells consumers to run first to produce `tablesDir`. |
| **LibGGPK3 / LibBundle3** (`aianlinb/LibGGPK3`, NuGet `LibGGPK3.LibBundle3`) | PoE1 + PoE2 | Actively versioned (2.x on NuGet) | C# library for `Content.ggpk` + bundle access; rewrite of an earlier `LibGGPK2`/`LibBundle`. Used by GGPK-browsing GUI tools in the C#/.NET ecosystem, separate lineage from the JS/TS `@poe2-toolkit` stack. |
| **poe-bundle-lib** (npm) | PoE1 + PoE2 (bundle-level) | Present on npm | A TypeScript port/rewrite of LibGGPK3/LibBundle3's bundle-handling, including Oodle decompression bindings — a lower-level building block than `@poe2-toolkit/ggpk`, not confirmed whether `@poe2-toolkit` depends on it directly or reimplements equivalent logic via `pathofexile-dat`. |
| **`pogo`** (`oriath-net/pogo`) | PoE1 (+ some PoE2 awareness per repo topics) | Present, Go-based | Lists/extracts GGPK + bundle contents; lower-level inspection tool rather than a typed-data extractor. |

**Bottom line for "does a PyPoE-for-PoE2 exist?"**: not as a direct-named successor, but
functionally yes — `pathofexile-dat` (SnosMe) fills that role for both games and is what
`@poe2-toolkit` (and by extension Project Vaal's wiki sync) is actually built on. PyPoE itself
never gained PoE2 support and is explicitly dead upstream.

### 2.3 What GGG does *not* officially provide

Per GGG's own developer docs (`pathofexile.com/developer/docs` — could not be fetched directly
this session, egress-blocked; per web-search synthesis): **"Grinding Gear Games does not
officially provide access to in-game data outside of their supported APIs, with the exception
of the Passive trees."** Everything in §2.1/§2.2 — item bases, mod tables, gem data, stat
translations — is community-reverse-engineered from client/patch bundles GGG ships to render
the game, not from any GGG-sanctioned data-export feed. This is the load-bearing fact behind
Project Vaal's wiki-sync risk: it's parsing incidental game-client artifacts, not a stable API
contract, so GGG owes it no compatibility guarantee across patches.

### 2.4 The one official exception: skill-tree exports

GGG maintains its own public GitHub repos that **do** constitute an official, sanctioned data
export:

- `github.com/grindinggear/skilltree-export` — PoE1 Passive Skill Tree.
- `github.com/grindinggear/atlastree-export` — PoE1 Atlas Passive Tree.
- `github.com/grindinggear/poe2-skilltree-export` — **PoE2 Passive Skill Tree** — the one
  Project Vaal actually vendors from (`public/data/tree/0.5.2/SOURCE.md` in this repo records
  release tag `skilltree-0.5.2`, pulled 2026-07-06). Ships a pre-computed `data.json` (node
  positions, adjacency, class starts, stat strings) plus sprite atlases as GitHub Release
  assets, tagged per patch.

This is the exception referenced in this repo's own `AGENTS.md` ("GGG-sanctioned tree-export
sprites, `public/data/tree/`") and confirms it's accurate: this is a genuinely GGG-authored,
versioned, public export — not a reverse-engineered extraction — which is *why* it's treated
differently (self-hostable, licensable as real GGG-sanctioned content) from the wiki's
patch-CDN-scraped data. `@poe2-toolkit/tree-extractor` exists as an *alternative* way to derive
equivalent tree data straight from the CDN (useful if GGG stopped publishing the official
export, or for versions the export skips) — but since the official export exists and is more
authoritative, Project Vaal uses that path instead and only consumes `tree-core`/`tree-react`
for normalization/rendering.

---

## 3. poe2scout.com — tooling/API depth (builds on `currency-and-economy.md` §6)

The sibling doc (`docs/research/poe2/currency-and-economy.md`) already covers poe2scout's
architecture, confirmed endpoint shapes, rate limits, and update-frequency model in detail —
not reproduced here. Additional tooling-focused findings from this session:

- **GitHub org** `github.com/poe2scout` has **no publicly listed members** — maintainership is
  opaque from the outside; only the org-level repo description ("The main repository for the
  website and service poe2scout.com") is public.
- **Main repo** (`poe2scout/poe2scout`): public, MIT-licensed, primary language **C#**, ~65
  stars / 9 forks as observed, **last updated 2026-09-12** (four days before this research,
  i.e. actively maintained, not stale).
- **Local dev stack** (from the repo's own README): Docker + Docker Compose (core infra via
  `infra/core.yml`), **.NET SDK 10**, **Python 3.14.3** (for the sync/worker services), Node.js
  (for the React frontends). Confirms the polyglot split already noted in the sibling doc:
  .NET API + Python workers, not a single-language stack.
- **Confirms** (independently, via direct repo fetch rather than the sibling doc's earlier
  pass) that the **price-fetch/item-sync/currency-exchange workers read `POEAPI_CLIENT_ID` /
  `POEAPI_CLIENT_SECRET`** from deployment secrets — i.e. poe2scout's underlying price data
  ultimately traces back to **GGG's own official OAuth API** (almost certainly the trade/stash
  or a similar authenticated resource, scoped for their own service account), not an unofficial
  scrape of the trade website. This matters for Project Vaal: poe2scout is one hop closer to
  "official" than a raw scraper would be, which is relevantly more trustworthy as a price
  source, but also means poe2scout itself is exposed to the same GGG-API-shape-change risk
  category as Project Vaal's own wiki sync.
- **Public API docs**: Swagger/OpenAPI UI live and reachable at `api.poe2scout.com/swagger` —
  this is the authoritative, current source for exact endpoint/param shapes; the sibling doc's
  confirmed-working endpoint list should be cross-checked there before any future integration
  work, since poe2scout's own repo was updated within the last week of this research.

---

## 4. Other PoE2 community data tools/sites

| Site | Run by | Nature | Notes |
|---|---|---|---|
| **poe2db.tw** | Unofficial, community-run (Taiwan-based project; same operator lineage as the older PoE1 `poedb.tw`) | Item/skill/gem database + build-planner-adjacent site | Already used by Project Vaal for a small number of hand-verified `communitySource` text overrides (see `THIRD-PARTY-NOTICES.md`, `scripts/wiki/poedb-overrides.json`) under CC BY-NC-SA 3.0. This session could not independently confirm poe2db.tw's own extraction method (likely the same GGPK/bundle-parsing lineage as everything else in §2, given its PoE1 predecessor's long history of doing exactly that) — not verified this session, flagged below. |
| **poe2wiki.net** | Community-run wiki; **not** a GGG-authored site despite some low-quality search results implying otherwise | Fan wiki, MediaWiki-family software (typical of this wiki lineage — PoE1's `poewiki.net` runs MediaWiki and has historically been described as wiki.gg-hosted/adjacent after migrating off Fandom/Gamepedia) | Direct verification blocked this session (`poewiki.net`, `poe2wiki.net`, and `wiki.gg` were all egress-blocked for WebFetch). Treat "run by GGG" claims surfaced in generic web search as **unreliable** — GGG does not author wiki content; at most it may link to/endorse the community wiki, the way it has historically related to `poewiki.net` for PoE1. Re-verify directly before citing this as fact elsewhere. |
| **PathOfBuilding-PoE2** (already in `THIRD-PARTY-NOTICES.md`) | `PathOfBuildingCommunity` org | Community fork of Path of Building, actively maintained for PoE2 | Out of this doc's core scope (already documented in this repo's third-party notices) — mentioned only because it's a build-planning tool that itself likely consumes similar GGPK-derived data; not independently re-researched here. |

### 4.1 GGG official APIs — PoE2 coverage matrix (Sept 2026)

| Resource | PoE2 (`realm=poe2`) support | Notes |
|---|---|---|
| **League** | Yes | `poe2` realm added. |
| **Character** | Yes | `poe2` realm added (per-character equipment/inventory/passives). |
| **Ladder** | Yes, **as of 2026-07-21** | Capped at **top 1000** entries for PoE2 (vs. PoE1's top 15000 cap). |
| **Stash** (OAuth) | **No** | OAuth stash endpoint only supports `xbox`/`sony` realms — no PC-PoE2 realm added. The separate legacy character-window stash route accepts `realm=poe2` in its URL but **silently returns PoE1 data** — a real footgun for any integrator who assumes the parameter works. |
| **Public Stash Tab API** (the classic PoE1 "stream of all public stash changes" firehose) | **No PoE2 equivalent found.** | This is the endpoint poe.ninja/PoE1-era tools historically used for bulk economy data; its absence for PoE2 is consistent with poe2scout needing its own OAuth-client-based sync workers rather than consuming a public firehose. |
| **Trade search** (`pathofexile.com/trade2` + underlying trade API) | Yes (site live) | OAuth 2.1-based per GGG's docs; exact PoE2 trade-API endpoint shapes not independently re-verified this session (site domain egress-blocked). |
| **Data Exports (skill tree)** | Yes | See §2.4 — the one place GGG ships pre-extracted, versioned data directly. |

GGG's stated policy (per developer docs, via search synthesis — not independently fetched this
session): they only support resources listed in their API Reference or Data Exports; requests
for anything else ("internal website APIs or in-game resources") are explicitly out of scope
and will be denied. This underlines why every other data source in this document (item/gem/mod
tables, poe2db.tw, poe2wiki.net) exists as unofficial, unsanctioned tooling rather than an
API GGG stands behind.

---

## 5. `patch-package` patches on `@poe2-toolkit` — what they work around

Two patches ship in `patches/`, both **additive** (new optional props/fields, not behavior
changes to existing ones) and clearly authored by this repo's own team ("Project Vaal patch"
comments throughout), not upstream bug reports being worked around blind.

### 5.1 `@poe2-toolkit+tree-core+0.4.1.patch`

Tree-core's upstream data model has no way to represent an ascendancy that **reuses another
ascendancy's node graph wholesale** with only cosmetic overrides (e.g. "Abyssal Lich" — named,
but ships with zero nodes of its own; its 13 node overrides point at alternate skill entries
that exist only in a global `skillOverrides` table, never as real positioned nodes). Upstream's
existing filter (`asc.name && ascendancyStarts.has(asc.id)`) would silently **drop** any such
ascendancy from the class list entirely, since it has no start node under its own id.

The patch adds:
- `mapAscendancyBaseIds` — resolves, from the data itself (not a hardcoded id-naming
  convention), which real ascendancy's graph a nameless-graph ascendancy actually reuses, by
  tracing its first override pair back to a node with a real `ascendancyId`.
- A new `graphId` field on `AscendancyDef` — points allocation/graph logic (in `buildScene`,
  and `tree-react`'s `activeAscendancy` handling) at the *base* ascendancy's actual node graph
  instead of the (non-existent) graph under the reused ascendancy's own id.
- A new `nodeOverrides` field — the resolved base-skill-id → alternate {name, icon, stats}
  table, so the reused graph can still show the *correct* (Abyssal Lich–specific) name/art/text
  on each shared node instead of the base ascendancy's.
- `buildScene.js` changes to actually consult `graphId`/`nodeOverrides` when picking icons and
  matching the implicit "you already have this ascendancy" start-node allocation.

**Plain-language summary**: upstream tree-core can only draw ascendancies that ship their own
full node layout. This patch teaches it to also draw an ascendancy that's really just a
reskin of a *different* ascendancy's tree (same nodes, different names/icons/flavor) — needed
because GGG apparently ships at least one ascendancy that works exactly that way, and without
this patch it would just vanish from Project Vaal's UI.

### 5.2 `@poe2-toolkit+tree-react+0.7.2.patch`

Three independent changes:

1. **`worldLabels` prop** — lets Project Vaal render a permanent, static world-space text label
   (a courtesy credit line) directly into the Pixi scene graph, positioned in world space so it
   pans/zooms with the tree, without being tied to the debug-id-label system or re-rendered on
   every scene rebuild. Pure additive feature, zero upstream behavior change.
2. **Allocation-diff fast path ("Tier 2" perf patch)** — the single largest change. Upstream
   `tree-react` fully destroys and rebuilds **every one of the tree's 1500+ node sprites** on
   *any* scene change, including a single node-allocation click. The patch adds
   `applyAllocationDiff` (plus supporting `sceneIndexRef`/`nodeStateRef`/`effectStateRef`
   bookkeeping) that detects "this scene change is *only* an allocation/weapon-set click, same
   class/ascendancy/resources as last full build" and, in that case, patches just the sprites
   whose allocation state actually changed in place (icon tint, frame texture swap for
   allocated-vs-unallocated frame art, disc alpha) rather than rebuilding the whole tree. Falls
   back safely to a full rebuild whenever an assumption doesn't hold (topology drift, a jewel
   change, ascendancy/resource change) — correctness is preserved, this is purely a perf
   optimization for click responsiveness on 1500+-node trees.
3. **Split centre-art rebuild path** — centre portrait/ring image loads (1-2 per page) used to
   trigger the *same* full-tree rebuild as everything else; the patch adds a narrower
   `rebuildCentre`/`buildCentre`-only path so a slow-loading class portrait doesn't pay for a
   full node-sprite rebuild just to place two sprites. Also fixes a real bug this split
   exposed: `buildCentre` only ever *appends* sprites (it doesn't clear the centre layer
   itself — the full rebuild used to do that as a side effect), so without an explicit
   `removeChildren()` call added by the patch, a slow connection where the portrait and both
   ring sprites load at separate times would double/triple-stack (and leak) centre sprites.
4. **`WEAPON_SET_COLOR` re-tint** — cosmetic: swapped upstream's green/blue weapon-set-1/2
   colors for red/green to match PoE2's actual in-game weapon-swap UI convention.

**Plain-language summary**: this patch is almost entirely a performance fix (avoid rebuilding
~1500 sprites per click; a real user-facing responsiveness bug at PoE2's tree scale) plus one
small feature add (a credit label) and one color tweak — not a correctness bug against GGG's
data, unlike the tree-core patch above.

---

## Open questions / re-verify

- **poe2wiki.net / poewiki.net hosting details** (MediaWiki? wiki.gg? independently hosted?
  what license on content?) could not be confirmed this session — `poewiki.net`, `poe2wiki.net`,
  and `wiki.gg` were all blocked by this sandbox's egress proxy for WebFetch, and WebSearch
  synthesis returned at least one clearly-wrong claim ("official PoE2 Wiki is run by GGG at
  poe2wiki.net") that should not be trusted without direct verification.
- **poe2db.tw's own extraction pipeline** was not independently confirmed this session (assumed
  to be GGPK/bundle-based like everything else in §2, by lineage from the older PoE1 `poedb.tw`,
  but not verified against poe2db.tw's own docs/repo — no public GitHub repo for it was found
  in this session's searches).
- **GGG official developer docs** (`pathofexile.com/developer/docs/*`) were egress-blocked for
  direct WebFetch this entire session; every claim in §2.3 and §4.1 sourced from GGG's own docs
  is via WebSearch synthesis of secondary sources, not a direct read of the primary document.
  Re-verify directly (from an unblocked network) before treating the PoE2 API coverage matrix
  in §4.1 as authoritative, especially the Stash/Public-Stash-API absence claim.
- **`poe2scout.com`'s exact OAuth scope/resource** behind `POEAPI_CLIENT_ID`/`SECRET` (i.e.
  which specific GGG API resource its price-fetch workers actually call) was inferred from the
  presence of those env var names in its repo, not confirmed by reading the worker source code
  line-by-line — the sibling doc and this doc both flag this as "strongly implying," not proven.
- **`poe-bundle-lib` vs. `pathofexile-dat` relationship to `@poe2-toolkit/ggpk`**: could not
  confirm from outside whether `@poe2-toolkit/ggpk` depends on `poe-bundle-lib` for low-level
  Oodle/bundle work, reimplements it, or relies entirely on `pathofexile-dat` for that layer —
  `@poe2-toolkit`'s own docs mention only `pathofexile-dat` as an attributed dependency
  (per `NOTICE.md`), so treat the bundle-decompression internals as `pathofexile-dat`'s unless
  contradicted by a direct read of `@poe2-toolkit/ggpk`'s source/package.json.
- **Exact upstream release dates for `@poe2-toolkit`** came from an AI-summarized fetch of the
  GitHub commits/releases pages; one fetch pass returned "2024" dates for the same releases a
  separate pass dated "2026" (clearly a model date-confusion artifact given this session's
  actual date is 2026-09-16 and the commit-log pass's narrative — new patches referencing
  "0.5.5"-era game content — only makes sense in 2026). This doc uses the 2026 dates as the
  correct reading; re-verify against the raw GitHub releases API/page directly if precision
  matters.
- **Whether Project Vaal consumes `poe.rajtik.com`'s patch-release webhook** for `sync-wiki.ts`
  automation was checked only by a repo-wide filename/import search this session, not exhaustively
  (e.g. GitHub Actions workflow YAML wasn't read in full) — worth a direct look at
  `.github/workflows/sync-wiki.yml` if follow-up work considers adopting it.

---

## Sources

- [rajtik76/poe2-toolkit (GitHub)](https://github.com/rajtik76/poe2-toolkit)
- [rajtik76/poe2-toolkit README (raw)](https://raw.githubusercontent.com/rajtik76/poe2-toolkit/main/README.md)
- [rajtik76/poe2-toolkit NOTICE.md (raw)](https://raw.githubusercontent.com/rajtik76/poe2-toolkit/main/NOTICE.md)
- [rajtik76/poe2-toolkit commits (main)](https://github.com/rajtik76/poe2-toolkit/commits/main)
- [rajtik76/poe2-toolkit releases](https://github.com/rajtik76/poe2-toolkit/releases)
- [rajtik76/exile2exile (GitHub)](https://github.com/rajtik76/exile2exile)
- [Community Showcase — poe2-toolkit + Exile to Exile — PathOfExile forum thread 3977596](https://www.pathofexile.com/forum/view-thread/3977596) *(egress-blocked this session; title/context only via search)*
- [@poe2-toolkit/tree-extractor — jsDelivr](https://www.jsdelivr.com/package/npm/@poe2-toolkit/tree-extractor)
- [@poe2-toolkit/ggpk — jsDelivr](https://www.jsdelivr.com/package/npm/@poe2-toolkit/ggpk)
- [@poe2-toolkit/rune-extractor — jsDelivr](https://www.jsdelivr.com/package/npm/@poe2-toolkit/rune-extractor)
- [OmegaK2/PyPoE (GitHub)](https://github.com/OmegaK2/PyPoE)
- [GGPK Viewer — PyPoE 1.0.0a0 documentation](https://omegak2.net/poe/PyPoE/GUI/ggpk_viewer.html)
- [brather1ng/RePoE (GitHub)](https://github.com/brather1ng/RePoE)
- [repoe-fork/repoe (GitHub)](https://github.com/repoe-fork/repoe)
- [SnosMe/poe-dat-viewer (GitHub)](https://github.com/SnosMe/poe-dat-viewer)
- [poe-dat-viewer lib/README.md](https://github.com/SnosMe/poe-dat-viewer/blob/master/lib/README.md)
- [PoE Dat Viewer — Context7 mirror](https://context7.com/snosme/poe-dat-viewer)
- [aianlinb/LibGGPK3 (GitHub)](https://github.com/aianlinb/LibGGPK3)
- [aianlinb/LibBundle (GitHub)](https://github.com/aianlinb/LibBundle)
- [LibGGPK3.LibBundle3 — NuGet](https://www.nuget.org/packages/LibGGPK3.LibBundle3)
- [poe-bundle-lib — Libraries.io](https://libraries.io/npm/poe-bundle-lib)
- [sage-z-cn/poe-bundle-lib README-zh.md](https://github.com/sage-z-cn/poe-bundle-lib/blob/master/README-zh.md)
- [oriath-net/pogo (GitHub)](https://github.com/oriath-net/pogo)
- [jcmoyer/PoET (GitHub)](https://github.com/jcmoyer/PoET)
- [grindinggear (GGG official GitHub org)](https://github.com/grindinggear)
- [grindinggear/poe2-skilltree-export (GitHub)](https://github.com/grindinggear/poe2-skilltree-export)
- [grindinggear/poe2-skilltree-export README (raw)](https://raw.githubusercontent.com/grindinggear/poe2-skilltree-export/main/README.md)
- [grindinggear/skilltree-export (GitHub, PoE1)](https://github.com/grindinggear/skilltree-export)
- [grindinggear/atlastree-export (GitHub, PoE1)](https://github.com/grindinggear/atlastree-export)
- [GGG Developer Docs — Data Exports](https://www.pathofexile.com/developer/docs/data) *(egress-blocked this session; via search synthesis)*
- [GGG Developer Docs — Reference](https://www.pathofexile.com/developer/docs/reference) *(egress-blocked this session)*
- [GGG Developer Docs — Changelog](https://www.pathofexile.com/developer/docs/changelog) *(egress-blocked this session)*
- [PoE2 Trade — pathofexile.com/trade2](https://www.pathofexile.com/trade2) *(egress-blocked this session)*
- [poe2scout/poe2scout (GitHub)](https://github.com/poe2scout/poe2scout)
- [poe2scout/poe2scout README (raw)](https://raw.githubusercontent.com/poe2scout/poe2scout/main/README.md)
- [poe2scout org (GitHub)](https://github.com/poe2scout)
- [vanzan01/poe2scout-mcp (GitHub)](https://github.com/vanzan01/poe2scout-mcp)
- [poe2db.tw](https://poe2db.tw/us/)
- [poe2wiki.net — Path of Exile 2 Wiki](https://www.poe2wiki.net/wiki/Path_of_Exile) *(egress-blocked this session)*
- [poewiki.net — Path of Exile Wiki](https://www.poewiki.net/wiki/Path_of_Exile_Wiki:About) *(egress-blocked this session)*
- [PathOfExile forum — "We now host the Community Wiki! What does that mean?"](https://www.pathofexile.com/forum/view-thread/3292958) *(egress-blocked this session; via search snippet only)*
- Project Vaal repo context (internal, not web sources): `package.json`, `THIRD-PARTY-NOTICES.md`,
  `patches/@poe2-toolkit+tree-core+0.4.1.patch`, `patches/@poe2-toolkit+tree-react+0.7.2.patch`,
  `scripts/sync-wiki.ts`, `public/data/tree/0.5.2/SOURCE.md`, `src/lib/prices/poe2scout.ts`,
  `docs/research/poe2/currency-and-economy.md`
