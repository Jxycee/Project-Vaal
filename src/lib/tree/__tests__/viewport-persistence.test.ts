import { describe, it, expect } from 'vitest';
import {
  clampScale,
  parseViewport,
  serializeViewport,
  MIN_SCALE,
  MAX_SCALE,
} from '../viewport-persistence';

describe('clampScale', () => {
  it('bounds within [MIN, MAX]', () => {
    expect(clampScale(999)).toBe(MAX_SCALE);
    expect(clampScale(0)).toBe(MIN_SCALE);
    expect(clampScale(1)).toBe(1);
  });
  it('rejects non-finite values → MIN', () => {
    expect(clampScale(NaN)).toBe(MIN_SCALE);
    expect(clampScale(Infinity)).toBe(MIN_SCALE);
  });
});

describe('parseViewport / serializeViewport', () => {
  it('round-trips (scale preserved, x/y rounded)', () => {
    expect(parseViewport(serializeViewport({ x: 12.7, y: -3.2, scale: 0.5 }))).toEqual({
      x: 13,
      y: -3,
      scale: 0.5,
    });
  });
  it('clamps an out-of-range stored scale', () => {
    expect(parseViewport('{"x":0,"y":0,"scale":999}')).toEqual({ x: 0, y: 0, scale: MAX_SCALE });
  });
  it('returns null for missing/empty input', () => {
    expect(parseViewport(null)).toBeNull();
    expect(parseViewport('')).toBeNull();
  });
  it('returns null for malformed JSON', () => {
    expect(parseViewport('{not json')).toBeNull();
  });
  it('returns null when fields are missing or non-numeric', () => {
    expect(parseViewport('{"x":0,"y":0}')).toBeNull();
    expect(parseViewport('{"x":"a","y":0,"scale":1}')).toBeNull();
  });
});
