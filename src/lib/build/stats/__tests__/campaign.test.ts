import { describe, expect, it } from 'vitest';
import { campaignAt, CHOICE_QUESTS, FIXED_QUEST_REWARDS } from '../campaign';

// Failure modes first (AGENTS.md). Campaign progress is DERIVED from a
// checkpoint's level (user decision, plans/2026-09-25-slice5-defence-engine.md):
// the resistance penalty and the fixed quest rewards a character of that level
// is assumed to have. Choice rewards are listed, never counted.

describe('campaignAt — the act and resistance penalty', () => {
  it.each([
    [15, 'Act 1', 0],
    [16, 'Act 2', -10],
    [30, 'Act 2', -10],
    [31, 'Act 3', -20],
    [44, 'Act 3', -20],
    [45, 'Act 4', -30],
    [52, 'Act 4', -30],
    [53, 'Interludes', -40],
    [64, 'Interludes', -40],
    [65, 'Endgame', -60],
  ])('level %i is assumed to be in %s, at %i%%', (level, act, penalty) => {
    const c = campaignAt(level);
    expect(c.act).toBe(act);
    expect(c.resistancePenalty).toBe(penalty);
  });

  it('clamps nonsense levels instead of failing', () => {
    expect(campaignAt(0).act).toBe('Act 1');
    expect(campaignAt(250).act).toBe('Endgame');
    expect(campaignAt(Number.NaN).act).toBe('Act 1');
  });
});

describe('campaignAt — quest rewards', () => {
  it('counts a fixed reward once the level reaches its area level, and not before', () => {
    const at10 = campaignAt(10).rewards.map((r) => r.stat);
    expect(at10).toEqual(['base_cold_damage_resistance_%']); // Clearfell, area 2
    const at11 = campaignAt(11).rewards.map((r) => r.stat);
    expect(at11).toContain('base_spirit'); // King in the Mists, area 11
  });

  it('gives every fixed reward at endgame: 100 Spirit, +10% to each elemental resistance, +20 Life, 5% Life, 5% Mana', () => {
    const sum = (stat: string) => campaignAt(100).rewards.filter((r) => r.stat === stat).reduce((n, r) => n + r.value, 0);
    expect(sum('base_spirit')).toBe(100);
    expect(sum('base_cold_damage_resistance_%')).toBe(10);
    expect(sum('base_lightning_damage_resistance_%')).toBe(10);
    expect(sum('base_fire_damage_resistance_%')).toBe(10);
    expect(sum('base_maximum_life')).toBe(20);
    expect(sum('maximum_life_+%')).toBe(5);
    expect(sum('maximum_mana_+%')).toBe(5);
    expect(campaignAt(100).rewards).toHaveLength(FIXED_QUEST_REWARDS.length);
  });

  it('names every choice reward it did not count, by area', () => {
    expect(campaignAt(1).choiceRewardsNotCounted).toEqual([]);
    const late = campaignAt(100).choiceRewardsNotCounted;
    expect(late).toHaveLength(CHOICE_QUESTS.length);
    expect(late).toContain('Medallion (Valley of the Titans)');
  });

});

describe('FIXED_QUEST_REWARDS — against our stat vocabulary', () => {
  it('uses only stat ids the tree data knows, so a typo cannot silently count nothing', async () => {
    const { readFileSync } = await import('node:fs');
    const nodes = (JSON.parse(readFileSync('public/data/tree/0.5.2/node-stats.json', 'utf8')) as { nodes: Record<string, [string, number][]> }).nodes;
    const known = new Set(Object.values(nodes).flatMap((list) => list.map(([stat]) => stat)));
    for (const q of FIXED_QUEST_REWARDS) expect(known.has(q.stat), q.stat).toBe(true);
  });
});

describe('choice quests — what a recorded choice counts', () => {
  it('counts nothing for an unchosen quest and names it; counts only quests the level reached', () => {
    const none = campaignAt(100, {});
    expect(none.choiceRewards).toEqual([]);
    expect(none.choiceRewardsNotCounted).toHaveLength(CHOICE_QUESTS.length);
    // Seven Pillars is area level 63: a level-62 character has not reached it, whatever was stored.
    const early = campaignAt(62, { 'seven-pillars': 'all-attributes', 'tawhoas-test': 'dexterity' });
    expect(early.choiceRewards.map((r) => r.source)).toEqual(["Tawhoa's Test (Halls of the Dead)"]);
    expect(early.choiceRewardsNotCounted).not.toContain('Seven Pillars (Qimah)');
  });

  it('counts the chosen option\'s stats, tagged with the quest as source', () => {
    const c = campaignAt(98, { 'ngamahus-test': 'strength', 'tasalios-test': 'cold-resistance', 'tribal-medicine': 'global-defences' });
    expect(c.choiceRewards).toEqual([
      { stat: 'global_armour_evasion_energy_shield_+%', value: 30, source: 'Tribal Medicine (Eye of Hinekora)' },
      { stat: 'base_cold_damage_resistance_%', value: 5, source: "Tasalio's Test (Halls of the Dead)" },
      { stat: 'base_strength', value: 5, source: "Ngamahu's Test (Halls of the Dead)" },
    ]);
  });

  it('ignores an option id that is not one of that quest\'s options (never crashes, never counts)', () => {
    const c = campaignAt(98, { 'tawhoas-test': 'strength', 'no-such-quest': 'x', 'seven-pillars': 'constructor' });
    expect(c.choiceRewards).toEqual([]);
    expect(c.choiceRewardsNotCounted).toContain("Tawhoa's Test (Halls of the Dead)");
  });

  it('a chosen Seven Pillars trade-off subtracts, and the Tribal Medicine elemental option counts all three of its lines', () => {
    const c = campaignAt(98, { 'seven-pillars': 'experience-trade', 'tribal-medicine': 'elemental-armour' });
    expect(c.choiceRewards.map((r) => [r.stat, r.value])).toEqual([
      ['armour_%_applies_to_fire_cold_lightning_damage', 15],
      ['base_deflection_rating_%_of_evasion_rating', 12],
      ['energy_shield_delay_-%', 12],
      ['base_resist_all_elements_%', -5],
      ['global_armour_evasion_energy_shield_+%', -15],
      ['all_attributes_+%', -5],
      ['base_movement_velocity_+%', -3],
    ]);
    expect(c.choiceRewardsUnmodelled).toEqual([]);
  });

  it('every option of every quest has a unique id within its quest, and a unique PoB text', () => {
    for (const q of CHOICE_QUESTS) {
      expect(new Set(q.options.map((o) => o.id)).size, q.id).toBe(q.options.length);
      expect(new Set(q.options.map((o) => o.text)).size, q.id).toBe(q.options.length);
    }
    expect(new Set(CHOICE_QUESTS.map((q) => q.id)).size).toBe(CHOICE_QUESTS.length);
  });

  it('only counts stat ids the engine understands, so a typo cannot silently count nothing', async () => {
    const { GLOBAL_EFFECTS } = await import('../statTable');
    for (const q of CHOICE_QUESTS) for (const o of q.options) for (const [stat] of o.stats) expect(GLOBAL_EFFECTS[stat], `${q.id}/${o.id}: ${stat}`).toBeDefined();
  });
});
