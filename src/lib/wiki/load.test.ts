import { describe, it, expect } from 'vitest';
import { loadDetail } from './load';

describe('loadDetail', () => {
  it('loads a real skill fixture from disk', async () => {
    const skill = await loadDetail('skill', 'ice-nova');
    expect(skill).not.toBeNull();
    expect(skill?.kind).toBe('skill');
    expect(skill?.slug).toBe('ice-nova');
    expect(skill?.name).toBe('Ice Nova');
    expect(skill?.category).toBe('Active Skill Gem');
    expect(skill?.gemType).toBe('active');
    expect(skill?.iconUrl).toBe('/data/wiki/2026-08-25/icons/skills/ice-nova.png');
  });
  it('returns null for an unknown slug instead of throwing', async () => {
    expect(await loadDetail('skill', 'not-a-real-gem')).toBeNull();
  });
  it('rejects a path-traversal slug', async () => {
    expect(await loadDetail('skill', '../../../etc/passwd')).toBeNull();
  });
  it('rejects a path-traversal slug in an item lookup too', async () => {
    expect(await loadDetail('item', '..%2f..%2fetc')).toBeNull();
  });
  it('returns null when a real file exists but under the wrong kind', async () => {
    // 'ice-nova' exists as a skill; asking for it as a mod must not return
    // the skill record just because a same-named file happens to be findable.
    expect(await loadDetail('mod', 'ice-nova')).toBeNull();
  });
});
