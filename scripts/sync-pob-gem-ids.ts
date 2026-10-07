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
import { writeFileSync } from 'node:fs';
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
