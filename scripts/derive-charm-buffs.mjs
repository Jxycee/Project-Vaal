// Charm base slug -> the buff lines PoB2 applies while the charm is active (Item.lua base.charm.buff), from the synced
// PoB2 bases (src/lib/pob/data/bases.json). Used by the stat collector: a Sapphire Charm in an active charm slot is
// "+25% to Cold Resistance" on the sheet (CalcPerform.lua mergeCharms). Only bases with a buff line are kept.
// Run after npm run sync:pob-bases: node scripts/derive-charm-buffs.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const bases = JSON.parse(readFileSync('src/lib/pob/data/bases.json', 'utf8'));
const out = {};
for (const [name, base] of Object.entries(bases)) {
  if (base.type !== 'Charm') continue;
  const lines = (base.charm?.buff ?? []).filter((l) => typeof l === 'string' && l.trim() !== '');
  if (lines.length > 0) out[name.toLowerCase().replace(/[^a-z0-9]+/g, '-')] = { name, lines };
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync('src/lib/pob/data/charm-buffs.json', JSON.stringify(sorted) + '\n');
console.log(Object.keys(sorted).length, 'charm bases with a buff');
