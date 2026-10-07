// Round trip: import a real PoB2 export -> export it -> import the export.
// Written before exportBuild existed. The ways an export can be wrong, each of
// which an assertion below pins on the two REAL builds (the vendored 8-
// checkpoint fixture and the momentsZX level-98 Deadeye, with weapon sets,
// uniques, desecrated mods, runes and quest rewards):
//   1. a checkpoint loses or gains passives, a weapon-set tag, an ascendancy
//      node, an attribute choice or a quest choice
//   2. the export names a different class / ascendancy / level
//   3. a gem, its level/quality/supports or the main skill changes
//   4. an item changes slug, rarity, quality, runes, rolls or affixes
//   5. jewels land in the wrong socket
//   6. all of the above looks fine field by field but the DEFENCE SHEET moves
//      (the strongest check: it is what the user sees)
//   7. the code is not something decodePobCode/parsePobXml accept strictly
//   8. a checkpoint name with no readable level comes back at the wrong level
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { getCatalogue } from '@/lib/pob/catalogue';
import { decodePobCode } from '@/lib/pob/decode';
import { mapBuild, type ImportPlan } from '@/lib/pob/mapBuild';
import { parsePobXml } from '@/lib/pob/parse';
import { collectContributions } from '@/lib/build/stats/collect';
import { makeCollectData } from '@/lib/build/stats/collectData';
import { computeDefences } from '@/lib/build/stats/engine';
import { encodePobCode, exportPobXml, type ExportResult } from '../exportBuild';
import gemIds from '../pobGemIds.json';

interface Round {
  before: ImportPlan;
  after: ImportPlan;
  activeIndex: number;
  exported: Extract<ExportResult, { ok: true }>;
  code: string;
}

const SOURCES = {
  fixture: 'src/lib/pob/__fixtures__/sample-pob2-code.txt',
  momentsZX: 'docs/superpowers/handoffs/2026-09-27-momentsZX-pob2-code.txt',
} as const;

const rounds = {} as Record<keyof typeof SOURCES, Round>;

async function importCode(code: string) {
  const decoded = decodePobCode(code);
  if (!decoded.ok) throw new Error(`decode: ${decoded.error}`);
  const parsed = parsePobXml(decoded.xml);
  if (!parsed.ok) throw new Error(`parse: ${parsed.error}`);
  const mapped = await mapBuild(parsed.build, await getCatalogue(), {});
  if (!mapped.ok) throw new Error(mapped.error);
  const shown = parsed.build.activeSpec ?? parsed.build.specs.length;
  return { plan: mapped.plan, activeIndex: Math.min(Math.max(shown, 1), parsed.build.specs.length) - 1 };
}

beforeAll(async () => {
  const catalogue = await getCatalogue();
  for (const key of Object.keys(SOURCES) as (keyof typeof SOURCES)[]) {
    const { plan: before, activeIndex } = await importCode(readFileSync(SOURCES[key], 'utf8'));
    const exported = await exportPobXml({ build: before.build, checkpoints: before.checkpoints, activeIndex }, catalogue);
    if (!exported.ok) throw new Error(exported.error);
    const code = encodePobCode(exported.xml);
    const { plan: after } = await importCode(code);
    rounds[key] = { before, after, activeIndex, exported, code };
  }
}, 300_000);

const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b);

interface Craft {
  implicitValues: number[][];
  uniqueValues: number[][];
  prefixes: { slug: string; values: number[] }[];
  suffixes: { slug: string; values: number[] }[];
  [k: string]: unknown;
}

// Two deliberate relaxations; everything else must match exactly.
//  1. A value row the player never set (empty) is read by the engine at each
//     range's midpoint, and export writes it there, so it comes back as that
//     midpoint: only rows that WERE set are compared.
//  2. "Rarity of Items found" exists as a prefix (itemfoundrarityincreaseprefixN)
//     AND a suffix (itemfoundrarityincreaseN) printing the same line, so text
//     cannot say which an item has (momentsZX ring1: prefix3 17% + suffix2 14%
//     come back as prefix2 14% + suffix3 17%). For that family only, the
//     multiset of rolled values must match, not which side holds which.
//  3. The fixture's Amethyst Ring has "+189 to maximum Mana" (increasedmana13).
//     The export writes that line exactly, and PoB2 reads it as written, but
//     OUR importer's text reader only offers mods that can roll on the base in
//     current data, where tier 13 cannot on a ring, so it clamps to tier 12 at
//     179 (importer behaviour by design, not an export loss). The expected side
//     is passed through the same reading before comparing.
const KNOWN_CLAMP = { from: 'increasedmana13', to: { slug: 'increasedmana12', values: [179] } };
function asImporterReadsIt<T extends { prefixes: { slug: string; values: number[] }[] }>(craft: T): T {
  return { ...craft, prefixes: craft.prefixes.map((m) => (m.slug === KNOWN_CLAMP.from ? KNOWN_CLAMP.to : m)) };
}
//  4. A mod whose display range is not its roll range (crit "(3-4)%" over rolls
//     311-380) cannot print a stored roll, so it is written at its best display
//     value and the export report says so; it comes back at its best roll. Only
//     the slug is compared for these (the fixture's localcriticalstrikechance4,
//     377 -> 380).
const UNIT_MISMATCH = new Set(['localcriticalstrikechance4']);
const RARITY_FAMILY = /^itemfoundrarityincrease(prefix)?\d+$/;
function normalised(was: Craft | null, now: Craft | null): [unknown, unknown] {
  if (!was || !now) return [was, now];
  was = asImporterReadsIt(was);
  const rows = (a: number[][], b: number[][]) => b.map((row, i) => (a[i] && a[i].length === 0 ? [] : row));
  const slugOnly = (m: { slug: string; values: number[] }) => (UNIT_MISMATCH.has(m.slug) ? { slug: m.slug, values: [] } : m);
  const split = (c: Craft) => ({
    rest: {
      prefixes: c.prefixes.filter((m) => !RARITY_FAMILY.test(m.slug)).map(slugOnly),
      suffixes: c.suffixes.filter((m) => !RARITY_FAMILY.test(m.slug)).map(slugOnly),
    },
    rarity: [...c.prefixes, ...c.suffixes].filter((m) => RARITY_FAMILY.test(m.slug)).map((m) => m.values.join(',')).sort(),
  });
  const w = split(was);
  const n = split(now);
  return [
    { ...was, implicitValues: was.implicitValues, uniqueValues: was.uniqueValues, ...w.rest, rarityFamily: w.rarity },
    { ...now, implicitValues: rows(was.implicitValues, now.implicitValues), uniqueValues: rows(was.uniqueValues, now.uniqueValues), ...n.rest, rarityFamily: n.rarity },
  ];
}
function craftOf(item: { craft?: unknown } | null): Craft | null {
  return (item?.craft as Craft | undefined) ?? null;
}

for (const key of Object.keys(SOURCES) as (keyof typeof SOURCES)[]) {
  describe(`round trip: ${key}`, () => {
    it('the code is accepted by the strict decoder and parser', () => {
      const decoded = decodePobCode(rounds[key].code);
      expect(decoded.ok).toBe(true);
      if (decoded.ok) expect(parsePobXml(decoded.xml).ok).toBe(true);
    });

    it('build fields survive: class, ascendancy, level', () => {
      const { before, after } = rounds[key];
      expect(after.build.class).toBe(before.build.class);
      expect(after.build.ascendancy).toBe(before.build.ascendancy);
      expect(after.build.level).toBe(before.build.level);
    });

    it('every checkpoint keeps its level and its passives, weapon sets, ascendancy, attribute and quest choices', () => {
      const { before, after } = rounds[key];
      expect(after.checkpoints.length).toBe(before.checkpoints.length);
      before.checkpoints.forEach((cp, i) => {
        const got = after.checkpoints[i];
        expect(got.level, `checkpoint ${i + 1} level`).toBe(cp.level);
        expect(sorted(got.passive_state.set1), `checkpoint ${i + 1} set1`).toEqual(sorted(cp.passive_state.set1));
        expect(sorted(got.passive_state.set2), `checkpoint ${i + 1} set2`).toEqual(sorted(cp.passive_state.set2));
        expect(sorted(got.passive_state.ascendancyNodes), `checkpoint ${i + 1} ascendancy`).toEqual(sorted(cp.passive_state.ascendancyNodes));
        expect(got.passive_state.attributeChoices ?? {}, `checkpoint ${i + 1} attributes`).toEqual(cp.passive_state.attributeChoices ?? {});
        expect(got.passive_state.questChoices ?? {}, `checkpoint ${i + 1} quests`).toEqual(cp.passive_state.questChoices ?? {});
      });
    });

    it('gems: skills, supports, level, quality and the main skill (a gem PoB2 has no id for is dropped, and reported)', async () => {
      const catalogue = await getCatalogue();
      const known = new Set([...catalogue.gems].filter(([k]) => k in gemIds).map(([, g]) => g.slug));
      const { before, after, activeIndex } = rounds[key];
      const shape = (g: { loadouts: { id: string; skill: { slug: string } | null; supports: { slug: string }[]; level: number; quality: number; sets: number[] }[]; primaryId: string | null }) => ({
        loadouts: g.loadouts
          .filter((l) => l.skill && known.has(l.skill.slug))
          .map((l) => ({ skill: l.skill?.slug, supports: l.supports.map((s) => s.slug).filter((s) => known.has(s)), level: l.level, quality: l.quality, sets: l.sets })),
        primary: g.loadouts.filter((l) => l.skill && known.has(l.skill.slug)).findIndex((l) => l.id === g.primaryId),
      });
      expect(shape(after.checkpoints[activeIndex].gem_state)).toEqual(shape(before.checkpoints[activeIndex].gem_state));
    });

    it('gear: every slot keeps its slug and its whole craft; jewels keep their sockets', () => {
      const { before, after, activeIndex } = rounds[key];
      const a = before.checkpoints[activeIndex].gear_state;
      const b = after.checkpoints[activeIndex].gear_state;
      for (const slot of Object.keys(a).filter((s) => s !== 'jewels') as (keyof typeof a)[]) {
        const was = a[slot] as { slug: string; craft?: unknown } | null;
        const now = b[slot] as { slug: string; craft?: unknown } | null;
        expect(now?.slug ?? null, `${slot} slug`).toBe(was?.slug ?? null);
        const [w, n] = normalised(craftOf(was), craftOf(now));
        expect(n, `${slot} craft`).toEqual(w);
      }
      expect(Object.keys(b.jewels).sort()).toEqual(Object.keys(a.jewels).sort());
      for (const id of Object.keys(a.jewels)) {
        expect(b.jewels[id].slug, `jewel ${id}`).toBe(a.jewels[id].slug);
        const [w, n] = normalised(craftOf(a.jewels[id]), craftOf(b.jewels[id]));
        expect(n, `jewel ${id} craft`).toEqual(w);
      }
    });
  });
}

describe('round trip: the defence sheet does not move', () => {
  const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
  const dir = (d: string) => new Map(readdirSync(d).map((f) => [f.replace(/\.json$/, ''), json(`${d}/${f}`)] as [string, unknown]));
  const sheetsOf = (plan: ImportPlan, data: ReturnType<typeof makeCollectData>, tree: { classes: { name: string; base_str: number; base_dex: number; base_int: number }[] }) =>
    plan.checkpoints.map((cp) =>
      ([1, 2] as const).map((set) => {
        const collected = collectContributions({ passive: cp.passive_state, gear: cp.gear_state, level: cp.level, set }, data);
        const base = tree.classes.find((c) => c.name === plan.build.class)!;
        return computeDefences({
          level: cp.level,
          classBase: { str: base.base_str, dex: base.base_dex, int: base.base_int },
          contributions: collected.contributions,
          resistancePenalty: collected.resistancePenalty,
          flags: collected.flags,
        });
      }),
    );

  it.each(Object.keys(SOURCES) as (keyof typeof SOURCES)[])('%s: every checkpoint, both weapon sets', (key) => {
    const tree = json('public/data/tree/0.5.2/data.json');
    const data = makeCollectData({
      tree,
      nodeStats: json('public/data/tree/0.5.2/node-stats.json'),
      implicitStats: json('public/data/wiki/2026-08-25/implicit-stats.json'),
      uniqueStats: json('public/data/wiki/2026-08-25/unique-stats.json'),
      items: dir('public/data/wiki/2026-08-25/items'),
      mods: dir('public/data/wiki/2026-08-25/mods'),
    });
    const { before, after } = rounds[key];
    const expected: ImportPlan = {
      ...before,
      checkpoints: before.checkpoints.map((cp) => ({
        ...cp,
        gear_state: Object.fromEntries(
          Object.entries(cp.gear_state).map(([slot, item]) => {
            const it = item as { craft?: Craft } | null;
            return [slot, slot !== 'jewels' && it?.craft ? { ...it, craft: asImporterReadsIt(it.craft) } : item];
          }),
        ) as typeof cp.gear_state,
      })),
    };
    expect(sheetsOf(after, data, tree)).toEqual(sheetsOf(expected, data, tree));
  });
});

describe('export report and level rule', () => {
  it('says that gear and gems come from one checkpoint when there are several', () => {
    const { exported } = rounds.fixture;
    expect(exported.report.some((r) => r.kind === 'note' && /one set of gear/.test(r.message))).toBe(true);
  });

  it('a name without a readable level gets one, and it reads back', async () => {
    const catalogue = await getCatalogue();
    const { before, activeIndex } = rounds.fixture;
    const checkpoints = before.checkpoints.map((cp, i) => (i === 0 ? { ...cp, name: 'Early game setup', level: 37 } : cp));
    const exported = await exportPobXml({ build: before.build, checkpoints, activeIndex }, catalogue);
    if (!exported.ok) throw new Error(exported.error);
    const { plan } = await importCode(encodePobCode(exported.xml));
    expect(plan.checkpoints[0].level).toBe(37);
    expect(plan.checkpoints[0].name).toContain('Early game setup');
  });
});
