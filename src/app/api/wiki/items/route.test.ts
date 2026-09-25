import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getCachedUserMock = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCachedUser: () => getCachedUserMock(),
}));

const loadIndexMock = vi.fn();
vi.mock('@/lib/wiki/loadIndex', async () => {
  const actual = await vi.importActual<typeof import('@/lib/wiki/loadIndex')>('@/lib/wiki/loadIndex');
  return { ...actual, loadIndex: (...args: unknown[]) => loadIndexMock(...args) };
});

import { GET } from './route';

const AUTHED = { data: { user: { id: 'user-1' } }, error: null };

function entry(overrides: Partial<{ slug: string; name: string; category: string; isUniqueItem: boolean; tags: string[] }> = {}) {
  return {
    slug: overrides.slug ?? 'plain-helmet',
    name: overrides.name ?? 'Plain Helmet',
    kind: 'item' as const,
    category: overrides.category ?? 'Helmet',
    tags: overrides.tags ?? [],
    isUniqueItem: overrides.isUniqueItem ?? false,
  };
}

function req(query: string) {
  return new NextRequest(`http://localhost/api/wiki/items${query}`);
}

beforeEach(() => {
  getCachedUserMock.mockReset();
  loadIndexMock.mockReset();
  getCachedUserMock.mockResolvedValue(AUTHED);
  loadIndexMock.mockResolvedValue([]);
});

describe('GET /api/wiki/items', () => {
  it('serves the jewels pseudo-slot from the same route', async () => {
    loadIndexMock.mockResolvedValue([
      entry({ slug: 'a-jewel', category: 'Jewel' }),
      entry({ slug: 'a-helmet', category: 'Helmet' }),
    ]);

    const res = await GET(req('?slot=jewels'));
    const body = await res.json();

    expect(body.entries).toEqual([expect.objectContaining({ slug: 'a-jewel' })]);
  });

  it('honors a limit below the default when explicitly given', async () => {
    const many = Array.from({ length: 10 }, (_, i) => entry({ slug: `helm-${i}` }));
    loadIndexMock.mockResolvedValue(many);

    const res = await GET(req('?slot=head&limit=3'));
    const body = await res.json();

    expect(body.entries).toHaveLength(3);
    expect(body.total).toBe(10);
  });

  it('returns 500 when the index fails to load', async () => {
    loadIndexMock.mockRejectedValue(new Error('disk error'));

    const res = await GET(req('?slot=head'));

    expect(res.status).toBe(500);
  });
});
