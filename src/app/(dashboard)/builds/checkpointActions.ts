'use server';

// Server Functions for a build's leveling checkpoints.
//
// Kept apart from actions.ts, which owns the builds LIST (rename, delete,
// visibility, tags). These own the checkpoints WITHIN a build. Saving a
// checkpoint's tree, gear and gems is not here — that goes through
// POST /api/builds with the rest of a save.
//
// Same rules as actions.ts, for the same reason: a Server Function is
// reachable by a direct POST, not only through our UI
// (node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md).
// So every one re-checks the session, rejects a malformed id before it reaches
// Postgres, and answers "not yours" exactly as it answers "does not exist".
//
// Ownership: build_checkpoints has no user_id column, so RLS enforces it
// through the parent build (see the 20260923223254 migration). addCheckpoint
// additionally checks the parent build against the signed-in user before
// inserting, because an insert that RLS rejects surfaces as an error rather
// than as zero rows.
//
// refresh() rather than revalidatePath(): these are called from /tree, which
// is dynamic (it reads searchParams), so there is no cached render to
// invalidate — the client router needs to re-render the current page. Next 16
// allows refresh() only inside Server Actions, which is also why a save through
// POST /api/builds (a Route Handler) has to refresh from the client instead.
import { refresh } from 'next/cache';
import { createClient, getCachedUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/build/constants';
import type { Json } from '@/types/database';
import { cleanGearStateInput, cleanGemStateInput, cleanPassiveStateInput } from '@/lib/build/stateInput';
import type { ActionResult } from './actions';

// Identical to actions.ts's copy, deliberately: one "not found" for every
// case a caller could otherwise use to probe which ids exist.
// Typed as the failure branch specifically, not the whole ActionResult union,
// so it can be returned from addCheckpoint too, whose success carries an id.
const NOT_FOUND: { ok: false; error: string } = { ok: false, error: "Couldn't find that build." };

// Matches the build_checkpoints_name_length CHECK constraint (1..80).
const MAX_NAME_LENGTH = 80;

const EMPTY_PASSIVE_STATE = { set1: [], set2: [], ascendancyNodes: [] };

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function validateName(name: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return { ok: false, error: 'Name cannot be empty.' };
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` };
  }
  return { ok: true, name: trimmed };
}

/** The editor's in-memory tree, gear and gems — unsaved edits included. */
export interface CheckpointStateInput {
  passive_state: unknown;
  gear_state: unknown;
  gem_state: unknown;
}

/**
 * Appends a checkpoint to a build.
 *
 * With `state`, the new checkpoint starts as a copy of the editor as it is
 * right now, unsaved edits included — the usual case, since the next stage of
 * a build grows out of the one being edited. Copying the active checkpoint's
 * saved row instead (`copyFrom`) would silently leave those edits behind.
 * The state goes through the same write gate as POST /api/builds.
 *
 * With `copyFrom` (and no `state`), it copies that checkpoint's saved row.
 * With neither, the tree starts empty and gear and gems take the column
 * defaults.
 */
export async function addCheckpoint(
  buildId: string,
  name: string,
  level: number,
  copyFrom?: string,
  state?: CheckpointStateInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!isUuid(buildId)) return NOT_FOUND;
  if (copyFrom !== undefined && !isUuid(copyFrom)) return NOT_FOUND;

  let fromEditor: { passive_state: Json; gear_state: Json; gem_state: Json } | null = null;
  if (state !== undefined) {
    if (typeof state !== 'object' || state === null) return { ok: false, error: "Couldn't add that checkpoint." };
    const passive = cleanPassiveStateInput(state.passive_state);
    const gear = cleanGearStateInput(state.gear_state);
    const gem = cleanGemStateInput(state.gem_state);
    if (!passive.ok || !gear.ok || !gem.ok) return { ok: false, error: "Couldn't add that checkpoint." };
    fromEditor = {
      passive_state: passive.value as unknown as Json,
      gear_state: gear.value as unknown as Json,
      gem_state: gem.value as unknown as Json,
    };
  }

  const validName = validateName(name);
  if (!validName.ok) return validName;

  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 100) {
    return { ok: false, error: 'Level must be between 1 and 100.' };
  }

  const { data: userData } = await getCachedUser();
  if (!userData.user) return NOT_FOUND;

  const supabase = await createClient();

  // The permissive public-read policy on builds ("Public builds are readable
  // by anyone" live today; renamed "…by signed-in users" by the pending
  // migration in docs/superpowers/pending-migrations/) means a bare
  // .eq('id') could find someone else's public build; the user_id filter is
  // what makes this an ownership check rather than an existence check.
  const { data: owned, error: ownedError } = await supabase
    .from('builds')
    .select('id')
    .eq('id', buildId)
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (ownedError) {
    console.error('Failed to check build ownership:', ownedError);
    return { ok: false, error: "Couldn't add that checkpoint." };
  }
  if (!owned) return NOT_FOUND;

  // Scoped to this build: a checkpoint of another build is not a copy source,
  // even one of your own.
  let copied: { passive_state: Json; gear_state: Json; gem_state: Json } | null = fromEditor;
  if (copied === null && copyFrom !== undefined) {
    const { data: source, error: sourceError } = await supabase
      .from('build_checkpoints')
      .select('passive_state, gear_state, gem_state')
      .eq('id', copyFrom)
      .eq('build_id', buildId)
      .maybeSingle();
    if (sourceError) {
      console.error('Failed to read the checkpoint to copy:', sourceError);
      return { ok: false, error: "Couldn't add that checkpoint." };
    }
    if (!source) return NOT_FOUND;
    copied = source;
  }

  // max(position) + 1, never the count: after a middle checkpoint is deleted,
  // positions can be 0 and 2, and the count would collide with the 2.
  const { data: last, error: lastError } = await supabase
    .from('build_checkpoints')
    .select('position')
    .eq('build_id', buildId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) {
    console.error('Failed to read checkpoint positions:', lastError);
    return { ok: false, error: "Couldn't add that checkpoint." };
  }
  const position = last ? last.position + 1 : 0;

  const { data: inserted, error: insertError } = await supabase
    .from('build_checkpoints')
    .insert({
      build_id: buildId,
      position,
      name: validName.name,
      level,
      passive_state: (copied?.passive_state ?? EMPTY_PASSIVE_STATE) as Json,
      ...(copied ? { gear_state: copied.gear_state as Json, gem_state: copied.gem_state as Json } : {}),
    })
    .select('id')
    .single();

  if (insertError) {
    // 23505: two adds raced for the same position and the deferred unique
    // constraint rejected the second at commit. Nothing was written; a retry
    // reads the new max and succeeds.
    if ((insertError as { code?: string }).code === '23505') {
      return { ok: false, error: 'Another change landed at the same time. Try again.' };
    }
    console.error('Failed to add checkpoint:', insertError);
    return { ok: false, error: "Couldn't add that checkpoint." };
  }

  refresh();
  return { ok: true, id: inserted.id };
}

export async function renameCheckpoint(id: string, name: string): Promise<ActionResult> {
  if (!isUuid(id)) return NOT_FOUND;

  const validName = validateName(name);
  if (!validName.ok) return validName;

  const { data: userData } = await getCachedUser();
  if (!userData.user) return NOT_FOUND;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('build_checkpoints')
    .update({ name: validName.name })
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('Failed to rename checkpoint:', error);
    return { ok: false, error: "Couldn't rename that checkpoint." };
  }
  // Zero rows: it does not exist, or RLS's owner-only UPDATE policy hid it.
  if (!data || data.length === 0) return NOT_FOUND;

  refresh();
  return { ok: true };
}

export async function deleteCheckpoint(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return NOT_FOUND;

  const { data: userData } = await getCachedUser();
  if (!userData.user) return NOT_FOUND;

  const supabase = await createClient();
  const { data, error } = await supabase.from('build_checkpoints').delete().eq('id', id).select('id');

  if (error) {
    // 23514: the prevent_deleting_last_checkpoint trigger. A build always
    // keeps one checkpoint; the database enforces it, this just says so
    // in words a person can act on.
    if ((error as { code?: string }).code === '23514') {
      return { ok: false, error: 'A build must keep at least one checkpoint.' };
    }
    console.error('Failed to delete checkpoint:', error);
    return { ok: false, error: "Couldn't delete that checkpoint." };
  }
  if (!data || data.length === 0) return NOT_FOUND;

  refresh();
  return { ok: true };
}

/**
 * Sets a build's checkpoint order. `ids` must be every checkpoint of the build,
 * each exactly once, in the new order.
 *
 * Done by one database function call so the whole reorder is a single
 * transaction — the (build_id, position) uniqueness is deferred to commit, so
 * the intermediate states a reorder passes through are never checked. The
 * function also refuses a partial list, duplicates, an id from another build,
 * and a build the caller does not own.
 */
export async function reorderCheckpoints(buildId: string, ids: string[]): Promise<ActionResult> {
  if (!isUuid(buildId)) return NOT_FOUND;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(isUuid)) {
    return { ok: false, error: 'That order is not valid.' };
  }

  const { data: userData } = await getCachedUser();
  if (!userData.user) return NOT_FOUND;

  const supabase = await createClient();
  const { error } = await supabase.rpc('reorder_build_checkpoints', { p_build_id: buildId, p_ids: ids });

  if (error) {
    // 22023 covers every refusal the function makes, including "not your
    // build", so it deliberately gets one answer.
    if ((error as { code?: string }).code !== '22023') {
      console.error('Failed to reorder checkpoints:', error);
    }
    return { ok: false, error: 'That order is not valid.' };
  }

  refresh();
  return { ok: true };
}
