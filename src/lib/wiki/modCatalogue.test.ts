import { canSpawn } from './spawn';
import { describe, expect, it } from 'vitest';
import { eligibleMods, getModCatalogue } from './modCatalogue';

// Real data (public/data/wiki/2026-08-25). The five counts are the ones
// PoB2's own Data/ModItem.lua gives under the same first-match rule —
// verified 2026-09-24, see plans/2026-09-25-slice4-item-affixes.md.

const count = (groups: Awaited<ReturnType<typeof eligibleMods>>) => (groups ?? []).reduce((n, g) => n + g.tiers.length, 0);

describe('eligibleMods — every way it could be wrong', () => {
  it('refuses a slug that is not a plain item slug, before touching the disk', async () => {
    for (const bad of ['../package', '..%2Fpackage', 'amethyst-ring/../../x', 'Amethyst-Ring', '', 'a'.repeat(121)]) {
      expect(await eligibleMods(bad, 'prefix'), bad).toBeNull();
    }
  });

  it('returns null for an item that does not exist', async () => {
    expect(await eligibleMods('no-such-item-anywhere', 'prefix')).toBeNull();
  });

  it('gives a unique nothing to add — its mods are fixed', async () => {
    expect(await eligibleMods('cloak-of-flame', 'prefix')).toEqual([]);
    expect(await eligibleMods('cloak-of-flame', 'suffix')).toEqual([]);
  });

  it('keeps prefixes and suffixes apart', async () => {
    const prefixes = (await eligibleMods('amethyst-ring', 'prefix'))!.flatMap((g) => g.tiers.map((t) => t.slug));
    const suffixes = (await eligibleMods('amethyst-ring', 'suffix'))!.flatMap((g) => g.tiers.map((t) => t.slug));
    expect(prefixes.filter((s) => suffixes.includes(s))).toEqual([]);
    expect(prefixes).toContain('addedcolddamage1');
    expect(suffixes).toContain('strength1');
  });

  it('orders tiers inside a group by required level, and every tier carries its typed rolls', async () => {
    const groups = (await eligibleMods('amethyst-ring', 'prefix'))!;
    for (const g of groups) {
      const levels = g.tiers.map((t) => t.level);
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
      for (const t of g.tiers) expect(t.rolls.length).toBeGreaterThanOrEqual(0);
    }
    const cold = groups.find((g) => g.group === 'ColdDamage')!;
    expect(cold.tiers[0]).toMatchObject({ slug: 'addedcolddamage1', level: 1, rolls: [{ stat: 'attack_minimum_added_cold_damage', min: 1, max: 1 }, { stat: 'attack_maximum_added_cold_damage', min: 2, max: 3 }] });
  });
});

describe('eligibleMods — matches PoB2 on real bases', () => {
  it.each([
    ['amethyst-ring', 100, 103],
    ['vaal-greaves', 44, 85],
    ['siege-crossbow', 71, 75],
    ['stellar-amulet', 81, 128],
    ['paragon-greathelm', 59, 78],
  ])('%s: %i prefixes, %i suffixes', async (slug, prefixes, suffixes) => {
    expect(count(await eligibleMods(slug, 'prefix'))).toBe(prefixes);
    expect(count(await eligibleMods(slug, 'suffix'))).toBe(suffixes);
  });

  it('gives a jewel its own jewel mods', async () => {
    const prefixes = await eligibleMods('emerald', 'prefix');
    expect(count(prefixes)).toBe(30);
    expect(prefixes!.some((g) => g.tiers.some((t) => t.slug === 'jewelprojectilespeed'))).toBe(true);
  });
});

describe('getModCatalogue', () => {
  it('is built once and shared', async () => {
    expect(await getModCatalogue()).toBe(await getModCatalogue());
  });
});

describe('eligibleMods — a base whose implicit adds ring modifiers', () => {
  it('offers ring prefixes on the Grasping Mail ("Can roll Ring Modifiers"), not on a plain body armour', async () => {
    const { mods } = await getModCatalogue();
    // A prefix that ring bases can roll and body armours cannot.
    const ringOnly = mods.find(
      (m) => m.kind === 'prefix' && m.domain === 'Item' && canSpawn(m.spawnWeights, new Set(['default', 'ring'])) && !canSpawn(m.spawnWeights, new Set(['default', 'armour', 'body_armour'])),
    );
    expect(ringOnly, 'no ring-only prefix in our data').toBeDefined();
    const offered = (groups: Awaited<ReturnType<typeof eligibleMods>>) => (groups ?? []).flatMap((g) => g.tiers.map((t) => t.slug));
    expect(offered(await eligibleMods('runemastered-grasping-mail', 'prefix'))).toContain(ringOnly!.slug);
    expect(offered(await eligibleMods('full-plate', 'prefix'))).not.toContain(ringOnly!.slug);
  });
});
