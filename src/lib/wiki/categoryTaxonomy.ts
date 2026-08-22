import type { CategoryGroup } from './categoryGroups';

/**
 * Groups the wiki's ~92 real item categories into a small set of top-level
 * sections for the browse-page sidebar, so the list is short enough to scan
 * by default instead of 92 flat rows. Verified against the real synced
 * index (2026-08-22): covers all 92 categories with none left over, none
 * duplicated. Skills (3 categories) and mods (13) don't need this — they
 * stay flat, per the design decision that only items has enough categories
 * to warrant grouping.
 */
export const ITEM_CATEGORY_GROUPS: Record<string, string[]> = {
  Armour: ['Body Armour', 'Helmet', 'Gloves', 'Boots', 'Shield', 'Buckler', 'Focus', 'Focii', 'Charm'],
  'Skill Gems': ['Support Skill Gem', 'Active Skill Gem', 'Meta Skill Gem', 'SkillGemToken'],
  Currency: [
    'StackableCurrency', 'SoulCore', 'Omen', 'Incubator', 'IncubatorStackable',
    'DelveSocketableCurrency', 'PantheonSoul', 'UncutSkillGemStackable',
    'UncutReservationGemStackable', 'UncutSupportGemStackable', 'UncutSkillGem_OLD',
    'UncutReservationGem_OLD', 'UncutSupportGem_OLD', 'ArchnemesisMod', 'DivinationCard',
    'Currency', 'PinnacleKey_OLD', 'PinnacleKeyStackable', 'VaultKey', 'MemoryLine',
    'BrequelFruit',
  ],
  Weapons: [
    'One Hand Sword', 'Two Hand Sword', 'One Hand Axe', 'Two Hand Axe', 'One Hand Mace',
    'Two Hand Mace', 'Mace', 'Bow', 'Crossbow', 'Claw', 'Dagger', 'Flail', 'Spear',
    'Sceptre', 'Wand', 'Staff', 'Warstaff', 'TrapTool', 'FishingRod',
  ],
  'Quest & Misc': ['QuestItem', 'HiddenItem', 'InstanceLocalItem', 'Relic', 'ConventionTreasure', 'GiftBox', 'Microtransaction'],
  'Maps & Endgame': [
    'MapFragment', 'Map', 'AtlasUpgradeItem', 'Breachstone', 'TowerAugmentation',
    'MiscMapItem', 'UniqueFragment', 'IncursionLeg', 'IncursionArm', 'IncursionItem',
    'ItemisedSanctum', 'SanctumSpecialRelic', 'ExpeditionLogbook', 'SentinelDrone',
  ],
  Jewellery: ['Ring', 'Amulet', 'Belt', 'Quiver', 'Jewel', 'Talisman'],
  Heist: [
    'HeistObjective', 'HeistEquipmentTool', 'HeistEquipmentWeapon', 'HeistEquipmentUtility',
    'HeistEquipmentReward', 'HeistContract', 'HeistBlueprint',
  ],
  Flasks: ['LifeFlask', 'ManaFlask', 'UtilityFlask', 'Life Flask', 'Mana Flask'],
};

export interface CategorySection {
  label: string;
  total: number;
  categories: CategoryGroup[];
}

const FALLBACK_LABEL = 'Other';

/**
 * Buckets flat category groups (from groupByCategory) into taxonomy
 * sections. Any real category not covered by the taxonomy lands in a
 * fallback "Other" section rather than silently disappearing — a future
 * sync could add a brand-new item category the taxonomy hasn't been
 * updated for yet. Sections are sorted by total item count descending
 * (name ascending on ties); categories within each section keep
 * groupByCategory's own sort.
 */
export function groupByTaxonomy(
  groups: CategoryGroup[],
  taxonomy: Record<string, string[]>
): CategorySection[] {
  const categoryToSection = new Map<string, string>();
  for (const [section, categories] of Object.entries(taxonomy)) {
    for (const category of categories) {
      categoryToSection.set(category, section);
    }
  }

  const sections = new Map<string, CategoryGroup[]>();
  for (const group of groups) {
    const section = categoryToSection.get(group.category) ?? FALLBACK_LABEL;
    const existing = sections.get(section) ?? [];
    existing.push(group);
    sections.set(section, existing);
  }

  return [...sections.entries()]
    .map(([label, categories]) => ({
      label,
      total: categories.reduce((sum, c) => sum + c.count, 0),
      categories,
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}
