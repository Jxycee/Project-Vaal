import { describe, expect, it } from 'vitest';
import { campaignAt, CHOICE_QUESTS, FIXED_QUEST_REWARDS } from '../campaign';

// Failure modes first (AGENTS.md). Campaign progress is DERIVED from a
// checkpoint's level (user decision, plans/2026-09-25-slice5-defence-engine.md):
// the resistance penalty and the fixed quest rewards a character of that level
// is assumed to have. Choice rewards are listed, never counted.

describe('campaignAt — the act and resistance penalty', () => {
  it.each([
    [1, 'Act 1', 0],
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
    [100, 'Endgame', -60],
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

  it('names each reward by its quest, so a sheet can say where a number came from', () => {
    expect(campaignAt(11).rewards.find((r) => r.stat === 'base_spirit')?.source).toBe('King in the Mists (Freythorn)');
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
