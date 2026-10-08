import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { getCatalogue } from '@/lib/pob/catalogue';
import { decodePobCode } from '@/lib/pob/decode';
import { mapBuild } from '@/lib/pob/mapBuild';
import { parsePobXml } from '@/lib/pob/parse';
import { buildConfigFromInputs } from '../buildConfig';
import { collectContributions, type Collected } from '../collect';
import type { BuildConfig } from '../buildConfig';
import type { Pool } from '../statTable';
import { makeCollectData } from '../collectData';
import { computeDefences, type DefenceSheet } from '../engine';

// MULTI-BUILD ORACLE. The momentsZX oracle proves the engine on one character; this runs the same
// pipeline over every public character in docs/superpowers/oracle/*.json (fetched from poe.ninja by
// scripts/fetch-oracle-builds.mjs: armour/life, ES/life, evasion, hybrid), so an engine change that fixes
// one build cannot quietly break another.
//
// What the expected numbers ARE: poe.ninja's `defensiveStats`, a Path of Building simulation of the
// character, not the raw in-game sheet. A match here means "we agree with PoB2", which is the standard
// this planner is held to; the in-game column is only available for momentsZX.
//
// How this can fail (decided first):
//   1. A build cannot be imported (decode, parse or map error): the test fails loudly rather than skipping.
//   2. The engine returns NaN or a negative pool: caught by the sanity block.
//   3. A stat that matched before stops matching: the per-build FLOOR below only ever goes up.
//   4. A fixture with no PoB code or no stats (API shape changed): the shape block fails.
//   5. A conditional modifier counted regardless of the build's PoB Configuration (or never counted): the
//      "configuration gates conditional modifiers" block re-runs ordinary-deadeye (its Wild Cat "40% increased
//      Evasion Rating while moving" and Wind Dancer x3 stacks are the whole gap) with the Configuration as
//      imported, with Moving unticked, with no Configuration at all, and with the stack count removed.
//
//   6. A derived stat (DERIVED: evade, deflection, Runic Ward, regeneration, ES recharge, movement speed, charges,
//      effective health pool, maximum hits) that stops matching: the per-build DERIVED_FLOOR below only goes up.
//      The derived stats are kept apart from the 13 so "13 of 13" keeps its meaning; a derived key is compared only
//      when the fixture carries it; an immune hit (2147483647 on poe.ninja) is Infinity in the engine.
//
// Artifact: docs/superpowers/oracle/results.json, rewritten every run: per build, per stat, expected vs
// ours, and the match count (`derived` / `derivedMatched` for the derived keys). Diffing it is the accuracy report.

const DIR = 'docs/superpowers/oracle';
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'results.json' && f !== 'dps-spike.json');

type Fixture = {
  source: string;
  class: string;
  level: number;
  useSecondWeaponSet: boolean;
  pob: string;
  defensiveStats: Record<string, number>;
  breakdowns: unknown;
  skills: { name: string | null; dps: { name: string; dps: number }[] }[];
};

const KEYS = ['str', 'dex', 'int', 'life', 'mana', 'energyShield', 'armour', 'evasion', 'fire', 'cold', 'lightning', 'chaos', 'spirit'] as const;
type Key = (typeof KEYS)[number];

function expected(d: Record<string, number>): Record<Key, number> {
  return {
    str: d.strength,
    dex: d.dexterity,
    int: d.intelligence,
    life: d.life,
    mana: d.mana,
    energyShield: d.energyShield,
    armour: d.armour,
    evasion: d.evasionRating,
    fire: d.fireResistance,
    cold: d.coldResistance,
    lightning: d.lightningResistance,
    chaos: d.chaosResistance,
    spirit: d.spirit,
  };
}

// The derived defence stats (board item 26), kept apart from the 13 so the 13/13 target and its FLOOR keep their meaning.
// A key is compared only when the fixture has it (damageReductions.physical is absent on a no-armour build). poe.ninja
// prints a hit that nothing can kill as 2147483647, which the engine reports as Infinity.
const DERIVED = [
  'enemyAccuracy',
  'evadeChance',
  'deflectionRating',
  'deflectChance',
  'ward',
  'lifeRegen',
  'manaRegen',
  'esRecharge',
  'esRechargeDelay',
  'movementSpeed',
  'enduranceCharges',
  'frenzyCharges',
  'powerCharges',
  'effectiveHealthPool',
  'physicalMaxHit',
  'fireMaxHit',
  'coldMaxHit',
  'lightningMaxHit',
  'chaosMaxHit',
] as const;
type DKey = (typeof DERIVED)[number];
const IMMUNE = 2147483647;

function expectedDerived(d: Record<string, unknown>): Partial<Record<DKey, number>> {
  const n = (v: unknown) => (typeof v === 'number' ? v : undefined);
  const recovery = d.recovery as { regen?: { mana?: number }; recharge?: { energyShield?: number; delay?: number } } | undefined;
  return {
    enemyAccuracy: n(d.enemyAccuracy),
    evadeChance: n(d.evadeChance),
    deflectionRating: n(d.deflectionRating),
    deflectChance: n(d.deflectChance),
    ward: n(d.ward),
    lifeRegen: n(d.lifeRegen),
    manaRegen: n(recovery?.regen?.mana),
    esRecharge: n(recovery?.recharge?.energyShield),
    esRechargeDelay: n(recovery?.recharge?.delay),
    movementSpeed: n(d.movementSpeed),
    enduranceCharges: n(d.enduranceCharges),
    frenzyCharges: n(d.frenzyCharges),
    powerCharges: n(d.powerCharges),
    effectiveHealthPool: n(d.effectiveHealthPool),
    physicalMaxHit: n(d.physicalMaximumHitTaken),
    fireMaxHit: n(d.fireMaximumHitTaken),
    coldMaxHit: n(d.coldMaximumHitTaken),
    lightningMaxHit: n(d.lightningMaximumHitTaken),
    chaosMaxHit: n(d.chaosMaximumHitTaken),
  };
}

function oursDerived(sheet: DefenceSheet): Record<DKey, number> {
  const x = sheet.derived;
  const hit = (v: number) => (v === Infinity ? IMMUNE : v);
  return {
    enemyAccuracy: x.enemyAccuracy,
    evadeChance: x.evadeChance,
    deflectionRating: x.deflectionRating,
    deflectChance: x.deflectChance,
    ward: x.ward,
    lifeRegen: x.lifeRegen,
    manaRegen: x.manaRegen,
    esRecharge: x.esRecharge,
    esRechargeDelay: x.esRechargeDelay,
    movementSpeed: x.movementSpeed,
    enduranceCharges: x.enduranceCharges,
    frenzyCharges: x.frenzyCharges,
    powerCharges: x.powerCharges,
    effectiveHealthPool: hit(x.effectiveHealthPool),
    physicalMaxHit: hit(x.maxHit.physical),
    fireMaxHit: hit(x.maxHit.fire),
    coldMaxHit: hit(x.maxHit.cold),
    lightningMaxHit: hit(x.maxHit.lightning),
    chaosMaxHit: hit(x.maxHit.chaos),
  };
}

/** Ratchet for the derived keys: the least number each build must match. Raise it when a fix lands; never lower it. */
const DERIVED_FLOOR: Record<string, number> = {
  'armour-life-gemling.json': 9, // of 19
  'es-life-stormweaver.json': 8, // of 19
  'evasion-deadeye.json': 14, // of 19
  'hybrid-tactician.json': 9, // round 10: Defiance Banner partly counted (bannerPlanted, Banner aura magnitudes); was 7 // of 19
  'ordinary-armour-1.json': 9, // of 17
  'ordinary-caster-1.json': 9, // of 17
  'ordinary-caster-2.json': 13, // round 9; was 12 // of 19
  'ordinary-ci-acolyte.json': 18, // of 19
  'ordinary-ci-disciple.json': 19, // of 19
  'ordinary-ci-es-disciple.json': 12, // of 19
  'ordinary-deadeye.json': 13, // of 19
  'ordinary-evasion-1.json': 12, // of 19
  'ordinary-evasion-2.json': 18, // of 19
  'ordinary-hybrid-1.json': 12, // round 6; was 9 (round 4: item-local enchant lines (The Vertex)); of 19
  'ordinary-hybrid-2.json': 10, // of 19
  'ordinary-life-1.json': 12, // of 19
  'ordinary-oracle.json': 16, // of 17
  // Round-4 class-coverage pool (docs/superpowers/oracle, fetched with scripts/fetch-oracle-pool.mjs): classes the set lacked.
  'ordinary-amazon-1.json': 15, // of 19
  'ordinary-amazon-2.json': 9, // round 3: Stalking Panther (slot mores); was 7 // of 19
  'ordinary-martial-artist-1.json': 8, // round 1 of the accuracy loop: Fists of Stone per-level defences; was 7 // of 19
  'ordinary-martial-artist-2.json': 13, // round 1 of the accuracy loop: Fists of Stone per-level defences and a jewel's Effect of Notable Passive Skills in Radius; was 6 // of 19
  'ordinary-pathfinder-1.json': 12, // of 19
  'ordinary-pathfinder-2.json': 14, // round 3: FullLife derived; was 13 // of 19
  'ordinary-spirit-walker-1.json': 12, // of 19
  'ordinary-spirit-walker-2.json': 15, // of 19
  'ordinary-titan-1.json': 15, // round 1 of the accuracy loop: Hulking Form (effect of Small Passive Skills), Stone Skin (slot more); was 10 // of 19
  // Round-5 class-coverage set (Runes of Aldur): classes with no fixture yet; FLOOR = the match when added.
  'ordinary-druid-1.json': 9, // of 19
  'ordinary-huntress-1.json': 19, // of 19
  'ordinary-infernalist-1.json': 11, // of 19
  'ordinary-invoker-1.json': 18, // of 19
  'ordinary-mercenary-1.json': 17, // round 2: charms count through their base buff (Sapphire +25% Cold, Topaz +25% Lightning); was 14 // of 19
  'ordinary-monk-1.json': 12, // of 19
  'ordinary-shaman-1.json': 9, // of 19
  'ordinary-smith-of-kitava-1.json': 8, // of 17
  'ordinary-sorceress-1.json': 10, // of 19
  'ordinary-witchhunter-1.json': 7, // of 17
  'ordinary-warbringer-1.json': 14, // round 5: Rage and Summoned Totems feed Armour/Evasion, so Life/Armour/Evasion match; was 9 (round 3: Blood Magic; was 8) // of 17
};

const ours = (sheet: DefenceSheet, k: Key): number => (k === 'fire' || k === 'cold' || k === 'lightning' || k === 'chaos' ? sheet[k].value : sheet[k]);

// Ratchet: the least number of the 13 stats each build must match. Raise it when a fix lands; never lower it.
const FLOOR: Record<string, number> = {
  'armour-life-gemling.json': 8, // Gem Enthusiast now counted; Mageblood, a RELIC body armour and 36 unreadable item lines: item coverage, not the engine
  'es-life-stormweaver.json': 13, // round 8: 13 of 13 (Low Life derived from Atziri's Communion, Defiance); was 11 // Kalandra's Touch reflects the opposite ring (collect.ts); a radius jewel's notables (fire, spirit)
  'evasion-deadeye.json': 12, // the weapon set PoB had active (set 2) now read from the code; still short: chaos resistance via a Time-Lost jewel's radius grant
  'hybrid-tactician.json': 10, // round 9 (printed-line truth for uniques); was 9 // round 6: Ancient Aegis / Fortified Aegis scale one slot (statTable.ts); was 8
  // The ordinary set (board item 30): mid-complexity public builds. The goal is 13 of 13 on every one.
  'ordinary-ci-acolyte.json': 13, // 13 of 13: Purity of Ice (a socketed Aura) puts +43% Cold Resistance on the character - skillBuffs.ts, scaled by 11% increased Aura magnitudes
  'ordinary-ci-disciple.json': 13, // 13 of 13: Time-Lost Sapphire's "Notable Passive Skills in Radius also grant" x7 (collect.ts radiusGrants) + Warding Fetish's Focus ES
  'ordinary-ci-es-disciple.json': 13, // 13 of 13: Mageblood's legacies (stats/legacies.ts)
  'ordinary-deadeye.json': 13, // 13 of 13: the PoB Configuration (conditionMoving, windDancerStacks) gates The Wild Cat and Wind Dancer (buildConfig.ts) + Beastial Skin's body armour Evasion
  'ordinary-oracle.json': 13, // 13 of 13: Eldritch Battery moves flat ES into Mana (engine.ts) + PoB's printed rune lines (Blood League 469, Viper Crest 3%)
  // Round-3 pool (31 Forbidden Rites characters fetched with scripts/fetch-oracle-pool.mjs, the 8 best that wear no Mageblood or RELIC item).
  // FLOOR = the match when added; the gaps lists in results.json say what is missing. Shape = the build's defence layer.
  'ordinary-evasion-1.json': 13, // 13 of 13 (round 4): a unique whose wiki page lists its base as the first line (Hand of Wisdom and Action) resolves its base; was: // the PoB code's own weapon set (2) + Charge Regulation's endurance-charge threshold; still short,  Deadeye; five uniques not in our data (Hand of Wisdom and Action, From Nothing, Against the Darkness, Megalomaniac, Heart of the Well)
  'ordinary-armour-1.json': 13, // 13 of 13 (round 7): Runeseeker's 200% rune effect keeps the rune's 15% less AND an extra 30% less (0.85 x 0.70 -> 0.60, collect.ts splitRuneMore); was 12. Round 4: Virtuous Barrier motes (buildConfig.moteCounts), the printed Runemastered base (craft.baseSlug), PoB base defences; short: Life (Runeseeker rune 45% less); was: // Gemling Legionnaire, life/armour/evasion; Runeseeker's Call (-45% less maximum Life rune line) and Virtuous Barrier mote counts
  'ordinary-caster-1.json': 13, // 13 of 13 (round 5): a radius jewel's "also grant" lines count after every item's "Allocates X" (Megalomaniac) has allocated its notables; was: // Chronomancer; only Mana off
  'ordinary-hybrid-1.json': 13, // 13 of 13 (round 6): slot increases (Ancient Aegis armour, Fortified Aegis), the unticked Silent Hall quest (BuildConfig.questsOff), Kraken Bane's rune line 'Aura Skills have 25% increased Magnitudes'; was: 9
  'ordinary-caster-2.json': 13, // round 9: 13 of 13 (a corrupted unique no longer reads a line PoB did not print: Atziri's Step has no Life; Voices opens its Sinister sockets; Enhanced Barrier moves 5% of Life base to ES); round 8 was 11: Armour and Evasion match (Low Life derived from Atziri's Communion reserving 66% of Life: Defiance's 80%; The Winter Owl's 3% Evasion per 10 Int); short: Life (Atziri's Step corrupted line, Enhanced Barrier 5% of Life to ES) and ES (Voices' Sinister sockets); was 9 // Stormweaver; untyped unique lines read from their text (Controlled Metamorphosis -(20-5)% to all Elemental Resistances) + the "0% to" cache entry no longer poisons "-15% to Cold Resistance"; still short: Adonia's Ego per-Power-Charge resistances, ES/evasion nodes
  'ordinary-life-1.json': 13, // 13 of 13 (round 6): Crimson Power (life = 100% of body armour ES, PercentStat), Multiplier:CorruptedItem (Morior Invictus rune line); was 12. Round 4: the printed Runemastered base (Alpha's Howl); was: // weapon set 2 from the code + Gem Enthusiast (support colours); still short: Crimson Power (life from body ES), Morior +8% life; was: Blood Mage, life; Morior per-socket lines now counted; still short: 1% max Life per Corrupted Item Equipped, Alpha's Howl Runemastered cap, node 31223
  'ordinary-hybrid-2.json': 13, // 13 of 13: Ring 3 (Unfurled Finger), Mystic Attunement's 25% bonus copy of ring/amulet modifiers (collect.ts bonusEffectFromJewellery, floored), Andvarius's untyped -20% line, Grand Spectrum's per-jewel multiplier
  'ordinary-evasion-2.json': 13, // 13 of 13: the PoB code's weapon set (2) puts Palm of the Dreamer and the set-2 passives (Cooked, Chakra of Life) in; Charge Regulation counts with the Configuration's use-endurance-charges switch (skillBuffs.ts)
  // Round-4 class-coverage set: 10 characters (no Mageblood, no RELIC item) of classes the ordinary set lacked; FLOOR = the match when added.
  'ordinary-amazon-1.json': 13, // 13 of 13 at the start (Kustu, evasion/ES)
  'ordinary-amazon-2.json': 13, // round 3: 13 of 13, Stalking Panther doubles helmet/gloves/boots Evasion and halves body (statTable.ts); was 12 // round 2: 12 of 13; a verbatim "N% increased ... from Equipped Body Armour" line (Heart of the Well) scopes to the body slot; was 11, short ES (4123/4800) and Evasion (15605/30956)
  'ordinary-martial-artist-1.json': 13, // round 6: the Arm 1/2 and Leg 1/2 (Transcendent Limb) slots are now read, so Evasive Leg's 26% increased Evasion counts; before: 12 of 13 // round 1 of the accuracy loop: 12 of 13 (Way of the Stonefist's Fists of Stone: its per-player-level defences count and the unique's untransformed lines do not); short: Evasion (the Evasive Leg limb slot); was 9 at the start: short Mana, ES, Evasion; Armour 60 where PoB has 0
  'ordinary-martial-artist-2.json': 13, // round 1 of the accuracy loop: 13 of 13 (Fists of Stone per-level defences; a Time-Lost jewel's 22% increased Effect of Notable Passive Skills in Radius scales its notables, floored); was 5 at the start: attributes, Life (over), Mana, ES, Evasion short; Armour 34 where PoB has 0
  'ordinary-pathfinder-1.json': 13, // 13 of 13 at the start (zzzuzaha2, flask/charm build)
  'ordinary-pathfinder-2.json': 13, // round 3: 13 of 13, High Alert counts because an unreserved-Life character is on Full Life (reservation.ts); was 12 // 12 of 13 at the start: short Evasion (3899/4586)
  'ordinary-spirit-walker-1.json': 13, // round 4 of the accuracy loop: 13 of 13 (Uhtred's Exodus: +3 gem levels with no other support, so Charge Regulation reads 21% more not 20%: skillBuffs.ts, support-levels.json); was 10: ES, Armour, Evasion off by 1 to 6
  'ordinary-spirit-walker-2.json': 13, // 13 of 13 at the start
  'ordinary-titan-1.json': 13, // round 1 of the accuracy loop: 13 of 13 (Hulking Form scales plain small passives by 50%, floored, never the generic attribute nodes or ascendancy ones; Stone Skin is a body-armour-only more; Kaom's Heart 'You have no Spirit'); was 4 at the start: strength/Life/Mana/ES/Armour/Evasion short, Spirit 200 where PoB has 0 (Grand Spectrum x3, Darkness Enthroned)
  // Round-5 class-coverage set (Runes of Aldur, no Mageblood, no RELIC item): classes with no fixture yet; FLOOR = the match when added.
  'ordinary-druid-1.json': 12, // round 5 of the engine loop: Ingenuity's "N% increased bonuses gained from left/right Equipped Ring" (lineMods.ts EFFECT_OF_BONUSES_LINE) scales both rings; was 8. Short: Lightning (76/75: "+1% Maximum Lightning Resistance while Shapeshifted" needs the Shapeshifted condition PoB derives from the main skill)
  'ordinary-huntress-1.json': 13, // 13 of 13 at the start
  'ordinary-infernalist-1.json': 12, // short: Spirit (234/380)
  'ordinary-invoker-1.json': 12, // short: Mana (2253/2549)
  'ordinary-mercenary-1.json': 13, // round 2: 13 of 13, an active charm adds its base buff (collect.ts collectCharms: Sapphire +25% Cold, Topaz +25% Lightning, same-base charms merge); was 11
  'ordinary-monk-1.json': 12, // short: Energy Shield (8225/8387)
  'ordinary-shaman-1.json': 5, // short: attributes, Life, Mana, Armour, Evasion, Lightning (Armour 8691/17541, Evasion 1291/0)
  'ordinary-smith-of-kitava-1.json': 9, // short: Armour, Evasion, Cold and Lightning resistance (-24/87)
  'ordinary-sorceress-1.json': 12, // short: Energy Shield (8661/9143)
  'ordinary-witchhunter-1.json': 11, // short: Evasion (20875/23064), Chaos resistance (20/24)
  'ordinary-warbringer-1.json': 13, // round 5: 13 of 13 (corrupted-item count excludes jewels, includes flasks and charms; Rage and Summoned Totems multiply Armour and Evasion passives); was 10. round 3: Blood Magic sets Mana 0 (engine.ts); short Life, Armour, Evasion; was 9 // 9 of 13 at the start: Mana 552 where PoB has 0, Armour and Evasion short, Life over
};


// PoB's own per-stat build-up (breakdowns.stats[i].mods = [kind 0 flat|1 inc|2 more, value, sourceIndex]) says WHICH
// modifiers PoB counts that we do not. Stat index -> our pool, and the diff itself.
const BREAKDOWN_POOLS: Record<string, Pool> = { '0': 'life', '1': 'mana', '2': 'energyShield', '3': 'spirit', '5': 'evasion', '6': 'str', '7': 'dex', '8': 'int' };
const KIND = ['flat', 'increased', 'more'] as const;
type Breakdowns = { stats: Record<string, { mods: [number, number, number][] }>; sources: ([number, string?, string?] | [number])[] };

/** Modifiers PoB lists for a pool that none of our contributions match by kind and value. Class base and attribute-derived entries (source types 0 and 5) are formulas, not modifiers, and are skipped. */
function missingMods(b: Breakdowns, pool: Pool, idx: string, mine: Collected['contributions']): string[] {
  const have = new Map<string, number>();
  for (const c of mine.filter((x) => x.pool === pool)) {
    const k = c.kind + '|' + Math.round(c.value * 100) / 100;
    have.set(k, (have.get(k) ?? 0) + 1);
  }
  const out: string[] = [];
  for (const [kind, value, si] of b.stats[idx]?.mods ?? []) {
    const src = b.sources[si];
    if (src && (src[0] === 0 || src[0] === 5 || String(src[1] ?? '').startsWith('Attribute:'))) continue;
    const key = (KIND[kind] ?? 'kind' + kind) + '|' + value;
    const n = have.get(key) ?? 0;
    if (n > 0) have.set(key, n - 1);
    else out.push((KIND[kind] ?? kind) + ' ' + value + ' from ' + (src ? (src[1] ?? 'source type ' + src[0]) : 'source ' + si));
  }
  return out;
}

const results: Record<string, unknown> = {};
const sheets = new Map<string, { want: Record<Key, number>; got: Record<Key, number>; matched: number; dWant: Partial<Record<DKey, number>>; dGot: Record<DKey, number>; dMatched: number; dOf: number }>();
/** Re-runs a fixture's pipeline with its PoB Configuration replaced (undefined = the build came without one). */
const reruns = new Map<string, (config: BuildConfig | undefined) => { sheet: DefenceSheet; collected: Collected }>();

beforeAll(async () => {
  const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
  const dir = (d: string) => new Map(readdirSync(d).map((f) => [f.replace(/\.json$/, ''), json(`${d}/${f}`)] as [string, unknown]));
  const tree = json('public/data/tree/0.5.2/data.json');
  const data = makeCollectData({
    tree,
    nodeStats: json('public/data/tree/0.5.2/node-stats.json'),
    implicitStats: json('public/data/wiki/2026-08-25/implicit-stats.json'),
    uniqueStats: json('public/data/wiki/2026-08-25/unique-stats.json'),
    items: dir('public/data/wiki/2026-08-25/items'),
    mods: dir('public/data/wiki/2026-08-25/mods'),
  });
  const catalogue = await getCatalogue();

  for (const f of FILES) {
    const fx = json(`${DIR}/${f}`) as Fixture;
    const decoded = decodePobCode(fx.pob.trim());
    if (!decoded.ok) throw new Error(`${f}: PoB code failed to decode`);
    const parsed = parsePobXml(decoded.xml);
    if (!parsed.ok) throw new Error(`${f}: failed to parse`);
    const mapped = await mapBuild(parsed.build, catalogue, {});
    if (!mapped.ok) throw new Error(`${f}: ${mapped.error}`);
    const checkpoint = mapped.plan.checkpoints[mapped.plan.checkpoints.length - 1];
    const cls = tree.classes.find((c: { name: string }) => c.name === mapped.plan.build.class);
    if (!cls) throw new Error(`${f}: class ${mapped.plan.build.class} not in the tree`);
    // The weapon set is the one PoB had active in the code (<Items useSecondWeaponSet>); the fixture's own flag was
    // never filled in (false everywhere), and set 2 holds Palm of the Dreamer and the set-2-only passives PoB counted.
    const run = (config: BuildConfig | undefined) => {
      const { buildConfig: _imported, ...rest } = checkpoint.passive_state;
      const collected = collectContributions(
        { passive: config ? { ...rest, buildConfig: config } : rest, gear: checkpoint.gear_state, level: fx.level, set: parsed.build.useSecondWeaponSet ? 2 : 1, gems: checkpoint.gem_state },
        data,
      );
      const sheet = computeDefences({
        level: fx.level,
        classBase: { str: cls.base_str, dex: cls.base_dex, int: cls.base_int },
        contributions: collected.contributions,
        resistancePenalty: collected.resistancePenalty,
        flags: collected.flags,
        ...(config ? { config } : {}),
      });
      return { sheet, collected };
    };
    reruns.set(f, run);
    const { sheet, collected } = run(checkpoint.passive_state.buildConfig);
    const want = expected(fx.defensiveStats);
    const got = Object.fromEntries(KEYS.map((k) => [k, ours(sheet, k)])) as Record<Key, number>;
    const matched = KEYS.filter((k) => got[k] === want[k]).length;
    const dWant = expectedDerived(fx.defensiveStats);
    const dGot = oursDerived(sheet);
    const dKeys = DERIVED.filter((k) => dWant[k] !== undefined);
    const dMatched = dKeys.filter((k) => dGot[k] === dWant[k]).length;
    sheets.set(f, { want, got, matched, dWant, dGot, dMatched, dOf: dKeys.length });
    const gaps = Object.fromEntries(Object.entries(BREAKDOWN_POOLS).map(([idx, pool]) => [pool, missingMods(fx.breakdowns as Breakdowns, pool, idx, collected.contributions)]));
    results[f] = { gaps, notCounted: collected.notCounted, class: fx.class, source: fx.source, matched, of: KEYS.length, stats: Object.fromEntries(KEYS.map((k) => [k, { want: want[k], got: got[k], ok: got[k] === want[k] }])), derivedMatched: dMatched, derivedOf: dKeys.length, derived: Object.fromEntries(dKeys.map((k) => [k, { want: dWant[k], got: dGot[k], ok: dGot[k] === dWant[k] }])) };
  }
  writeFileSync(`${DIR}/results.json`, JSON.stringify(results, null, 2));
}, 600_000);

describe('multi-build oracle (poe.ninja PoB simulation)', () => {
  it('has fixtures, each with a PoB code and the stats we compare', () => {
    expect(FILES.length).toBeGreaterThanOrEqual(4);
    for (const f of FILES) {
      const fx = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) as Fixture;
      expect(fx.pob.length, `${f} has no PoB code`).toBeGreaterThan(1000);
      for (const v of Object.values(expected(fx.defensiveStats))) expect(typeof v, `${f} is missing a stat`).toBe('number');
    }
  });

  describe('the PoB Configuration gates conditional modifiers (ordinary-deadeye.json)', () => {
    const f = 'ordinary-deadeye.json';
    const imported = () => sheets.get(f)!;
    const rerun = (config: BuildConfig | undefined) => reruns.get(f)!(config);
    const asImported = () => {
      const fx = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) as Fixture;
      return { fx, config: undefined as BuildConfig | undefined };
    };

    it('the export carried the Moving flag and 3 Wind Dancer stacks', async () => {
      const { fx } = asImported();
      const parsed = parsePobXml((decodePobCode(fx.pob.trim()) as { ok: true; xml: string }).xml);
      if (!parsed.ok) throw new Error('parse');
      const config = buildConfigFromInputs(parsed.build.configInputs ?? []);
      expect(config.conditions).toContain('Moving');
      expect(config.multipliers.WindDancerStacks).toBe(3);
    });
    const ticked: BuildConfig = { conditions: ['Moving'], multipliers: { WindDancerStacks: 3 } };
    it('Moving unticked: the Wild Cat does not count (and nothing is claimed unknown)', () => {
      const off = rerun({ ...ticked, conditions: [] });
      expect(off.sheet.evasion).toBeLessThan(imported().want.evasion);
      expect(off.collected.notCounted.join('|')).not.toMatch(/Moving/);
    });
    it('no stacks: Wind Dancer adds nothing, Moving alone leaves Evasion short of PoB', () => {
      const none = rerun({ conditions: ['Moving'], multipliers: {} });
      expect(none.sheet.evasion).toBeLessThan(imported().want.evasion);
      expect(none.sheet.evasion).toBeGreaterThan(rerun({ conditions: [], multipliers: {} }).sheet.evasion);
    });
    it('stacks past the skill limit are capped at it', () => {
      expect(rerun({ ...ticked, multipliers: { WindDancerStacks: 99 } }).sheet.evasion).toBe(imported().want.evasion);
    });
    it('no Configuration at all: the sheet NAMES what needs it instead of guessing', () => {
      const none = rerun(undefined);
      expect(none.sheet.evasion).toBeLessThan(imported().want.evasion);
      const named = none.collected.notCounted.join('|');
      expect(named).toMatch(/The Wild Cat.*needs Moving/);
      expect(named).toMatch(/Wind Dancer.*needs/);
    });
  });

  for (const f of FILES) {
    it(`${f}: the sheet is sane`, () => {
      const s = sheets.get(f)!;
      for (const k of KEYS) expect(Number.isFinite(s.got[k]), `${k} is not finite`).toBe(true);
      for (const k of ['life', 'mana', 'energyShield', 'armour', 'evasion', 'spirit'] as const) expect(s.got[k], `${k} is negative`).toBeGreaterThanOrEqual(0);
      for (const k of DERIVED) expect(Number.isNaN(s.dGot[k]), `${k} is NaN`).toBe(false);
    });
    it(`${f}: matches at least ${FLOOR[f] ?? 0} of ${KEYS.length} stats and ${DERIVED_FLOOR[f] ?? 0} derived`, () => {
      const s = sheets.get(f)!;
      expect(s.matched, `matched ${s.matched}: see ${DIR}/results.json`).toBeGreaterThanOrEqual(FLOOR[f] ?? 0);
      expect(s.dMatched, `derived matched ${s.dMatched} of ${s.dOf}: see ${DIR}/results.json`).toBeGreaterThanOrEqual(DERIVED_FLOOR[f] ?? 0);
    });
  }
});
