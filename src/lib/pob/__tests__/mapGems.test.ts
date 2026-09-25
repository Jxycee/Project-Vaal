import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cleanGemStateInput } from '@/lib/build/stateInput';
import { getCatalogue, type CatalogueGem } from '../catalogue';
import { decodePobCode } from '../decode';
import { mapGems } from '../mapGems';
import { parsePobXml, type PobGem, type PobSkillGroup } from '../parse';

// Failure modes first (AGENTS.md). A fake catalogue isolates each rule; the
// real build against the real catalogue checks the whole thing at the end.

const icon = (slug: string) => `/data/wiki/2026-08-25/icons/skills/${slug}.png`;
const active = (slug: string, maxLevel = 40): CatalogueGem => ({
  slug,
  name: slug,
  category: 'Active Skill Gem',
  gemType: 'active',
  maxLevel,
  iconUrl: icon(slug),
});
const support = (slug: string): CatalogueGem => ({
  slug,
  name: slug,
  category: 'Support Gem',
  gemType: 'support',
  maxLevel: 1,
  iconUrl: icon(slug),
});

const catalogue = new Map<string, CatalogueGem>([
  ['SkillGemA', active('skill-a')],
  ['SkillGemB', active('skill-b')],
  ['SkillGemLowCap', active('low-cap', 20)],
  ...['1', '2', '3', '4', '5', '6'].map((n) => [`SupportGem${n}`, support(`support-${n}`)] as [string, CatalogueGem]),
]);

// The PoB name defaults to the catalogue's name for that id, so a gem only
// counts as renamed when a test says so — otherwise every fake gem would
// trigger the rename note and muddy the other assertions.
const gem = (id: string | null, overrides: Partial<PobGem> = {}): PobGem => ({
  gemId: id === null ? null : `Metadata/Items/Gems/${id}`,
  nameSpec: (id !== null ? catalogue.get(id)?.name : undefined) ?? id ?? 'Nameless',
  level: 1,
  quality: 0,
  enabled: true,
  ...overrides,
});
const group = (index: number, gems: PobGem[], overrides: Partial<PobSkillGroup> = {}): PobSkillGroup => ({
  index,
  label: '',
  enabled: true,
  gems,
  ...overrides,
});

describe('mapGems — every way it can go wrong', () => {
  it('skips empty label rows silently', () => {
    const { value, report } = mapGems([group(1, [], { label: '^5--- Main ---' }), group(2, [gem('SkillGemA')])], 2, catalogue);
    expect(value.loadouts).toHaveLength(1);
    expect(report).toEqual([]);
  });

  it('drops a group whose skill is unknown, naming it', () => {
    const { value, report } = mapGems([group(1, [gem('SkillGemNope', { nameSpec: 'Mystery Skill' })])], null, catalogue);
    expect(value.loadouts).toEqual([]);
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({ kind: 'dropped', area: 'gems' });
    expect(report[0].message).toContain('Mystery Skill');
  });

  it('keeps the loadout but drops an unknown support, naming it', () => {
    const { value, report } = mapGems(
      [group(1, [gem('SkillGemA'), gem('SupportGem1'), gem('SupportGemNope', { nameSpec: 'Mystery Support' })])],
      null,
      catalogue,
    );
    expect(value.loadouts[0].supports.map((s) => s.slug)).toEqual(['support-1']);
    expect(report[0].message).toContain('Mystery Support');
  });

  it('drops a group whose first gem is a support rather than guessing which is the skill', () => {
    const { value, report } = mapGems([group(1, [gem('SupportGem1'), gem('SkillGemA')])], null, catalogue);
    expect(value.loadouts).toEqual([]);
    expect(report).toHaveLength(1);
  });

  it('keeps five supports and reports the rest by name', () => {
    const six = ['1', '2', '3', '4', '5', '6'].map((n) => gem(`SupportGem${n}`));
    const { value, report } = mapGems([group(1, [gem('SkillGemA'), ...six])], null, catalogue);
    expect(value.loadouts[0].supports).toHaveLength(5);
    expect(report).toHaveLength(1);
    expect(report[0].message).toContain('support-6');
  });

  it('drops a second active gem in one group — a loadout holds one skill', () => {
    const { value, report } = mapGems([group(1, [gem('SkillGemA'), gem('SkillGemB', { nameSpec: 'Second Skill' })])], null, catalogue);
    expect(value.loadouts[0].skill?.slug).toBe('skill-a');
    expect(report[0].message).toContain('Second Skill');
  });

  it('drops disabled gems and disabled groups, and says so', () => {
    const disabledGem = mapGems(
      [group(1, [gem('SkillGemA'), gem('SupportGem1', { enabled: false, nameSpec: 'Off Support' })])],
      null,
      catalogue,
    );
    expect(disabledGem.value.loadouts[0].supports).toEqual([]);
    expect(disabledGem.report[0].message).toContain('Off Support');

    const disabledGroup = mapGems([group(1, [gem('SkillGemA')], { enabled: false })], null, catalogue);
    expect(disabledGroup.value.loadouts).toEqual([]);
    expect(disabledGroup.report).toHaveLength(1);
  });

  it("clamps a skill's level to that gem's own cap, and its quality to 20, reporting each", () => {
    const { value, report } = mapGems([group(1, [gem('SkillGemLowCap', { level: 25, quality: 23 })])], null, catalogue);
    expect(value.loadouts[0]).toMatchObject({ level: 20, quality: 20 });
    expect(report).toHaveLength(2);
  });

  it('marks a missing level or quality as inferred rather than silently assuming', () => {
    const { value, report } = mapGems([group(1, [gem('SkillGemA', { level: null, quality: null })])], null, catalogue);
    expect(value.loadouts[0]).toMatchObject({ level: 1, quality: 0 });
    expect(report.every((r) => r.kind === 'inferred')).toBe(true);
    expect(report).toHaveLength(1);
  });

  it('reports support quality as not kept — supports carry no quality in our model', () => {
    const { report } = mapGems([group(1, [gem('SkillGemA'), gem('SupportGem1', { quality: 20 })])], null, catalogue);
    expect(report).toHaveLength(1);
    expect(report[0].kind).toBe('dropped');
  });

  it('tells the user when a gem is known today by a different name — without dropping it', () => {
    // Real case: PoB's "Artillery Ballista" (SkillGemArtilleryBallista) is
    // named "Siege Ballista" in the current data, while "Artillery Ballista"
    // is now a DIFFERENT gem. Silence here would read as a wrong import.
    const { value, report } = mapGems(
      [group(1, [gem('SkillGemA', { nameSpec: 'Old Skill Name' }), gem('SupportGem1', { nameSpec: 'Old Support Name' })])],
      null,
      catalogue,
    );
    expect(value.loadouts[0].supports).toHaveLength(1);
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({ kind: 'note', area: 'gems' });
    expect(report[0].message).toContain('Old Skill Name → skill-a');
    expect(report[0].message).toContain('Old Support Name → support-1');
  });

  it('leaves no primary when mainSocketGroup points at a label row or a dropped group', () => {
    const atLabel = mapGems([group(1, [], { label: 'Label' }), group(2, [gem('SkillGemA')])], 1, catalogue);
    expect(atLabel.value.primaryId).toBeNull();
    expect(atLabel.report.some((r) => r.kind === 'note')).toBe(true);

    const atDropped = mapGems([group(1, [gem('SkillGemNope')]), group(2, [gem('SkillGemA')])], 1, catalogue);
    expect(atDropped.value.primaryId).toBeNull();
  });
});

describe('mapGems — output', () => {
  it('points primaryId at the loadout made from mainSocketGroup', () => {
    const { value } = mapGems([group(1, [], { label: 'L' }), group(2, [gem('SkillGemA')]), group(3, [gem('SkillGemB')])], 3, catalogue);
    expect(value.primaryId).toBe(value.loadouts[1].id);
    expect(value.loadouts[1].skill?.slug).toBe('skill-b');
  });

  it('uses both weapon sets by default — PoB groups carry no weapon set here', () => {
    expect(mapGems([group(1, [gem('SkillGemA')])], null, catalogue).value.loadouts[0].sets).toEqual([1, 2]);
  });

  it('produces state the write gate accepts unchanged', () => {
    const { value } = mapGems([group(1, [gem('SkillGemA', { level: 20, quality: 20 }), gem('SupportGem1')])], 1, catalogue);
    const gated = cleanGemStateInput(value);
    expect(gated.ok).toBe(true);
    if (gated.ok) expect(gated.value).toEqual(value);
  });
});

describe('mapGems — the real build against the real catalogue', async () => {
  const decoded = decodePobCode(readFileSync('src/lib/pob/__fixtures__/sample-pob2-code.txt', 'utf8'));
  if (!decoded.ok) throw new Error('fixture failed to decode');
  const parsed = parsePobXml(decoded.xml);
  if (!parsed.ok) throw new Error('fixture failed to parse');
  const { gems } = await getCatalogue();
  const { value, report } = mapGems(parsed.build.skillGroups, parsed.build.mainSocketGroup, gems);

  it('imports all five real groups with every one of the 20 gems, under their current names', () => {
    // PoB calls the first one "Artillery Ballista". Its id,
    // SkillGemArtilleryBallista, is named "Siege Ballista" in the current data,
    // and "Artillery Ballista" is now a different gem (SkillGemRipwireBallista)
    // — verified 2026-09-24. Joining on the id imports the player's own gem; a
    // name join would have silently swapped in another skill.
    expect(value.loadouts.map((l) => l.skill?.name)).toEqual([
      'Siege Ballista',
      'Overwhelming Presence',
      'Time of Need',
      'Hypothermia',
      'Frost Bomb',
    ]);
    expect(value.loadouts.reduce((n, l) => n + 1 + l.supports.length, 0)).toBe(20);
    expect(report.filter((r) => r.kind === 'dropped')).toEqual([]);
  });

  it('makes the first real group — mainSocketGroup 2 — the primary skill', () => {
    expect(value.loadouts.find((l) => l.id === value.primaryId)?.skill?.name).toBe('Siege Ballista');
  });

  it('lists all 13 gems whose names changed since the build was made', () => {
    const renames = report.filter((r) => r.kind === 'note' && r.message.includes('→'));
    expect(renames).toHaveLength(1);
    expect(renames[0].message).toContain('Artillery Ballista → Siege Ballista');
    expect(renames[0].message).toContain('Martial Tempo → Rapid Attacks I');
    expect((renames[0].message.match(/→/g) ?? []).length).toBe(13);
  });

  it('keeps level 20 and quality 20 on the skills', () => {
    expect(value.loadouts.every((l) => l.level === 20 && l.quality === 20)).toBe(true);
  });

  it('passes the write gate unchanged', () => {
    const gated = cleanGemStateInput(value);
    expect(gated.ok).toBe(true);
  });
});
