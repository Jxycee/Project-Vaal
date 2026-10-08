// src/lib/build/stats/buildConfig.ts
// =============================================================================
// The build's Path of Building "Configuration" settings that decide which conditional modifiers count.
//
// Path of Building 2 applies a modifier that carries a Condition tag ("40% increased Evasion Rating while moving",
// Condition:Moving) only when that condition is true, and a Multiplier tag (Wind Dancer's per-stack Evasion)
// scaled by the multiplier's value. Both come from the build's Configuration tab, saved in the PoB XML as
// <Config><ConfigSet><Input boolean="true" name="conditionMoving"/> ... </ConfigSet></Config>
// (src/Modules/ConfigOptions.lua, MIT, Copyright (c) 2016 David Gowor). The importer keeps the part that matters
// here as PassiveState.buildConfig; the collector counts a conditional modifier only when its flag is set.
//
// Naming, and what was verified. PoB names a boolean "condition<X>" and applies it as Condition:<X>; verified on
// ordinary-deadeye ("conditionMoving" is what makes "while moving" count: Evasion 8184 -> 13693). A count input
// becomes a Multiplier by an explicit table (NUMBER_INPUTS) because the var spelling is per option and only
// windDancerStacks -> WindDancerStacks is verified (same build, same number). Any other input is ignored.
//
// FAILURE MODES (decided before the code; covered end to end by __tests__/multiOracle.test.ts, whose fixtures
// carry real Configs, and by the importer's own tests):
//   1. Config flag absent (the box is not ticked, or PoB wrote nothing for it): the condition is FALSE, exactly
//      as PoB treats it. Conditional modifiers are not counted and, because the answer is known, not named.
//   2. Flag set but the modifier is not conditional: nothing to do, it counts as it always did.
//   3. Unknown condition name (a flag no modifier we model uses, or a modifier whose condition PoB derives itself
//      such as Low Life or "while you have Energy Shield"): set membership only, so an unused flag is inert and a
//      derived condition that is not ticked in the Config is not counted. Never guessed true.
//   4. Build exported without a Config (hand-built, scratch planner, a build saved before this field): there is
//      no answer, not a "false" one. `buildConfig` is then absent, and every conditional modifier is NAMED in the
//      sheet's notCounted as needing its condition. Never defaulted to on.
//   5. A boolean written boolean="false": same as absent. A count of 0 or a non-number: the multiplier is 0.
//   6. Stored data that is malformed (an old or hand-edited row): parseBuildConfig keeps only well-formed names
//      and finite non-negative counts; the whole value is dropped, not repaired, when it is not an object.
// =============================================================================

import gemAttributes from '@/lib/pob/data/gem-attributes.json';

/**
 * Virtuous Barrier's motes (PoB2 CalcSetup.lua virtuousMoteSkillCount): each attribute starts at 3 and every enabled
 * ACTIVE skill gem socketed in an enabled group (not one a passive or item grants) adds 2 to the one attribute it
 * requires, or 1 to each when it requires several. Counted from the whole PoB skill list at import (a loadout holds
 * one skill, so the second active of a group, which PoB counts, is not in our gem state); skillBuffs.ts falls back to
 * the loadouts for a build with no import. gem-attributes.json: letters S/D/I per active gem (Cast on Dodge: "DI").
 */
export const MOTE_VARS: Readonly<Record<string, 'S' | 'D' | 'I'>> = {
  StrengthMoteSkillCount: 'S',
  DexterityMoteSkillCount: 'D',
  IntelligenceMoteSkillCount: 'I',
};

export function moteCounts(skills: Iterable<string>): Record<string, number> {
  const count = { S: 3, D: 3, I: 3 };
  for (const name of skills) {
    const letters = (gemAttributes as Record<string, string>)[name] ?? '';
    for (const letter of letters) count[letter as 'S' | 'D' | 'I'] += letters.length === 1 ? 2 : 1;
  }
  return Object.fromEntries(Object.entries(MOTE_VARS).map(([variable, letter]) => [variable, count[letter]]));
}

export interface BuildConfig {
  /** PoB condition names that are true ("Moving", "BeenHitRecently"), sorted, no duplicates. */
  conditions: string[];
  /** PoB multiplier name -> its count ("WindDancerStacks": 3). */
  multipliers: Record<string, number>;
  /**
   * Fixed quest rewards the build UNTICKED in PoB's Configuration (<Input boolean="false" name="questAct 4Eye of HinekoraSilent Hall"/>).
   * Every fixed reward is a checkbox that defaults to ticked (ConfigOptions.lua addQuestModsRewardsConfigOptions, defaultState = true),
   * so only the unticked ones are written. Absent = none unticked.
   */
  questsOff?: string[];
}

/** Count inputs we turn into Multipliers: the config var -> the Multiplier name PoB's option applies. */
export const NUMBER_INPUTS: Readonly<Record<string, string>> = {
  windDancerStacks: 'WindDancerStacks',
};

/**
 * The "Use charges" switches: PoB's useEnduranceCharges / useFrenzyCharges / usePowerCharges put the character at its
 * maximum charges (ConfigOptions.lua), which is what a "StatThreshold" tag on a buff (Charge Regulation: 15-25% more
 * Armour, Evasion and Energy Shield with an Endurance Charge) reads. Kept as the condition "UseEnduranceCharges" etc.
 */
export const CHARGE_INPUTS: Readonly<Record<string, string>> = {
  useEnduranceCharges: 'UseEnduranceCharges',
  useFrenzyCharges: 'UseFrenzyCharges',
  usePowerCharges: 'UsePowerCharges',
};

const NAME = /^[A-Za-z][A-Za-z0-9]{0,63}$/;
const MAX_ENTRIES = 256;

/** What the parser reads of one <Input> in the active ConfigSet. */
export interface ConfigInput {
  name: string;
  /** boolean="true" | "false"; null when the input has no boolean attribute. */
  boolean: boolean | null;
  /** number="3"; null when the input has no (finite) number attribute. */
  number: number | null;
}

/** PoB config inputs -> the part of the Configuration that gates modifiers. */
export function buildConfigFromInputs(inputs: readonly ConfigInput[]): BuildConfig {
  const conditions = new Set<string>();
  const multipliers: Record<string, number> = {};
  const questsOff = new Set<string>();
  for (const input of inputs) {
    if (input.boolean === false && input.name.startsWith('quest')) questsOff.add(input.name);
    if (input.boolean === true && input.name.startsWith('condition') && NAME.test(input.name.slice('condition'.length))) {
      conditions.add(input.name.slice('condition'.length));
    }
    if (input.boolean === true && CHARGE_INPUTS[input.name] !== undefined) conditions.add(CHARGE_INPUTS[input.name]);
    const multiplier = NUMBER_INPUTS[input.name];
    if (multiplier !== undefined && input.number !== null && input.number > 0) multipliers[multiplier] = input.number;
  }
  return { conditions: [...conditions].sort(), multipliers, ...(questsOff.size > 0 ? { questsOff: [...questsOff].sort() } : {}) };
}

/** Defensive read of a stored value (failure mode 6). undefined = no usable config. */
export function parseBuildConfig(raw: unknown): BuildConfig | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const v = raw as Record<string, unknown>;
  const conditions = Array.isArray(v.conditions)
    ? [...new Set(v.conditions.filter((c): c is string => typeof c === 'string' && NAME.test(c)))].sort().slice(0, MAX_ENTRIES)
    : [];
  const multipliers: Record<string, number> = {};
  if (typeof v.multipliers === 'object' && v.multipliers !== null && !Array.isArray(v.multipliers)) {
    for (const [name, count] of Object.entries(v.multipliers as Record<string, unknown>).slice(0, MAX_ENTRIES)) {
      if (NAME.test(name) && typeof count === 'number' && Number.isFinite(count) && count > 0) multipliers[name] = count;
    }
  }
  const questsOff = Array.isArray(v.questsOff)
    ? [...new Set(v.questsOff.filter((q): q is string => typeof q === 'string' && q.startsWith('quest') && q.length <= 120))].sort().slice(0, MAX_ENTRIES)
    : [];
  return { conditions, multipliers, ...(questsOff.length > 0 ? { questsOff } : {}) };
}

/** Whether a condition (optionally negated: "if you haven't been Hit Recently") holds under this config. undefined config = unknown. */
export function conditionHolds(config: BuildConfig | undefined, name: string, negate = false): boolean | undefined {
  if (!config) return undefined;
  return config.conditions.includes(name) !== negate;
}
