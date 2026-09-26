import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { getCatalogue } from '@/lib/pob/catalogue';
import { decodePobCode } from '@/lib/pob/decode';
import { mapBuild } from '@/lib/pob/mapBuild';
import { parsePobXml } from '@/lib/pob/parse';
import { collectContributions, type Collected } from '../collect';
import { makeCollectData } from '../collectData';
import { computeDefences, type DefenceSheet } from '../engine';

// The vendored real build (src/lib/pob/__fixtures__/, pobb.in TUsV2f6hi8cg,
// level 94 Witchhunter), imported through the real pipeline and run through
// the real data and engine.
//
// WHY THIS IS NOT "match PoB's saved numbers". The export carries PoB's own
// <PlayerStat> values (Life 2595, Mana 494, ES 114, Evasion 380, …), but they
// were computed on an OLDER game version (targetVersion="0_1"). Checked
// 2026-09-25: its Cloak of Flame reads 73 ES, which implies a Silk Robe base
// of ~21 ES, whereas PoB2's CURRENT data (Data/Bases/body.lua) and ours both
// say 64; and its Amethyst Ring lists `Prefix: IncreasedMana13` yet shows no
// Mana line, so that PoB never applied the mod — its Mana excludes 2 x 189.
// Exact equality with numbers from a different patch would prove nothing.
//
// What IS exact: each armour piece's defences, derived by hand from PoB2's
// CURRENT base values (fetched raw from the `dev` branch, 2026-09-25) through
// PoB2's item formula (Item.lua:2586-2590) — an independent source agreeing
// with our data and our collector — plus the parts that do not depend on a
// patch at all.

let collected: Collected;
let sheet: DefenceSheet;

beforeAll(async () => {
  const decoded = decodePobCode(readFileSync('src/lib/pob/__fixtures__/sample-pob2-code.txt', 'utf8'));
  if (!decoded.ok) throw new Error('fixture failed to decode');
  const parsed = parsePobXml(decoded.xml);
  if (!parsed.ok) throw new Error('fixture failed to parse');
  const mapped = await mapBuild(parsed.build, await getCatalogue(), {});
  if (!mapped.ok) throw new Error(mapped.error);
  const checkpoint = mapped.plan.checkpoints[(parsed.build.activeSpec ?? parsed.build.specs.length) - 1];

  const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
  const dir = (d: string) => new Map(readdirSync(d).map((f) => [f.replace(/\.json$/, ''), json(`${d}/${f}`)] as [string, unknown]));
  const tree = json('public/data/tree/0.5.2/data.json');
  const data = makeCollectData({
    tree,
    nodeStats: json('public/data/tree/0.5.2/node-stats.json'),
    implicitStats: json('public/data/wiki/2026-08-25/implicit-stats.json'),
    uniqueStats: json('public/data/wiki/2026-08-25/unique-stats.json'),
    items: dir('public/data/wiki/2026-08-25/items'),
    mods: dir('public/data/wiki/2026-08-25/mods'),
  });
  const mercenary = tree.classes.find((c: { name: string }) => c.name === 'Mercenary');
  collected = collectContributions({ passive: checkpoint.passive_state, gear: checkpoint.gear_state, level: 94, set: 1 }, data);
  sheet = computeDefences({
    level: 94,
    classBase: { str: mercenary.base_str, dex: mercenary.base_dex, int: mercenary.base_int },
    contributions: collected.contributions,
    resistancePenalty: collected.resistancePenalty,
    flags: collected.flags,
  });
}, 120_000);

const from = (source: string, pool: string) =>
  collected.contributions.filter((c) => c.source === source && c.pool === pool && c.kind === 'flat').reduce((n, c) => n + c.value, 0);

describe('the fixture build — each armour piece, against PoB2 current bases x the item formula', () => {
  it('Paragon Greathelm: Armour 357 at 20% quality -> 428', () => {
    expect(from('Paragon Greathelm', 'armour')).toBe(Math.round(357 * 1.2));
  });

  it('Vaal Greaves: Armour 268 at 20% quality -> 322', () => {
    expect(from('Vaal Greaves', 'armour')).toBe(Math.round(268 * 1.2));
  });

  it('Blueflame Bracers on Goldcast Cuffs: Armour 49 -> 59; ES (15 + its fixed +20) -> 42', () => {
    expect(from('Blueflame Bracers', 'armour')).toBe(Math.round(49 * 1.2));
    expect(from('Blueflame Bracers', 'energyShield')).toBe(Math.round((15 + 20) * 1.2));
  });

  it('Cloak of Flame on Silk Robe: ES (64 + its +(30-50) at mid-roll 40) -> 125', () => {
    expect(from('Cloak of Flame', 'energyShield')).toBe(Math.round((64 + 40) * 1.2));
    expect(collected.assumed).toContain('Cloak of Flame: unique rolls at mid-roll');
  });
});

describe('the fixture build — what does not depend on a patch', () => {
  it('assumes endgame at level 94, with the -60% penalty', () => {
    expect(collected.act).toBe('Endgame');
    expect(collected.resistancePenalty).toBe(-60);
  });

  it('has exactly the quest Spirit, 100 — which PoB saved too — since no item grants Spirit', () => {
    expect(sheet.spirit).toBe(100);
  });

  it('names the runes it did not count, on each item that carries them', () => {
    for (const item of ['Paragon Greathelm', 'Cloak of Flame', 'Blueflame Bracers', 'Vaal Greaves', 'Siege Crossbow']) {
      expect(collected.notCounted.some((n) => n.startsWith(`${item}: `) && n.includes('rune')), item).toBe(true);
    }
  });

  it('counts all 27 attribute choices kept on spec 8, leaving none unchosen', () => {
    const attributePassives = collected.contributions.filter((c) => c.source === 'Attribute passive');
    expect(attributePassives).toHaveLength(27);
    expect(collected.notCounted.join(' ')).not.toContain('no attribute chosen');
  });
});
