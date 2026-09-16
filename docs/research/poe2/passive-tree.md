# PoE2 Passive Skill Tree — Research Reference

## Last updated

2026-09-16. Reflects Path of Exile 2 patch **0.5.5** ("Return of the Ancients" cycle, Trial of Chaos rework shipped 2026-09-04). PoE2 is still in early access/beta at this point (pre-1.0); community sources report a planned 1.0 release around **2026-12-11** adding the Duelist class and Sword weapons — treat that date as unconfirmed secondary-source info, not an official GGG announcement verified here.

Primary evidence for the structural/format sections below is the **official GGG data export** at `github.com/grindinggear/poe2-skilltree-export`, cloned and inspected directly for this research (see Sources). At time of writing its `data.json` is tagged `0.5.5`, i.e. current with live. This is the same *kind* of data Project Vaal already stores under `public/data/tree/<version>/`.

---

## 1. Overview / TL;DR

- PoE2's passive tree is one large shared web (not per-class trees). Every class starts at a different point on the same graph and can theoretically path anywhere on it.
- Community-reported total size: **~1,500–1,800 nodes** visible/reachable in typical descriptions. The current official export's raw node table is larger (**5,153 entries including root**) because it also embeds every ascendancy sub-tree (23 ascendancies) and every legacy/unused class's nodes in one file — a given character only ever sees the main tree plus their own single ascendancy's nodes.
- Structurally it is a direct descendant of PoE1's tree engine: same group/orbit/angle node-placement math, same `isNotable`/`isKeystone` node-flag vocabulary, same internal class names (Marauder, Duelist, Shadow, Templar survive in the data as legacy identifiers).
- Key differences from PoE1: gold-cost respec instead of Orb of Regret items; no evidence of Cluster Jewels or Abyss Jewels in the current export (only fixed tree-socketed jewels); a much smaller, curated keystone list (33 vs. PoE1's ~50+); attribute nodes are generic ("+5 to any Attribute", player-assigned) rather than fixed per node in most cases; ascendancy sub-trees are bigger/more elaborate relative to the main tree than in PoE1.

---

## 2. Tree structure & size

| Metric (from official 0.5.5 export) | Value |
|---|---|
| Total node entries in `nodes` (incl. root, all classes' ascendancies) | 5,153 |
| Total edges (connections) | 6,076 |
| Total groups (physical node clusters/orbit centers) | 1,623 |
| Notable nodes (`isNotable`) | 1,192 |
| Keystones (`isKeystone`) | 33 |
| Jewel sockets (`isJewelSocket`) flagged on main tree | 19 (top-level `jewelSlots` list has 31 IDs — see §6 caveat) |
| Ascendancy-start nodes (`isAscendancyStart`) | 36 (across all ascendancies incl. unreleased) |
| Generic attribute nodes (`isGenericAttribute`, "+5 to any Attribute") | 293 |
| "Mastery" nodes (`isMastery`) | 368 |
| Playable base classes defined | 12 total identifiers; 8 currently active in-game |
| Bounding box | x: -22,597 to 21,814; y: -18,720 to 20,053 (arbitrary game-engine units) |

**Layout shape**: circular/radial, same as PoE1 — small passives sit on concentric "orbits" around group centers, notables and keystones are placed as larger nodes off the main paths, and the whole graph radiates outward from a conceptual center with each class's starting region roughly 60° apart around the wheel (6 physical corners, since each corner is now shared by up to 2 real classes — see §3).

**PoE2 vs PoE1 differences** (as commonly reported and corroborated by the data):
- PoE2's tree is smaller and less bloated than PoE1's ~1,500-node, heavily-pathing-focused wheel — PoE2 favors denser stat clusters and fewer "filler" travel nodes per community consensus, though both trees are similar order of magnitude in size.
- PoE1's `+10/+20/+30 to Attribute` small nodes are largely replaced in PoE2 by generic "+5 to any Attribute" nodes the player assigns on allocation.
- PoE2 dropped the separate Ascendancy "trial-room" 2D minigame from PoE1's Labyrinth model, replacing it with a rotating set of instanced Trials (Sekhemas, Chaos, and — per 0.5's Delirium rework — Madness). See §5.
- No confirmed Cluster Jewels, Abyss Jewels, or Timeless Jewels in the current data — PoE2's jewel system (so far) is limited to fixed tree jewel sockets taking normal/special jewels (§6).

---

## 3. Node types

| Node type | Data flag | Count | Mechanic |
|---|---|---|---|
| Small passive | (no special flag) | ~3,200 | Minor stat bonus (e.g. "+8% Fire Resistance", "20% increased Fire Damage"). The pathing filler of the tree. |
| Notable | `isNotable: true` | 1,192 | Significant, often build-defining bonus (unique named effects, sometimes grants an active/triggered skill via "Grants Skill: X"). Worth deliberate routing. |
| Keystone | `isKeystone: true` | 33 | Build-warping mechanic swap with a major upside and a major built-in drawback. Full list in §7. |
| Jewel socket | `isJewelSocket: true` | 19 (main tree) + ascendancy-specific sockets | Empty node that accepts a jewel item, which then grants its own modifiers, and for radius-based jewels affects nearby nodes. See §6. |
| Ascendancy node | `ascendancyId` present | varies per class | Only reachable after unlocking that Ascendancy; separate resource pool (Ascendancy Points, not tree passive points). |
| Ascendancy-start node | `isAscendancyStart: true` | 36 | The single entry node into an ascendancy's sub-tree; unlocked by trial completion, always free to allocate once unlocked. |
| Attribute node | `isGenericAttribute: true` | 293 | "+5 to any Attribute" — player picks Str/Dex/Int on allocation rather than the node having a fixed stat. Internal names like `strength48`/`attributes70` are leftover from a fixed-attribute era; actual effect is generic per `skillOverrides`/`overridePairs` remapping (see §9). |
| Mastery node | `isMastery: true` | 368 | Hub nodes tagged by theme (e.g. "Bow Mastery", "Fire Mastery", "Minion Mastery") with their own background art (`assets/mastery-effect-*.json`). In the current export these carry **no stats of their own** (`stats: []`) — they read as tree-routing/visual hub nodes rather than PoE1-style "pick one of several effects" masteries. A few (e.g. Oracle's Bow Mastery) carry an `unlockConstraint` tying them to a specific ascendancy notable (see Oracle's "The Unseen Path" in §4/§9) — this looks like the mechanism for the Oracle's "walk paths not taken" ability to reach normally-unreachable mastery clusters. |
| Multiple-choice node group | `isMultipleChoice` (parent) / `isMultipleChoiceOption` (children) | 5 parent groups, 15 options | Mutually-exclusive alternate notables (e.g. Ranger's "Point Blank" vs. "Far Shot"), grouped under one parent selector node. |
| Free/grant node | `isFree: true` | 3 found (all ascendancy notables) | Notable granted without spending a point once its prerequisite is met — currently only 3 exist, all specific ascendancy payoff nodes (Warrior's Smith's Masterwork, Witch's Sanguimancy, Huntress's Sacred Unity). |
| Root node | `id: "root"`, `group: 0` | 1 | Virtual node with no stats; its `out` edges are the 6 physical entry points into the tree (one per attribute-corner region), not one per class. |

---

## 4. Character classes & starting locations

PoE2 currently ships **8 playable base classes**. The tree itself is built around **6 physical "corner" starting regions** — one per attribute archetype — and since 0.5 each corner has come to host **up to 2 real classes** sharing (or sitting immediately adjacent to) the same start point, distinguished by small early pathing differences. The tree JSON still carries the original PoE1 6-class names (Marauder, Duelist, Ranger, Shadow, Witch, Templar) as internal/legacy identifiers; some of those legacy slots are currently unused placeholders.

| Attribute corner | Base STR/DEX/INT | Legacy internal class (from JSON) | Active PoE2 class(es) at this corner |
|---|---|---|---|
| Pure Strength | 15/7/7 | Marauder (unused) | **Warrior** |
| Pure Dexterity | 7/15/7 | Ranger | **Ranger**, **Huntress** |
| Pure Intelligence | 7/7/15 | Witch | **Witch**, **Sorceress** |
| Str/Dex hybrid | 11/11/7 | Duelist (unused) | **Mercenary** |
| Dex/Int hybrid | 7/11/11 | Shadow (unused) | **Monk** |
| Str/Int hybrid | 11/7/11 | Templar (unused) | **Druid** |

Notes:
- Root node's 6 `out` edges connect to internal nodes literally named `marauder594`, `ranger596`, `duelist597`, `templar598`, `witch595`, and a sixth (`six704`) covering the Dex/Int corner — confirming the 6-corner layout is a structural constant regardless of which real class occupies it.
- The unused Marauder/Duelist/Shadow/Templar corners retain full base-attribute definitions and (empty) `ascendancies: []` arrays in the live data — consistent with them being reserved for future classes (community sources report the Duelist, wielding Swords, is planned for the 1.0 release, which would logically fill the Str/Dex corner currently also used by Mercenary, or a still-different one).
- Ranger and Huntress (both pure-Dex) and Witch and Sorceress (both pure-Int) do not share one literal start node — each class has its own distinct starting node placed near that corner's shared attribute cluster, per the standard "2 classes per Attribute" community description.

---

## 5. Ascendancy classes

Unlike PoE1's single Ascendancy pool with a Labyrinth-based unlock, PoE2 assigns exactly **3 ascendancy class choices per base class** (2 currently live for the newer Druid), chosen once and permanent for that character (no re-picking a different ascendancy on the same character).

### Full current list (0.5.5 export, includes unreleased placeholders)

| Base class | Ascendancy 1 | Ascendancy 2 | Ascendancy 3 |
|---|---|---|---|
| Witch | Infernalist | Blood Mage | Lich *(+ "Abyssal Lich" sub-variant, `Witch3b`)* |
| Ranger | Deadeye | *(unreleased — internal `Ranger2`)* | Pathfinder |
| Warrior | Titan | Warbringer | Smith of Kitava |
| Sorceress | Stormweaver | Chronomancer | Disciple of Varashta |
| Huntress | Amazon | Spirit Walker | Ritualist |
| Mercenary | Tactician | Witchhunter | Gemling Legionnaire |
| Monk | Martial Artist | Invoker | Acolyte of Chayula |
| Druid | Oracle | Shaman | *(unreleased — internal `Druid3`)* |

Totals: **23 named, live ascendancy classes** (community trackers cite 22 as of patch 0.5.4b; the `Witch3b` "Abyssal Lich" variant appears to be the +1 that brings it to 23 in 0.5.5) plus 2 unreleased placeholders (`Ranger2`, `Druid3`).

Flavor text (from the export, useful for in-app copy/attribution — do not reuse GGG's actual art per project policy, text quoted here for research only):
- **Titan** (Warrior): "Incredible might has always laid buried within you. Now is the time to rise."
- **Warbringer** (Warrior): "Your home has been threatened. A good man must be roused to war."
- **Smith of Kitava** (Warrior): "You hunger for power, and by force of arms, you will take it."
- **Stormweaver** (Sorceress): "The rumble of thunder heralds your approach. Woe to those that draw your ire."
- **Chronomancer** (Sorceress): "The tapestry of time is yours to weave; an element you alone may master."
- **Disciple of Varashta** (Sorceress): "By your command, they will earn redemption... one duty at a time."
- **Infernalist** (Witch): "You seek power at any cost... and there is no price too high to pay."
- **Blood Mage** (Witch): "Your search for power took you on a journey inwards."
- **Lich** (Witch): "Death is your domain, your flesh merely a material to be mastered."
- **Abyssal Lich** (Witch): "The Well of Souls is yours to command."
- **Deadeye** (Ranger): "A woman can change the world with a single well-placed arrow."
- **Pathfinder** (Ranger): "There are venoms and virtues aplenty in the wilds, if you know where to look."
- **Amazon** (Huntress): "You became a weapon of war so that others could live in peace."
- **Spirit Walker** (Huntress): "You were chosen by the Sacred Wisps to enact the Spirit's will."
- **Ritualist** (Huntress): "Corruption cost you your home, but taught you so much more..."
- **Tactician** (Mercenary): "Countless wars have left you with skills somewhat resembling a decent officer..."
- **Witchhunter** (Mercenary): "There's something very wrong with this world... and you're going to fix it."
- **Gemling Legionnaire** (Mercenary): "The more you embrace virtue gems, the more power they offer..."
- **Martial Artist** (Monk): "They made you a human weapon... but that strength has set you free." *(new in 0.5 "Return of the Ancients"; synergizes with unarmed builds via a Stonefist-style ascendancy node)*
- **Invoker** (Monk): "True strength lies within. One must only focus... and believe."
- **Acolyte of Chayula** (Monk): "The truth of your faith threatens to break your very soul... but in that struggle..."
- **Oracle** (Druid): "There are many paths to achieve your goals... and you see them all." — mechanically themed around prediction/misdirection; its "The Unseen Path" notable ("Walk the Paths Not Taken") is tied via `unlockConstraint` to unlocking otherwise-unreachable Mastery node clusters elsewhere on the tree.
- **Shaman** (Druid): "Wraeclast has suffered for too long. You are vengeance incarnate." — channels Rage into empowered Meteor/Lightning/Ice spellcasting, turning the Druid into a "walking natural disaster."

### Ascendancy points & trials (Trials of Ascendancy)

- Ascendancy passive points are a **separate pool from regular passive points** — spent only inside your ascendancy's sub-tree.
- Maximum **8 Ascendancy Points**, granted in **4 pairs of 2**.
- **Trial of Sekhemas** (unlocks in Act 2, after defeating Balbala in Traitor's Passage): an Honour-based roguelike gauntlet — losing all Honour fails the run. First completion unlocks your Ascendancy Class choice + first 2 points; a second completion grants points 3–4.
- **Trial of Chaos** (unlocks in Act 3, after defeating Xyclucian in the Chimeral Wetlands): a wave-based arena trial — clear rooms of enemies, choose "afflictions" (buffs/curses) between rooms. Grants the remaining Ascendancy Points (typically the 3rd/4th pair). Received its biggest overhaul to date in **patch 0.5.5** (2026-09-04), reworking pacing/reward-scumming issues community had flagged.
- **Trial of Madness**: introduced alongside the Delirium rework (not one of the two core Ascendancy trials) — a higher-risk optional trial where the player locks in permanent "tribulations" (debuff-like modifiers) chosen before each room, for greater reward.
- Recommended order per community guides: Sekhemas first in Act 2 (fastest to unlock the class + first points), then Chaos in Act 3 for the remaining points.

---

## 6. Jewels & jewel sockets

- **Jewel sockets on the tree**: 19 nodes flagged `isJewelSocket` on the shared/main tree in the current export, plus additional ascendancy-specific sockets (e.g. Witch's Lich notable "Crystalline Phylactery" is itself a jewel socket; a themed cluster of 5 "**Sinister Jewel Socket**" nodes — internal IDs `voices_jewel_slot1‑5` — exists, likely tied to a specific unique/league mechanic ("Voices")).
- The top-level `jewelSlots` array in the export lists **31 node IDs** total — 12 of those IDs do **not** currently resolve to any node in the `nodes` table. **Implementation caveat for Project Vaal**: any tree-JSON consumer must treat `jewelSlots` entries defensively — a listed ID may reference a removed/legacy node from an earlier patch and should be filtered against the live `nodes` map rather than assumed to exist.
- **Jewel types found/inferable**: base jewels socket directly into these tree sockets and grant flat/conditional modifiers; some are **radius jewels** (their effect only applies to nodes within a certain radius of the socket — evidenced by the `jewel-radius.json` sprite atlas defining radius-circle overlays per jewel type, e.g. `jewelRadius:VaalJewelCircle1/2`, `jewelRadius:TemplarJewelCircle1/2`, and ascendancy-specific radii like `jewelRadius:DruidOracleAscendancy1/2`).
- **No evidence of Cluster Jewels or Abyss Jewels** (PoE1 concepts) in the current PoE2 export — no "outermost socket" cluster-jewel node-injection mechanism, no abyssal socket variant flags. Community guides as of 0.5.5 do not describe either mechanic being in PoE2. Treat PoE2's jewel system as flatter/simpler than PoE1's for now — subject to change as the game approaches 1.0.
- Jewel art assets referenced: `assets/jewel.webp`/`jewel.json` (jewel icon atlas) and `assets/jewel-radius.webp`/`jewel-radius.json` (radius overlay atlas) in the official export repo.

---

## 7. Keystones (all 33, current 0.5.5 data — exact in-game text)

| Keystone | Effect |
|---|---|
| Avatar of Fire | 75% of Damage Converted to Fire Damage; deal no non-Fire Damage |
| Blood Magic | You have no Mana; Skill Mana Costs convert to Life Costs |
| Primal Hunger | 100% more Maximum Rage; regenerate 1 Rage/sec per 4 Rage spent recently; no Rage effect (i.e. Rage stops boosting damage) |
| Lord of the Wilds | Can equip a non-Unique Sceptre while wielding a Talisman; 50% less Spirit; non-Minion Skills have 50% less Reservation Efficiency |
| Zealot's Oath | Excess Life Recovery from Regeneration applies to Energy Shield instead; Energy Shield does not Recharge |
| Pain Attunement | 30% less Critical Damage Bonus on Full Life; 30% more Critical Damage Bonus on Low Life |
| Giant's Blood | Can wield Two-Handed Axes/Maces/Swords in one hand; triples Attribute requirements of Martial Weapons; inherent Life granted by Strength is halved |
| Resolute Technique | Accuracy Rating doubled; never deal Critical Hits |
| Ancestral Bond | Totem Limit doubled; no Charge requirement to place Totems; Totems reserve 75 Spirit each |
| Mind Over Matter | All Damage taken from Mana before Life; 50% less Mana Recovery Rate |
| Scarred Faith | 5% of Physical Damage prevented recouped as Energy Shield per enemy Power; ES does not Recharge; cannot recover ES from Regeneration; cannot recover ES above Armour |
| Unwavering Stance | Cannot be Light Stunned; cannot Dodge Roll or Sprint |
| Bulwark | Dodge Roll cannot avoid Damage; take 30% less Damage from Hits while Dodge Rolling |
| Elemental Equilibrium | Creates Lightning Infusion Remnants instead of Fire, Cold instead of Lightning, Fire instead of Cold (cyclic elemental remnant-type swap) |
| Wildsurge Incantation | Storm and Plant Spells: 50% more damage, cost 50% less, 75% less duration |
| Necromantic Talisman | All bonuses from Equipped Amulet apply to your Minions instead of you |
| Vaal Pact | 50% more Life Leeched; leech Life 67% less quickly; cannot recover Life other than from Leech; Life Leech doesn't end when unreserved Life is filled |
| Blackflame Covenant | Fire Spells convert 100% of Fire Damage to Chaos Damage; that Chaos Damage still counts toward Flammability/Ignite magnitude; Ignite from Fire Spells deals Chaos instead of Fire |
| Iron Reflexes | Converts all Evasion Rating to Armour |
| Whispers of Doom | Can apply an additional Curse; doubles Curse activation delay |
| Ritual Cadence | Invocation Skills trigger Spells every 2 seconds instead of on cast; Invocation Skills can't gain Energy while triggering; invoked Spells consume 50% less Energy |
| Glancing Blows | Chance to Evade is Unlucky; chance to Deflect is Lucky |
| Eldritch Battery | Converts 100% of maximum Energy Shield to maximum Mana; Mana Costs doubled |
| Oasis | Cannot use Charms; 30% more Recovery from Flasks |
| Crimson Assault | Bleeding you inflict is Aggravated; base Bleed duration is 1 second; 50% more Magnitude of Bleeding inflicted |
| Conduit | If you'd gain a Charge, Allies in your Presence gain that Charge instead of you |
| Resonance | Gain Power Charges instead of Frenzy Charges; Frenzy instead of Endurance; Endurance instead of Power (cyclic charge-type swap) |
| Chaos Inoculation | Maximum Life is 1; immune to Chaos Damage and Bleeding |
| Hollow Palm Technique | Can Attack as though using a Quarterstaff with both hands empty; unarmed attacks use Quarterstaff-slot damage scaling, with Attack Speed/Crit Chance scaling off equipped armor's Evasion/Energy Shield |
| Heartstopper | Take 50% less Damage over Time if you started taking DoT in the past second; take 50% more DoT damage if you haven't |
| Eternal Youth | Life Recharges instead of Energy Shield Recharging; 50% less Life Recovery from Flasks |
| Dance with Death | 25% more Skill Speed while off-hand is empty and a One-Handed Martial Weapon is equipped in main hand |
| Trusted Kinship | Can have two Companions of different types; 30% more Reservation Efficiency of Companion Skills; 20% less Reservation Efficiency of non-Companion Skills *(added with the Companion system in patch 0.5 "Return of the Ancients")* |

---

## 8. Respec mechanics

- PoE2 **does not use an Orb of Regret** item like PoE1. Respeccing is handled through an NPC (referred to in guides as "the Hooded One") who refunds passive points **for a Gold cost**.
- Cost scales with **how deep/expensive the point is** and with character progression — later-game, higher-tier passives cost more Gold to refund than early cheap ones.
- Net effect vs. PoE1: substantially cheaper and friction-free for small adjustments; large wholesale respecs late-game can still add up but are reported as far less punishing than PoE1's regret-orb economy ever was.
- No confirmed hard cap on number of respecs — it's a repeatable gold sink, not a consumable-item gate.

---

## 9. The tree export JSON format (directly relevant to Project Vaal's data pipeline)

Source of truth: **`github.com/grindinggear/poe2-skilltree-export`** (official GGG repo, referenced from `pathofexile.com/developer/docs`). Top-level file is `data.json`; supporting sprite atlases live in `assets/`. This is a close cousin of PoE1's `grindinggear/skilltree-export` format (same node/group/orbit vocabulary), not a clean-room redesign.

### `data.json` top-level keys

```
tree            string   — tree name, e.g. "Default"
classes         array    — 12 class definitions (see below)
groups          object   — keyed by group-id string, physical node clusters
nodes           object   — keyed by node-id string, ALL nodes (main tree + every ascendancy + root)
edges           array    — flat list of all connections (see Edge Indexing below)
skillOverrides  object   — keyed by node-id string, alternate stat/name/icon definitions for generic nodes
jewelSlots      array    — node IDs that are jewel sockets (superset of `isJewelSocket`-flagged nodes; may include stale/removed IDs — filter defensively)
min_x/min_y/max_x/max_y  int — bounding box of the whole graph in engine units
```

### `classes[]` entries

```jsonc
{
  "name": "Witch",                 // internal class name — NOT always the display name (Marauder == Warrior's internal id, etc.)
  "base_str": 7, "base_dex": 7, "base_int": 15,
  "image": "Art/2DArt/BaseClassIllustrations/WitchBaseIllustration.png",
  "image_offset_x": 0, "image_offset_y": 0,
  "overridePairs": { "4739": 17306, ... },   // maps generic-attribute node IDs to a class-specific override node ID (mirrors/re-skins symmetric nodes per class)
  "ascendancies": [
    {
      "id": "Witch1", "name": "Infernalist",
      "image": "...InfernalistAscendancy.png",
      "offsetX": -5.8e-5, "offsetY": 1332,
      "flavourText": "...", "flavourTextColour": "ffa57e",
      "flavourTextSize": 135,
      "flavourTextRect": { "x": 0, "y": 400, "width": 1000, "height": 500 },
      "overridePairs": []
    }, ...
  ]
}
```
Unreleased ascendancy slots appear with `"name": null` (e.g. Ranger's 2nd slot, Druid's 3rd).

### `nodes{}` entries (per node)

Common fields observed:
```
id                 string|null  — stable slug identifier, e.g. "AscendancyDruid1Start"; null on some legacy/placeholder nodes
skill              int          — numeric skill id (matches the dict key)
name               string       — display name ("" for placeholder/legacy nodes)
icon               string       — game asset path, cross-referenced into the sprite atlases in assets/
ascendancyId       string?      — set only on ascendancy-subtree nodes, e.g. "Druid1", "Witch3"
stats              string[]     — human-readable effect lines with [Tag|Display] markup for in-client keyword linking
group              int          — index into top-level `groups`
orbit              int          — which concentric ring within the group
orbitIndex         int          — position within that orbit's angle slots
x, y               float        — precomputed absolute canvas coordinates (engine units)
out / in           string[]     — adjacent node IDs (outgoing/incoming) — the tree graph is stored as directed adjacency lists per node AND
edges              int[]        — indices into the top-level `edges` array corresponding 1:1 with combined out+in connections
isNotable / isKeystone / isJewelSocket / isGenericAttribute / isAscendancyStart /
isMastery / isMultipleChoice / isMultipleChoiceOption / isFree / hideConnection / isBlighted  — boolean flags (only present/true when applicable; absent = false)
unlockConstraint   object?      — { "nodes": [id...], "ascendancy": "Druid1" } — gates a node's usability on another node/ascendancy being allocated
activeEffectImage  string?      — mastery-specific background art key
```

The **root** node (`nodes["root"]`) has `group: 0, orbit: 0`, empty `stats`, and its `out` array is exactly the 6 corner entry-point node IDs — this is the practical anchor for "where do the 6 starting regions begin" when walking the graph programmatically.

### `groups{}` entries

```jsonc
"1": { "x": -22597.4, "y": -2727.53, "orbits": [0], "nodes": ["42761"] }
```
A group is a physical cluster location; `orbits` lists which concentric rings are populated at that location, and `nodes` lists the member node IDs. Multi-orbit groups (e.g. a start node's home group) can host several rings' worth of nodes at once.

### `edges[]`

A flat, position-indexed array; each node's `edges` field stores integer indices into this array that correspond positionally to that node's `out`+`in` lists — i.e. this is a lookup optimization for edge-specific line-rendering data rather than a separate distinct-connection schema. (The full internal edge record schema wasn't fully characterized in this pass — worth a closer diff-check before building a renderer that depends on edge-specific attributes beyond simple connectivity.)

### `skillOverrides{}`

Keyed by node-id string; supplies an alternate node definition (different `name`, `icon`, `stats`, sometimes `grantedStrength`/`grantedDexterity`/`grantedIntelligence`) that replaces the generic version of that node in specific contexts (referenced via the `overridePairs` maps on `classes[]` and ascendancy entries). This is how PoE2 keeps one generic "+5 to any Attribute" node definition in the base graph while letting different classes/ascendancies present a fixed-stat or re-flavored variant of that same graph position without duplicating the whole node.

### Sprite atlases (`assets/`)

Standard TexturePacker-style JSON+WebP pairs:
- `skills.json` / `skills.webp` (+ `skills-disabled.*`) — passive icon atlas, keyed like `"normalActive:Art/2DArt/SkillIcons/passives/....png"` mapping to `{frame:{x,y,w,h}}` rects (34×34px per icon cell observed).
- `group-background.json` / `.webp` — big/small group ring backgrounds (`startNode:MainCircleActive`, etc.), 2000×2000 cells.
- `frame.json`, `line.json` — node frame and connector-line art.
- `jewel.json`, `jewel-radius.json` — jewel icon atlas and per-jewel-type radius-circle overlay atlas (keyed `jewelRadius:<Name>`, e.g. `VaalJewelCircle1/2`, `TemplarJewelCircle1/2`, `DruidOracleAscendancy1/2`).
- `mastery-effect-active.json` / `mastery-effect-disabled.json` — per-theme background art for Mastery hub nodes (Accuracy, Armour+ES, Armour+Evasion, Fire, etc.), 244×241px cells.
- `background*.json`/`.webp` — one pair per active class (`background-warrior`, `background-sorceress`, `background-huntress`, `background-monk`, `background-mercenary`, `background-druid`, `background-ranger`, `background-witch`) plus a generic `background.json` — full-tree backdrop art shown behind that class's start region.

This matches the layout Project Vaal already expects under `public/data/tree/<version>/` — the export's own versioning (this repo tags by patch, currently `0.5.5`) lines up with treating each GGG patch as its own immutable snapshot directory, consistent with the project's existing structure.

---

## 10. Console (PS5/Xbox) vs PC tree UI

PoE2 shipped with first-party controller support from early access, but community and press consensus is that the **passive tree remains one of the weakest controller experiences** in the game:

- Combat and movement feel well-tuned on controller; **menu-heavy screens (passive tree, inventory, stash, trading) are consistently reported as slower and more cumbersome than mouse+keyboard**.
- On PS5 specifically, the on-screen button legend in menus/shops is not always visible or remappable, so discovering the right button for an action (e.g. "drop item") is largely trial-and-error — the same class of problem extends to tree navigation affordances.
- Tooltip navigation via controller (reading a node's full stat text, comparing hovered vs. allocated nodes) is reported as harder to use than with a mouse, compounding the learning curve for understanding build interactions.
- Net community assessment: PoE2 "oversimplified" its controller HUD/menus relative to its PC depth, and the passive tree — being a dense, pannable, zoomable 2D graph with ~5,000 possible nodes across all classes — is exactly the kind of screen that benefits from cursor-precision interaction PC has and controller lacks.

This is the direct product rationale for Project Vaal's tree viewer: a web-based, mouse/touch-first (or keyboard-navigable) viewer lets console players plan, search, and reason about a build's passive allocation outside the constrained in-game controller UI, then reference/execute it live.

---

## 11. Recent balance/content patches touching the tree (leading up to Sept 2026)

| Patch | Date | Tree-relevant changes |
|---|---|---|
| 0.5 "Return of the Ancients" | 2026 (mid-year) | Introduced the Companion system and **19 new Companion-themed passive skills**; added the **Trusted Kinship** keystone; reworked several major keystones tree-wide; added **Martial Artist** (Monk) and **Spirit Walker** (Huntress) ascendancies. |
| 0.5.1 | 2026-06-05 | Iteration patch on Return of the Ancients — notable passive tuning pass (see below). |
| 0.5.2 "Runes of Aldur" | 2026-05-26 (export tag) | Data/asset-level update tracked in the official skilltree-export repo. |
| Convalescence (notable) rework | 0.5.x | Energy Shield recharge start bonus reduced 40%→20%; recharge-rate penalty reduced 15%→10%. |
| Adamant Recovery → Fortified Aegis | 0.5.x | Old notable replaced outright with a new one granting 100% increased Armour/Evasion/ES from an Equipped Shield. |
| Arcane Mixtures rework | 0.5.x | Changed from 25% increased ES Recharge Rate to 10% increased Cast Speed on recent Mana Flask use. |
| Ancestral Bond keystone change | 0.5.x | Now doubles Totem count limit instead of granting unlimited totems (each Totem still reserves 75 Spirit). |
| 0.5.4b | 2026 (pre-Sept) | Snapshot cited by community trackers at 8 classes / 22 ascendancies. |
| 0.5.5 | 2026-09-04 | Biggest **Trial of Chaos** overhaul to date (targeting pacing/exploit complaints); export data shows the **Witch's "Abyssal Lich" (`Witch3b`)** ascendancy variant present, likely the change that brought the ascendancy count from 22 to 23. |

Overall trend across 2026 patches: GGG has been iterating on notable/keystone power balance (nerfing/replacing overtuned Energy-Shield-recharge notables, adjusting Totem/Spirit keystone math) while continuing to add new ascendancies and passive content (Companion passives) rather than restructuring the tree's core shape.

---

## Sources

- https://github.com/grindinggear/poe2-skilltree-export — **official GGG PoE2 tree data export** (cloned and inspected directly: `data.json`, `README.md`, `assets/*.json` sprite atlases; tag/commit at time of research: `0.5.5`)
- https://github.com/grindinggear/skilltree-export — official GGG PoE1 tree export (for format-lineage comparison)
- https://www.pathofexile.com/developer/docs — referenced by the export repo's README as the authoritative format documentation pointer
- https://pathofexile2.wiki.fextralife.com/Passive+Skills — PoE2 Fextralife wiki, passive tree node types overview
- https://game8.co/games/Path-of-Exile-2/archives/605060 — Game8, 0.5.1 patch notes summary
- https://poe2hub.net/mechanics/passive-tree/ — PoE2 Hub, passive tree mechanics explainer
- https://poe2path.com/guides/poe2-passive-skill-tree-guide/ — PoE2Path navigation guide
- https://poe2ref.com/passive-tree — interactive PoE2 tree planner reference
- https://www.poe2vault.com/passives — PoE2 Vault, keystone/notable/ascendancy node overview
- https://expcarry.com/poe-2-passive-skill-tree-guide — respec/keystone guide (gold-based respec confirmation)
- https://www.switchbladegaming.com/path-of-exile-2/passive-tree-guide/ — priority-node guide for all starting classes
- https://www.aoeah.com/news/3679--poe-2-passive-skill-tree-keystones-locations--effects--path-of-exile-2-keystone-tier-list — keystone locations/effects and tier list
- https://maxroll.gg/poe2/resources/poe-2-passive-tree-and-dual-specialization — Maxroll, tree + weapon-set mechanics (title only surfaced via search; full page fetch was blocked in this research session)
- https://game8.co/games/Path-of-Exile-2/archives/487065 — Game8, passive tree size/list overview
- https://vulkk.com/2025/02/08/path-of-exile-2-passive-tree-guide/ — VULKK tree guide
- https://pathofexile2.games-wiki.wiki/guides/poe2-passive-tree/ — "Navigating 1,500+ Nodes" community wiki guide
- https://game8.co/games/Path-of-Exile-2/archives/485789 — Game8, classes & ascendancies list
- https://www.poe-vault.com/poe2/guides/classes-ascendancy-overview — PoE Vault classes/ascendancy overview
- https://mobalytics.gg/poe-2/guides/classes-breakdown — Mobalytics class breakdown
- https://poe2db.tw/us/ — PoE2DB (community database mirror of GGG data)
- https://timesaver.gg/tools/poe-2/ascendancy — interactive ascendancy explorer, cites patch 0.5.4b (8 classes/22 ascendancies)
- https://dving.net/guides/path-of-exile-2-guides/ascendancies-overview — ascendancy overview (12 total classes, 3 ascendancies each planned)
- https://www.mmoexp.com/News/poe-2-huntress-release-date-overview-skills-and-guide.html — Huntress class release (2025-04-04, "Dawn of the Hunt"/0.2.0)
- https://game8.co/games/Path-of-Exile-2/archives/489998 — Game8, Druid ascendancy guide
- https://deltiasgaming.com/path-of-exile-2-all-druid-ascendancies/ — Druid ascendancies (Shaman, Oracle)
- https://pathofexile2.com/druids — official Druid content-update page
- https://gamerant.com/path-of-exile-2-poe-all-druid-ascendancies-shaman-oracle-nodes/ — Druid ascendancy node breakdown
- https://www.rpgstash.com/blog/poe-2-druid-ascendancy-classes-explained — Druid ascendancy explainer (0.5.0)
- https://primagames.com/tips/how-to-respec-passive-skill-points-in-path-of-exile-2 — respec guide (Hooded One, gold cost)
- https://www.gamesradar.com/games/action-rpg/path-of-exile-2-respec/ — respec guide
- https://boostroom.com/blog/path-of-exile-2-respec-guide-how-to-refund-passive-points-and-fix-your-build — respec guide (gold vs. Orb of Regret comparison)
- https://maxroll.gg/poe2/getting-started/trials-of-ascendancy — Trials of Ascendancy guide
- https://poe2.stratlore.com/en/guides/ascendancy-points-trials-guide/ — 8-point trial breakdown
- https://boostmatch.gg/blog/poe-2/articles/poe2-trials-guide-patch-05-return-of-the-ancients — Trial of Madness / 0.5 trials guide
- https://www.dualshockers.com/path-of-exile-2-055-10-trial-of-chaos-changes-that-finally-fix-the-mode/ — 0.5.5 Trial of Chaos overhaul (2026-09-04)
- https://timesaver.gg/blog/poe2-trial-of-chaos-ascendancy-points-avoid-scam-0-5-5 — Trial of Chaos 0.5.5 changes
- https://pathofexile.fandom.com/wiki/Cluster_Jewel , https://pathofexile.fandom.com/wiki/Jewel , https://pathofexile.fandom.com/wiki/Abyss_Jewel — PoE1 jewel mechanics (for comparison baseline; PoE2 does not currently appear to have direct equivalents per the tree export)
- https://game8.co/games/Path-of-Exile-2/archives/489997 — Game8, jewel sockets explained
- https://www.firefallnew.com/2025/01/03/path-of-exile-2-jewel-sockets-explained/ — jewel sockets explainer
- https://www.mmorpg.com/editorials/80-hours-in-and-playing-path-of-exile-2-on-controller-may-not-be-the-right-call-2000133920 — controller UX critique (menus/tree slower than M+K)
- https://www.pathofexile.com/forum/view-thread/3588970 — official forum thread on controller passive-tree navigation (title/topic only; full content fetch blocked in this session)
- https://pathofexile2.wiki.fextralife.com/Controls — PoE2 controls reference (Keyboard & Controller)
- https://game8.co/games/Path-of-Exile-2/archives/494052 — Game8, full keystone list (cross-checked against the live export in §7)
- https://www.sportskeeda.com/mmo/path-exile-2-keystone-passives — keystone passives overview

**Note on research-session constraints**: several otherwise-authoritative sources (poewiki.net, poe2db.tw, maxroll.gg, game8.co, pathofexile.com, en.wikipedia.org) returned network-egress-blocked errors when fetched directly in this session; their content above is represented via WebSearch-engine summaries only, not full-page verification. The GitHub-hosted official GGG export was fully accessible and was used as the primary, authoritative source for all structural/format/keystone/ascendancy-list claims in this document. The 1.0-release-date and Duelist/Sword claims in the "Last updated" section rest solely on secondary aggregator summaries and should be re-verified before being treated as fact elsewhere in the project.
