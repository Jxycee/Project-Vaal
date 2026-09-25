// src/lib/pob/mapGems.ts
// =============================================================================
// PoB skill groups -> our GemState, plus what could not come across.
//
// Pure. The rules, each verified against a real export (see the Slice 2 plan):
//
// - Gems join on their GGG id (the last segment of <Gem gemId>), never on the
//   display name. Names resolved 40–60% of a real build; ids resolved 20/20 —
//   Artillery Ballista's id is SkillGemRipwireBallista, which no name join
//   could find.
// - A skill set contains empty LABEL rows ("^6--- Spirit Gems ---") as well
//   as real groups. They are skipped, but each group keeps its position
//   among all of them, because Build@mainSocketGroup counts label rows.
// - One loadout per group: its first gem must be an active skill. A group led
//   by a support is dropped rather than guessed at, and a second active gem
//   in a group is dropped because a loadout holds one skill.
// - Nothing is lost silently. Unknown gems, extra supports beyond our cap,
//   disabled gems and groups, clamped levels, and support quality (our model
//   keeps quality on the skill only) are all reported.
// =============================================================================

import type { WeaponSet } from '@poe2-toolkit/tree-core';
import type { GearItem } from '@/lib/build/gearSlots';
import { MAX_GEM_QUALITY, type GemLoadout, type GemState } from '@/lib/build/gemState';
import { MAX_SUPPORTS_PER_SKILL } from '@/lib/build/gemSlots';
import type { CatalogueGem } from './catalogue';
import type { PobGem, PobSkillGroup } from './parse';
import type { ReportEntry } from './report';

const BOTH_SETS: WeaponSet[] = [1, 2];

/** 'Metadata/Items/Gems/SupportGemMartialTempo' -> 'SupportGemMartialTempo'. PoB's own data has one 'Gem/' typo, so only the last segment is trusted. */
function gemKey(gemId: string | null): string | null {
  if (!gemId) return null;
  const last = gemId.split('/').pop();
  return last ? last : null;
}

function nameOf(gem: PobGem): string {
  return gem.nameSpec ?? gemKey(gem.gemId) ?? 'an unnamed gem';
}

function asItem(gem: CatalogueGem): GearItem {
  return { slug: gem.slug, name: gem.name, category: gem.category, isUnique: false, iconUrl: gem.iconUrl };
}

function dropped(message: string): ReportEntry {
  return { kind: 'dropped', area: 'gems', message };
}

export function mapGems(
  groups: PobSkillGroup[],
  mainSocketGroup: number | null,
  catalogue: Map<string, CatalogueGem>,
): { value: GemState; report: ReportEntry[] } {
  const loadouts: GemLoadout[] = [];
  const loadoutByGroup = new Map<number, string>();
  const report: ReportEntry[] = [];
  // PoB name -> current name, for gems imported under a different name. On
  // the real build this is 13 of 20: GGG renames gems between patches, and
  // even reused "Artillery Ballista" for a different gem. The id join imports
  // the right gem either way, but a user seeing unfamiliar names deserves to
  // know why.
  const renames: string[] = [];
  const noteRename = (gem: PobGem, found: CatalogueGem) => {
    if (gem.nameSpec && gem.nameSpec !== found.name) renames.push(`${gem.nameSpec} → ${found.name}`);
  };

  for (const group of groups) {
    if (group.gems.length === 0) continue; // a label row

    const [lead, ...rest] = group.gems;
    const leadName = nameOf(lead);

    if (!group.enabled) {
      report.push(dropped(`The skill group led by ${leadName} was disabled in Path of Building and was left out.`));
      continue;
    }
    if (!lead.enabled) {
      report.push(dropped(`${leadName} was disabled in Path of Building, so its skill group was left out.`));
      continue;
    }

    const leadGem = catalogue.get(gemKey(lead.gemId) ?? '');
    if (!leadGem) {
      report.push(dropped(`${leadName} is not in this patch's gem data, so its skill group was left out.`));
      continue;
    }
    if (leadGem.gemType === 'support') {
      report.push(
        dropped(`The skill group led by ${leadName} starts with a support gem, not a skill, so it was left out rather than guessed at.`),
      );
      continue;
    }

    // Level and quality belong to the skill gem in our model.
    let level = lead.level ?? 1;
    let quality = lead.quality ?? 0;
    if (lead.level === null || lead.quality === null) {
      report.push({
        kind: 'inferred',
        area: 'gems',
        message: `${leadName} had no level or quality in Path of Building; assumed level ${level}, quality ${quality}.`,
      });
    }
    if (level > leadGem.maxLevel) {
      report.push(dropped(`${leadName} was level ${level}; it caps at ${leadGem.maxLevel}, so it was imported at ${leadGem.maxLevel}.`));
      level = leadGem.maxLevel;
    }
    if (level < 1) level = 1;
    if (quality > MAX_GEM_QUALITY) {
      report.push(dropped(`${leadName} had ${quality}% quality; imported at ${MAX_GEM_QUALITY}%.`));
      quality = MAX_GEM_QUALITY;
    }

    const supports: GearItem[] = [];
    for (const gem of rest) {
      const name = nameOf(gem);
      if (!gem.enabled) {
        report.push(dropped(`${name} (supporting ${leadName}) was disabled in Path of Building and was left out.`));
        continue;
      }
      const found = catalogue.get(gemKey(gem.gemId) ?? '');
      if (!found) {
        report.push(dropped(`${name} (supporting ${leadName}) is not in this patch's gem data and was left out.`));
        continue;
      }
      if (found.gemType !== 'support') {
        report.push(dropped(`${name} is a second skill in ${leadName}'s group; a loadout holds one skill, so it was left out.`));
        continue;
      }
      if (supports.length >= MAX_SUPPORTS_PER_SKILL) {
        report.push(dropped(`${name} would be a ${supports.length + 1}th support on ${leadName}; the limit is ${MAX_SUPPORTS_PER_SKILL}, so it was left out.`));
        continue;
      }
      if ((gem.quality ?? 0) > 0) {
        report.push(dropped(`${name}'s ${gem.quality}% quality was not kept — support gems carry no quality in Project Vaal.`));
      }
      noteRename(gem, found);
      supports.push(asItem(found));
    }

    noteRename(lead, leadGem);
    const id = `pob-${group.index}`;
    loadoutByGroup.set(group.index, id);
    loadouts.push({ id, skill: asItem(leadGem), supports, sets: [...BOTH_SETS], level, quality });
  }

  if (renames.length > 0) {
    report.push({
      kind: 'note',
      area: 'gems',
      message:
        `${renames.length} gem(s) are known by a different name in the current game data. They are the same gems ` +
        `(matched by the game's own id), shown under today's names: ${renames.join('; ')}.`,
    });
  }

  let primaryId: string | null = null;
  if (mainSocketGroup !== null) {
    primaryId = loadoutByGroup.get(mainSocketGroup) ?? null;
    if (primaryId === null) {
      report.push({
        kind: 'note',
        area: 'gems',
        message: "Path of Building's main skill group was a label row or was left out, so no main skill is set.",
      });
    }
  }

  return { value: { loadouts, primaryId }, report };
}
