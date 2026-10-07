/**
 * Writes public/data/wiki/<WIKI_DATA_VERSION>/mod-tiers.json: for every mod,
 * its tier counted FROM THE TOP, the way players read it (P1 / S1 is the best
 * roll), and how many tiers its family has.
 *
 *   { "<mod slug>": [rankFromTop, tierCount] }
 *
 * Our mod files number tiers upward with item level (tier 8 is the best of
 * LocalPhysicalDamagePercent), which is the reverse of what a reader expects.
 * A family is group + generationType + domain, so a prefix and a suffix of the
 * same group, or an Item mod and a desecrated one, never share a ladder.
 *
 * Re-run after sync:wiki: npm run sync:mod-tiers
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WIKI_DATA_VERSION } from '../src/lib/wiki/types';

const dir = path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION, 'mods');
interface Row {
  slug: string;
  family: string;
  tier: number;
}
const rows: Row[] = [];
for (const file of readdirSync(dir)) {
  if (!file.endsWith('.json')) continue;
  const mod = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as {
    slug: string;
    group?: string;
    generationType?: string;
    domain?: string;
    tier?: number;
  };
  if (typeof mod.tier !== 'number' || !mod.group) continue;
  rows.push({ slug: mod.slug, family: `${mod.group}|${mod.generationType}|${mod.domain}`, tier: mod.tier });
}

const tiersByFamily = new Map<string, number[]>();
for (const r of rows) tiersByFamily.set(r.family, [...(tiersByFamily.get(r.family) ?? []), r.tier]);
for (const [family, tiers] of tiersByFamily) tiersByFamily.set(family, [...new Set(tiers)].sort((a, b) => b - a));

const out: Record<string, [number, number]> = {};
for (const r of rows) {
  const ladder = tiersByFamily.get(r.family)!;
  out[r.slug] = [ladder.indexOf(r.tier) + 1, ladder.length];
}
const file = path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION, 'mod-tiers.json');
writeFileSync(file, JSON.stringify(out));
console.log(`${Object.keys(out).length} mods -> ${file}`);
