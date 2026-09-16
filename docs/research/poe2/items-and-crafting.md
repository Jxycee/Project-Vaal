# Path of Exile 2 — Items, Affixes & Crafting Systems

## Last updated

2026-09-16. Reflects **Patch 0.5.5 "Forbidden Rites"** (event league live since 2026-09-04), running on top of the **0.5.0 "Return of the Ancients" / "Runes of Aldur"** crafting overhaul. PoE2 **1.0 full release is scheduled for 2026-12-11** (confirmed at Gamescom ONL, 2026-08-25); no 0.6.0 is planned — 0.5.5 and two short event leagues bridge directly to 1.0, preceded by ExileCon 2026 (Nov 7–8). Project Vaal's wiki data snapshot under `public/data/wiki/` is currently versioned `2026-08-25`, i.e. it predates 0.5.5's crafted-modifier changes below — flag this when cross-referencing extracted item/mod data.

Note on sourcing: official patch notes (pathofexile2.com) and the two main community wikis (poe2wiki.net, pathofexile2.wiki.fextralife.com) were unreachable from this research environment (network egress blocked those domains). Findings below are aggregated from search-engine summaries of multiple independent community sources (Maxroll, Mobalytics, GameRant, TheGamer, Game8, MMOJUGG, timesaver.gg, stratlore, poe-vault, etc.) that were cross-checked against each other. Anything not corroborated by at least two independent sources is explicitly flagged as unverified below. **Re-verify against pathofexile2.com patch notes and poe2wiki.net before treating any specific number as ground truth for shipped features.**

---

## 1. Item Rarity Tiers

| Rarity | Color | Affixes | Notes |
|---|---|---|---|
| Normal | White | 0 rolled affixes (implicit(s) only) | Base item, no prefixes/suffixes |
| Magic | Blue | Max **1 prefix + 1 suffix** (2 total) | Created via Orb of Transmutation; can drop naturally |
| Rare | Yellow | Max **3 prefixes + 3 suffixes** (6 total) | Created via Orb of Alchemy or Regal Orb path |
| Unique | Orange | Fixed (mostly) modifier pool, some with rolled ranges | Hand-designed items, some with build-around mechanics |

**PoE1 comparison:** the caps above (1/1 magic, 3/3 rare) are actually the *same* maximum caps PoE1 uses today. The real divergence community guides emphasize is in **default roll behavior and pacing**, not the hard cap:
- PoE2 crafting is generally described as more deliberate/slower — an Orb of Alchemy's guaranteed number of starting affixes and the removal of PoE1's Orb of Scouring from the currency pool push players toward targeted currency use (Exalted-orb "slamming" to fill remaining affix slots) rather than PoE1's chaos-spam bulk rerolling. **The exact guaranteed mod count that Orb of Alchemy currently rolls could not be confirmed from reachable sources this session — verify directly against patch notes/wiki before relying on an exact number.**
- PoE2's **Chaos Orb equivalent works differently in kind, not just degree** (see Currency table below) — it removes one mod and adds a new one in a single action, rather than PoE1's full non-guaranteed reroll of all mods. This is the single biggest affix-system behavioral change from PoE1.

## 2. Affix System

- **Prefix/Suffix convention:** prefixes skew offensive (damage, flat attributes, minion/ally effects, spell/attack speed, etc.); suffixes skew defensive/utility (resistances, life/mana, attack/cast speed varies by source, flask/charm effects, accuracy). This mirrors PoE1's convention.
- **Resistance cap consequence:** because rares cap at 3 suffixes, and most resistance mods are suffixes, a rare item can hold **at most 3 distinct resistance-type suffix rolls** — a deliberate design constraint to stop stacking every defensive suffix type on one item.
- **Item Level (ilvl) gating:** ilvl gates (a) *which* modifiers are eligible to roll on an item at all, and (b) the *maximum tier* of an eligible modifier that can roll. Higher ilvl unlocks access to higher (stronger) tiers; it does not itself guarantee they roll.
- **Modifier tiers:** each individual modifier (e.g., "+# to maximum Life" on Body Armour) has its own independent tier ladder, and the number of tiers varies **per stat, per item type** — e.g., Life on Body Armour reportedly has ~10 tiers while the same stat on Boots has only ~6. T1 is always the strongest/highest tier. Tooltips display something like `T1 · ilvl 81`, where the ilvl number is the *minimum item level* required for that tier to become eligible.
- **Quality** is a separate, additive stat (not a prefix/suffix): weapons gain increased physical damage, armour gains increased defences, flasks gain increased recovery, jewellery gains a modifier-family-scaled bonus (see Catalysts). Quality is raised via Blacksmith's Whetstone (weapons), Armourer's Scrap (armour), Glassblower's Bauble (flasks), and Catalysts (jewellery).

## 3. Base Item Types

### Weapons (attribute-aligned)
- **Strength weapons:** slow, heavy, high damage-per-hit (e.g., two-hand maces).
- **Dexterity weapons:** fast, lower damage-per-hit (e.g., bows, crossbows, daggers).
- **Intelligence weapons:** spellcasting-oriented, boost critical strike (wands, sceptres, staves, foci).
- **Hybrid weapons** combine two attributes (e.g., flails require Str+Int; daggers require Dex+Int).
- Known weapon categories: **one-hand/two-hand swords, one-hand/two-hand axes, one-hand/two-hand maces, spears, flails, quarterstaves, daggers, wands, sceptres, staves, bows, crossbows** (new to PoE2), and **foci** (caster off-hand).
- **Crossbows are a new PoE2 weapon class** (not present in PoE1) tied to the Mercenary/Witchhunter-style skill kit; **spears and flails are also new** additions to the melee weapon roster.

### Armour (attribute-aligned defensive layer)
Same three-attribute split as PoE1, unchanged in principle:
- **Strength (STR)** → **Armour** (flat physical damage mitigation).
- **Dexterity (DEX)** → **Evasion Rating** (chance to avoid attacks entirely).
- **Intelligence (INT)** → **Energy Shield** (a depletable shield layer in front of Life).
- Hybrid bases combine two of the three (e.g., Dex/Int gear grants both Evasion and Energy Shield).
- Armour slots: **Body Armour, Helmet, Gloves, Boots** (4 slots) — "Gauntlets" is not a distinct slot name; the slot is called Gloves.
- Off-hand slots: **Shield** (Str/Dex block-capable), **Focus** (Int caster off-hand, grants flat Energy Shield, no block), **Quiver** (bow-only, e.g. +1 arrow, projectile speed implicits).

### Accessories ("Jewellery")
- **Rings** (2 slots): often carry elemental-resistance implicits by gem color convention (Sapphire=Lightning, Topaz=Cold, Ruby=Fire — verify exact naming), plus wide prefix/suffix pool for damage/utility/resistance.
- **Amulets** (1 slot): commonly used to hit attribute thresholds needed for Support Gems (which require +5 of a specific attribute); carry wide modifier pool.
- **Belts** (1 slot): implicits plus modifiers; **primary functional role is housing Charm slots** — a belt's Charm-slot count directly gates how many Charms a character can equip beyond the default.

### Consumables: Flasks + Charms (major PoE1→PoE2 change)
PoE2 **replaced PoE1's 5-flask, mod-heavy flask belt** with a split system:
- **Flasks:** exactly **2 flask slots by default** — one **Life Flask**, one **Mana Flask** — down from PoE1's flexible 5-slot loadout. Flasks only restore their core resource; utility effects (PoE1's "utility flasks" like Quicksilver, Jade, etc.) do **not exist by name** in PoE2.
  - Flasks use a **charge economy**: each use consumes a fixed Charge cost; charges refill from **kills** (not from Mana/Life-flask specific mechanics as in PoE1's original design, though PoE1 later added kill-based charge gain too).
  - If a flask lacks enough charges, it cannot be activated.
  - **Flask Quality** (via Glassblower's Bauble) multiplicatively scales base recovery.
  - The **"Oasis"** unique/passive-node-like effect disables Charms entirely in exchange for +30% multiplicative Flask recovery — an explicit build-defining trade-off between the two systems.
- **Charms:** a **new, separate equipment category** introduced in PoE2 that absorbed PoE1's utility-flask role. **3 Charm slots by default** (expandable via belt mods).
  - Charms activate **automatically** on trigger conditions (e.g., Antidote Charm triggers on becoming Poisoned to grant Poison immunity), unlike flasks which are manually activated.
  - Charms also run on a charge economy (fixed max charges, fixed cost per activation, e.g. Antidote Charm: 80 max charges, 40 consumed per use, requires character level 24 to use).
  - Known Charm examples: **Antidote Charm** (Poison immunity on Poisoned), **Dousing Charm** (Ignite immunity on Ignited), **Grounding Charm** (Shock immunity on Shocked). Unique Charms also exist.

## 4. Crafting Currency — Full Reference

### Core upgrade/orb currency

| Currency | Effect |
|---|---|
| **Orb of Transmutation** | Normal item → Magic item |
| **Orb of Augmentation** | Adds one random modifier to a Magic item (fills toward the 1 prefix / 1 suffix cap) |
| **Orb of Alchemy** | Normal item → Rare item directly |
| **Regal Orb** | Magic item → Rare item; keeps existing modifiers and adds one new random modifier |
| **Chaos Orb (PoE2 version — changed from PoE1)** | Removes **one** random modifier from a Rare item and adds **one** new random modifier in the same action. This functionally merges PoE1's separate Orb of Annulment + Exalted Orb combo into a single deterministic-count operation. **This is the single largest behavioral change to the affix system vs. PoE1**, where Chaos Orb fully rerolled *all* modifiers on an item. |
| **Orb of Annulment** | Removes one random modifier from a Magic or Rare item (no replacement) |
| **Exalted Orb** | Adds one new random modifier to a Rare item (does not remove anything) — used to "slam" a rare up toward its 6-affix cap |
| **Divine Orb** | Rerolls the numeric **values** of all existing explicit modifiers on an item — does not change which modifiers are present, only their rolled numbers within each mod's existing range |
| **Orb of Chance** | Normal item → random rarity outcome, including a chance to become a specific Unique (item-base-dependent) |
| **Vaal Orb** | Corrupts an item (see Corruption, §6) — permanently ends further crafting on that item |
| **Mirror of Kalandra** | Highest-tier currency; creates a perfect (mirrored) untradeable copy of an item, confirmed to exist in PoE2's currency pool (exact PoE2 mechanics not independently re-verified this session — treat as consistent with PoE1's behavior pending confirmation) |

### Socket / gear-modification currency

| Currency | Effect |
|---|---|
| **Artificer's Orb** | Adds a **Rune Socket** to a Martial Weapon or Armour piece. Crafted from 10 **Artificer's Shards** (auto-combine), which drop from salvaging already-socketed gear at the Salvage Bench, world drops, boss drops, or the Currency Exchange. |
| **Jeweller's Orb / Greater Jeweller's Orb / Perfect Jeweller's Orb** | Changes the number of **support gem sockets** on a Skill Gem (distinct from Rune Sockets on gear — see §5). Skill gems start with 2 support sockets by default; Perfect Jeweller's Orb is the top of this upgrade chain (reportedly grants a 5th support socket). |
| **Blacksmith's Whetstone** | Adds Quality to weapons |
| **Armourer's Scrap** | Adds Quality to armour |
| **Glassblower's Bauble** | Adds Quality to flasks |
| **Catalysts** (multiple named types, e.g. Tempering, Turbulent, Imbued, etc.) | Add Quality to Jewellery (rings/amulets/belts), scaling a specific modifier family (Tempering→Defences [armour/evasion/ES], Turbulent→Elemental Damage, Imbued→relevant when a gem is socketed in an amulet). Quality from Catalysts caps at 20% and scales the item's matching **implicit** — wasted if the item has no implicit of that family. Applying a new Catalyst type replaces any existing Catalyst-quality type on the item. |
| **Fracturing Orb** | Locks one random existing modifier on an item permanently — the "fractured" mod becomes immune to any further removal/reroll by other currency. Sourced from cleansed Maps (from cleansing a Corrupted Nexus found while mapping). |

### Essences (guaranteed-modifier crafting)

- **19 Essence types**, each tied to a specific guaranteed modifier family (Life, Mana, Defences, Physical Damage, elemental damage types, resistance types, Attributes, Ally/Minion damage, Accuracy, Spell Damage, Attack Speed, Cast Speed, Critical Hit Chance, Item Rarity, a random Notable-equivalent effect, Socketed-item effect magnitude, etc. — exact 19-name list should be re-verified against poe2wiki.net before shipping to end users, as multiple community sources give slightly divergent naming).
- **4 tiers per Essence: Lesser → Normal → Greater → Perfect.** Tier governs the *magnitude* of the guaranteed modifier; essence *type* governs *which* modifier family it guarantees.
  - Lesser/Normal/Greater Essences: upgrade a Magic item to Rare and add one guaranteed fixed modifier of that essence's type.
  - **Perfect Essence:** used on an existing Rare item — removes one random modifier and replaces it with a stronger guaranteed modifier of that essence's type.
- **Corrupted Essences:** a special essence tier obtained by using a **Vaal Orb on a Perfect Essence** found while mapping — carries unique, more powerful crafting effects beyond the standard Perfect tier.
- Essences (and Liquid Emotions, Waystones, Runes, Soul Cores) can be **recycled 3-of-a-kind → 1 random item of the same category, one tier higher** at the Reforging Bench (see §5).

### Omens (single-use crafting modifiers)

Omens consume themselves on the *next* currency use to alter its behavior. Primarily farmed from completing **Ritual** encounters (0.5.5 changed the Ritual reward window so **every** reward is now a Unique or an Omen — a major buff to Omen farming efficiency). Confirmed examples:

| Omen | Effect |
|---|---|
| Omen of Sinistral Annulment | Next Orb of Annulment removes only a **prefix** |
| Omen of Dextral Annulment *(implied counterpart)* | Next Orb of Annulment removes only a **suffix** |
| Omen of Sinistral Erasure | Next Chaos Orb removes only a **prefix** |
| Omen of Dextral Erasure | Next Chaos Orb removes only a **suffix** |
| Omen of Sinistral Exaltation | Next Exalted Orb adds only a **prefix** |
| Omen of Dextral Exaltation | Next Exalted Orb adds only a **suffix** |
| Omen of Whittling | Next Chaos Orb removes the modifier with the **lowest required item level** (not lowest tier) rather than a random one — high-value, expensive omen |
| Omen of Homogenising Exaltation | Next Exalted/Regal Orb is restricted to modifiers sharing a **Tag** with an existing modifier already on the item |
| Omen of Corruption | Consumed on next Vaal Orb use — **removes the "nothing happens" outcome** from the corruption roll, forcing one of the three remaining outcomes |

Sinistral = prefix-targeting, Dextral = suffix-targeting, as a general naming convention across the Omen family.

### Endgame / high-tier crafting tools

- **Recombinator:** merges **two items of the same base type**, letting you select desired modifiers from each to attempt to combine onto a single resulting item. Carries real risk — **both source items can be destroyed** on failure; the more modifiers you attempt to preserve/combine, the lower the success chance. This is PoE2's answer to deterministic-ish high-end modifier combination, at high risk.
- **Liquid Emotions** (renamed from "Distilled Emotions"): drop from **Delirium** encounters; used to graft an otherwise-unreachable passive-tree notable onto an Amulet. Different Liquid Emotion types can be combined to reach passives on the opposite side of the tree from the amulet's anchor point.
- **Waystones:** the PoE2 endgame Map-equivalent item; not a "currency" in the crafting sense but tradeable/reforgeable — 3 Waystones of the same tier reforge into 1 Waystone of the next tier up at the Reforging Bench.
- **Desecration:** a newer mechanic (referenced in 0.5.x crafting material) that adds a special "Desecrated modifier" category to items; as of 0.5.5, Desecrated modifiers explicitly **do not** count against the "1 crafted modifier" cap, but an item is capped at **1 Desecrated modifier** of its own. Full mechanical detail (how Desecration is applied, what unlocks it) could not be independently confirmed from reachable sources this session — verify against official patch notes before documenting further specifics.

### The 0.5.5 "one crafted modifier" rule (recent, important)

As of **Patch 0.5.5 (Forbidden Rites)**: all *crafted* modifiers on an item are now **guaranteed** (no failure chance on the craft itself), but in exchange **an item can only carry 1 crafted modifier at a time**. This "1 crafted mod" bucket is shared across multiple sources: a **Runic Alloy** modifier, an **Essence/Perfect-Essence** guaranteed craft, and certain **Runic Ward** enchants all compete for that single slot. Desecrated modifiers are tracked separately (see above) and do not consume this slot.

## 5. Runes & Soul Cores (replaces PoE1 sockets/links for gear)

This is PoE2's single biggest itemization departure from PoE1. **PoE1's colored Str/Dex/Int sockets-and-links system for gear is gone entirely.** In its place:

- Eligible gear (Weapons, Body Armour, Helmets, Gloves, Boots, Shields, Foci) has **Rune Sockets**, filled with **Runes** or **Soul Cores** (mutually the same socket type — a Soul Core is a rarer/more powerful thing you can put in a Rune Socket, not a separate socket type).
- **Socket counts by item type:**
  - Chest Armour and Two-Handed Weapons: **max 2 sockets**
  - One-Handed Weapons, Gloves, Helmets, Boots: **max 1 socket**
  - Quivers, caster weapons (wands/sceptres — confirm exact list), and Jewellery (rings/amulets/belts): **0 sockets, cannot take Runes/Soul Cores**
  - (Skill Gems separately have their own **support-gem sockets**, governed by Jeweller's Orbs — a completely different socket system from gear Rune Sockets; see §4. Do not conflate the two.)
- **Most items drop with 0 sockets filled/available.** Sockets must be added via **Artificer's Orb** (from Artificer's Shards). A **Vaal Orb** can push a socket count *beyond* the normal per-item-type cap as one of its four corruption outcomes, at the cost of corrupting (and thus permanently locking) the item.
- **Runes:** apply a **fixed, non-random, non-tiered** modifier when socketed — e.g. "+12% Cold Resistance." No roll variance; what you see is what you get. Runes are freely swappable (no destruction implied by removing one, unlike PoE1 gem links — verify removability details before asserting this to end users, but sources consistently describe them as simple flat-effect insertable items). Categories described by community guides: **Elemental** (adds/increases elemental damage or resistance), **Physical** (damage/armour/evasion), and **Utility** (movement speed, life leech, mana regen, etc.).
  - Runes upgrade via a **3-of-a-kind recipe**: 3 Lesser Runes → 1 standard Rune; 3 standard Runes → 1 Greater Rune (via vendor and/or the Reforging Bench).
  - The 0.5.0 "Runes of Aldur" update added **~60+ new Runes** obtainable by **destroying Unique items**, where the resulting Rune carries some of that Unique's properties — a deterministic (if destructive) way to port a fragment of a Unique's identity onto other gear. It also added **15 "meta-crafting" runes** for late-game itemization and **3 "Flux" items** that convert one elemental Resistance type on an item into another.
- **Soul Cores:** meaningfully rarer than Runes. Where a Rune only grants modifier types that already exist elsewhere in the affix pool, a **Soul Core can grant an effect that exists nowhere else in the game** — e.g. ailment-scaling effects, flat Spirit, item rarity, etc. Most Soul Cores are **limited to 1 per character** (an account-wide or character-wide unique-effect cap, preventing stacking the same Soul Core in every socket you own). Many Soul Cores **behave differently depending on whether they're socketed in a Weapon vs. Armour** slot. Soul Cores are the endgame's primary build-defining socketable and are **farmed specifically through the Trial of Chaos** endgame mechanic (reworked in patch 0.5.5).
- **Reforging:** 3 identical Runes → 1 random Rune of the same tier; 3 identical Soul Cores → 1 random Soul Core, at the Reforging Bench.
- **0.5.5 status change:** the core Runes-of-Aldur mechanics — **Verisium, Runeforging, and the Verisium Anvil** — went **permanent/core**, now functioning in every league including Standard (the Verisium Anvil unlocks via the Runeseeker quest in Act 4). **Runic Alloys and the per-Act Runeforging ladder remain exclusive to the Runes of Aldur league** and are not (yet) core content.

## 6. The Reforging Bench (PoE1's Crafting Bench does not exist in PoE2)

**PoE2 has no equivalent to PoE1's master-crafting Crafting Bench** (no "click a bench mod to guarantee-add a suffix/prefix using currency + unlocked recipes" system in that form). It is functionally replaced by a combination of:
1. The **Reforging Bench** (unlocked after discovering **The Drowned City in Act 3**), and
2. The **essence / omen / catalyst / rune** currency systems described above, which take over the role of "targeted, semi-deterministic crafting."

**Reforging Bench functions:**
- Reroll the modifiers on an item (useful for recycling near-miss crafted bases)
- Recycle **3 identical Essences → 1 random Essence one tier higher**
- Recycle **3 identical Waystones of the same tier → 1 Waystone of the next tier**
- Recycle **3 identical Runes → 1 random Rune of the same level/tier**
- Recycle **3 identical Soul Cores → 1 random Soul Core**
- Recycle **3 identical Liquid Emotions → 1 higher-tier Liquid Emotion**

This is a materially different philosophy from PoE1's Crafting Bench: PoE2 leans on **currency-item combination/recycling** rather than **unlockable per-league bench crafts** as the deterministic backbone of crafting.

## 7. Corruption (Vaal Orbs) — Endgame-Only Currency

Vaal Orb corrupts an item; **corruption is final** — a corrupted item can never again be affected by *any* other currency (no further Essences, Chaos Orbs, Artificer's Orbs, Jeweller's Orbs, etc.). Because of this finality, community guidance is to max out quality, fill all affix slots (Exalted slams), and add all wanted rune sockets **before** Vaaling.

**On Rare (and reportedly some Magic) items — 4 possible outcomes, roughly equal weight (~25% each) unless modified by an Omen of Corruption:**
1. **Nothing happens** — the item still becomes flagged Corrupted, but no other change occurs. (Omen of Corruption removes this outcome from the pool.)
2. **Chaos-Orb-like effect**, applied 1, 2, or 3 times — remove-and-add a random modifier; notably **this can apply to Magic items too** (letting a corrupted Magic item gain more effective modifiers than its normal 1/1 cap would otherwise allow, via repeated application).
3. **Special corruption-only enchantment** — varies by item slot; often considered the best outcome.
4. **Push beyond normal limits** — on Armour/Martial Weapons this **adds an extra Rune Socket beyond the item type's normal cap**; on Caster Weapons this instead randomly adds or removes up to 10% Quality.

**On Skill Gems** (partial data — only 2 of what's likely a 4-outcome set were corroborated this session, each independently reported at ~12.5%, implying additional outcomes exist that weren't captured in these searches):
- +1 to gem level (generally the best outcome)
- Permanently remove a support-gem socket (a downside outcome)

**Corrupted Essences** are also a Vaal Orb byproduct: Vaaling a Perfect Essence found in a Map can produce a Corrupted Essence with a stronger, unique crafting effect beyond the standard 4-tier Essence ladder.

## 8. Unique Items

- Uniques are categorized by base item slot exactly like Normal/Magic/Rare items (a unique ring is still fundamentally a Ring base, etc.), but carry a largely fixed modifier set (some uniques do have rolled ranges within their fixed mods).
- **Unique-specific crafting mechanics:**
  - **Orb of Chance** can turn certain Normal-rarity bases directly into a specific corresponding Unique (base-type-dependent chance).
  - **Unique Verisium Runeforging** (0.5.0+): lets you upgrade the underlying base type of low-level Unique **armours** (those that natively drop below level 55), generally raising their base defence values so early-game Unique armour pieces remain endgame-competitive — unlocked via Act 3 progression.
  - **Destroying Uniques into Runes** ("Aldur's Legacy"-style mechanic, 0.5.0+): converting a Unique item consumes it and produces a Rune carrying a fragment of that Unique's identity/properties — a deterministic (but destructive) pipeline from Unique → reusable modifier.
  - A **vendor-recipe-style reroll** (combining multiple copies of the exact same Unique, including matching any variable explicit rolls, to reroll implicit+explicit values) is documented for PoE1 and referenced in some PoE2-adjacent guides, but **could not be independently confirmed as a current PoE2 mechanic this session** — treat this specific claim as unverified/possibly-PoE1-only until checked against poe2wiki.net.
- Recombinators (§4) primarily target combining two Rare items' modifiers; their applicability to Unique items specifically was not confirmed this session.

## 9. Item Sockets on Gear — Clarified vs PoE1

To avoid ambiguity for engine/data-model purposes, PoE2 actually has **two unrelated socket systems**, both called "sockets" colloquially but mechanically distinct:

1. **Rune Sockets on gear** (Weapons, Armour, Shields, Foci) — hold **Runes or Soul Cores**. This is the direct conceptual replacement for PoE1's colored Str/Dex/Int gem sockets, but it **no longer holds Skill Gems** and has **no Link system at all** — there is no PoE2 equivalent of PoE1's "linked sockets" support-gem mechanic on gear.
2. **Support sockets on Skill Gems themselves** — Skill Gems in PoE2 have **built-in support-gem sockets on the gem**, not on the wearer's gear. These start at 2 per gem and are expanded via Jeweller's Orb / Greater Jeweller's Orb / Perfect Jeweller's Orb (up to a reported 5th socket at the Perfect tier). This is the functional replacement for PoE1's "6-link chest" chase item concept — in PoE2, gem support capacity is a property of the **gem**, not a property of a specific armour piece's sockets.

This split (gear sockets = Runes/Soul Cores only; gem sockets = Support Gems only) is the core mental model to encode: **Project Vaal's wiki data model must not merge "gear rune sockets" and "skill gem support sockets" into one socket concept**, since they have different caps, different fill items, and different currencies that modify them (Artificer's Orb vs. Jeweller's Orb family respectively).

## 10. Trade

PoE2 trade is **not** a pure recreation of PoE1's original manual-whisper-via-third-party-site model. It now has three coexisting mechanisms:

1. **Currency Exchange** (in-client, asynchronous, automated market) — unlocked by talking to **Ange** in **Kingsmarch** (reached in **Act 4**; no extra quest required beyond arriving). Supports **stackable/bulk, fungible items only**: basic currencies (Chaos, Exalted, Divine, etc.), Runes, Soul Cores, Essences, Omens, Catalysts, boss-fight fragments/invitations, and Liquid Emotions. You pick "I Want" / "I Have" currencies; if your desired rate matches an existing order it fills **instantly** (sometimes at a *better* rate with a partial **Gold** refund). This directly mirrors a real-time order-book/AMM-style exchange rather than a listing-and-whisper model.
2. **Merchant Tabs** (asynchronous listing for non-stackable items, i.e. actual gear/uniques/rares) — a **purchasable stash-tab type** (reported at 40 points each, or 6 for 200 points) that functions like a Premium Tab but lets you **list priced items for sale that other players can buy while you're offline**, settled through Ange the same way as the Currency Exchange. Also gated behind reaching Act 4 / talking to Ange.
3. **Direct player-to-player trade** (manual) — still exists via **Premium Stash Tabs** + the classic whisper/trade-request flow, generally recommended for uniquely priced or high-value items where automated pricing risks mispricing/undervaluing the item.
4. **Gold** is the friction/fee currency for the Currency Exchange and other NPC interactions (gambling, respec) but is explicitly **account-bound and cannot be traded between players** — a deliberate anti-RMT/anti-bulk-gold-trade design choice distinct from PoE1 (which had no analogous universal non-tradeable currency).

**Net effect vs PoE1:** PoE2 brought a chunk of what used to require an external trade website + manual whisper (at least for bulk currency-for-currency trades) **in-client and automated**, while keeping manual trade as a fallback for priced/one-off gear — a hybrid model rather than a full replacement of PoE1's approach.

## 11. Gold — Non-Trade Uses

- **Dropped by monsters**, account-bound, cannot be traded to other players.
- **Passive respec:** cost is level-based, escalating steeply — reported figures range from roughly 15 gold per refunded passive point at character level 1 up to roughly 10,129 gold per point at level 100. **Ascendancy point refunds cost 5× a normal point's rate; attribute (Str/Dex/Int) point reallocation costs half a normal point's rate.**
- **Vendor gambling:** town vendors sell an "infinite" rotating stock of unidentified items purchasable with Gold as a gearing-up/leveling tool.
- Also spent on map-vendor-equivalent NPC interactions and as the fee mechanism inside the Currency Exchange.

## 12. Recent Major Itemization/Crafting Patches (through Sept 2026)

| Patch | Date (approx.) | Key itemization/crafting changes |
|---|---|---|
| **0.5.0 "Return of the Ancients"** (launched the **Runes of Aldur** league) | mid-2026 | Major Rune system expansion: introduced **Remnants**, **Runeforging**, **Runic Ward**, **Runic Alloys**, **Augment Runes**; added **~60+ new Runes** obtainable by destroying Unique items; added **15 meta-crafting runes**; added **3 Flux items** (convert resistance element type); added **Unique Verisium Runeforging** to upgrade low-level Unique armour bases; improved Soul Core drop consistency (notably from Inscribed Ultimatums). |
| 0.5.2 | 2026 | Reforging Bench-era refinements (incremental; specific patch-note deltas not independently confirmed this session). |
| 0.5.4 | 2026 | Essence and Artificer's Orb-era refinements referenced by contemporary guides (incremental; specific patch-note deltas not independently confirmed this session). |
| **0.5.5 "Forbidden Rites"** (event league) | 2026-09-04 | **Crafted-modifier overhaul:** all crafted mods now guaranteed, but capped at **1 crafted modifier per item** (shared by Runic Alloy / Essence-Perfect-Essence / certain Runic Ward enchants); **Desecrated modifiers** made explicitly exempt from that shared cap but capped at 1-per-item on their own. **Runes of Aldur mechanics went core**: Verisium, Runeforging, and the Verisium Anvil now function in every league including Standard (unlocked via the Runeseeker quest, Act 4); Runic Alloys and the per-Act Runeforging ladder remain Runes-of-Aldur-league-exclusive. **Ritual rework:** every Ritual reward window slot is now guaranteed to be a Unique or an Omen (large buff to Omen farming). **Trial of Chaos reworked** (the endgame Soul Core farming mechanic). New zone: Viridian Wildwood. |
| **1.0 full release** | **2026-12-11** (announced) | Confirmed at Gamescom Opening Night Live, 2026-08-25. No 0.6.0 planned — two short event leagues plus ExileCon 2026 (Nov 7–8) bridge 0.5.5 directly to 1.0. Full-release itemization/crafting deltas are not yet public as of this document's writing and must be re-researched closer to/after launch. |

---

## Open items to re-verify before relying on this document for shipped product copy

1. Exact guaranteed-modifier count rolled by **Orb of Alchemy** in the current patch (could not confirm a specific number this session).
2. Complete, wiki-accurate **19-Essence name/effect list** (multiple community sources gave overlapping but not perfectly consistent naming — poe2wiki.net's Essence category page is the authoritative source once reachable).
3. Full **Vaal Orb skill-gem corruption outcome table** (only 2 of a likely 4-outcome set were corroborated here).
4. Whether the PoE1-style "3 identical Uniques reroll" vendor recipe exists in PoE2 at all (flagged above as possibly a PoE1-only mechanic bleeding into search results).
5. Exact current **Desecration** mechanic details (how it's applied, what content unlocks it).
6. Full official **19-name Essence list**, full **Omen list**, and full **Catalyst list** beyond the 3 named examples captured here.
7. Confirm which weapon subclasses count as "caster weapons" for the 0-Rune-Socket exclusion rule (wands/sceptres presumably, but not independently confirmed).

---

## Sources

- https://mobalytics.gg/poe-2/guides/crafting-basics-part-1
- https://poe2.stratlore.com/en/guides/item-modifiers-item-level-prefix-suffix/
- https://miguelballesteros.com/path-of-exiles-complex-item-affix-system-how-mods-can-change-your-gear-and-build/
- https://dving.net/guides/path-of-exile-2-guides/item-modifiers
- https://grindout.com/poe-2/guides/crafting
- https://www.mmojugg.com/news/understanding-item-tiers-in-poe2.html
- https://www.thegamer.com/path-of-exile-2-poe2-every-currency-item-guide/
- https://gamerant.com/path-of-exile-2-every-currency-list-all-poe-2-currencies/
- https://epiccarry.com/blogs/poe-2-currencies-guide/
- https://odealo.com/articles/currency-system-in-path-of-exile-2
- https://dving.net/guides/path-of-exile-2-guides/currency
- https://grindout.com/poe-2/guides/currency
- https://pathofexile2.wiki.fextralife.com/Soul+Cores
- https://bo3.gg/games/articles/path-of-exile-2-runes-sockets-and-soul-cores-explained
- https://arcanestash.com/guides/poe2-runes-soul-cores-guide-sockets-augments
- https://www.u4gm.com/path-of-exile-2/blog-the-poe-2-socketables-system
- https://www.mmojugg.com/news/path-of-exile-2-runes-sockets-soul-cores.html
- https://mobalytics.gg/poe-2/guides/flasks
- https://www.siliconera.com/how-to-upgrade-life-and-mana-flasks-in-path-of-exile-2/
- https://esports.gg/news/path-of-exile-2/how-to-upgrade-healing-and-mana-flasks-in-path-of-exile-2/
- https://pathofexile2.wiki.fextralife.com/Flasks
- https://game8.co/games/Path-of-Exile-2/archives/490214
- https://poe2path.com/guides/poe2-flask-guide/
- https://www.iggm.com/news/poe-2-how-to-get-best-life-and-mana-flask
- https://www.arpg-timeline.com/game/path-of-exile2
- https://ggseason.com/poe2/
- https://www.pvpbank.com/poe-2-roadmap-2026
- https://www.mmoexp.com/News/path-of-exile-2-2026-full-roadmap-gamescom-reveal-0-5-5-update-1-0-f2p-launch.html
- https://www.aoeah.com/news/4294--poe-2-roadmap-2026-05-new-league-classes-full-release--more-leaks
- https://www.mmoexp.com/News/path-of-exile-2-forbidden-rites-league-september-4-full-0-5-5-patch-details-amp-1-0-launch-updates.html
- https://www.mmoexp.com/News/poe-2-next-league-guide-0-5-5-patch-notes-new-classes-and-1-0-release-date-explained.html
- https://www.slashskill.com/path-of-exile-current-league/
- https://www.pathofexile.com/forum/view-thread/3771225 (title/context only — content unreachable)
- https://pathofexile2.wiki.fextralife.com/Crafting (title/context only — content unreachable)
- https://www.poe2wiki.net/wiki/Currency_exchange_market
- https://www.poewiki.net/wiki/poe2wiki:Currency
- https://www.poe2wiki.net/wiki/Essence_of_the_Infinite
- https://www.poe2wiki.net/wiki/Essence_of_Ruin
- https://www.poe2wiki.net/wiki/Greater_Essence_of_Ruin
- https://www.poe2wiki.net/wiki/Greater_Essence_of_Opulence
- https://poe2scout.com/poe2/runes/economy/currencies/essences
- https://poe.ninja/poe2/economy/runesofaldur/essences
- https://poe2db.tw/us/ (title/context only — content unreachable)
- https://boostmatch.gg/blog/poe-2/articles/poe2-currency-guide-patch-050-runes-of-aldur (title/context only — content unreachable)
- https://mobalytics.gg/poe-2/unique-weapons
- https://game8.co/games/Path-of-Exile-2/archives/487603
- https://www.poe2wiki.net/wiki/Martial_weapon
- https://poe2db.tw/us/ (Martial Weapons page — title/context only)
- https://pathofexile2.wiki.fextralife.com/Weapons (title/context only — content unreachable)
- https://www.flarejoy.com/wiki/084edae6-fbc6-4255-d98c-08dd57d84128
- https://game8.co/games/Path-of-Exile-2/archives/489096
- https://www.poe-vault.com/poe2/guides/currency-and-crafting
- https://timesaver.gg/blog/poe2-artificers-orb-guide
- https://skycoach.gg/blog/path-of-exile-2/articles/poe-2-crafting-guide
- https://timesaver.gg/blog/poe2-perfect-jewellers-orb-guide
- https://1v9.gg/blog/path-of-exile-2-poe-how-to-add-sockets-to-gear-guide
- https://gamerblurb.com/articles/path-of-exile-2-jewellers-orb-guide-and-how-to-get
- https://www.flarejoy.com/wiki/8745d3da-d0a0-4cda-eed9-08dd603f8d33
- https://domistae.github.io/poe2-leveling/poe2_crafting_codex.html (title/context only — content unreachable)
- https://orbispatches.com/gaming-faq/do-item-levels-matter-in-poe2
- https://www.poewiki.net/wiki/Recipe (PoE1 vendor recipe reference — used cautiously, flagged as possibly not PoE2-applicable)
- https://pathofexile.fandom.com/wiki/Vendor_recipe_system (PoE1 reference — flagged)
- https://mobalytics.gg/poe-2/guides/vaal-corrupting
- https://gamerant.com/path-of-exile-2-all-vaal-orb-outcomes-corruption-poe2/
- https://maxroll.gg/poe2/resources/corruption-outcomes (title/context only — content unreachable)
- https://timesaver.gg/blog/poe2-vaal-orb-guide
- https://www.mmojugg.com/news/poe-2-vaal-orbs-omen-guide.html
- https://www.mmojugg.com/news/vaal-orb-risks-in-path-of-exile-2.html
- https://vulkk.com/2025/01/10/path-of-exile-2-crafting-recommendations-and-tips/
- https://mobalytics.gg/poe-2/guides/omen-crafting
- https://poe2.stratlore.com/en/items/omens/
- https://dadsofexile.com/omens
- https://timesaver.gg/blog/poe2-omens-guide
- https://www.mmojugg.com/news/poe-2-omens-a-comprehensive-guide.html
- https://pathofexile2.wiki.fextralife.com/Catalysts (title/context only — content unreachable)
- https://poe2.stratlore.com/en/items/catalysts/
- https://pathofexile.fandom.com/wiki/Catalyst (PoE1 reference)
- https://timesaver.gg/blog/poe2-catalysts-guide
- https://www.ssegold.com/poe-2-catalysts-guide
- https://www.u4n.com/news/path-of-exile-2-catalyst-guide-complete-list.html
- https://game8.co/games/Path-of-Exile-2/archives/546865
- https://maxroll.gg/poe2/resources/stash-tab-guide (title/context only — content unreachable)
- https://www.ssegold.com/poe-2-merchant-tab-guide
- https://www.mmojugg.com/news/poe2-asynchronous-trading-merchant-tabs-guide.html
- https://www.poebuilds.net/post/all-about-the-new-trade-system
- https://pathofexile2.wiki.fextralife.com/How+to+Trade+in+Path+of+Exile+2 (title/context only — content unreachable)
- https://maxroll.gg/poe2/resources/trade-in-path-of-exile-2 (title/context only — content unreachable)
- https://www.thegamer.com/path-of-exile-2-currency-exchange-guide-unlock/
- https://gamerant.com/path-of-exile-2-currency-exchange-guide-unlock-walkthrough-poe2/
- https://www.bamboogaming.net/poe2/trade
- https://pathofexile.gg/path-of-exile-2-currency-exchange-explained/
- https://nexttier.pro/guide/poe2-trade-guide
- https://conquestcapped.com/guides/path-of-exile-2/poe-2-currency-trading/
- https://www.gamesradar.com/games/action-rpg/path-of-exile-2-respec/
- https://www.shacknews.com/article/142461/how-to-respec-path-of-exile-2
- https://timesaver.gg/blog/poe2-gold-farming-guide
- https://dving.net/guides/path-of-exile-2-guides/gold
- https://boostroom.com/blog/path-of-exile-2-respec-guide-how-to-refund-passive-points-and-fix-your-build
- https://pathofexile2.wiki.fextralife.com/Runes+of+Aldur (title/context only — content unreachable)
- https://pathofexile2.wiki.fextralife.com/Runes (title/context only — content unreachable)
- https://timesaver.gg/blog/poe2-aldurs-legacy-rune-crafting-guide-0-5-5
- https://www.poecurrency.com/news/poe-2-patch-0-5-0-runes-of-aldur-crafting-overhauls-your-endgame-gearing
- https://boostmatch.gg/blog/poe-2/articles/poe2-gearing-guide-0-5-runes-of-aldur (title/context only — content unreachable)
- https://www.aoeah.com/news/4592--poe-2-05-best-new-runes--how-to-get-runes-of-aldur
- https://odealo.com/articles/the-best-starters-for-path-of-exile-2-patch-0-5
- https://maxroll.gg/poe2/news/0-5-5-forbidden-rites-patch-notes (title/context only — content unreachable)
- https://poe2.infinitybuilds.gg/en/news/poe2-0-5-5-forbidden-rites-all-challenge-rewards-trial-of-chaos-rework-and-what-s-new
- https://www.mmojugg.com/news/poe2-055-forbidden-rites-patch-notes.html
- https://www.iggm.com/news/poe-2-0-5-5-patch-notes-how-ritual-expedition-reshape-forbidden-rites-farming
- https://playhub.com/blog/poe2/forbidden-rites-event-guide-078408
- https://maxroll.gg/poe2/news/patch-0-5-return-of-the-ancients-reveal-summary (title/context only — content unreachable)
- https://maxroll.gg/poe2/news/path-of-exile-2-0-5-0-return-of-the-ancients-guide-updates-more (title/context only — content unreachable)
- https://game8.co/games/Path-of-Exile-2/archives/601782
- https://maxroll.gg/poe2/news/0-5-0-patch-notes-return-of-the-ancients (title/context only — content unreachable)
- https://sidiadevelopment.github.io/poe2-patch/ (title/context only — content unreachable)
- https://www.poe2.dev/news/patch-notes/050-patch-notes-return-of-the-ancients
- https://game8.co/games/Path-of-Exile-2/archives/488464
- https://game8.co/games/Path-of-Exile-2/archives/488463
- https://mobalytics.gg/poe-2/guides/equipment-guide
- https://game8.co/games/Path-of-Exile-2/archives/488465
- https://game8.co/games/Path-of-Exile-2/archives/488461
- https://genshinlab.com/poe2/path-of-exile-2-equipment-guide/
- https://www.aoeah.com/news/3742--poe-2-best-base-items-to-chance--craft-weapons--armor
- https://www.mmojugg.com/news/poe2-crafting-itemization-ultimate-beginner-guide.html
- https://dving.net/guides/path-of-exile-2-guides/beginner-s-equipment-guide
- https://pathofexile2.wiki.fextralife.com/Unique+Body+Armor (title/context only — content unreachable)
- https://pathofexile2.wiki.fextralife.com/Armor (title/context only — content unreachable)
- https://game8.co/games/Path-of-Exile-2/archives/487774
- https://onlyfarms.gg/guides/path-of-exile-2-coaching-guide-complete-armor-crafting-breakdown-helmets-gloves-boots-and-body-armors-explained/
- https://www.mmojugg.com/news/path-of-exile-2-030-armor-crafting-mastery-guide.html
- https://pathofexile2.wiki.fextralife.com/Stats+&+Attributes (title/context only — content unreachable)
- https://vulkk.com/2025/02/17/path-of-exile-2-attributes-explained/
- https://gamerant.com/path-of-exile-2-attributes-strength-dexterity-intelligence-poe2-attribute-stats-dex-int-str/
- https://www.sportskeeda.com/mmo/path-exile-2-poe2-stat-attribute-guide-strength-dex-intelligence
- https://mobalytics.gg/poe-2/guides/charms
- https://game8.co/games/Path-of-Exile-2/archives/493411
- https://www.poe2wiki.net/wiki/Antidote_Charm
- https://pathofexile2.wiki.fextralife.com/Charms (title/context only — content unreachable)
- https://pathofexile2.wiki.fextralife.com/Antidote+Charm (title/context only — content unreachable)
- https://gamerant.com/path-of-exile-poe-2-what-is-charm-system/
- https://pathofexile2.wiki.fextralife.com/Unique+Charms (title/context only — content unreachable)
- https://gamerblurb.com/articles/antidote-charm-guide-for-path-of-exile-2
- https://www.poecurrency.com/news/poe-2-how-to-get-charms-and-use-them-to-their-full-potential
