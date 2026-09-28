import { describe, expect, it } from 'vitest';
import { emptyGearState } from './gearState';
import type { GearItem } from './gearSlots';
import type { GemLoadout, GemState } from './gemState';
import { deriveMainSkill } from './gemState';
import { headlineSet, keyItems, loadoutsMainFirst, mainSkillLoadout, parseTab, patchQuery } from './buildPage';

const item = (name: string, isUnique = false): GearItem => ({ slug: name.toLowerCase().replace(/\s+/g, '-'), name, isUnique }) as GearItem;
const loadout = (id: string, skill: string | null, sets: (1 | 2)[] = [1, 2]): GemLoadout =>
  ({ id, skill: skill ? item(skill) : null, supports: [], sets, level: 1, quality: 0 }) as GemLoadout;

describe('parseTab', () => {
  it('accepts the five tabs', () => {
    for (const t of ['overview', 'gear', 'skills', 'tree', 'stats']) expect(parseTab(t)).toBe(t);
  });
  it('falls back to overview for missing, unknown, and differently-cased values', () => {
    expect(parseTab(null)).toBe('overview');
    expect(parseTab(undefined)).toBe('overview');
    expect(parseTab('')).toBe('overview');
    expect(parseTab('Gear')).toBe('overview');
    expect(parseTab('notes')).toBe('overview');
    expect(parseTab('__proto__')).toBe('overview');
  });
});

describe('main skill ordering', () => {
  const a = loadout('a', 'Arc');
  const b = loadout('b', 'Lightning Arrow', [2]);
  const c = loadout('c', 'Pounce');
  it('puts the primary loadout first and keeps the rest in stored order', () => {
    const gems: GemState = { loadouts: [a, b, c], primaryId: 'b' };
    expect(loadoutsMainFirst(gems).map((l) => l.id)).toEqual(['b', 'a', 'c']);
  });
  it('falls back to the first skilled loadout when the primary id points at nothing', () => {
    const gems: GemState = { loadouts: [a, b, c], primaryId: 'gone' };
    expect(mainSkillLoadout(gems)?.id).toBe('a');
    expect(loadoutsMainFirst(gems).map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });
  it('does not treat an empty-skill loadout as the main skill', () => {
    const empty = loadout('e', null);
    const gems: GemState = { loadouts: [a, empty], primaryId: 'e' };
    expect(mainSkillLoadout(gems)?.id).toBe('a');
    expect(loadoutsMainFirst(gems).map((l) => l.id)).toEqual(['a', 'e']);
  });
  it('never duplicates or drops a loadout', () => {
    const gems: GemState = { loadouts: [a, b, c], primaryId: 'c' };
    expect(loadoutsMainFirst(gems)).toHaveLength(3);
  });
  it('returns null when no loadout has a skill', () => {
    const empty = loadout('e', null);
    const gems: GemState = { loadouts: [empty], primaryId: 'e' };
    expect(mainSkillLoadout(gems)).toBeNull();
    expect(loadoutsMainFirst(gems).map((l) => l.id)).toEqual(['e']);
  });
  it('mainSkillLoadout and deriveMainSkill agree on the skill name', () => {
    const states = [
      { loadouts: [a, b, c], primaryId: 'b' },
      { loadouts: [a, b, c], primaryId: 'gone' },
      { loadouts: [a, loadout('e', null)], primaryId: 'e' },
      { loadouts: [loadout('e', null)], primaryId: 'e' },
    ];
    for (const state of states) {
      const mainLoadout = mainSkillLoadout(state);
      const derived = deriveMainSkill(state);
      expect(mainLoadout?.skill?.name ?? null).toBe(derived);
    }
  });
});

describe('headlineSet', () => {
  it('uses the set the main skill is tagged for', () => {
    expect(headlineSet({ loadouts: [loadout('b', 'LA', [2])], primaryId: 'b' })).toBe(2);
  });
  it('uses Set I when the main skill is in both sets, or there is none', () => {
    expect(headlineSet({ loadouts: [loadout('b', 'LA', [1, 2])], primaryId: 'b' })).toBe(1);
    expect(headlineSet({ loadouts: [], primaryId: null })).toBe(1);
    expect(headlineSet({ loadouts: [loadout('b', 'LA', [])], primaryId: 'b' })).toBe(1);
  });
  it("falls back to the first skilled loadout's set when there is no primary", () => {
    expect(headlineSet({ loadouts: [loadout('x', null, [1]), loadout('b', 'LA', [2])], primaryId: null })).toBe(2);
  });
});

describe('keyItems', () => {
  it('is empty for no gear', () => {
    expect(keyItems(emptyGearState(), 1)).toEqual([]);
  });
  it("takes the headline set's weapons, not the other set's, plus every unique", () => {
    const gear = {
      ...emptyGearState(),
      weapon1_main: item('Nettle Talisman'),
      weapon2_main: item('Obliterator Bow'),
      weapon2_off: item("Cadiro's Gambit", true),
      belt: item('Headhunter', true),
      head: item('Grinning Mask'),
    };
    expect(keyItems(gear, 2).map((i) => i.name)).toEqual(['Obliterator Bow', "Cadiro's Gambit", 'Headhunter']);
    expect(keyItems(gear, 1).map((i) => i.name)).toEqual(['Nettle Talisman', 'Headhunter']);
  });
  it('includes unique jewels once', () => {
    const well = item('Heart of the Well', true);
    const gear = { ...emptyGearState(), jewels: { '100': well, '200': item('Emerald') } };
    expect(keyItems(gear, 1).map((i) => i.name)).toEqual(['Heart of the Well']);
  });
});

describe('patchQuery', () => {
  it('sets, replaces and removes keys while keeping the others', () => {
    expect(patchQuery('?checkpoint=abc&tab=gear', { tab: 'stats' })).toBe('?checkpoint=abc&tab=stats');
    expect(patchQuery('?checkpoint=abc&tab=gear', { tab: null })).toBe('?checkpoint=abc');
    expect(patchQuery('', { tab: 'gear' })).toBe('?tab=gear');
  });
  it('returns an empty string when nothing is left', () => {
    expect(patchQuery('?tab=gear', { tab: null })).toBe('');
  });
  it('encodes values', () => {
    expect(patchQuery('', { tab: 'a b&c' })).toBe('?tab=a+b%26c');
  });
});
