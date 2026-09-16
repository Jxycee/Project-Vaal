# PoE2 Build-Sharing / Build-Planning Ecosystem

Research for Project Vaal's build-sharing feature: what exists in the PoE2 community for planning, exporting, and sharing character builds, what data formats they use, and whether GGG exposes any live-character API Project Vaal could import from directly.

## Last updated

2026-09-16. Game state: PoE2 Early Access, patch **0.5.5 "Forbidden Rites"** (event league on base patch **0.5.0 "Return of the Ancients"**). 1.0 targeted 2026-12-11, not live. All version-specific claims below (OAuth scope behavior, in-game Build Planner feature) are dated to this patch and may have moved by 1.0.

No existing build-sharing code was found in this repo (`src/components`, `src/lib`) as of this research — this doc has no prior Project Vaal implementation to reconcile against.

---

## 1. Is there a PoB2 equivalent? Yes — Path of Building 2 (community), plus a separate GGG-official in-game planner

Two distinct things exist and are easy to conflate:

| | **Path of Building 2 (PoB2)** | **GGG in-game Build Planner** |
|---|---|---|
| What it is | Full third-party desktop DPS/build calculator, PoE2 port of the PoE1 tool | Official GGG feature shipped in-client since patch 0.5, for *viewing* a build guide in-game |
| Maintainer | **PathOfBuildingCommunity** org on GitHub, led by **LocalIdentity** (same team as the PoE1 Community Fork) | Grinding Gear Games |
| Repo | [PathOfBuildingCommunity/PathOfBuilding-PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2) (canonical; a `PathOfBuilding-PoE2-v2` repo also exists but is only a temporary fork made while the main repo's CI/main branch was broken — **not** the canonical one, per its own README) | Not open source; client feature only |
| Platform | **Desktop only (Windows primary; Lua/LuaJIT app)** — no official web or console version. This is the exact gap Project Vaal exists to fill for PS5/Xbox players. | In-client (so console players *can* see a subscribed build's tree/gems/notes in-game — but cannot create/edit one; creation is desktop/text-editor only) |
| Does what | Full character sim: exact passive tree, exact gear + rolled mods, exact gem levels/quality/supports, DPS/defense calculation, config flags (auras, curses, boss dummies, etc.) | Shows passive tree path highlighting, a skill/support gem list, and free-text gear priority notes for one guide, with no numeric calculation |
| Output artifact | A lossless PoB2 XML, normally shared as a compressed base64 "share code" or a pobb.in link | A GGG `.build` JSON file (see §3) |

**Community adoption**: PoB2 is the de-facto standard the same way PoE1's PathOfBuilding was — build guides, Discords and trade discussions on PoE2 assume "post your PoB2 link" the same way PoE1 assumed "post your PoB link" (see §6).

---

## 2. Export/share-code formats

### 2.1 PoB2's own share code (the "PoB code")

Confirmed directly from PoB2's Lua source (`src/Classes/ImportTab.lua`, `src/Modules/Build.lua`):

```
share code = urlsafe_base64( zlib_deflate( SaveDB_XML ) )
```

- Encode: `common.base64.encode(Deflate(self.build:SaveDB("code")))`, then `+`→`-`, `/`→`_` (URL-safe base64).
- Decode: reverse — `-`→`+`, `_`→`/`, base64-decode, zlib-inflate, parse XML.
- The decoded XML root element is **`<PathOfBuilding2>`**, matching the `<PathOfBuilding>` root PoE1 tools already know.
- This is exactly the pipeline the third-party `poe2-build-forge` tool documents independently (`base64 → zlib inflate → XML`), corroborating it from the outside.

### 2.2 The full internal PoB2 XML schema (lossless, "de-facto full build schema")

From `buildMode:SaveDB` in `Modules/Build.lua`, the `<PathOfBuilding2>` root contains a `<Build>` element plus one child element per registered "saver" module, written out **alphabetically**:

| XML element | Source module | Contents |
|---|---|---|
| `Build` | (self) | Class, level, ascendancy, bandit/other top-level character state |
| `Calcs` | `calcsTab` | Saved calculation/config output state |
| `Config` | `configTab` | Combat/environment config flags (buffs active, boss settings, party size, etc.) |
| `Import` | `importTab` | `importLink` attribute — remembers the source URL/site a build was imported from |
| `Items` | `itemsTab` | Full equipped items **as PoE's plain-text item-clipboard format** (`Rarity: ...`, `Item Level: ...`, mod lines) embedded per item, i.e. the same "advanced tooltip text" format used when you Ctrl+C an item in-game — full rolled affix values, not just base type |
| `Notes` | `notesTab` | Free-text build notes |
| `Party` | `partyTab` | Party/multi-character comparison data (PoB2-specific; not in PoE1 format) |
| `Skills` | `skillsTab` | Skill/support gem setups, socket groups, per-gem level/quality |
| `Tree` | `treeTab` | Passive tree spec(s): allocated node IDs, per-node `allocMode` (used for weapon-set-conditional allocation), class/ascendancy IDs |
| `TreeView` | `treeTab.viewer` | Pure UI state (pan/zoom) for the tree viewer — not build-semantic |

This is the schema to treat as "what a build actually needs to fully describe" if Project Vaal wants **PoB2-level fidelity** (exact rolled item mods, exact gem quality/level, full passive allocation including weapon-set-conditional nodes). It is not officially documented by GGG as a spec — it's PoB2's internal save format, reverse-engineerable only from its (MIT-licensed) source, which is what was done here.

### 2.3 GGG's own official share/import surface: pobb.in-style paste sites + a `pob2://` protocol handler

PoB2 ships a first-party sites table (`src/Modules/BuildSiteTools.lua`) defining exactly which paste/build sites it recognizes for both import and one-click export, each with a matching URL pattern and upload/download API:

| Site | Import URL pattern | Download (raw code) URL | Upload (export) endpoint |
|---|---|---|---|
| **pobb.in** | `https://pobb.in/<id>` | `pobb.in/pob/<id>` | `POST https://pobb.in/pob/` |
| **Maxroll** | `https://maxroll.gg/poe2/pob/<id>` | `maxroll.gg/poe2/api/pob/<id>` | `POST https://maxroll.gg/poe2/api/pob` (field `pobCode=`) |
| **poe.ninja** | `https://poe(2).ninja/poe2/pob/<id>` | `poe.ninja/poe2/pob/raw/<id>` | `POST https://poe.ninja/poe2/pob/api/upload` (field `code=`) |
| **poe2db.tw** | `https://poe2db.tw/pob/<id>` | `poe2db.tw/pob/<id>/raw` | `POST https://poe2db.tw/pob/api/gen` |
| Pastebin.com / PastebinP.com / Rentry.co | generic paste URL | raw-text endpoint | (no dedicated upload API used by PoB2) |

Implications for Project Vaal:
- **pobb.in already supports PoE2** codes (distinct from its PoE1 codes — same domain, PoB2-specific paths).
- A `pob2://<site>/<id>` custom protocol handler exists (e.g. `pob2://maxroll/<id>`) that PoB2 registers on desktop for one-click "open in PoB2" links from websites — irrelevant to a web app, but explains why guide sites format links the way they do.
- If Project Vaal wants to **read** an existing shared build (e.g., a user pastes a pobb.in link), the same `base64→zlib→XML` decode in §2.1 applies to the raw code these download endpoints return, and Project Vaal could implement a compatible decoder without needing GGG or PoB2 involvement (this is what `poe2-build-forge` and `poe2-build-converter` third-party tools already do — see §4).

---

## 3. GGG's own official in-game Build Planner `.build` file format

This is a **separate, GGG-first-party, JSON format**, introduced in patch 0.5 as an official in-client feature (not PoB2). It matters most for Project Vaal because it's the one format actual console players can consume in-game today without any desktop tool.

- **Location on disk (PC)**: `Documents\My Games\Path of Exile 2\BuildPlanner\*.build` — the client scans this folder and lists compatible files in an in-game Build Planner UI (top-left icon on the Passive Tree screen). Console equivalent storage path unconfirmed (see Open Questions).
- **Official docs**: `https://www.pathofexile.com/developer/docs/game#buildplanner` (GGG's developer docs; describes the file format and the `additional_text` custom markup — this domain was egress-blocked in this sandbox for WebFetch, so the field-level schema below is triangulated from **PoB2's own exporter source** (`src/Modules/BuildExportPoE2.lua`, which explicitly cites that doc URL) and from a third-party open-source viewer (`poe2-tools/poe2-build-planner`) that also targets it — cross-checked against a real bundled sample file, so treat the schema as high-confidence but not verbatim-GGG-worded.

### 3.1 Schema (verified against a real GGG-authored sample file + two independent parsers)

```jsonc
{
  "name": "Titan Warrior",             // required, build/guide title
  "author": "Grinding Gear Games",     // optional
  "description": "...",                // optional
  "ascendancy": "Warrior1",            // optional; internal ascendancy id (implies base class)
  "passives": [                        // allocated passive tree nodes
    "melee17",                                              // bare string shorthand = { id: "melee17" }
    { "id": "strength17", "additional_text": "<m>{<red>{Strength +5 is recommended}}" },
    { "id": "jewel_slot1956" }                               // jewel socket nodes use their own ids
    // optional per-entry: "weapon_set": 1|2 (dual-spec / weapon-swap conditional node),
    //                     "level_interval": [minLevel, maxLevel] or a single number
  ],
  "skills": [                          // active skill gems + their linked supports
    {
      "id": "Metadata/Items/Gems/SkillGemEarthquake",   // full GGG internal gem path, not a display name
      "additional_text": "Intended to be taken BEFORE BoneShatter",
      "support_skills": [
        "Metadata/Items/Gems/SupportGemFastForward",           // bare string shorthand
        { "id": "Metadata/Items/Gems/SupportGemImpactShockwave", "additional_text": "..." }
      ]
    }
  ],
  "inventory_slots": [                 // NOTE: official key is `inventory_slots`, NOT `items`
    {
      "inventory_id": "Weapon1",       // slot id, see slot table below
      "unique_name": "Kalandra's Touch",   // optional: shows a header if THIS unique isn't equipped
      "additional_text": "<silver>{Any Two Handed Mace}\n\n<grey>{Stat Priority\n1. ...}"
      // optional: "level_interval": [min, max]
    }
  ]
}
```

Confirmed via the actual GGG-authored bundled sample (`Titan Warrior`) and via `PathOfBuilding-PoE2`'s exporter/parser, plus an independent `.build` editor's TypeScript types (`poe2-tools/poe2-build-planner`, `src/buildfile/types.ts`):

```ts
interface Build {
  name: string; author?: string; description?: string; ascendancy?: string;
  passives: Passive[]; skills: SkillSetup[]; items: Item[]; // parsed from `inventory_slots`
}
interface Passive { id: string; weapon_set?: number; level_interval?: [number, number]; additional_text?: string; }
interface SkillSetup { id: string; level_interval?: [number, number]; support_skills?: SupportGem[]; additional_text?: string; }
interface SupportGem { id: string; level_interval?: [number, number]; additional_text?: string; }
interface Item { inventory_id: string; unique_name?: string; additional_text?: string; level_interval?: [number, number]; }
```

**Legacy/compat note**: some early fixture files used a bare `items` key instead of `inventory_slots`; parsers accept both on read but the *official* key — and the only one the in-game client is confirmed to read — is `inventory_slots`.

### 3.2 Full inventory slot ID table (from PoB2's own generated slot-map data, `Data/InventorySlots.lua`)

| Display slot | `inventory_id` | Notes |
|---|---|---|
| Weapon 1 | `Weapon1` | main-hand, weapon set 1 |
| Weapon 2 | `Offhand1` | off-hand, weapon set 1 |
| Weapon 1 Swap | `Weapon2` | main-hand, weapon set 2 |
| Weapon 2 Swap | `Offhand2` | off-hand, weapon set 2 |
| Weapon3 / Offhand3 | `Weapon3` / `Offhand3` | third set — unconfirmed which game feature this maps to (see Open Questions) |
| Helmet | `Helm1` | |
| Body Armour | `BodyArmour1` | |
| Gloves | `Gloves1` | |
| Boots | `Boots1` | |
| Belt | `Belt1` | |
| Amulet | `Amulet1` | |
| Ring 1 / Ring 2 / Ring 3 | `Ring1` / `Ring2` / `Ring3` | a 3rd ring slot exists in the data (unconfirmed live feature — see Open Questions) |
| Trinket | `Trinket1` | |
| Flask 1/2, Charm 1/2/3 | all `Flask1`, distinguished by `slot_x` 0-4 | flasks and charms share one logical container, indexed by position |

### 3.3 Custom text markup (`additional_text` fields)

Confirmed from PoB2's exporter comments (citing the GGG doc directly): delimiter-based tags, e.g. `<bold>{ text }`, `<italic>{ text }`, `<red>{ text }`, `<rgb(R,G,B)>{ text }`. Braces `{ }` are the delimiter, so literal `{`/`}` in mod text must be stripped before embedding. This is GGG's own lightweight markup for colored/styled notes in the Build Planner UI, not a general PoE2 UI system.

### 3.4 What this format does **not** capture (important gap vs. PoB2's XML)

- No rolled item mod values — only free-text "stat priority" hints and an optional unique-item name flag. This format is a **build guide/leveling plan**, not an exact character snapshot.
- No exact gem level/quality field on skill/support entries — `additional_text` is overloaded as the only channel for a "Level N, Q% Quality" hint (PoB2's exporter synthesizes this text itself; it isn't a first-class field).
- No numeric character stats, no attributes, no explicit "class" field (only `ascendancy`, from which base class is inferred).
- No weapon-set item pairing beyond the two/three weapon slot IDs — passives carry a `weapon_set` tag for dual-spec conditional nodes, items do not.

### 3.5 GGG's roadmap: an account-linked "Subscribe" API (not yet shipped as of 0.5.5)

Per Maxroll's coverage of the 0.5 build planner reveal, **GGG is building an account-linked API** so that clicking a "Subscribe" button on a community build site pushes `.build` data directly into a player's account through GGG's own infrastructure — no manual file download/folder-drop needed. This was explicitly **not ready for the 0.5 launch** and has no confirmed ship date as of patch 0.5.5 (Sept 2026). If/when it ships, it is the most directly relevant future integration point for Project Vaal (a legitimate, GGG-sanctioned way to push a build into a player's account, console included, without scraping or an unofficial API). Track this.

---

## 4. Third-party conversion/tooling around these formats

| Tool | Repo | What it does |
|---|---|---|
| **guide2pob** | [maxrenke/guide2pob](https://github.com/maxrenke/guide2pob) | Scrapes structured build data (tree/gems/gear) off a rendered Mobalytics guide page and reconstructs a PoB import code from it — i.e., reverse-engineers Mobalytics's own (non-PoB) representation back into the PoB2 XML/code format. |
| **poe2-build-converter** | [PraedythXIV/poe2-build-converter](https://github.com/PraedythXIV/poe2-build-converter) | Browser-only tool: takes a PoB2 export code or a pobb.in link and converts it into a GGG `.build` file, plus offers its own Atlas/Genesis/Delirium planning and live market prices layered on top. Direction: **PoB2 → GGG `.build`.** |
| **poe2-build-forge** | [chesler410/poe2-build-forge](https://github.com/chesler410/poe2-build-forge) | Same direction (PoB2 code → `.build`), implemented as a documented pipeline: decode wire format → parse XML AST → map PoB ids to GGG's internal table ids → emit validated `.build` JSON. Confirms the base64/zlib/XML wire format independently of PoB2's own source. |
| **poe2-tools/poe2-build-planner** | [poe2-tools/poe2-build-planner](https://github.com/poe2-tools/poe2-build-planner) | Offline-first web app (Vite/React/TypeScript, MIT) to visualize/create/edit `.build` files directly — passive tree, gems, items, and per-level "build profile" snapshots for leveling guides. Fully vendors GGG's tree export + community gem data so it needs no network at runtime. Its `src/buildfile/types.ts` and `src/buildfile/parse.ts` are the cleanest available reference implementation of the `.build` schema (used throughout §3 above) — worth reading directly if Project Vaal implements its own `.build` reader/writer. |

---

## 5. How the big build sites actually do import/export

| Site | Mechanism | Notes |
|---|---|---|
| **Maxroll.gg** (PoE2Planner) | (a) Its own web build planner with **native `.build` file import/export** ("Import Build Planner (GGG)" / "Export Build Planner (GGG)" buttons) reading/writing the same GGG-official folder-based format from §3. (b) Every guide ships **its own PoB2 export code** ("PoB 2 Import Export" page) hostable at `maxroll.gg/poe2/pob/<id>` per the PoB2 site table in §2.3. (c) **Live character import**: as of the "PoE2Planner Character Import Feature" news post, Maxroll lets a user authenticate (GGG OAuth, see §7) and imports passives/skills/items directly from a real character into the planner. | Maxroll is the only build site confirmed here to already do live-character OAuth import for PoE2 — meaning GGG's character OAuth endpoint is usable in production today by an approved third party. |
| **Mobalytics** | Own web-based build planner (`mobalytics.gg/poe/planner/builds`) — build in browser, share via a Mobalytics URL, no PoB install required. Also supports importing from a PoB export. Its own guide export format is not PoB2-XML-compatible natively (hence `guide2pob` existing to bridge it back). | Positioned as the "friendlier to a casual/console-ish audience" alternative to a raw PoB2 code — directly relevant precedent for Project Vaal's target console audience. |
| **poe.ninja** | Hosts PoB2 codes for PoE2 the same way it long has for PoE1 (`poe.ninja/poe2/pob/<id>`), per the PoB2 site table in §2.3; primarily an economy/build-stats aggregator, not an original build editor. | |
| **poe2db.tw** | Same pattern — PoB-code paste/host endpoint recognized natively by PoB2 (`poe2db.tw/pob/<id>`). Otherwise a wiki/database site (also a source Project Vaal's own AGENTS.md-sanctioned wiki-icon extraction references as a category, not this specific site). | |

---

## 6. Community conventions around sharing builds

- The standing convention, carried over unchanged from PoE1, is **"post your PoB2 link"** — build-help channels on Discord (both the official combined PoE1&2 Discord and community servers like PoE Vault's) expect a pobb.in-hosted PoB2 code as the default way to communicate a build precisely enough for others to critique or calc.
- Guide-format convention: written guides (Maxroll, Mobalytics, and independent creators) pair a prose leveling/endgame guide with an embedded PoB2 export/link section, and increasingly (post-0.5) also ship a downloadable `.build` file for the in-game planner, sometimes both.
- The in-game Build Planner (§3) added a "guide link" button in a later 0.5.x patch: a `.build` file can embed a URL back to the full web guide, though **GGG currently whitelists only a subset of domains** allowed to appear as that in-client link target (exact whitelist not found — see Open Questions).
- GGG's official public stance (per its build-planner reveal) is that it will **not** curate or publish "official" builds itself — the feature is purely a distribution rail for community-authored guides.

---

## 7. Official GGG character/API access

### 7.1 What exists

GGG runs an **OAuth 2.1**-based developer API (`pathofexile.com/developer/docs/authorization`), replacing the old PoE1-era unauthenticated `api.pathofexile.com/character-window/get-characters` / `get-items` / `get-passive-skills` endpoints (those still exist for PoE1 legacy compatibility but are not the sanctioned path forward).

- Confidential-client OAuth flow: access tokens last 28 days, refresh tokens 90 days.
- Relevant scope: **`account:characters`** — "view the account's characters and inventories." Other account scopes follow the same `account:*` pattern (`account:profile`, `account:leagues`, `account:stashes`).
- **PoE2 support confirmed**: the character endpoint(s) now accept a `realm=poe2` parameter and return equipment, (previously) inventory, and passive-skill data for PoE2 characters specifically, per GGG's own developer changelog. **As of 2025-10-28, the PoE2 character endpoint stopped returning unequipped inventory items** — it still returns equipped gear and the passive tree. This is a real, if narrowed, live-character read API.
- **Maxroll is already using this in production** (§5) — their "PoE2Planner Character Import Feature" authenticates a user via GGG OAuth and pulls passives/skills/items from a live character. This is the strongest evidence the endpoint is usable today by an approved third party for exactly Project Vaal's use case (import-by-account/character-name instead of manual entry).

### 7.2 Access gate: new OAuth app registrations

Community reporting (GGG forum reply) states GGG's OAuth application registration was **"currently unable to process new applications"** as of the time that thread was active, with developers directed to email `oauth@grindinggear.com` and no confirmed SLA for approval. **This session could not confirm whether that gate is still in effect as of patch 0.5.5 / Sept 2026** — treat as a real but unverified blocker; see Open Questions. If still closed, Project Vaal cannot get its own OAuth client approved to build this without direct GGG contact, regardless of the endpoint's technical capability.

### 7.3 Console accounts (PSN/Xbox) and the character API

- PoE2 identity is unified: a player's characters, items and progress live under one central GGG account regardless of which platform (Steam, PS5, Xbox) they log in from; cross-progression is confirmed across all three. Only **stash tabs / MTX purchases** are platform-locked (PlayStation purchases stay PlayStation-only; PC and Xbox purchases are shared with each other but not PS5).
- Because the OAuth character API is scoped to the **GGG account**, not to a login platform, there is **no reason to expect PSN- or Xbox-linked accounts to be unqueryable** the same way Steam-authenticated accounts are — a query by account name should surface PoE2 characters regardless of originating platform. **This is inferred from the account-unification model, not directly confirmed against the API for a console-originated account** — flagged in Open Questions, since it's the single highest-value fact for Project Vaal to nail down before building on it.
- The friend-search / account-name lookup UI in-game is confirmed to work across platforms (searching a friend's account name works even if they're on a different system), which supports (but does not prove) the same for the OAuth API.

---

## 8. What a build needs to fully describe (synthesis)

Combining §2.2 (PoB2's lossless schema) and §3 (GGG's official but lossier schema), a build that's fully reproducible needs:

1. **Class + Ascendancy** — PoB2: explicit class/ascendancy IDs in `Tree`. GGG `.build`: only `ascendancy` (base class inferred).
2. **Passive tree allocation** — set of allocated node IDs; PoB2 uses numeric node IDs + a `stringId`, GGG `.build` uses the string ID directly (e.g. `"melee17"`, `"AscendancyWarrior1Notable4"`). Both support **weapon-set-conditional** nodes (`allocMode` / `weapon_set`) for dual specs.
3. **Skill gems + supports, per skill group** — active gem + linked support gems; PoB2 additionally tracks exact gem level/quality and enabled/disabled/main-skill-index state; GGG `.build` only has a free-text hint for level/quality.
4. **Gear per slot, both weapon sets** — PoB2: full item text (base type, rarity, ilvl, every rolled affix, sockets/runes/enchants) per the same slot table as §3.2. GGG `.build`: slot + optional unique name + free-text stat-priority notes only, **no rolled values**.
5. **Config/combat state** (PoB2 only) — active buffs, boss/encounter assumptions, party size — needed to reproduce a specific DPS number, irrelevant to a pure "what to allocate" guide.
6. **Metadata** — name, author, description, notes — present in both formats.

**Practical implication for Project Vaal**: if the goal is "let a user describe or import a build accurately enough to be useful," the GGG `.build` schema (§3) is the lighter-weight, already-JSON, no-desktop-tool-needed target — but it is a *guide* format (text hints, no numeric mod values). If the goal is "faithfully reproduce a PoB2 build a user already has," Project Vaal needs a decoder for §2.1/§2.2 (base64→zlib→XML→the fuller schema), which is exactly what the third-party `poe2-build-forge` / `poe2-build-converter` tools in §4 already do and could be studied or even reused (both are small, permissively-licensed, browser-runnable).

---

## Open questions / re-verify

- **GGG OAuth app registration status today (patch 0.5.5, Sept 2026)**: is it still closed to new applicants? The only evidence found is an undated community forum summary claiming closure; Maxroll clearly has an approved client, so exceptions/existing approvals plainly exist. Needs a direct check of `pathofexile.com/developer/docs` and/or the `oauth@grindinggear.com` contact process at build time.
- **Console (PSN/Xbox) accounts through the OAuth character API**: not directly tested/confirmed in this research — only inferred from the unified-account/cross-progression model. This is the single most important fact to verify before designing Project Vaal's "import by account name" flow around it, since it's the entire value proposition for console players.
- **`.build` file location and mechanism on console**: the PC path (`Documents\My Games\Path of Exile 2\BuildPlanner\`) is confirmed; there is no confirmed equivalent console mechanism (no filesystem access on PS5/Xbox) for a player to load a `.build` file today. This may mean the in-game Build Planner is effectively **PC-only in practice** even though the client feature ships on all platforms — worth confirming directly (does the console client offer a way to type in a code, a URL, or a "subscribe" flow yet, ahead of the account-linked API in §3.5?).
- **The `.build` in-client "guide link" domain whitelist** (§6): exact list of allowed domains not found.
- **`Weapon3`/`Offhand3` and `Ring3` inventory slot IDs** (§3.2): present in PoB2's generated slot-map data but this research could not confirm which live PoE2 feature (if any, e.g. a third ring from a keystone/uncommon mechanic) they correspond to — may be forward-looking/unused scaffolding.
- **GGG's account-linked "Subscribe" build-push API** (§3.5): confirmed as announced/in-development via secondary reporting (Maxroll's news coverage of the director's statement) but this research found no direct primary-source (GGG blog/patch-notes) quote — treat the existence and framing as likely-true-but-unconfirmed-verbatim.
- **`pathofexile.com` and most gaming-wiki domains (fextralife, maxroll.gg, mobalytics.gg, poe2.dev, pobb.in itself, deepwiki.com) were egress-blocked for direct WebFetch in this sandbox.** Everything about the official GGG developer docs (`/developer/docs/game#buildplanner`, `/developer/docs/authorization`, `/developer/docs/reference`) is triangulated from WebSearch snippets plus first-party corroboration in PoB2's and poe2-build-planner's own source code (which both explicitly cite and implement against those docs) — not read verbatim from GGG's page. Re-fetch those docs directly once a working path exists.

---

## Sources

- [PathOfBuildingCommunity/PathOfBuilding-PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2) — cloned and read directly: `README.md`, `src/Modules/BuildExportPoE2.lua`, `src/Modules/BuildSiteTools.lua`, `src/Modules/Build.lua`, `src/Classes/ImportTab.lua`, `src/Data/InventorySlots.lua`
- [PathOfBuildingCommunity/PathOfBuilding-PoE2-v2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2-v2) (temporary fork, referenced only to confirm it's not canonical)
- [poe2-tools/poe2-build-planner](https://github.com/poe2-tools/poe2-build-planner) — cloned and read directly: `README.md`, `src/buildfile/types.ts`, `src/buildfile/parse.ts` (and its test files), `Builds/sample.build`
- [chesler410/poe2-build-forge](https://github.com/chesler410/poe2-build-forge)
- [PraedythXIV/poe2-build-converter](https://github.com/PraedythXIV/poe2-build-converter)
- [maxrenke/guide2pob](https://github.com/maxrenke/guide2pob)
- [grindinggear/poe2-skilltree-export](https://github.com/grindinggear/poe2-skilltree-export) (official GGG tree data repo, context only)
- [maxroll.gg/poe2/pob](https://maxroll.gg/poe2/pob) — PoB2 import/export page
- [maxroll.gg/poe2/planner](https://maxroll.gg/poe2/planner) — PoE2Planner
- [maxroll.gg/poe2/news/poe2planner-character-import-feature](https://maxroll.gg/poe2/news/poe2planner-character-import-feature)
- [maxroll.gg/poe2/news/poe2planner-build-file-import-added-passive-tree-export-improved](https://maxroll.gg/poe2/news/poe2planner-build-file-import-added-passive-tree-export-improved)
- [maxroll.gg/poe2/getting-started/how-to-use-the-in-game-build-planner](https://maxroll.gg/poe2/getting-started/how-to-use-the-in-game-build-planner)
- [maxroll.gg/poe2/news/path-of-building-release-for-poe2](https://maxroll.gg/poe2/news/path-of-building-release-for-poe2)
- [mobalytics.gg/poe/planner/builds](https://mobalytics.gg/poe/planner/builds)
- [pobb.in](https://pobb.in/)
- [poe-vault.com/poe2/guides/how-to-path-of-building-2](https://www.poe-vault.com/poe2/guides/how-to-path-of-building-2)
- [pathofexile.com/developer/docs/reference](https://www.pathofexile.com/developer/docs/reference) (fetch blocked; via WebSearch snippet + PoB2/poe2-build-planner source cross-check)
- [pathofexile.com/developer/docs/authorization](https://www.pathofexile.com/developer/docs/authorization) (fetch blocked; via WebSearch snippet)
- [pathofexile.com/developer/docs/game#buildplanner](https://www.pathofexile.com/developer/docs/game) (fetch blocked; cited directly by PoB2's own exporter source as its spec reference)
- [pathofexile.com/developer/docs/changelog](https://www.pathofexile.com/developer/docs/changelog) (PoE2 `realm=poe2` character endpoint change, Oct 2025 inventory-scope change; via WebSearch snippet)
- [pathofexile.com/forum/view-thread/3966517](https://www.pathofexile.com/forum/view-thread/3966517) — "PoE 2 OAuth 2.1 endpoints"
- [pathofexile.com/forum/view-thread/3965990](https://www.pathofexile.com/forum/view-thread/3965990) — "PoE2 Account API Fails to Load All Characters After Full Privacy Disclosure"
- [pathofexile.com/forum/view-thread/3821465](https://www.pathofexile.com/forum/view-thread/3821465) — "App registration, Oauth Access?"
- [poe-vault.com/poe2/news/path-of-exile-2-crossplay-and-cross-progression-explained](https://www.poe-vault.com/poe2/news/path-of-exile-2-crossplay-and-cross-progression-explained)
- [lagzapper.com/blog/path-of-exile-2-account-link](https://www.lagzapper.com/blog/path-of-exile-2-account-link/)
- [discord.com/invite/pathofexile](https://discord.com/invite/pathofexile), [discord.com/invite/pathofexile2](https://discord.com/invite/pathofexile2)
