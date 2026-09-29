'use server';

// Server Function behind the dashboard's username control.
//
// This is the ONLY writer of user_profiles.display_name: migration
// 20260929121949 revoked the browser roles' UPDATE on that column (a direct
// write would skip the word filter below). It writes with the service role,
// scoped to the verified session's own id. The database still enforces the
// format CHECK, the case-insensitive uniqueness and the once-per-7-days rule
// (a trigger, which applies to the service role too), so those are mapped back
// to messages here rather than re-implemented.
//
// Reachable by a direct POST, so it re-verifies the session itself and trusts
// nothing from the client except the name string.
import { revalidatePath } from 'next/cache';
import { createServiceClient, getCachedUser } from '@/lib/supabase/server';
import { USERNAME_FORMAT_ERROR, validateUsername } from '@/lib/profile/username';

export type SetUsernameResult =
  | { ok: true; name: string }
  | {
      ok: false;
      error: string;
      /** Set when the weekly limit blocked the change: the next allowed time, UTC ISO. */
      nextChangeAt?: string;
    };

const NOT_SIGNED_IN = 'Sign in again to change your username.';
const TAKEN = 'That username is taken.';
const GENERIC = "Couldn't save your username. Try again.";

// Supabase's PostgrestError as far as we use it.
interface DbError {
  code?: string;
  message?: string;
  details?: string | null;
}

function formatUtcDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? 'later this week'
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function mapUsernameDbError(error: DbError): SetUsernameResult {
  if (error.code === '23505') return { ok: false, error: TAKEN };
  if (error.code === '23514') return { ok: false, error: USERNAME_FORMAT_ERROR };
  if (error.code === 'P0001' && error.message === 'display_name_rate_limited') {
    const iso = error.details && !Number.isNaN(new Date(error.details).getTime()) ? error.details : undefined;
    return {
      ok: false,
      error: iso
        ? `You can change your username again on ${formatUtcDate(iso)}.`
        : 'You can only change your username once a week.',
      nextChangeAt: iso,
    };
  }
  return { ok: false, error: GENERIC };
}

export async function setUsername(name: string): Promise<SetUsernameResult> {
  const checked = validateUsername(name);
  if (!checked.ok) return { ok: false, error: checked.error };

  const { data: userData } = await getCachedUser();
  const user = userData.user;
  if (!user) return { ok: false, error: NOT_SIGNED_IN };

  const service = createServiceClient();
  const { data, error } = await service
    .from('user_profiles')
    .update({ display_name: checked.value })
    .eq('id', user.id)
    .select('id');

  if (error) {
    const mapped = mapUsernameDbError(error);
    if (mapped.ok === false && mapped.error === GENERIC) console.error('Failed to set username:', error);
    return mapped;
  }
  if (!data || data.length === 0) {
    console.error('Failed to set username: no user_profiles row for the signed-in user');
    return { ok: false, error: GENERIC };
  }

  revalidatePath('/dashboard');
  return { ok: true, name: checked.value };
}
