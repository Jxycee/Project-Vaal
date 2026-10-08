// FAILURE MODES this file exists to catch (listed before the tests were written; see discovery.ts):
//  1. text query injects a PostgREST clause or turns into a match-everything wildcard
//  2. page size / page index unbounded or NaN/float/string
//  3. hostile keys (visibility, user_id, sort column) reach the query
//  4. an empty filter, or any filter, can drop the visibility = 'public' guard
//  5. ties in the sort column shuffle between pages (no unique tiebreak)
//  6. a tag filter silently ignored when its id list is missing, or ANY-match instead of ALL-match
//  7. inverted / out-of-range levels
//  8. control characters and giant strings survive
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  DISCOVERY_SELECT,
  MAX_PAGE,
  MAX_PAGE_SIZE,
  MAX_TEXT_LENGTH,
  applyDiscoverySpec,
  buildIdsWithAllTags,
  ilikeContains,
  normalizeDiscoveryRequest,
  toDiscoveryPage,
  type DiscoveryQuery,
  type DiscoveryRow,
} from './discovery';

type Call = [method: string, ...args: unknown[]];

/** Records every builder call in order; each returns itself like PostgREST's builder. */
class Recorder implements DiscoveryQuery {
  calls: Call[] = [];
  private rec(...c: Call): this {
    this.calls.push(c);
    return this;
  }
  eq(column: string, value: string | number) { return this.rec('eq', column, value); }
  gte(column: string, value: number) { return this.rec('gte', column, value); }
  lte(column: string, value: number) { return this.rec('lte', column, value); }
  ilike(column: string, pattern: string) { return this.rec('ilike', column, pattern); }
  in(column: string, values: readonly string[]) { return this.rec('in', column, values); }
  not(column: string, operator: string, value: unknown) { return this.rec('not', column, operator, value); }
  order(column: string, options: { ascending: boolean }) { return this.rec('order', column, options.ascending); }
  range(from: number, to: number) { return this.rec('range', from, to); }
  of(method: string) { return this.calls.filter((c) => c[0] === method); }
}

const run = (filter: unknown = {}, page: unknown = {}, ids?: string[]) =>
  applyDiscoverySpec(new Recorder(), normalizeDiscoveryRequest(filter, page), ids);

describe('visibility guard', () => {
  it('an empty filter still applies visibility = public as the first call', () => {
    const r = run();
    expect(r.calls[0]).toEqual(['eq', 'visibility', 'public']);
  });

  it('no input can add a second visibility clause or a user_id clause', () => {
    const r = run(
      { visibility: 'unlisted', user_id: 'someone', share_token: 'x', notes: 'y', class: 'Witch' },
      { sort: { key: 'user_id', direction: 'asc' } },
    );
    expect(r.of('eq').filter((c) => c[1] === 'visibility')).toEqual([['eq', 'visibility', 'public']]);
    expect(r.calls.some((c) => c[1] === 'user_id' || c[1] === 'notes' || (c[0] === 'eq' && c[1] === 'share_token'))).toBe(false);
  });

  it('excludes builds with no share token, and selects no unrelated columns', () => {
    expect(run().of('not')).toEqual([['not', 'share_token', 'is', null]]);
    for (const banned of ['passive_state', 'gear_state', 'gem_state', 'notes', 'description', 'user_id', '*']) {
      expect(DISCOVERY_SELECT.split(', ')).not.toContain(banned);
    }
  });
});

describe('text query injection', () => {
  it('never uses .or(); a clause-looking query is one ilike parameter on name', () => {
    const r = run({ query: 'a,visibility.eq.unlisted),(x' });
    expect(r.of('ilike')).toEqual([['ilike', 'name', '%a,visibility.eq.unlisted),(x%']]);
    expect(r.calls.some((c) => c[0] === 'or')).toBe(false);
  });

  it('escapes LIKE wildcards and the escape char, and strips PostgREST *', () => {
    expect(ilikeContains('100%')).toBe('%100\\%%');
    expect(ilikeContains('a_b')).toBe('%a\\_b%');
    expect(ilikeContains('a\\b')).toBe('%a\\\\b%');
    expect(ilikeContains('x*y')).toBe('%xy%');
  });

  it('a query of only stars is no filter; stars inside a query never reach the pattern', () => {
    expect(normalizeDiscoveryRequest({ query: '***' }, {}).query).toBeNull();
    expect(run({ query: 'x*y' }).of('ilike')).toEqual([['ilike', 'name', '%x y%']]);
  });

  it('a query of only wildcards is not "no filter": it stays a literal search', () => {
    expect(run({ query: '%' }).of('ilike')).toEqual([['ilike', 'name', '%\\%%']]);
  });

  it('strips control characters, collapses whitespace, caps length', () => {
    const spec = normalizeDiscoveryRequest({ query: '  ab\u0000\n\tcd  ' + 'z'.repeat(500) }, {});
    expect(spec.query!.startsWith('ab cd z')).toBe(true);
    expect(spec.query!.length).toBeLessThanOrEqual(MAX_TEXT_LENGTH);
    expect(spec.query).not.toMatch(/[\u0000-\u001f]/);
  });
});

describe('empty and ignored fields', () => {
  it('empty / whitespace / wrong-typed fields add no clause', () => {
    const r = run({ class: '', ascendancy: '   ', league: 5, mainSkill: null, query: '\u0007', tags: 'minion', minLevel: 'x', maxLevel: NaN });
    expect(r.calls.map((c) => c[0])).toEqual(['eq', 'not', 'order', 'order', 'range']);
  });
});

describe('pagination bounds', () => {
  it('clamps a huge page size and page index', () => {
    const s = normalizeDiscoveryRequest({}, { pageSize: 1e9, page: 1e9 });
    expect(s.pageSize).toBe(MAX_PAGE_SIZE);
    expect(s.page).toBe(MAX_PAGE);
    const r = applyDiscoverySpec(new Recorder(), s);
    expect(r.of('range')).toEqual([['range', MAX_PAGE * MAX_PAGE_SIZE, MAX_PAGE * MAX_PAGE_SIZE + MAX_PAGE_SIZE]]);
  });

  it('falls back on NaN, strings, negatives, floats and zero size', () => {
    expect(normalizeDiscoveryRequest({}, { pageSize: NaN, page: 'two' })).toMatchObject({ pageSize: DEFAULT_PAGE_SIZE, page: 0 });
    expect(normalizeDiscoveryRequest({}, { pageSize: -5, page: -1 })).toMatchObject({ pageSize: 1, page: 0 });
    expect(normalizeDiscoveryRequest({}, { pageSize: 10.9, page: 2.7 })).toMatchObject({ pageSize: 10, page: 2 });
    expect(normalizeDiscoveryRequest({}, { pageSize: 0 }).pageSize).toBe(1);
  });

  it('requests pageSize + 1 rows via an inclusive range, and page N starts at N * size', () => {
    const r = run({}, { page: 3, pageSize: 10 });
    expect(r.of('range')).toEqual([['range', 30, 40]]);
  });

  it('hasMore comes from the extra row, which is not returned', () => {
    const row = (i: number): DiscoveryRow => ({
      id: `id${i}`, name: `n${i}`, class: 'Witch', ascendancy: null, level: 90, league: 'Standard',
      main_skill: null, share_token: `t${i}`, updated_at: '2026-01-01T00:00:00Z',
    });
    const rows = [row(0), row(1), row(2)];
    const p = toDiscoveryPage(rows, { id0: 'alice' }, 2);
    expect(p.hasMore).toBe(true);
    expect(p.cards.map((c) => c.shareToken)).toEqual(['t0', 't1']);
    expect(p.cards[0].ownerUsername).toBe('alice');
    expect(p.cards[1].ownerUsername).toBeNull();
    expect(Object.keys(p.cards[0]).sort()).toEqual(
      ['ascendancy', 'class', 'league', 'level', 'mainSkill', 'name', 'ownerUsername', 'shareToken', 'updatedAt'],
    );
    expect(toDiscoveryPage(rows.slice(0, 2), {}, 2).hasMore).toBe(false);
  });
});

describe('sort', () => {
  it('always ends with the unique id tiebreak, descending, after the sort column', () => {
    const r = run({}, { sort: { key: 'level', direction: 'asc' } });
    expect(r.of('order')).toEqual([['order', 'level', true], ['order', 'id', false]]);
  });

  it('defaults to newest-updated first; an unknown key or prototype key falls back', () => {
    expect(run().of('order')[0]).toEqual(['order', 'updated_at', false]);
    expect(run({}, { sort: { key: 'toString', direction: 'asc' } }).of('order')[0]).toEqual(['order', 'updated_at', false]);
    expect(run({}, { sort: { key: 'visibility', direction: 'asc' } }).of('order')[0]).toEqual(['order', 'updated_at', false]);
  });
});

describe('level range', () => {
  it('swaps an inverted range and clamps to 1..100', () => {
    const r = run({ minLevel: 95, maxLevel: 40 });
    expect(r.of('gte')).toEqual([['gte', 'level', 40]]);
    expect(r.of('lte')).toEqual([['lte', 'level', 95]]);
    const wide = normalizeDiscoveryRequest({ minLevel: -50, maxLevel: 9999 }, {});
    expect([wide.minLevel, wide.maxLevel]).toEqual([1, 100]);
  });
});

describe('tags', () => {
  it('throws if the spec has tags but no resolved ids (never silently unfiltered)', () => {
    expect(() => run({ tags: ['minion'] })).toThrow(/tag filter/);
  });

  it('an empty resolved list still filters (matches nothing) rather than being dropped', () => {
    expect(run({ tags: ['minion'] }, {}, []).of('in')).toEqual([['in', 'id', []]]);
  });

  it('normalises like tags.ts, dedupes and caps the count', () => {
    const s = normalizeDiscoveryRequest({ tags: ['Minion', ' minion ', 'LOW  life', 'a', 'b', 'c', 'd', 5, 'x'.repeat(40)] }, {});
    expect(s.tags).toEqual(['minion', 'low life', 'a', 'b']);
  });

  it('ALL-match: a build with only one of two wanted tags is excluded', () => {
    const rows = [
      { build_id: 'A', tag: 'minion' }, { build_id: 'A', tag: 'low life' },
      { build_id: 'B', tag: 'minion' },
      { build_id: 'C', tag: 'unrelated' },
    ];
    expect(buildIdsWithAllTags(rows, ['minion', 'low life'])).toEqual(['A']);
    expect(buildIdsWithAllTags(rows, [])).toEqual([]);
  });
});

describe('full combination', () => {
  it('applies every filter as a parameterised single-column clause', () => {
    const r = run(
      { class: 'Witch', ascendancy: 'Infernalist', league: 'Standard', mainSkill: 'Fireball', minLevel: 80, maxLevel: 100, query: 'bomb' },
      { page: 1, pageSize: 5, sort: { key: 'views', direction: 'desc' } },
    );
    expect(r.calls).toEqual([
      ['eq', 'visibility', 'public'],
      ['not', 'share_token', 'is', null],
      ['eq', 'class', 'Witch'],
      ['eq', 'ascendancy', 'Infernalist'],
      ['eq', 'league', 'Standard'],
      ['eq', 'main_skill', 'Fireball'],
      ['gte', 'level', 80],
      ['lte', 'level', 100],
      ['ilike', 'name', '%bomb%'],
      ['order', 'view_count', false],
      ['order', 'id', false],
      ['range', 5, 10],
    ]);
  });
});
