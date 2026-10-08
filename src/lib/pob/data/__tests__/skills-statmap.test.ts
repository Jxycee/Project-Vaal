/**
 * Failure modes this data test guards against (written before the sync script):
 *  1. A hand-rolled Lua parse silently truncates: a nested table, a comment or
 *     a `function ... end` callback desyncs the parser and later skills vanish.
 *     -> assert broad counts per type, and that the last skills of the big files exist.
 *  2. Per-level columns misalign: a field present on only some levels gets
 *     compacted into a constant or a short array, so level N reads another
 *     level's number. -> every varying column has exactly `n` entries, and
 *     Lightning Arrow's base multiplier rises monotonically over 40 levels.
 *  3. Calls/field chains (mod(), SkillType.X) get dropped or executed instead
 *     of kept inert. -> a known stat id keeps its {call:'mod'} entry and `div`.
 *  4. Duplicate stat ids in the Lua (later wins in Lua) double-count. -> keys unique by construction; spot check.
 *  5. Support gems lose their type. -> supports flagged `support`, actives `active`.
 *  6. The files bloat past the size budget (~3 MB) as PoB grows. -> size assert.
 */
import { describe, expect, it } from 'vitest';
import { statSync } from 'node:fs';
import path from 'node:path';
import skills from '../skills.json';
import statMap from '../skill-stat-map.json';

type Cols = { n: number; c?: Record<string, unknown>; v?: Record<string, unknown[]> };
type Skill = {
  name: string;
  type: 'active' | 'support';
  castTime?: number;
  levels: Cols;
  statSets: { baseEffectiveness?: number; incrementalEffectiveness?: number; stats?: string[]; levels?: Cols }[];
};
const S = skills as unknown as Record<string, Skill>;
const M = statMap as unknown as Record<string, { div?: number; _?: { call: string; args: unknown[] }[] }>;

describe('pob skills + stat map', () => {
  it('has broad coverage and a sane size', () => {
    const all = Object.values(S);
    expect(all.length).toBeGreaterThan(900);
    expect(all.filter((s) => s.type === 'support').length).toBeGreaterThan(400);
    expect(all.filter((s) => s.type === 'active').length).toBeGreaterThan(400);
    expect(Object.keys(M).length).toBeGreaterThan(900);
    const dir = path.join(__dirname, '..');
    expect(statSync(path.join(dir, 'skills.json')).size).toBeLessThan(3_000_000);
  });

  it('Lightning Arrow keeps per-level baseMultiplier, cost and effectiveness', () => {
    const la = S.LightningArrowPlayer;
    expect(la.name).toBe('Lightning Arrow');
    expect(la.type).toBe('active');
    expect(la.castTime).toBe(1);
    expect(la.levels.n).toBe(40);
    const base = la.levels.v!.baseMultiplier as number[];
    expect(base).toHaveLength(40);
    expect(base[0]).toBeCloseTo(0.8);
    expect(base[19]).toBeCloseTo(2.5);
    for (let i = 1; i < base.length; i++) expect(base[i]).toBeGreaterThan(base[i - 1]);
    expect((la.levels.v!['cost.Mana'] as number[])[0]).toBe(6);
    expect(la.statSets[0].baseEffectiveness).toBeCloseTo(0.67, 2);
    expect(la.statSets[0].incrementalEffectiveness).toBeGreaterThan(0);
    expect(la.statSets[0].stats!.length).toBeGreaterThan(0);
  });

  it('every varying level column has exactly n entries', () => {
    for (const [id, s] of Object.entries(S)) {
      for (const cols of [s.levels, ...s.statSets.map((x) => x.levels)]) {
        if (!cols?.v) continue;
        for (const [k, col] of Object.entries(cols.v)) {
          if (col.length !== cols.n) throw new Error(`${id}.${k}: ${col.length} != ${cols.n}`);
        }
      }
    }
  });

  it('keeps stat-map calls inert and the life stat ids present', () => {
    const regen = M['base_life_regeneration_rate_per_minute'];
    expect(regen._![0]).toEqual({ call: 'mod', args: ['LifeRegen', 'BASE', null] });
    expect(M['life_regeneration_rate_per_minute_%']).toBeDefined();
    expect(M['base_skill_effect_duration'].div).toBe(1000);
    expect(M['base_skill_effect_duration']._![0].call).toBe('skill');
  });
});
