import { describe, it, expect } from 'vitest'
import { parseCreateBuildInput, parseUpdateBuildInput, BUILD_VISIBILITIES } from './validation'

describe('parseCreateBuildInput', () => {
  it('requires a non-empty name', () => {
    expect(parseCreateBuildInput({ class: 'Warrior' })).toEqual({ ok: false, error: 'name is required' })
    expect(parseCreateBuildInput({ name: '  ', class: 'Warrior' })).toEqual({ ok: false, error: 'name is required' })
  })

  it('requires a non-empty class', () => {
    expect(parseCreateBuildInput({ name: 'X' })).toEqual({ ok: false, error: 'class is required' })
  })

  it('rejects a non-object body', () => {
    expect(parseCreateBuildInput(null)).toEqual({ ok: false, error: 'Request body must be a JSON object' })
    expect(parseCreateBuildInput('x')).toEqual({ ok: false, error: 'Request body must be a JSON object' })
    expect(parseCreateBuildInput(['x'])).toEqual({ ok: false, error: 'Request body must be a JSON object' })
  })

  it('trims name and class, and accepts the minimal valid body', () => {
    const result = parseCreateBuildInput({ name: '  My Build  ', class: ' Warrior ' })
    expect(result).toEqual({ ok: true, data: { name: 'My Build', class: 'Warrior' } })
  })

  it('rejects a name over the length limit', () => {
    const result = parseCreateBuildInput({ name: 'x'.repeat(101), class: 'Warrior' })
    expect(result).toEqual({ ok: false, error: 'name must be 100 characters or fewer' })
  })

  it('rejects an out-of-range level', () => {
    expect(parseCreateBuildInput({ name: 'X', class: 'Warrior', level: 0 })).toEqual({
      ok: false,
      error: 'level must be an integer between 1 and 100',
    })
    expect(parseCreateBuildInput({ name: 'X', class: 'Warrior', level: 101 })).toEqual({
      ok: false,
      error: 'level must be an integer between 1 and 100',
    })
    expect(parseCreateBuildInput({ name: 'X', class: 'Warrior', level: 1.5 })).toEqual({
      ok: false,
      error: 'level must be an integer between 1 and 100',
    })
  })

  it('accepts a valid level', () => {
    const result = parseCreateBuildInput({ name: 'X', class: 'Warrior', level: 42 })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.level).toBe(42)
  })

  it.each(BUILD_VISIBILITIES)('accepts visibility %s', (visibility) => {
    const result = parseCreateBuildInput({ name: 'X', class: 'Warrior', visibility })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.visibility).toBe(visibility)
  })

  it('rejects an invalid visibility', () => {
    const result = parseCreateBuildInput({ name: 'X', class: 'Warrior', visibility: 'hidden' })
    expect(result).toEqual({ ok: false, error: `visibility must be one of: ${BUILD_VISIBILITIES.join(', ')}` })
  })

  it('rejects a non-object passive_state/gear_state/gem_state', () => {
    expect(parseCreateBuildInput({ name: 'X', class: 'Warrior', passive_state: 'nope' })).toEqual({
      ok: false,
      error: 'passive_state must be a JSON object',
    })
    expect(parseCreateBuildInput({ name: 'X', class: 'Warrior', gear_state: [] })).toEqual({
      ok: false,
      error: 'gear_state must be a JSON object',
    })
  })

  it('accepts valid state blobs', () => {
    const result = parseCreateBuildInput({
      name: 'X',
      class: 'Warrior',
      passive_state: { set1: [1, 2], set2: [] },
      gear_state: { head: null },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.passive_state).toEqual({ set1: [1, 2], set2: [] })
      expect(result.data.gear_state).toEqual({ head: null })
    }
  })

  it('derives main_skill from gem_state.slots[0].skill.name', () => {
    const result = parseCreateBuildInput({
      name: 'X',
      class: 'Warrior',
      gem_state: { slots: [{ skill: { name: 'Fireball' } }] },
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.main_skill).toBe('Fireball')
  })

  it('leaves main_skill undefined when gem_state has no usable slots[0].skill.name', () => {
    for (const gemState of [{}, { slots: [] }, { slots: [{}] }, { slots: [{ skill: {} }] }]) {
      const result = parseCreateBuildInput({ name: 'X', class: 'Warrior', gem_state: gemState })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.main_skill).toBeNull()
    }
  })

  it('does not accept a client-supplied main_skill directly', () => {
    // main_skill is derived, not trusted from the body — passing it bare
    // (no gem_state) should not surface it in the parsed output at all.
    const result = parseCreateBuildInput({ name: 'X', class: 'Warrior', main_skill: 'Fireball' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.main_skill).toBeUndefined()
  })

  it('rejects a character_id that is not a string or null', () => {
    const result = parseCreateBuildInput({ name: 'X', class: 'Warrior', character_id: 42 })
    expect(result).toEqual({ ok: false, error: 'character_id must be a string id or null' })
  })
})

describe('parseUpdateBuildInput', () => {
  it('allows an empty (no-op) update', () => {
    expect(parseUpdateBuildInput({})).toEqual({ ok: true, data: {} })
  })

  it('rejects an empty-string name on update', () => {
    expect(parseUpdateBuildInput({ name: '  ' })).toEqual({ ok: false, error: 'name must be a non-empty string' })
  })

  it('accepts a partial update', () => {
    const result = parseUpdateBuildInput({ level: 55 })
    expect(result).toEqual({ ok: true, data: { level: 55 } })
  })

  it('accepts a visibility transition', () => {
    const result = parseUpdateBuildInput({ visibility: 'public' })
    expect(result).toEqual({ ok: true, data: { visibility: 'public' } })
  })

  it('rejects an unknown-shaped body', () => {
    expect(parseUpdateBuildInput(null)).toEqual({ ok: false, error: 'Request body must be a JSON object' })
  })
})
