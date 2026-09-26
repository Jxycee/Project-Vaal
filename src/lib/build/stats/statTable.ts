// src/lib/build/stats/statTable.ts
// =============================================================================
// Which stat ids the defence engine counts, and into what. Hand-written, and
// every entry is checked against real data in __tests__/statTable.test.ts:
// the id exists in our tree or mod files, and the display text of something
// carrying it names the pool it is mapped to.
//
// Stat ids are GGG's `Stats.Id` — the vocabulary of our mod files and of
// public/data/tree/<v>/node-stats.json (Slice 5). Note that items and the tree
// spell the same effect differently in places (`additional_strength` on an
// item, `base_strength` on the tree); both are listed.
//
// LOCAL stats apply to the item that carries them — verified 2026-09-25 that
// every defence stat an armour piece can roll is `local_*`, while the global
// flat ids (`base_physical_damage_reduction_rating`, `base_evasion_rating`,
// `base_maximum_energy_shield`) spawn only on belts, rings and amulets.
// =============================================================================

export type Pool =
  | 'life'
  | 'mana'
  | 'energyShield'
  | 'armour'
  | 'evasion'
  | 'str'
  | 'dex'
  | 'int'
  | 'fireRes'
  | 'coldRes'
  | 'lightningRes'
  | 'chaosRes'
  | 'fireMax'
  | 'coldMax'
  | 'lightningMax'
  | 'chaosMax'
  | 'spirit';

/** `flat` adds to the pool's base; `increased` adds percent to its "increased" sum. */
export interface Effect {
  pool: Pool;
  kind: 'flat' | 'increased';
}

const flat = (...pools: Pool[]): Effect[] => pools.map((pool) => ({ pool, kind: 'flat' }));
const inc = (...pools: Pool[]): Effect[] => pools.map((pool) => ({ pool, kind: 'increased' }));

export const GLOBAL_EFFECTS: Readonly<Record<string, Effect[]>> = {
  base_maximum_life: flat('life'),
  'maximum_life_+%': inc('life'),
  base_maximum_mana: flat('mana'),
  'maximum_mana_+%': inc('mana'),
  base_maximum_energy_shield: flat('energyShield'),
  'maximum_energy_shield_+%': inc('energyShield'),
  base_physical_damage_reduction_rating: flat('armour'),
  'physical_damage_reduction_rating_+%': inc('armour'),
  base_evasion_rating: flat('evasion'),
  'evasion_rating_+%': inc('evasion'),
  'global_armour_evasion_energy_shield_+%': inc('armour', 'evasion', 'energyShield'),
  'evasion_and_physical_damage_reduction_rating_+%': inc('armour', 'evasion'),

  base_strength: flat('str'),
  base_dexterity: flat('dex'),
  base_intelligence: flat('int'),
  additional_strength: flat('str'),
  additional_dexterity: flat('dex'),
  additional_intelligence: flat('int'),
  additional_all_attributes: flat('str', 'dex', 'int'),
  base_strength_and_dexterity: flat('str', 'dex'),
  base_strength_and_intelligence: flat('str', 'int'),
  additional_strength_and_dexterity: flat('str', 'dex'),
  additional_strength_and_intelligence: flat('str', 'int'),
  additional_dexterity_and_intelligence: flat('dex', 'int'),
  'strength_+%': inc('str'),
  'dexterity_+%': inc('dex'),
  'intelligence_+%': inc('int'),
  'all_attributes_+%': inc('str', 'dex', 'int'),

  'base_fire_damage_resistance_%': flat('fireRes'),
  'base_cold_damage_resistance_%': flat('coldRes'),
  'base_lightning_damage_resistance_%': flat('lightningRes'),
  'base_chaos_damage_resistance_%': flat('chaosRes'),
  'base_resist_all_elements_%': flat('fireRes', 'coldRes', 'lightningRes'),
  'fire_and_cold_damage_resistance_%': flat('fireRes', 'coldRes'),
  'fire_and_lightning_damage_resistance_%': flat('fireRes', 'lightningRes'),
  'cold_and_lightning_damage_resistance_%': flat('coldRes', 'lightningRes'),
  'fire_and_chaos_damage_resistance_%': flat('fireRes', 'chaosRes'),
  'cold_and_chaos_damage_resistance_%': flat('coldRes', 'chaosRes'),
  'lightning_and_chaos_damage_resistance_%': flat('lightningRes', 'chaosRes'),
  'base_maximum_fire_damage_resistance_%': flat('fireMax'),
  'base_maximum_cold_damage_resistance_%': flat('coldMax'),
  'base_maximum_lightning_damage_resistance_%': flat('lightningMax'),
  'base_maximum_chaos_damage_resistance_%': flat('chaosMax'),
  'additional_maximum_all_elemental_resistances_%': flat('fireMax', 'coldMax', 'lightningMax'),
  'additional_maximum_all_resistances_%': flat('fireMax', 'coldMax', 'lightningMax', 'chaosMax'),

  base_spirit: flat('spirit'),
  base_spirit_from_equipment: flat('spirit'),
  'spirit_+%': inc('spirit'),
};

/** Applied to the carrying item's own base defences / spirit, before quality. */
export const LOCAL_EFFECTS: Readonly<Record<string, Effect[]>> = {
  local_base_physical_damage_reduction_rating: flat('armour'),
  local_base_evasion_rating: flat('evasion'),
  local_energy_shield: flat('energyShield'),
  'local_physical_damage_reduction_rating_+%': inc('armour'),
  'local_evasion_rating_+%': inc('evasion'),
  'local_energy_shield_+%': inc('energyShield'),
  'local_armour_and_evasion_+%': inc('armour', 'evasion'),
  'local_armour_and_energy_shield_+%': inc('armour', 'energyShield'),
  'local_evasion_and_energy_shield_+%': inc('evasion', 'energyShield'),
  'local_armour_and_evasion_and_energy_shield_+%': inc('armour', 'evasion', 'energyShield'),
  'local_spirit_+%': inc('spirit'),
};

/**
 * Stats that change a defence this engine reports but that it does NOT
 * model yet. Any allocated or equipped source carrying one is listed on the
 * stat sheet by name, so a number is never silently missing a contribution.
 */
export const NOT_MODELLED: Readonly<Record<string, string>> = {
  '+1_spirit_per_X_evasion_rating_on_body_armour': 'Spirit from body armour Evasion',
  '+1_spirit_per_X_energy_shield_on_body_armour': 'Spirit from body armour Energy Shield',
  'spirit_+_per_empty_charm_slot': 'Spirit per empty charm slot',
  'body_armour_grants_spirit_+%': 'increased Spirit from body armour',
  'ascendancy_beidats_will_spirit_+_per_X_maximum_life': 'Spirit per maximum Life',
  'body_armour_+%': 'increased Armour from body armour',
  'body_armour_evasion_rating_+%': 'increased Evasion from body armour',
  'energy_shield_from_focus_+%': 'increased Energy Shield from a Focus',
  base_physical_damage_reduction_rating_no_display: 'hidden Armour',
  'maximum_fire_resistance_+%_if_at_least_5_red_supports_socketed': 'Maximum Fire Resistance with 5 red supports socketed',
};
