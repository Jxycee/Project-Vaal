import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodePobCode } from '../decode';
import { parsePobXml } from '../parse';

// Failure modes first (AGENTS.md). parsePobXml turns decoded XML into typed
// data and knows nothing about our tree, gems or items — mapping is later.
// Its job is to be faithful and to never crash on what a real PoB2 export can
// contain, and never trust what a crafted one might.

const pob = (inner: string, build = '<Build level="40" className="Witch" ascendClassName="Lich" mainSocketGroup="1"/>') =>
  `<?xml version="1.0" encoding="UTF-8"?><PathOfBuilding2>${build}${inner}</PathOfBuilding2>`;

const parsed = (xml: string) => {
  const result = parsePobXml(xml);
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result.build;
};

describe('parsePobXml — every way it can fail', () => {
  it('refuses XML that is not well formed', () => {
    expect(parsePobXml('<PathOfBuilding2><Build></PathOfBuilding2>')).toEqual({ ok: false, error: 'malformed-xml' });
    expect(parsePobXml('<PathOfBuilding2')).toEqual({ ok: false, error: 'malformed-xml' });
  });

  it('refuses a document with no <Build>', () => {
    expect(parsePobXml('<PathOfBuilding2><Tree/></PathOfBuilding2>')).toEqual({ ok: false, error: 'no-build' });
  });

  it('never resolves an external entity (XXE)', () => {
    // Pointed at a file that really exists, so a resolver that did fetch it
    // would put recognisable content into the notes. A missing file would
    // prove nothing.
    const target = pathToFileURL(resolve('package.json')).href;
    const xml =
      `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY leak SYSTEM "${target}">]>` +
      `<PathOfBuilding2><Build level="1"/><Notes>&leak;</Notes></PathOfBuilding2>`;
    const result = parsePobXml(xml);
    const notes = result.ok ? (result.build.notes ?? '') : '';
    expect(notes).not.toContain('"name": "project-vaal"');
    expect(notes).not.toContain('dependencies');
  });

  it('drops non-numeric node ids from a spec without dropping the spec', () => {
    const build = parsed(pob('<Tree activeSpec="1"><Spec title="A" nodes="1,x,3,,4.5,-2,7"/></Tree>'));
    expect(build.specs).toHaveLength(1);
    expect(build.specs[0].nodes).toEqual([1, 3, 7]);
  });

  it('treats a spec with no nodes attribute as an empty spec, not an error', () => {
    const build = parsed(pob('<Tree><Spec title="Empty"/></Tree>'));
    expect(build.specs[0]).toMatchObject({ title: 'Empty', nodes: [], weaponSet1: [], weaponSet2: [] });
  });

  it('reads missing or non-numeric build numbers as null rather than guessing', () => {
    const build = parsed(pob('', '<Build level="lots" className="Witch"/>'));
    expect(build.level).toBeNull();
    expect(build.mainSocketGroup).toBeNull();
    expect(build.ascendClassName).toBeNull();
  });

  it('drops an item with no text', () => {
    const build = parsed(pob('<Items><Item id="1"></Item><Item id="2">Rarity: NORMAL\nIron Ring</Item></Items>'));
    expect(build.items.map((i) => i.id)).toEqual([2]);
  });

  it('treats a slot pointing at item 0 as empty, not as item 0', () => {
    const build = parsed(
      pob('<Items><ItemSet id="1"><Slot name="Ring 3" itemId="0"/><Slot name="Ring 1" itemId="2"/></ItemSet></Items>'),
    );
    expect(build.slots).toEqual([{ name: 'Ring 1', itemId: 2 }]);
  });
});

describe('parsePobXml — structure', () => {
  it('reads weapon-set-specific nodes from <WeaponSet1/2> children', () => {
    // PassiveSpec.lua Save: <Spec nodes> lists every node; set-specific ones
    // are listed again under WeaponSet1/WeaponSet2.
    const build = parsed(
      pob('<Tree><Spec title="A" nodes="1,2,3,4"><WeaponSet1 nodes="2"/><WeaponSet2 nodes="3,4"/></Spec></Tree>'),
    );
    expect(build.specs[0]).toMatchObject({ nodes: [1, 2, 3, 4], weaponSet1: [2], weaponSet2: [3, 4] });
  });

  it('keeps empty label rows as skill groups so mainSocketGroup still indexes correctly', () => {
    const build = parsed(
      pob(
        '<Skills><SkillSet id="1">' +
          '<Skill label="^5--- Main ---" enabled="true"/>' +
          '<Skill enabled="true"><Gem nameSpec="Ice Nova" gemId="Metadata/Items/Gems/SkillGemIceNova" level="20" quality="20" enabled="true"/></Skill>' +
          '</SkillSet></Skills>',
        '<Build level="40" mainSocketGroup="2"/>',
      ),
    );
    expect(build.skillGroups.map((g) => [g.index, g.gems.length])).toEqual([
      [1, 0],
      [2, 1],
    ]);
    expect(build.mainSocketGroup).toBe(2);
    expect(build.skillGroups[1].gems[0]).toEqual({
      gemId: 'Metadata/Items/Gems/SkillGemIceNova',
      nameSpec: 'Ice Nova',
      level: 20,
      quality: 20,
      enabled: true,
    });
  });
});

describe('parsePobXml — the real vendored build', () => {
  const code = readFileSync('src/lib/pob/__fixtures__/sample-pob2-code.txt', 'utf8');
  const decoded = decodePobCode(code);
  if (!decoded.ok) throw new Error('fixture failed to decode');
  const build = parsed(decoded.xml);

  it('reads the build header', () => {
    expect(build).toMatchObject({ level: 94, className: 'Mercenary', ascendClassName: 'Witchhunter', mainSocketGroup: 2, activeSpec: 8 });
  });

  it('reads all eight specs in order, with their node lists', () => {
    expect(build.specs.map((s) => s.title)).toEqual([
      'Nivel 31 - Empezamos con Balista',
      'Nivel 37 - Acto 3 - 2a Ascendencia',
      'Nivel 44',
      'Nivel 49 ',
      'Nivel 56',
      'Nivel 63 - 3a Ascendencia',
      'Nivel 70',
      'Nivel 94',
    ]);
    expect(build.specs.map((s) => s.nodes.length)).toEqual([39, 50, 57, 70, 77, 86, 97, 127]);
  });

  it("reads spec 1's attribute choices", () => {
    expect(build.specs[0].attributeOverrides.dex).toEqual([45969, 27439, 42350, 22975, 8600, 36629]);
    expect(build.specs[0].attributeOverrides.str).toEqual([28510, 25374]);
  });

  it('reads eight skill elements, gems in the five real groups', () => {
    expect(build.skillGroups).toHaveLength(8);
    expect(build.skillGroups.filter((g) => g.gems.length > 0).map((g) => g.index)).toEqual([2, 4, 5, 7, 8]);
    expect(build.skillGroups.flatMap((g) => g.gems)).toHaveLength(20);
  });

  it('reads twelve items and the notes, without the XML indentation around them', () => {
    expect(build.items).toHaveLength(12);
    // 1,892 raw characters inside <Notes>, of which the first three
    // ("\n\t\t") and last two ("\n\t") are the document's own indentation,
    // not note text: 1,887 once trimmed (measured 2026-09-24). PoB colour
    // codes like "^6" are kept here on purpose — the parser is faithful;
    // stripping them is a mapping decision (mapBuild).
    expect(build.notes?.length).toBe(1887);
    expect(build.notes?.startsWith('^6')).toBe(true);
  });
});
