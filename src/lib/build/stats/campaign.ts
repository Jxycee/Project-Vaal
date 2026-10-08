// src/lib/build/stats/campaign.ts
// =============================================================================
// Campaign progress, DERIVED from a checkpoint's level (user decision,
// plans/2026-09-25-slice5-defence-engine.md): the elemental resistance
// penalty, and the fixed quest rewards a character of that level is assumed
// to have. A choice reward counts once the build records a choice
// (PassiveState.questChoices); an unchosen one is listed by name, not counted.
//
// Source: Path of Building Community (PoE2) — src/Data/QuestRewards.lua for
// the quests, their area levels and rewards; src/Modules/ConfigOptions.lua:113
// for the penalty ladder (Act 1 0% … Act 6 -50%, Endgame -60%). PoB2 is MIT,
// Copyright (c) 2016 David Gowor. The rewards themselves are GGG's game data.
//
// The penalty is PoB2's model — -10% per completed act, with the Interludes
// as act 5 and the Epilogue as act 6 — and matches Maxroll's defence guide
// ("-60% in total upon completing all six Acts"). It is not verified against
// the game itself. A level cannot tell the Epilogue (area level 62) from the
// Interludes (up to 64), so no level maps to Act 6's -50%.
//
// A quest is assumed done once the level reaches its area level; players
// usually out-level an area, so this errs toward counting a reward early.
// =============================================================================

export interface QuestReward {
  stat: string;
  value: number;
  source: string;
}

interface FixedQuest {
  areaLevel: number;
  stat: string;
  value: number;
  source: string;
}

/** The quests whose reward is a fixed defensive stat, as PoB2's QuestRewards.lua lists them. */
export const FIXED_QUEST_REWARDS: readonly FixedQuest[] = [
  { areaLevel: 2, stat: 'base_cold_damage_resistance_%', value: 10, source: 'Beira (Clearfell)' },
  { areaLevel: 11, stat: 'base_spirit', value: 30, source: 'King in the Mists (Freythorn)' },
  { areaLevel: 15, stat: 'base_maximum_life', value: 20, source: 'Candlemass (Ogham Manor)' },
  { areaLevel: 30, stat: 'base_lightning_damage_resistance_%', value: 10, source: 'Sisters of Garukhan Shrine (Spires of Deshar)' },
  { areaLevel: 36, stat: 'base_spirit', value: 30, source: 'Ignagduk (Azak Bog)' },
  { areaLevel: 37, stat: 'base_fire_damage_resistance_%', value: 10, source: "Blackjaw (Jiquani's Machinarium)" },
  { areaLevel: 51, stat: 'maximum_mana_+%', value: 5, source: 'Silent Hall (Eye of Hinekora)' },
  { areaLevel: 61, stat: 'maximum_life_+%', value: 5, source: 'Molten Shrine (Khari Crossing)' },
  { areaLevel: 61, stat: 'base_spirit', value: 40, source: 'Lythara (Kriar Village)' },
];

/** One option of a choice quest. `stats` are the ones this engine counts; `unmodelled` names a defensive effect it does not. */
export interface QuestOption {
  id: string;
  /** The reward as PoB2's QuestRewards.lua words it, line breaks collapsed to " / ". */
  text: string;
  stats: readonly (readonly [stat: string, value: number])[];
  unmodelled?: string;
}

export interface ChoiceQuest {
  /** Stable id stored in PassiveState.questChoices. */
  id: string;
  areaLevel: number;
  /** "Quest (Area)", as the sheet and the "Not counted" list name it. */
  name: string;
  /**
   * PoB2's Config input name: "quest" .. Description .. Area .. Info
   * (src/Modules/ConfigOptions.lua:72), stored in a build's <Config> as
   * <Input name=pobKey string=option text>.
   */
  pobKey: string;
  options: readonly QuestOption[];
}

/**
 * The quests whose reward the player chooses, with every option, from PoB2's
 * src/Data/QuestRewards.lua (the entries carrying `Options`: Medallion line
 * 59, Venom Draught 109, Tribal Medicine 160, Tawhoa's / Tasalio's /
 * Ngamahu's Test 172-207, Goddess of Justice 218, Seven Pillars 259), read raw
 * from the `dev` branch on 2026-10-05. A chosen option counts only its
 * `stats`; effects that touch no defence on this sheet (charms, thresholds,
 * flask recovery, cooldowns) carry none, and defensive effects the engine
 * cannot model say so in `unmodelled`.
 */
export const CHOICE_QUESTS: readonly ChoiceQuest[] = [
  {
    id: 'medallion',
    areaLevel: 26,
    name: 'Medallion (Valley of the Titans)',
    pobKey: 'questAct 2Valley of the TitansMedallion',
    options: [
      { id: 'charm-charges', text: '30% increased Charm Charges Gained / +1 Charm Slot', stats: [] },
      { id: 'charm-duration', text: '30% increased Charm Effect Duration / +1 Charm Slot', stats: [] },
    ],
  },
  {
    id: 'venom-draught',
    areaLevel: 35,
    name: 'Venom Draught (Venom Crypts)',
    pobKey: 'questAct 3Venom CryptsVenom Draught',
    options: [
      { id: 'stun-threshold', text: '25% increased Stun Threshold', stats: [] },
      { id: 'ailment-threshold', text: '30% increased Elemental Ailment Threshold', stats: [] },
      { id: 'mana-regen', text: '25% increased Mana Regeneration Rate', stats: [['mana_regeneration_rate_+%', 25]] },
    ],
  },
  {
    id: 'tribal-medicine',
    areaLevel: 51,
    name: 'Tribal Medicine (Eye of Hinekora)',
    pobKey: 'questAct 4Eye of HinekoraTribal Medicine',
    options: [
      { id: 'global-defences', text: '30% increased Global Armour, Evasion and Energy Shield', stats: [['global_armour_evasion_energy_shield_+%', 30]] },
      {
        id: 'elemental-armour',
        text: '+15% of Armour also applies to Elemental Damage / Gain Deflection Rating equal to 12% of Evasion Rating / 12% faster start of Energy Shield Recharge',
        stats: [
          ['armour_%_applies_to_fire_cold_lightning_damage', 15],
          ['base_deflection_rating_%_of_evasion_rating', 12],
          ['energy_shield_delay_-%', 12],
        ],
      },
    ],
  },
  {
    id: 'goddess-of-justice',
    areaLevel: 51,
    name: 'Goddess of Justice (Abandoned Prison)',
    pobKey: 'questAct 4Abandoned PrisonGoddess of Justice',
    options: [
      { id: 'life-flasks', text: '30% increased Life Recovery from Flasks', stats: [] },
      { id: 'mana-flasks', text: '30% increased Mana Recovery from Flasks', stats: [] },
    ],
  },
  {
    id: 'tawhoas-test',
    areaLevel: 52,
    name: "Tawhoa's Test (Halls of the Dead)",
    pobKey: "questAct 4Halls Of The DeadTawhoa's Test",
    options: [
      { id: 'dexterity', text: '+5 to Dexterity', stats: [['base_dexterity', 5]] },
      { id: 'lightning-resistance', text: '+5% to Lightning Resistance', stats: [['base_lightning_damage_resistance_%', 5]] },
    ],
  },
  {
    id: 'tasalios-test',
    areaLevel: 52,
    name: "Tasalio's Test (Halls of the Dead)",
    pobKey: "questAct 4Halls Of The DeadTasalio's Test",
    options: [
      { id: 'intelligence', text: '+5 to Intelligence', stats: [['base_intelligence', 5]] },
      { id: 'cold-resistance', text: '+5% to Cold Resistance', stats: [['base_cold_damage_resistance_%', 5]] },
    ],
  },
  {
    id: 'ngamahus-test',
    areaLevel: 52,
    name: "Ngamahu's Test (Halls of the Dead)",
    pobKey: "questAct 4Halls Of The DeadNgamahu's Test",
    options: [
      { id: 'strength', text: '+5 to Strength', stats: [['base_strength', 5]] },
      { id: 'fire-resistance', text: '+5% to Fire Resistance', stats: [['base_fire_damage_resistance_%', 5]] },
    ],
  },
  {
    id: 'seven-pillars',
    areaLevel: 63,
    name: 'Seven Pillars (Qimah)',
    pobKey: 'questInterlude 2QimahSeven Pillars',
    options: [
      { id: 'all-resistances', text: '+5% to all Elemental Resistances', stats: [['base_resist_all_elements_%', 5]] },
      { id: 'movement-speed', text: '3% increased Movement Speed', stats: [['base_movement_velocity_+%', 3]] },
      { id: 'global-defences', text: '15% increased Global Armour, Evasion and Energy Shield', stats: [['global_armour_evasion_energy_shield_+%', 15]] },
      { id: 'presence-area', text: '20% increased Presence Area Of Effect', stats: [] },
      { id: 'cooldown-recovery', text: '12% increased Cooldown Recovery Rate', stats: [] },
      { id: 'all-attributes', text: '+5 to all Attributes', stats: [['base_all_attributes', 5]] },
      {
        id: 'experience-trade',
        text: '5% increased Experience Gain / -5% to all Elemental Resistances / 3% reduced Movement Speed / 15% reduced Global Armour, Evasion and Energy Shield / 20% reduced Presence Area Of Effect / 12% reduced Cooldown Recovery Rate / 5% reduced Attributes',
        stats: [
          ['base_resist_all_elements_%', -5],
          ['global_armour_evasion_energy_shield_+%', -15],
          ['all_attributes_+%', -5],
          ['base_movement_velocity_+%', -3],
        ],
      },
    ],
  },
];

export const CHOICE_QUEST_BY_ID: ReadonlyMap<string, ChoiceQuest> = new Map(CHOICE_QUESTS.map((q) => [q.id, q]));

/** Whether `optionId` is a real option of the quest `questId`. */
export function isQuestChoice(questId: string, optionId: unknown): optionId is string {
  return typeof optionId === 'string' && !!CHOICE_QUEST_BY_ID.get(questId)?.options.some((o) => o.id === optionId);
}

/** Highest quest area level of each act (cumulative), from QuestRewards.lua; above the last is endgame. */
const ACTS: readonly { upTo: number; act: string; penalty: number }[] = [
  { upTo: 15, act: 'Act 1', penalty: 0 },
  { upTo: 30, act: 'Act 2', penalty: -10 },
  { upTo: 44, act: 'Act 3', penalty: -20 },
  { upTo: 52, act: 'Act 4', penalty: -30 },
  { upTo: 64, act: 'Interludes', penalty: -40 },
];
const ENDGAME = { act: 'Endgame', penalty: -60 };

export interface CampaignProgress {
  act: string;
  /** Added to fire, cold and lightning resistance; chaos is not penalised. */
  resistancePenalty: number;
  rewards: QuestReward[];
  /** The chosen option of each reached choice quest, as rewards to count. */
  choiceRewards: QuestReward[];
  /** Chosen options with a defensive effect the engine does not model: "Quest: effect". */
  choiceRewardsUnmodelled: string[];
  /** Reached choice quests with no (valid) choice made. */
  choiceRewardsNotCounted: string[];
}

export function campaignAt(rawLevel: number, questChoices: Readonly<Record<string, string>> = {}): CampaignProgress {
  const level = Number.isFinite(rawLevel) ? Math.min(100, Math.max(1, Math.trunc(rawLevel))) : 1;
  const stage = ACTS.find((a) => level <= a.upTo) ?? ENDGAME;
  const choiceRewards: QuestReward[] = [];
  const choiceRewardsUnmodelled: string[] = [];
  const choiceRewardsNotCounted: string[] = [];
  for (const q of CHOICE_QUESTS.filter((c) => level >= c.areaLevel)) {
    const option = q.options.find((o) => o.id === questChoices[q.id]);
    if (!option) {
      choiceRewardsNotCounted.push(q.name);
      continue;
    }
    for (const [stat, value] of option.stats) choiceRewards.push({ stat, value, source: q.name });
    if (option.unmodelled) choiceRewardsUnmodelled.push(q.name + ': ' + option.unmodelled);
  }
  return {
    act: stage.act,
    resistancePenalty: stage.penalty,
    rewards: FIXED_QUEST_REWARDS.filter((q) => level >= q.areaLevel).map(({ stat, value, source }) => ({ stat, value, source })),
    choiceRewards,
    choiceRewardsUnmodelled,
    choiceRewardsNotCounted,
  };
}
