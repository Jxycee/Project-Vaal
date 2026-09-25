import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { GearItem } from '../../gearSlots';
import type { GemLoadout, GemState } from '../../gemState';
import { reservedSpirit, type ScalingEntry } from '../reservation';

// Failure modes first (AGENTS.md).

const gem = (slug: string): GearItem => ({ slug, name: slug, category: 'Active Skill Gem', isUnique: false, iconUrl: null });
const loadout = (over: Partial<GemLoadout>): GemLoadout => ({ id: Math.random().toString(36), skill: null, supports: [], sets: [1, 2], level: 1, quality: 0, ...over });
const state = (...loadouts: GemLoadout[]): GemState => ({ loadouts, primaryId: null });
const flat = (reservation: number | null): ScalingEntry[] => [{ level: 1, reservation }];

describe('reservedSpirit — every way it could be wrong', () => {
  it('is zero for no loadouts, and for a loadout with no skill', () => {
    expect(reservedSpirit(state(), new Map())).toEqual({ set1: 0, set2: 0, missing: [] });
    expect(reservedSpirit(state(loadout({})), new Map())).toEqual({ set1: 0, set2: 0, missing: [] });
  });

  it('counts a loadout only toward the sets it is tagged to', () => {
    const data = new Map([['aura', flat(30)]]);
    expect(reservedSpirit(state(loadout({ skill: gem('aura'), sets: [1] })), data)).toMatchObject({ set1: 30, set2: 0 });
    expect(reservedSpirit(state(loadout({ skill: gem('aura'), sets: [2] })), data)).toMatchObject({ set1: 0, set2: 30 });
    expect(reservedSpirit(state(loadout({ skill: gem('aura'), sets: [1, 2] })), data)).toMatchObject({ set1: 30, set2: 30 });
  });

  it("adds each support's own reservation to its skill's", () => {
    const data = new Map([['aura', flat(30)], ['buff-support', flat(10)], ['plain-support', flat(null)]]);
    const s = state(loadout({ skill: gem('aura'), supports: [gem('buff-support'), gem('plain-support')], sets: [1] }));
    expect(reservedSpirit(s, data)).toMatchObject({ set1: 40, set2: 0 });
  });

  it("reads the skill at the loadout's gem level: exact, else the nearest lower, else the lowest", () => {
    const data = new Map<string, ScalingEntry[]>([['scaling', [{ level: 1, reservation: 10 }, { level: 5, reservation: 20 }, { level: 10, reservation: 40 }]]]);
    const at = (level: number) => reservedSpirit(state(loadout({ skill: gem('scaling'), level, sets: [1] })), data).set1;
    expect(at(5)).toBe(20);
    expect(at(7)).toBe(20);
    expect(at(40)).toBe(40);
    const noLevelOne = new Map<string, ScalingEntry[]>([['late', [{ level: 3, reservation: 25 }]]]);
    expect(reservedSpirit(state(loadout({ skill: gem('late'), level: 1, sets: [1] })), noLevelOne).set1).toBe(25);
  });

  it('never counts a gem whose data is missing as zero silently — it names it, once', () => {
    const data = new Map([['aura', flat(30)]]);
    const s = state(
      loadout({ skill: gem('aura'), supports: [gem('ghost')], sets: [1] }),
      loadout({ skill: gem('ghost'), sets: [2] }),
    );
    expect(reservedSpirit(s, data)).toEqual({ set1: 30, set2: 0, missing: ['ghost'] });
  });

  it('treats an empty scaling list as missing data, not as zero', () => {
    expect(reservedSpirit(state(loadout({ skill: gem('empty'), sets: [1] })), new Map([['empty', []]])).missing).toEqual(['empty']);
  });
});

describe('reservedSpirit — against public/data/wiki', () => {
  const scalingOf = (slug: string) =>
    (JSON.parse(readFileSync(`public/data/wiki/2026-08-25/skills/${slug}.json`, 'utf8')) as { scaling: ScalingEntry[] }).scaling;
  const data = new Map([['alchemists-boon', scalingOf('alchemists-boon')], ['clarity-i', scalingOf('clarity-i')]]);

  it("Alchemist's Boon reserves 30, and 40 with Clarity I supporting it", () => {
    expect(reservedSpirit(state(loadout({ skill: gem('alchemists-boon'), sets: [1] })), data).set1).toBe(30);
    expect(
      reservedSpirit(state(loadout({ skill: gem('alchemists-boon'), supports: [gem('clarity-i')], sets: [1] })), data),
    ).toEqual({ set1: 40, set2: 0, missing: [] });
  });
});
