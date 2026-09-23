import type { WeaponSetAllocation } from '@poe2-toolkit/tree-core';
import type { Database } from '@/types/database';

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
  /**
   * Raw jsonb as it comes off the row — validate with `parseGemState`
   * (`@/lib/build/gemState`) before use, never trust it directly. Same
   * reasoning as `gear_state` above.
   */
  gem_state: unknown;
  /** The primary loadout's skill name (see `deriveMainSkill`), or null if no loadout has a skill yet. */
  main_skill: string | null;
  updated_at: string;
}

/**
 * A row exactly as `get_build_by_share_token` returns it — the SETOF shape
 * the generated types carry, not `SavedBuild`. Wider than `SavedBuild`
 * (carries `view_count`, `visibility` as `string` rather than
 * `BuildVisibility`, plus columns `SavedBuild` never needed — `description`,
 * `notes`, `forked_from*`, `character_id`) because this is the live `builds`
 * row shape, and `SavedBuild` was hand-narrowed for the editor's needs before
 * those columns existed. Never construct one by hand — it only ever comes
 * from the RPC's own result.
 */
export type SharedBuildRow = Database['public']['Functions']['get_build_by_share_token']['Returns'][number];

/** One row of the Public tab's finder — named columns only, never `passive_state`/`gear_state`/`gem_state` (see finder query comment in builds/page.tsx). */
export interface PublicBuildRow {
  id: string;
  name: string;
  class: string;
  ascendancy: string | null;
  level: number;
  league: string;
  main_skill: string | null;
  share_token: string | null;
  view_count: number;
  updated_at: string;
}
