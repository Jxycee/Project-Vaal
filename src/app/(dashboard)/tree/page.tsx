// /tree — passive skill tree editor.
//
// Server Component. It awaits ?build=<uuid>, fetches and VERIFIES the row,
// and hands the result down as props. Nothing about the loaded build is
// client state any more, which is what makes the stale-state class of bug
// (this route survives soft navigation; PassiveTree seeds initialState
// exactly once) unreachable rather than merely defended against.
import { createClient, getCachedUser } from '@/lib/supabase/server';
import type { SavedBuild } from '@/lib/build/types';
import { UUID_RE } from '@/lib/build/constants';
import TreeEditor from '@/components/tree/TreeEditor';

export const metadata = { title: 'Passive tree' };

export default async function TreePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = params.build;
  const buildId = typeof raw === 'string' ? raw : undefined;

  let build: SavedBuild | null = null;
  let loadError: string | null = null;

  if (buildId) {
    if (!UUID_RE.test(buildId)) {
      loadError = 'That build could not be found.';
    } else {
      const supabase = await createClient();
      // Run alongside the row fetch (not after it) so confirming ownership
      // costs no extra latency over an RLS-only query.
      const [{ data: userData }, { data, error }] = await Promise.all([
        getCachedUser(),
        supabase.from('builds').select('*').eq('id', buildId).maybeSingle(),
      ]);
      if (error) {
        console.error('Failed to load build:', error);
        loadError = 'That build could not be found.';
      } else if (!data || data.user_id !== userData.user?.id) {
        // A row can come back that is NOT ours: the "Public builds are
        // readable by anyone" RLS policy is permissive and applies to role
        // `public`, which includes authenticated users. Postgres ORs it with
        // the owner policy. So ownership is checked here, on the server.
        //
        // This is a RELOCATION of the old in-component check, not a deletion
        // of it — removing it entirely would hydrate a stranger's build as
        // editable, with every Update 404ing. "Exists but not ours" and
        // "does not exist" deliberately produce the same message so the UI
        // cannot be used to probe which build ids exist.
        loadError = 'That build could not be found.';
      } else {
        build = data as unknown as SavedBuild;
      }
    }
  }

  // Scratch mode (no ?build=) makes zero database calls above — buildId is
  // undefined, so the `if (buildId)` block never runs.
  return <TreeEditor buildId={buildId} build={build} loadError={loadError} />;
}
