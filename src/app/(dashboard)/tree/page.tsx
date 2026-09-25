// /tree — passive skill tree editor.
//
// Server Component. It awaits ?build=<uuid>, fetches and VERIFIES the row,
// and hands the result down as props. Nothing about the loaded build is
// client state any more, which is what makes the stale-state class of bug
// (this route survives soft navigation; PassiveTree seeds initialState
// exactly once) unreachable rather than merely defended against.
//
// Checkpoints follow the same rule. The build's checkpoints are fetched here,
// and the one being edited is chosen by ?checkpoint=<uuid> — so switching
// checkpoint is a navigation the server answers with fresh rows, never a piece
// of client state that could outlive a save. (Holding the list client-side
// would mean: save checkpoint A, switch to B, switch back, and A re-seeds from
// the stale props it was first given.)
import { createClient, getCachedUser } from '@/lib/supabase/server';
import type { SavedBuild } from '@/lib/build/types';
import { UUID_RE } from '@/lib/build/constants';
import { parseCheckpoints, type BuildCheckpoint } from '@/lib/build/checkpointState';
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
  // An unknown or malformed ?checkpoint= is not an error: activeCheckpoint
  // (checkpointState.ts) falls back to the first checkpoint, which is also the
  // ordinary case right after the active one is deleted.
  const checkpointParam = typeof params.checkpoint === 'string' ? params.checkpoint : null;

  let build: SavedBuild | null = null;
  let checkpoints: BuildCheckpoint[] = [];
  let loadError: string | null = null;

  if (buildId) {
    if (!UUID_RE.test(buildId)) {
      loadError = 'That build could not be found.';
    } else {
      const supabase = await createClient();
      // All three alongside each other so neither the ownership check nor the
      // checkpoints add latency over an RLS-only row fetch.
      const [{ data: userData }, { data, error }, { data: checkpointRows, error: checkpointError }] =
        await Promise.all([
          getCachedUser(),
          supabase.from('builds').select('*').eq('id', buildId).maybeSingle(),
          supabase.from('build_checkpoints').select('*').eq('build_id', buildId).order('position'),
        ]);
      if (error) {
        console.error('Failed to load build:', error);
        loadError = 'That build could not be found.';
      } else if (!data || data.user_id !== userData.user?.id) {
        // A row can come back that is NOT ours: the "Public builds are
        // readable by signed-in users" RLS policy is permissive and applies to
        // role `authenticated`, which this user has. Postgres ORs it with
        // the owner policy. So ownership is checked here, on the server.
        //
        // This is a RELOCATION of the old in-component check, not a deletion
        // of it — removing it entirely would hydrate a stranger's build as
        // editable, with every Update 404ing. "Exists but not ours" and
        // "does not exist" deliberately produce the same message so the UI
        // cannot be used to probe which build ids exist.
        //
        // The checkpoints fetched alongside are discarded with it: the
        // checkpoints' own read policy would also have returned a stranger's
        // PUBLIC build's rows.
        loadError = 'That build could not be found.';
      } else {
        build = data as unknown as SavedBuild;
        if (checkpointError) {
          // Degrade rather than fail: the builds row mirrors the checkpoint
          // last saved, so the editor still opens on real data, and a save
          // without a checkpoint_id resolves by POST /api/builds' "exactly one
          // checkpoint" rule. What is lost is the checkpoint list itself.
          console.error('Failed to load checkpoints:', checkpointError);
        } else {
          checkpoints = parseCheckpoints(checkpointRows);
        }
      }
    }
  }

  // Scratch mode (no ?build=) makes zero database calls above — buildId is
  // undefined, so the `if (buildId)` block never runs.
  return (
    <TreeEditor
      buildId={buildId}
      build={build}
      checkpoints={checkpoints}
      checkpointParam={checkpointParam}
      loadError={loadError}
    />
  );
}
