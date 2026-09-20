import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { draftKey, saveDraft, loadDraft, clearDraft } from '@/lib/build/draft';
import type { BuildEditorState } from '@/lib/build/types';

const state: BuildEditorState = {
  classId: 2,
  className: 'Witch',
  ascendancyId: 'Lich',
  main: { allocated: [1, 2], weaponSets: { 2: 1 } },
  ascendancyNodes: [40],
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

  it('round-trips a draft', () => {
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

  it('clears a draft', () => {
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
        classId: 2,
        className: 'Witch',
        ascendancyId: 'Lich',
        main: { allocated: 'not-an-array', weaponSets: {} },
        ascendancyNodes: [40],
      }),
    );
    expect(loadDraft('build-123')).toBeNull();

    localStorage.setItem(
      draftKey('build-456'),
      JSON.stringify({
        classId: 2,
        className: 'Witch',
        ascendancyId: 'Lich',
        main: { allocated: [1, 2], weaponSets: {} },
        ascendancyNodes: 'not-an-array',
      }),
    );
    expect(loadDraft('build-456')).toBeNull();
  });

  it('rejects a stored value with a non-numeric classId', () => {
    localStorage.setItem(
      draftKey('build-123'),
      JSON.stringify({ ...state, classId: '2' }),
    );
    expect(loadDraft('build-123')).toBeNull();
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
