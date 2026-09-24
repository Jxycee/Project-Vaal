import { describe, expect, it } from 'vitest';
import { getCatalogue } from '../catalogue';

// Failure modes first (AGENTS.md). The catalogue is the only place the PoB
// importer touches our data, so each lookup must answer "not ours" as a
// clear miss — never a nearest guess — and every value it hands on must be
// one the write gate (src/lib/build/stateInput.ts) will accept.
//
// Runs against the real files under public/data. Every expected value below
// was verified on disk on 2026-09-23/24 (see the Slice 2 plan).

describe('catalogue — misses are misses, never guesses', () => {
  it('answers an unknown gemId with undefined', async () => {
    const { gems } = await getCatalogue();
    expect(gems.get('SkillGemThatDoesNotExist')).toBeUndefined();
    expect(gems.get('')).toBeUndefined();
  });

  it('resolves an ascendancy only within its own class', async () => {
    const { tree } = await getCatalogue();
    expect(tree.ascendancyIdFor('Mercenary', 'Witchhunter')).toBe('Mercenary2');
    // A real ascendancy name, on the wrong class.
    expect(tree.ascendancyIdFor('Mercenary', 'Lich')).toBeNull();
    expect(tree.ascendancyIdFor('NotAClass', 'Witchhunter')).toBeNull();
    // Names are exact; no case-folding into a false match.
    expect(tree.ascendancyIdFor('mercenary', 'witchhunter')).toBeNull();
  });

  it("does not know node 15671, the one id the real build's tree lost", async () => {
    const { tree } = await getCatalogue();
    expect(tree.hasNode(15671)).toBe(false);
    expect(tree.hasNode(42761)).toBe(true);
  });

  it('never offers a unique item as a base for a magic item name', async () => {
    const { items } = await getCatalogue();
    // "Cloak of Flame" is a unique; wrapped in affixes it must not be found as a base.
    expect(items.findBaseIn('Glowing Cloak of Flame of the Whale')).toBeNull();
  });

  it('answers a name containing no known base with null', async () => {
    const { items } = await getCatalogue();
    expect(items.findBaseIn('Utterly Imaginary Doodad of Nothing')).toBeNull();
  });

  it('only ever hands on icon URLs the write gate accepts', async () => {
    const { gems } = await getCatalogue();
    const icons = [...gems.values()].map((g) => g.iconUrl).filter((u): u is string => u !== null);
    expect(icons.length).toBeGreaterThan(1000);
    expect(icons.every((u) => u.startsWith('/data/wiki/'))).toBe(true);
  });
});

describe('catalogue — lookups', () => {
  it('maps a gemId to our gem, tiered supports included', async () => {
    const { gems } = await getCatalogue();
    expect(gems.get('SkillGemIceNova')).toMatchObject({ slug: 'ice-nova', gemType: 'active' });
    // Our support gems are tiered by name; PoB's untiered "Vitality" is tier I.
    expect(gems.get('SupportGemVitality')).toMatchObject({ slug: 'vitality-i', gemType: 'support' });
    expect(gems.get('SupportGemVitalityTwo')).toMatchObject({ slug: 'vitality-ii' });
  });

  it('knows the start nodes our editor never stores', async () => {
    const { tree } = await getCatalogue();
    // Both appear in the real build's PoB spec (verified 2026-09-24).
    expect(tree.isStartNode(50986)).toBe(true); // class start "DUELIST", shared by Duelist and Mercenary
    expect(tree.isStartNode(7120)).toBe(true); // Mercenary2's ascendancy start
    expect(tree.isStartNode(45969)).toBe(false); // an ordinary allocated node
    expect(tree.isStartNode(15671)).toBe(false); // unknown to this tree
  });

  it('knows which ascendancy a node belongs to', async () => {
    const { tree } = await getCatalogue();
    expect(tree.ascendancyOf(42761)).toBe('Druid1');
    // A plain main-tree node from the real build's first spec.
    expect(tree.ascendancyOf(45969)).toBeNull();
  });

  it('finds items by exact name, uniques flagged', async () => {
    const { items } = await getCatalogue();
    expect(items.byName.get('Stellar Amulet')).toMatchObject({ category: 'Amulet', isUnique: false });
    expect(items.byName.get('Cloak of Flame')).toMatchObject({ category: 'Body Armour', isUnique: true });
    expect(items.byName.get('stellar amulet')).toBeUndefined();
  });

  it('finds the longest known base inside a magic item name', async () => {
    const { items } = await getCatalogue();
    expect(items.findBaseIn('Saturated Ultimate Life Flask of the Ample')?.name).toBe('Ultimate Life Flask');
    expect(items.findBaseIn("Experimenter's Golden Charm of the Ample")?.name).toBe('Golden Charm');
  });

  it("reads an item's icon from its detail file", async () => {
    const { items } = await getCatalogue();
    const amulet = items.byName.get('Stellar Amulet')!;
    const icon = await items.iconUrlFor(amulet.slug);
    expect(icon).not.toBeNull();
    expect(icon!.startsWith('/data/wiki/')).toBe(true);
    expect(await items.iconUrlFor('no-such-item-slug')).toBeNull();
  });

  it('is built once and cached', async () => {
    expect(await getCatalogue()).toBe(await getCatalogue());
  });
});
