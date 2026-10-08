// src/lib/build/stats/skillBuffs.ts
// =============================================================================
// Skill-granted buffs: the defence numbers a socketed Aura or Buff skill puts on the character.
//
// Path of Building 2 applies a skill's GlobalEffect modifiers to the player while the skill is enabled
// (Purity of Ice: "+43% to Cold Resistance" at gem level 18 with 11% increased Aura magnitudes). Its numbers are
// in PoB2's skill definitions (src/Data/Skills/*.lua, MIT, Copyright (c) 2016 David Gowor), reduced to the part
// the sheet can use in data/skill-buffs.json (scripts/derive-skill-buffs.mjs, from the synced skills.json).
//
// How an Aura's number is built (verified on the acolyte oracle: Purity of Ice L18 = 39, x 1.11 = 43.29,
// PoB's breakdown shows 43): the level's table value x (1 + the sum of "increased Aura magnitudes" / 100).
// PoB scales a buff modifier by floor(value x scale x 100) / 100 (ModStore ScaleAddMod); that is followed here.
//
// FAILURE MODES (decided before the code; covered end to end by the oracles in __tests__/multiOracle.test.ts):
//   1. No skills given (an old caller, a build with no gems): nothing is added and nothing is claimed.
//   2. A loadout not active in this weapon set: its buffs are not on the character; skipped silently.
//   3. A skill name our data does not know, or one that two skills share: skipped, never matched by a guess.
//      A skill with no sheet-relevant buff at all is the normal case (most gems) and is not named.
//   4. A modifier that needs a condition, a stack count or a charge threshold (Wind Dancer's stacks, Charge
//      Regulation's Endurance Charges, a Banner that must be planted): PoB reads those from its Configuration
//      tab, which a build does not carry here. Never defaulted to a maximum: named in notCounted.
//   5. A modifier on someone else (a curse on enemies, a minion buff): only Aura and Buff effects are the
//      character's own; others are skipped.
//   6. A gem level outside the skill's table: named, not clamped to a number PoB would not use.
//   7. The same skill socketed twice: PoB applies one buff of a given name; the first loadout wins.
//   8. "+N to Level of all skills" from gear is not modelled: the table is read at the gem's own level, which
//      is exactly right only when no such modifier is worn. (An assumption, listed in `assumed` when it applies.)
// =============================================================================

import buffs from '@/lib/pob/data/skill-buffs.json';
import type { GemState } from '../gemState';
import { POOLS as MODIFIER_POOLS } from './lineMods';
import type { Contribution } from './engine';

interface BuffEffect {
  mod: string;
  type: string;
  stat: string;
  effect: string;
  value?: number;
  values?: number[];
  needs?: string[];
}
type BuffSkill = { name: string; effects: BuffEffect[] };

const KINDS: Record<string, Contribution['kind']> = { BASE: 'flat', INC: 'increased', MORE: 'more' };

let byName: Map<string, BuffSkill | null> | undefined;
function lookup(name: string): BuffSkill | null | undefined {
  if (!byName) {
    byName = new Map();
    for (const skill of Object.values(buffs as Record<string, BuffSkill>)) {
      // A name two skills share is poisoned (failure mode 3).
      byName.set(skill.name, byName.has(skill.name) ? null : skill);
    }
  }
  return byName.get(name);
}

/** PoB's ScaleAddMod rounding for a scaled buff modifier. */
const scale = (value: number, factor: number): number => Math.floor(value * factor * 100) / 100;

export function skillBuffContributions(
  gems: GemState | undefined,
  set: 1 | 2,
  /** The summed "increased Aura magnitudes" percent from the tree and gear. */
  auraEffectPercent: number,
): { contributions: Contribution[]; notCounted: string[]; counted: string[] } {
  const contributions: Contribution[] = [];
  const notCounted: string[] = [];
  const counted: string[] = [];
  const seen = new Set<string>();
  for (const loadout of gems?.loadouts ?? []) {
    const gem = loadout.skill;
    if (!gem || !loadout.sets.includes(set)) continue;
    const skill = lookup(gem.name);
    if (!skill || seen.has(skill.name)) continue;
    seen.add(skill.name);
    let used = false;
    for (const e of skill.effects) {
      if (e.effect !== 'Aura' && e.effect !== 'Buff') continue;
      const pools = MODIFIER_POOLS[e.mod];
      const kind = KINDS[e.type];
      if (!pools || !kind) continue;
      if (e.needs && e.needs.length > 0) {
        notCounted.push(`${skill.name}: ${e.mod} ${e.type.toLowerCase()} needs ${e.needs.join(', ')} (a Path of Building configuration setting), so it was not counted`);
        continue;
      }
      let value = e.value;
      if (value === undefined && e.values) {
        value = e.values[loadout.level - 1];
        if (value === undefined) {
          notCounted.push(`${skill.name}: level ${loadout.level} is outside its table, so its ${e.mod} was not counted`);
          continue;
        }
      }
      if (value === undefined) continue;
      if (e.effect === 'Aura' && auraEffectPercent !== 0) value = scale(value, 1 + auraEffectPercent / 100);
      for (const pool of pools) contributions.push({ pool, kind, value, source: skill.name });
      used = true;
    }
    if (used) counted.push(skill.name);
  }
  return { contributions, notCounted, counted };
}
