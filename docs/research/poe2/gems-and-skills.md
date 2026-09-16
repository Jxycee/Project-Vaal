# PoE2 Gem & Combat System Research

Research reference for Project Vaal (build sharing + item wiki). Pure research, no code.

## Last updated

2026-09-16. Reflects **Path of Exile 2 patch 0.5.5 "Forbidden Rites"** (released Sept 4, 2026), the current Early Access patch. Cross-checked against Project Vaal's own extracted wiki dataset at `public/data/wiki/2026-08-25/` (`lastSynced` timestamps in that dataset go up to 2026-09-14, i.e. it already reflects 0.5.5). PoE2 is still in Early Access; **1.0 full release is scheduled for December 11, 2026** (announced at Gamescom ONL, Aug 25 2026), which will go free-to-play and add more content (see "Upcoming at 1.0" below). Treat anything marked "upcoming" as not-yet-live.

---

## 1. Gem system: PoE2 vs PoE1 — the big structural change

PoE1: skill gems + support gems are physical items socketed into **linked sockets on your equipped gear** (weapons/armour). Support gems only affect skills socketed in the same linked group. Gear sockets/links/colors were a huge, RNG-heavy crafting axis.

PoE2 **removed gem sockets from gear entirely**. Key facts:

- Skill gems and support gems live in a dedicated **Skill/Gem panel**, completely independent of equipped items. Equipping new gear never has to be checked against socket count/color/links.
- Each **active skill gem has its own internal support-gem sockets**: a fresh skill gem starts with **2 support sockets**, expandable up to **5 support sockets** per skill (via level-up/quest rewards and support-socket-granting mechanics), for a maximum "six-link" (1 active gem + 5 supports) **entirely local to that one skill**, not shared gear infrastructure.
- Characters have a limited number of overall **active skill slots** (commonly cited as starting around 9, expanding with character level/quest rewards) into which you place active/spirit skill gems; each of those gets its own support sockets as above.
- Because supports are attached directly to the skill (not the item), swapping gear for a straight upgrade is instant — no re-linking, no color-matching, no loss of your support setup.
- Gear item sockets **still exist**, but for an unrelated system: **Runes and Soul Cores** (see §9), not skill/support gems.
- Patch 0.3.0 "The Third Edict" removed the old restriction that a specific support gem could only be slotted into one skill at a time per character — you can now own/equip multiple copies of the same support across different skills.
- Support gems now use a **tier system** (I/II/III/IV/V rather than a level-up curve): higher tiers = better values, and higher tiers can add extra secondary effects/interactions not present on the base tier.

## 2. How you get and progress gems: Uncut Gems / Gemcutting

You never find a "finished" gem as loot. Instead you find **Uncut Gems**, which you cut into the specific gem you want at a Gemcutter's/Gem panel (gated by your character's level and attribute totals):

- **Uncut Skill Gem** — cuts into any Active Skill Gem you're eligible for. Comes in tiers **Level 1–20** (confirmed via local data: `Uncut Skill Gem (Level 1)` … `(Level 20)`, 20 distinct tiers). A higher-level Uncut Skill Gem cuts a higher-starting-level skill gem.
- **Uncut Support Gem** — cuts into a Support Gem. Comes in only **5 tiers (Level 1–5)**, matching the 5 support-gem tiers (I–V) rather than a 1–20 curve — confirms that, unlike skill gems, **support gems do not gain individual XP levels**; instead you re-cut with a higher-tier Uncut Support Gem to get a better tier of that support.
- **Uncut Spirit Gem** — cuts into a Spirit Gem (persistent buffs/auras/permanent minions/meta gems). Tiers run **Level 4–20** (skips 1–3) per local data.

Leveling and quality:
- Active skill gems (and Spirit gems) gain levels from character XP like PoE1, improving damage/effect per the gem's own scaling table (e.g. Fireball's damage climbs from 8–12 at level 1 to 224–336 at level 20, per extracted data).
- **Gem Quality**: apply a **Gemcutter's Prism** to a skill gem — right-click the Prism, left-click the gem — for **+1% quality per Prism, up to 20% max** (20 Prisms for max quality). Quality boosts the gem's stats (extra damage/effect, sometimes reduced cost) — exact bonus is gem-specific and visible via Alt-hover.
- A known vendor trick: selling a Level 20 gem together with 1 Gemcutter's Prism returns the same gem reset to Level 1 but with 20% quality already applied, letting you re-level it while keeping quality.
- Uncut Gems, Gemcutter's Prisms, and higher-tier Uncut Support Gems all drop from monsters, quests, and can be affected by Waystone/map modifiers that boost gem drops.
- Unique items can grant their own bespoke unique skill gems (e.g. the "Herald of Ash" unique skill gem tied to the Herald of Ash unique item, confirmed in local wiki data), separate from the normal gem-find pool.

## 3. Gem categories / tags (ground truth from Project Vaal's extracted data)

Project Vaal's own wiki extraction (`public/data/wiki/2026-08-25/skills/*.json`, 1,118 files, synced through patch 0.5.5) is the most authoritative source available for exact current tag taxonomy and counts. Raw entry counts (includes multiple level/tier-variant files per gem, e.g. "Fire Penetration I/II/III" are 3 separate entries):

| gemType | raw entries | approx. unique base gems |
|---|---|---|
| `active` (Active Skill Gem) | 455 | ~400 (35 are cut "[DNT-UNUSED]" content not live in-game) |
| `support` (Support Gem) | 622 | ~457 (6 unused) |
| `spirit` (Spirit Gem) | 41 | ~39 |

(Older community estimates circulating online — e.g. "240 skill gems / 200 support gems" — are stale/pre-0.5.x; use the counts above as current.)

Tags found across all skill gems (frequency, most common first): `Support`(622, i.e. every support gem carries the generic Support tag), `AoE`(370), `Attack`(348), `Duration`(240), `Melee`(186), `Spell`(181), `Buff`(178), `Persistent`(177), `Projectile`(163), `Physical`(151), `Trigger`(131), `Fire`(125), `Cold`(106), `Lightning`(106), `Minion`(91), `Repeatable`(89), `Strike`(86), `Lineage`(78), `Chaos`(69), `Slam`(44), `Meta`(41), `Payoff`(38), `Channelling`(37), `Sustained`(36), `Conditional`(30), `Ammunition`(29), `Warcry`(25), `Remnant`(23), `Totem`(23), `Shapeshift`(22), `Nova`(21), `Curse`(20), `Aura`(17), `Chaining`(17), `Travel`(16), `Command`(16), `Companion`(15), `Grenade`(12), `Mark`(11), `Hazard`(11), `Storm`(10), `Herald`(10), `Staged`(10), `Detonator`(10), `Plant`(10), `Wind`(9), `Werewolf`(7), `Bear`(7), `Wyvern`(6), `Invocation`(5), `Orb`(5), `Merging`(4), `Banner`(4), `Bow`(1).

**Notable finding: there is no `Trap` or `Mine` tag anywhere in the current dataset.** PoE2 has (as of 0.5.5) **no player Trap or Mine skill category** — the classic PoE1 "lay it down, it triggers later" playstyle is instead covered by the Mercenary's **Grenade** skills (thrown, arm/detonate) and by **Totems** (stationary remote-cast allies) and **Ballistae** (Totem-tagged, e.g. "Artillery Ballista", "Siege Ballista"). If PoE1 knowledge/training data assumes Traps/Mines exist as a skill gem category, that assumption does not hold in PoE2 — do not build UI/filtering around it without re-checking.

### Category breakdown with examples

| Category (tag) | What it means | Example gems (from live data) |
|---|---|---|
| Attack | Weapon-based active skills, scale off weapon damage | Cross Slash, Staggering Palm, Tempest Bell |
| Spell | Caster active skills, scale off spell damage stats | Fireball, Consecrate |
| Totem | Summons a stationary remote-cast ally that uses the skill for you | Ancestral Warrior Totem, Spell Totem, Artillery Ballista, Siege Ballista, Shockwave Totem, Dark Effigy |
| Minion | Summons an autonomous creature ally (skeletons, spectral beasts, etc.) | Skeletal Storm Mage, Summon Infernal Hound, Skyfall, Soul Offering |
| Companion | A specific "always-with-you" permanent pet subtype of Minion | Cackling Companions, Wild Protector, Manifest Weapon, Tame Beast, Spirit Vessel |
| Aura / Herald / Banner / Warcry | Persistent party/self buffs (see §5 — these reserve Spirit) | Overwhelming Presence (Aura), Herald of Ash / Herald of Blood (Herald), War Banner / Dread Banner (Banner), Ancestral Cry / Seismic Cry (Warcry) |
| Curse | Debuff applied to enemies | Vulnerability, Flammability, Despair, Elemental Weakness, Conductivity |
| Mark | Single-target debuff/tracking skill | Sniper's Mark, Voltaic Mark, Bloodhound's Mark, Freezing Mark |
| Grenade | Mercenary's thrown explosive/utility skill line (PoE2's answer to traps) | Explosive Grenade, Oil Grenade, Flash Grenade, Cluster Grenade, Gas Grenade |
| Ammunition | Crossbow/bow skills that "load" a special shot type | Fragmentation Rounds, Shockburst Rounds, High Velocity Rounds, Explosive Shot |
| Channelling | Held-button skills that ramp up or drain a resource while active | Flameblast, Oil Barrage, Detonating Arrow, Kinetic Bash, Snipe |
| Shapeshift | Druid skills that change/require a beast form | Cross Slash (Werewolf), Rolling Magma, Demon Form, Arctic Howl (Bear) |
| Meta / Trigger | "Rider" gems that auto-cast a socketed skill on a condition — always Spirit gems (see §4) | Cast on Freeze, Cast on Shock, Cast on Critical, Cast when Damage Taken, Spellslinger, Mirage Archer |
| Nova | Skill that bursts outward from a point | Flameblast, Consecrate, Arctic Howl, Elemental Sundering, Dark Pact |

### Full extracted Spirit Gem list (patch 0.5.5, ~39 live entries)

Persistent Buffs / Meta gems / permanent-minion-summons that reserve Spirit are all `gemType: spirit` in the data. Live examples include: Ancestral Warrior Totem, Barrier Invocation, Blasphemy, Called Shots, Cast on Block, Cast on Charm Use, Cast on Critical, Cast on Death, Cast on Dodge, Cast on Elemental Ailment, Cast on Freeze, Cast on Ignite, Cast on Melee Kill, Cast on Melee Stun, Cast on Minion Death, Cast on Shock, Cast when Damage Taken, Cast when Stunned, Cast while Channelling, Curse on Block, Demon Magus, Elemental Invocation, Feral Invocation, Ferocious Roar, Fire Spell on Hit, Hand of Chayula, Hollow Form, Hydra Familiar, Mirage Archer, Mirage Deadeye, Mortar Cannon, Pounce, Reaper's Invocation, Spell Totem, Spirit Vessel, Summon Companion, Thundergod's Wrath. (A handful of additional `[DNT-UNUSED]` entries exist in the data as cut/disabled content — not live.)

## 4. Support gems

- Raw count in current data: **622 entries across all tiers (~457 unique base support gems)**.
- Every support carries the base `Support` tag plus damage-type/behavior tags identical in spirit to skill gem tags (Fire, AoE, Duration, etc.), so supports are filtered/matched to compatible skills by shared tags exactly like PoE1 (a support tagged `Fire` only affects Fire-tagged skills, etc.) — universal supports carry no restrictive tag beyond the mechanic they modify.
- Sample of universal/widely-applicable supports commonly cited by the community: **Fire/Cold/Lightning Penetration**, **Multishot**, **Controlled Destruction**, **Volatile Power**, **Bloodlust**, **Ricochet**, **Fresh Clip**, **Elemental Armament**, **Deadly Poison**, **Persistent Ground**, **Culmination**, **Feeding Frenzy**, **Blind**, **Overextend**, **Magnified Effect** (+40% more AoE, "almost universally useful"), **Arcane Tempo** (+25% cast speed for Spells, no drawback).
- Support gem tiers (I → V) are obtained by cutting progressively higher-tier **Uncut Support Gems** (only 5 tiers exist, unlike the 1–20 level curve on skill/spirit gems) — see §2.
- Support sockets per skill: **starts at 2, grows to a max of 5** as that specific skill gem is leveled/upgraded, giving the classic "6-link" (1 skill + 5 supports) entirely inside the skill-gem UI, independent of gear.
- 0.3.0 "The Third Edict" removed the old one-copy-per-character restriction — the same support gem can now be equipped on multiple different skills simultaneously.

## 5. Spirit — the new persistent-effect resource (replaces PoE1 mana reservation)

Spirit is a **brand-new resource pool**, separate from Mana, that exists specifically to pay for **always-on effects**:

- What uses Spirit: **Auras** (now formally called **Persistent Buffs**), **Heralds**, **Banners**, **Warcries with lingering effects**, **permanent Minions/Totems that stay summoned**, and **Meta/Trigger gems** ("Cast on X", "Spellslinger", etc.) — i.e., any skill carrying the `Persistent` tag. Confirmed directly in local extracted data: e.g. Overwhelming Presence (Aura) reserves 30 Spirit, Skeletal Storm Mage (permanent Minion) reserves 120 Spirit, Berserk (Buff) 30, Blink (persistent Buff) 60, War Banner 30, Barkskin 30, Skeletal Cleric (Minion) 60.
- Mechanically it behaves like a **budget/rental**, not a spend: you "reserve" a chunk of your Spirit pool for as long as the effect is toggled on, and get it back only when you deactivate that skill. There is no per-cast Spirit cost for these skills, only the standing reservation.
- If you don't have enough unreserved Spirit, you simply cannot activate the skill/meta gem — no partial activation.
- **Your Mana pool is never reduced by Spirit reservations.** This is the core divergence from PoE1, where reserving mana for auras shrank your usable mana pool for spending on other skills. In PoE2, **all characters have their full Mana pool available at all times regardless of how many Spirit-reserving skills are active** — Mana and Spirit are fully separate pools with separate purposes (Mana = per-cast skill cost; Spirit = standing reservation for persistent effects).
- Sources of more max Spirit: campaign progression (killing certain campaign bosses grants permanent Spirit), and specific gear affixes — chiefly **Body Armour, Amulet, and Sceptre** items can roll/grant flat Spirit. Spirit is primarily a campaign+itemization resource, not something you level into like Life/Mana.

## 6. Life / Mana / Energy Shield — how they interact, and changes from PoE1

| Pool | PoE1 behavior | PoE2 behavior |
|---|---|---|
| **Life** | Primary health pool; degen'd by most damage | Same role; still primary defensive pool. |
| **Mana** | Spent per-cast **and** reserved (often heavily) for auras, shrinking spendable mana | Spent per-cast only — **reservation for persistent effects moved entirely to Spirit** (see §5), so full Mana pool is always available for active use. |
| **Energy Shield (ES)** | Absorbs most damage before Life; **Chaos Damage bypassed ES entirely**, hitting Life directly | ES still absorbs most hit damage first, but the Chaos interaction changed: **only Chaos Damage from the Poison ailment bypasses ES outright**; non-Poison Chaos damage instead **drains ES at double the normal rate** rather than skipping it. **Bleed** also bypasses ES straight to Life, but only from a direct hit — non-hit/DoT sources can still be absorbed by ES, so ES indirectly reduces bleed's uptime chance. |
| Keystones | Eldritch Battery / Mind Over Matter exist in PoE1 | Both keystones return in PoE2: **Eldritch Battery** lets ES protect Mana instead of Life; combined with **Mind Over Matter**, Mana damage is redirected to ES first, protecting both Mana and Life behind the ES buffer. |

Net effect for build design: PoE2 decouples "how much you can cast" (Mana) from "how many buffs you can run" (Spirit), while ES got a slight nerf against Chaos/Poison specifically (no longer a hard bypass-immunity against all Chaos) to curb the old "stack ES, ignore Chaos" PoE1 pattern.

## 7. Combat mechanics

### Dodge Roll
- Universal defensive movement skill (own dedicated input, not a gem). **No cooldown** — can be spammed freely.
- Has **i-frames only for a few frames right at the start of the roll animation** — it is not a long-duration full-invulnerability dash. Reliable mainly as *positioning* (physically move out of an attack's hitbox) rather than as a "roll straight into an attack and no-sell it" tool, **except against projectiles**, which can usually be dodged through (roll toward/through the projectile) since their hitbox check differs from AoE/slam hitboxes.
- Does **not** reliably avoid large ground AoEs, slams, or trap/effect zones that persist under you — you must physically leave the area, timing alone won't save you inside a big AoE.
- Can be used to **cancel your own skill animations**, letting you bail out of a committed attack/cast early.

### Stun / Stagger
Two tiers of interrupt, both usable by player and inflictable on enemies:
- **Light Stun**: a brief interruption/flinch on hit, breaks the enemy's current action for a moment. Weaker against bosses/large enemies.
- **Heavy Stun**: a full knockdown that leaves the target completely unable to act for several seconds. Triggered by filling the target's **Heavy Stun (yellow) meter**, which builds from physical damage taken (with **melee/Physical damage building it ~50% faster** than other types — all damage types can contribute, but Strength-based melee and Physical hits are the most efficient stun-builders). This is PoE2's answer to PoE1's simpler stun-chance-on-hit — it's now a resource bar to whittle down, much like a "poise break," especially relevant for boss fights where classes like Warrior/Monk (melee/Physical-heavy) are the most natural staggerers.
- While Heavy Stunned, the target takes bonus/vulnerable damage — a core damage-window mechanic for melee/boss-killing builds.

### Block
- Requires a **Shield** equipped (also available via certain **Staves**), granting the **Raise Shield** skill.
- **Passive block**: shields carry a flat "chance to block" stat that now applies uniformly to *both* attacks and spells (no more separate attack-block/spell-block stats as in PoE1). The roll is a straight percentage chance per incoming hit, not an evasion-style dodge/miss roll.
- **Active block**: manually trigger **Raise Shield** to guarantee/boost your block chance for a window, at the cost of committing to the animation.
- **Block/guard meter**: every successful block fills a stagger meter next to your health bar, sized by the strength of the blocked hit; filling it fully **breaks your guard**, staggering you with your shield down and briefly vulnerable — so block is not infinitely spammable against sustained heavy damage.

### Elemental & physical/chaos Ailments

| Ailment | Damage type that causes it | Effect | Base magnitude | Base duration | Bypasses ES? |
|---|---|---|---|---|---|
| **Ignite** | Fire | Damaging burn — the only elemental ailment that deals direct damage itself | 20% of the fire damage of the hit that applied it, per second | 4s | No (normal ES/Life split, drains via fire-DoT rules) |
| **Chill** | Cold | Slows the target's action/attack/move speed | scales with cold damage vs. threshold | 2s | n/a (non-damaging) |
| **Freeze** | Cold | Fully halts the target (can't act) | scales with cold damage vs. threshold | short, scales with overkill vs threshold | n/a (non-damaging) |
| **Shock** | Lightning | Increases damage taken (lowers effective defenses) | scales with lightning damage vs. threshold | scales | n/a (non-damaging) |
| **Bleed** | Physical (direct hit only) | Physical damage-over-time | 70% of the hit's Physical damage, per second | 5s | **Yes** — bypasses ES straight to Life (only from direct hits; DoT/no-hit sources can still be absorbed by ES first) |
| **Poison** | Physical + Chaos (combined) | Chaos damage-over-time, stacks | 20% of the hit's combined Physical+Chaos damage, per second | 2s (stacks independently, so many short poisons overlap) | **Yes** — bypasses ES straight to Life |

- **Elemental Ailment Threshold**: the chance to actually inflict Chill/Freeze/Shock/Ignite from a hit is a function of the hit's damage relative to the target's "ailment threshold," which for most monsters equals (roughly) their max Life, adjusted specially for uniques/bosses so they aren't trivially perma-frozen. E.g., Ignite has a base ~25% chance to apply per 100% of the threshold dealt in one hit — bigger hits relative to a monster's threshold = much higher ailment chance, encouraging big single hits (crit/slam builds) for ailment-chance builds, not just DPS-over-time.
- **Charms** (see §9) are the primary answer to ailments defensively — immunity charms fully block a specific ailment on trigger; resistance charms grant a temporary resistance boost on trigger instead.

## 8. Weapon Sets & weapon-tied skills

- Characters can equip **two full weapon sets** (Weapon Set 1 / Weapon Set 2 — includes off-hands too, e.g. two different shields or foci) and **swap between them with no delay/animation lock**, unlike some other ARPGs.
- **Each skill can be assigned to Weapon Set 1, Weapon Set 2, or both**, provided the skill is compatible with whatever is equipped in that set. If a skill is bound only to your *inactive* weapon set, using it will **automatically swap your weapon set for you** as part of activating the skill.
- Some skills **require both weapon sets to function** — e.g. a Blink-type movement skill has been called out as needing both sets populated.
- **Dual Specialization**: passive skill tree points can include **Weapon Swap Points** — nodes that are only allocated/active while a specific weapon set is the active one. This lets a single character effectively run two different passive-tree configurations (e.g., a melee tree active on Set 1, a caster tree active on Set 2) tied to which weapons are currently drawn.
- **Dual-wielding restriction**: some skills refuse to function if you're dual-wielding two *different* weapon types (e.g. a skill designed around matched swords won't fire if you have a sword in one hand and an axe in the other) — dual-wield builds need to mind weapon-type matching for skill compatibility, not just raw stats.

## 9. Classes, weapons, and per-class skill flavor (current, patch 0.5.5)

PoE2 is still in Early Access; class roster keeps growing toward 1.0. **Currently live (0.5.5, Sept 2026): 8 base classes**, each defined by a primary attribute pairing and signature weapon:

| Class | Attributes | Signature weapon | Flavor / representative skills | Ascendancies (as of 0.5.5)* |
|---|---|---|---|---|
| **Warrior** | Strength | Mace (1H/2H) | Melee brawler, big slams, best-in-class Heavy Stun building; e.g. Hammer of the Gods, Sunder, Earthquake-style slams | Titan, Warbringer |
| **Monk** | Strength/Dexterity | Quarterstaff | Fast melee/elemental hybrid — combo/Combo-Strike mechanics (see Tempest Bell), martial-arts elemental skills (Ice, Lightning, Wind) | Invoker, Acolyte of Chayula, Martial Artist |
| **Ranger** | Dexterity | Bow | Ranged physical/elemental projectile skills, suppressing-fire playstyles | Deadeye, Pathfinder |
| **Sorceress** | Intelligence | Staff (also Wand+Focus) | Elemental spellcaster — Fire/Cold/Lightning nukes, e.g. Fireball, Spark | Chronomancer, Stormweaver |
| **Witch** | Intelligence | Wand + Focus / Sceptre | Minion/DoT caster — Spectres capture slain-enemy "essences" as summonable minions; corpse-interaction skills (spread plagues, detonate corpses); Skeletal Warriors/Snipers/Arsonists | Infernalist, Blood Mage |
| **Mercenary** | Dexterity/Intelligence | Crossbow | Ammunition-loading crossbow skills (Fragmentation/Shockburst/High Velocity Rounds) plus **Grenades** (PoE2's trap/mine-equivalent utility line) | Witch Hunter, Gemling Legionnaire, Tactician |
| **Huntress** | Dexterity/Strength | Spear | Fast, agile melee/thrown-hybrid darting in/out of range with a Spear (not a Bow) | Amazon, Ritualist, Spirit Walker |
| **Druid** | Strength/Intelligence | Unarmed/Sceptre + Shapeshifting | Instant-swap between humanoid elemental-caster mode and beast forms (**Bear**, **Werewolf**, **Wyvern** — confirmed as live tags in extracted skill data) mid-fight, e.g. Cross Slash (Werewolf), Ferocious Roar (Bear) | Shaman, Oracle |

*Ascendancy list per class is community-tracked and can shift patch to patch; roughly 22 ascendancies exist across the 8 classes as of 0.5.4/0.5.5 per community trackers (e.g. timesaver.gg's interactive ascendancy explorer) — some classes (Monk, Mercenary, Huntress) have picked up a 3rd ascendancy in recent 0.5.x patches while others still have 2.

**Other weapon types** available generally (not exclusive to one class) and used as off-class/hybrid picks: Sword, Axe, Claw, Dagger, Flail, Wand, Sceptre, Bow, Crossbow. Most one-handed Martial weapon builds run **7 total item sockets** (for Runes/Soul Cores, see §10); pure caster (Wand+Focus) setups get 6; a two-handed Staff-only setup gets 5.

### Upcoming at 1.0 (Dec 11, 2026) — not live yet
- GGG has stated the class roster expands to **12 total classes / ~36 ascendancies** at full release.
- A **sword-wielding Duelist** class has been explicitly confirmed for the 1.0 launch.
- Patch 0.5.0 "Return of the Ancients" (May 29, 2026) was publicly stated by GGG to be **the final Early Access league before 1.0** — meaning 0.5.x point patches (0.5.5 Forbidden Rites, etc.) are refinements within that same final EA cycle rather than a new numbered season.
- At 1.0 the game becomes **fully free-to-play**; before that it requires an Early Access Founder's/Supporter Pack purchase.

## 10. Item sockets that remain: Runes & Soul Cores

Distinct system from skill gems — these live on gear, not the skill panel:
- Gear (helmets, gloves, boots, 1H weapons, shields, foci: 1 socket each; body armour, 2H weapons: 2 sockets each) can roll empty sockets.
- **Runes** drop from any enemy in 3 rarities (**Lesser / Normal / Greater**) and socket into gear for flat/conditional stat bonuses. Critically, **the same Rune gives a different effect depending on slot type** — e.g. a "Body Rune" in a weapon grants life leech on hit, the same Rune in chest armour grants flat +Life, and in a wand/staff grants flat +Energy Shield.
- **Soul Cores** are the Rune-equivalent that drop specifically from **Trials of Chaos**, functioning like Runes but with unique, harder-to-obtain effects.
- To add sockets to gear: Salvage a socketed item for an **Artificer's Shard**; 10 Shards combine into an **Artificer's Orb**, which adds one empty socket to a target item.

## 11. Charms

- Equip in dedicated **belt charm slots** (limited count per belt; some belts roll +charm slots).
- Each Charm auto-triggers on a specific condition (e.g., "when you take Fire damage," "when you become Ignited") and either (a) grants a temporary resistance/defense boost, or (b) for immunity-type Charms, **fully prevents** the linked ailment outright when it triggers.
- Charms consume **charges** (cap ~80) that refill by killing monsters — a passive combat-derived economy, similar in spirit to PoE1's flask-charge system but ailment/defense-focused rather than Life/Mana-restore focused.

## 12. Recent major patches affecting gems/combat (chronological, most relevant first)

| Patch | Date | Key gem/combat changes |
|---|---|---|
| **0.5.5 "Forbidden Rites"** | Sept 4, 2026 | Current patch. Ritual encounters spread through campaign, Wildwood added to endgame maps, Trial of Chaos overhaul, Abyssal Ravines added to Atlas, select Runes of Aldur systems folded into core game. |
| **0.5.0 "Return of the Ancients"** | May 29, 2026 | GGG-confirmed **final Early Access league before 1.0**. Introduced the Runes of Aldur challenge league content later partly folded into core. New skills/supports added (per community trackers). |
| **0.4.0 "The Last of the Druids"** | Dec 12, 2025 | Added the **Druid** class with Shapeshifting (Bear/Wolf/Wyvern forms) and its **Shaman** / **Oracle** ascendancies — cast long-duration elemental spells as human, then shift into a beast form to fight in melee while those effects persist. |
| **0.3.0 "The Third Edict"** | Aug 29, 2025 | Major **Support Gem rework**: removed one-copy-per-character restriction (same support usable on multiple skills), added tier system to supports, new supports (e.g. reworked/re-enabled **Grim Feast**, new **Siphon Elements** Persistent Buff). Also added Act 4 + 3 Interludes and removed Cruel difficulty; major character balance pass; added Sprinting. |
| earlier 0.2.x | 2025 | Added the **Huntress** class (Spear) and her ascendancies. |

## Sources

- [Support Gems | Path of Exile 2 Wiki (Fextralife)](https://pathofexile2.wiki.fextralife.com/Support+Gems)
- [Path of Exile 2 Skill Gems Guide | Skill Gem List, Types & Progression (Fextralife)](https://pathofexile2.wiki.fextralife.com/Skill+Gems)
- [All Skill Gems and Support Gems in POE 2 | Pro Game Guides](https://progameguides.com/path-of-exile-2/all-skill-and-support-gems-in-poe-2/)
- [PoE 2 Skill Gems: Support Sockets and Upgrades | Gamers.Wiki](https://gamers.wiki/en/games/path-of-exile-2/guides/poe-2-skill-gems-support-sockets-and-upgrades)
- [PoE 2 Gem Leveling Guide — Skill Gems, Quality | LootLore](https://lootlore.online/en/path-of-exile-2/guides/gem-leveling-guide)
- [PoE 2 0.5 New Skills & Support Gems (Return of the Ancients) | AOEAH](https://www.aoeah.com/news/4526--poe-2-05-new-skills--support-gems-return-of-the-ancients)
- [PoE 2 Gems Guide: Skills, Supports and Sockets | ExpCarry](https://expcarry.com/poe-2-skill-gems-support-gems-guide)
- [PoE2 Spirit Guide (How to Get More Spirit) | Mobalytics](https://mobalytics.gg/poe-2/guides/spirit)
- [Spirit Guide - Path of Exile 2 | Maxroll](https://maxroll.gg/poe2/resources/spirit-guide)
- [Path Of Exile 2: How To Increase Spirit | TheGamer](https://www.thegamer.com/path-of-exile-2-spirit-explained/)
- [PoE2 Spirit Reservation Guide | ARPG Build Tools](https://arpgbuildtools.com/guides/poe2-spirit-reservation/)
- [PoE 2 Spirit Reservation: How to Get More Spirit | ExpCarry](https://expcarry.com/poe-2-spirit-reservation-guide)
- [Everything We Know About Skill Gems in Path of Exile 2 | Out of Games](https://outof.games/realms/pathofexile/guides/317-everything-we-know-about-skill-gems-in-path-of-exile-2/)
- [How to Swap Weapons | Path of Exile 2 (PoE 2) | Game8](https://game8.co/games/Path-of-Exile-2/archives/487684)
- [Weapon Swap Mechanics - Path of Exile 2 | Maxroll](https://maxroll.gg/poe2/resources/weapon-swap-mechanics)
- [Weapon set - Path of Exile 2 Wiki (poe2wiki.net)](https://www.poe2wiki.net/wiki/Weapon_swap)
- [How to dual spec in Path of Exile 2 | Dot Esports](https://dotesports.com/path-of-exile/news/how-to-dual-spec-in-path-of-exile-2)
- [POE 2 Weapon Sets Guide: Mastering Dual Wielding, Off-Hands, and Weapon Swaps | UTNFL](https://www.utnfl.com/News/poe-2-weapon-sets-guide-mastering-dual-wielding-off-hands-and-weapon-swaps.html)
- [Path of Exile 2: Mechanics Guide | Deltia's Gaming](https://deltiasgaming.com/path-of-exile-2-mechanics-guide/)
- [Stun Explained: How to Stun Enemies | Path of Exile 2 (PoE 2) | Game8](https://game8.co/games/Path-of-Exile-2/archives/495713)
- [How to stun enemies in Path of Exile 2 | Sportskeeda](https://www.sportskeeda.com/mmo/path-exile-2-poe2-stun-enemies-how-stun-threshold)
- [How to stun enemies in Path of Exile 2 | Backdash](https://thebackdash.com/gaming/how-to-stun-enemies-in-path-of-exile-2/)
- [Ailment - Path of Exile Wiki (Fandom)](https://pathofexile.fandom.com/wiki/Ailment)
- [Status Ailments | Path of Exile 2 Wiki (Fextralife)](https://pathofexile2.wiki.fextralife.com/Status+Ailments)
- [What Is Elemental Ailment Threshold in Path of Exile 2 | GameRant](https://gamerant.com/path-of-exile-2-how-does-elemental-ailment-threshold-work-poe2/)
- [All Ailment types in Path of Exile 2, explained | Sportskeeda](https://www.sportskeeda.com/mmo/path-exile-2-poe2-ailment-types-guide-explained)
- [PoE 2 Ailments, Thresholds, Charms and Immunity Guide | Stratlore](https://poe2.stratlore.com/en/guides/ailments-thresholds-charms-immunity/)
- [POE 2 Elemental Ailment Threshold Mechanics Explained | ScreenPlaysMag](https://screenplaysmag.com/blog/poe-2-elemental-ailment-threshold-mechanics-explained/)
- [Best Path of Exile 2 classes ranked | PCGamesN](https://www.pcgamesn.com/path-of-exile-2/classes-best)
- [PoE 2 Class Overview - Path of Exile 2 | Maxroll](https://maxroll.gg/poe2/resources/poe-2-class-overview)
- [PoE 2 Classes - List of All Confirmed Classes & Their Breakdown | Mobalytics](https://mobalytics.gg/poe-2/guides/classes-breakdown)
- [List of Classes and Ascendancies | Path of Exile 2 | Game8](https://game8.co/games/Path-of-Exile-2/archives/485789)
- [Classes | Path of Exile 2 Wiki (Fextralife)](https://pathofexile2.wiki.fextralife.com/Classes)
- [Classes and Ascendancy Overview | Poe-Vault](https://www.poe-vault.com/poe2/guides/classes-ascendancy-overview)
- [PoE 2 Ascendancy Classes & Tier List — Interactive Explorer (0.5.4b) | Timesaver](https://timesaver.gg/tools/poe-2/ascendancy)
- [PoE 2 0.5 New Ascendancy Class and Weapon Leaks (Ranger & Huntress) | AOEAH](https://www.aoeah.com/news/4499--poe-2-05-new-ascendancy-class-and-weapon-leaks-ranger--huntress)
- [Druid | Path of Exile 2 Wiki (Fextralife)](https://pathofexile2.wiki.fextralife.com/Druid)
- [Path of Exile 2 Last of the Druids 0.4 Guide Updates & More | Maxroll](https://maxroll.gg/poe2/news/last-of-the-druids-0-4-guide-updates-more)
- [How the Druid's Shapeshifting Works in Path of Exile 2 | MMOMAX](https://www.mmomax.com/news/how-the-druids-shapeshifting-works-in-path-of-exile-2.html)
- [PoE 2 Unique Weapons — Complete List of All Uniques | Mobalytics](https://mobalytics.gg/poe-2/unique-weapons)
- [List of Weapons | Path of Exile 2 (PoE 2) | Game8](https://game8.co/games/Path-of-Exile-2/archives/487603)
- [Weapons | Path of Exile 2 Wiki (Fextralife)](https://pathofexile2.wiki.fextralife.com/Weapons)
- [Runes and Soul Cores - Path of Exile 2 | Maxroll](https://maxroll.gg/poe2/resources/runes-and-soul-cores)
- [Soul Cores Guide | Path of Exile 2 (PoE 2) Patch 0.5.0 | Fextralife](https://pathofexile2.wiki.fextralife.com/Soul+Cores)
- [Complete Guide To Runes And Socketable Items In Path Of Exile 2 | TheGamer](https://www.thegamer.com/path-of-exile-2-poe2-runes-soul-cores-talismans-sockets-effects-guide/)
- [Path of Exile 2: Runes, Sockets, & Soul Cores Explained | bo3.gg](https://bo3.gg/games/articles/path-of-exile-2-runes-sockets-and-soul-cores-explained)
- [Charms | Path of Exile 2 Wiki (Fextralife)](https://pathofexile2.wiki.fextralife.com/Charms)
- [Path of Exile 2: Charm System, Explained | GameRant](https://gamerant.com/path-of-exile-poe-2-what-is-charm-system/)
- [PoE 2 Guide: Charms Explained | Mobalytics](https://mobalytics.gg/poe-2/guides/charms)
- [PoE 2 Guide: Energy Shield Explained | Mobalytics](https://mobalytics.gg/poe-2/guides/energy-shield)
- [How To Use Energy Shield In Path Of Exile 2 | POECurrency](https://www.poecurrency.com/news/poe-2-how-to-use-energy-shield-to-enhance-your-survivability)
- [Path of Exile 2 Energy Shield Mechanics Guide | MMOJugg](https://www.mmojugg.com/news/path-of-exile-2-energy-shield-mechanics-guide.html)
- [Gemcutter's Prism | Path of Exile 2 Wiki (Fextralife)](https://pathofexile2.wiki.fextralife.com/Gemcutter's+Prism)
- [Path of Exile 2 Gemcutting Explained | VULKK](https://vulkk.com/2025/03/10/path-of-exile-2-gemcutting-explained/)
- [Uncut Support Gem | Path of Exile 2 Wiki (Fextralife)](https://pathofexile2.wiki.fextralife.com/Uncut+Support+Gem)
- [Uncut Skill Gems | Path of Exile 2 Wiki (Fextralife)](https://pathofexile2.wiki.fextralife.com/Uncut+Skill+Gems)
- [How to Get and Use Meta Gems in Path of Exile 2 | GameRant](https://gamerant.com/path-of-exile-2-meta-skill-gem-explained-poe2/)
- [PoE2 Meta Skills & Builds - Mechanics, Supports & Gear | Poe2Vault](https://www.poe2vault.com/poe2/mechanics/meta)
- [PoE2 Roadmap 2026: 0.5.5 Update, ExileCon & 1.0 Release | Expert Game Reviews](https://expertgamereviews.com/poe2-roadmap-0-5-5-exilecon-1-0-release/)
- [Path of Exile 2 Forbidden Rites League: Full 0.5.5 Patch Details & 1.0 Launch Updates | MMOExp](https://www.mmoexp.com/News/path-of-exile-2-forbidden-rites-league-september-4-full-0-5-5-patch-details-amp-1-0-launch-updates.html)
- ['Path of Exile 2' 1.0 Release Date Set for December 2026 on PC and Consoles | GameNGuide](https://www.gamenguide.com/articles/108875/20260826/path-exile-2-10-release-date-set-december-2026-pc-consoles.htm)
- [Path of Exile 2 2026 Roadmap: League Cycle, 1.0 Release Window | DedicatedGameServers](https://dedicatedgameservers.net/articles/path-of-exile-2-roadmap-2026-1-0-window/)
- [0.3.0 Patch Notes - The Third Edict - Path of Exile 2 | Maxroll](https://maxroll.gg/poe2/news/0-3-0-patch-notes-the-third-edict)
- [Path Of Exile 2 Patch 0.3.0 Support Gem Has Been Reworked In The Third Edict | EZG](https://www.ezg.com/blog/poe-2-patch-0-3-0-support-gem-reworked-the-third-edict)
- Project Vaal's own extracted wiki dataset: `public/data/wiki/2026-08-25/skills/*.json`, `public/data/wiki/2026-08-25/item-index.json` (1,118 skill-gem JSON files + 4,994-entry item index, `lastSynced` fields confirming sync through patch 0.5.5, Sept 2026) — used directly (via local `python3`/`jq`-style aggregation, not a URL) as ground truth for exact gem tag taxonomy, gem counts, Spirit reservation values, and Uncut Gem tier ranges.
