import { describe, it, expect } from 'vitest'
import { toBuildAllocation, fromBuildAllocation, resolveClassId, type PassiveState } from './passiveState'

describe('toBuildAllocation', () => {
  it('marks a set1-only node with weaponSets[id] = 1', () => {
    const result = toBuildAllocation({ set1: [10], set2: [] })
    expect(result.allocated).toEqual([10])
    expect(result.weaponSets).toEqual({ 10: 1 })
  })

  it('marks a set2-only node with weaponSets[id] = 2', () => {
    const result = toBuildAllocation({ set1: [], set2: [20] })
    expect(result.allocated).toEqual([20])
    expect(result.weaponSets).toEqual({ 20: 2 })
  })

  it('gives a node in both sets no weaponSets entry (shared/basic)', () => {
    const result = toBuildAllocation({ set1: [30], set2: [30] })
    expect(result.allocated).toEqual([30])
    expect(result.weaponSets).toEqual({})
  })

  it('handles a mix of set-specific and shared nodes', () => {
    const result = toBuildAllocation({ set1: [1, 3], set2: [2, 3] })
    expect(new Set(result.allocated)).toEqual(new Set([1, 2, 3]))
    expect(result.weaponSets).toEqual({ 1: 1, 2: 2 })
  })

  it('handles the empty build', () => {
    expect(toBuildAllocation({ set1: [], set2: [] })).toEqual({ allocated: [], weaponSets: {} })
  })
})

describe('fromBuildAllocation', () => {
  it('puts a weaponSets[id] = 1 node into set1 only', () => {
    const result = fromBuildAllocation({ allocated: [10], weaponSets: { 10: 1 } })
    expect(result).toEqual({ set1: [10], set2: [] })
  })

  it('puts a weaponSets[id] = 2 node into set2 only', () => {
    const result = fromBuildAllocation({ allocated: [20], weaponSets: { 20: 2 } })
    expect(result).toEqual({ set1: [], set2: [20] })
  })

  it('puts a node with no weaponSets entry into both sets (shared/basic, including ascendancy nodes)', () => {
    const result = fromBuildAllocation({ allocated: [30], weaponSets: {} })
    expect(result).toEqual({ set1: [30], set2: [30] })
  })
})

describe('round-trip', () => {
  it('is lossless for a mixed allocation', () => {
    const original: PassiveState = { set1: [1, 3, 5], set2: [2, 3, 5] }
    const roundTripped = fromBuildAllocation(toBuildAllocation(original))
    expect(new Set(roundTripped.set1)).toEqual(new Set(original.set1))
    expect(new Set(roundTripped.set2)).toEqual(new Set(original.set2))
  })
})

describe('resolveClassId', () => {
  const classes = [{ name: 'Marauder' }, { name: 'Witch' }, { name: 'Ranger' }]

  it('resolves a class name to its array index', () => {
    expect(resolveClassId(classes, 'Witch')).toBe(1)
  })

  it('returns undefined for an unknown class name', () => {
    expect(resolveClassId(classes, 'Nonexistent')).toBeUndefined()
  })
})
