/**
 * Writes src/lib/pob/export/pobGemIds.json: for each gem, the exact `gameId`,
 * `variantId` and `grantedEffectId` Path of Building 2 keys it by, from PoB2's
 * generated Data/Gems.lua (MIT). The export needs them: PoB2 looks a gem up by
 * its full metadata path, and the path is not always "Metadata/Items/Gems/<id>"
 * — a handful use "Metadata/Items/Gem/" — so it cannot be rebuilt from the
 * last segment our wiki data keeps.
 *
 * Keyed by that last segment (what src/lib/pob/catalogue.ts keys gems by).
 * Re-run after PoB2 or the game data moves: npm run sync:pob-gem-ids
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const URL = 'https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/dev/src/Data/Gems.lua';

const res = await fetch(URL);
if (!res.ok) throw new Error(`${URL} answered ${res.status}`);
const lua = await res.text();

const out: Record<string, { gameId: string; variantId: string; grantedEffectId: string }> = {};
// Each gem is a top-level `["Metadata/..."] = {` block; the three fields of
// interest are single-line `key = "value",` entries inside it.
for (const block of lua.split(/\n\t\["Metadata\/Items\//).slice(1)) {
  const gameId = /\n\t\tgameId = "([^"]+)"/.exec(block)?.[1];
  const variantId = /\n\t\tvariantId = "([^"]+)"/.exec(block)?.[1];
  const grantedEffectId = /\n\t\tgrantedEffectId = "([^"]+)"/.exec(block)?.[1];
  if (!gameId || !variantId || !grantedEffectId) continue;
  out[gameId.split('/').pop()!] = { gameId, variantId, grantedEffectId };
}

const file = path.join(process.cwd(), 'src', 'lib', 'pob', 'export', 'pobGemIds.json');
writeFileSync(file, JSON.stringify(out));
console.log(`${Object.keys(out).length} gems -> ${file}`);

// The attributes each ACTIVE skill gem requires, as letters (S, D, I): Virtuous Barrier's motes count a socketed skill
// gem by them (stats/skillBuffs.ts, PoB2 CalcSetup.lua). Support gems are left out; a name two gems share with
// different requirements is left out; a gem requiring none is left out.
//
// EXCEPTION (verified on armour-life-gemling: PoB counts 14 Strength motes, two socketed Battershouts account for the
// 4 beyond the active gems; ordinary-armour-1: Static Shocks takes Intelligence 13 -> 15): a SUPPORT gem that also
// grants a hidden triggered ACTIVE skill of the same name (Battershout, Static Shocks, Crater ...; PoB's group skill
// list holds that skill, so it is counted) keeps its requirements. Found from the synced skills.json.
const skillsFile = JSON.parse(readFileSync(path.join(process.cwd(), 'src', 'lib', 'pob', 'data', 'skills.json'), 'utf8')) as Record<string, { name: string; type: string }>;
const activeNames = new Set(Object.values(skillsFile).filter((s) => s.type === 'active').map((s) => s.name));
const attributes: Record<string, string> = {};
const clash = new Set<string>();
for (const block of lua.split(/\n\t\["Metadata\/Items\//).slice(1)) {
  const name = /\n\t\tname = "([^"]+)"/.exec(block)?.[1];
  if (!name) continue;
  if (/\n\t\t\tsupport = true/.test(block) && !activeNames.has(name)) continue;
  const req = (k: string) => Number(new RegExp(`\n\t\treq${k} = (\\d+)`).exec(block)?.[1] ?? 0);
  const letters = (req('Str') > 0 ? 'S' : '') + (req('Dex') > 0 ? 'D' : '') + (req('Int') > 0 ? 'I' : '');
  if (attributes[name] !== undefined && attributes[name] !== letters) clash.add(name);
  attributes[name] = letters;
}
for (const name of clash) delete attributes[name];
for (const [name, letters] of Object.entries(attributes)) if (letters === '') delete attributes[name];
const attrFile = path.join(process.cwd(), 'src', 'lib', 'pob', 'data', 'gem-attributes.json');
writeFileSync(attrFile, JSON.stringify(attributes));
console.log(`${Object.keys(attributes).length} active gems with attribute requirements -> ${attrFile}`);
