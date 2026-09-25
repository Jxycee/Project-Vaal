import { describe, expect, it } from 'vitest';
import { buildImplicitStats, buildNodeStats } from './typedStats';

// Failure modes first (AGENTS.md). These turn decoded GGPK rows into the typed
// (stat, value) data the Slice 5 engine reads — the same Stats.Id vocabulary
// our mod files already use (plans/2026-09-25-slice5-defence-engine.md).

const stats = [{ _index: 0, Id: 'base_spirit' }, { _index: 1, Id: 'maximum_life_+%' }, { _index: 2, Id: 'base_maximum_life' }];

describe('buildNodeStats', () => {
  const row = (graphId: number, statIdx: number[], values: number[]) => ({
    PassiveSkillGraphId: graphId,
    Stats: statIdx,
    Stat1Value: values[0] ?? 0,
    Stat2Value: values[1] ?? 0,
    Stat3Value: values[2] ?? 0,
    Stat4Value: values[3] ?? 0,
    Stat5Value: values[4] ?? 0,
    Stat6Value: values[5] ?? 0,
    Stat7Value: values[6] ?? 0,
  });

  it('pairs each stat with its own value slot, in order', () => {
    expect(buildNodeStats([row(5733, [0], [10]), row(1352, [1, 2], [3, 20])], stats, [5733, 1352])).toEqual({
      '5733': [['base_spirit', 10]],
      '1352': [['maximum_life_+%', 3], ['base_maximum_life', 20]],
    });
  });

  it('keeps only nodes our tree has, and every node our tree has that the table knows', () => {
    expect(Object.keys(buildNodeStats([row(1, [0], [1]), row(2, [0], [2])], stats, [2, 99]))).toEqual(['2']);
  });

  it('keeps a node with no stats as an empty list, not missing', () => {
    expect(buildNodeStats([row(7, [], [])], stats, [7])).toEqual({ '7': [] });
  });

  it('refuses to guess: a stat index the Stats table lacks throws, naming the node', () => {
    expect(() => buildNodeStats([row(8, [42], [1])], stats, [8])).toThrow(/node 8/);
  });

  // PoE2's schema adds Stat6Value/Stat7Value at the END of the struct
  // (dat-schema poe2/_Core.gql); node 51546 "Way of the Mountain" uses 7.
  it('pairs all seven value slots, the last two included', () => {
    expect(buildNodeStats([row(51546, [0, 0, 0, 0, 0, 1, 2], [1, 2, 3, 4, 5, 6, 7])], stats, [51546])['51546'].slice(5)).toEqual([
      ['maximum_life_+%', 6],
      ['base_maximum_life', 7],
    ]);
  });

  it('refuses a node whose stats outnumber the seven value slots', () => {
    expect(() => buildNodeStats([row(9, [0, 0, 0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1, 1, 1])], stats, [9])).toThrow(/node 9/);
  });

  it('keeps the first row when two share a graph id', () => {
    expect(buildNodeStats([row(3, [0], [5]), row(3, [0], [6])], stats, [3])).toEqual({ '3': [['base_spirit', 5]] });
  });
});

describe('buildImplicitStats', () => {
  const mods = [
    { _index: 0, Id: 'RingImplicitChaos', Stat1: 0, Stat1Value: [7, 13], Stat2: null, Stat2Value: [0, 0] },
    { _index: 1, Id: 'SpearImplicitDisplaySpearThrow1', Stat1: null, Stat1Value: [0, 0] },
    { _index: 2, Id: 'Hybrid', Stat1: 1, Stat1Value: [5, 5], Stat2: 2, Stat2Value: [20, 30] },
  ];

  it('reads each implicit mod of a base as (stat, min, max), by base name', () => {
    const bases = [{ _index: 0, Name: 'Amethyst Ring', Implicit_Mods: [0] }, { _index: 1, Name: 'Plated Belt', Implicit_Mods: [2] }];
    expect(buildImplicitStats(bases, mods, stats)).toEqual({
      'Amethyst Ring': [[['base_spirit', 7, 13]]],
      'Plated Belt': [[['maximum_life_+%', 5, 5], ['base_maximum_life', 20, 30]]],
    });
  });

  it('keeps one entry per implicit MOD, so line i still means mod i; a stat-less mod is an empty entry', () => {
    const bases = [{ _index: 0, Name: 'Spear', Implicit_Mods: [1, 0] }];
    expect(buildImplicitStats(bases, mods, stats)).toEqual({ Spear: [[], [['base_spirit', 7, 13]]] });
  });

  it('leaves out a base with no implicits, and keeps the first base on a name clash', () => {
    const bases = [
      { _index: 0, Name: 'Plain', Implicit_Mods: [] },
      { _index: 1, Name: 'Twin', Implicit_Mods: [0] },
      { _index: 2, Name: 'Twin', Implicit_Mods: [2] },
    ];
    expect(buildImplicitStats(bases, mods, stats)).toEqual({ Twin: [[['base_spirit', 7, 13]]] });
  });

  it('refuses an implicit mod index the Mods table lacks, naming the base', () => {
    expect(() => buildImplicitStats([{ _index: 0, Name: 'Broken', Implicit_Mods: [9] }], mods, stats)).toThrow(/Broken/);
  });
});
