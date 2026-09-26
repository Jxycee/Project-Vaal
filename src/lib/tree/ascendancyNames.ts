/**
 * The display label for a build's class + ascendancy, for list rows and
 * headers that should read "Infernalist", never "Witch1".
 *
 * `builds.ascendancy` can hold two vocabularies (verified 2026-09-26):
 * - the tree editor saves tree-core's normalized ascendancy id, which IS the
 *   display name ("Infernalist");
 * - the PoB importer saved GGG's raw id ("Witch1") until 2026-09-26. It now
 *   saves the editor's id (src/lib/pob/mapBuild.ts), but a row imported
 *   before that, on any database, still carries the raw one.
 * This reads both.
 *
 * A static table rather than a read of the 5.1MB tree export: every caller is
 * a list or header that otherwise needs no tree data, and the dashboard and
 * shared page are not traced for public/data (next.config.ts). The
 * `ascendancyNames.test.ts` guard fails if this drifts from the vendored
 * export, so a tree update cannot silently bring raw ids back.
 */

/** Raw GGG ascendancy id -> display name, from public/data/tree/0.5.2/data.json `classes[].ascendancies`. `null` where GGG ships no name (unreleased). */
const RAW_ID_NAMES = new Map<string, string | null>([
  ['Witch1', 'Infernalist'],
  ['Witch2', 'Blood Mage'],
  ['Witch3', 'Lich'],
  ['Witch3b', 'Abyssal Lich'],
  ['Ranger1', 'Deadeye'],
  ['Ranger2', null],
  ['Ranger3', 'Pathfinder'],
  ['Warrior1', 'Titan'],
  ['Warrior2', 'Warbringer'],
  ['Warrior3', 'Smith of Kitava'],
  ['Sorceress1', 'Stormweaver'],
  ['Sorceress2', 'Chronomancer'],
  ['Sorceress3', 'Disciple of Varashta'],
  ['Huntress1', 'Amazon'],
  ['Huntress2', 'Spirit Walker'],
  ['Huntress3', 'Ritualist'],
  ['Mercenary1', 'Tactician'],
  ['Mercenary2', 'Witchhunter'],
  ['Mercenary3', 'Gemling Legionnaire'],
  ['Monk1', 'Martial Artist'],
  ['Monk2', 'Invoker'],
  ['Monk3', 'Acolyte of Chayula'],
  ['Druid1', 'Oracle'],
  ['Druid2', 'Shaman'],
  ['Druid3', null],
]);

/**
 * The ascendancy's display name, or the class name when there is none (or
 * GGG has not named it). A value neither vocabulary knows — a name saved by
 * an editor on a newer tree — is shown as stored.
 */
export function ascendancyLabel(className: string, ascendancy: string | null | undefined): string {
  if (!ascendancy) return className;
  if (!RAW_ID_NAMES.has(ascendancy)) return ascendancy;
  return RAW_ID_NAMES.get(ascendancy) ?? className;
}
