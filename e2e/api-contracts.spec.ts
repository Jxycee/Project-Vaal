import { expect, test, type APIResponse, type TestInfo } from '@playwright/test';
import { MAX_NOTES_LENGTH } from '../src/lib/build/constants';
import { cleanupWithFreshPage, testBuildName } from './helpers';

// The HTTP contracts of POST /api/builds and GET /api/wiki/items, exercised
// against the real routes, real RLS and the real wiki index, rather than the
// mocked Supabase client the unit tests used. Each request is one a hostile or
// buggy client could send; each answer is what the route promises.
//
// Every response is attached to the report (see playwright.config.ts's json
// reporter), so a run leaves a checkable record of what the server actually
// said, not just a pass/fail line.

async function record(testInfo: TestInfo, label: string, res: APIResponse): Promise<unknown> {
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Not JSON; keep the raw text.
  }
  await testInfo.attach(label, {
    body: JSON.stringify({ status: res.status(), url: res.url(), body }, null, 2),
    contentType: 'application/json',
  });
  return body;
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: testBuildName('api'),
    class: 'Witch',
    level: 10,
    passive_state: { set1: [], set2: [], ascendancyNodes: [] },
    ...overrides,
  };
}

// A real item shape, as the picker stores it. The icon path follows the synced
// data layout, so the write gate must accept it.
const HELMET = {
  slug: 'e2e-helmet',
  name: 'E2E Helmet',
  category: 'Helmet',
  isUnique: false,
  iconUrl: '/data/wiki/2026-08-25/icons/items/e2e-helmet.png',
};

test.describe('POST /api/builds refuses bad requests before writing', () => {
  // Start from an account with no E2E- rows, so the row count at the end
  // proves the refusals wrote nothing.
  test.beforeAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });
  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  const badBodies: Array<[string, unknown, number]> = [
    ['null body', null, 400],
    ['a number body', 7, 400],
    ['an array body', [], 400],
    ['a non-string id', validBody({ id: 12 }), 400],
    ['a whitespace-only name', validBody({ name: '   ' }), 400],
    ['a missing class', validBody({ class: undefined }), 400],
    ['level 0', validBody({ level: 0 }), 400],
    ['level 101', validBody({ level: 101 }), 400],
    ['non-string notes', validBody({ notes: 42 }), 400],
    ['notes one over the cap', validBody({ notes: 'x'.repeat(MAX_NOTES_LENGTH + 1) }), 400],
    ['non-numeric passive nodes', validBody({ passive_state: { set1: ['x'], set2: [], ascendancyNodes: [] } }), 400],
    ['a checkpoint id on a create', validBody({ checkpoint_id: crypto.randomUUID() }), 400],
    // A tracking pixel planted on a public build would load for every viewer.
    ['an off-origin icon URL', validBody({ gear_state: { head: { ...HELMET, iconUrl: 'https://attacker.example/p.gif' } } }), 400],
    ['a malformed gear item', validBody({ gear_state: { head: { name: 'no slug' } } }), 400],
    // A non-UUID id answers exactly like a real id that is not yours.
    ['a non-UUID build id', validBody({ id: 'not-a-uuid' }), 404],
    ['a non-UUID checkpoint id', validBody({ id: crypto.randomUUID(), checkpoint_id: 'nope' }), 404],
    ['a well-formed id that is not ours', validBody({ id: crypto.randomUUID() }), 404],
  ];

  for (const [label, data, status] of badBodies) {
    test(`answers ${status} for ${label}`, async ({ page }, testInfo) => {
      const res = await page.request.post('/api/builds', { data: data as never });
      await record(testInfo, label, res);
      expect(res.status()).toBe(status);
    });
  }

  test('answers 400, not 500, for a body that is not JSON', async ({ page }, testInfo) => {
    const res = await page.request.post('/api/builds', {
      data: '{ not json',
      headers: { 'content-type': 'application/json' },
    });
    await record(testInfo, 'not json', res);
    expect(res.status()).toBe(400);
  });

  test('none of the refused requests created a row', async ({ page }) => {
    // The refusals above all carried E2E- names. If any had slipped through to
    // an insert, it would be sitting in the list now.
    const res = await page.request.post('/api/builds', { data: validBody() });
    expect(res.ok()).toBe(true);
    await page.goto('/builds');
    await expect(page.getByText(/^E2E-api-/)).toHaveCount(1, { timeout: 30_000 });
  });
});

test.describe('POST /api/builds keeps what a save did not send', () => {
  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('a save that omits gear, gems and notes leaves them as they were', async ({ page }, testInfo) => {
    const created = await page.request.post('/api/builds', {
      data: validBody({
        gear_state: { head: HELMET },
        gem_state: { loadouts: [], primaryId: null },
        notes: 'keep me',
      }),
    });
    const createdBody = (await record(testInfo, 'create', created)) as {
      build: { id: string; gear_state: Record<string, unknown>; notes: string | null };
      checkpoint: { id: string } | null;
    };
    expect(created.ok()).toBe(true);
    expect(createdBody.build.gear_state.head).toEqual(HELMET);

    // A tree-only save: no gear_state, gem_state or notes keys at all.
    const updated = await page.request.post('/api/builds', {
      data: validBody({
        id: createdBody.build.id,
        name: testBuildName('api-kept'),
        passive_state: { set1: [1], set2: [1], ascendancyNodes: [] },
      }),
    });
    const updatedBody = (await record(testInfo, 'tree-only update', updated)) as {
      build: { gear_state: Record<string, unknown>; notes: string | null };
    };
    expect(updated.ok()).toBe(true);
    expect(updatedBody.build.gear_state.head).toEqual(HELMET);
    expect(updatedBody.build.notes).toBe('keep me');
  });

  test('stores only the known item fields', async ({ page }, testInfo) => {
    const res = await page.request.post('/api/builds', {
      data: validBody({ gear_state: { head: { ...HELMET, injected: '<script>' } } }),
    });
    const body = (await record(testInfo, 'extra field', res)) as { build: { gear_state: Record<string, object> } };
    expect(res.ok()).toBe(true);
    expect(body.build.gear_state.head).toEqual(HELMET);
  });
});

test.describe('GET /api/wiki/items against the real index', () => {
  async function search(page: import('@playwright/test').Page, testInfo: TestInfo, query: string) {
    const res = await page.request.get(`/api/wiki/items?${query}`);
    const body = (await record(testInfo, query, res)) as {
      entries?: Array<{ slug: string; category: string }>;
      total?: number;
    };
    return { res, body };
  }

  test('weapon main-hand slots include Talismans (2026-09-20 regression)', async ({ page }, testInfo) => {
    const { res, body } = await search(page, testInfo, 'slot=weapon1_main&limit=100&q=talisman');
    expect(res.ok()).toBe(true);
    expect(body.entries!.some((e) => e.category === 'Talisman')).toBe(true);
  });

  test('weapon off-hand slots include Focii (2026-09-20 regression)', async ({ page }, testInfo) => {
    const { res, body } = await search(page, testInfo, 'slot=weapon1_off&limit=100&q=focus');
    expect(res.ok()).toBe(true);
    expect(body.entries!.some((e) => e.category === 'Focii')).toBe(true);
  });

  test('a slot returns only its own categories', async ({ page }, testInfo) => {
    const { res, body } = await search(page, testInfo, 'slot=jewels&limit=100');
    expect(res.ok()).toBe(true);
    expect(body.entries!.length).toBeGreaterThan(0);
    expect(new Set(body.entries!.map((e) => e.category))).toEqual(new Set(['Jewel']));
  });

  test('search tolerates a typo, using the wiki ranking', async ({ page }, testInfo) => {
    const { res, body } = await search(page, testInfo, 'slot=gem_skill&q=ise%20nva');
    expect(res.ok()).toBe(true);
    expect(body.entries!.map((e) => e.slug)).toContain('ice-nova');
  });

  test('limit is capped at 100 and total counts every match', async ({ page }, testInfo) => {
    const { res, body } = await search(page, testInfo, 'slot=gem_skill&limit=1000');
    expect(res.ok()).toBe(true);
    expect(body.entries!.length).toBe(100);
    expect(body.total!).toBeGreaterThan(100);
  });

  for (const query of ['slot=weapon1_main&limit=0', 'slot=weapon1_main&limit=abc', 'slot=Talisman', '']) {
    test(`answers 400 for "${query}"`, async ({ page }, testInfo) => {
      const { res } = await search(page, testInfo, query);
      expect(res.status()).toBe(400);
    });
  }
});

test.describe('signed out, both routes refuse', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('POST /api/builds answers 401', async ({ page }, testInfo) => {
    const res = await page.request.post('/api/builds', { data: validBody() });
    await record(testInfo, 'signed-out save', res);
    expect(res.status()).toBe(401);
  });

  test('GET /api/wiki/items answers 401 with no data', async ({ page }, testInfo) => {
    const res = await page.request.get('/api/wiki/items?slot=head');
    const body = (await record(testInfo, 'signed-out search', res)) as { entries?: unknown };
    expect(res.status()).toBe(401);
    expect(body.entries).toBeUndefined();
  });
});
