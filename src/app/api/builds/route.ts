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
import { GAME_VERSION } from '@/lib/build/constants';
import type { PassiveState } from '@/lib/build/types';
import type { Database, Json } from '@/types/database';

interface SaveBuildBody {
  id?: unknown;
  name?: unknown;
  class?: unknown;
  ascendancy?: unknown;
  level?: unknown;
  league?: unknown;
  main_skill?: unknown;
  passive_state?: PassiveState;
  gear_state?: Record<string, unknown>;
  gem_state?: Record<string, unknown>;
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
    return NextResponse.json({ build: data });
  }

  const { data, error } = await supabase
    .from('builds')
    .insert({
      ...shared,
      main_skill: typeof body.main_skill === 'string' ? body.main_skill : null,
      gear_state: (body.gear_state ?? {}) as unknown as Json,
      gem_state: (body.gem_state ?? {}) as unknown as Json,
      user_id: user.id,
      share_token: nanoid(),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create build:', error);
    return NextResponse.json({ error: 'Could not save this build.' }, { status: 500 });
  }
  return NextResponse.json({ build: data });
}
