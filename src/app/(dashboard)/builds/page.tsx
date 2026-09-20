// /builds — the signed-in user's own builds.
//
// Server Component. /builds is deliberately NOT in PROTECTED_PREFIXES
// (src/proxy.ts) — it is public, because the public build finder lands here
// later. So a signed-out visitor still gets a real page: the "Sign in to see
// your saved builds" block below, never a redirect.
import Link from 'next/link';
import { createClient, getCachedUser } from '@/lib/supabase/server';
import type { SavedBuild } from '@/lib/build/types';
import MyBuildsList from '@/components/builds/MyBuildsList';
import { renameBuild, deleteBuild } from './actions';

export const metadata = { title: 'Builds' };

export default async function BuildsPage() {
  const { data: userData } = await getCachedUser();
  const user = userData.user;

  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Your builds</h1>
        <div className="py-10 text-center">
          <p className="text-sm text-muted-foreground">Sign in to see your saved builds.</p>
          <Link href="/login" className="mt-2 inline-block text-sm underline">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  // .eq('user_id', ...) is DISPLAY SCOPING, not the security boundary: the
  // "Public builds are readable by anyone" RLS policy is a permissive SELECT
  // policy for role `public`, which includes authenticated users, and
  // Postgres OR's it together with the owner policy. Without this filter, a
  // bare select would return this user's rows PLUS every other user's public
  // builds, rendered here with Rename/Delete controls that would silently
  // hit zero rows for anything not actually owned. RLS is still what
  // enforces every write (see actions.ts) — this filter only keeps
  // strangers' builds off a page headed "Your builds".
  const { data, error } = await supabase
    .from('builds')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  const builds = error ? null : ((data ?? []) as unknown as SavedBuild[]);
  const loadError = error ? "Couldn't load your builds." : null;
  if (error) {
    console.error('Failed to load builds:', error);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Your builds</h1>
      <MyBuildsList
        builds={builds}
        loadError={loadError}
        renameAction={renameBuild}
        deleteAction={deleteBuild}
      />
    </div>
  );
}
