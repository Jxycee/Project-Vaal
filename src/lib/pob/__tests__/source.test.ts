import { describe, expect, it, vi } from 'vitest';
import { MAX_CODE_BYTES, resolvePobInput } from '../source';

// Failure modes first (AGENTS.md). This is the only module in the importer
// that touches the network, and the URL is user input — so every refusal
// below must happen BEFORE any request is made, or this is an SSRF primitive.
// The network is always stubbed; nothing here reaches a real site.

const CODE = 'eNrtPdty2ziyz6OvYLlqz0uchLgQBGeTPSXb8mXjWyQ7mexLCiRBm2OKVEgqjmdr';

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

function stubFetch(response: () => Response | Promise<Response>) {
  return vi.fn<FetchLike>(async () => response());
}

function neverCalled() {
  return vi.fn<FetchLike>(async () => {
    throw new Error('fetch must not be called');
  });
}

describe('resolvePobInput — refused before any request', () => {
  it.each([
    ['plain http', 'http://pobb.in/abc123'],
    ['a host off the allowlist', 'https://evil.example/pob/abc123'],
    ['an allowlisted name as a subdomain of another host', 'https://pobb.in.evil.example/abc123'],
    ['an allowlisted host as a suffix', 'https://notpobb.in/abc123'],
    ['credentials in the URL', 'https://user@pobb.in/abc123'],
    ['a non-default port', 'https://pobb.in:8443/abc123'],
    ['an IP literal', 'https://127.0.0.1/pob/abc123'],
    ['an IPv6 literal', 'https://[::1]/pob/abc123'],
    ['a file URL', 'file:///etc/passwd'],
    ['a javascript URL', 'javascript://pobb.in/%0aalert(1)'],
    ['an allowlisted host with an unknown path', 'https://maxroll.gg/poe2/planner/abc123'],
    ['an id with path characters', 'https://pobb.in/..%2F..%2Fadmin'],
    ['a nested path', 'https://poe2db.tw/pob/abc/def'],
  ])('refuses %s', async (_label, input) => {
    const fetchImpl = neverCalled();
    const result = await resolvePobInput(input, fetchImpl);
    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses empty input', async () => {
    const fetchImpl = neverCalled();
    expect((await resolvePobInput('   ', fetchImpl)).ok).toBe(false);
  });
});

describe('resolvePobInput — refused after the request', () => {
  it('refuses any redirect rather than following it', async () => {
    const fetchImpl = stubFetch(() => new Response(null, { status: 302, headers: { location: 'https://evil.example/' } }));
    const result = await resolvePobInput('https://pobb.in/abc123', fetchImpl);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/redirect/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });

  it('reports a non-200 with its status', async () => {
    const result = await resolvePobInput('https://pobb.in/abc123', stubFetch(() => new Response('nope', { status: 404 })));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('404');
  });

  it('refuses a response declared over the cap without reading it', async () => {
    const result = await resolvePobInput(
      'https://pobb.in/abc123',
      stubFetch(() => new Response('x', { status: 200, headers: { 'content-length': String(MAX_CODE_BYTES + 1) } })),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/too large/i);
  });

  it('refuses a response that grows past the cap while streaming, with no length declared', async () => {
    const chunk = new Uint8Array(64 * 1024).fill(65);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent > MAX_CODE_BYTES * 2) return controller.close();
        sent += chunk.length;
        controller.enqueue(chunk);
      },
    });
    const result = await resolvePobInput('https://pobb.in/abc123', stubFetch(() => new Response(body, { status: 200 })));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/too large/i);
    expect(sent).toBeLessThanOrEqual(MAX_CODE_BYTES + chunk.length * 2);
  });

  it('reports a timeout as a timeout', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError');
    });
    const result = await resolvePobInput('https://pobb.in/abc123', fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/too long|timed out/i);
  });

  it('reports a network failure without leaking its details', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => {
      throw new TypeError('fetch failed: getaddrinfo ENOTFOUND internal-host.local');
    });
    const result = await resolvePobInput('https://pobb.in/abc123', fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toContain('internal-host');
  });

  it('refuses an empty body', async () => {
    const result = await resolvePobInput('https://pobb.in/abc123', stubFetch(() => new Response('  \n', { status: 200 })));
    expect(result.ok).toBe(false);
  });
});

describe('resolvePobInput — what it accepts', () => {
  it('passes a raw code through untouched, with no request', async () => {
    const fetchImpl = neverCalled();
    expect(await resolvePobInput(`  ${CODE}\n`, fetchImpl)).toEqual({ ok: true, code: CODE, sourceUrl: null });
  });

  // Download URLs are PoB2's own (src/Modules/BuildSiteTools.lua, read
  // 2026-09-24). pobb.in and poe2db.tw were fetched live that day and
  // returned a code; maxroll.gg and poe.ninja answered at those paths.
  it.each([
    ['https://pobb.in/abc123', 'https://pobb.in/pob/abc123'],
    ['pobb.in/abc123', 'https://pobb.in/pob/abc123'],
    ['https://pobb.in/abc123?x=1#y', 'https://pobb.in/pob/abc123'],
    ['https://maxroll.gg/poe2/pob/abc123', 'https://maxroll.gg/poe2/api/pob/abc123'],
    ['https://poe.ninja/poe2/pob/abc123', 'https://poe.ninja/poe2/pob/raw/abc123'],
    ['https://poe2.ninja/pob/abc123', 'https://poe.ninja/poe2/pob/raw/abc123'],
    ['https://poe2db.tw/pob/abc123', 'https://poe2db.tw/pob/abc123/raw'],
    ['HTTPS://POBB.IN/abc123', 'https://pobb.in/pob/abc123'],
  ])('fetches %s from %s', async (input, expected) => {
    const fetchImpl = stubFetch(() => new Response(`${CODE}\n`, { status: 200 }));
    const result = await resolvePobInput(input, fetchImpl);
    expect(result).toEqual({ ok: true, code: CODE, sourceUrl: expected });
    expect(fetchImpl.mock.calls[0][0]).toBe(expected);
  });
});
