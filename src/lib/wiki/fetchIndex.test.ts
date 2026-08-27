import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchWikiIndex, WikiIndexFetchError, WikiSessionExpiredError } from './fetchIndex';
import { WIKI_DATA_VERSION } from './types';

function fakeResponse(
  body: unknown,
  opts: { status?: number; contentType?: string; redirected?: boolean; url?: string } = {},
) {
  const status = opts.status ?? 200;
  const contentType = opts.contentType ?? 'application/json';
  return {
    ok: status >= 200 && status < 300,
    status,
    redirected: opts.redirected ?? false,
    url: opts.url ?? `https://example.test/data/wiki/${WIKI_DATA_VERSION}/item-index.json`,
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
      { slug: 'ice-nova', name: 'Ice Nova', kind: 'skill', category: 'Active Skill Gem', tags: ['Cold'], isUniqueItem: false },
    ];
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse({ version: '1', generatedAt: 'x', entries }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchWikiIndex('skill');

    expect(fetchMock).toHaveBeenCalledWith(`/data/wiki/${WIKI_DATA_VERSION}/skill-index.json`);
    expect(result).toEqual(entries);
  });

  it('throws WikiSessionExpiredError when the fetch was redirected to /login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        fakeResponse('<html>login page</html>', {
          redirected: true,
          url: 'https://example.test/login?redirect=%2Fwiki%2Fitems',
          contentType: 'text/html; charset=utf-8',
        }),
      ),
    );

    await expect(fetchWikiIndex('item')).rejects.toThrow(WikiSessionExpiredError);
    await expect(fetchWikiIndex('item')).rejects.toThrow(/Session expired/);
  });

  it('does not treat a redirect to a non-/login path as an expired session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        fakeResponse({ version: '1', generatedAt: 'x', entries: [] }, {
          redirected: true,
          url: `https://example.test/data/wiki/${WIKI_DATA_VERSION}/item-index.json`,
        }),
      ),
    );

    const result = await fetchWikiIndex('item');
    expect(result).toEqual([]);
  });

  it('throws a plain WikiIndexFetchError (not session-expired) with the HTTP status when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(null, { status: 404 })));

    await expect(fetchWikiIndex('item')).rejects.toThrow(WikiIndexFetchError);
    await expect(fetchWikiIndex('item')).rejects.toThrow(/HTTP 404/);
    await expect(fetchWikiIndex('item')).rejects.not.toBeInstanceOf(WikiSessionExpiredError);
  });

  it('treats a non-JSON, non-redirected response as an unexpected response, not a session expiry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(fakeResponse('<html>captive portal</html>', { contentType: 'text/html; charset=utf-8' })),
    );

    const err = await fetchWikiIndex('mod').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WikiIndexFetchError);
    expect(err).not.toBeInstanceOf(WikiSessionExpiredError);
    expect((err as Error).message).toMatch(/Unexpected response/);
  });

  it('rejects a malformed index body (missing/invalid entries)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse({ version: '1', generatedAt: 'x' })));

    await expect(fetchWikiIndex('item')).rejects.toThrow(/Malformed item index/);
  });

  it('rejects when an entry in the array fails shape validation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        fakeResponse({ version: '1', generatedAt: 'x', entries: [{ slug: 'x' /* missing name/kind/category/tags */ }] }),
      ),
    );

    await expect(fetchWikiIndex('item')).rejects.toThrow(/Malformed item index/);
  });
});
