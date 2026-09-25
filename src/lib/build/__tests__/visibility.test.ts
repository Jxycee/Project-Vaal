import { describe, it, expect } from 'vitest';
import { isBuildVisibility, BUILD_VISIBILITIES } from '@/lib/build/visibility';
import { SHARE_TOKEN_RE, UUID_RE } from '@/lib/build/constants';

describe('isBuildVisibility', () => {
  it('accepts the three live CHECK constraint values', () => {
    for (const v of BUILD_VISIBILITIES) {
      expect(isBuildVisibility(v)).toBe(true);
    }
  });

  it('rejects an empty string', () => {
    expect(isBuildVisibility('')).toBe(false);
  });

  it('rejects a wrong-case value', () => {
    expect(isBuildVisibility('Public')).toBe(false);
  });

  it('rejects a value the CHECK constraint would also reject', () => {
    expect(isBuildVisibility('deleted')).toBe(false);
  });
});

describe('SHARE_TOKEN_RE', () => {
  it('accepts a real 21-char nanoid shape', () => {
    expect(SHARE_TOKEN_RE.test('V1StGXR8_Z5jdHi6B-myT')).toBe(true);
  });

  it('rejects a UUID', () => {
    expect(SHARE_TOKEN_RE.test('123e4567-e89b-12d3-a456-426614174000')).toBe(false);
    expect(UUID_RE.test('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });

  it('rejects 20 characters', () => {
    expect(SHARE_TOKEN_RE.test('a'.repeat(20))).toBe(false);
  });

  it('rejects 22 characters', () => {
    expect(SHARE_TOKEN_RE.test('a'.repeat(22))).toBe(false);
  });

  it('rejects a + or /', () => {
    expect(SHARE_TOKEN_RE.test('a'.repeat(20) + '+')).toBe(false);
    expect(SHARE_TOKEN_RE.test('a'.repeat(20) + '/')).toBe(false);
  });
});
