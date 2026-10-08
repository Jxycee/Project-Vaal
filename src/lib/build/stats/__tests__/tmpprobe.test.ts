import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { getCatalogue } from '@/lib/pob/catalogue';
import { decodePobCode } from '@/lib/pob/decode';
import { mapBuild } from '@/lib/pob/mapBuild';
import { parsePobXml } from '@/lib/pob/parse';
import { collectContributions } from '../collect';
import { makeCollectData } from '../collectData';
import { computeDefences } from '../engine';

it('probe', async () => {
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
  const f = process.env.PROBE_FILE ?? 'ordinary-titan-1.json';
  const pools = (process.env.PROBE_POOLS ?? 'evasion').split(',');
  const fx = json('docs/superpowers/oracle/' + f);
  const dec = decodePobCode(fx.pob.trim());
  if (!dec.ok) throw new Error('dec');
  const parsed = parsePobXml(dec.xml);
  if (!parsed.ok) throw new Error('parse');
  const mapped = await mapBuild(parsed.build, await getCatalogue(), {});
  if (!mapped.ok) throw new Error(mapped.error);
  const cp = mapped.plan.checkpoints[mapped.plan.checkpoints.length - 1];
  const { buildConfig, ...rest } = cp.passive_state;
  const col = collectContributions({ passive: cp.passive_state, gear: cp.gear_state, level: fx.level, set: parsed.build.useSecondWeaponSet ? 2 : 1, gems: cp.gem_state }, data);
  const out: string[] = [];
  for (const p of pools) {
    out.push('== ' + p);
    for (const c of col.contributions.filter((x) => x.pool === p)) out.push(`${c.kind} ${c.value} ${c.source} ${c.slot ?? ''}${c.perAttribute ? ' per' + JSON.stringify(c.perAttribute) : ''}`);
    const pb = fx.breakdowns.stats[{ life: 0, mana: 1, energyShield: 2, spirit: 3, evasion: 5, str: 6, dex: 7, int: 8 }[p] as number];
    out.push('-- PoB ' + JSON.stringify(pb?.mods?.map((m: number[]) => [m[0], m[1], fx.breakdowns.sources[m[2]]?.[1] ?? fx.breakdowns.sources[m[2]]?.[0]])));
  }
  writeFileSync(process.env.PROBE_OUT ?? 'probe.out.txt', out.join('\n'));
});
