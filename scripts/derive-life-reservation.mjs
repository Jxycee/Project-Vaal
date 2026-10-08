/**
 * Writes src/lib/pob/data/life-reservation.json from src/lib/pob/data/skills.json (offline; run
 * scripts/sync-pob-skills.ts first when PoB2 moves). skills.json is 1.6 MB and the defence sheet runs in the browser,
 * so this keeps only what the Low Life derivation needs (stats/reservation.ts):
 *   - `spirit`: each skill's Spirit reservation (PoB levels.spiritReservationFlat: one number, or one per gem level),
 *   - `perSpirit`: each support that turns Spirit reservation into Life reservation ("skill_reserves_X_life_permyriad_
 *     per_spirit_instead_of_spirit", Atziri's Communion), as the percent of Life reserved per Spirit point. PoB2's
 *     statMap divides the stat by 100 (skill-stat-map.json: {"div":100} -> LifeReservePercentPerSpirit), so 66 -> 0.66.
 *
 * Failure modes, decided first:
 *   1. A display name two skills share: dropped from both tables (the reader refuses an ambiguous name, as skillBuffs does).
 *   2. A support whose stat is not in the stat map, or has no divisor: not kept (no guessed scale).
 *   3. A skill with no Spirit reservation (most gems): absent, which the reader treats as reserving nothing.
 * Run: node scripts/derive-life-reservation.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const STAT = 'skill_reserves_X_life_permyriad_per_spirit_instead_of_spirit';
const skills = JSON.parse(readFileSync('src/lib/pob/data/skills.json', 'utf8'));
const statMap = JSON.parse(readFileSync('src/lib/pob/data/skill-stat-map.json', 'utf8'));
const mapped = statMap[STAT];
const divisor = mapped && typeof mapped.div === 'number' && mapped.div > 0 ? mapped.div : null;

const spirit = {};
const perSpirit = {};
const poisoned = new Set();
const seen = new Set();
for (const skill of Object.values(skills)) {
  if (seen.has(skill.name)) poisoned.add(skill.name);
  seen.add(skill.name);
}
for (const skill of Object.values(skills)) {
  if (poisoned.has(skill.name)) continue;
  const levels = skill.levels ?? {};
  const flat = levels.v?.spiritReservationFlat ?? levels.c?.spiritReservationFlat;
  if (skill.type === 'active' && flat !== undefined) spirit[skill.name] = flat;
  if (skill.type === 'support' && divisor !== null) {
    for (const set of skill.statSets ?? []) {
      const permyriad = set.constantStats?.[STAT];
      if (typeof permyriad === 'number') perSpirit[skill.name] = permyriad / divisor;
    }
  }
}
writeFileSync('src/lib/pob/data/life-reservation.json', JSON.stringify({ spirit, perSpirit }));
console.log(`life-reservation.json: ${Object.keys(spirit).length} skills with Spirit reservation, supports: ${JSON.stringify(perSpirit)}`);
