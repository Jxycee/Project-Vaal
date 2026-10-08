'use server';

// Server Function for exporting a build as a Path of Building 2 code.
//
// Same rules as importActions.ts: a Server Function is reachable by a direct
// POST, so it checks the session FIRST. It reads only what the caller's own
// session may read: an owner's select by id AND user_id through RLS, exactly
// the page's owner path (load.ts loadAsOwner). Nothing the client sends
// besides two ids is trusted, and no state arrives from the client at all, so
// there is no new write or access path. It exports the SAVED build; unsaved
// edits in the editor are not included (the UI says so).
//
// READERS: exportPobCodeByToken / exportGameBuildFileByToken take the share
// token instead of an id and authorise exactly like the build page, by calling
// the page's own loader (loadBuildForViewer: owner select first, else the
// share-token RPCs, which only answer for 'private' (link-shared) and 'public'
// builds; 'unlisted' is owner-only and answers nothing). Unknown token,
// malformed token, and a build the caller may not read all return the SAME
// not-found text, so the action is no oracle for a token's existence. They
// never write: countView is false, so even a public build's view count stays.
//
// The catalogue reads public/data through fs, so the route this action runs in
// must have those files traced into the deployment. It runs in the build page,
// /builds/[shareToken] (BuildSettings calls it), which the "/builds/*" key of
// outputFileTracingIncludes in next.config.ts covers; verified after a build by
// counting public/data entries in that route's page.js.nft.json (11,381).

import { loadBuildForViewer } from '@/app/(dashboard)/builds/[shareToken]/load';
import { UUID_RE } from '@/lib/build/constants';
import type { BuildCheckpoint } from '@/lib/build/checkpointState';
import { parseCheckpoints } from '@/lib/build/checkpointState';
import { parseGearState } from '@/lib/build/gearState';
import { parseGemState } from '@/lib/build/gemState';
import { getCatalogue } from '@/lib/pob/catalogue';
import { encodePobCode, exportPobXml, type ExportInput } from '@/lib/pob/export/exportBuild';
import { exportBuildFile, type BuildFile } from '@/lib/ggg/exportBuildFile';
import type { ReportEntry } from '@/lib/pob/report';
import { createClient, getCachedUser } from '@/lib/supabase/server';

export type ExportResult = { ok: true; code: string; report: ReportEntry[]; checkpointName: string } | { ok: false; error: string };

type Loaded = { ok: true; input: ExportInput; checkpointName: string } | { ok: false; error: string };

/** Everything either export reads: the caller's own saved build and its checkpoints, through RLS. */
async function loadExportInput(buildId: string, checkpointId: string | null): Promise<Loaded> {
  const { data: userData } = await getCachedUser();
  if (!userData.user) return { ok: false, error: 'Sign in to export a build.' };
  if (typeof buildId !== 'string' || !UUID_RE.test(buildId)) return { ok: false, error: "Couldn't export that build." };
  if (checkpointId !== null && (typeof checkpointId !== 'string' || !UUID_RE.test(checkpointId))) {
    return { ok: false, error: "Couldn't export that build." };
  }

  const supabase = await createClient();
  const { data: row, error } = await supabase.from('builds').select('*').eq('id', buildId).eq('user_id', userData.user.id).maybeSingle();
  if (error || !row) return { ok: false, error: "Couldn't find that build." };

  const { data: rows, error: checkpointsError } = await supabase.from('build_checkpoints').select('*').eq('build_id', buildId).order('position');
  if (checkpointsError) return { ok: false, error: "Couldn't load that build's checkpoints." };
  const checkpoints = parseCheckpoints(rows);
  if (checkpoints.length === 0) return { ok: false, error: 'This build has no checkpoints to export.' };

  return toExportInput(row, checkpoints, checkpointId);
}

/** The export input from a loaded build and its checkpoints; `checkpointId` (else the build's active one, else the first) picks the gear and gems PoB carries. */
function toExportInput(
  row: { name: string; class: string; ascendancy: string | null; level: number; notes: string | null; active_checkpoint_id: string | null },
  checkpoints: BuildCheckpoint[],
  checkpointId: string | null,
): Loaded {
  const requested = checkpointId ?? row.active_checkpoint_id;
  const found = checkpoints.findIndex((c) => c.id === requested);
  const activeIndex = found === -1 ? 0 : found;
  return {
    ok: true,
    checkpointName: checkpoints[activeIndex].name,
    input: {
      build: { name: row.name, class: row.class, ascendancy: row.ascendancy, level: row.level, notes: row.notes },
      checkpoints: checkpoints.map((c) => ({
        name: c.name,
        level: c.level,
        passive_state: c.passive_state,
        gear_state: parseGearState(c.gear_state),
        gem_state: parseGemState(c.gem_state),
      })),
      activeIndex,
    },
  };
}

const TOKEN_NOT_FOUND = "Couldn't find that build.";

/**
 * Everything either export reads, for whoever may READ the build behind a share
 * token: its owner, or any signed-in viewer when it is link-shared or public.
 * Same load as the page, same answer for every build the caller cannot see.
 */
async function loadExportInputByToken(shareToken: string, checkpointId: string | null): Promise<Loaded> {
  const { data: userData } = await getCachedUser();
  if (!userData.user) return { ok: false, error: 'Sign in to export a build.' };
  if (typeof shareToken !== 'string') return { ok: false, error: TOKEN_NOT_FOUND };
  if (checkpointId !== null && (typeof checkpointId !== 'string' || !UUID_RE.test(checkpointId))) {
    return { ok: false, error: "Couldn't export that build." };
  }
  const loaded = await loadBuildForViewer(shareToken, userData.user.id, { countView: false });
  if (!loaded) return { ok: false, error: TOKEN_NOT_FOUND };
  if (loaded.checkpoints.length === 0) return { ok: false, error: 'This build has no checkpoints to export.' };
  return toExportInput(loaded.row, loaded.checkpoints, checkpointId);
}

export async function exportPobCode(buildId: string, checkpointId: string | null): Promise<ExportResult> {
  const loaded = await loadExportInput(buildId, checkpointId);
  if (!loaded.ok) return loaded;
  const result = await exportPobXml(loaded.input, await getCatalogue());
  if (!result.ok) return result;
  return { ok: true, code: encodePobCode(result.xml), report: result.report, checkpointName: loaded.checkpointName };
}

export type BuildFileExportResult = { ok: true; file: BuildFile; report: ReportEntry[]; checkpointName: string } | { ok: false; error: string };

/** The same saved build as the game's own Build Planner file (.build). Same access rules as exportPobCode. */
export async function exportGameBuildFile(buildId: string, checkpointId: string | null): Promise<BuildFileExportResult> {
  const loaded = await loadExportInput(buildId, checkpointId);
  if (!loaded.ok) return loaded;
  const result = exportBuildFile(loaded.input, await getCatalogue());
  if (!result.ok) return result;
  return { ok: true, file: result.file, report: result.report, checkpointName: loaded.checkpointName };
}

/** exportPobCode for a reader: by share token, authorised like the build page. */
export async function exportPobCodeByToken(shareToken: string, checkpointId: string | null): Promise<ExportResult> {
  const loaded = await loadExportInputByToken(shareToken, checkpointId);
  if (!loaded.ok) return loaded;
  const result = await exportPobXml(loaded.input, await getCatalogue());
  if (!result.ok) return result;
  return { ok: true, code: encodePobCode(result.xml), report: result.report, checkpointName: loaded.checkpointName };
}

/** exportGameBuildFile for a reader: by share token, authorised like the build page. */
export async function exportGameBuildFileByToken(shareToken: string, checkpointId: string | null): Promise<BuildFileExportResult> {
  const loaded = await loadExportInputByToken(shareToken, checkpointId);
  if (!loaded.ok) return loaded;
  const result = exportBuildFile(loaded.input, await getCatalogue());
  if (!result.ok) return result;
  return { ok: true, file: result.file, report: result.report, checkpointName: loaded.checkpointName };
}
