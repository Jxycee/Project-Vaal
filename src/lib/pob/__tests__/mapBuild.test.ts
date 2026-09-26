import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAX_NOTES_LENGTH } from '@/lib/build/constants';
import { cleanGearStateInput, cleanGemStateInput, cleanPassiveStateInput } from '@/lib/build/stateInput';
import { getCatalogue } from '../catalogue';
import { decodePobCode } from '../decode';
import { mapBuild } from '../mapBuild';
import { parsePobXml, type PobBuild, type PobSpec } from '../parse';

// Failure modes first (AGENTS.md). mapBuild only composes the mappers, each
// tested on its own, so these run against the real catalogue with small
// hand-made builds, and the real export checks the whole thing at the end.

const spec = (title: string, overrides: Partial<PobSpec> = {}): PobSpec => ({
  title,
  nodes: [],
  weaponSet1: [],
  weaponSet2: [],
  attributeOverrides: { str: [], dex: [], int: [] },
  jewelSockets: [],
  ...overrides,
});

const build = (overrides: Partial<PobBuild> = {}): PobBuild => ({
  level: 50,
  className: 'Mercenary',
  ascendClassName: 'Witchhunter',
  mainSocketGroup: null,
  activeSpec: 1,
  specs: [spec('Only')],
  skillGroups: [],
  items: [],
  slots: [],
  notes: null,
  ...overrides,
});

async function plan(pob: PobBuild, name?: string) {
  const result = await mapBuild(pob, await getCatalogue(), { name });
  if (!result.ok) throw new Error(result.error);
  return result.plan;
}

describe('mapBuild — every way it can go wrong', () => {
  it('refuses a class our tree does not have — a tree cannot be placed on it', async () => {
    const result = await mapBuild(build({ className: 'Scion' }), await getCatalogue(), {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Scion');

    const missing = await mapBuild(build({ className: null }), await getCatalogue(), {});
    expect(missing.ok).toBe(false);
  });

  it('keeps the class but drops an ascendancy that is not that class\'s, and says so', async () => {
    const p = await plan(build({ ascendClassName: 'Lich' }));
    expect(p.build).toMatchObject({ class: 'Mercenary', ascendancy: null });
    const entry = p.report.find((r) => r.area === 'build' && r.message.includes('Lich'));
    expect(entry?.kind).toBe('dropped');
  });

  it('treats "None" as no ascendancy, silently', async () => {
    const p = await plan(build({ ascendClassName: 'None' }));
    expect(p.build.ascendancy).toBeNull();
    expect(p.report.filter((r) => r.area === 'build')).toEqual([]);
  });

  it('makes one empty checkpoint from the build level when PoB has no tree, and says so', async () => {
    const p = await plan(build({ specs: [], level: 42 }));
    expect(p.checkpoints).toHaveLength(1);
    expect(p.checkpoints[0]).toMatchObject({ name: 'Level 42', level: 42 });
    expect(p.checkpoints[0].passive_state).toEqual({ set1: [], set2: [], ascendancyNodes: [] });
    expect(p.report.some((r) => r.area === 'tree' && r.message.includes('no passive tree'))).toBe(true);
  });

  it('reads a level from the title, else the build level, clamped, and marks every one inferred', async () => {
    const p = await plan(
      build({
        level: 150,
        specs: [spec('Nivel 31 - Balista'), spec('Act one at 0 then 250 then 12'), spec('Endgame')],
      }),
    );
    expect(p.checkpoints.map((c) => c.level)).toEqual([31, 12, 100]);
    const inferred = p.report.filter((r) => r.kind === 'inferred' && r.area === 'tree');
    expect(inferred.map((r) => r.checkpoint)).toEqual([1, 2, 3]);
    // The build row's level clamps too, and says so.
    expect(p.build.level).toBe(100);
  });

  it('gives an untitled tree the build level, not the number in its fallback name', async () => {
    // PoB omits the title of a tree nobody named. The fallback name
    // "Checkpoint 1" must not be read as level 1 — the import would then set
    // a level-94 build to level 1 (the build row mirrors the last checkpoint).
    const p = await plan(build({ level: 94, specs: [spec(''), spec('  ^7 ')] }));
    expect(p.checkpoints.map((c) => [c.name, c.level])).toEqual([
      ['Checkpoint 1', 94],
      ['Checkpoint 2', 94],
    ]);
  });

  it('reads the level, not the act number, from a title that has both', async () => {
    const p = await plan(
      build({
        level: 90,
        specs: [spec('Act 3 - lvl 40'), spec('Acto 3 - Nivel 37'), spec('Act 2'), spec('Lv.45 act 4'), spec('Level 68')],
      }),
    );
    expect(p.checkpoints.map((c) => c.level)).toEqual([40, 37, 90, 45, 68]);
  });

  it('strips colour codes from titles, falls back when a title is empty, and caps at 80 characters', async () => {
    const long = 'L'.repeat(120);
    const p = await plan(build({ specs: [spec('^5Early ^xADAA47Game'), spec('  ^7 '), spec(long)] }));
    expect(p.checkpoints.map((c) => c.name)).toEqual(['Early Game', 'Checkpoint 2', 'L'.repeat(80)]);
    expect(p.report.some((r) => r.checkpoint === 3 && r.message.includes('80'))).toBe(true);
  });

  it('truncates notes over the limit and reports it; strips colour codes; empty notes are null', async () => {
    const p = await plan(build({ notes: `^7${'n'.repeat(MAX_NOTES_LENGTH + 10)}` }));
    expect(p.build.notes).toHaveLength(MAX_NOTES_LENGTH);
    expect(p.build.notes!.startsWith('n')).toBe(true);
    expect(p.report.some((r) => r.area === 'notes' && r.kind === 'dropped')).toBe(true);

    expect((await plan(build({ notes: '  ^1  ' }))).build.notes).toBeNull();
  });

  it('names the build after its ascendancy, or its class, unless given a name', async () => {
    expect((await plan(build())).build.name).toBe('Witchhunter — imported');
    expect((await plan(build({ ascendClassName: null }))).build.name).toBe('Mercenary — imported');
    expect((await plan(build(), '  My Build  ')).build.name).toBe('My Build');
  });

  it('says which spec PoB was showing when it is not the one the build opens on', async () => {
    const p = await plan(build({ specs: [spec('A'), spec('B')], activeSpec: 2 }));
    expect(p.report.some((r) => r.kind === 'note' && r.message.includes('B'))).toBe(true);
    const first = await plan(build({ specs: [spec('A'), spec('B')], activeSpec: 1 }));
    expect(first.report.some((r) => r.kind === 'note' && r.message.includes('was showing'))).toBe(false);
  });

  it('gives each checkpoint its own copy of gear and gems — editing one must not edit all', async () => {
    const p = await plan(build({ specs: [spec('A'), spec('B')] }));
    expect(p.checkpoints[0].gear_state).toEqual(p.checkpoints[1].gear_state);
    expect(p.checkpoints[0].gear_state).not.toBe(p.checkpoints[1].gear_state);
    expect(p.checkpoints[0].gem_state).not.toBe(p.checkpoints[1].gem_state);
  });
});

describe('mapBuild — the real build', async () => {
  const decoded = decodePobCode(readFileSync('src/lib/pob/__fixtures__/sample-pob2-code.txt', 'utf8'));
  if (!decoded.ok) throw new Error('fixture failed to decode');
  const parsed = parsePobXml(decoded.xml);
  if (!parsed.ok) throw new Error('fixture failed to parse');
  const result = await mapBuild(parsed.build, await getCatalogue(), {});
  if (!result.ok) throw new Error(result.error);
  const { build: row, checkpoints, report } = result.plan;

  it('is a Witchhunter build at level 94', () => {
    expect(row).toMatchObject({ class: 'Mercenary', ascendancy: 'Witchhunter', level: 94, name: 'Witchhunter — imported' });
    expect(row.notes!.length).toBeGreaterThan(1000);
    expect(row.notes).not.toMatch(/\^(x[0-9A-Fa-f]{6}|\d)/);
  });

  it('makes 8 checkpoints in spec order, named by title, levels read from titles', () => {
    expect(checkpoints.map((c) => c.name)).toEqual([
      'Nivel 31 - Empezamos con Balista',
      'Nivel 37 - Acto 3 - 2a Ascendencia',
      'Nivel 44',
      'Nivel 49',
      'Nivel 56',
      'Nivel 63 - 3a Ascendencia',
      'Nivel 70',
      'Nivel 94',
    ]);
    expect(checkpoints.map((c) => c.level)).toEqual([31, 37, 44, 49, 56, 63, 70, 94]);
    expect(report.filter((r) => r.kind === 'inferred' && r.area === 'tree')).toHaveLength(8);
  });

  it('shares identical gear, gems and the last spec\'s jewels across all 8, and says so', () => {
    for (const c of checkpoints) {
      expect(c.gear_state).toEqual(checkpoints[0].gear_state);
      expect(c.gem_state).toEqual(checkpoints[0].gem_state);
    }
    expect(Object.keys(checkpoints[0].gear_state.jewels).sort()).toEqual(['2491', '26725']);
    expect(report.some((r) => r.kind === 'note' && r.message.includes('one set of gear'))).toBe(true);
    expect(report.some((r) => r.kind === 'note' && r.message.includes('Jewels'))).toBe(true);
  });

  it('carries the verified tree counts: spec 1 is 35 + 2, spec 8 is 116 + 8', () => {
    const first = checkpoints[0].passive_state;
    const last = checkpoints[7].passive_state;
    expect(new Set([...first.set1, ...first.set2]).size).toBe(35);
    expect(first.ascendancyNodes).toHaveLength(2);
    expect(new Set([...last.set1, ...last.set2]).size).toBe(116);
    expect(last.ascendancyNodes).toHaveLength(8);
  });

  it('opens on the first checkpoint and says PoB was showing the last', () => {
    expect(report.some((r) => r.kind === 'note' && r.message.includes('Nivel 94'))).toBe(true);
  });

  it('produces state every write gate accepts unchanged', () => {
    for (const c of checkpoints) {
      for (const [gate, value] of [
        [cleanPassiveStateInput, c.passive_state],
        [cleanGearStateInput, c.gear_state],
        [cleanGemStateInput, c.gem_state],
      ] as const) {
        const gated = (gate as (raw: unknown) => { ok: boolean; value?: unknown })(value);
        expect(gated.ok).toBe(true);
        expect(gated.value).toEqual(value);
      }
    }
  });
});
