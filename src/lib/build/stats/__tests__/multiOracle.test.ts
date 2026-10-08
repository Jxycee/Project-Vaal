import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { getCatalogue } from '@/lib/pob/catalogue';
import { decodePobCode } from '@/lib/pob/decode';
import { mapBuild } from '@/lib/pob/mapBuild';
import { parsePobXml } from '@/lib/pob/parse';
import { collectContributions } from '../collect';
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
  'armour-life-gemling.json': 0, // Mageblood, a RELIC body armour and 36 unreadable item lines: item coverage, not the engine
  'es-life-stormweaver.json': 4,
  'evasion-deadeye.json': 4,
  'hybrid-tactician.json': 3,
};

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
      { passive: checkpoint.passive_state, gear: checkpoint.gear_state, level: fx.level, set: fx.useSecondWeaponSet ? 2 : 1 },
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
    results[f] = { class: fx.class, source: fx.source, matched, of: KEYS.length, stats: Object.fromEntries(KEYS.map((k) => [k, { want: want[k], got: got[k], ok: got[k] === want[k] }])) };
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
