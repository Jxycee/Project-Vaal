import { describe, it, expect } from 'vitest';
import { validateSyncResult, ddsPathToIconKey, dedupeSlug } from './sync-wiki';

const entry = (slug: string) => ({
  slug, name: slug, kind: 'skill' as const, category: 'Active Skill Gem', tags: [],
});

describe('validateSyncResult', () => {
  it('passes when the count is stable', () => {
    expect(() => validateSyncResult([entry('a'), entry('b')], 2)).not.toThrow();
  });

  it('throws on an empty result', () => {
    expect(() => validateSyncResult([], 100)).toThrow(/empty/i);
  });

  it('throws when the count drops more than 10 percent', () => {
    const entries = Array.from({ length: 80 }, (_, i) => entry(`s${i}`));
    expect(() => validateSyncResult(entries, 100)).toThrow(/dropped/i);
  });

  it('allows growth without complaint', () => {
    const entries = Array.from({ length: 200 }, (_, i) => entry(`s${i}`));
    expect(() => validateSyncResult(entries, 100)).not.toThrow();
  });

  it('throws on duplicate slugs', () => {
    expect(() => validateSyncResult([entry('a'), entry('a')], 2)).toThrow(/duplicate/i);
  });

  it('skips the drop check on a first run', () => {
    expect(() => validateSyncResult([entry('a')], 0)).not.toThrow();
  });
});

describe('ddsPathToIconKey', () => {
  it('replaces the dds extension with png, case-insensitively', () => {
    expect(ddsPathToIconKey('Art/2DArt/SkillIcons/SorceressIceNova.dds')).toBe('Art/2DArt/SkillIcons/SorceressIceNova.png');
  });
  it('leaves a path with no dds extension unchanged', () => {
    expect(ddsPathToIconKey('Art/2DArt/SkillIcons/SorceressIceNova')).toBe('Art/2DArt/SkillIcons/SorceressIceNova');
  });
});

describe('dedupeSlug', () => {
  it('returns the base slug unchanged on first use', () => {
    const used = new Set<string>();
    expect(dedupeSlug('herald-of-ash', 'SkillGemHeraldOfAsh', used)).toBe('herald-of-ash');
    expect(used.has('herald-of-ash')).toBe(true);
  });

  it('appends a camelCase-split disambiguator on collision', () => {
    const used = new Set<string>(['herald-of-ash']);
    expect(dedupeSlug('herald-of-ash', 'UniqueSkillGemHeraldOfAsh', used))
      .toBe('herald-of-ash-unique-skill-gem-herald-of-ash');
  });

  it('falls back to a numeric suffix if the disambiguated slug also collides', () => {
    const used = new Set<string>(['x', 'x-y']);
    expect(dedupeSlug('x', 'y', used)).toBe('x-y-2');
  });

  it('never returns a slug already in the used set', () => {
    const used = new Set<string>();
    const a = dedupeSlug('sword-slash', 'SkillGemPlayerDefault1HSword', used);
    const b = dedupeSlug('sword-slash', 'SkillGemPlayerDefault2HSword', used);
    const c = dedupeSlug('sword-slash', 'SkillGemPlayerDefaultSwordSword', used);
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
