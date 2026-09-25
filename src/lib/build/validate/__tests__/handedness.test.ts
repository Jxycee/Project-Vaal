import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { handednessOf, TWO_HANDED_CATEGORIES } from '../handedness';
import { categoriesForSlot } from '../../gearSlots';

describe('handednessOf — every way it could be wrong', () => {
  it('calls all eight two-handed categories two-handed, Talisman included', () => {
    for (const c of ['Two Hand Sword', 'Two Hand Axe', 'Two Hand Mace', 'Bow', 'Crossbow', 'Staff', 'Warstaff', 'Talisman']) {
      expect(handednessOf(c), c).toBe('two');
    }
  });

  it('calls unique-stash "Mace" unknown, because it merges one- and two-handed uniques', () => {
    expect(handednessOf('Mace')).toBe('unknown');
  });

  it('calls every other main-hand category one-handed', () => {
    const others = categoriesForSlot('weapon1_main').filter((c) => !TWO_HANDED_CATEGORIES.has(c) && c !== 'Mace');
    expect(others.length).toBe(9);
    for (const c of others) expect(handednessOf(c), c).toBe('one');
  });

  it('never guesses one-handed for a category it does not know', () => {
    expect(handednessOf('Shield')).toBe('unknown');
    expect(handednessOf('')).toBe('unknown');
    expect(handednessOf('two hand sword')).toBe('unknown');
  });
});

// Real data: the category rule must agree with GGG's own class tags on every
// base that carries them. Uniques carry no tags, so they are skipped here.
describe('handednessOf — against public/data/wiki', () => {
  const dir = 'public/data/wiki/2026-08-25/items';
  const items = readdirSync(dir).map(
    (f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as { name: string; category: string; tags?: string[] },
  );

  it('every tagged item in a two-handed category carries `twohand`', () => {
    const checked = items.filter((i) => handednessOf(i.category) === 'two' && (i.tags?.length ?? 0) > 0);
    expect(checked.length).toBeGreaterThan(200);
    const wrong = checked.filter((i) => !i.tags!.includes('twohand')).map((i) => i.name);
    expect(wrong).toEqual([]);
  });

  it('every tagged item in a one-handed category carries `onehand`', () => {
    const checked = items.filter((i) => handednessOf(i.category) === 'one' && (i.tags?.length ?? 0) > 0);
    expect(checked.length).toBeGreaterThan(100);
    const wrong = checked.filter((i) => !i.tags!.includes('onehand')).map((i) => i.name);
    expect(wrong).toEqual([]);
  });
});
