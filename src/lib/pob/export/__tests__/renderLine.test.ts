// Failure modes for rendering one mod line from a display template + rolled
// values, written before renderLine exists. Each is a way export could emit a
// line PoB2 reads differently from what the user built:
//  1. a negative range "(-10--5)" is mis-split into two numbers
//  2. a decimal roll loses precision or gains float noise (0.1 + 0.2)
//  3. values fill ranges in the wrong order on a multi-range line
//  4. a value outside the range is written as-is instead of clamped
//  5. a line with no range is altered
//  6. fewer values than ranges leaves "(a-b)" text in the line (PoB would read it as a range at 50%)
import { describe, expect, it } from 'vitest';
import { renderLine } from '../renderLine';

describe('renderLine', () => {
  it('fills a single range', () => {
    expect(renderLine('+(30-50)% to Fire Resistance', [42])).toBe('+42% to Fire Resistance');
  });
  it('fills a negative range, both bounds negative', () => {
    expect(renderLine('(-10--5)% reduced Damage taken', [-7])).toBe('-7% reduced Damage taken');
  });
  it('fills a range that starts negative and ends positive', () => {
    expect(renderLine('(-5-10)% Something', [3])).toBe('3% Something');
  });
  it('keeps a decimal roll exact, without float noise', () => {
    expect(renderLine('+(0.1-0.9)% to Critical Hit Chance', [0.1 + 0.2])).toBe('+0.3% to Critical Hit Chance');
    expect(renderLine('+(3-5)% to Critical Hit Chance', [3.77])).toBe('+3.77% to Critical Hit Chance');
  });
  it('fills two ranges in order', () => {
    expect(renderLine('Adds (10-20) to (30-50) Physical Damage', [12, 44])).toBe('Adds 12 to 44 Physical Damage');
  });
  it('clamps a value outside its range, whichever way round the bounds are written', () => {
    expect(renderLine('+(30-50) to Life', [99])).toBe('+50 to Life');
    expect(renderLine('+(30-50) to Life', [1])).toBe('+30 to Life');
    expect(renderLine('(-10--5)% less', [-20])).toBe('-10% less');
  });
  it('leaves a rangeless line untouched', () => {
    expect(renderLine('Grenade Skills Fire an additional Projectile', [])).toBe('Grenade Skills Fire an additional Projectile');
    expect(renderLine('50% of Physical Damage taken as Fire Damage', [5])).toBe('50% of Physical Damage taken as Fire Damage');
  });
  it('uses the best roll for a range with no value supplied, never leaving "(a-b)" behind', () => {
    const line = renderLine('Adds (10-20) to (30-50) Physical Damage', [12]);
    expect(line).not.toMatch(/\(\d+-\d+\)/);
    expect(line).toBe('Adds 12 to 50 Physical Damage');
  });
});
