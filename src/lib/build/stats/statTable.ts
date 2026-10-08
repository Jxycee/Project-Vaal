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

import type { GearSlot } from '../gearSlots';

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
  | 'spirit'
  // Percent increased magnitudes of Aura skills: not a sheet number, it scales skill-granted buffs (skillBuffs.ts).
  | 'auraEffect'
  // The derived defence stats (engine.ts; DERIVED in multiOracle.test.ts). They are PoB's own modifier names in
  // lower camel case: a pool's `flat` is its BASE, `increased` its INC, `more` its MORE.
  | 'maxEndurance'
  | 'maxFrenzy'
  | 'maxPower'
  | 'movementSpeed'
  | 'esRecharge'
  | 'esRechargeFaster'
  | 'lifeRegen'
  | 'lifeRegenPercent'
  | 'deflection'
  | 'evasionToDeflection'
  | 'armourToDeflection'
  | 'blindEffect'
  | 'physReduction'
  | 'armourToPhysical'
  | 'armourToFire'
  | 'armourToCold'
  | 'armourToLightning'
  | 'armourToChaos'
  | 'ward';

/**
 * `flat` adds to the pool's base; `increased` adds percent to its "increased"
 * sum; `more` is one multiplier (a "less" is a negative one). A `slot` limits
 * an increase to the defence of the item worn there (PoB2 SlotName tag).
 */
export interface Effect {
  pool: Pool;
  kind: 'flat' | 'increased' | 'more';
  slot?: GearSlot;
  /** The stat id's number times this is the pool's number (regeneration is stored per minute, shown per second). */
  scale?: number;
}

const flat = (...pools: Pool[]): Effect[] => pools.map((pool) => ({ pool, kind: 'flat' }));
const inc = (...pools: Pool[]): Effect[] => pools.map((pool) => ({ pool, kind: 'increased' }));
const more = (...pools: Pool[]): Effect[] => pools.map((pool) => ({ pool, kind: 'more' }));
const perMinute = (pool: Pool, kind: Effect['kind']): Effect[] => [{ pool, kind, scale: 1 / 60 }];
const incFromSlot = (slot: GearSlot, ...pools: Pool[]): Effect[] => pools.map((pool) => ({ pool, kind: 'increased', slot }));

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
  // "N% increased maximum Life, Mana and Energy Shield" - PoB2 ModParser.lua:5339.
  'maximum_life_mana_and_energy_shield_+%': inc('life', 'mana', 'energyShield'),
  // "N% increased Energy Shield from Equipped Body Armour / Helmet": PoB2's
  // SlotName tag (ModParser.lua:1191, 1197) - it scales only that slot's item,
  // on top of the global increase (CalcDefence.lua:1445-1453).
  'maximum_energy_shield_from_body_armour_+%': incFromSlot('body', 'energyShield'),
  'energy_shield_from_helmet_+%': incFromSlot('head', 'energyShield'),
  // "N% increased Evasion Rating from Equipped Body Armour" (Beastial Skin, 100): the same SlotName tag. Found on
  // ordinary-deadeye, where it is the 1472 Evasion PoB's total holds beyond base x increased x more.
  'body_armour_evasion_rating_+%': incFromSlot('body', 'evasion'),
  // "N% increased Energy Shield from Focus" - PoB2's SlotName tag on the off-hand slot. A focus sits in the off
  // hand of whichever weapon set is worn; only that set's item carries flats, so both slots are listed.
  'energy_shield_from_focus_+%': [...incFromSlot('weapon1_off', 'energyShield'), ...incFromSlot('weapon2_off', 'energyShield')],
  // "final" stats are "more"/"less" multipliers (ModParser.lua:67-69), applied
  // after increased (CalcDefence.lua:91, 96). Oracle's Harmony Within is -15
  // ("15% less maximum Life / Mana"); Titan's Mysterious Lineage is +15.
  'oracle_maximum_life_+%_final': more('life'),
  'oracle_maximum_mana_+%_final': more('mana'),
  'titan_maximum_life_+%_final': more('life'),

  base_strength: flat('str'),
  base_dexterity: flat('dex'),
  base_intelligence: flat('int'),
  additional_strength: flat('str'),
  additional_dexterity: flat('dex'),
  additional_intelligence: flat('int'),
  additional_all_attributes: flat('str', 'dex', 'int'),
  // "+N to all Attributes" / "+N to Dexterity and Intelligence": PoB2 ModParser.lua:170, 168.
  base_all_attributes: flat('str', 'dex', 'int'),
  base_dexterity_and_intelligence: flat('dex', 'int'),
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

  // ---- Derived defence stats (engine.ts). Each id is checked against the tree/mod text by statTable.test.ts.
  // "+N to Maximum Endurance / Frenzy / Power Charges": PoB2 EnduranceChargesMax etc. (modcache.json), CalcPerform.lua:869-887.
  max_endurance_charges: flat('maxEndurance'),
  max_frenzy_charges: flat('maxFrenzy'),
  max_power_charges: flat('maxPower'),
  // "N% increased Movement Speed": MovementSpeed INC, CalcDefence.lua:1926.
  'base_movement_velocity_+%': inc('movementSpeed'),
  // "N% increased Energy Shield Recharge Rate" and "N% faster start of Energy Shield Recharge": CalcDefence.lua:1796, 1837-1838.
  'energy_shield_recharge_rate_+%': inc('esRecharge'),
  'energy_shield_delay_-%': inc('esRechargeFaster'),
  // Life regeneration is stored per minute and shown per second: "Regenerate 0.2% of maximum Life per second" is 12,
  // "1 Life Regeneration per second" is 60 (mod files and the tree both).
  'life_regeneration_rate_per_minute_%': perMinute('lifeRegenPercent', 'flat'),
  base_life_regeneration_rate_per_minute: perMinute('lifeRegen', 'flat'),
  'life_regeneration_rate_+%': inc('lifeRegen'),
  // "Gain Deflection Rating equal to N% of Evasion Rating / Armour", "N% increased Deflection Rating": CalcDefence.lua:1565.
  'base_deflection_rating_%_of_evasion_rating': flat('evasionToDeflection'),
  'base_deflection_rating_%_of_armour': flat('armourToDeflection'),
  'deflection_rating_+%': inc('deflection'),
  // "+N to maximum Runic Ward" / "N% increased maximum Runic Ward": CalcDefence.lua:1306-1311.
  base_maximum_ward: flat('ward'),
  'maximum_ward_+%': inc('ward'),
  // "N% increased Blind Effect": scales the enemy's -20% Accuracy, CalcPerform.lua:744-753.
  'blind_effect_+%': inc('blindEffect'),
  // "N% additional Physical Damage Reduction": PhysicalDamageReduction BASE, CalcDefence.lua:1914.
  'base_additional_physical_damage_reduction_%': flat('physReduction'),
  // "+N% of Armour also applies to Fire / Cold / Lightning / Chaos / Elemental Damage": ArmourAppliesTo<Type>DamageTaken.
  'armour_%_applies_to_fire_cold_lightning_damage': flat('armourToFire', 'armourToCold', 'armourToLightning'),
  'base_armour_%_applies_to_fire_damage': flat('armourToFire'),
  'base_armour_%_applies_to_cold_damage': flat('armourToCold'),
  'base_armour_%_applies_to_lightning_damage': flat('armourToLightning'),
  'base_armour_%_applies_to_chaos_damage': flat('armourToChaos'),

  // "Aura Skills have N% increased Magnitudes": scales the Auras' own modifiers (skillBuffs.ts), PoB2 AuraEffect.
  'aura_effect_+%': inc('auraEffect'),
};

/**
 * Tree stats that count only while a PoB condition is true (Condition:<name>, set in the build's Configuration,
 * buildConfig.ts). `negate` = counts while it is NOT true ("if you haven't been Hit Recently"). The names are
 * PoB's: "Moving" is what conditionMoving sets, confirmed on ordinary-deadeye; the rest follow the same
 * "condition<Name>" rule and the cached text of the same lines in modcache.json (Bleeding, Ignited, Stationary,
 * BeenHitRecently). A stat id left out is not counted and is not named (it looks like noise to
 * looksLikeDefenceStat, as it did before). statTable.test.ts checks each id exists and names its pool.
 */
export interface ConditionalEffect {
  condition: string;
  negate?: boolean;
  effects: Effect[];
}
export const CONDITIONAL_EFFECTS: Readonly<Record<string, ConditionalEffect>> = {
  'evasion_rating_+%_while_moving': { condition: 'Moving', effects: inc('evasion') },
  'armour_+%_while_stationary': { condition: 'Stationary', effects: inc('armour') },
  'armour_+%_while_bleeding': { condition: 'Bleeding', effects: inc('armour') },
  'armour_+%_while_ignited': { condition: 'Ignited', effects: inc('armour') },
  'base_maximum_fire_damage_resistance_%_while_ignited': { condition: 'Ignited', effects: flat('fireMax') },
  'armour_+%_if_have_been_hit_recently': { condition: 'BeenHitRecently', effects: inc('armour') },
  'armour_+%_if_you_havent_been_hit_recently': { condition: 'BeenHitRecently', negate: true, effects: inc('armour') },
  'evasion_+%_if_hit_recently': { condition: 'BeenHitRecently', effects: inc('evasion') },
  'evasion_rating_+%_if_have_not_been_hit_recently': { condition: 'BeenHitRecently', negate: true, effects: inc('evasion') },
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
 * Passives that scale off ANOTHER item's own defence: "+1 to Evasion Rating per 1 Item Energy Shield on
 * Equipped Helmet" (PoB2 PerStat tag, modcache.json: div = the per-step size, amount = the value; the
 * stat is floor(item defence / div) steps, ModStore.lua). `valueIs` says which of the two the node's
 * number is: the fixed one is `fixed`. The item defence is the item's final own figure (local mods and
 * quality included), which the collector holds once every item is read.
 */
export interface PerItemDefence {
  pool: Pool;
  slot: GearSlot;
  from: 'armour' | 'evasion' | 'energyShield';
  valueIs: 'amount' | 'div';
  fixed: number;
}
export const PER_ITEM_DEFENCE: Readonly<Record<string, PerItemDefence>> = {
  'maximum_energy_shield_+1_per_x_body_armour_evasion_rating': { pool: 'energyShield', slot: 'body', from: 'evasion', valueIs: 'div', fixed: 1 },
  'evasion_rating_+_per_1_helmet_energy_shield': { pool: 'evasion', slot: 'head', from: 'energyShield', valueIs: 'amount', fixed: 1 },
  'evasion_rating_+_per_1_armour_on_gloves': { pool: 'evasion', slot: 'gloves', from: 'armour', valueIs: 'amount', fixed: 1 },
  'armour_+_per_1_boots_energy_shield': { pool: 'armour', slot: 'boots', from: 'energyShield', valueIs: 'amount', fixed: 1 },
  'energy_shield_+_per_8_helmet_armour': { pool: 'energyShield', slot: 'head', from: 'armour', valueIs: 'amount', fixed: 8 },
  '+1_spirit_per_X_evasion_rating_on_body_armour': { pool: 'spirit', slot: 'body', from: 'evasion', valueIs: 'div', fixed: 1 },
  '+1_spirit_per_X_energy_shield_on_body_armour': { pool: 'spirit', slot: 'body', from: 'energyShield', valueIs: 'div', fixed: 1 },
};

/**
 * Stats that change a defence this engine reports but that it does NOT
 * model yet. Any allocated or equipped source carrying one is listed on the
 * stat sheet by name, so a number is never silently missing a contribution.
 */
export const NOT_MODELLED: Readonly<Record<string, string>> = {
  'spirit_+_per_empty_charm_slot': 'Spirit per empty charm slot',
  'body_armour_grants_spirit_+%': 'increased Spirit from body armour',
  'ascendancy_beidats_will_spirit_+_per_X_maximum_life': 'Spirit per maximum Life',
  'body_armour_+%': 'increased Armour from body armour',
  base_physical_damage_reduction_rating_no_display: 'hidden Armour',
  'maximum_fire_resistance_+%_if_at_least_5_red_supports_socketed': 'Maximum Fire Resistance with 5 red supports socketed',
};

const ID_WORDS = /(^|_)(life|mana|energy_shield|evasion|armour|strength|dexterity|intelligence|attributes?|spirit|resist(ances?)?)(_|$)/;
/** Words that make an id a conditional, a per-X scaling, an offence or a recovery rate - not a flat sheet number. */
const ID_NOISE =
  /(^|_)(when|while|if|per|during|vs|against|on|for|with|after|regen|regeneration|leech|recovery|recoup|gain|lose|cost|taken|damage|chance|speed|duration|flask|charges?|minions?|totems?|aura|curse|display|break|amount|as)(_|$)/;

/**
 * Whether an UNMAPPED stat id looks like it could move a number the sheet
 * reports (a pool, an attribute, a resistance, Spirit), so the collector names
 * it instead of dropping it. Deliberately narrow: our data has thousands of
 * ids and almost all are offence, which would drown the list. Id words only.
 */
export function looksLikeDefenceStat(stat: string): boolean {
  const id = stat.replace('physical_damage_reduction_rating', 'armour');
  return ID_WORDS.test(id) && !ID_NOISE.test(id);
}
