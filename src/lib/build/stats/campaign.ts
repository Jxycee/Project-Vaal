// src/lib/build/stats/campaign.ts
// =============================================================================
// Campaign progress, DERIVED from a checkpoint's level (user decision,
// plans/2026-09-25-slice5-defence-engine.md): the elemental resistance
// penalty, and the fixed quest rewards a character of that level is assumed
// to have. Choice rewards are listed by name and never counted.
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

/** The quests whose reward is the player's choice — named, never counted. */
export const CHOICE_QUESTS: readonly { areaLevel: number; name: string }[] = [
  { areaLevel: 26, name: 'Medallion (Valley of the Titans)' },
  { areaLevel: 35, name: 'Venom Draught (Venom Crypts)' },
  { areaLevel: 51, name: 'Tribal Medicine (Eye of Hinekora)' },
  { areaLevel: 51, name: 'Goddess of Justice (Abandoned Prison)' },
  { areaLevel: 52, name: "Tawhoa's Test (Halls of the Dead)" },
  { areaLevel: 52, name: "Tasalio's Test (Halls of the Dead)" },
  { areaLevel: 52, name: "Ngamahu's Test (Halls of the Dead)" },
  { areaLevel: 63, name: 'Seven Pillars (Qimah)' },
];

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
  choiceRewardsNotCounted: string[];
}

export function campaignAt(rawLevel: number): CampaignProgress {
  const level = Number.isFinite(rawLevel) ? Math.min(100, Math.max(1, Math.trunc(rawLevel))) : 1;
  const stage = ACTS.find((a) => level <= a.upTo) ?? ENDGAME;
  return {
    act: stage.act,
    resistancePenalty: stage.penalty,
    rewards: FIXED_QUEST_REWARDS.filter((q) => level >= q.areaLevel).map(({ stat, value, source }) => ({ stat, value, source })),
    choiceRewardsNotCounted: CHOICE_QUESTS.filter((q) => level >= q.areaLevel).map((q) => q.name),
  };
}
