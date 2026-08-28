import type { TablesInsert, TablesUpdate } from '@/types/database'

export const BUILD_VISIBILITIES = ['private', 'unlisted', 'public'] as const
export type BuildVisibility = (typeof BUILD_VISIBILITIES)[number]

const NAME_MAX = 100
const TEXT_MAX = 4000 // description / notes — generous, not a hard game-data limit

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function optionalTrimmedString(v: unknown, field: string, max: number): ParseResult<string | null | undefined> {
  if (v === undefined) return { ok: true, data: undefined }
  if (v === null) return { ok: true, data: null }
  if (typeof v !== 'string') return { ok: false, error: `${field} must be a string` }
  const trimmed = v.trim()
  if (trimmed.length > max) return { ok: false, error: `${field} must be ${max} characters or fewer` }
  return { ok: true, data: trimmed || null }
}

/**
 * Only the fields a client is ever allowed to set. Deliberately excludes
 * `id`/`user_id`/`share_token`/`view_count`/`forked_from*`/`created_at`/
 * `updated_at` — those are server-managed (see route handlers, which add
 * `user_id`/`share_token` themselves) or set only by the fork flow, never
 * by a plain create/update body.
 */
export function parseCreateBuildInput(
  body: unknown
): ParseResult<Omit<TablesInsert<'builds'>, 'user_id' | 'share_token'>> {
  if (!isPlainObject(body)) return { ok: false, error: 'Request body must be a JSON object' }

  if (typeof body.name !== 'string' || body.name.trim().length === 0) {
    return { ok: false, error: 'name is required' }
  }
  const name = body.name.trim()
  if (name.length > NAME_MAX) return { ok: false, error: `name must be ${NAME_MAX} characters or fewer` }

  if (typeof body.class !== 'string' || body.class.trim().length === 0) {
    return { ok: false, error: 'class is required' }
  }

  const shared = parseSharedFields(body)
  if (!shared.ok) return shared

  return {
    ok: true,
    data: {
      name,
      class: body.class.trim(),
      ...shared.data,
    },
  }
}

/**
 * Same field whitelist as create, all optional — a PATCH only touches what
 * it sends. `visibility` transitions (private -> unlisted/public and back)
 * go through this same path; there is no separate "publish" endpoint.
 */
export function parseUpdateBuildInput(body: unknown): ParseResult<TablesUpdate<'builds'>> {
  if (!isPlainObject(body)) return { ok: false, error: 'Request body must be a JSON object' }

  const data: TablesUpdate<'builds'> = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      return { ok: false, error: 'name must be a non-empty string' }
    }
    if (body.name.trim().length > NAME_MAX) return { ok: false, error: `name must be ${NAME_MAX} characters or fewer` }
    data.name = body.name.trim()
  }

  if (body.class !== undefined) {
    if (typeof body.class !== 'string' || body.class.trim().length === 0) {
      return { ok: false, error: 'class must be a non-empty string' }
    }
    data.class = body.class.trim()
  }

  const shared = parseSharedFields(body)
  if (!shared.ok) return shared

  return { ok: true, data: { ...data, ...shared.data } }
}

/** Fields both create and update accept, all optional in both contexts. */
function parseSharedFields(body: Record<string, unknown>): ParseResult<Partial<TablesInsert<'builds'>>> {
  const data: Partial<TablesInsert<'builds'>> = {}

  if (body.ascendancy !== undefined) {
    const r = optionalTrimmedString(body.ascendancy, 'ascendancy', NAME_MAX)
    if (!r.ok) return r
    data.ascendancy = r.data
  }

  if (body.description !== undefined) {
    const r = optionalTrimmedString(body.description, 'description', TEXT_MAX)
    if (!r.ok) return r
    data.description = r.data
  }

  if (body.notes !== undefined) {
    const r = optionalTrimmedString(body.notes, 'notes', TEXT_MAX)
    if (!r.ok) return r
    data.notes = r.data
  }

  if (body.league !== undefined) {
    if (typeof body.league !== 'string' || body.league.trim().length === 0) {
      return { ok: false, error: 'league must be a non-empty string' }
    }
    data.league = body.league.trim()
  }

  if (body.game_version !== undefined) {
    if (typeof body.game_version !== 'string' || body.game_version.trim().length === 0) {
      return { ok: false, error: 'game_version must be a non-empty string' }
    }
    data.game_version = body.game_version.trim()
  }

  if (body.level !== undefined) {
    if (typeof body.level !== 'number' || !Number.isInteger(body.level) || body.level < 1 || body.level > 100) {
      return { ok: false, error: 'level must be an integer between 1 and 100' }
    }
    data.level = body.level
  }

  if (body.visibility !== undefined) {
    if (typeof body.visibility !== 'string' || !BUILD_VISIBILITIES.includes(body.visibility as BuildVisibility)) {
      return { ok: false, error: `visibility must be one of: ${BUILD_VISIBILITIES.join(', ')}` }
    }
    data.visibility = body.visibility
  }

  if (body.character_id !== undefined) {
    if (body.character_id !== null && typeof body.character_id !== 'string') {
      return { ok: false, error: 'character_id must be a string id or null' }
    }
    data.character_id = body.character_id
  }

  // main_skill is intentionally NOT accepted here even though it's a plain
  // column: it's derived from gem_state at save time (research doc §9), not
  // client-supplied, so it's computed below alongside the state blobs rather
  // than trusted from the request body.
  for (const [field, key] of [
    ['passive_state', 'passive_state'],
    ['gear_state', 'gear_state'],
    ['gem_state', 'gem_state'],
  ] as const) {
    const v = body[field]
    if (v === undefined) continue
    if (!isPlainObject(v)) return { ok: false, error: `${field} must be a JSON object` }
    data[key] = v as never
  }

  if (typeof body.gem_state === 'object' && body.gem_state !== null) {
    data.main_skill = deriveMainSkill(body.gem_state)
  }

  return { ok: true, data }
}

/**
 * gem_state shape (console-hub-plan §6): `{ slots: [{ skill: { id, name, ... } }, ...] }`.
 * main_skill is denormalized purely for build-finder filtering (research doc
 * §9) — gem_state stays authoritative; a malformed/missing slots[0].skill
 * just means no main_skill this save, not a request error.
 */
function deriveMainSkill(gemState: unknown): string | null {
  if (!isPlainObject(gemState)) return null
  const slots = gemState.slots
  if (!Array.isArray(slots) || slots.length === 0) return null
  const first = slots[0]
  if (!isPlainObject(first)) return null
  const skill = first.skill
  if (!isPlainObject(skill)) return null
  const name = skill.name
  return typeof name === 'string' && name.trim() ? name.trim() : null
}
