import { describe, expect, it, vi } from 'vitest';

// If the deployed function is missing the data files (a file-tracing miss —
// see outputFileTracingIncludes in next.config.ts), loadAllSlugs answers []
// rather than throwing. The catalogue must turn that into a loud failure:
// an empty gem map would make every import report every gem as unknown,
// which looks like a data problem instead of the deploy problem it is.

vi.mock('@/lib/wiki/load', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/wiki/load')>()),
  loadAllSlugs: async () => [],
}));

import { getCatalogue } from '../catalogue';

describe('catalogue — missing data on disk', () => {
  it('refuses to build from an empty skill directory, and does not cache the failure', async () => {
    await expect(getCatalogue()).rejects.toThrow(/skill/i);
    await expect(getCatalogue()).rejects.toThrow(/skill/i);
  });
});
