// src/app/api/builds/route.ts
// =============================================================================
// POST /api/builds – authenticated build upsert.
//
// The first user-triggered write route in this repo. Uses the cookie-scoped
// createClient() so RLS applies: ownership is enforced by the "Owners can do
// everything with their builds" policy, never by comparing user_id here. An
// update for someone else's build simply matches zero rows.
//
// Saves go through a route (rather than direct from the client, as renames and
// deletes do) for exactly one reason: share_token must be minted server-side.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createClient } from '@/lib/supabase/server';
import { GAME_VERSION, MAX_NOTES_LENGTH, UUID_RE } from '@/lib/build/constants';
import type { PassiveState } from '@/lib/build/types';
import type { Database, Json } from '@/types/database';

interface SaveBuildBody {
  id?: unknown;
  /**
   * Which checkpoint this save's tree/gear/gems belong to. Only meaningful on
   * an update — a new build's first checkpoint is created by the database
   * (the create_initial_build_checkpoint trigger), not by the caller.
   */
  checkpoint_id?: unknown;
  name?: unknown;
  class?: unknown;
  ascendancy?: unknown;
  level?: unknown;
  league?: unknown;
  main_skill?: unknown;
  passive_state?: PassiveState;
  gear_state?: Record<string, unknown>;
  gem_state?: Record<string, unknown>;
  notes?: unknown;
}

type BuildUpdate = Database['public']['Tables']['builds']['Update'];

function isFiniteNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((n) => typeof n === 'number' && Number.isFinite(n));
}

function isPassiveState(value: unknown): value is PassiveState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    isFiniteNumberArray(v.set1) && isFiniteNumberArray(v.set2) && isFiniteNumberArray(v.ascendancyNodes)
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // A JSON body of null, a number, a string, or an array all pass the
  // try/catch above (they're valid JSON) but aren't a request we can read
  // fields off of — reject them with a 400 instead of letting `body.name`
  // throw further down and surface as a generic 500.
  if (typeof parsedBody !== 'object' || parsedBody === null || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const body = parsedBody as SaveBuildBody;

  if (body.id !== undefined && typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Invalid build id' }, { status: 400 });
  }

  // A string that is not a UUID answers 404, the same as a real id that is
  // not yours — matching builds/actions.ts, which returns NOT_FOUND for the
  // same case. Passing it through let Postgres reject the cast, which surfaced
  // as a 500 and was the one entry point that told the two cases apart.
  if (typeof body.id === 'string' && !UUID_RE.test(body.id)) {
    return NextResponse.json({ error: 'Build not found' }, { status: 404 });
  }

  if (body.checkpoint_id !== undefined) {
    if (body.id === undefined) {
      return NextResponse.json(
        { error: 'checkpoint_id is only valid when updating a build' },
        { status: 400 },
      );
    }
    if (typeof body.checkpoint_id !== 'string' || !UUID_RE.test(body.checkpoint_id)) {
      return NextResponse.json({ error: 'Build not found' }, { status: 404 });
    }
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const className = typeof body.class === 'string' ? body.class.trim() : '';
  if (!className) {
    return NextResponse.json({ error: 'Class is required' }, { status: 400 });
  }

  const level = typeof body.level === 'number' ? Math.trunc(body.level) : 1;
  if (level < 1 || level > 100) {
    return NextResponse.json({ error: 'Level must be between 1 and 100' }, { status: 400 });
  }

  if (body.passive_state !== undefined && !isPassiveState(body.passive_state)) {
    return NextResponse.json({ error: 'Malformed passive_state' }, { status: 400 });
  }

  // Free-text build notes -> builds.notes. Trimmed, capped at
  // MAX_NOTES_LENGTH (the column itself has no CHECK constraint — see that
  // constant's doc comment). An empty/whitespace-only string is stored as
  // null, not '', so "no notes" reads the same way whether the column was
  // never touched or was explicitly cleared.
  let notes: string | null = null;
  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string') {
      return NextResponse.json({ error: 'Invalid notes' }, { status: 400 });
    }
    const trimmed = body.notes.trim();
    if (trimmed.length > MAX_NOTES_LENGTH) {
      return NextResponse.json({ error: `Notes must be ${MAX_NOTES_LENGTH} characters or fewer` }, { status: 400 });
    }
    notes = trimmed.length > 0 ? trimmed : null;
  }

  // Always written in full – the column default omits ascendancyNodes.
  const passive_state: PassiveState = body.passive_state ?? {
    set1: [],
    set2: [],
    ascendancyNodes: [],
  };

  // Fields every save (insert or update) always writes in full — the caller
  // always supplies these via BuildSavePanel/handleSave, so omission is not
  // meaningful for them the way it is for gear/gem/main_skill below.
  const shared = {
    name,
    class: className,
    ascendancy: typeof body.ascendancy === 'string' ? body.ascendancy : null,
    level,
    league: typeof body.league === 'string' && body.league.trim() ? body.league.trim() : 'Standard',
    passive_state: passive_state as unknown as Json,
    game_version: GAME_VERSION,
  };

  if (body.id) {
    // --- Which checkpoint does this save belong to? -------------------------
    // Named explicitly when the client sends checkpoint_id. When it does not
    // — the pre-checkpoint client, or any caller that only knows about builds
    // — the answer must be deterministic rather than a guess: a build with
    // exactly one checkpoint is unambiguous, one with several is an error.
    // Without this rule those saves would update the build row alone, and
    // the mirror would silently drift away from the checkpoint it mirrors.
    let checkpointId: string;
    if (typeof body.checkpoint_id === 'string') {
      checkpointId = body.checkpoint_id;
    } else {
      const { data: rows, error: listError } = await supabase
        .from('build_checkpoints')
        .select('id')
        .eq('build_id', body.id);

      if (listError) {
        console.error('Failed to list checkpoints:', listError);
        return NextResponse.json({ error: 'Could not save this build.' }, { status: 500 });
      }
      if (!rows || rows.length === 0) {
        // Every build has at least one (the create_initial_build_checkpoint
        // trigger guarantees it), so seeing none means RLS is hiding the
        // build. Same answer as any other not-yours case.
        return NextResponse.json({ error: 'Build not found' }, { status: 404 });
      }
      if (rows.length > 1) {
        return NextResponse.json(
          { error: 'checkpoint_id is required when a build has more than one checkpoint' },
          { status: 400 },
        );
      }
      checkpointId = rows[0].id;
    }

    // --- Write the checkpoint FIRST ------------------------------------------
    // The checkpoint is the source of truth and the builds row is a mirror of
    // it. Writing the checkpoint first means a failure here leaves nothing
    // written at all; the reverse order could leave the mirror ahead of the
    // thing it mirrors.
    //
    // Scoped by build_id as well as id. RLS alone would allow a save for one
    // of your builds to overwrite a checkpoint belonging to another of your
    // builds, because you own both.
    //
    // Same conditional-write discipline as the build row below: gear and gems
    // are written only when the body carried them.
    const checkpointPayload = {
      passive_state: passive_state as unknown as Json,
      level,
      ...('gear_state' in body ? { gear_state: body.gear_state as unknown as Json } : {}),
      ...('gem_state' in body ? { gem_state: body.gem_state as unknown as Json } : {}),
    };

    const { data: checkpoint, error: checkpointError } = await supabase
      .from('build_checkpoints')
      .update(checkpointPayload)
      .eq('id', checkpointId)
      .eq('build_id', body.id)
      .select()
      .maybeSingle();

    if (checkpointError) {
      console.error('Failed to update checkpoint:', checkpointError);
      return NextResponse.json({ error: 'Could not save this build.' }, { status: 500 });
    }
    if (!checkpoint) {
      // A checkpoint of some other build, one already deleted, or not ours.
      // Deliberately the same answer, and nothing has been written.
      return NextResponse.json({ error: 'Build not found' }, { status: 404 });
    }

    // On update, gear_state/gem_state/main_skill are included only when the
    // request body actually sent that key. Task 1 never sends them, so
    // defaulting them to {}/{}/null unconditionally is harmless today — but
    // once gear/gem editors exist, any save that omits them (because it was
    // only touching, say, the tree) would silently wipe whatever was there.
    // The insert path below keeps unconditional defaults: a new row
    // genuinely starts empty.
    const updatePayload: BuildUpdate = {
      ...shared,
      ...('gear_state' in body ? { gear_state: body.gear_state as unknown as Json } : {}),
      ...('gem_state' in body ? { gem_state: body.gem_state as unknown as Json } : {}),
      ...('main_skill' in body
        ? { main_skill: typeof body.main_skill === 'string' ? body.main_skill : null }
        : {}),
      // Same conditional-write discipline: a save that never sent `notes`
      // (an older client, or a future save path that only touches the tree)
      // must not wipe whatever notes are already on the row.
      ...('notes' in body ? { notes } : {}),
    };

    const { data, error } = await supabase
      .from('builds')
      .update(updatePayload)
      .eq('id', body.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Failed to update build:', error);
      return NextResponse.json({ error: 'Could not save this build.' }, { status: 500 });
    }
    if (!data) {
      // RLS matched nothing: either it does not exist or it is not ours.
      // Deliberately indistinguishable – do not leak other users' build ids.
      return NextResponse.json({ error: 'Build not found' }, { status: 404 });
    }
    return NextResponse.json({ build: data, checkpoint });
  }

  const { data, error } = await supabase
    .from('builds')
    .insert({
      ...shared,
      main_skill: typeof body.main_skill === 'string' ? body.main_skill : null,
      gear_state: (body.gear_state ?? {}) as unknown as Json,
      gem_state: (body.gem_state ?? {}) as unknown as Json,
      notes,
      user_id: user.id,
      share_token: nanoid(),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create build:', error);
    return NextResponse.json({ error: 'Could not save this build.' }, { status: 500 });
  }

  // The create_initial_build_checkpoint trigger has already created
  // checkpoint 0 inside the same transaction as the insert. Read it back so
  // the client has its id for the next save, rather than making it ask.
  const { data: checkpoint, error: checkpointError } = await supabase
    .from('build_checkpoints')
    .select()
    .eq('build_id', data.id)
    .order('position')
    .limit(1)
    .maybeSingle();

  if (checkpointError) {
    // The build and its checkpoint WERE written; only this read failed.
    // Reporting 500 would tell the user their save was lost when it was not,
    // and a retry would create a duplicate build. Return success with a null
    // checkpoint — the next save resolves it by the one-checkpoint rule.
    console.error('Build saved, but its first checkpoint could not be read back:', checkpointError);
    return NextResponse.json({ build: data, checkpoint: null });
  }
  return NextResponse.json({ build: data, checkpoint });
}
