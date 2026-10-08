import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { MAX_ASCENDANCY_POINTS } from '../../constants';
import { emptyGearState } from '../../gearState';
import { ascendancyPointCount } from '../../ascendancyPoints';
import { derivePassiveBudget, isOverPassiveBudget } from '../../passiveBudget';
import type { PassiveState } from '../../types';
import { getCatalogue } from '@/lib/pob/catalogue';
import { decodePobCode } from '@/lib/pob/decode';
import { mapBuild } from '@/lib/pob/mapBuild';
import { parsePobXml } from '@/lib/pob/parse';
import { validateCheckpoint } from '../index';

// A LEGAL real character must raise no structural tree warning: momentsZX, a level-98 Deadeye
// with 122 passives and 8 ascendancy points (docs/superpowers/handoffs/2026-09-27-momentsZX-pob2-code.txt).
// One of its 9 stored ascendancy nodes is a choice option (Point Blank under Projectile Proximity
// Specialisation): PoB2 counts points, not nodes — PassiveSpec.lua:1067-1074 skips
// `isMultipleChoiceOption` nodes (CountAllocNodes), and Build.lua:1055 warns only past 8.
//
// Passive budget — PoB2 Build.lua:84-102 sums every quest's `questPoints` from QuestRewards.lua
// (12 quests x 2 = 24, all "+2 Weapon Set Passive Skill Points"), Build.lua:1031 caps at
// 99 + 24 + ExtraPoints, and Build.lua:1035 derives the REQUIRED level as nodes + 1 - 24 = 99
// for these 122 nodes. The sheet says 98, so the level-derived budget (121) gets one point of slack.

const tree = JSON.parse(readFileSync('public/data/tree/0.5.2/data.json', 'utf8'));
let passive: PassiveState;

beforeAll(async () => {
  const decoded = decodePobCode(readFileSync('docs/superpowers/handoffs/2026-09-27-momentsZX-pob2-code.txt', 'utf8').trim());
  if (!decoded.ok) throw new Error('momentsZX code failed to decode');
  const parsed = parsePobXml(decoded.xml);
  if (!parsed.ok) throw new Error('momentsZX failed to parse');
  const mapped = await mapBuild(parsed.build, await getCatalogue(), {});
  if (!mapped.ok) throw new Error(mapped.error);
  passive = mapped.plan.checkpoints[mapped.plan.checkpoints.length - 1].passive_state;
}, 180_000);

// Points spent against the shared budget: nodes in both sets once, plus the larger set-only pool
// (PoB2 Build.lua:1053, normalPassives = PointsUsed - min(ws1, ws2)).
const spentOf = (p: PassiveState) => {
  const s2 = new Set(p.set2);
  const shared = p.set1.filter((n) => s2.has(n)).length;
  return shared + Math.max(p.set1.length - shared, p.set2.length - shared);
};

const treeWarnings = (p: PassiveState, withTree = true) =>
  validateCheckpoint({ passive: p, gear: emptyGearState(), tree: withTree ? tree : null }).filter((w) => w.target.kind === 'tree');

describe('a legal level-98 Deadeye raises no false structural warning', () => {
  it('stores 9 ascendancy nodes but only 8 points', () => {
    expect(passive.ascendancyNodes).toHaveLength(MAX_ASCENDANCY_POINTS + 1);
    expect(ascendancyPointCount(passive.ascendancyNodes, tree)).toBe(MAX_ASCENDANCY_POINTS);
  });

  it('no ascendancy or weapon-set warning', () => {
    expect(treeWarnings(passive)).toEqual([]);
  });

  it('NEGATIVE: without tree data the node count is all there is, so it still warns (nothing hides a real overflow)', () => {
    expect(treeWarnings(passive, false).map((w) => w.code)).toEqual(['ascendancy-points-over']);
  });

  it('122 passives fit a level-99 budget, as PoB2 computes (one point over at 98, unexplained — see passiveBudget.ts)', () => {
    expect(spentOf(passive)).toBe(122);
    expect(isOverPassiveBudget(122, derivePassiveBudget(99))).toBe(false);
    expect(isOverPassiveBudget(122, derivePassiveBudget(98))).toBe(true);
  });
});

describe('real overflows still warn', () => {
  it('9 ascendancy POINTS (a ninth non-option node) warns', () => {
    const owned = new Set(passive.ascendancyNodes);
    const extra = Object.values(tree.nodes as Record<string, { skill: number; ascendancyId?: string; isMultipleChoiceOption?: boolean }>).find(
      (n) => n.ascendancyId === 'Ranger1' && !n.isMultipleChoiceOption && !owned.has(n.skill),
    );
    expect(extra).toBeDefined();
    const nine = { ...passive, ascendancyNodes: [...passive.ascendancyNodes, extra!.skill] };
    expect(ascendancyPointCount(nine.ascendancyNodes, tree)).toBe(MAX_ASCENDANCY_POINTS + 1);
    expect(treeWarnings(nine).map((w) => w.code)).toEqual(['ascendancy-points-over']);
  });

  it('123 passives at level 98 is over, as is 125 at level 100', () => {
    expect(isOverPassiveBudget(123, derivePassiveBudget(98))).toBe(true);
    expect(isOverPassiveBudget(125, derivePassiveBudget(100))).toBe(true);
    expect(isOverPassiveBudget(123, derivePassiveBudget(100))).toBe(false);
  });
});
