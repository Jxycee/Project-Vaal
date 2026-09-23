# Competitor Build-Flow Gaps

Date: 2026-09-23
Scope: what a user can *express* or *learn* about a build on competitor sites that they cannot on Project Vaal today — build model contents, computed feedback, import/export, discovery/guidance, and the shape of a "build" as a data object. Explicitly not about layout, mobile-reflow, or ads (see Exclusions) — the 2026-09-20 recon already covers that ground and this report does not repeat it.

## Method (what you did per site, and what you could not reach)

- **poeplanner.com** (PoE1, referenced for mature gear/gem UX). Selected a class (Scion), then worked through all six tabs. On **Stats**, read the live-computed character sheet (Life/Mana/Armour/Evasion/ES/attributes/four resistances) and its "Build Stats" attribute breakdown. On **Config**, inspected Level, Maximum Life/Mana override fields, a three-position "Resistance penalty" toggle (0/-30/-60%), and an Endurance Charges field. On **Skills**, added a link group, picked the "Precision" aura gem via its tag-filtered picker, and watched the Mana reservation bar go negative and turn into a striped warning state; confirmed each gem row carries its own numeric Level and Quality fields. On **Equipment**, opened "Create Item," picked a "Sorcerer Boots" base, and opened its mod editor: influence dropdown, quality slider, base-variance slider, and an "Explicits" affix picker whose rows show the mod's craft-source tag (e.g. ESSENCE, WARBANDS DROP ONLY), affix family name, semantic tags (elemental/cold/ailment), a tier position on a slider, and an exact editable roll value. On **Import/Export**, read the full list of supported import sources and export formats. Did not test PoE2 passive-tree allocation (poeplanner is PoE1-only, as the target list itself notes) or actually complete item creation (mod picker was read, not applied, to conserve time).
- **maxroll.gg** — opened the Build Guides index (filterable by class/ascendancy/Endgame/Leveling/Twink Leveling/Ascendancy) and a live guide, "Lightning Arrow Deadeye Build Guide." Read its full structure: Skills (rotation + gem engraving/leveling priority), Ascendancy (with a "How to Ascend" explainer), Passives (with named build-progression stages — Early / Hybrid / Hybrid Crit / CI — each a distinct tree+gear configuration gated on gear quality), Stat Priorities (ranked offensive and defensive lists), Gearing (per stage: Campaign / Hybrid / Crit Swap / CI Swap), FAQ, Summary, and a dated Changelog. Did not re-test the planner's item/gem editing mechanics in depth — the 2026-09-20 recon already covers that UI and nothing there changed.
- **pobb.in** — reopened a real public build (`https://pobb.in/TUsV2f6hi8cg`, a level-94 Artillery Ballista Witchhunter) and read its full content rather than just its layout: the computed stat header (Life/ES/Mana/eHP, four resistances, DPS/Speed/Hit Chance), the 8-entry "Loadout" dropdown (named, leveled checkpoints from "Nivel 31 – Empezamos con Balista" through "Nivel 94," each a full gear+gem+tree snapshot), the three named gem link-groups (main skill, Spirit Gems, a curse/support group), and the author's free-text Notes (per-slot gearing advice, act quest-reward choices, a ranked "how this build gains damage" list, specific gem-level callouts). This is a real player-authored build, so its content is illustrative of the format, not a claim about what pobb.in itself computes beyond what it renders from the PoB code.
- **mobalytics.gg** — opened the PoE2 Tier List page: an S/A/B/C/D ranking of ascendancies with named-creator commentary per entry (build name, creator, strengths/weaknesses in prose) and a "Tier List Maker" for community-made lists. Did not re-test the build-guide-embeds-a-PoB-code pattern — already covered by the 2026-09-20 recon.
- **d4builds.gg** — not revisited this pass; the 2026-09-20 recon's coverage (gear rows, skill tree, leveling-path toggle) stands and nothing new was checked.
- No accounts created, nothing downloaded, no forms submitted. All reads via `get_page_text` / `read_page`; two screenshots taken (poeplanner Stats tab, poeplanner mod editor) at default scale since exact widget layout mattered for one finding.

## Findings, ranked by impact on a real build

### 1. They compute a full character sheet live; we compute nothing.

**What they do:** poeplanner's Stats tab shows Life, Mana, Armour, Evasion, Energy Shield, Strength/Dexterity/Intelligence, and all four resistances, recalculated from tree + gear + gems, with an expandable "Build Stats" panel that attributes each number to its source (e.g. "+20 to Strength" traceable to a specific node). pobb.in's shared-build header shows the same core set plus effective HP, DPS, attack/cast speed, and hit chance. **What we do:** nothing — Project Vaal has no stat engine; gear, gems, and tree are stored as selections with no derived numbers anywhere.

**Cost to our user:** a player cannot tell, from inside Project Vaal, whether their resist is capped, whether a gear swap helped or hurt their life total, or how close they are to affording a reservation skill. They have to reconstruct these numbers by hand or abandon the planner and go compute them elsewhere — which defeats the purpose of having planned the build here at all.

### 2. They validate and warn; we silently accept anything.

**What they do:** on poeplanner, adding a level-20 Precision aura with no spare mana pushed the "Unreserved Mana" bar to **-136 / 50 (-272%)** and the bar itself flipped into a red-and-black striped warning state — an unmissable, immediate signal that the build as configured cannot function. This is live, not a static rule (it recalculates as gems/levels/mana change).

**What we do:** a user can add five gems to a skill card, socket a two-handed-only weapon in an off-hand slot, or stack more reserved auras than they have spirit/mana for, and Project Vaal will save it without comment.

**Cost to our user:** invalid builds look identical to valid ones in our UI. A player only discovers the problem in-game, at which point the plan they built was wrong from the start and gave them false confidence.

### 3. Items carry rarity, affixes, rolls, and tiers; ours is base-item-only.

**What they do:** poeplanner's item editor (base: Sorcerer Boots) exposes influence (Shaper/Elder-class modifiers), a quality slider, a base-variance slider, and an "Explicits" affix picker where each candidate mod shows its craft-source tag (Essence/Warbands-only/etc.), affix family name, semantic tags for search, a tier slider, and an exact numeric roll value you can dial in (we set "60% chance to Avoid being Frozen" via the tier slider and a `60` value field). This is full item authoring, not base selection.

**What we do:** per `2026-09-20-gear-design.md`, gear is `{ slug, name, category, isUnique, iconUrl }` — a base item and nothing else. Mods/affixes/rolls are explicitly deferred ("A planner describes which item, not which rolls. Large scope, no dependency on this work").

**Cost to our user:** this is a known, already-scoped-out gap (the gear-design doc calls it out as deferred), so it isn't news — but it is the single largest expressive gap versus every competitor tested, including the read-only pobb.in viewer, which still displays real rolled items. A user who wants to record *which specific ring* (not just "a ring") has nowhere to put that information today.

### 4. Gem level and quality are load-bearing numbers there; we don't record them at all.

**What they do:** poeplanner's link-group rows carry explicit Level and Quality number inputs per gem, and they are not cosmetic — the Precision aura's reservation cost (the `186` badge, and the resulting mana math) changes with its level. Maxroll's guide explicitly instructs "constantly upgrade and quality your gems... this substantially increases the damage," and calls out specific gem levels by name ("Time of Need and Overwhelming Presence are level 8 gems"). pobb.in's author notes do the same.

**What we do:** per the build flow description, gems are "a skill plus up to 5 supports" with no level/quality fields anywhere in the gem card model.

**Cost to our user:** a build recorded in Project Vaal can't distinguish "I have this skill at gem level 1" from "gem level 20, 20% quality" — which the rest of the PoE ecosystem treats as a first-order variable, not a nice-to-have. A shared build gives no signal of how far along it actually is.

### 5. A "build" there is a leveling journey with multiple checkpoints; ours is one static endpoint.

**What they do:** the pobb.in build we opened stores **8 named, leveled checkpoints** ("Nivel 31 – Empezamos con Balista" through "Nivel 94"), each a full gear + gem + tree snapshot, browsable via a Loadout dropdown. Maxroll's guide structures the same idea as explicit build-progression stages (Early → Hybrid → Hybrid Crit → CI), each gated on "are you geared enough to make this swap," with a distinct passive tree and gear list per stage.

**What we do:** one tree state, one gear state, one gem state per build — no notion of "this is what the build looks like at level 40 vs level 90."

**Cost to our user:** a build that is genuinely different at level 40 (survival-focused, whatever gear you can find) versus level 90 (min-maxed) has to be saved as separate, disconnected builds in Project Vaal, losing the "this is one character's journey" framing that both competitors treat as central.

### 6. Import/export is a first-class, multi-format feature there; we have none.

**What they do:** poeplanner's Import/Export tab lists four import paths (official PoE account by account name, a URL, a "minified code," a Path of Building pastebin URL) and three export formats (a poeplanner share link, an official PoE tree-only URL, and a JSON blob explicitly documented as being for third-party tools to consume). Maxroll's planner supports native GGG build-file import/export plus PoB import. pobb.in exists *only* as a thin reader over the PoB code format, with "Web" and "Open" (`pob2://`) deep links out to real editors. The entire competitive PoE ecosystem treats a portable, opaque build code as the unit of exchange.

**What we do:** builds are database rows accessed through our own save/share flow; there is no code format a user could paste in from — or export out to — anything else.

**Cost to our user:** a player who already has a build from Maxroll, PoB, or a friend's pobb.in link cannot bring it into Project Vaal at all; they'd have to rebuild it by hand, slot by slot, gem by gem. Conversely nothing built in Project Vaal can be pasted into a Discord or a guide comment the way a PoB code can.

### 7. Guidance is an authored layer there; we have zero editorial content.

**What they do:** Maxroll's build guide is not just a build state — it's Stat Priorities (ranked lists of what to chase, offensive and defensive, separately), a Skill Rotation section (exact button-press order for clear vs. single-target), an Ascendancy explainer, an FAQ ("How do I solve mana?", "What Waystone Modifiers should I avoid?"), a Summary, and a dated Changelog tracking balance-patch history. Mobalytics' Tier List ranks every ascendancy S–D with named-creator commentary explaining *why*. pobb.in's community build we read carried the same thing in miniature: free-text Notes with per-slot advice and quest-reward choices.

**What we do:** Project Vaal has no notes/priorities/rotation/FAQ field anywhere in the build model — a saved build is tree + gear + gems + name/level/league, full stop.

**Cost to our user:** a new player with no build of their own has nowhere to go inside Project Vaal to find "what should I even build" or "why does this build work" — that entire discovery-and-explanation layer doesn't exist in the product today, only the planning surface for a build someone already knows they want.

### 8. Config affects the numbers — level bands and story-progress resistance penalty are modeled inputs.

**What they do:** poeplanner's Config tab has a Level field and a three-position resistance-penalty toggle (0% / -30% / -60%) that mirrors PoE's own act-progression resistance penalty, plus Max Life/Mana override fields — all of which feed the Stats tab's live numbers.

**What we do:** level is metadata on the save panel; it does not affect any computed value, because nothing is computed.

**Cost to our user:** a build that "works" at our tool's numbers-free level of abstraction may be resistance-negative for the first three acts and there is no way to see that from inside Project Vaal.

## What we do that they do not

- **Gear-slot search is server-backed and fast per the current design** (`GET /api/wiki/items`, ~5KB per filtered response) — none of the sites observed described their own data-loading cost, but Maxroll's picker ships the desktop two-pane browser wholesale, and poeplanner's "Build Items" panel searches only items you've already created, not a live catalog search.
- **A single coherent gem-card model** (skill + up to 5 supports + weapon-set tag + "Main skill" toggle, one card per skill) is tidier than poeplanner's free-floating "Link Groups" abstraction, which has to be separately assigned to a gear slot via a dropdown — our model ties the gem card directly to a slot from the start.
- **A validated, closed slot→category mapping** (the 17-slot model, with the `Talisman`/`Focii`/`UtilityFlask` traps already caught and fixed) is more correct for PoE2 specifically than any competitor tested — Maxroll and poeplanner's category systems were both built for or ported from PoE1 and carry PoE1-era category assumptions that don't map cleanly onto PoE2's item classes.

## Explicitly out of scope

Per the task brief, the following were observed but are **not** reported as gaps or findings — they are settled product decisions, not open questions:

- Project Vaal being mobile-first vs. competitors being desktop-first, or any mobile-reflow behavior (covered exhaustively by the 2026-09-20 recon).
- Ads, autoplaying video, or banner placement on any competitor site, or our lack of them.
- Our sharing model (sign-in-gated shares; `public`/`private`/`unlisted` semantics) — even though every competitor's import/export story is a genuine gap (Finding 6), the *mechanism* of how Project Vaal shares a build internally is out of scope.
- The passive tree being a WebGL canvas with no per-node DOM.
- Our gear/gem pickers being full-width single-column search-first sheets rather than two-pane desktop-style browsers.
- Any use, non-use, or theming implications of GGG artwork.

## Open questions for the human

- **Stat calculation is the largest single gap found across every competitor and every finding above ultimately routes back to it** (validation, resistance-penalty modeling, mana/spirit reservation math all depend on having a stat engine at all). The 2026-09-20 recon already flagged this as an open scoping question; this report adds concrete evidence for how central it is to the *rest* of the competitive feature set — reservation validation (Finding 2) and act-resistance-penalty modeling (Finding 8) are both downstream of it, not separable features. Worth deciding whether even a minimal version (life/resistances/attributes from tree+gear, no DPS) is worth scoping before more gear/gem depth is added on top of an otherwise numbers-free model.
- **Do we want any leveling-checkpoint or build-progression concept** (Finding 5), given it's core to how both Maxroll and pobb.in structure a "build" as a journey rather than a snapshot? This interacts with the existing gear/gem/tree save model non-trivially — likely a separate scoping pass, not a small addition.
- **Is a portable import/export code (Finding 6) still worth doing**, and if so, at what fidelity — our own format only, or actual PoB/GGG-export compatibility? The 2026-09-20 recon raised this as an open question already; this report's finding is that it is *the* mechanism this entire competitive space organizes around, which raises the stakes on that decision either way.
- **Is any authored-guidance layer (Finding 7) in scope at all**, even a minimal one (a single free-text notes field per build)? Right now Project Vaal has no place for the "why" of a build, which every competitor treats as inseparable from the plan itself.
- Gem level/quality (Finding 4) and item affixes/rolls (Finding 3) are both already-known deferrals per the gear-design doc; this report doesn't reopen that decision, just confirms via direct observation how much weight the rest of the ecosystem puts on both.

---

This file was written but **not committed** — it is an untracked file in the working tree. The controller should review and commit it.
