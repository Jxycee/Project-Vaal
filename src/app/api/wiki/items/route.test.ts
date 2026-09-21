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
const ANONYMOUS = { data: { user: null }, error: null };

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
  it('returns 401 and no data when signed out', async () => {
    getCachedUserMock.mockResolvedValue(ANONYMOUS);
    loadIndexMock.mockResolvedValue([entry()]);

    const res = await GET(req('?slot=head'));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when slot is missing', async () => {
    const res = await GET(req(''));
    expect(res.status).toBe(400);
  });

  it('returns 400 for an unknown slot', async () => {
    const res = await GET(req('?slot=not-a-slot'));
    expect(res.status).toBe(400);
  });

  it('rejects a caller trying to pass a raw category string as slot', async () => {
    const res = await GET(req('?slot=Currency'));
    expect(res.status).toBe(400);
  });

  it('filters the index down to the slot categories', async () => {
    loadIndexMock.mockResolvedValue([
      entry({ slug: 'helm-1', category: 'Helmet' }),
      entry({ slug: 'boot-1', category: 'Boots' }),
    ]);

    const res = await GET(req('?slot=head'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toEqual([expect.objectContaining({ slug: 'helm-1' })]);
    expect(body.total).toBe(1);
  });

  it('includes Talisman results for weapon1_main (regression: 2026-09-20 defect)', async () => {
    loadIndexMock.mockResolvedValue([
      entry({ slug: 'a-talisman', category: 'Talisman' }),
      entry({ slug: 'a-ring', category: 'Ring' }),
    ]);

    const res = await GET(req('?slot=weapon1_main'));
    const body = await res.json();

    expect(body.entries.map((e: { slug: string }) => e.slug)).toEqual(['a-talisman']);
  });

  it('includes Focii results for weapon1_off (regression: 2026-09-20 defect)', async () => {
    loadIndexMock.mockResolvedValue([
      entry({ slug: 'unique-focus', category: 'Focii' }),
      entry({ slug: 'base-focus', category: 'Focus' }),
    ]);

    const res = await GET(req('?slot=weapon1_off'));
    const body = await res.json();

    expect(body.entries.map((e: { slug: string }) => e.slug).sort()).toEqual(['base-focus', 'unique-focus']);
  });

  it('serves the jewels pseudo-slot from the same route', async () => {
    loadIndexMock.mockResolvedValue([
      entry({ slug: 'a-jewel', category: 'Jewel' }),
      entry({ slug: 'a-helmet', category: 'Helmet' }),
    ]);

    const res = await GET(req('?slot=jewels'));
    const body = await res.json();

    expect(body.entries).toEqual([expect.objectContaining({ slug: 'a-jewel' })]);
  });

  it('applies q using the shared filterEntries search', async () => {
    loadIndexMock.mockResolvedValue([
      entry({ slug: 'iron-helm', name: 'Iron Hat', category: 'Helmet' }),
      entry({ slug: 'other-helm', name: 'Completely Different', category: 'Helmet' }),
    ]);

    const res = await GET(req('?slot=head&q=Iron'));
    const body = await res.json();

    expect(body.entries.map((e: { slug: string }) => e.slug)).toEqual(['iron-helm']);
  });

  it('reports total as the pre-limit match count', async () => {
    const many = Array.from({ length: 120 }, (_, i) => entry({ slug: `helm-${i}` }));
    loadIndexMock.mockResolvedValue(many);

    const res = await GET(req('?slot=head'));
    const body = await res.json();

    expect(body.total).toBe(120);
    expect(body.entries).toHaveLength(50); // default limit
  });

  it('clamps limit to the hard cap of 100', async () => {
    const many = Array.from({ length: 120 }, (_, i) => entry({ slug: `helm-${i}` }));
    loadIndexMock.mockResolvedValue(many);

    const res = await GET(req('?slot=head&limit=1000'));
    const body = await res.json();

    expect(body.entries).toHaveLength(100);
    expect(body.total).toBe(120);
  });

  it('honors a limit below the default when explicitly given', async () => {
    const many = Array.from({ length: 10 }, (_, i) => entry({ slug: `helm-${i}` }));
    loadIndexMock.mockResolvedValue(many);

    const res = await GET(req('?slot=head&limit=3'));
    const body = await res.json();

    expect(body.entries).toHaveLength(3);
    expect(body.total).toBe(10);
  });

  it('returns 400 for a non-numeric limit', async () => {
    const res = await GET(req('?slot=head&limit=abc'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for a zero or negative limit', async () => {
    expect((await GET(req('?slot=head&limit=0'))).status).toBe(400);
    expect((await GET(req('?slot=head&limit=-5'))).status).toBe(400);
  });

  it('returns 500 when the index fails to load', async () => {
    loadIndexMock.mockRejectedValue(new Error('disk error'));

    const res = await GET(req('?slot=head'));

    expect(res.status).toBe(500);
  });
});
