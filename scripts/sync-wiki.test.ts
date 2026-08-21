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

  it('names the escape hatch in the drop error so the operator can find it', () => {
    const entries = Array.from({ length: 80 }, (_, i) => entry(`s${i}`));
    expect(() => validateSyncResult(entries, 100)).toThrow(/--allow-shrink/);
  });

  it('waives the drop check when the shrink is declared intentional', () => {
    const entries = Array.from({ length: 80 }, (_, i) => entry(`s${i}`));
    expect(() => validateSyncResult(entries, 100, { allowShrink: true })).not.toThrow();
  });

  it('still refuses an empty result even with allowShrink', () => {
    // allowShrink waives the drop check only — an empty extract is never
    // an intentional filter outcome, it is a broken pipeline.
    expect(() => validateSyncResult([], 100, { allowShrink: true })).toThrow(/empty/i);
  });

  it('still refuses duplicate slugs even with allowShrink', () => {
    expect(() => validateSyncResult([entry('a'), entry('a')], 2, { allowShrink: true }))
      .toThrow(/duplicate/i);
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

  it('picks the most recent PRIOR version directory when the version was hand-bumped', () => {
    // Two real prior syncs on disk plus a freshly-created (empty)
    // current-version dir - what a hand-bumped WIKI_DATA_VERSION looks like.
    writeIndex('2026-08-01', 'skill', 5);
    writeIndex('2026-08-14', 'skill', 8);
    mkdirSync(path.join(root, '2026-08-21'), { recursive: true }); // current version, no index file yet

    expect(findPreviousVersionDir(root, '2026-08-21')).toBe(path.join(root, '2026-08-14'));
    expect(findPreviousCount(root, '2026-08-21', 'skill')).toBe(8);
  });

  it('counts the CURRENT version directory when the sync re-runs against it (the weekly-CI case)', () => {
    // The realistic scenario, and the one two earlier revisions of this code
    // both got wrong: nothing bumps WIKI_DATA_VERSION between syncs, so the
    // weekly workflow re-runs against the same directory it wrote last time.
    // That directory holds the only previous count there is - if it is not
    // counted, the drop guard is inert in exactly the automated path it was
    // written to protect.
    writeIndex('2026-08-21', 'skill', 1118);

    expect(findPreviousVersionDir(root, '2026-08-21')).toBeNull();
    expect(findPreviousCount(root, '2026-08-21', 'skill')).toBe(1118);
  });

  it('makes the drop guard actually fire on a truncated re-run against the current version', () => {
    // End-to-end on the same case: a re-run that returns a fraction of last
    // week's gems must throw rather than silently overwrite good data.
    writeIndex('2026-08-21', 'skill', 1118);
    const truncated = Array.from({ length: 40 }, (_, i) => entry(`s${i}`));

    expect(() =>
      validateSyncResult(truncated, findPreviousCount(root, '2026-08-21', 'skill')),
    ).toThrow(/dropped/i);
  });

  it('prefers whichever of the current or prior directory has the higher count', () => {
    // A partially-written or truncated current directory must not be able to
    // lower the bar the guard checks against.
    writeIndex('2026-08-14', 'skill', 1118);
    writeIndex('2026-08-21', 'skill', 3);

    expect(findPreviousCount(root, '2026-08-21', 'skill')).toBe(1118);
  });

  it('returns 0 / null when the current version directory exists but is empty', () => {
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
