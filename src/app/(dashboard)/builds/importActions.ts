'use server';

// Server Functions for importing a Path of Building 2 build.
//
// Same rules as actions.ts and checkpointActions.ts: a Server Function is
// reachable by a direct POST, not only through our UI
// (node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md),
// so each checks the session FIRST — a signed-out caller gets nothing
// fetched, decoded or written.
//
// previewPobImport runs the whole pipeline (source -> decode -> parse -> map)
// and writes nothing. importPobBuild runs the same pipeline again from the
// raw input rather than trusting anything a client sends back, passes every
// checkpoint's state through the same write gate as POST /api/builds, and
// writes the build and all its checkpoints in one import_build call (see
// supabase/migrations/20260925010117_import_build.sql), so an import is
// either whole or absent.

import { nanoid } from 'nanoid';
import { refresh } from 'next/cache';
import { GAME_VERSION, MAX_BUILD_NAME_LENGTH } from '@/lib/build/constants';
import { deriveMainSkill } from '@/lib/build/gemState';
import { cleanGearStateInput, cleanGemStateInput, cleanPassiveStateInput } from '@/lib/build/stateInput';
import { getCatalogue } from '@/lib/pob/catalogue';
import { decodePobCode, type DecodeError } from '@/lib/pob/decode';
import { mapBuild, type ImportPlan } from '@/lib/pob/mapBuild';
import { parsePobXml } from '@/lib/pob/parse';
import type { ReportEntry } from '@/lib/pob/report';
import { MAX_CODE_BYTES, resolvePobInput } from '@/lib/pob/source';
import { createClient, getCachedUser } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

// The builds_name_length CHECK constraint's bound, shared with POST /api/builds.
const MAX_NAME_LENGTH = MAX_BUILD_NAME_LENGTH;

const SIGNED_OUT: { ok: false; error: string } = { ok: false, error: 'Sign in to import a build.' };

const DECODE_ERRORS: Record<DecodeError, string> = {
  empty: 'Paste a Path of Building 2 code or link first.',
  'not-base64': 'That could not be read as a Path of Building code.',
  'not-zlib': 'That could not be read as a Path of Building code.',
  'too-large': 'That build is too large to import.',
  'not-pob2':
    'That is not a Path of Building 2 build. Path of Building 1 (Path of Exile 1) builds cannot be imported.',
};

export interface ImportSummary {
  name: string;
  className: string;
  /** Display name, e.g. 'Witchhunter'; null when the build has none (or it was dropped). */
  ascendancy: string | null;
  level: number;
  checkpoints: Array<{ name: string; level: number; passives: number; ascendancyPassives: number }>;
  skills: number;
  gems: number;
  items: number;
  jewels: number;
}

export type PreviewResult = { ok: true; summary: ImportSummary; report: ReportEntry[] } | { ok: false; error: string };

type Pipeline = { ok: true; plan: ImportPlan; ascendancyName: string | null } | { ok: false; error: string };

async function runPipeline(input: unknown, name: string | undefined): Promise<Pipeline> {
  if (typeof input !== 'string') return { ok: false, error: DECODE_ERRORS.empty };
  if (input.length > MAX_CODE_BYTES) return { ok: false, error: DECODE_ERRORS['too-large'] };

  const source = await resolvePobInput(input);
  if (!source.ok) return source;

  const decoded = decodePobCode(source.code);
  if (!decoded.ok) return { ok: false, error: DECODE_ERRORS[decoded.error] };

  const parsed = parsePobXml(decoded.xml);
  if (!parsed.ok) return { ok: false, error: 'That build could not be read.' };

  const mapped = await mapBuild(parsed.build, await getCatalogue(), { name });
  if (!mapped.ok) return mapped;
  return {
    ok: true,
    plan: mapped.plan,
    ascendancyName: mapped.plan.build.ascendancy ? parsed.build.ascendClassName : null,
  };
}

function summarise(plan: ImportPlan, ascendancyName: string | null): ImportSummary {
  const first = plan.checkpoints[0];
  const loadouts = first.gem_state.loadouts;
  return {
    name: plan.build.name,
    className: plan.build.class,
    ascendancy: ascendancyName,
    level: plan.build.level,
    checkpoints: plan.checkpoints.map((c) => ({
      name: c.name,
      level: c.level,
      passives: new Set([...c.passive_state.set1, ...c.passive_state.set2]).size,
      ascendancyPassives: c.passive_state.ascendancyNodes.length,
    })),
    skills: loadouts.filter((l) => l.skill !== null).length,
    gems: loadouts.reduce((n, l) => n + (l.skill ? 1 : 0) + l.supports.length, 0),
    items: Object.entries(first.gear_state).filter(([key, item]) => key !== 'jewels' && item !== null).length,
    jewels: Object.keys(first.gear_state.jewels).length,
  };
}

/** Decodes, maps and reports on a build without writing anything. */
export async function previewPobImport(input: string): Promise<PreviewResult> {
  const { data: userData } = await getCachedUser();
  if (!userData.user) return SIGNED_OUT;

  const result = await runPipeline(input, undefined);
  if (!result.ok) return result;
  return { ok: true, summary: summarise(result.plan, result.ascendancyName), report: result.plan.report };
}

/** Imports a build as a new, owner-only build. Never overwrites an existing one. */
export async function importPobBuild(
  input: string,
  name?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: userData } = await getCachedUser();
  if (!userData.user) return SIGNED_OUT;

  if (name !== undefined) {
    if (typeof name !== 'string') return { ok: false, error: 'Name must be text.' };
    if (name.trim().length > MAX_NAME_LENGTH) {
      return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` };
    }
  }

  const result = await runPipeline(input, name);
  if (!result.ok) return result;
  const { build, checkpoints } = result.plan;

  // The same gate as POST /api/builds. The mappers are built to pass it, so
  // a refusal here is a bug in them — which is exactly when nothing may be
  // written.
  const gated: Array<{ name: string; level: number; passive_state: Json; gear_state: Json; gem_state: Json }> = [];
  for (const checkpoint of checkpoints) {
    const passive = cleanPassiveStateInput(checkpoint.passive_state);
    const gear = cleanGearStateInput(checkpoint.gear_state);
    const gem = cleanGemStateInput(checkpoint.gem_state);
    if (!passive.ok || !gear.ok || !gem.ok) {
      console.error('PoB import produced state the write gate refused', { checkpoint: checkpoint.name });
      return { ok: false, error: "Couldn't import that build." };
    }
    gated.push({
      name: checkpoint.name,
      level: checkpoint.level,
      passive_state: passive.value as unknown as Json,
      gear_state: gear.value as unknown as Json,
      gem_state: gem.value as unknown as Json,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('import_build', {
    p_build: {
      name: build.name,
      class: build.class,
      ascendancy: build.ascendancy,
      level: build.level,
      notes: build.notes,
      main_skill: deriveMainSkill(checkpoints[checkpoints.length - 1].gem_state),
      share_token: nanoid(),
      game_version: GAME_VERSION,
    },
    p_checkpoints: gated,
  });

  if (error || typeof data !== 'string') {
    console.error('import_build failed:', error);
    return { ok: false, error: "Couldn't import that build." };
  }

  refresh();
  return { ok: true, id: data };
}
