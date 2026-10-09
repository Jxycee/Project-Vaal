/**
 * Writes public/data/wiki/<WIKI_DATA_VERSION>/gem-level-requirements.json: the
 * character level each active skill gem level needs, small enough for the
 * browser (PoB's skills.json is 1.6 MB and stays server-side).
 *
 *   { arrays: number[][], bySlug: { [slug]: index into arrays } }
 *
 * arrays[i][n - 1] = the character level gem level n needs. Many gems share one
 * array, so they are deduplicated. Support gems are left out on purpose: their
 * requirement is 0 at every level, so they are never gated.
 *
 * Join: wiki skill detail (gemId, e.g. SkillGemLightningArrow) -> pobGemIds.json
 * (key = gemId's last segment; grantedEffectId e.g. LightningArrowPlayer) ->
 * skills.json levels.v.levelRequirement. A wiki active gem with no PoB match is
 * listed and stays ungated.
 *
 * Re-run after PoB2 or the wiki data move: npm run sync:gem-level-requirements
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WIKI_DATA_VERSION } from '../src/lib/wiki/types';

const root = path.resolve(import.meta.dirname, '..');
const skillsDir = path.join(root, 'public/data/wiki', WIKI_DATA_VERSION, 'skills');
const gemIds = JSON.parse(readFileSync(path.join(root, 'src/lib/pob/export/pobGemIds.json'), 'utf8')) as Record<string, { grantedEffectId: string }>;
const pob = JSON.parse(readFileSync(path.join(root, 'src/lib/pob/data/skills.json'), 'utf8')) as Record<
  string,
  { levels?: { v?: { levelRequirement?: unknown } } }
>;

const arrays: number[][] = [];
const indexOf = new Map<string, number>();
const bySlug: Record<string, number> = {};
const unmatched: string[] = [];
let active = 0;

for (const file of readdirSync(skillsDir).sort()) {
  if (!file.endsWith('.json')) continue;
  const skill = JSON.parse(readFileSync(path.join(skillsDir, file), 'utf8')) as { slug?: string; gemId?: string; gemType?: string };
  if (skill.gemType !== 'active' || !skill.slug) continue;
  active++;
  const granted = skill.gemId ? gemIds[skill.gemId.split('/').pop()!]?.grantedEffectId : undefined;
  const req = granted ? pob[granted]?.levels?.v?.levelRequirement : undefined;
  if (!Array.isArray(req) || req.length === 0 || !req.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    unmatched.push(`${skill.slug} (${skill.gemId ?? 'no gemId'} -> ${granted ?? 'no PoB id'})`);
    continue;
  }
  const key = JSON.stringify(req);
  let idx = indexOf.get(key);
  if (idx === undefined) {
    idx = arrays.length;
    arrays.push(req as number[]);
    indexOf.set(key, idx);
  }
  bySlug[skill.slug] = idx;
}

const out = path.join(root, 'public/data/wiki', WIKI_DATA_VERSION, 'gem-level-requirements.json');
writeFileSync(out, JSON.stringify({ arrays, bySlug }));
console.log(`${Object.keys(bySlug).length}/${active} active gems covered, ${arrays.length} distinct arrays -> ${out}`);
if (unmatched.length > 0) console.log(`ungated (no PoB match):\n  ${unmatched.join('\n  ')}`);
