import type { WeaponSetAllocation } from '@poe2-toolkit/tree-core';

/** Matches the CHECK constraint on public.builds.visibility. */
export type BuildVisibility = 'private' | 'unlisted' | 'public';

/**
 * The shape stored in builds.passive_state.
 *
 * A node tagged to neither weapon set (shared/basic) appears in BOTH set1 and
 * set2 — "in both" is how the storage format spells "untagged". The column
 * default omits ascendancyNodes, so every write must supply all three keys.
 */
export interface PassiveState {
  set1: number[];
  set2: number[];
  ascendancyNodes: number[];
}

/**
 * The editor's in-memory allocation, as PassiveTree reports it upward.
 *
 * Carries BOTH classId and className deliberately. classId is tree-core's
 * index and is meaningless without the normalized tree; className is what
 * builds.class stores. Reporting the name means the page never has to
 * normalize the tree export itself just to translate an index — PassiveTree
 * already holds the normalized data, so it does the mapping.
 */
export interface BuildEditorState {
  classId: number;
  className: string;
  ascendancyId: string | undefined;
  main: WeaponSetAllocation;
  ascendancyNodes: number[];
}

/**
 * What the page hands PassiveTree to hydrate a saved build. Keyed by class
 * NAME, not id, because that is what came out of the database.
 */
export interface PassiveTreeInitialState {
  className: string | undefined;
  ascendancyId: string | undefined;
  main: WeaponSetAllocation;
  ascendancyNodes: number[];
}

/** A build row as the save route returns it. */
export interface SavedBuild {
  id: string;
  name: string;
  class: string;
  ascendancy: string | null;
  level: number;
  league: string;
  visibility: BuildVisibility;
  share_token: string | null;
  game_version: string;
  passive_state: PassiveState;
  /**
   * Raw jsonb as it comes off the row — validate with
   * `parseGearState` (`@/lib/build/gearState`) before use, never trust it
   * directly. Untyped here (not `GearState`) because the column has no
   * shape guarantee the way `passive_state` gets from `isPassiveState` at
   * the API boundary; a hand-edited or pre-gear-feature row can hold
   * anything jsonb allows.
   */
  gear_state: unknown;
  updated_at: string;
}
