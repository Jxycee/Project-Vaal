import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { getCatalogue } from '@/lib/pob/catalogue';
import { decodePobCode } from '@/lib/pob/decode';
import { mapBuild } from '@/lib/pob/mapBuild';
import { parsePobXml } from '@/lib/pob/parse';
import { collectContributions, type Collected } from '../collect';
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
//
// Artifact: docs/superpowers/oracle/results.json, rewritten every run: per build, per stat, expected vs
// ours, and the match count. Diffing it is the accuracy report.

const DIR = 'docs/superpowers/oracle';
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'results.json');

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

const ours = (sheet: DefenceSheet, k: Key): number => (k === 'fire' || k === 'cold' || k === 'lightning' || k === 'chaos' ? sheet[k].value : sheet[k]);

// Ratchet: the least number of the 13 stats each build must match. Raise it when a fix lands; never lower it.
const FLOOR: Record<string, number> = {
  'armour-life-gemling.json': 2, // Mageblood, a RELIC body armour and 36 unreadable item lines: item coverage, not the engine
  'es-life-stormweaver.json': 7, // Kalandra's Touch reflects the opposite ring (collect.ts); a radius jewel's notables (fire, spirit)
  'evasion-deadeye.json': 5, // chaos resistance via a Time-Lost jewel's radius grant
  'hybrid-tactician.json': 3,
  // The ordinary set (board item 30): mid-complexity public builds. The goal is 13 of 13 on every one.
  'ordinary-ci-acolyte.json': 13, // 13 of 13: Purity of Ice (a socketed Aura) puts +43% Cold Resistance on the character - skillBuffs.ts, scaled by 11% increased Aura magnitudes
  'ordinary-ci-disciple.json': 13, // 13 of 13: Time-Lost Sapphire's "Notable Passive Skills in Radius also grant" x7 (collect.ts radiusGrants) + Warding Fetish's Focus ES
  'ordinary-ci-es-disciple.json': 13, // 13 of 13: Mageblood's legacies (stats/legacies.ts)
  'ordinary-deadeye.json': 12, // evasion: Wind Dancer's stacks and The Wild Cat's "while moving" come from PoB's Configuration tab (windDancerStacks, conditionMoving), not imported yet
  'ordinary-oracle.json': 13, // 13 of 13: Eldritch Battery moves flat ES into Mana (engine.ts) + PoB's printed rune lines (Blood League 469, Viper Crest 3%)
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
const sheets = new Map<string, { want: Record<Key, number>; got: Record<Key, number>; matched: number }>();

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
    const collected = collectContributions(
      { passive: checkpoint.passive_state, gear: checkpoint.gear_state, level: fx.level, set: fx.useSecondWeaponSet ? 2 : 1, gems: checkpoint.gem_state },
      data,
    );
    const sheet = computeDefences({
      level: fx.level,
      classBase: { str: cls.base_str, dex: cls.base_dex, int: cls.base_int },
      contributions: collected.contributions,
      resistancePenalty: collected.resistancePenalty,
      flags: collected.flags,
    });
    const want = expected(fx.defensiveStats);
    const got = Object.fromEntries(KEYS.map((k) => [k, ours(sheet, k)])) as Record<Key, number>;
    const matched = KEYS.filter((k) => got[k] === want[k]).length;
    sheets.set(f, { want, got, matched });
    const gaps = Object.fromEntries(Object.entries(BREAKDOWN_POOLS).map(([idx, pool]) => [pool, missingMods(fx.breakdowns as Breakdowns, pool, idx, collected.contributions)]));
    results[f] = { gaps, class: fx.class, source: fx.source, matched, of: KEYS.length, stats: Object.fromEntries(KEYS.map((k) => [k, { want: want[k], got: got[k], ok: got[k] === want[k] }])) };
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

  for (const f of FILES) {
    it(`${f}: the sheet is sane`, () => {
      const s = sheets.get(f)!;
      for (const k of KEYS) expect(Number.isFinite(s.got[k]), `${k} is not finite`).toBe(true);
      for (const k of ['life', 'mana', 'energyShield', 'armour', 'evasion', 'spirit'] as const) expect(s.got[k], `${k} is negative`).toBeGreaterThanOrEqual(0);
    });
    it(`${f}: matches at least ${FLOOR[f] ?? 0} of ${KEYS.length} stats`, () => {
      const s = sheets.get(f)!;
      expect(s.matched, `matched ${s.matched}: see ${DIR}/results.json`).toBeGreaterThanOrEqual(FLOOR[f] ?? 0);
    });
  }
});
