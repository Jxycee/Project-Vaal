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

const SHEET_NAMES = /^(Life|Mana|EnergyShield|EnergyShieldTotal|Armour|Evasion|Spirit|Str|Dex|Int|AllAttributes|(Fire|Cold|Lightning|Chaos|Elemental)Resist(Max)?|MaxResist)$/;
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
        // Condition and Multiplier tags the reader can apply from the build's Configuration are kept structured
        // (`condition`, `multiplier`); every other tag stays text in `needs`, as before.
        const needs = [];
        const entry = { mod: name, type, stat, effect: global.effectType };
        for (const t of tags.filter((x) => x !== global)) {
          if (t && t.type === 'Condition' && typeof t.var === 'string' && !t.varList && entry.condition === undefined && Object.keys(t).every((k) => ['type', 'var', 'neg'].includes(k))) {
            entry.condition = t.neg ? '!' + t.var : t.var;
          } else if (t && t.type === 'Multiplier' && typeof t.var === 'string' && entry.multiplier === undefined && Object.keys(t).every((k) => ['type', 'var', 'limitVar'].includes(k))) {
            const m = { var: t.var };
            if (t.limitVar !== undefined) {
              // The cap is another statMap line of the same set that adds Multiplier:<limitVar>, from a constant stat.
              const limitStat = Object.entries(set.statMap ?? {}).find(([, cs]) => cs.some((x) => x.call === 'mod' && x.args?.[0] === 'Multiplier:' + t.limitVar && x.args?.[1] === 'BASE'));
              const limit = limitStat ? set.constantStats?.[limitStat[0]] : undefined;
              if (typeof limit === 'number') m.limit = limit;
              else {
                needs.push('Multiplier:' + t.var + ':' + t.limitVar);
                continue;
              }
            }
            entry.multiplier = m;
          } else needs.push(t && typeof t === 'object' ? [t.type, t.var, t.stat, t.threshold].filter((x) => x !== undefined).join(':') : String(t));
        }
        if (typeof fixed === 'number') entry.value = fixed;
        else {
          const at = (set.stats ?? []).indexOf(stat);
          const column = at >= 0 ? set.levels?.v?.['v.' + at] : undefined;
          if (Array.isArray(column)) entry.values = column;
          else if (at >= 0 && typeof set.levels?.c?.['v.' + at] === 'number') entry.value = set.levels.c['v.' + at]; // a level column that is the same at every level (Defiance Banner: 30)
          else if (typeof set.constantStats?.[stat] === 'number') entry.value = set.constantStats[stat];
          else needs.push('no-level-data');
        }
        if (needs.length > 0) entry.needs = needs;
        effects.push(entry);
      }
    }
  }
  if (effects.length > 0) out[id] = { name: skill.name, ...((skill.skillTypes ?? []).includes('Banner') ? { banner: true } : {}), effects };
}

writeFileSync('src/lib/pob/data/skill-buffs.json', JSON.stringify(out));
console.log(Object.keys(out).length + ' skills with sheet-relevant buff modifiers -> skill-buffs.json');

// Support gems that raise the supported skill's gem level by a count of the supports in its group (Uhtred's Exodus:
// +3 with no other support). PoB's statMap puts a SupportedGemProperty "level" LIST mod behind a MultiplierThreshold on
// SupportCount (the group's whole support count, the gem itself included, `equals`). Others (an element Mastery's
// "+1 to fire skills", Dialla's Desire, which has no statMap) are not kept: they need the skill's tags, or PoB ignores them.
const levels = {};
for (const skill of Object.values(skills)) {
  if (skill.type !== 'support') continue;
  for (const set of skill.statSets ?? []) {
    for (const [stat, calls] of Object.entries(set.statMap ?? {})) {
      for (const c of Array.isArray(calls) ? calls : []) {
        const [name, type, fixed, , , tag] = c.args ?? [];
        if (c.call !== 'mod' || name !== 'SupportedGemProperty' || type !== 'LIST' || fixed?.key !== 'level' || fixed?.keyword !== 'grants_active_skill') continue;
        if (tag?.type !== 'MultiplierThreshold' || tag.var !== 'SupportCount' || tag.equals !== true || typeof tag.threshold !== 'number') continue;
        const bonus = set.constantStats?.[stat];
        if (typeof bonus === 'number') levels[skill.name] = { supportCount: tag.threshold, bonus };
      }
    }
  }
}
writeFileSync('src/lib/pob/data/support-levels.json', JSON.stringify(levels));
console.log(Object.keys(levels).length + ' level-granting supports -> support-levels.json');

// Totem skills (skillTypes SummonsTotem, PoB's skillFlags.totem) and what PoB reads off the MAIN skill to get the number
// of totems (CalcPerform.lua:1299, ActiveTotemLimit): the totem skill's own constant stat base_number_of_totems_allowed
// (`limit`; a totem skill without it, Ancestral Warrior Totem's non_modifiable_totem_limit, is kept with 0), whether the
// skill's totems are ballistae (`ballista`: "Attack Skills have +1 Ballista Totems" needs TotemsAreBallistae) and which
// skills are melee attacks (`meleeAttack`: "Melee Attack Skills have +1 to maximum Summoned Totems"). stats/totems.ts adds
// the passives' share to these.
const totems = { limit: {}, ballista: [], meleeAttack: [] };
for (const skill of Object.values(skills)) {
  if (skill.type !== 'active') continue;
  const types = skill.skillTypes ?? [];
  if (types.includes('Attack') && types.includes('Melee')) totems.meleeAttack.push(skill.name);
  if (!types.includes('SummonsTotem')) continue;
  const limit = (skill.statSets ?? []).map((set) => set.constantStats?.base_number_of_totems_allowed).find((n) => typeof n === 'number') ?? 0;
  totems.limit[skill.name] = Math.max(totems.limit[skill.name] ?? 0, limit);
  if (types.includes('TotemsAreBallistae')) totems.ballista.push(skill.name);
}
writeFileSync('src/lib/pob/data/skill-totems.json', JSON.stringify(totems));
console.log(Object.keys(totems.limit).length + ' totem skills -> skill-totems.json');

// Shapeshift skills (skillTypes Bear, Wolf, Wyvern). PoB2 gives the character a form's bonus while its MAIN skill has
// the form's type (CalcPerform.lua:398-416, in combat mode, which the poe.ninja simulation always is): Bear Form =
// +10 + 10 x character level Armour, Wolf Form = 30% increased Movement Speed, Wyvern Form = 50% increased Energy
// Shield recharge rate. A name that a skill of another kind (or another form) also uses is dropped, never guessed.
const forms = { Bear: [], Wolf: [], Wyvern: [] };
const nameForms = new Map();
for (const skill of Object.values(skills)) {
  if (skill.type !== 'active') continue;
  const types = skill.skillTypes ?? [];
  const mine = ['Bear', 'Wolf', 'Wyvern'].filter((f) => types.includes(f));
  const key = mine.join('+') || 'none';
  nameForms.set(skill.name, nameForms.has(skill.name) && nameForms.get(skill.name) !== key ? 'ambiguous' : key);
}
for (const [name, key] of nameForms) if (forms[key]) forms[key].push(name);
writeFileSync('src/lib/pob/data/skill-shapeshift.json', JSON.stringify(forms));
console.log(Object.entries(forms).map(([f, n]) => f + ' ' + n.length).join(', ') + ' -> skill-shapeshift.json');
