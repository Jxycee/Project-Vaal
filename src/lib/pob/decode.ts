// src/lib/pob/decode.ts
// =============================================================================
// Path of Building 2 share code -> XML text.
//
// The wire format, confirmed by decoding a real pobb.in code
// (docs/superpowers/specs/2026-09-23-pob2-decode-findings.md) and matching
// PoB2's own ImportTab.lua: zlib-deflate the XML, base64 it, then make it
// URL-safe ('+' -> '-', '/' -> '_').
//
// Pure: no network, no knowledge of our data. The input is text a user pasted,
// so every step is a boundary. The one that matters most is the inflate cap —
// without it a few kilobytes of crafted input would inflate into gigabytes on
// the server.
// =============================================================================

import { inflateSync } from 'node:zlib';

/**
 * Upper bound on the inflated XML. The real 8-checkpoint build this was
 * designed against is 36 KB, so 2 MB leaves room for very large builds while
 * keeping a crafted payload from exhausting memory.
 */
export const MAX_XML_BYTES = 2 * 1024 * 1024;

export type DecodeError = 'empty' | 'not-base64' | 'not-zlib' | 'too-large' | 'not-pob2';

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * An optional BOM, an optional XML declaration, then the root element — which
 * must be <PathOfBuilding2>. Path of Building 1 writes <PathOfBuilding>, and
 * its data (tree, gems, items) is a different game's, so it is refused here
 * rather than half-imported later.
 */
const POB2_ROOT = /^﻿?\s*(<\?xml[^>]*\?>\s*)?<PathOfBuilding2[\s>/]/;

export function decodePobCode(code: string): { ok: true; xml: string } | { ok: false; error: DecodeError } {
  // Whitespace anywhere is dropped, not just at the ends: codes copied out of
  // paste sites and chat often arrive wrapped across lines.
  const compact = code.replace(/\s+/g, '');
  if (compact === '') return { ok: false, error: 'empty' };

  const standard = compact.replace(/-/g, '+').replace(/_/g, '/');
  if (!BASE64.test(standard)) return { ok: false, error: 'not-base64' };

  let inflated: Buffer;
  try {
    inflated = inflateSync(Buffer.from(standard, 'base64'), { maxOutputLength: MAX_XML_BYTES });
  } catch (error) {
    // Node reports the cap as a RangeError with this code (verified on
    // Node 26.3). Anything else means the bytes were never zlib data.
    if ((error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') {
      return { ok: false, error: 'too-large' };
    }
    return { ok: false, error: 'not-zlib' };
  }

  const xml = inflated.toString('utf8');
  if (!POB2_ROOT.test(xml)) return { ok: false, error: 'not-pob2' };

  return { ok: true, xml };
}
