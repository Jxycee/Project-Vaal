import { describe, it, expect } from 'vitest';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { summarizeJewels } from '../jewelState';
import type { GearItem } from '../gearSlots';

const jewel: GearItem = {
  slug: 'brutal-restraint',
  name: 'Brutal Restraint',
  category: 'Jewel',
  isUnique: true,
  iconUrl: null,
};
const otherJewel: GearItem = { ...jewel, slug: 'crimson-jewel', name: 'Crimson Jewel', isUnique: false };

function raw(): GggTreeJson {
  return {
    groups: {},
    nodes: {
      '1': { name: '[Jewel] Socket' },
      '2': { name: '[SinisterJewelSockets|Sinister] [Jewel] Socket' },
    },
    classes: [],
    jewelSlots: [1, 2],
    min_x: 0,
    min_y: 0,
    max_x: 0,
    max_y: 0,
  };
}

describe('summarizeJewels', () => {
  it('lists no sockets and no orphans when nothing is allocated or stored', () => {
    const summary = summarizeJewels(raw(), [], {});
    expect(summary).toEqual({ sockets: [], orphans: [], filledCount: 0 });
  });

  it('lists an allocated, empty socket', () => {
    const summary = summarizeJewels(raw(), [1], {});
    expect(summary.sockets).toEqual([{ id: 1, name: 'Jewel Socket', item: null }]);
    expect(summary.filledCount).toBe(0);
  });

  it('lists an allocated, filled socket', () => {
    const summary = summarizeJewels(raw(), [1], { '1': jewel });
    expect(summary.sockets).toEqual([{ id: 1, name: 'Jewel Socket', item: jewel }]);
    expect(summary.filledCount).toBe(1);
  });

  // The orphan rule: deallocating socket 1 must not delete its jewel — it
  // moves from `sockets` to `orphans`, never disappears.
  it('moves a jewel to orphans when its socket is deallocated, without deleting it', () => {
    const summary = summarizeJewels(raw(), [], { '1': jewel });
    expect(summary.sockets).toEqual([]);
    expect(summary.orphans).toEqual([{ socketId: '1', name: 'Jewel Socket', item: jewel }]);
    expect(summary.filledCount).toBe(0);
  });

  it('keeps one socket filled and another orphaned independently', () => {
    const summary = summarizeJewels(raw(), [1], { '1': jewel, '2': otherJewel });
    expect(summary.sockets).toEqual([{ id: 1, name: 'Jewel Socket', item: jewel }]);
    expect(summary.orphans).toEqual([{ socketId: '2', name: 'Sinister Jewel Socket', item: otherJewel }]);
    expect(summary.filledCount).toBe(1);
  });

  it('falls back to a generic name for an orphan whose socket id no longer resolves at all', () => {
    const summary = summarizeJewels(raw(), [], { '999': jewel });
    expect(summary.orphans).toEqual([{ socketId: '999', name: 'Socket 999', item: jewel }]);
  });
});
