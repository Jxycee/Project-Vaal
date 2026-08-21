import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchWikiIndex, WikiIndexFetchError } from './fetchIndex';
import { WIKI_DATA_VERSION } from './types';

function jsonResponse(body: unknown, opts: { status?: number; contentType?: string } = {}) {
  const status = opts.status ?? 200;
  const contentType = opts.contentType ?? 'application/json';
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchWikiIndex', () => {
  it('fetches the correct URL for each kind and resolves the entries array', async () => {
    const entries = [
      { slug: 'ice-nova', name: 'Ice Nova', kind: 'skill', category: 'Active Skill Gem', tags: ['Cold'] },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ version: '1', generatedAt: 'x', entries }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchWikiIndex('skill');

    expect(fetchMock).toHaveBeenCalledWith(`/data/wiki/${WIKI_DATA_VERSION}/skill-index.json`);
    expect(result).toEqual(entries);
  });

  it('throws with the HTTP status when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, { status: 404 })));

    await expect(fetchWikiIndex('item')).rejects.toThrow(WikiIndexFetchError);
    await expect(fetchWikiIndex('item')).rejects.toThrow(/HTTP 404/);
  });

  it('treats a non-JSON response as an expired session (middleware redirect-to-login case)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse('<html>...</html>', { contentType: 'text/html; charset=utf-8' })),
    );

    await expect(fetchWikiIndex('mod')).rejects.toThrow(WikiIndexFetchError);
    await expect(fetchWikiIndex('mod')).rejects.toThrow(/Session expired/);
  });

  it('rejects a malformed index body (missing/invalid entries)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ version: '1', generatedAt: 'x' })));

    await expect(fetchWikiIndex('item')).rejects.toThrow(/Malformed item index/);
  });

  it('rejects when an entry in the array fails shape validation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ version: '1', generatedAt: 'x', entries: [{ slug: 'x' /* missing name/kind/category/tags */ }] }),
      ),
    );

    await expect(fetchWikiIndex('item')).rejects.toThrow(/Malformed item index/);
  });
});
