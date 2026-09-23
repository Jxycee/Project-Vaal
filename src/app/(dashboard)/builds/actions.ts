'use server';

// Server Functions for the builds list.
//
// These are reachable by a direct POST, not only through our UI, so every one
// of them re-verifies the session itself — the page's auth check protects the
// page, not these. (node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md,
// the WARNING block: "Server Functions are reachable via direct POST
// requests, not just through your application's UI. Always verify
// authentication and authorization inside every Server Function.")
//
// The .eq('user_id', ...) filters are defence in depth: RLS's owner policy is
// what actually enforces the write, but the permissive "Public builds are
// readable by anyone" policy (role `public`, which includes authenticated
// users) means a bare .eq('id', ...) is never something to reason about
// casually here — see the comment in builds/page.tsx.
import { revalidatePath } from 'next/cache';
import { createClient, getCachedUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/build/constants';
import { isBuildVisibility } from '@/lib/build/visibility';
import { normalizeTag, MAX_TAGS_PER_BUILD } from '@/lib/build/tags';
import type { BuildVisibility } from '@/lib/build/types';

export type ActionResult = { ok: true } | { ok: false; error: string };

// The same "not found" copy for a missing row and a row that exists but
// isn't ours — matching /tree's reasoning: the message must not let a
// caller distinguish "no such build" from "that build belongs to someone
// else" by probing ids.
const NOT_FOUND: ActionResult = { ok: false, error: "Couldn't find that build." };

// builds.name has no CHECK constraint in the schema, so this cap is ours to
// impose rather than the database's.
const MAX_NAME_LENGTH = 80;

export async function renameBuild(id: string, name: string): Promise<ActionResult> {
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    return NOT_FOUND;
  }

  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) {
    return { ok: false, error: 'Name cannot be empty.' };
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` };
  }

  const { data: userData } = await getCachedUser();
  if (!userData.user) {
    return NOT_FOUND;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('builds')
    .update({ name: trimmed })
    .eq('id', id)
    .eq('user_id', userData.user.id)
    .select('id');

  if (error) {
    console.error('Failed to rename build:', error);
    return { ok: false, error: "Couldn't rename that build." };
  }
  if (!data || data.length === 0) {
    // Zero rows: either the id doesn't exist, or it exists but the
    // .eq('user_id', ...) above excluded it because it isn't ours.
    return NOT_FOUND;
  }

  revalidatePath('/builds');
  return { ok: true };
}

export async function deleteBuild(id: string): Promise<ActionResult> {
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    return NOT_FOUND;
  }

  const { data: userData } = await getCachedUser();
  if (!userData.user) {
    return NOT_FOUND;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('builds')
    .delete()
    .eq('id', id)
    .eq('user_id', userData.user.id)
    .select('id');

  if (error) {
    console.error('Failed to delete build:', error);
    return { ok: false, error: "Couldn't delete that build." };
  }
  if (!data || data.length === 0) {
    return NOT_FOUND;
  }

  revalidatePath('/builds');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Task 4 — sharing. Same shape as renameBuild/deleteBuild above: re-verify
// the session, keep the .eq('user_id', ...) defence-in-depth filter, return
// the same NOT_FOUND copy for "doesn't exist" and "exists but isn't ours".
// ---------------------------------------------------------------------------

export async function setBuildVisibility(id: string, visibility: string): Promise<ActionResult> {
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    return NOT_FOUND;
  }
  // Validate even though the CHECK constraint would reject a bad value too —
  // a raw constraint-violation 500 is a worse experience than our own
  // message, and this action is reachable by direct POST.
  if (typeof visibility !== 'string' || !isBuildVisibility(visibility)) {
    return { ok: false, error: 'Not a valid visibility.' };
  }
  const nextVisibility: BuildVisibility = visibility;

  const { data: userData } = await getCachedUser();
  if (!userData.user) {
    return NOT_FOUND;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('builds')
    .update({ visibility: nextVisibility })
    .eq('id', id)
    .eq('user_id', userData.user.id)
    .select('id');

  if (error) {
    console.error('Failed to set build visibility:', error);
    return { ok: false, error: "Couldn't update that build's visibility." };
  }
  if (!data || data.length === 0) {
    return NOT_FOUND;
  }

  revalidatePath('/builds');
  return { ok: true };
}

export async function addBuildTag(buildId: string, raw: string): Promise<ActionResult> {
  if (typeof buildId !== 'string' || !UUID_RE.test(buildId)) {
    return NOT_FOUND;
  }
  const tag = typeof raw === 'string' ? normalizeTag(raw) : null;
  if (tag === null) {
    return { ok: false, error: 'Tags must be 1-32 characters.' };
  }

  const { data: userData } = await getCachedUser();
  if (!userData.user) {
    return NOT_FOUND;
  }

  const supabase = await createClient();

  // Confirmed ownership up front so a build that isn't ours (or doesn't
  // exist) gets the same NOT_FOUND copy every other action here uses,
  // instead of surfacing build_tags' INSERT policy's RLS violation as a raw
  // error. The policy itself (EXISTS ... b.user_id = auth.uid()) is still
  // what actually enforces this — this check only shapes the error message.
  const { data: buildRow, error: buildError } = await supabase
    .from('builds')
    .select('id')
    .eq('id', buildId)
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (buildError) {
    console.error('Failed to look up build for addBuildTag:', buildError);
    return NOT_FOUND;
  }
  if (!buildRow) {
    return NOT_FOUND;
  }

  // MAX_TAGS_PER_BUILD is ours, not the database's — build_tags has no
  // row-count constraint, so this count-then-refuse is the only thing
  // enforcing the cap. Not perfectly race-free against a second concurrent
  // add, but that only risks one tag over the cap, never an unbounded list.
  const { count, error: countError } = await supabase
    .from('build_tags')
    .select('tag', { count: 'exact', head: true })
    .eq('build_id', buildId);
  if (countError) {
    console.error('Failed to count build tags:', countError);
    return { ok: false, error: "Couldn't add that tag." };
  }
  if ((count ?? 0) >= MAX_TAGS_PER_BUILD) {
    return { ok: false, error: `A build can carry at most ${MAX_TAGS_PER_BUILD} tags.` };
  }

  const { error } = await supabase.from('build_tags').insert({ build_id: buildId, tag });
  if (error) {
    // 23505 = unique_violation: a duplicate insert hits the PK (build_id,
    // tag). Treat it as success — idempotent, not an error — the tag the
    // caller wanted is already there.
    if (error.code === '23505') {
      revalidatePath('/builds');
      return { ok: true };
    }
    console.error('Failed to add build tag:', error);
    return { ok: false, error: "Couldn't add that tag." };
  }

  revalidatePath('/builds');
  return { ok: true };
}

export async function removeBuildTag(buildId: string, tag: string): Promise<ActionResult> {
  if (typeof buildId !== 'string' || !UUID_RE.test(buildId)) {
    return NOT_FOUND;
  }
  if (typeof tag !== 'string' || tag.length === 0) {
    return { ok: false, error: 'Not a valid tag.' };
  }

  const { data: userData } = await getCachedUser();
  if (!userData.user) {
    return NOT_FOUND;
  }

  const supabase = await createClient();
  // There is NO UPDATE policy on build_tags (verified against pg_policies) —
  // editing a tag is delete + insert, never an update. This function only
  // ever deletes. Ownership is enforced by build_tags' own DELETE policy: a
  // delete against a tag/build that isn't ours affects zero rows under RLS
  // rather than erroring, which is why this doesn't need its own NOT_FOUND
  // branch — "already gone" and "was never yours" look identical, and that's
  // fine for a delete.
  const { error } = await supabase.from('build_tags').delete().eq('build_id', buildId).eq('tag', tag);

  if (error) {
    console.error('Failed to remove build tag:', error);
    return { ok: false, error: "Couldn't remove that tag." };
  }

  revalidatePath('/builds');
  return { ok: true };
}

// `toggleBuildBookmark` used to live here and was removed 2026-09-23: nothing
// in the app ever called it (verified by grep over src/ and e2e/), while a
// Server Function is reachable by direct POST regardless. No bookmarks UI is
// planned through the convergence slices.
//
// The `build_bookmarks` table and both its policies are untouched, so wiring
// a UI later needs no migration. If you do: its RLS is a single ALL policy,
// `auth.uid() = user_id`, with NO visibility check on the build itself — a
// caller can bookmark any build id they guess, private ones included. They
// still cannot read it back through this, but scope the toggle to a build id
// the session actually resolved rather than trusting the argument.
