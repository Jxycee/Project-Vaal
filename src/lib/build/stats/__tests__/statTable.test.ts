import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GLOBAL_EFFECTS, LOCAL_EFFECTS, NOT_MODELLED, type Pool } from '../statTable';

// The stat table is hand-written, so every entry is checked against real
// data: the id must exist in our tree or mod files, AND the display text of
// something that carries it must name the pool it is mapped to. A mapping
// that only type-checks is exactly the kind of plausible, wrong claim this
// project keeps paying for (see docs/superpowers/CURRENT-STATE.md).

const nodeStats = (JSON.parse(readFileSync('public/data/tree/0.5.2/node-stats.json', 'utf8')) as { nodes: Record<string, [string, number][]> }).nodes;
const tree = (JSON.parse(readFileSync('public/data/tree/0.5.2/data.json', 'utf8')) as { nodes: Record<string, { stats?: string[] }> }).nodes;

/** stat id -> the display lines of every mod or node that carries it. */
const textsFor = new Map<string, string[]>();
const add = (stat: string, lines: string[]) => textsFor.set(stat, [...(textsFor.get(stat) ?? []), ...lines]);
for (const [id, list] of Object.entries(nodeStats)) for (const [stat] of list) add(stat, tree[id]?.stats ?? []);
const modDir = 'public/data/wiki/2026-08-25/mods';
for (const f of readdirSync(modDir)) {
  const m = JSON.parse(readFileSync(`${modDir}/${f}`, 'utf8')) as { rolls?: { stat: string }[]; stats?: string[] };
  for (const r of m.rolls ?? []) add(r.stat, m.stats ?? []);
}

const POOL_WORDS: Record<Pool, RegExp> = {
  life: /Life/,
  mana: /Mana/,
  energyShield: /Energy ?Shield/,
  armour: /Armour/,
  evasion: /Evasion/,
  str: /Strength|all Attributes/,
  dex: /Dexterity|all Attributes/,
  int: /Intelligence|all Attributes/,
  fireRes: /Fire.*Resistance|Elemental Resistances/,
  coldRes: /Cold.*Resistance|Elemental Resistances/,
  lightningRes: /Lightning.*Resistance|Elemental Resistances/,
  chaosRes: /Chaos.*Resistance/,
  fireMax: /Maximum (Fire|Elemental) Resistance|all maximum Resistances/i,
  coldMax: /Maximum (Cold|Elemental) Resistance|all maximum Resistances/i,
  lightningMax: /Maximum (Lightning|Elemental) Resistance|all maximum Resistances/i,
  chaosMax: /Maximum Chaos Resistance|all maximum Resistances/i,
  spirit: /Spirit/,
};

describe.each([
  ['global', GLOBAL_EFFECTS],
  ['local', LOCAL_EFFECTS],
])('%s stat table — against real data', (_label, table) => {
  for (const [stat, effects] of Object.entries(table)) {
    it(`${stat} exists in our data and its text names ${effects.map((e) => e.pool).join(', ')}`, () => {
      const texts = textsFor.get(stat);
      expect(texts, `${stat} is in neither the tree nor the mod files`).toBeDefined();
      for (const { pool } of effects) {
        expect(
          texts!.some((t) => POOL_WORDS[pool].test(t.replace(/\[[^|\]]*\|([^\]]*)\]/g, '$1').replace(/\[([^\]]*)\]/g, '$1'))),
          `no text for ${stat} mentions ${pool}`,
        ).toBe(true);
      }
    });
  }
});

describe('stat table — shape', () => {
  it('names every local stat with the local_ prefix, and no global one with it', () => {
    for (const stat of Object.keys(LOCAL_EFFECTS)) expect(stat.startsWith('local_'), stat).toBe(true);
    for (const stat of Object.keys(GLOBAL_EFFECTS)) expect(stat.startsWith('local_'), stat).toBe(false);
  });

  it('never both maps and lists-as-not-modelled the same stat', () => {
    for (const stat of Object.keys(NOT_MODELLED)) {
      expect(GLOBAL_EFFECTS[stat], stat).toBeUndefined();
      expect(LOCAL_EFFECTS[stat], stat).toBeUndefined();
    }
  });

  it('lists only not-modelled stats that really exist in our data', () => {
    for (const stat of Object.keys(NOT_MODELLED)) expect(textsFor.has(stat), stat).toBe(true);
  });
});
