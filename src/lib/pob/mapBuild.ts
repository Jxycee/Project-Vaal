// src/lib/pob/mapBuild.ts
// =============================================================================
// A parsed PoB build -> everything an import writes: the build row's fields,
// its ordered checkpoints, and the report of what did not come across.
//
// Pure apart from the catalogue's icon lookups. Composes mapTree, mapGems,
// mapItems and mapJewels; the rules of its own (see the Slice 2 plan's
// design decisions):
//
// - A class our tree does not have refuses the whole import: a tree cannot
//   be placed on it. An ascendancy that is not that class's is dropped and
//   reported, and the build imports without one.
// - One checkpoint per PoB spec, in spec order, named by its title with
//   PoB's colour codes stripped. Position 0 is the first spec, so the build
//   opens on its earliest stage; PoB's activeSpec is reported, not used.
// - A checkpoint's level comes from its title — a number marked as the level
//   ("lvl 40", "Nivel 37"), else the first 1–100 number that is not an act
//   number — else the build's level; an untitled tree always takes the
//   build's level. PoB stores no per-spec level, so every one is reported as
//   inferred.
// - PoB holds one item set and one skill set, so every checkpoint gets the
//   same gear and gems — each its own copy — and the report says so. Jewels
//   are socketed per spec in PoB but live in gear here, so they come from
//   the spec PoB was showing, reported.
// =============================================================================

import { MAX_NOTES_LENGTH } from '@/lib/build/constants';
import type { GearState } from '@/lib/build/gearState';
import type { GemState } from '@/lib/build/gemState';
import type { PassiveState } from '@/lib/build/types';
import type { Catalogue } from './catalogue';
import { mapGems } from './mapGems';
import { mapItems, mapJewels } from './mapItems';
import { mapTree } from './mapTree';
import type { PobBuild } from './parse';
import type { ReportEntry } from './report';

/** Matches the build_checkpoints_name_length CHECK constraint (1..80). */
const MAX_CHECKPOINT_NAME_LENGTH = 80;

export interface ImportCheckpoint {
  name: string;
  level: number;
  passive_state: PassiveState;
  gear_state: GearState;
  gem_state: GemState;
}

export interface ImportPlan {
  build: { name: string; class: string; ascendancy: string | null; level: number; notes: string | null };
  /** In order; index 0 becomes position 0. Never empty. */
  checkpoints: ImportCheckpoint[];
  report: ReportEntry[];
}

export type MapBuildResult = { ok: true; plan: ImportPlan } | { ok: false; error: string };

/** PoB colour codes: ^0–^9 and ^xRRGGBB. */
function stripColourCodes(text: string): string {
  return text.replace(/\^(?:x[0-9A-Fa-f]{6}|\d)/g, '');
}

function clampLevel(level: number): number {
  return Math.min(100, Math.max(1, Math.trunc(level)));
}

/** "lvl 40", "Level 68", "Nivel 37", "Lv.45" — a number a word marks as the level. */
const LEVEL_NUMBER = /\b(?:level|lvl|lv|nivel|niveau|livello|stufe|poziom)\.?\s*(\d{1,3})\b/i;
/** Text ending in an act word: the number after it is an act, not a level ("Act 3", "Acto 2"). */
const ENDS_WITH_ACT = /\b(?:act|acto|atto|acte|akt|ato)\s*$/i;

/**
 * The level a checkpoint title names. A number marked as the level wins;
 * otherwise the first 1–100 number that is not an act number. Titles like
 * "Act 3 - lvl 40" used to read as level 3.
 */
function levelInTitle(title: string): number | null {
  const marked = LEVEL_NUMBER.exec(title);
  if (marked) {
    const n = Number(marked[1]);
    if (n >= 1 && n <= 100) return n;
  }
  for (const match of title.matchAll(/\d+/g)) {
    const n = Number(match[0]);
    if (n >= 1 && n <= 100 && !ENDS_WITH_ACT.test(title.slice(0, match.index))) return n;
  }
  return null;
}

export async function mapBuild(pob: PobBuild, catalogue: Catalogue, options: { name?: string }): Promise<MapBuildResult> {
  const { tree } = catalogue;
  if (!pob.className || !tree.hasClass(pob.className)) {
    return {
      ok: false,
      error: pob.className
        ? `This build's class, ${pob.className}, is not in this patch's passive tree, so it cannot be imported.`
        : 'This build names no class, so it cannot be imported.',
    };
  }
  const report: ReportEntry[] = [];

  let ascendancyId: string | null = null;
  let ascendancyName: string | null = null;
  if (pob.ascendClassName && pob.ascendClassName !== 'None') {
    ascendancyId = tree.ascendancyIdFor(pob.className, pob.ascendClassName);
    if (ascendancyId) {
      ascendancyName = pob.ascendClassName;
    } else {
      report.push({
        kind: 'dropped',
        area: 'build',
        message: `The ascendancy ${pob.ascendClassName} is not a ${pob.className} ascendancy in this patch, so the build was imported without one.`,
      });
    }
  }

  let buildLevel = 1;
  if (pob.level === null) {
    report.push({ kind: 'inferred', area: 'build', message: 'Path of Building gave no character level; level 1 was assumed.' });
  } else {
    buildLevel = clampLevel(pob.level);
    if (buildLevel !== pob.level) {
      report.push({ kind: 'dropped', area: 'build', message: `Level ${pob.level} is outside 1–100; imported as ${buildLevel}.` });
    }
  }

  // Shared across every checkpoint: PoB stores one item set and one skill set.
  const gems = mapGems(pob.skillGroups, pob.mainSocketGroup, catalogue.gems);
  const gear = await mapItems(pob.items, pob.slots, catalogue.items);
  const shownSpec =
    pob.activeSpec !== null && pob.activeSpec >= 1 && pob.activeSpec <= pob.specs.length ? pob.activeSpec : pob.specs.length;
  const jewels =
    shownSpec > 0
      ? await mapJewels(pob.specs[shownSpec - 1].jewelSockets, pob.items, catalogue.items, tree)
      : { value: {}, report: [] };
  const gearState: GearState = { ...gear.value, jewels: jewels.value };

  const checkpoints: ImportCheckpoint[] = [];
  const copy = () => ({ gear_state: structuredClone(gearState), gem_state: structuredClone(gems.value) });

  if (pob.specs.length === 0) {
    report.push({
      kind: 'note',
      area: 'tree',
      message: `Path of Building had no passive tree, so the build has one checkpoint, Level ${buildLevel}, with no passives allocated.`,
    });
    checkpoints.push({ name: `Level ${buildLevel}`, level: buildLevel, passive_state: { set1: [], set2: [], ascendancyNodes: [] }, ...copy() });
  }

  pob.specs.forEach((spec, i) => {
    const number = i + 1;
    let name = stripColourCodes(spec.title).replace(/\s+/g, ' ').trim();
    // PoB omits the title of a tree nobody named. Its fallback name is ours,
    // so it must never be read for a level: "Checkpoint 1" once made a
    // level-94 import level 1.
    const titled = name !== '';
    if (!titled) name = `Checkpoint ${number}`;
    if (name.length > MAX_CHECKPOINT_NAME_LENGTH) {
      report.push({
        kind: 'dropped',
        area: 'tree',
        checkpoint: number,
        message: `Checkpoint ${number}'s name was cut to ${MAX_CHECKPOINT_NAME_LENGTH} characters.`,
      });
      name = name.slice(0, MAX_CHECKPOINT_NAME_LENGTH);
    }

    const fromTitle = titled ? levelInTitle(name) : null;
    const level = fromTitle ?? buildLevel;
    report.push({
      kind: 'inferred',
      area: 'tree',
      checkpoint: number,
      message:
        fromTitle !== null
          ? `"${name}" is level ${level}, read from its title.`
          : `"${name}" has no level in its title, so it uses the build's level, ${level}.`,
    });

    // By graph, not id: Abyssal Lich owns no nodes and uses Lich's.
    const passive = mapTree(spec, ascendancyId && tree.graphOf(ascendancyId), tree, number);
    report.push(...passive.report);
    checkpoints.push({ name, level, passive_state: passive.value, ...copy() });
  });

  report.push(...gems.report, ...gear.report, ...jewels.report);

  if (pob.specs.length > 1) {
    report.push({
      kind: 'note',
      area: 'build',
      message: `Path of Building stores one set of gear and one set of skill gems for the whole build, so all ${pob.specs.length} checkpoints start with the same gear and gems.`,
    });
    if (Object.keys(jewels.value).length > 0) {
      report.push({
        kind: 'note',
        area: 'items',
        message: `Jewels are socketed per tree in Path of Building but are part of gear here, so every checkpoint has the jewels from "${checkpoints[shownSpec - 1].name}".`,
      });
    }
    if (shownSpec !== 1) {
      report.push({
        kind: 'note',
        area: 'build',
        message: `Path of Building was showing "${checkpoints[shownSpec - 1].name}"; the imported build opens on its first checkpoint, "${checkpoints[0].name}".`,
      });
    }
  }

  let notes: string | null = pob.notes === null ? null : stripColourCodes(pob.notes).trim();
  if (notes !== null && notes.length > MAX_NOTES_LENGTH) {
    report.push({
      kind: 'dropped',
      area: 'notes',
      message: `The notes were ${notes.length} characters; the first ${MAX_NOTES_LENGTH} were kept.`,
    });
    notes = notes.slice(0, MAX_NOTES_LENGTH);
  }
  if (!notes) notes = null;

  const name = options.name?.trim() || `${ascendancyName ?? pob.className} — imported`;

  return {
    ok: true,
    plan: {
      // Stored as the editor stores it: tree-core's normalized ascendancy id,
      // which is the display name ("Witchhunter"). GGG's raw id
      // ("Mercenary2") is only for matching tree nodes (mapTree above); stored,
      // the editor found no ascendancy by it and opened the build without one.
      build: { name, class: pob.className, ascendancy: ascendancyName, level: buildLevel, notes },
      checkpoints,
      report,
    },
  };
}
