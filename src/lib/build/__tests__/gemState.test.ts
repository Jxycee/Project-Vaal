import { describe, it, expect } from 'vitest';
import {
  addLoadout,
  addSupport,
  deriveMainSkill,
  emptyGemState,
  newLoadout,
  parseGemState,
  removeLoadout,
  removeSupport,
  setPrimary,
  setSets,
  setSkill,
} from '../gemState';
import type { GemState } from '../gemState';
import type { GearItem } from '../gearSlots';
import { MAX_SUPPORTS_PER_SKILL } from '../gemSlots';

const heraldOfAsh: GearItem = {
  slug: 'herald-of-ash',
  name: 'Herald of Ash',
  category: 'Active Skill Gem',
  isUnique: false,
  iconUrl: null,
};
const spark: GearItem = { slug: 'spark', name: 'Spark', category: 'Active Skill Gem', isUnique: false, iconUrl: null };
const support = (n: number): GearItem => ({
  slug: `support-${n}`,
  name: `Support ${n}`,
  category: 'Support Gem',
  isUnique: false,
  iconUrl: null,
});

describe('emptyGemState', () => {
  it('has no loadouts and no primary', () => {
    expect(emptyGemState()).toEqual({ loadouts: [], primaryId: null });
  });
});

describe('newLoadout', () => {
  it('starts empty, in both weapon sets, with a non-empty stable id', () => {
    const loadout = newLoadout();
    expect(loadout.id.length).toBeGreaterThan(0);
    expect(loadout.skill).toBeNull();
    expect(loadout.supports).toEqual([]);
    expect(loadout.sets).toEqual([1, 2]);
  });

  it('generates distinct ids across calls', () => {
    const ids = new Set([newLoadout().id, newLoadout().id, newLoadout().id]);
    expect(ids.size).toBe(3);
  });
});

describe('parseGemState', () => {
  it('returns empty state for non-object input', () => {
    for (const raw of [null, undefined, 'garbage', 42, []]) {
      expect(parseGemState(raw)).toEqual({ loadouts: [], primaryId: null });
    }
  });

  it('returns empty loadouts when loadouts is missing or not an array', () => {
    expect(parseGemState({})).toEqual({ loadouts: [], primaryId: null });
    expect(parseGemState({ loadouts: 'nope' })).toEqual({ loadouts: [], primaryId: null });
  });

  it('round-trips a well-formed loadout', () => {
    const loadout = { id: 'a', skill: heraldOfAsh, supports: [support(1)], sets: [1] };
    const state = parseGemState({ loadouts: [loadout], primaryId: 'a' });
    expect(state.loadouts).toEqual([loadout]);
    expect(state.primaryId).toBe('a');
  });

  it('drops a loadout with no id (or a non-string/empty id) entirely, without blanking the others', () => {
    const good = { id: 'a', skill: heraldOfAsh, supports: [], sets: [1, 2] };
    const state = parseGemState({ loadouts: [good, { id: '', skill: null, supports: [], sets: [1, 2] }, { skill: null }] });
    expect(state.loadouts).toEqual([good]);
  });

  it('falls back skill to null when malformed', () => {
    const state = parseGemState({ loadouts: [{ id: 'a', skill: { name: 'onlyAName' }, supports: [], sets: [1, 2] }] });
    expect(state.loadouts[0].skill).toBeNull();
  });

  it('filters supports to well-formed items and truncates an 8-item array to the cap of 5', () => {
    const eight = Array.from({ length: 8 }, (_, i) => support(i));
    const state = parseGemState({ loadouts: [{ id: 'a', skill: null, supports: eight, sets: [1, 2] }] });
    expect(state.loadouts[0].supports).toHaveLength(MAX_SUPPORTS_PER_SKILL);
    expect(state.loadouts[0].supports).toEqual(eight.slice(0, MAX_SUPPORTS_PER_SKILL));
  });

  it('drops malformed entries out of supports without dropping the well-formed ones', () => {
    const state = parseGemState({
      loadouts: [{ id: 'a', skill: null, supports: [support(1), { name: 'bad' }, support(2)], sets: [1, 2] }],
    });
    expect(state.loadouts[0].supports).toEqual([support(1), support(2)]);
  });

  it('normalises sets: dedupes and sorts [2,2,1] to [1,2]', () => {
    const state = parseGemState({ loadouts: [{ id: 'a', skill: null, supports: [], sets: [2, 2, 1] }] });
    expect(state.loadouts[0].sets).toEqual([1, 2]);
  });

  it('falls back sets to [1,2] when empty or entirely invalid', () => {
    for (const sets of [[], [3, 4], 'nope', undefined]) {
      const state = parseGemState({ loadouts: [{ id: 'a', skill: null, supports: [], sets }] });
      expect(state.loadouts[0].sets).toEqual([1, 2]);
    }
  });

  it('clears a dangling primaryId that does not match any surviving loadout', () => {
    const state = parseGemState({ loadouts: [{ id: 'a', skill: null, supports: [], sets: [1, 2] }], primaryId: 'ghost' });
    expect(state.primaryId).toBeNull();
  });
});

describe('addLoadout / removeLoadout', () => {
  it('adds a fresh empty loadout', () => {
    const state = addLoadout(emptyGemState());
    expect(state.loadouts).toHaveLength(1);
    expect(state.loadouts[0].skill).toBeNull();
  });

  it('removes a loadout by id', () => {
    const one = addLoadout(emptyGemState());
    const id = one.loadouts[0].id;
    expect(removeLoadout(one, id).loadouts).toHaveLength(0);
  });

  it('clears primaryId when removing the loadout it pointed to', () => {
    const one = addLoadout(emptyGemState());
    const id = one.loadouts[0].id;
    const withPrimary = setPrimary(one, id);
    expect(withPrimary.primaryId).toBe(id);
    expect(removeLoadout(withPrimary, id).primaryId).toBeNull();
  });

  it('leaves primaryId alone when removing a different loadout', () => {
    let state = addLoadout(emptyGemState());
    state = addLoadout(state);
    const [first, second] = state.loadouts;
    state = setPrimary(state, first.id);
    state = removeLoadout(state, second.id);
    expect(state.primaryId).toBe(first.id);
  });
});

describe('setSkill', () => {
  it('sets and clears a loadout skill without touching other loadouts', () => {
    let state = addLoadout(emptyGemState());
    state = addLoadout(state);
    const [first, second] = state.loadouts;
    state = setSkill(state, first.id, heraldOfAsh);
    expect(state.loadouts[0].skill).toEqual(heraldOfAsh);
    expect(state.loadouts[1].skill).toBeNull();
    state = setSkill(state, first.id, null);
    expect(state.loadouts[0].skill).toBeNull();
    void second;
  });
});

describe('addSupport / removeSupport', () => {
  it('appends a support', () => {
    let state = addLoadout(emptyGemState());
    const id = state.loadouts[0].id;
    state = addSupport(state, id, support(1));
    expect(state.loadouts[0].supports).toEqual([support(1)]);
  });

  it('is a no-op (equal by value) once the loadout is at the cap', () => {
    let state = addLoadout(emptyGemState());
    const id = state.loadouts[0].id;
    for (let i = 0; i < MAX_SUPPORTS_PER_SKILL; i += 1) state = addSupport(state, id, support(i));
    const atCap = state;
    state = addSupport(state, id, support(99));
    expect(state.loadouts[0].supports).toHaveLength(MAX_SUPPORTS_PER_SKILL);
    expect(state).toEqual(atCap);
  });

  it('removes a support by index', () => {
    let state = addLoadout(emptyGemState());
    const id = state.loadouts[0].id;
    state = addSupport(state, id, support(1));
    state = addSupport(state, id, support(2));
    state = removeSupport(state, id, 0);
    expect(state.loadouts[0].supports).toEqual([support(2)]);
  });
});

describe('setSets', () => {
  it('normalises [2,2,1] to [1,2]', () => {
    let state = addLoadout(emptyGemState());
    const id = state.loadouts[0].id;
    state = setSets(state, id, [2, 2, 1]);
    expect(state.loadouts[0].sets).toEqual([1, 2]);
  });

  it('falls back an empty array to [1,2] ("both" is what untagged means)', () => {
    let state = addLoadout(emptyGemState());
    const id = state.loadouts[0].id;
    state = setSets(state, id, []);
    expect(state.loadouts[0].sets).toEqual([1, 2]);
  });

  it('accepts a single set', () => {
    let state = addLoadout(emptyGemState());
    const id = state.loadouts[0].id;
    state = setSets(state, id, [2]);
    expect(state.loadouts[0].sets).toEqual([2]);
  });
});

describe('setPrimary', () => {
  it('sets primaryId to the given loadout, clearing any previous one', () => {
    let state = addLoadout(emptyGemState());
    state = addLoadout(state);
    const [first, second] = state.loadouts;
    state = setPrimary(state, first.id);
    expect(state.primaryId).toBe(first.id);
    state = setPrimary(state, second.id);
    expect(state.primaryId).toBe(second.id);
  });
});

describe('deriveMainSkill', () => {
  function stateWith(loadouts: GemState['loadouts'], primaryId: string | null = null): GemState {
    return { loadouts, primaryId };
  }

  it('returns null when there are no loadouts', () => {
    expect(deriveMainSkill(emptyGemState())).toBeNull();
  });

  it('returns null when no loadout has a skill', () => {
    const state = stateWith([{ id: 'a', skill: null, supports: [], sets: [1, 2] }]);
    expect(deriveMainSkill(state)).toBeNull();
  });

  it('uses the primary loadout skill name when set and populated', () => {
    const state = stateWith(
      [
        { id: 'a', skill: spark, supports: [], sets: [1, 2] },
        { id: 'b', skill: heraldOfAsh, supports: [], sets: [1, 2] },
      ],
      'b',
    );
    expect(deriveMainSkill(state)).toBe('Herald of Ash');
  });

  it('falls back to the first loadout with a skill when primaryId is null', () => {
    const state = stateWith([
      { id: 'a', skill: null, supports: [], sets: [1, 2] },
      { id: 'b', skill: heraldOfAsh, supports: [], sets: [1, 2] },
    ]);
    expect(deriveMainSkill(state)).toBe('Herald of Ash');
  });

  it('falls back to the first loadout with a skill when the primary loadout has none', () => {
    const state = stateWith(
      [
        { id: 'a', skill: spark, supports: [], sets: [1, 2] },
        { id: 'b', skill: null, supports: [], sets: [1, 2] },
      ],
      'b',
    );
    expect(deriveMainSkill(state)).toBe('Spark');
  });
});
