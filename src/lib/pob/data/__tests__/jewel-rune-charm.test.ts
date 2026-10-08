/**
 * Failure modes this data test guards against (written before the sync script):
 *  1. The Lua parser drops or merges entries (a `}` mismatch swallows the rest of the file)
 *     -> entry counts must match the source (377 / 627 / 51 / 127 / 388).
 *  2. Positional stat lines get lost when a table also has named keys -> every entry has text.
 *  3. Bonded: blocks of runes/idols are skipped -> a known idol must carry bonded text.
 *  4. Ranges "(a-b)" not extracted -> known mod keeps [[5,10]] (source order kept; some are high-first).
 *  5. A file silently balloons past the size budget -> each stays under 3 MB.
 *  6. Multi-line soul cores lose their second stat line -> known 2-line core keeps both.
 */
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// One synced mod row (jewel, charm, corrupted, veiled or rune); only the fields this test reads are typed.
interface ModRow {
  id?: string;
  name?: string;
  text: string[];
  bonded?: { text: string[] };
  ranges: [number, number][];
  [key: string]: unknown;
}
const dir = path.join(__dirname, '..');
const load = (n: string) => JSON.parse(readFileSync(path.join(dir, `${n}.json`), 'utf8')) as ModRow[];

const jewel = load('mod-jewel');
const runes = load('mod-runes');
const charm = load('mod-charm');
const corrupted = load('mod-corrupted');
const veiled = load('mod-veiled');

describe('PoB2 jewel / rune / charm / corrupted / veiled data', () => {
  it('counts match the source files', () => {
    expect(jewel).toHaveLength(377);
    expect(runes).toHaveLength(627);
    expect(charm).toHaveLength(51);
    expect(corrupted).toHaveLength(127);
    expect(veiled).toHaveLength(388);
  });

  it('every entry has stat text and sane ranges', () => {
    for (const m of [...jewel, ...charm, ...corrupted, ...veiled, ...runes]) {
      // Some wand/staff runes and idols only grant their Bonded: line, so accept either.
      expect(m.text.length + (m.bonded?.text.length ?? 0), m.id ?? m.name).toBeGreaterThan(0);
      // PoB writes some ranges high-first (e.g. "(8-5)" for reduced-style stats); keep source order.
      for (const [lo, hi] of m.ranges) expect(Number.isFinite(lo) && Number.isFinite(hi)).toBe(true);
    }
    expect(jewel.find((m) => m.id === 'JewelAccuracy')).toMatchObject({
      type: 'Prefix',
      level: 1,
      group: 'IncreasedAccuracyPercent',
      text: ['(5-10)% increased Accuracy Rating'],
      ranges: [[5, 10]],
      statOrder: [1332],
    });
  });

  it('keeps ids, types and trade hashes on the other mod files', () => {
    expect(charm.find((m) => m.id === 'FlaskChargesAddedIncreasePercent1')).toMatchObject({
      type: 'Suffix',
      affix: 'of the Constant',
      level: 1,
    });
    expect(corrupted.find((m) => m.id === 'CorruptionLocalIncreasedPhysicalDamageReductionRatingPercent1')).toMatchObject({
      type: 'Corrupted',
      trade: { '1062208444': ['(15-25)% increased Armour'] },
    });
    expect(veiled[0].id).toBe('HistoricAbyssJewelAttributesGrantExtraTribute');
  });

  it('runes: one entry per name+slot, types, bonded and two-line cores', () => {
    const types = new Set(runes.map((r) => r.type));
    for (const t of ['Rune', 'SoulCore', 'Idol', 'AbyssalEye']) expect(types.has(t)).toBe(true);
    expect(runes.find((r) => r.name === "Hayoxi's Soul Core of Heatproofing" && r.slot === 'helmet')).toMatchObject({
      type: 'SoulCore',
      levelReq: 50,
      text: ['+40% of Armour also applies to Cold Damage'],
    });
    const bonded = runes.filter((r) => r.bonded);
    expect(bonded.length).toBe(479);
    expect(bonded.some((r) => r.bonded?.text.includes('+5% to Quality of all Skills'))).toBe(true);
    const twoLine = runes.find((r) => r.text.includes('1% increased Spirit for each Corrupted Item Equipped'));
    expect(twoLine?.text).toHaveLength(2);
    expect(twoLine?.socketBound).toBe(true);
  });

  it('known import-gap lines exist where expected', () => {
    expect(jewel.filter((m) => m.text.some((t: string) => /increased Effect of Prefixes/.test(t)))).toHaveLength(1);
    expect(runes.filter((r) => r.text.some((t: string) => /\+\d+ to Level of all Spell Skills/.test(t)))).toHaveLength(3);
    expect(runes.filter((r) => r.text.some((t: string) => /Charm Slot/.test(t)))).toHaveLength(2);
  });

  it('stays under the size budget', () => {
    for (const n of ['mod-jewel', 'mod-runes', 'mod-charm', 'mod-corrupted', 'mod-veiled']) {
      expect(statSync(path.join(dir, `${n}.json`)).size).toBeLessThan(3 * 1024 * 1024);
    }
  });
});
