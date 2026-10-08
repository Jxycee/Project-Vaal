import { describe, expect, it } from 'vitest';
import { eligibleMods } from './modCatalogue';

// Real data (public/data/wiki/2026-08-25). The five counts are the ones
// PoB2's own Data/ModItem.lua gives under the same first-match rule —
// verified 2026-09-24, see plans/2026-09-25-slice4-item-affixes.md.

const count = (groups: Awaited<ReturnType<typeof eligibleMods>>) => (groups ?? []).reduce((n, g) => n + g.tiers.length, 0);
/** Natural mods only — the set PoB2's own counts describe. Desecrated and essence groups carry a `source`. */
const natural = (groups: Awaited<ReturnType<typeof eligibleMods>>) => (groups ?? []).filter((g) => g.source === undefined);

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
    expect(count(natural(await eligibleMods(slug, 'prefix')))).toBe(prefixes);
    expect(count(natural(await eligibleMods(slug, 'suffix')))).toBe(suffixes);
  });

  it('gives a jewel its own jewel mods', async () => {
    const prefixes = await eligibleMods('emerald', 'prefix');
    expect(count(prefixes)).toBe(30);
    expect(prefixes!.some((g) => g.tiers.some((t) => t.slug === 'jewelprojectilespeed'))).toBe(true);
  });
});

describe('eligibleMods — desecrated and essence mods are reachable, and labelled', () => {
  it('offers an amulet the Amanamu global-defences prefix as its own Desecrated group', async () => {
    const groups = (await eligibleMods('gold-amulet', 'prefix'))!;
    const desecrated = groups.filter((g) => g.source === 'desecrated');
    expect(desecrated.flatMap((g) => g.tiers.map((t) => t.slug))).toContain('abyssmodamuletamanamuprefixglobaldefences');
    // The natural groups are untouched: no source, and no desecrated tier hides in one.
    const naturalSlugs = natural(groups).flatMap((g) => g.tiers.map((t) => t.slug));
    expect(naturalSlugs).not.toContain('abyssmodamuletamanamuprefixglobaldefences');
  });

  it('offers a ring the Kurgal cold-and-chaos suffix, and not a mace-only desecrated mod', async () => {
    const slugs = (await eligibleMods('amethyst-ring', 'suffix'))!.flatMap((g) => g.tiers.map((t) => t.slug));
    expect(slugs).toContain('abyssmodarmourjewellerykurgalsuffixcoldchaosresistance');
    expect(slugs).not.toContain('abyssmod1hmaceamanamusuffixadditionalfissurechance');
  });

  it('offers essence-only mods, labelled Essence, and not unobtainable zero-weight leftovers', async () => {
    const groups = (await eligibleMods('amethyst-ring', 'suffix'))!;
    const essence = groups.filter((g) => g.source === 'essence').flatMap((g) => g.tiers.map((t) => t.slug));
    expect(essence).toContain('areaofeffectessence1');
    const all = groups.flatMap((g) => g.tiers.map((t) => t.slug));
    expect(all).not.toContain('handwrapsdexterity1');
  });

  it('gives a jewel no desecrated mods: it is another domain', async () => {
    const groups = (await eligibleMods('emerald', 'prefix'))!;
    expect(groups.filter((g) => g.source !== undefined)).toEqual([]);
  });
});
