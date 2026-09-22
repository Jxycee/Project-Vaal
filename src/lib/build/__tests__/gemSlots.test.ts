import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  GEM_SKILL_PSEUDO_SLOT,
  GEM_SUPPORT_PSEUDO_SLOT,
  MAX_SUPPORTS_PER_SKILL,
  categoriesForGemSlot,
  isGemPseudoSlot,
} from '../gemSlots';
import { WIKI_DATA_VERSION } from '@/lib/wiki/types';

// Data regression: the plan's whole "no second search implementation" design
// rests on the skill-index category vocabulary being exactly what this file
// hardcodes. A resync that renames or removes a category must fail HERE,
// loudly, rather than ship a picker that silently returns zero gems (the
// Focus/Focii lesson from gearSlots.ts, applied before the fact).
function readSkillIndexCategories(): Record<string, number> {
  const file = path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION, 'skill-index.json');
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { entries: { category: string }[] };
  const counts: Record<string, number> = {};
  for (const entry of raw.entries) counts[entry.category] = (counts[entry.category] ?? 0) + 1;
  return counts;
}

describe('skill-index category vocabulary (live data)', () => {
  it('is exactly the four known categories, each non-zero', () => {
    const counts = readSkillIndexCategories();
    expect(Object.keys(counts).sort()).toEqual(
      ['Active Skill Gem', 'Spirit Gem', 'Support Gem', 'Unused / Removed'].sort(),
    );
    for (const count of Object.values(counts)) expect(count).toBeGreaterThan(0);
  });

  it('every category this module maps a gem slot to has a non-zero entry count', () => {
    const counts = readSkillIndexCategories();
    for (const slot of [GEM_SKILL_PSEUDO_SLOT, GEM_SUPPORT_PSEUDO_SLOT] as const) {
      for (const category of categoriesForGemSlot(slot)) {
        expect(counts[category] ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it('never maps a gem slot to Unused / Removed', () => {
    for (const slot of [GEM_SKILL_PSEUDO_SLOT, GEM_SUPPORT_PSEUDO_SLOT] as const) {
      expect(categoriesForGemSlot(slot)).not.toContain('Unused / Removed');
    }
  });
});

describe('categoriesForGemSlot', () => {
  it('maps the skill slot to Active Skill Gem and Spirit Gem', () => {
    expect(categoriesForGemSlot(GEM_SKILL_PSEUDO_SLOT)).toEqual(['Active Skill Gem', 'Spirit Gem']);
  });

  it('maps the support slot to Support Gem only', () => {
    expect(categoriesForGemSlot(GEM_SUPPORT_PSEUDO_SLOT)).toEqual(['Support Gem']);
  });
});

describe('isGemPseudoSlot', () => {
  it('accepts both gem pseudo-slots', () => {
    expect(isGemPseudoSlot(GEM_SKILL_PSEUDO_SLOT)).toBe(true);
    expect(isGemPseudoSlot(GEM_SUPPORT_PSEUDO_SLOT)).toBe(true);
  });

  it('rejects gear slots and arbitrary strings', () => {
    expect(isGemPseudoSlot('head')).toBe(false);
    expect(isGemPseudoSlot('jewels')).toBe(false);
    expect(isGemPseudoSlot('')).toBe(false);
  });
});

describe('MAX_SUPPORTS_PER_SKILL', () => {
  it('is 5', () => {
    expect(MAX_SUPPORTS_PER_SKILL).toBe(5);
  });
});
