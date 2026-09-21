import { describe, it, expect, vi, beforeEach } from 'vitest';

const readFileMock = vi.fn();
vi.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => readFileMock(...args),
}));

// `loadIndex` caches at module scope, so each test needs a fresh module
// instance (vi.resetModules + a dynamic re-import) to avoid one test's
// cached promise leaking into the next.
beforeEach(() => {
  vi.resetModules();
  readFileMock.mockReset();
});

const validEntry = {
  slug: 'a-helmet', name: 'A Helmet', kind: 'item', category: 'Helmet', tags: [], isUniqueItem: false,
};

describe('loadIndex', () => {
  it('reads the versioned index file and returns its entries', async () => {
    readFileMock.mockResolvedValue(JSON.stringify({ entries: [validEntry] }));
    const { loadIndex } = await import('./loadIndex');

    const entries = await loadIndex('item');

    expect(entries).toEqual([validEntry]);
    expect(readFileMock).toHaveBeenCalledWith(
      expect.stringContaining(`item-index.json`),
      'utf8',
    );
  });

  it('rejects a bare-array shape (must be { entries: [...] })', async () => {
    readFileMock.mockResolvedValue(JSON.stringify([validEntry]));
    const { loadIndex, WikiIndexLoadError } = await import('./loadIndex');

    await expect(loadIndex('item')).rejects.toBeInstanceOf(WikiIndexLoadError);
  });

  it('rejects entries that fail the WikiSearchEntry shape check', async () => {
    readFileMock.mockResolvedValue(JSON.stringify({ entries: [{ slug: 'x' }] }));
    const { loadIndex, WikiIndexLoadError } = await import('./loadIndex');

    await expect(loadIndex('item')).rejects.toBeInstanceOf(WikiIndexLoadError);
  });

  it('propagates a raw filesystem error', async () => {
    readFileMock.mockRejectedValue(new Error('ENOENT'));
    const { loadIndex } = await import('./loadIndex');

    await expect(loadIndex('item')).rejects.toThrow('ENOENT');
  });

  it('is single-flight: two concurrent calls for the same kind share one read', async () => {
    readFileMock.mockResolvedValue(JSON.stringify({ entries: [validEntry] }));
    const { loadIndex } = await import('./loadIndex');

    const [a, b] = await Promise.all([loadIndex('item'), loadIndex('item')]);

    expect(a).toBe(b); // same array instance — one shared promise, not two reads merged after the fact
    expect(readFileMock).toHaveBeenCalledTimes(1);
  });

  it('caches across calls after the first resolves too', async () => {
    readFileMock.mockResolvedValue(JSON.stringify({ entries: [validEntry] }));
    const { loadIndex } = await import('./loadIndex');

    await loadIndex('item');
    await loadIndex('item');

    expect(readFileMock).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failure — a later call retries', async () => {
    readFileMock.mockRejectedValueOnce(new Error('transient'));
    readFileMock.mockResolvedValueOnce(JSON.stringify({ entries: [validEntry] }));
    const { loadIndex } = await import('./loadIndex');

    await expect(loadIndex('item')).rejects.toThrow('transient');
    const entries = await loadIndex('item');

    expect(entries).toEqual([validEntry]);
    expect(readFileMock).toHaveBeenCalledTimes(2);
  });

  it('caches different kinds independently', async () => {
    readFileMock.mockResolvedValue(JSON.stringify({ entries: [validEntry] }));
    const { loadIndex } = await import('./loadIndex');

    await loadIndex('item');
    await loadIndex('skill');

    expect(readFileMock).toHaveBeenCalledTimes(2);
  });
});
