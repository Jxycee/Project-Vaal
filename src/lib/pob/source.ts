// src/lib/pob/source.ts
// =============================================================================
// What the user pasted -> a PoB2 share code.
//
// The only module in the importer that touches the network. The input is a
// user-supplied string and this runs on our server, so a URL is refused
// unless it is exactly one of the build sites below — checked BEFORE any
// request is made. Without that this would be a server-side request forgery
// primitive: "import" http://169.254.169.254/ and read the response back.
//
// - HTTPS only, on the default port, with no credentials in the URL.
// - Exact hostnames. No suffix or subdomain matching, and so no IP literals.
// - The path must match the site's own share-link shape, and the build id is
//   restricted to [A-Za-z0-9_-], so nothing the user types reaches the
//   outgoing path except that id.
// - The request goes to the site's raw-code download URL, taken from PoB2's
//   own src/Modules/BuildSiteTools.lua (read 2026-09-24).
// - No redirect is followed, a timeout bounds the wait, and the body is
//   capped while it streams, not after.
//
// Anything without "://" is treated as a code already and passed through for
// decode.ts to judge — except a bare "pobb.in/abc"-style link, which is
// given its https:// and checked like any other URL.
// =============================================================================

/** The largest raw code accepted. The real 8-checkpoint build is ~12 KB of code. */
export const MAX_CODE_BYTES = 1024 * 1024;
const TIMEOUT_MS = 10_000;

const ID = '([A-Za-z0-9_-]{1,64})';

interface Site {
  label: string;
  hosts: readonly string[];
  path: RegExp;
  download: (id: string) => string;
}

const SITES: readonly Site[] = [
  { label: 'pobb.in', hosts: ['pobb.in'], path: new RegExp(`^/${ID}/?$`), download: (id) => `https://pobb.in/pob/${id}` },
  {
    label: 'Maxroll',
    hosts: ['maxroll.gg'],
    path: new RegExp(`^/poe2/pob/${ID}/?$`),
    download: (id) => `https://maxroll.gg/poe2/api/pob/${id}`,
  },
  {
    label: 'poe.ninja',
    hosts: ['poe.ninja', 'poe2.ninja'],
    path: new RegExp(`^/(?:poe2/)?pob/${ID}/?$`),
    download: (id) => `https://poe.ninja/poe2/pob/raw/${id}`,
  },
  { label: 'poe2db.tw', hosts: ['poe2db.tw'], path: new RegExp(`^/pob/${ID}/?$`), download: (id) => `https://poe2db.tw/pob/${id}/raw` },
];

const BARE_SITE_LINK = /^(?:pobb\.in|maxroll\.gg|poe2?\.ninja|poe2db\.tw)\//i;

const SUPPORTED = 'Paste a Path of Building 2 code, or a pobb.in, Maxroll, poe.ninja or poe2db.tw link.';

export type SourceResult = { ok: true; code: string; sourceUrl: string | null } | { ok: false; error: string };

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** The download URL for a pasted share link, or an error. Makes no request. */
function downloadUrlFor(input: string): { ok: true; url: string; site: Site } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return fail(`That link could not be read. ${SUPPORTED}`);
  }
  if (url.protocol !== 'https:') return fail(`Only https:// links can be imported. ${SUPPORTED}`);
  if (url.username || url.password || url.port) return fail(`That link is not a supported build site. ${SUPPORTED}`);

  const site = SITES.find((s) => s.hosts.includes(url.hostname));
  if (!site) return fail(`That link is not a supported build site. ${SUPPORTED}`);

  const id = site.path.exec(url.pathname)?.[1];
  if (!id) return fail(`That ${site.label} link is not a link to a Path of Building build.`);
  return { ok: true, url: site.download(id), site };
}

async function readCapped(response: Response): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_CODE_BYTES) return fail('That build is too large to import.');
  if (!response.body) return { ok: true, text: '' };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_CODE_BYTES) {
      await reader.cancel();
      return fail('That build is too large to import.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}

export async function resolvePobInput(input: string, fetchImpl: FetchLike = fetch): Promise<SourceResult> {
  let trimmed = input.trim();
  if (!trimmed) return fail(SUPPORTED);
  if (BARE_SITE_LINK.test(trimmed)) trimmed = `https://${trimmed}`;
  if (!trimmed.includes('://')) return { ok: true, code: trimmed, sourceUrl: null };

  const target = downloadUrlFor(trimmed);
  if (!target.ok) return target;

  let response: Response;
  try {
    response = await fetchImpl(target.url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'text/plain' },
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return fail(`${target.site.label} took too long to answer. Try again, or paste the build code instead.`);
    }
    // The underlying message can name hosts and addresses; the user needs none of it.
    return fail(`${target.site.label} could not be reached. Try again, or paste the build code instead.`);
  }

  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    return fail(`${target.site.label} redirected the request elsewhere, so it was not followed. Paste the build code instead.`);
  }
  if (response.status !== 200) {
    return fail(`${target.site.label} answered with status ${response.status}; the build may not exist.`);
  }

  const body = await readCapped(response);
  if (!body.ok) return body;
  const code = body.text.trim();
  if (!code) return fail(`${target.site.label} returned an empty build.`);
  return { ok: true, code, sourceUrl: target.url };
}
