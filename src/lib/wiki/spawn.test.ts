import { describe, expect, it } from 'vitest';
import { canSpawn, modEligibility } from './spawn';

// Failure modes first (AGENTS.md). Real shapes from public/data/wiki/2026-08-25/mods:
// a desecrated ("Unveiled") mod carries class tags with weight 1 and a god tag;
// an essence-only mod is an `Item` mod whose only weight is `default: 0`.

const amulet = { modDomain: 'Item', tags: new Set(['default', 'amulet']) };
const mace = { modDomain: 'Item', tags: new Set(['default', 'mace', 'one_hand_weapon', 'weapon']) };
const emerald = { modDomain: 'Atlas', tags: new Set(['default', 'dexjewel']) };

const desecrated = (tags: string[]) => ({
  slug: 'abyssmodamuletamanamuprefixglobaldefences',
  domain: 'Unveiled',
  spawnWeights: [...tags.map((tag) => ({ tag, weight: 1 })), { tag: 'default', weight: 0 }],
});
const essence = { slug: 'areaofeffectessence1', domain: 'Item', spawnWeights: [{ tag: 'default', weight: 0 }] };
const normal = { slug: 'strength1', domain: 'Item', spawnWeights: [{ tag: 'amulet', weight: 1 }, { tag: 'default', weight: 0 }] };

describe('canSpawn (unchanged first-match rule)', () => {
  it('weight 0 on the first carried tag excludes', () => {
    expect(canSpawn([{ tag: 'default', weight: 0 }], new Set(['default']))).toBe(false);
  });
});

describe('modEligibility — which mods a base can carry, and where they come from', () => {
  it('a natural mod rolls as itself', () => {
    expect(modEligibility(normal, amulet)).toBe('normal');
  });

  it('a desecrated mod rolls only on the class its tags name', () => {
    expect(modEligibility(desecrated(['amulet', 'amanamu_mod']), amulet)).toBe('desecrated');
    expect(modEligibility(desecrated(['amulet', 'amanamu_mod']), mace)).toBeNull();
  });

  it('a desecrated mod never goes on a jewel: a jewel is another domain', () => {
    expect(modEligibility({ ...desecrated(['dexjewel']), slug: 'abyssmodjewelprefixspelldamageenergyshield' }, emerald)).toBeNull();
  });

  it('a desecrated mod nobody can reach (only a non-class tag weighs) is excluded', () => {
    const genesis = { slug: 'genesistreebeltminionadditionalprojectilechance', domain: 'Unveiled', spawnWeights: [{ tag: 'amulet', weight: 0 }, { tag: 'breach_desecration', weight: 1 }, { tag: 'default', weight: 0 }] };
    expect(modEligibility(genesis, amulet)).toBeNull();
  });

  it('an essence-only mod (Item domain, no weight anywhere) is an essence mod on an Item-domain base', () => {
    expect(modEligibility(essence, amulet)).toBe('essence');
    expect(modEligibility(essence, emerald)).toBeNull();
  });

  it('a zero-weight Item mod that is NOT essence-named stays excluded (legacy/handwraps leftovers)', () => {
    expect(modEligibility({ slug: 'handwrapsdexterity1', domain: 'Item', spawnWeights: [{ tag: 'default', weight: 0 }] }, amulet)).toBeNull();
  });

  it('other domains never roll, whatever their weights', () => {
    expect(modEligibility({ slug: 'flask1', domain: 'Flask', spawnWeights: [{ tag: 'default', weight: 1 }] }, amulet)).toBeNull();
    expect(modEligibility({ slug: 'monster1', domain: 'Monster', spawnWeights: [{ tag: 'amulet', weight: 1 }] }, amulet)).toBeNull();
  });

  it('a base with no mod domain can roll nothing', () => {
    expect(modEligibility(normal, { modDomain: null, tags: new Set(['amulet']) })).toBeNull();
  });
});
