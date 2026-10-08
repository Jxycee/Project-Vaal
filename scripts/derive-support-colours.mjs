// Support gem name -> colour (r | g | b | w), from the synced wiki skill files (public/data/wiki/<v>/skills/*.json).
// Used by the stat collector for passives such as Gem Enthusiast ("5% increased maximum Life if you have at
// least 10 Red Support Gems Socketed"). Run: node scripts/derive-support-colours.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const version = '2026-08-25';
const dir = `public/data/wiki/${version}/skills`;
const colours = {};
for (const f of readdirSync(dir)) {
  const j = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  if (j.gemType === 'support' && typeof j.name === 'string' && typeof j.color === 'string') colours[j.name] = j.color;
}
const sorted = Object.fromEntries(Object.entries(colours).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync('src/lib/pob/data/support-colours.json', JSON.stringify(sorted) + '\n');
console.log(Object.keys(sorted).length, 'supports');
