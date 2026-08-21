import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  validateSyncResult,
  ddsPathToIconKey,
  dedupeSlug,
  findPreviousVersionDir,
  findPreviousCount,
} from './sync-wiki';

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

describe('findPreviousVersionDir / findPreviousCount', () => {
  let root: string;

  const writeIndex = (version: string, kind: string, count: number) => {
    const dir = path.join(root, version);
    mkdirSync(dir, { recursive: true });
    const entries = Array.from({ length: count }, (_, i) => entry(`${kind}-${i}`));
    writeFileSync(path.join(dir, `${kind}-index.json`), JSON.stringify({ entries }));
  };

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'wiki-sync-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('picks the most recent PRIOR version directory, not the current (in-progress) one', () => {
    // Regression test: the plan's original sample code compared against the
    // current, in-progress WIKI_DATA_VERSION's own directory, which is
    // always empty at this point in a real sync (the version is bumped once
    // per weekly PR) - so the drop guard could never fire. Two real prior
    // syncs on disk plus a freshly-created (empty) current-version dir:
    writeIndex('2026-08-01', 'skill', 5);
    writeIndex('2026-08-14', 'skill', 8);
    mkdirSync(path.join(root, '2026-08-21'), { recursive: true }); // current version, no index file yet

    expect(findPreviousVersionDir(root, '2026-08-21')).toBe(path.join(root, '2026-08-14'));
    expect(findPreviousCount(root, '2026-08-21', 'skill')).toBe(8);
  });

  it('returns 0 / null when only the current version directory exists (no prior sync)', () => {
    mkdirSync(path.join(root, '2026-08-21'), { recursive: true });
    expect(findPreviousVersionDir(root, '2026-08-21')).toBeNull();
    expect(findPreviousCount(root, '2026-08-21', 'skill')).toBe(0);
  });

  it('returns 0 / null on a genuine first-ever sync (wiki root does not exist yet)', () => {
    const missingRoot = path.join(root, 'does-not-exist');
    expect(findPreviousVersionDir(missingRoot, '2026-08-21')).toBeNull();
    expect(findPreviousCount(missingRoot, '2026-08-21', 'skill')).toBe(0);
  });

  it('returns 0 when the prior version directory exists but has no index file for this kind', () => {
    writeIndex('2026-08-14', 'skill', 8); // only skill, no mod
    expect(findPreviousCount(root, '2026-08-21', 'mod')).toBe(0);
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
