// Failure modes this data test guards (written before the sync script was run):
//  1. The Lua parser stops early on a base whose table holds a string with an escaped
//     quote or a "\n" implicit -> base count collapses, multi-line implicits stay glued.
//  2. A comment or a "[n] = v" key inside a table is read as a value -> stat blocks gain
//     junk keys or lose entries (Misc.lua's mapLevel tables are all "[66] = 1" style).
//  3. The "default = true" style tag tables are kept as objects instead of tag lists,
//     or false-valued tags leak in.
//  4. Two files define the same base name (PoB has ~65 such collisions): the count must
//     equal the number of distinct names, with PoB's last-definition-wins semantics.
//  5. Hex flags in Global.lua (64-bit ModFlag values) parsed through Number() lose bits.
//  6. QuestRewards' `Options` arrays (choice quests) get dropped.
import { describe, expect, it } from 'vitest';
import bases from '../bases.json';
import quests from '../quest-rewards.json';
import misc from '../misc-constants.json';

type Base = { type: string; subType?: string; socketLimit?: number; tags: string[]; implicit?: string[]; armour?: Record<string, number>; weapon?: Record<string, number>; charm?: Record<string, unknown>; req: Record<string, number> };
const B = bases as unknown as Record<string, Base>;

describe('pob bases', () => {
  it('has the whole PoB2 base list (1769 distinct names across 28 files)', () => {
    expect(Object.keys(B).length).toBeGreaterThanOrEqual(1700);
    for (const [name, b] of Object.entries(B)) {
      expect(typeof b.type, name).toBe('string');
      expect(Array.isArray(b.tags), name).toBe(true);
      expect(b.req && typeof b.req === 'object', name).toBe(true);
    }
  });

  it('keeps armour base values, requirements and socket limits', () => {
    expect(B['Fur Plate']).toMatchObject({ type: 'Body Armour', subType: 'Armour', socketLimit: 4, armour: { Armour: 66 }, req: { str: 10 } });
    expect(B['Iron Cuirass'].req).toEqual({ level: 11, str: 21 });
    expect(B['Fur Plate'].tags).toContain('str_armour');
    expect(B['Fur Plate'].tags).not.toContain('false');
  });

  it('keeps weapon blocks, charms and implicit lines split on newlines', () => {
    expect(Object.values(B).some((b) => b.weapon?.AttackRateBase && b.weapon?.PhysicalMax)).toBe(true);
    expect(B['Thawing Charm'].implicit).toEqual(['Used when you become Frozen']);
    expect(B['Thawing Charm'].charm).toMatchObject({ duration: 3, chargesMax: 40 });
    const multi = Object.values(B).filter((b) => (b.implicit?.length ?? 0) > 1);
    expect(multi.length).toBeGreaterThan(0);
    for (const b of multi) for (const l of b.implicit!) expect(l).not.toContain('\n');
  });
});

describe('pob quest rewards', () => {
  it('lists the 29 campaign entries with choice options intact', () => {
    expect(quests).toHaveLength(29);
    const q = quests as unknown as Array<{ Info: string; Stat?: string; Options?: string[]; AreaLevel: number; questPoints?: number }>;
    expect(q.find((e) => e.Info === 'Beira')).toMatchObject({ Stat: '+10% to Cold Resistance', AreaLevel: 2 });
    expect(q.find((e) => e.Info === 'Venom Draught')!.Options).toHaveLength(3);
    expect(q.filter((e) => e.questPoints === 2)).toHaveLength(12);
  });
});

describe('pob misc constants', () => {
  const m = misc as unknown as {
    characterConstants: Record<string, number>;
    gameConstants: Record<string, number>;
    monsterLifeTable: number[];
    mapLevelLifeMult: Record<string, number>;
    global: { modFlag: Record<string, string>; colorCodes: Record<string, string>; skillType: Record<string, number> };
  };
  it('has player constants the engine relies on', () => {
    expect(m.characterConstants.life_per_level).toBe(12);
    expect(m.characterConstants.mana_per_level).toBe(4);
    expect(m.characterConstants.base_evasion_rating).toBe(7);
    expect(m.gameConstants.EndgameStartLevel).toBe(65);
    expect(m.monsterLifeTable).toHaveLength(100);
    expect(m.mapLevelLifeMult['66']).toBe(1);
  });
  it('keeps global enums, hex flags as strings', () => {
    expect(m.global.modFlag.Attack).toBe('1');
    expect(m.global.skillType.Attack).toBe(1);
    expect(m.global.colorCodes.FIRE).toBe('^xB97123');
  });
});
