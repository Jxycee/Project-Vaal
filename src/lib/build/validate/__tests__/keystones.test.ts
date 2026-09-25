import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GIANTS_BLOOD, INSTRUMENTS_OF_POWER, LORD_OF_THE_WILDS, keystonesFor } from '../keystones';

const none = { giantsBlood: false, instrumentsOfPower: false, lordOfTheWilds: false };

describe('keystonesFor — every way it could be wrong', () => {
  it('reports nothing for an empty tree', () => {
    expect(keystonesFor({ set1: [], set2: [], ascendancyNodes: [] }, 1)).toEqual(none);
  });

  it('reads a set-specific keystone from its own set only', () => {
    const passive = { set1: [], set2: [GIANTS_BLOOD], ascendancyNodes: [] };
    expect(keystonesFor(passive, 1).giantsBlood).toBe(false);
    expect(keystonesFor(passive, 2).giantsBlood).toBe(true);
  });

  it('reads an ascendancy node for both sets', () => {
    const passive = { set1: [], set2: [], ascendancyNodes: [INSTRUMENTS_OF_POWER] };
    expect(keystonesFor(passive, 1).instrumentsOfPower).toBe(true);
    expect(keystonesFor(passive, 2).instrumentsOfPower).toBe(true);
  });

  it('flags only the keystone that is allocated, among unrelated nodes', () => {
    const passive = { set1: [1, 2, LORD_OF_THE_WILDS, 3], set2: [1, 2, LORD_OF_THE_WILDS, 3], ascendancyNodes: [4] };
    expect(keystonesFor(passive, 1)).toEqual({ ...none, lordOfTheWilds: true });
  });
});

describe('keystone ids — against public/data/tree/0.5.2', () => {
  const tree = JSON.parse(readFileSync('public/data/tree/0.5.2/data.json', 'utf8')) as {
    nodes: Record<string, { name?: string; ascendancyId?: string }>;
  };

  it('each id names the node it claims to', () => {
    expect(tree.nodes[String(GIANTS_BLOOD)]?.name).toBe("Giant's Blood");
    expect(tree.nodes[String(LORD_OF_THE_WILDS)]?.name).toBe('Lord of the Wilds');
    expect(tree.nodes[String(INSTRUMENTS_OF_POWER)]?.name).toBe('Instruments of Power');
  });

  it('Instruments of Power is an ascendancy node, the other two are main-tree', () => {
    expect(tree.nodes[String(INSTRUMENTS_OF_POWER)]?.ascendancyId).toBeTruthy();
    expect(tree.nodes[String(GIANTS_BLOOD)]?.ascendancyId).toBeUndefined();
    expect(tree.nodes[String(LORD_OF_THE_WILDS)]?.ascendancyId).toBeUndefined();
  });
});
