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
