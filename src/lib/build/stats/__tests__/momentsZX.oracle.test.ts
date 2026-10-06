import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { getCatalogue } from '@/lib/pob/catalogue';
import { decodePobCode } from '@/lib/pob/decode';
import { mapBuild } from '@/lib/pob/mapBuild';
import { parsePobXml } from '@/lib/pob/parse';
import { collectContributions, type Collected } from '../collect';
import { makeCollectData } from '../collectData';
import { computeDefences, type DefenceSheet } from '../engine';

// ORACLE: a real level-98 Lightning Arrow Deadeye (poe.ninja, Forbidden Rites,
// character momentsZX, PoB2 code snapshot 2026-09-27 in
// docs/superpowers/handoffs/2026-09-27-momentsZX-pob2-code.txt), imported
// through the real pipeline and computed by the real engine on weapon Set II
// (the bow the character uses).
//
// Expected values are the IN-GAME column of the handoff's Appendix C
// (docs/superpowers/handoffs/2026-09-27-build-profile-redesign-handoff.md),
// i.e. what the character sheet shows. Each stat we do not yet reproduce is
// `it.fails` — it flips to `it` when the fix that closes it lands. The match
// count is the measure of the stat-accuracy work; never loosen an expectation
// to make one pass.

const IN_GAME = {
  str: 59,
  dex: 190,
  int: 142,
  life: 1458,
  mana: 1012,
  energyShield: 1348,
  evasion: 4752,
  fire: 68,
  cold: 61,
  lightning: 77,
  chaos: 42,
  spirit: 211,
} as const;

let collected: Collected;
let sheet: DefenceSheet;

beforeAll(async () => {
  const code = readFileSync('docs/superpowers/handoffs/2026-09-27-momentsZX-pob2-code.txt', 'utf8').trim();
  const decoded = decodePobCode(code);
  if (!decoded.ok) throw new Error('momentsZX code failed to decode');
  const parsed = parsePobXml(decoded.xml);
  if (!parsed.ok) throw new Error('momentsZX failed to parse');
  const mapped = await mapBuild(parsed.build, await getCatalogue(), {});
  if (!mapped.ok) throw new Error(mapped.error);
  const checkpoint = mapped.plan.checkpoints[mapped.plan.checkpoints.length - 1];

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
  const ranger = tree.classes.find((c: { name: string }) => c.name === 'Ranger');
  collected = collectContributions({ passive: checkpoint.passive_state, gear: checkpoint.gear_state, level: 98, set: 2 }, data);
  sheet = computeDefences({
    level: 98,
    classBase: { str: ranger.base_str, dex: ranger.base_dex, int: ranger.base_int },
    contributions: collected.contributions,
    resistancePenalty: collected.resistancePenalty,
    flags: collected.flags,
  });
}, 180_000);

const got = (k: keyof typeof IN_GAME): number => {
  switch (k) {
    case 'fire':
    case 'cold':
    case 'lightning':
    case 'chaos':
      return sheet[k].value;
    default:
      return sheet[k];
  }
};

// Matching today (2026-10-05 baseline: 2 of 12; 4 of 12 once desecrated mods are importable; 5 of 12 with Dexterity and Intelligence ids). Move a key from MISSING to
// MATCHING in the same commit as the fix that closes it.
const MATCHING: (keyof typeof IN_GAME)[] = ['fire', 'cold', 'chaos', 'dex', 'spirit'];
const MISSING: (keyof typeof IN_GAME)[] = ['str', 'int', 'life', 'mana', 'energyShield', 'evasion', 'lightning'];

describe('momentsZX oracle (in-game character sheet, Set II)', () => {
  it('covers every stat exactly once', () => {
    expect([...MATCHING, ...MISSING].sort()).toEqual(Object.keys(IN_GAME).sort());
  });
  for (const k of MATCHING) {
    it(`${k} matches the game (${IN_GAME[k]})`, () => {
      expect(got(k)).toBe(IN_GAME[k]);
    });
  }
  for (const k of MISSING) {
    it.fails(`${k} matches the game (${IN_GAME[k]}) — not yet`, () => {
      expect(got(k)).toBe(IN_GAME[k]);
    });
  }
});
