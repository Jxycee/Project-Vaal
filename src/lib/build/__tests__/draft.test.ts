import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { draftKey, saveDraft, loadDraft, clearDraft, type BuildDraftState } from '@/lib/build/draft';
import type { BuildEditorState } from '@/lib/build/types';
import { emptyGearState } from '@/lib/build/gearState';
import { emptyGemState } from '@/lib/build/gemState';
import type { GearItem } from '@/lib/build/gearSlots';
import type { GemState } from '@/lib/build/gemState';

const treeState: BuildEditorState = {
  classId: 2,
  className: 'Witch',
  ascendancyId: 'Lich',
  main: { allocated: [1, 2], weaponSets: { 2: 1 } },
  ascendancyNodes: [40],
};

const boots: GearItem = {
  slug: 'boots-of-the-ondar',
  name: 'Boots of the Ondar',
  category: 'Boots',
  isUnique: true,
  iconUrl: null,
};

const gearWithBoots = { ...emptyGearState(), boots };

const gemWithLoadout: GemState = {
  loadouts: [
    {
      id: 'loadout-1',
      skill: { slug: 'fireball', name: 'Fireball', category: 'Active Skill Gem', isUnique: false, iconUrl: null },
      supports: [],
      sets: [1, 2],
    },
  ],
  primaryId: 'loadout-1',
};

const state: BuildDraftState = {
  tree: treeState,
  gear: gearWithBoots,
  gem: gemWithLoadout,
};

function installMockStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe('draftKey', () => {
  it('namespaces by build id', () => {
    expect(draftKey('build-123')).toBe('vaal:tree-draft:build-123');
  });

  it('uses a stable placeholder for scratch mode', () => {
    expect(draftKey(undefined)).toBe('vaal:tree-draft:scratch');
  });
});

describe('save and load', () => {
  beforeEach(() => installMockStorage());

  it('round-trips a full draft — tree, gear and gems', () => {
    saveDraft('build-123', state);
    expect(loadDraft('build-123')).toEqual(state);
  });

  it('round-trips a scratch-mode draft', () => {
    saveDraft(undefined, state);
    expect(loadDraft(undefined)).toEqual(state);
  });

  it('keeps drafts for different builds separate', () => {
    saveDraft('build-123', state);
    expect(loadDraft('build-456')).toBeNull();
    expect(loadDraft(undefined)).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(loadDraft('nope')).toBeNull();
  });

  it('returns null for corrupt JSON instead of throwing', () => {
    localStorage.setItem(draftKey('build-123'), '{not json');
    expect(loadDraft('build-123')).toBeNull();
  });

  it('clears a draft — tree, gear and gems together', () => {
    saveDraft('build-123', state);
    clearDraft('build-123');
    expect(loadDraft('build-123')).toBeNull();
  });

  it('rejects a malformed stored value instead of casting it', () => {
    // Simulates a draft written under the OLD key scheme colliding, or
    // hand-edited localStorage — either way this must not reach PassiveTree.
    localStorage.setItem(draftKey('build-123'), JSON.stringify({ foo: 'bar' }));
    expect(loadDraft('build-123')).toBeNull();
  });

  it('rejects a stored value with non-array allocated/ascendancyNodes', () => {
    localStorage.setItem(
      draftKey('build-123'),
      JSON.stringify({
        tree: {
          classId: 2,
          className: 'Witch',
          ascendancyId: 'Lich',
          main: { allocated: 'not-an-array', weaponSets: {} },
          ascendancyNodes: [40],
        },
        gear: emptyGearState(),
        gem: emptyGemState(),
      }),
    );
    expect(loadDraft('build-123')).toBeNull();

    localStorage.setItem(
      draftKey('build-456'),
      JSON.stringify({
        tree: {
          classId: 2,
          className: 'Witch',
          ascendancyId: 'Lich',
          main: { allocated: [1, 2], weaponSets: {} },
          ascendancyNodes: 'not-an-array',
        },
        gear: emptyGearState(),
        gem: emptyGemState(),
      }),
    );
    expect(loadDraft('build-456')).toBeNull();
  });

  it('rejects a stored value with a non-numeric classId', () => {
    localStorage.setItem(
      draftKey('build-123'),
      JSON.stringify({ tree: { ...treeState, classId: '2' }, gear: emptyGearState(), gem: emptyGemState() }),
    );
    expect(loadDraft('build-123')).toBeNull();
  });

  it('drops a malformed gear/gem section rather than rejecting the whole draft', () => {
    // parseGearState/parseGemState are already total/defensive (see
    // gearState.ts, gemState.ts) — a garbage `gear` or `gem` section
    // degrades to empty, it never invalidates a valid `tree`.
    localStorage.setItem(
      draftKey('build-123'),
      JSON.stringify({ tree: treeState, gear: 'not-an-object', gem: 42 }),
    );
    expect(loadDraft('build-123')).toEqual({ tree: treeState, gear: emptyGearState(), gem: emptyGemState() });
  });

  describe('drafts written under the OLD (tree-only) shape', () => {
    it('migrates in place: the tree restores, gear/gem default to empty', () => {
      // The old scheme stored a bare BuildEditorState at the top level, with
      // no `tree`/`gear`/`gem` keys at all.
      localStorage.setItem(draftKey('build-123'), JSON.stringify(treeState));
      expect(loadDraft('build-123')).toEqual({
        tree: treeState,
        gear: emptyGearState(),
        gem: emptyGemState(),
      });
    });

    it('does not crash or half-restore on an old-shape draft', () => {
      localStorage.setItem(draftKey('build-123'), JSON.stringify(treeState));
      expect(() => loadDraft('build-123')).not.toThrow();
    });

    it('still rejects an old-shape draft with an invalid tree', () => {
      localStorage.setItem(draftKey('build-123'), JSON.stringify({ ...treeState, classId: 'nope' }));
      expect(loadDraft('build-123')).toBeNull();
    });
  });
});

describe('storage unavailable', () => {
  it('does not throw when localStorage access throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => saveDraft('build-123', state)).not.toThrow();
    expect(loadDraft('build-123')).toBeNull();
    expect(() => clearDraft('build-123')).not.toThrow();
  });
});
