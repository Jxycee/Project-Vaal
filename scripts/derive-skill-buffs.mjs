/**
 * Writes src/lib/pob/data/skill-buffs.json from src/lib/pob/data/skills.json (offline; run
 * scripts/sync-pob-skills.ts first when PoB2 moves). skills.json is 1.6 MB and the defence sheet runs in the
 * browser, so this keeps only what the sheet can use: for each skill, the statMap modifiers that
 *   - carry a GlobalEffect tag (a buff or aura the skill puts on the character), and
 *   - name a pool the sheet reports (life, mana, ES, armour, evasion, attributes, resistances, spirit).
 * Each carries its per-level numbers, and any OTHER tag (Condition, Multiplier, StatThreshold ...) as text in
 * `needs`, so the reader can name what it did not count instead of dropping it.
 *
 * Failure modes, decided first:
 *   1. A skill id seen twice by display name: both are kept under their ids; the reader refuses an ambiguous name.
 *   2. A stat the skill's level table does not hold (neither positional values nor constantStats): the entry is
 *      kept with `values` absent and a `needs` note, never a guessed number.
 *   3. A statMap call that is not a plain `mod` (flag, skill, or a call carrying extra keys such as a divisor):
 *      not kept; those never add a flat sheet number.
 * Run: node scripts/derive-skill-buffs.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SHEET_NAMES = /^(Life|Mana|EnergyShield|Armour|Evasion|Spirit|Str|Dex|Int|AllAttributes|(Fire|Cold|Lightning|Chaos|Elemental)Resist(Max)?|MaxResist)$/;
const skills = JSON.parse(readFileSync('src/lib/pob/data/skills.json', 'utf8'));
const out = {};

for (const [id, skill] of Object.entries(skills)) {
  if (skill.type !== 'active') continue;
  const effects = [];
  for (const set of skill.statSets ?? []) {
    for (const [stat, calls] of Object.entries(set.statMap ?? {})) {
      if (!Array.isArray(calls)) continue;
      for (const c of calls) {
        if (c.call !== 'mod' || Object.keys(c).some((k) => k !== 'call' && k !== 'args')) continue;
        const [name, type, fixed, , , ...tags] = c.args ?? [];
        if (typeof name !== 'string' || !SHEET_NAMES.test(name)) continue;
        const global = tags.find((t) => t && t.type === 'GlobalEffect');
        if (!global) continue;
        const needs = tags
          .filter((t) => t !== global)
          .map((t) => (t && typeof t === 'object' ? [t.type, t.var, t.stat, t.threshold].filter((x) => x !== undefined).join(':') : String(t)));
        const entry = { mod: name, type, stat, effect: global.effectType };
        if (typeof fixed === 'number') entry.value = fixed;
        else {
          const at = (set.stats ?? []).indexOf(stat);
          const column = at >= 0 ? set.levels?.v?.['v.' + at] : undefined;
          if (Array.isArray(column)) entry.values = column;
          else if (typeof set.constantStats?.[stat] === 'number') entry.value = set.constantStats[stat];
          else needs.push('no-level-data');
        }
        if (needs.length > 0) entry.needs = needs;
        effects.push(entry);
      }
    }
  }
  if (effects.length > 0) out[id] = { name: skill.name, effects };
}

writeFileSync('src/lib/pob/data/skill-buffs.json', JSON.stringify(out));
console.log(Object.keys(out).length + ' skills with sheet-relevant buff modifiers -> skill-buffs.json');
