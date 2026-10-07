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
// The catalogue reads public/data through fs, so this route must have those
// files traced into the deployment: see outputFileTracingIncludes in
// next.config.ts, which the "/builds" entry covers because this action runs in
// the /builds route.

import { UUID_RE } from '@/lib/build/constants';
import { parseCheckpoints } from '@/lib/build/checkpointState';
import { parseGearState } from '@/lib/build/gearState';
import { parseGemState } from '@/lib/build/gemState';
import { getCatalogue } from '@/lib/pob/catalogue';
import { encodePobCode, exportPobXml } from '@/lib/pob/export/exportBuild';
import type { ReportEntry } from '@/lib/pob/report';
import { createClient, getCachedUser } from '@/lib/supabase/server';

export type ExportResult = { ok: true; code: string; report: ReportEntry[]; checkpointName: string } | { ok: false; error: string };

export async function exportPobCode(buildId: string, checkpointId: string | null): Promise<ExportResult> {
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

  const requested = checkpointId ?? row.active_checkpoint_id;
  const found = checkpoints.findIndex((c) => c.id === requested);
  const activeIndex = found === -1 ? 0 : found;

  const result = await exportPobXml(
    {
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
    await getCatalogue(),
  );
  if (!result.ok) return result;
  return { ok: true, code: encodePobCode(result.xml), report: result.report, checkpointName: checkpoints[activeIndex].name };
}
