import { describe, expect, it } from 'vitest';
import { implicitStats, type TypedImplicit } from '../implicits';

// Failure modes first (AGENTS.md). An item's implicits reach the sheet by
// pairing each TYPED implicit mod (implicit-stats.json) with the DISPLAY line
// the editor shows a value input for. Ways that goes wrong:
//
//  1. A hidden fixed stat (spear throw, incursion limb) shifts a flat
//     stat-vs-range count, so every chosen value is thrown away.
//  2. A fixed stat inside a line has no range, so it must not eat a value.
//  3. A "reduced" line shows (20-30) but stores (-30..-20): the chosen value
//     must be negated, not pushed as +25.
//  4. A scaled line shows per second but stores per minute: the chosen value
//     must be mapped onto the stored range, not pushed raw.
//  5. A unique carries its base's implicit — dropping it leaves the sheet
//     quietly short. Its value input is at the UNIQUE's line index, which can
//     differ from the base's (The Coming Calamity has three lines first).
//  6. A unique whose implicits are NOT its base's must not count the base's.
//  7. A display line nothing typed covers, touching a defence, must be named.
//  8. A missing or short chosen row counts at mid-roll and says so; a full
//     one does not claim an assumption.

const life: TypedImplicit = [['base_maximum_life', 60, 80]];
const allRes: TypedImplicit = [['base_resist_all_elements_%', 7, 10]];

describe('implicitStats', () => {
  it('uses the chosen value when lines and typed mods line up one to one', () => {
    const r = implicitStats([life], ['+(60-80) to maximum Life'], ['+(60-80) to maximum Life'], [[71]]);
    expect(r.stats).toEqual([['base_maximum_life', 71]]);
    expect(r.assumedMidRoll).toBe(false);
  });

  it('pairs past a hidden fixed-stat mod instead of discarding the chosen value (1)', () => {
    const typed: TypedImplicit[] = [[['local_display_grants_spear_throw_skill', 1, 1]], [['local_maim_on_hit_%', 15, 25]]];
    const lines = ['(15-25)% chance to Maim on Hit'];
    const r = implicitStats(typed, lines, lines, [[18]]);
    expect(r.stats).toEqual([
      ['local_display_grants_spear_throw_skill', 1],
      ['local_maim_on_hit_%', 18],
    ]);
    expect(r.assumedMidRoll).toBe(false);
  });

  it('gives a fixed stat inside a line its fixed value, and the range to the varying one (2)', () => {
    const typed: TypedImplicit[] = [[['has_incursion_limb', 1, 1], ['deflection_+%', 6, 10]]];
    const lines = ['(6-10)% increased Deflection'];
    expect(implicitStats(typed, lines, lines, [[9]]).stats).toEqual([
      ['has_incursion_limb', 1],
      ['deflection_+%', 9],
    ]);
  });

  it('negates a chosen value on a "reduced" line stored negative (3)', () => {
    const typed: TypedImplicit[] = [[['base_slow_potency_+%', -30, -20]]];
    const lines = ['(20-30)% reduced Slowing Potency of Debuffs on You'];
    expect(implicitStats(typed, lines, lines, [[25]]).stats).toEqual([['base_slow_potency_+%', -25]]);
  });

  it('maps a chosen value onto a scaled stored range (4)', () => {
    const typed: TypedImplicit[] = [[['base_life_regeneration_rate_per_minute', 120, 240]]];
    const lines = ['(1-2) Life Regeneration per second'];
    expect(implicitStats(typed, lines, lines, [[1.5]]).stats).toEqual([['base_life_regeneration_rate_per_minute', 180]]);
  });

  it("counts a unique's base implicit, reading the value at the unique's own line index (5)", () => {
    const worn = [
      'Grants Skill: Level (1-20) Herald of Ash',
      'Grants Skill: Level (1-20) Herald of Ice',
      'Grants Skill: Level (1-20) Herald of Thunder',
      '+(60-80) to maximum Life',
    ];
    const r = implicitStats([life], ['+(60-80) to maximum Life'], worn, [[5], [5], [5], [77]]);
    expect(r.stats).toEqual([['base_maximum_life', 77]]);
    expect(r.assumedMidRoll).toBe(false);
    // Grants Skill touches no defence: not named.
    expect(r.uncoveredLines).toEqual([]);
  });

  it("does not count a base implicit the unique does not carry (6), and names the unique's own defence line (7)", () => {
    const r = implicitStats([allRes], ['+(7-10)% to all Elemental Resistances'], ['+(20-30) to maximum Energy Shield'], []);
    expect(r.stats).toEqual([]);
    expect(r.uncoveredLines).toEqual(['+(20-30) to maximum Energy Shield']);
  });

  it('names a defence line when no typed data exists at all (7)', () => {
    const r = implicitStats(undefined, ['+(60-80) to maximum Life'], ['+(60-80) to maximum Life'], []);
    expect(r.stats).toEqual([]);
    expect(r.uncoveredLines).toEqual(['+(60-80) to maximum Life']);
  });

  it('counts at mid-roll and says so when the chosen row is missing or short (8)', () => {
    const typed: TypedImplicit[] = [[['a', 10, 20], ['b', 30, 40]]];
    const lines = ['(10-20) a and (30-40) b'];
    const none = implicitStats(typed, lines, lines, []);
    expect(none.stats).toEqual([['a', 15], ['b', 35]]);
    expect(none.assumedMidRoll).toBe(true);
    const short = implicitStats(typed, lines, lines, [[12]]);
    expect(short.stats).toEqual([['a', 12], ['b', 35]]);
    expect(short.assumedMidRoll).toBe(true);
  });

  it('counts fixed-only implicits without asking for a value', () => {
    const typed: TypedImplicit[] = [[['base_spirit', 100, 100]]];
    const r = implicitStats(typed, ['+100 to Spirit'], ['+100 to Spirit'], []);
    expect(r.stats).toEqual([['base_spirit', 100]]);
    expect(r.assumedMidRoll).toBe(false);
    expect(r.uncoveredLines).toEqual([]);
  });
});
