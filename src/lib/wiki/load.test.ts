import { describe, it, expect } from 'vitest';
import { loadDetail } from './load';

describe('loadDetail', () => {
  it('returns null for an unknown slug instead of throwing', async () => {
    expect(await loadDetail('skill', 'not-a-real-gem')).toBeNull();
  });
  it('rejects a path-traversal slug', async () => {
    expect(await loadDetail('skill', '../../../etc/passwd')).toBeNull();
  });
  it('rejects a path-traversal slug in an item lookup too', async () => {
    expect(await loadDetail('item', '..%2f..%2fetc')).toBeNull();
  });
});
