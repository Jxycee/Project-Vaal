import { describe, expect, it } from 'vitest';
import { mapQuests } from '../mapQuests';

// Failure modes first (AGENTS.md): a key or reward text we do not know must be
// REPORTED, never guessed at, and "Nothing" must read as no choice.

describe('mapQuests', () => {
  it('maps a PoB quest input to our quest and option ids', () => {
    const r = mapQuests([
      { name: "questAct 4Halls Of The DeadNgamahu's Test", value: '+5 to Strength' },
      { name: 'questInterlude 2QimahSeven Pillars', value: '15% increased Global Armour, Evasion and Energy Shield' },
    ]);
    expect(r.value).toEqual({ 'ngamahus-test': 'strength', 'seven-pillars': 'global-defences' });
    expect(r.report).toEqual([]);
  });

  it('matches a multi-line reward whatever whitespace PoB left between the lines', () => {
    const text = '+15% of Armour also applies to Elemental Damage\n\tGain Deflection Rating equal to 12% of Evasion Rating\n\t12% faster start of Energy Shield Recharge';
    expect(mapQuests([{ name: 'questAct 4Eye of HinekoraTribal Medicine', value: text }]).value).toEqual({ 'tribal-medicine': 'elemental-armour' });
    expect(mapQuests([{ name: 'questAct 4Eye of HinekoraTribal Medicine', value: text.replace(/\n\t/g, ' ') }]).value).toEqual({
      'tribal-medicine': 'elemental-armour',
    });
  });

  it('reads "None" and an empty value as no choice, without a report', () => {
    const r = mapQuests([
      { name: 'questAct 2Valley of the TitansMedallion', value: 'None' },
      { name: 'questAct 3Venom CryptsVenom Draught', value: '' },
    ]);
    expect(r).toEqual({ value: {}, report: [] });
  });

  it('reports an unknown quest key and an unknown reward text, and imports neither', () => {
    const r = mapQuests([
      { name: 'questAct 9Nowhere Special', value: '+5 to Strength' },
      { name: "questAct 4Halls Of The DeadNgamahu's Test", value: '+50 to Strength' },
      { name: 'questAct 2Valley of the TitansMedallion', value: '30% increased Charm Effect Duration\n\t+1 Charm Slot' },
    ]);
    expect(r.value).toEqual({ medallion: 'charm-duration' });
    expect(r.report).toHaveLength(2);
    expect(r.report.every((e) => e.kind === 'dropped')).toBe(true);
    expect(r.report[0].message).toContain('questAct 9Nowhere Special');
    expect(r.report[1].message).toContain("Ngamahu's Test");
  });

  it('a later input for the same quest wins, as PoB keeps one value per key', () => {
    const r = mapQuests([
      { name: "questAct 4Halls Of The DeadNgamahu's Test", value: '+5 to Strength' },
      { name: "questAct 4Halls Of The DeadNgamahu's Test", value: '+5% to Fire Resistance' },
    ]);
    expect(r.value).toEqual({ 'ngamahus-test': 'fire-resistance' });
  });
});
