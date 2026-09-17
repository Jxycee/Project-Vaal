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
  it('namespaces by class and ascendancy', () => {
    expect(draftKey(2, 'Lich')).toBe('vaal:tree-draft:2:Lich');
  });

  it('uses a stable placeholder when no ascendancy is chosen', () => {
    expect(draftKey(2, undefined)).toBe('vaal:tree-draft:2:none');
  });
});

describe('save and load', () => {
  beforeEach(() => installMockStorage());

  it('round-trips a draft', () => {
    saveDraft(state);
    expect(loadDraft(2, 'Lich')).toEqual(state);
  });

  it('returns null when nothing is stored', () => {
    expect(loadDraft(9, 'Nope')).toBeNull();
  });

  it('returns null for corrupt JSON instead of throwing', () => {
    localStorage.setItem(draftKey(2, 'Lich'), '{not json');
    expect(loadDraft(2, 'Lich')).toBeNull();
  });

  it('clears a draft', () => {
    saveDraft(state);
    clearDraft(2, 'Lich');
    expect(loadDraft(2, 'Lich')).toBeNull();
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
    expect(() => saveDraft(state)).not.toThrow();
    expect(loadDraft(2, 'Lich')).toBeNull();
    expect(() => clearDraft(2, 'Lich')).not.toThrow();
  });
});
