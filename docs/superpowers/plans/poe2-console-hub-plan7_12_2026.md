# Project Vaal — Living Planning Document

> Last updated: 2026-07-06 (passive-tree Milestone 1 decisions recorded: §7 `/tree` placed under `(dashboard)` and proxy gating corrected to `PROTECTED_PREFIXES`; §8.5 node art, dual-set encoding + point-budget model; new §12 rows; §15 scoped exceptions; §8.3 stale auth line fixed; §6 `game_version` default annotated as stale; §8.5/§12 "bundled" wording reconciled; §3 status note. **Revised same day after an open-source cross-check (`poe2-tools/poe2-build-planner`) + live-data verification:** ascendancies pulled into M1 with a central-circle render (§8.5/§12, supersedes panel-vs-inline); weapon set changed to per-node tagging with main+ascendancy pools (§8.5/§12, supersedes full two-pool rules); §6 `passive_state` gains `ascendancyNodes`; §8.5 adds connection-arc geometry + decoration/multiple-choice handling)
> **Revised 2026-07-11 after implementing + adopting `@poe2-toolkit` for the passive tree:** §2/§8.5/§12 updated — `tree-core`+`tree-react` replace the planned custom PixiJS renderer/parser (GGG-authoritative arc geometry instead of a geometric heuristic, real BFS allocation, ascendancy sub-graphs, weapon-set tagging); §8.5 corrects its connection-geometry and dual-set-color-token wording to match what's actually built; §3 status note updated (tree viewer merged to `main`; tooltips + persistence still open); §13 gains four open items (schema reconciliation, mode-label wording, point-budget UI, tooltips). **Same-day follow-up:** node search/highlight and a two-tap reset confirm shipped; §13's tooltip item marked shipped and replaced with six new open items — a better mobile tooltip interaction, the credit label's position, the Abyssal Lich ascendancy gap (root-caused: it reuses Lich's graph + a value-override table `@poe2-toolkit` doesn't model), an app version bump, a GitHub housekeeping pass, and outbound-request User-Agent/contact info.
> **Revised 2026-07-12 after a codebase health pass, a PWA implementation, and a cross-page performance pass:** §2 gains a PWA row (Serwist, replacing the unused `@ducanh2912/next-pwa`); §3's dated status note rewritten (PWA now real; tooltip status corrected to "shipped", matching §13; tree perf fix + a newly-found tree-react perf issue noted); §8.5's tooltip line corrected (was stale — said "not yet built," but §13 already had it as shipped 2026-07-11) and gains a note on the `mainBounds`/`buildScene` duplicate-call fix plus a recorded lesson (a `classBounds`-based first attempt broke class selection for Witch/Sorceress and Ranger/Huntress specifically — see §8.5 for the root cause); §12 gains the Serwist-over-next-pwa decision row; §15's PWA-icon bullet extended for the new manifest icons; §13 closes three items (app version bump, outbound User-Agent — predates this session, just unchecked, mode-toggle wording) and gains two — PWA follow-ups, and a real `tree-react` performance issue (full scene-graph rebuild on every prop change, including once per asynchronously-arriving centre-art image) that's the likely dominant contributor to the tree page's TBT and needs its own scoped `patch-package` fix. Also this session, unrelated to the tree specifically: a real price-sync cron bug (firing hourly at :17, not the documented :00/:30), a `proxy.ts` matcher gap taxing every tree-asset fetch with an unneeded Supabase auth round-trip, an ESLint gap linting Serwist's generated `public/sw.js` as hand-written source, and a from-scratch README (was 100% unedited `create-next-app` boilerplate).
> Name: Project Vaal (official — confirmed 2026-06-18)
> Scope: PoE2 only — no PoE1 support

-----

## 0. Maintenance & Volatile Values

Keep this doc current with **targeted section edits, never full rewrites**; date any status note; and treat the numbered section headings as **stable anchors** — reuse them, don't renumber (other files reference them). This section is the index of things that go stale — when something looks wrong or outdated, check here first.

**Volatile values — one home each, resolved dynamically where possible:**

|What|Where it lives / how to resolve|Don't|
|----|-------------------------------|-----|
|Active league|Resolve at runtime via poe2scout `/Leagues` → `IsCurrent`; deploy default in the `ACTIVE_LEAGUES` env var (Runes of Aldur as of mid-2026)|Don't hardcode a league name in app code|
|Current build status & "next feature"|The single dated note at the top of **§3** — nowhere else|Don't scatter status across sections or into the instructions file|
|Current patch / `game_version`|Tracks the live PoE2 patch: `builds.game_version` default (**§6**) bumped per patch via migration — the deployed default can lag (see the §6 note); campaign JSON versioned per patch (**§8.2**); tree JSON + point-budget constants versioned per patch (**§8.5**)|Don't assume the default in §6 is current without checking the live patch|
|Price data + sync cadence|**poe2scout** (**§4**); sync on the `:00/:30` schedule (**§3**)|Don't attribute prices to the GGG Trade API (future/secondary only)|
|Domain & auth email|`project-vaal.xyz` (resolved, **§13**); branded email still pending Pro/SMTP + domain verification|Don't reference `vaal.gg` (dropped)|
|Exact dependency versions|`package.json` is authoritative; **§2** lists the stack identity|Don't treat a version number written in prose here as current|

Anything time-sensitive belongs in its row above (or its owning section), not duplicated into the Project **instructions** file or memory — those hold durable principles and working context, and the plan doc wins on any conflict.

-----

## 1. Project Overview

A free, web-based companion hub for **Path of Exile 2 console players** (PS5, Xbox Series X/S) who cannot run desktop tools like Path of Building, UI overlays, or mods. Mobile-first design. Core features: passive skill tree viewer, item wiki, build sharing, campaign tracker, and build discovery.

-----

## 2. Confirmed Tech Stack

|Layer             |Choice                  |Notes                                                                        |
|------------------|------------------------|-----------------------------------------------------------------------------|
|Frontend framework|Next.js (App Router)    |SSG for wiki pages; SSR for dashboard                                        |
|Styling           |Tailwind CSS + shadcn/ui|shadcn style: radix-nova; Tailwind v4 (no tailwind.config.ts)|
|Database          |Supabase (PostgreSQL)   |Row Level Security enforced                                                  |
|Auth              |Supabase Auth           |Email/password; Google (see §14)                                      |
|GGG Account       |Link only — not login   |GGG OAuth kept as secondary account link for future PoE2 API access (see §14)|
|Passive Tree      |PixiJS (WebGL canvas) via `@poe2-toolkit` (`tree-core` + `tree-react`)|SVG ruled out for performance; library adopted 2026-07-11 over a custom renderer — see §12|
|PWA               |Serwist (`@serwist/next`)|Installable manifest + minimal service worker (precache only, no offline data caching); adopted 2026-07-12 over `@ducanh2912/next-pwa` (unused, unmaintained, webpack-only — see §12)|
|Hosting           |Vercel (frontend)       |Supabase for DB/auth                                                         |
|CI/CD             |GitHub Actions          |                                                                             |
|Search            |Fuse.js                 |Client-side fuzzy search                                                     |
|URL encoding      |gzip → base64url        |For ephemeral (unsaved) build sharing                                        |

-----

## 3. Feature Status

> **Build status (2026-07-12):** Live in production — Supabase auth (email/password; Google coded but provider not yet enabled), `/dashboard`, the shared app shell, **Price Check** (currency exchange + cross-category browse, poe2scout sync on the :00/:30 schedule — a real cron bug fixed 2026-07-12, was firing hourly at :17 instead of twice-hourly), and now a real installable PWA (manifest + minimal Serwist service worker + icons, shipped 2026-07-12 — see §2, §12). The UI overhaul is complete (see §15). **Passive skill tree viewer (must-have #1): core viewer shipped and merged** (`feature/passive-tree-m1` → `main`) — renders via the adopted `@poe2-toolkit` library (§8.5/§12 supersede the original custom-PixiJS-renderer plan), with real GGG art, a class + ascendancy picker (the 8 real classes), Main/Set I/Set II weapon-set painting, node tooltips (**shipped 2026-07-11** — this note previously said "in progress"; corrected to match §13/§8.5), mobile-collapsible controls, wheel+pinch zoom. A cross-page image-optimization pass and a tree render-performance fix also landed 2026-07-12 (§8.5, §12). Still open: working-state persistence + Save-to-Build (§8.6 — blocked on a schema reconciliation, §13), the point-budget/stat panel UI, and a real `tree-react` performance issue found this session (full scene-graph rebuild on every asset load — §13). Not yet built: item wiki, build sharing, campaign tracker, build finder, GGG account link.

### ✅ Confirmed — Must Have

|Feature                       |Notes                                                                                                                                     |
|------------------------------|------------------------------------------------------------------------------------------------------------------------------------------|
|Passive skill tree viewer     |PixiJS; tap to allocate; Set 1 / Set 2 / Both; zoom/pan with last-position memory; BFS pathfinding from class start; point budget tracking|
|Item database / wiki          |Searchable item bases, mods, skills — poewiki.net + community JSON                                                                        |
|Build sharing (shareable link)|Two modes: URL-encoded (ephemeral, no account) + saved build (account required, permanent token)                                          |
|Campaign tracker              |Manual checkboxes per character; % completion; important stops; static JSON updated per patch                                             |
|Mobile-friendly + PWA         |Console players use phone mid-session                                                                                                     |

### 🟡 Confirmed — Should Have

|Feature                        |Notes                                                                                                                           |
|-------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
|Build finder                   |Browse/filter public builds + ladder cache; filter by class, skill, league, realm                                               |
|GGG account linking (not login)|Secondary connection from Settings; stores tokens for future PoE2 API use when GGG opens character endpoints; not a login method|
|Personal character tracker     |Character → build → campaign progress link                                                                                      |

### 🟢 Confirmed — Nice to Have

|Feature                  |Notes               |
|-------------------------|--------------------|
|League info / patch notes|Pulled from GGG site|

### ❌ Dropped

|Feature               |Reason                       |
|----------------------|-----------------------------|
|Store cosmetics viewer|GGG ToS 7i prohibits scraping|

-----

## 4. Data Sources

|Source                                                      |Use                                          |Access            |License                     |
|------------------------------------------------------------|---------------------------------------------|------------------|----------------------------|
|**poe2scout API** (`api.poe2scout.com/api/poe2`)|**Currency & unique prices — CURRENT, shipped** (Price Check): leagues, currency/unique prices by category|REST|Community|
|GGG Trade API (`api.pathofexile.com/trade2`)                |Item listings/prices — *future/secondary; NOT what Price Check runs on today*                        |REST, rate-limited|Public                      |
|GGG OAuth 2.0                                               |Character data, stash                        |OAuth             |Requires GGG account        |
|GGG Passive Tree JSON (`grindinggear/poe2-skilltree-export`)|Full node data                               |Public file       |Free                        |
|GGG Ladder API (`/api/ladders`)                             |Top 1000/league; xbox + sony realms supported|REST              |Public                      |
|poewiki.net                                                 |Item text, mechanics, skills                 |MediaWiki API     |CC BY-NC-SA (must attribute)|
|poe2db.tw                                                   |Item mods, clusters, skill gems              |Scrape            |Community                   |
|Static campaign JSON (repo-maintained)                      |Acts, areas, important stops                 |Direct            |Ours                        |

> **Price source note (2026-07-05):** Price Check ships on **poe2scout**, not the GGG Trade API. Base `https://api.poe2scout.com/api/poe2`; leagues at `/Leagues` (`Value`, `DivinePrice`, `IsCurrent`); currency prices at `/Leagues/{League}/Currencies/ByCategory?Category={apiId}&ReferenceCurrency=exalted&DataPoints=7`; uniques via `/Uniques/ByCategory` using `UniqueItemId` prefixed with `"u"`; categories are lowercase `ApiId`s from `/Items/Categories`. `CurrentPrice` is in Exalted Orbs when `ReferenceCurrency=exalted`; `DataPoints` must be 7 or 8. **Resolve the active league dynamically via `IsCurrent` — do not hardcode.** The GGG Trade API remains a possible future/secondary source only.

-----

## 5. Build Stat Calculator Scope

**Do not implement full DPS calculation.** PoE2’s damage formulas are incomplete, community-disputed, and actively changing during early access. Wrong numbers are harmful.

**Safe to calculate and display:**

- Life / Energy Shield / Mana totals (flat + % increases)
- Resistance totals with cap indicators (base 75%)
- STR / DEX / INT totals
- Passive points used per set / remaining — "remaining" derives from the user-adjustable level/points control (defaults to current-patch max), never a guessed per-character cap; full budget model in §8.5
- Attribute requirements met/not met for equipped gear

Stat panel must be **modular** so DPS calculation can be added post-1.0 when community formulas stabilize.

-----

## 6. Database Schema

### Overview

All tables use `uuid` primary keys with `gen_random_uuid()`. Row Level Security (RLS) is enabled on every table. Service role used only for ladder sync and admin.

-----

### `user_profiles`

Extends `auth.users`. Created automatically via Supabase trigger on user signup.

```sql
CREATE TABLE user_profiles (
  id                    uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  ggg_account_name      text,
  ggg_realm             text CHECK (ggg_realm IN ('pc', 'xbox', 'sony')),
  ggg_access_token      text,   -- encrypted via pg_crypto or Supabase Vault
  ggg_refresh_token     text,   -- encrypted
  ggg_token_expires_at  timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
```

**RLS:**

- `SELECT / UPDATE`: `auth.uid() = id` only
- No INSERT (trigger handles it); no DELETE (cascade from auth.users)

-----

### `characters`

Stores both manually-created characters and those imported via GGG API.

```sql
CREATE TABLE characters (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES user_profiles ON DELETE CASCADE,
  ggg_id          text,         -- GGG internal character ID; null if manually created
  name            text NOT NULL,
  class           text NOT NULL,
  ascendancy      text,         -- null until ascended
  level           int NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
  league          text NOT NULL,
  realm           text NOT NULL DEFAULT 'pc' CHECK (realm IN ('pc', 'xbox', 'sony')),
  is_imported     boolean NOT NULL DEFAULT false,
  last_synced_at  timestamptz,  -- null if manual; set on GGG API pull
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ggg_id)      -- prevents duplicate GGG imports; allows multiple nulls
);

CREATE INDEX characters_user_id_idx ON characters (user_id);
```

**RLS:**

- All operations: `auth.uid() = user_id`

-----

### `builds`

Core build planner data. Supports both character-linked and standalone builds.

```sql
CREATE TABLE builds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES user_profiles ON DELETE CASCADE,
  character_id    uuid REFERENCES characters ON DELETE SET NULL,  -- optional link
  name            text NOT NULL,
  description     text,
  notes           text,
  class           text NOT NULL,
  ascendancy      text,
  level           int NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
  league          text NOT NULL DEFAULT 'Standard',

  -- Build state — all stored as JSONB for flexibility across patches
  passive_state   jsonb NOT NULL DEFAULT '{"set1": [], "set2": [], "ascendancyNodes": []}',
  -- passive_state shape: { set1: [nodeId,...], set2: [nodeId,...], ascendancyNodes: [nodeId,...] }
  -- (updated 2026-07-06 for ascendancies + weapon-set tagging — see §8.5)
  -- Weapon set = per-node tagging (matches GGG .build): a node tagged to set 1 lives in
  -- set1 only, set 2 in set2 only, untagged/"both" in BOTH arrays. Ascendancy allocations
  -- (separate ascendancy point pool) live in ascendancyNodes.
  -- Nodes in 'both' are stored in both arrays at write time

  gear_state      jsonb NOT NULL DEFAULT '{}',
  -- gear_state shape: { head: {...item}, body: {...item}, weapon1: {...}, ... }

  gem_state       jsonb NOT NULL DEFAULT '{}',
  -- gem_state shape: { slots: [ { skill: {...gem}, supports: [{...gem}, ...] }, ... ] }

  -- Sharing
  is_public       boolean NOT NULL DEFAULT false,
  share_token     text UNIQUE,  -- generated on first save; used for /builds/<token>
  view_count      int NOT NULL DEFAULT 0,

  -- Patch tracking — important for PoE2 early access; builds may become outdated
  -- ⚠️ '0.2.0' is the default AS DEPLOYED (set pre-0.5) and lags the live patch (§0).
  -- Save paths must write game_version explicitly from the tree-data version constant
  -- (§8.5/§8.6) — never rely on this column default. Bump the default via migration
  -- alongside Milestone 2 (Save-to-Build). (Annotated 2026-07-06.)
  game_version    text NOT NULL DEFAULT '0.2.0',

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX builds_user_id_idx ON builds (user_id);
CREATE INDEX builds_share_token_idx ON builds (share_token) WHERE share_token IS NOT NULL;
CREATE INDEX builds_public_idx ON builds (is_public, class, league) WHERE is_public = true;
CREATE INDEX builds_game_version_idx ON builds (game_version) WHERE is_public = true;
```

**RLS:**

- `SELECT`: owner always; public builds readable by anyone including anon
- `INSERT / UPDATE / DELETE`: `auth.uid() = user_id` only
- `view_count`: incremented via a service-role RPC to avoid leaking auth on public reads

**share_token generation:** Generated server-side using nanoid (21 chars, URL-safe) on first save. Never regenerated — if a user wants to invalidate a link, they set `is_public = false`.

-----

### `build_tags`

Freeform tags on builds for filtering in build finder.

```sql
CREATE TABLE build_tags (
  build_id   uuid NOT NULL REFERENCES builds ON DELETE CASCADE,
  tag        text NOT NULL CHECK (length(tag) BETWEEN 1 AND 32),
  PRIMARY KEY (build_id, tag)
);

CREATE INDEX build_tags_tag_idx ON build_tags (tag);
```

**RLS:** Follows build ownership. Tags on public builds readable by anyone.

-----

### `build_bookmarks`

Users save builds from the build finder to their library.

```sql
CREATE TABLE build_bookmarks (
  user_id     uuid NOT NULL REFERENCES user_profiles ON DELETE CASCADE,
  build_id    uuid NOT NULL REFERENCES builds ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, build_id)
);

CREATE INDEX build_bookmarks_user_id_idx ON build_bookmarks (user_id);
```

**RLS:** `auth.uid() = user_id`

-----

### `campaign_progress`

Per-character checkpoint completion state. One row per character.

```sql
CREATE TABLE campaign_progress (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES user_profiles ON DELETE CASCADE,
  character_id    uuid NOT NULL REFERENCES characters ON DELETE CASCADE,
  progress        jsonb NOT NULL DEFAULT '{}',
  -- progress shape: { [checkpointId: string]: boolean }
  -- checkpointId matches IDs in the static campaign JSON
  -- Example: { "a1_prison_cleared": true, "a1_passive_book_1": false }
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (character_id)  -- one progress row per character (character is already league-scoped)
);
```

**RLS:** `auth.uid() = user_id`

**Update strategy:** Debounced PATCH from frontend (300ms after last checkbox change). Merge incoming `progress` JSONB with existing via `||` operator to avoid overwriting concurrent updates.

-----

### `ladder_entries`

Cached GGG ladder data. Upserted by cron job; no user writes.

```sql
CREATE TABLE ladder_entries (
  league          text NOT NULL,
  realm           text NOT NULL CHECK (realm IN ('pc', 'xbox', 'sony')),
  rank            int NOT NULL CHECK (rank BETWEEN 1 AND 1000),
  account_name    text NOT NULL,
  character_name  text NOT NULL,
  class           text NOT NULL,
  ascendancy      text,
  level           int NOT NULL,
  snapshot        jsonb,          -- raw API response for future extensibility
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league, realm, rank)  -- upsert replaces on conflict
);

CREATE INDEX ladder_entries_class_idx ON ladder_entries (league, realm, class);
```

**RLS:** `SELECT` open to everyone including anon. `INSERT / UPDATE / DELETE`: service role only (cron).

-----

### JSONB Shape Reference (for frontend devs)

#### `passive_state`

```json
{
  "set1": [12345, 23456, 34567],
  "set2": [12345, 45678],
  "ascendancyNodes": [56789, 67890]
}
```

Nodes in both sets appear in both arrays. Frontend determines “both” status by intersection at read time. Node IDs match `grindinggear/poe2-skilltree-export`.

#### `gear_state`

```json
{
  "head": { "id": "base_id", "name": "...", "mods": [...] },
  "body": null,
  "gloves": null,
  "boots": null,
  "ring1": null,
  "ring2": null,
  "amulet": null,
  "belt": null,
  "weapon1": null,
  "weapon2": null,
  "offhand1": null,
  "offhand2": null
}
```

#### `gem_state`

```json
{
  "slots": [
    {
      "skill": { "id": "gem_id", "name": "Fireball", "level": 20, "quality": 20 },
      "supports": [
        { "id": "gem_id", "name": "Ignite Proliferation", "level": 20, "quality": 0 }
      ]
    }
  ]
}
```

-----

## 7. Route & Page Structure

Using Next.js App Router. Route groups in parentheses are organizational only — no URL segment added.

```
src/app/
│
├── layout.tsx                        Root layout — nav, providers, PWA meta
├── page.tsx                          Home / landing page
│
├── wiki/
│   ├── layout.tsx                    Wiki layout — sidebar nav, search bar
│   ├── page.tsx                      Wiki home / search landing
│   ├── items/
│   │   ├── page.tsx                  Item base browser (Fuse.js search + filters)
│   │   └── [slug]/page.tsx           Item detail — SSG; revalidated on data update
│   ├── skills/
│   │   ├── page.tsx                  Skill gem browser
│   │   └── [slug]/page.tsx           Skill gem detail
│   └── mods/
│       └── page.tsx                  Mod browser (affix tiers, weights)
│
├── builds/
│   ├── page.tsx                      Build finder — public builds + ladder cache
│   │                                 Filters: class, ascendancy, skill tag, league, realm
│   ├── new/
│   │   └── page.tsx                  Build planner — anonymous mode
│   │                                 State in URL (?b=<encoded>) — prompts to save
│   └── [shareToken]/
│       └── page.tsx                  Shared build viewer — read-only
│                                     Works for both saved builds and URL-encoded
│
├── league/
│   └── page.tsx                      Current league info + patch notes
│
├── (auth)/
│   ├── login/page.tsx                Supabase Auth login
│   │                                 Buttons: email/password, Google
│   ├── signup/page.tsx               Account creation (same provider options)
│   └── auth/
│       └── callback/route.ts         Supabase auth callback (route handler — code exchange)
│
├── (dashboard)/                      Signed-in shell (layout); auth is gated by the
│                                     PROTECTED_PREFIXES list in src/proxy.ts — group
│                                     membership alone protects nothing (see Proxy note)
│   ├── layout.tsx                    Dashboard shell — sidebar, mobile bottom nav
│   ├── dashboard/
│   │   └── page.tsx                  Overview: characters, recent builds, quick links
│   ├── tree/
│   │   └── page.tsx                  Passive tree viewer — URL stays /tree (route groups
│   │                                 add no path segment). Account required (§12); gated
│   │                                 by '/tree' in proxy.ts PROTECTED_PREFIXES (decided
│   │                                 2026-07-06). Working state persists to localStorage,
│   │                                 not the URL (see §8.5)
│   ├── characters/
│   │   ├── page.tsx                  Character list — imported + manual
│   │   ├── new/page.tsx              Add character manually (class, level, league)
│   │   └── [characterId]/
│   │       ├── page.tsx              Character overview — linked build + progress summary
│   │       ├── build/
│   │       │   └── page.tsx          Full build planner linked to this character
│   │       └── campaign/
│   │           └── page.tsx          Campaign tracker for this character
│   ├── builds/
│   │   ├── page.tsx                  My builds list — with edit/share/delete
│   │   ├── new/page.tsx              New standalone build (not character-linked)
│   │   └── [buildId]/
│   │       └── page.tsx              Build editor — full planner, linked to saved build
│   └── settings/
│       └── page.tsx                  Account settings — GGG connection, realm pref
│
└── api/
    ├── auth/ggg/
    │   ├── connect/route.ts          GET — initiates GGG account LINK (not login); auth required
    │   └── callback/route.ts         GET — exchanges code; stores tokens for future API use
    ├── builds/
    │   ├── route.ts                  GET (public list), POST (create; auth required)
    │   └── [buildId]/route.ts        GET (public ok), PATCH (owner only), DELETE (owner only)
    ├── builds/[buildId]/views/
    │   └── route.ts                  POST — increments view_count via service role RPC
    ├── characters/sync/route.ts      POST — triggers GGG character pull (only if GGG linked)
    └── ladder/sync/route.ts          POST — cron endpoint; validates CRON_SECRET header
```

### Proxy (`src/proxy.ts`)

Gating is by the explicit `PROTECTED_PREFIXES` list (`'/dashboard'`, `'/characters'`, `'/settings'`, and — decided 2026-07-06 — `'/tree'`), matched via `pathname.startsWith(...)`. The `config.matcher` already runs on essentially every path, so **route-group membership affects layout only, not auth** — placing a folder in `(dashboard)/` does not protect it by itself. (Corrected 2026-07-06: this section previously said the proxy "protects all routes under `/(dashboard)`," and a stale `/tree → PUBLIC` comment inside `proxy.ts` itself is queued for deletion in Milestone 1 Stage 1.) Redirects unauthenticated users to `/login` with `?redirect=<original path>` so they land back after auth.

> Renamed from `src/middleware.ts` per the Next.js 16 deprecation (the `middleware` file convention → `proxy`). It's a pure rename: `export async function proxy(request: NextRequest)` with the same logic and the same `export const config = { matcher: [...] }`. Note `proxy.ts` runs on the **Node.js runtime** (Edge is no longer the default), which is fine — and slightly better — for the `@supabase/ssr` session-refresh pattern used here.

-----

## 8. Data Flows

### 8.1 — Build Save & Share Flow

```
User edits build (React state)
    │
    ▼
"Save Build" clicked
    │
    ├─ Not logged in → redirect to /login?redirect=/builds/new?b=<encoded>
    │
    └─ Logged in →
           POST /api/builds { class, passiveState, gearState, gemState, ... }
               │
               ├─ Supabase INSERT into builds
               ├─ Generate share_token (nanoid)
               └─ Return { id, shareToken }
                      │
                      ▼
               URL: project-vaal.xyz/builds/<shareToken>   ← permanent, shareable

"Copy Link (unsaved)" clicked
    │
    ▼
    Serialize state → JSON → gzip → base64url
    URL: project-vaal.xyz/builds/new?b=<encoded>           ← ephemeral; state dies if URL lost
```

#### Build load at `/builds/[shareToken]`

- `shareToken` starting with a URL-safe alphabet character → look up in `builds` table
- `b=` query param present → decode from base64url client-side
- Both render the same read-only build viewer component

-----

### 8.2 — Campaign Tracker Flow

```
Page load: /characters/[id]/campaign
    │
    ├─ Fetch static campaign JSON  (/public/data/campaign.json — bundled, versioned per patch)
    └─ Fetch user progress         Supabase: SELECT progress FROM campaign_progress WHERE character_id = ?
           │
           ▼
    Merge: overlay progress booleans onto static checkpoint list
    Render: acts → areas → checkpoints with checkboxes
           │
    User checks box
           │
    Optimistic UI update (instant)
           │
    Debounce 300ms
           │
    PATCH Supabase: UPDATE campaign_progress SET progress = progress || '{"checkpoint_id": true}'
    (JSONB merge — only adds/updates checked key; doesn't clear others)
```

Static campaign JSON shape (one file per patch version, filename tracks game version):

```json
{
  "version": "0.2.0",
  "acts": [
    {
      "id": "act1",
      "name": "Act 1 — The Mud Flats",
      "areas": [
        {
          "id": "a1_coast",
          "name": "The Coast",
          "checkpoints": [
            { "id": "a1_coast_cleared", "label": "Clear the coast", "type": "area" },
            { "id": "a1_passive_book_1", "label": "Passive skill book (Hillock)", "type": "passive_point" },
            { "id": "a1_mercy_mission", "label": "Mercy Mission (Nessa — +15 Life)", "type": "stat_bonus" }
          ]
        }
      ]
    }
  ]
}
```

`checkpoint.type` values: `area`, `passive_point`, `stat_bonus`, `gem_unlock`, `npc_unlock`, `optional`

-----

### 8.3 — GGG Account Link Flow

> ⚠️ This is **account linking**, not login. Users authenticate via email/password or Google (per §14 — Apple dropped, Discord never a provider; line corrected 2026-07-06). GGG linking is a secondary connection made from Settings, stored for future use when GGG opens PoE2 character API endpoints.

```
User: Settings → "Link GGG Account" (requires being logged in)
    │
    ▼
GET /api/auth/ggg/connect
    │
    ├─ Confirm auth.uid() exists → 401 if not logged in
    ├─ Generate random state param → store in signed cookie (30s expiry)
    ├─ Build GGG OAuth URL:
    │   https://www.pathofexile.com/oauth/authorize
    │     ?client_id=<VAAL_CLIENT_ID>
    │     &response_type=code
    │     &scope=account:characters account:stashes
    │     &redirect_uri=https://project-vaal.xyz/api/auth/ggg/callback
    │     &state=<state>
    └─ Redirect → GGG login page

User logs in on GGG site
    │
    ▼
GGG redirects → GET /api/auth/ggg/callback?code=<code>&state=<state>
    │
    ├─ Validate state against cookie
    ├─ POST to GGG token endpoint → { access_token, refresh_token, expires_in }
    ├─ Encrypt tokens → UPDATE user_profiles SET ggg_account_name = ?, ggg_access_token = ?, ...
    │   WHERE id = auth.uid()
    │
    ├─ Attempt GET https://api.pathofexile.com/account/characters
    │   ├─ If PoE2 character data becomes available: UPSERT into characters
    │   └─ If not yet available: store tokens only; skip character sync silently
    │
    └─ Redirect → /settings?linked=ggg
```

**Token refresh strategy:** Before any GGG API call, check `ggg_token_expires_at`. If within 5 minutes of expiry, refresh silently on the server. Never expose tokens to the client.

**Current state (PoE2 early access):** GGG does not yet expose PoE2 character/stash data via their API. Tokens are stored and the character sync step is a no-op until they do. The UI in Settings shows “GGG account linked ✓” so users know the connection is ready. When GGG opens the API, character sync activates automatically without any user action.

-----

### 8.4 — Ladder Sync Flow

```
Vercel Cron (every 4 hours) → POST /api/ladder/sync
Header: Authorization: Bearer <CRON_SECRET>
    │
    ├─ Validate secret header → 401 if missing/wrong
    │
    ├─ For each league in ACTIVE_LEAGUES env var:
    │     For each realm in ['pc', 'xbox', 'sony']:
    │         Fetch GGG Ladder API (5 pages × 200 entries = 1000 total)
    │         Throttle: 200ms between requests
    │         UPSERT into ladder_entries ON CONFLICT (league, realm, rank) DO UPDATE
    │
    └─ Return { synced: N, leagues: [...], timestamp }
```

`ACTIVE_LEAGUES` is an env var updated manually each league start (e.g., `"Mercenaries,Standard"`). This means cron config doesn’t need to change — just the env var.

-----

### 8.5 — Passive Tree Render Flow

**Superseded 2026-07-11: adopted `@poe2-toolkit` instead of a custom renderer/parser** (rationale in §12). The flow below reflects what's actually built and merged (`feature/passive-tree-m1` → `main`); the original plan's hand-rolled parser, geometric arc heuristic, and manual BFS are retired — building them this session surfaced exactly the bugs the library's GGG-authoritative approach avoids.

```
Page load: /tree
    │
    ├─ Fetch raw GGG tree JSON: /public/data/tree/<version>/data.json (static asset,
    │   fetched at runtime — see §12) + the vendored node/frame/connector/effect
    │   atlases under .../assets/ (self-hosted: same-origin WebGL textures)
    │   Source: grindinggear/poe2-skilltree-export, vendored per patch
    │
    ├─ normalizeGggTree(raw, version) → TreeData         (@poe2-toolkit/tree-core)
    ├─ buildTreeGraph(data) → main-tree adjacency graph   (@poe2-toolkit/tree-core)
    ├─ buildScene(data, { allocation }) → Scene            (@poe2-toolkit/tree-core;
    │   every node positioned/sized, every connection resolved to a line or an arc
    │   from GGG's own per-edge arc data — not a geometric heuristic, see below)
    │
    ├─ <TreeView scene={scene} resources={...} centreSprites={...} .../>
    │   (@poe2-toolkit/tree-react; owns the WebGL canvas, pan/zoom/hover/click —
    │   see src/components/tree/PassiveTree.tsx)
    │
    User taps node:
    ├─ Ascendancy node → toggleAscendancyAllocation (own sub-graph, own start node)
    ├─ Main-tree node  → toggleAllocationInMode(data, startNode, current, target, mode, graph)
    │   — real BFS pathing per weapon-set paint mode (0 basic / 1 Set I / 2 Set II)
    ├─ Update React state (main allocation + ascendancy allocation kept as separate
    │   slices — see PassiveTree.tsx's state-model comment — merged only for buildScene)
    └─ Update stat panel (recompute safe stats)  — NOT YET BUILT, see note below
```

**Class start / BFS:** `data.classes[classId].startNode`, from the library's own normalized `TreeData` — no hand-rolled map. `buildTreeGraph`/`buildAscendancyGraph` + `toggleAllocationInMode`/`toggleAscendancyAllocation` (all `@poe2-toolkit/tree-core`) do the actual pathing.

**Node art:** unchanged decision (GGG's export sprite atlases, scoped §15 exception) — same vendored assets, now consumed through the library's `RenderResources` contract (`manifest` + `atlases`) instead of a hand-rolled lookup. `src/lib/tree/resources.ts` builds the manifest from the vendored atlas JSONs (stripping each atlas's own key prefix where GGG's export adds one) and separately resolves each class's centre portrait + the shared ring art for `centreSprites`.

**Connection geometry — corrected 2026-07-11:** the original rule ("same `group`+`orbit` → arc, else straight") was a geometric heuristic, and it was wrong in two ways found this session: (1) ~10 same-orbit edges are diametrically opposite (~180° apart across a small ring) and are actually straight chords through the hub, not semicircles; (2) more fundamentally, a geometric guess can't be fully correct here — GGG's own `edges` table already carries an explicit arc centre (`orbitX`/`orbitY`) on every edge that's genuinely an arc, and nothing on the rest. `@poe2-toolkit/tree-core` reads that field directly (its own source comment calls out "no geometric guessing," naming this exact bug class), so this is now correct by construction. No heuristic, no edge-count estimate to maintain.

**Ascendancy render:** unchanged decision (central integrated circle, matching the game) — now the library's own behavior: `buildScene`'s centre layout relocates the active ascendancy's cluster into the hub (`activeAscendancy` prop on `TreeView`), sized from the scene's own ring radii rather than a hardcoded ~1550-unit constant. Class picker offers the **8 real PoE2 classes** (filtered on `ascendancies.length > 0` — confirmed against the live 0.5.2 export: Marauder/Duelist/Shadow/Templar are legacy PoE1 attribute-origin slots with none). Ascendancy allocation paths its own sub-graph (`buildAscendancyGraph`), independent of the main tree.

**Decoration & multiple-choice:** unchanged in spirit — masteries render as background patterns (not allocatable) and empty/proxy connectors are excluded from rendering, now via the library's own node classification rather than our `isDecoration` flag. Multiple-choice nodes aren't specifically exercised in the UI yet.

**Dual-set encoding & interaction — correction 2026-07-11:** colors are **red = Set I, green = Set II, gold = basic/shared**, as decided — but the mechanism differs from what this section originally described. The renderer draws to a WebGL canvas, which can't read CSS custom properties at draw time, so **`--set-one`/`--set-two` tokens are not what drives this**. The colors are hardcoded hex constants inside `@poe2-toolkit/tree-react` (upstream default was green/blue) and are overridden via a small, reviewed `patch-package` patch — `patches/@poe2-toolkit+tree-react+0.7.2.patch` (see §12) — rather than a token. The mode control is a 3-way toggle; the shipped UI labels it **Main / Set I / Set II** (this section previously said "Global" — "Main" is what's live; references elsewhere should follow). The "focus toggle that dims the other set" behavior is not yet built.

**Point budget:** **not yet built.** Allocation itself works (main + ascendancy, per the model above) but there's no point-counting/stat panel UI — no main/ascendancy pool display, no level-based total, no "remaining" figure. The pool rules below are still the intended design; they just have no UI yet. Weapon set is **per-node tagging, not a separate point pool** (matches GGG's `.build` format; see §12). Enforced pools, once built: **main + ascendancy** — main = count of unique allocated point-costing nodes (excludes class/ascendancy starts, decoration, multiple-choice options); ascendancy = allocated nodes against the **ascendancy pool** (a version-tied constant, ~8, trials-based, verified per patch). Totals from a user-adjustable level/points control (default: current-patch max); "remaining" reflects the user's stated numbers (§5).

**Node tooltips:** **shipped 2026-07-11** (this line previously said "not yet built (in progress)" — stale; §13 already tracked this as shipped, this section just hadn't been corrected to match). Desktop hover shows a floating `NodeTooltip`; touch — where real pointer hover never fires, traced in `tree-react`'s own pointer handling: any touch interaction sets a drag ref on `pointerdown`, routing every subsequent `pointermove` into the pan branch instead of hit-test/hover — uses a persistent tap-driven `NodeInfoPanel` instead. `TreeView` exposes `onNodeHover(skill, screen)`; each node's stats live on `TreeData.nodes[skill].stats` (display strings with `[Token|Text]` markup) via `@poe2-toolkit/tree-core`'s own normalization. Open: a better mobile interaction that previews a node without committing its allocation on the same tap (§13).

**Working state (no build needed) & Save-to-Build (§8.6): not yet built — deferred.** The locked `passive_state` shape (`{set1, set2, ascendancyNodes}`, §6) doesn't map 1:1 onto the library's runtime allocation shape (`{allocated: number[], weaponSets: Record<number, 1|2>}` for the main tree, plus a separate ascendancy-node list) — reconciling the two is a real decision, not a wiring task, and is open in §13 before either localStorage persistence or Save-to-Build gets wired up.

**Initial camera framing — corrected 2026-07-12.** `PassiveTree.tsx`'s `frame` value (the camera's initial-fit rectangle, passed to `TreeView`'s `focus` prop) was computed via a *second*, redundant `buildScene()` call purely to read `.mainBounds` off a throwaway scene. `buildScene()` positions every node, resolves every connection, and places every effect pattern, so doing that twice on every mount/class-switch was real, avoidable main-thread work sitting in front of first interactivity. Now reads `scene.mainBounds` directly off the scene already built for rendering — `mainBounds` ("extent of the whole main tree, ascendancy discs excluded") was never class-scoped to begin with, so no second computation was ever needed.

**Lesson recorded for future tree work:** an intermediate attempt used `classBounds(scene, classId)` (also from `tree-core`) to scope this bounds computation per-class, on the reasoning that `frame` looked class-specific since a `classId` was passed into the original `buildScene()` call. That reasoning was wrong, and it broke class selection specifically for **Witch/Sorceress and Ranger/Huntress** — confirmed via the vendored `data.json`'s raw `classStartIndex` field: every class in this tree shares its start node with exactly one other class (6 shared-start pairs for 12 total GGG class slots — a deliberate GGG design, not a data quirk). Most of those pairs have one legacy/unreleased partner (Marauder/Warrior, Duelist/Mercenary, Shadow/Monk, Templar/Druid) that's filtered out of the class picker, so there's no real ambiguity in practice. Witch/Sorceress and Ranger/Huntress are the *only* two pairs where **both** classes are real and selectable — exactly, and only, the two that broke. `classBounds`'s "closest bearing" sector-assignment logic has no way to disambiguate a genuinely shared start point between two live classes. Any future per-class geometry work in this tree needs to account for this shared-start-node pairing up front, not discover it via a regression.

-----

### 8.6 — Save Passive Tree to Build

**Not yet built — blocked on the schema reconciliation noted in §8.5/§13.** The flow below is still the intended design.

The passive tree tab has a **“Save to Build”** button — worded so the user understands the tree becomes part of a *build* (reusing the `builds` table; a saved tree is a build with only `passive_state` filled).

```
Tree tab → tap “Save to Build”
    │
    ├─ Not signed in → redirect to /login?redirect=/tree   (account required; no anon saves)
    │
    ├─ Prompt: Create a NEW build  OR  Add to an EXISTING build
    │     ├─ New      → ask for a name (class taken from the tree) → INSERT builds row
    │     │              with passive_state = current tree; gear_state / gem_state default {}
    │     └─ Existing → list the user's builds (name, class, updated) → pick one
    │            │
    │            └─ If that build already has a NON-EMPTY passive tree:
    │                   show a REPLACE WARNING (destructive confirm) before overwriting
    │                   its passive_state; otherwise write straight through.
    │
    └─ UPDATE builds.passive_state (+ name/class on new builds)   (RLS: auth.uid() = user_id)
```

**Passive-tree milestone 2** — built after the viewer can render + allocate. No schema change: writes `passive_state` (and `name` / `class` for new builds) into the existing `builds` table; sharing via `share_token` comes for free later.

-----

## 9. URL Encoding Spec for Ephemeral Builds

The encoded `b=` parameter must survive a URL share (copy-paste, messaging apps). We use:

```
buildState → JSON.stringify → TextEncoder → CompressionStream('deflate-raw') → Uint8Array → base64url
```

On decode:

```
base64url → Uint8Array → DecompressionStream('deflate-raw') → TextDecoder → JSON.parse
```

`CompressionStream` / `DecompressionStream` are available in all modern browsers (Chromium 80+, Safari 16.4+, Firefox 113+) — no library needed.

Max practical URL length for sharing (iMessage, Discord, etc.) is ~2000 chars. A typical build with 100 passive nodes + gear slots should compress well under this. If over limit, fall back to saving the build and returning the permanent `/builds/<token>` URL.

-----

## 10. Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=              # server-only; never expose to client

# Auth — social providers configured in Supabase dashboard (no env vars needed for Google)

# GGG account linking (not login)
GGG_CLIENT_ID=
GGG_CLIENT_SECRET=                      # server-only
GGG_REDIRECT_URI=https://project-vaal.xyz/api/auth/ggg/callback
NEXT_PUBLIC_ENABLE_GGG_LINK=true        # gate behind flag; disable if GGG credentials not yet active

# Cron security
CRON_SECRET=                            # random 32-byte hex; set in Vercel + GitHub Actions

# Feature flags / config
ACTIVE_LEAGUES=Mercenaries,Standard     # updated each league start; used by ladder sync
```

-----

## 11. RLS Policy Summary

|Table              |SELECT                  |INSERT       |UPDATE       |DELETE           |
|-------------------|------------------------|-------------|-------------|-----------------|
|`user_profiles`    |owner                   |trigger      |owner        |cascade from auth|
|`characters`       |owner                   |owner        |owner        |owner            |
|`builds`           |owner + public rows anon|owner        |owner        |owner            |
|`build_tags`       |follows build           |follows build|follows build|follows build    |
|`build_bookmarks`  |owner                   |owner        |—            |owner            |
|`campaign_progress`|owner                   |owner        |owner        |owner            |
|`ladder_entries`   |anyone                  |service role |service role |service role     |

-----

## 12. Key Design Decisions & Rationale

|Decision                                                   |Rationale                                                                                                                                                                                                      |
|-----------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|No `build_versions` table; use `game_version` field instead|Version history would require patch-aware schema migrations; `game_version` string on each build is sufficient — shown as “Created in 0.2.0” tag, filterable in build finder so users find current-patch builds|
|Passive tree JSON is a static `/public` asset fetched at runtime (never `import`-ed into the JS bundle)|File is ~5MB as of 0.5.x; importing it would inflate the initial JS payload. "Bundled" in older wording meant "committed to the repo under `/public`" — the CDN serves it cached under a versioned path for cache-busting on patch updates (wording reconciled with §8.5, 2026-07-06)|
|Auth providers: email + Google (Apple dropped) |Both Supabase-native and free. Apple dropped: it needs a paid ($99/yr) Apple Developer account and the app is free; add it later only if a native App Store build ever needs it. Email magic-link/OTP stays free if passwordless is wanted.|
|GGG as account link, not login                             |GGG OAuth exposes no useful PoE2 data currently; separating auth from data sourcing future-proofs the design                                                                                                   |
|GGG link gated by feature flag                             |Lets us ship login without needing GGG dev credentials first                                                                                                                                                   |
|Two sharing modes (URL-encoded + DB token)                 |Lets users share instantly without an account; saved builds get permanent URLs                                                                                                                                 |
|JSONB for build state                                      |PoE2 gear/gem/passive schemas change each patch; JSONB avoids migration hell                                                                                                                                   |
|Saved passive trees reuse the `builds` table|A saved tree is a build with only `passive_state` filled — upgrades to a full build (gear/gems) with no migration, and shares via the existing `share_token`. Tree tab uses a **“Save to Build”** button → create a new build or pick an existing one, with a destructive replace-warning before overwriting a build's existing tree (see §8.6).|
|Static campaign JSON in repo                               |Content updates (new areas, reward changes) don’t require DB migrations                                                                                                                                        |
|`game_version` on builds                                   |Lets UI warn users when a build was made on an older patch                                                                                                                                                     |
|ladder_entries primary key on (league, realm, rank)        |Upsert replaces stale entries automatically; no orphan cleanup needed                                                                                                                                          |
|GGG tokens never sent to client                            |Stored server-side only; avoids XSS risk                                                                                                                                                                       |
|`ACTIVE_LEAGUES` env var                                   |Decouples league management from cron config changes                                                                                                                                                           |
|PixiJS over SVG                                            |Performance on mobile with 2000+ nodes; SVG reflow too slow                                                                                                                                                    |
|Adopt `@poe2-toolkit` (`tree-core`+`tree-react`) over a custom renderer (2026-07-11)|Building a custom parser/renderer this session surfaced a real bug class: geometric arc-vs-line heuristics disagree with GGG's own per-edge arc data in ways only fixable by reading that data directly — exactly what this library does (confirmed via its source, not just its README). Same stack (PixiJS v8, React ≥18, the identical vendored `data.json`), MIT, live demo visually confirmed exact-to-in-game. Trade-off: pre-1.0 (`tree-react` 0.7.x), single maintainer — mitigated by pinning the exact installed version and a committed `patch-package` patch (below) that fails loudly, not silently, on an upstream bump. Retires the custom parser/renderer/viewport code §8.5 originally planned.|
|Weapon-set colors + world-space credit via `patch-package`, not props (2026-07-11)|Neither is exposed by `@poe2-toolkit/tree-react` 0.7.2: node/rail tint for weapon sets is a hardcoded constant (green/blue), and there's no prop for arbitrary world-space text. Patched both in one small, committed, reviewed patch (`patches/@poe2-toolkit+tree-react+0.7.2.patch`, applied via `postinstall`) rather than forking the library or routing around it — verified end-to-end (fresh install → patch-package → syntax check → type-check) against the exact pinned version.|
|Fuse.js (client-side)                                      |Avoids a search backend; wiki data is static; acceptable for item count                                                                                                                                        |
|No anonymous saves                                         |Simplifies RLS; avoids orphaned data; users prompted to sign up                                                                                                                                                |
|Anonymous access limited to the Prices tab|`/prices` is the only public route; every other feature (passive tree, builds, campaign, dashboard, settings) requires an account behind the auth proxy. Keeps RLS simple and gives a clear reason to sign up. The passive tree's unsaved working state still persists client-side via `localStorage` (see §8.5).|
|`/tree` lives at `app/(dashboard)/tree/page.tsx` + `'/tree'` in `PROTECTED_PREFIXES` (2026-07-06)|URL stays `/tree` (route groups add no segment); inherits the signed-in dashboard shell so an account-required feature wears the logged-in chrome. Route-group membership alone gates nothing — the proxy protects only what's listed in `PROTECTED_PREFIXES` (§7)|
|Tree node art: GGG's sanctioned export sprites (2026-07-06)|**Scoped exception to §15's original-art rule.** The passive-tree export is GGG's stated exception to their data-access rules and ecosystem tools render these sprites; assets are self-hosted under `/public/data/tree/<version>/` (same-origin WebGL textures; no dependence on GGG's asset host). All app chrome stays original|
|Dual-set lines: in-game red/green + gold for global (2026-07-06)|Fidelity to the game beats palette purity here. Dedicated `--set-one`/`--set-two` tokens kept **distinct from `--destructive`**; active-set focus toggle mirrors the weapon swap and doubles as the colorblind disambiguator (pure color otherwise — accepted trade-off). **Scoped §15 exception** (see §8.5)|
|Point budget: main + ascendancy pools; weapon set = tagging (2026-07-06, revised same day)|An open-source cross-check showed full weapon-set-**point** enforcement is uncommon even in mature tools, and GGG's official `.build` format models sets as per-node tags — so we **tag** (red/green/gold), not enforce a weapon-set pool. Enforced pools: **main + ascendancy** (ascendancy pool ~8, version-tied). Totals from a user-adjustable level control (default: current-patch max). Keeps "remaining" honest (§5, §8.5). Supersedes the earlier "full two-pool rules" call|
|Ascendancies in Milestone 1; central-circle render (2026-07-06)|Ascendancies are in M1. Rendered in the tree's hollow centre: the chosen ascendancy's edge-of-tree cluster is recentered + scale-fit (~1550 units) over the class art frame; the others hidden (zoom governs detail). Selection = small picker; class picker offers the **8 classes with named ascendancies**. A separate **nav graph** prunes ascendancy-bridge + cross-class edges so base-tree BFS can't enter an ascendancy. Supersedes the panel-vs-inline question (§8.5)|
|Connection arcs; decoration & multiple-choice nodes (2026-07-06)|Same-`group`+`orbit` connections arc around the group centre (~1,603 edges); parser carries `group`/`orbit` + a `groups` map. Masteries are decorative in 0.5.x and ~238 empty proxy connectors exist — flagged `isDecoration`, kept for pathing, excluded from allocation/points. Multiple-choice nodes (20) carried via `isMultipleChoiceOption`/`multipleChoiceParent` (§8.5)|
|Serwist over `@ducanh2912/next-pwa` for PWA support (2026-07-12)|`next-pwa`'s own docs/npm page point to Serwist as the successor; it hadn't published in ~2 years and is webpack-only, which would force `next dev`/`next build` off Turbopack project-wide (Next 16 defaults both to Turbopack) just for one plugin. Serwist has real, if still-evolving, Turbopack support and is the actively maintained choice. Scope kept to installable-only — a manifest + a minimal precache-only service worker, no offline caching of tree/prices data — matching what the product actually needs today over building unused caching machinery. Production build uses `next build --webpack` specifically (a documented Turbopack/Serwist integration gap, `serwist/serwist#54`); `next dev` stays on Turbopack, unaffected, since the service worker is disabled in development anyway (`next.config.ts` also carries an explicit empty `turbopack: {}` so Next doesn't treat the webpack key as an unmigrated config and hard-error on `next dev` startup).|

-----

## 13. Decisions Still Open

- [x] ~~Final product name~~ — **resolved: Project Vaal is the official name** (confirmed 2026-06-18)
- [ ] Token encryption strategy: pg_crypto in Postgres vs Supabase Vault (Vault preferred when it exits beta)
- [ ] poe2db.tw scraping: confirm legality and rate-limit strategy before implementing
- [ ] GGG API: confirm OAuth scope names and whether PoE2 character endpoint is live when applying for credentials
- [x] ~~Share URL domain~~ — **resolved: `project-vaal.xyz`** (purchased on Vercel 2026-06-18; both `project-vaal.xyz` apex and `www.project-vaal.xyz` assigned). DNS propagating at purchase time (up to ~40 min). Until it serves traffic, test on the `*.vercel.app` URL. References updated in §8.1, §8.3, §10.
- [ ] Branded auth emails: the signup confirmation currently sends from the generic Supabase sender. A custom sender (e.g. `noreply@project-vaal.xyz`) needs Supabase Pro or custom SMTP **and** a verified domain. The domain is now decided (`project-vaal.xyz`), so this is unblocked on that front — remaining work is Pro/SMTP + verifying the domain in the email provider. Set up before launch; it also lifts the ~2 emails/hour default limit.
- [ ] Light-mode toggle: dark-first shipped with a light palette retained in `globals.css` `:root`; a user-facing toggle is deferred (low priority)
- [ ] Passive-tree `passive_state` schema vs. `@poe2-toolkit`'s runtime allocation shape: reconcile `{set1, set2, ascendancyNodes}` (§6) against the library's `{allocated, weaponSets}` before wiring localStorage working-state persistence or Save-to-Build (§8.5/§8.6)
- [x] ~~Passive-tree mode-toggle wording~~ — **resolved**: §8.5 already reconciled to "Main" (the shipped UI's actual wording) in its 2026-07-11 revision; no other section references the old "Global" wording.
- [ ] Passive-tree point-budget/stat panel UI: allocation works; no point-counting or stat display yet (§8.5)
- [x] ~~Passive-tree node tooltips~~ — **shipped 2026-07-11**: desktop hover tooltip (`NodeTooltip`) + a tap-driven persistent info panel (`NodeInfoPanel`) for touch, since real pointer hover never fires on touch (traced in `tree-react`'s own pointer handling — any touch interaction sets a drag ref on `pointerdown`, routing every subsequent `pointermove` into the pan branch instead of hit-test/hover). See the new open item below — the panel is a stopgap, not a settled mobile design.
- [ ] Passive-tree mobile tooltip UX: `NodeInfoPanel` only updates on tap, and a tap already allocates/deallocates the node — so there's currently no way to preview a node's effect on a phone without committing the allocation first. Need a better mobile-native interaction pattern (e.g. a distinct preview gesture) that doesn't require an extra library patch beyond what's already in place, if possible.
- [ ] Passive-tree credit label position: "Tree rendering via @poe2-toolkit — thanks, rajtik76" sits too far right of the ascendancy hub; move it further left (closer to the ring). Set in `PassiveTree.tsx`'s `creditLabels` memo (`centre.x + ring.frameRadius + 150` — reduce the offset).
- [ ] Abyssal Lich ascendancy (Witch's hidden 4th ascendancy) is missing from the tree's class/ascendancy picker. Confirmed real and in-game (unlocked later via Kulemak's Invitation → Well of Souls; toggles freely with regular Lich once unlocked) — not a data-staleness issue (0.5.2 is still GGG's latest export). Root cause: Abyssal Lich reuses Lich's (`Witch3`) exact node graph/positions with ~3 notables swapped for different effects, via an `overridePairs` table (base skill id → alternate skill id, 13 entries) present on the ascendancy's raw GGG data (`raw.classes[].ascendancies[].overridePairs`) — `@poe2-toolkit`'s ascendancy filter requires a dedicated start node, which this ascendancy doesn't have by design (it isn't a separate graph), so it's silently dropped; `AscendancyDef` also has no field to carry the override table even if the filter let it through. Fix needs: (a) a `tree-core` patch recognizing "reuses another ascendancy's graph + override table" as a valid shape, (b) threading `overridePairs` through into `AscendancyDef`, (c) applying the override to displayed name/stats (tooltip/info panel) **and** to what's actually drawn on the canvas (icon/frame) — the last part likely needs a further `tree-react` render-layer patch, same pattern as the existing color/credit patches.
- [x] ~~App version number~~ — **resolved 2026-07-12**: bumped `0.1.0` → `0.2.0` to reflect the passive-tree milestone (done alongside this session's other work; picked 0.2.0 as a reasonable minor bump since no specific target version was given here — open to changing it).
- [ ] GitHub repo housekeeping pass (scope TBD — likely description/README/topics; confirm exact ask next session). Note: the README file itself *was* rewritten 2026-07-12 as part of a codebase health pass (was 100% unedited `create-next-app` boilerplate) — this remaining item is about the repo's GitHub-side metadata (description, topics), not the README's content.
- [x] ~~Outbound API requests... descriptive User-Agent~~ — **resolved, predates this session**: `poe2scout.ts`'s `userAgent()` already sends a `PRICE_SYNC_CONTACT`-based contact email — this item was stale, the work was done in an earlier session and never checked off here. One real drift *was* fixed 2026-07-12: it had hardcoded the app version as a second, independent copy ("0.1") instead of reading `package.json`, so it had already fallen out of sync with the real version; now imports `package.json`'s `version` directly so it can't drift again.
- [ ] PWA follow-ups: what shipped 2026-07-12 is installable-only — a manifest + a minimal Serwist service worker that precaches static build assets only. No offline caching of the passive tree's data/atlases, no offline handling for prices/dashboard, no push notifications — all deliberately out of scope for this pass. Full design + what was left out and why: `docs/superpowers/specs/2026-07-12-pwa-serwist-design.md`.
- [ ] Passive-tree performance: `@poe2-toolkit/tree-react`'s `TreeView` fully destroys and rebuilds the entire scene graph — every one of 1500+ nodes — on every relevant prop change (`scene`, `resources`, `centreSprites`, `activeClassId`, `activeAscendancy`), and separately, its own internal centre-art image-loading effect calls that same full rebuild *again* on each individual image's `onload` (the class portrait and the shared ring art load and arrive separately). Confirmed by reading `TreeView.js`'s source directly, and by a live Lighthouse trace on `/tree` showing repeated long tasks spread across roughly 4–11 seconds after load rather than one clump — consistent with several complete rebuilds, not one. Ruled out as the cause: Pixi's `Application` itself (created once, correctly, via an empty-dependency-array effect) and this project's own `resources.ts` hooks (`useTreeResources`/`useClassCentreSprites` already consolidate all their async loading into one `Promise.all`-based state update each, not several). A real fix means patching `tree-react`'s `rebuild()` to update incrementally instead of wholesale — the project already has `patch-package` infrastructure for this exact library (see §12's weapon-set-color/credit-label patch) — but it's a substantial rewrite of third-party scene-graph lifecycle code and deserves its own scoped session, not a quick fix.

-----

## 14. Auth Provider Details

### Login / Signup Providers

|Provider        |Supabase Support|Setup                                                             |
|----------------|----------------|------------------------------------------------------------------|
|Email / password|Native          |On by default (email-confirmation toggle is in the dashboard)|
|Google          |Native          |Free — enable in Supabase dashboard; needs a free Google Cloud OAuth client|

Apple is intentionally **dropped** — it is the only paid provider (a $99/yr Apple Developer account) and the app is free. Magic-link / email OTP is available for free if a passwordless option is wanted later.

PlayStation Network, Xbox Live, and Steam are **not viable** for third-party web auth:

- PSN: closed to licensed game studios only; no public OAuth
- Xbox: no isolated Xbox OAuth; “Login with Microsoft” gives a Microsoft account, not Xbox identity — not relevant to console players
- Steam: uses OpenID 2.0 (not OAuth 2.0); Supabase doesn’t support it natively; target audience is console players anyway

### GGG Account Linking (secondary, from Settings)

- Initiated from `/settings` after login — never a login path
- Stores `ggg_access_token`, `ggg_refresh_token`, `ggg_account_name` in `user_profiles`
- Currently does nothing with character data (GGG PoE2 API not live)
- Character sync activates automatically once GGG opens endpoints — no user action needed
- UI shows connection status: “GGG account linked ✓” or “Link GGG account →”

## 15. Visual Design / UI Overhaul (✅ shipped 2026-06-28)

**Status:** Shipped. Project Vaal now has its own dark, gothic, PoE2-appropriate identity, built on the token system below so the look stays editable from a few central files.

### What shipped

- **Palette (dark-first, oklch in `src/app/globals.css`):** warm near-black charcoal surfaces, aged-gold `--primary` (~`oklch(0.74 0.095 85)`), blood-red reserved for `--destructive` only, `--radius` `0.5rem`. A light palette is retained in `:root` for a future toggle; the app forces dark via a `dark` class on `<html>`.
- **Typography:** Cinzel (display / `font-heading`) + Inter (body + tabular numbers) via `next/font` in `layout.tsx`.
- **App shell** (`src/components/layout/`): a shared `AppShell` (server, resolves auth) → `ShellChrome` (client) = desktop sidebar + mobile top-bar + mobile bottom-nav, one centred `max-w-3xl` container. Used by both the `(dashboard)` group and the public `/prices` route. Live routes are links; unbuilt features (Tree / Builds / Wiki) render as dimmed “Soon”. Home + brand route to `/dashboard` when signed in, `/` when not.
- **Icon system:** cream PNGs in `public/icons/` are used as CSS masks and tinted via `currentColor` through `<Icon name>` (`.vaal-icon`) — active = gold, inactive = muted, entirely in code (no baked states).
- **Decorative assets** in `public/`: `brand/vaal-emblem.png`, `ornaments/divider.png`, `background/app-bg.webp`, `illustrations/empty-prices.png`. New shadcn primitive: `Card`.
- **Background:** a fixed, viewport-sized `body::before` layer (not `background-attachment: fixed`, which iOS scales badly) with a radial vignette + `background/noise.png` tile to kill mobile pixelation + dark-gradient banding; source reprocessed (upscaled → softened → dithered).
- **Favicon / PWA icons:** `src/app/icon.png` (tight-cropped emblem favicon) + `src/app/apple-icon.png` (emblem on black for the iOS home-screen icon, replacing the default “P”); `favicon.ico` removed. **Extended 2026-07-12** for real Android/Chrome installability: `public/icons/pwa-192.png` + `pwa-512.png` (reused/resized from `icon.png`) and `pwa-512-maskable.png` (emblem padded onto pure black, matching `apple-icon.png`'s existing background choice, so Android's adaptive-icon crop can't clip it) — wired up via `src/app/manifest.ts` plus a minimal Serwist service worker. Full design: `docs/superpowers/specs/2026-07-12-pwa-serwist-design.md`.
- **Custom cursor:** gold arrow (`public/cursor.png`) site-wide on desktop; text fields keep the I-beam.
- **Prices page** restyled + fixed: one overflow-safe row format; cross-category Fuse search; safe Refresh + relative “last synced”; **Exchange** shows a readable number ≥ 1 with the currency name small, flipping direction (“226 per Divine Orb”) instead of “1 / N”; quick Exalted / Divine pickers.

### Keep it token-driven (still applies to every new page)

Use semantic tokens (`bg-card`, `text-muted-foreground`, `bg-primary`, `border`, `text-destructive`) and the `font-heading` / `font-sans` families — never hard-coded hex. Colour + radius live in `globals.css`; primitives in `src/components/ui/`; fonts in `layout.tsx`. Restyle in one place, propagate everywhere.

### Constraints (preserved)

- Mobile-first (console players are on their phone mid-session).
- Accessibility floor: visible keyboard focus, sufficient contrast, reduced-motion respected.
- **No GGG / third-party assets** (ToS §7i). All Project Vaal art is original. **Scoped exceptions (2026-07-06, rationale in §12):** the passive-tree viewer renders GGG's sanctioned tree-export node sprites, and tree set-lines use dedicated `--set-one` (red) / `--set-two` (green) tokens alongside gold — both confined to the tree canvas. App chrome stays original, and `--destructive` remains the only warning red.

### Deferred

- Light-mode toggle (palette already retained in `:root`; dark-only by default for now).
- Optional `/style-guide` preview page (not built).

-----

*This document is the single source of truth for Project Vaal. All architectural decisions must be recorded here.*