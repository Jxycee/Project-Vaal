import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePobCode, MAX_XML_BYTES } from '../decode';

// Failure modes first (AGENTS.md: "If you must test a system in isolation,
// FIRST write all the ways it could fail, THEN write the code"). The decoder
// takes untrusted text a user pasted, so each refusal here is a boundary, not
// a nicety — above all the size cap, without which a few kilobytes of crafted
// input inflate into gigabytes on the server.

/** Encodes XML the way PoB2 does: zlib-deflate, base64, then URL-safe. */
const toCode = (xml: string) =>
  deflateSync(Buffer.from(xml)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

describe('decodePobCode — every way it can fail', () => {
  it('refuses an empty or whitespace-only string', () => {
    expect(decodePobCode('')).toEqual({ ok: false, error: 'empty' });
    expect(decodePobCode('   \n\t')).toEqual({ ok: false, error: 'empty' });
  });

  it('refuses text that is not base64 at all', () => {
    expect(decodePobCode('this is a sentence, not a code!')).toEqual({ ok: false, error: 'not-base64' });
  });

  it('refuses a URL pasted where a code was expected', () => {
    // Resolving links is source.ts's job; handed one directly, the decoder
    // must refuse rather than try to base64-decode "https://…".
    expect(decodePobCode('https://pobb.in/TUsV2f6hi8cg')).toEqual({ ok: false, error: 'not-base64' });
  });

  it('refuses valid base64 that is not zlib data', () => {
    expect(decodePobCode(Buffer.from('plain text, never deflated').toString('base64'))).toEqual({
      ok: false,
      error: 'not-zlib',
    });
  });

  it('refuses a payload that inflates past the cap (zip-bomb shape)', () => {
    // Highly compressible on purpose: this is a few kilobytes on the wire.
    const bomb = toCode('<PathOfBuilding2>' + 'A'.repeat(MAX_XML_BYTES + 1) + '</PathOfBuilding2>');
    expect(bomb.length).toBeLessThan(20_000);
    expect(decodePobCode(bomb)).toEqual({ ok: false, error: 'too-large' });
  });

  it('refuses a Path of Building 1 code (root <PathOfBuilding>, not <PathOfBuilding2>)', () => {
    expect(decodePobCode(toCode('<?xml version="1.0"?><PathOfBuilding><Build/></PathOfBuilding>'))).toEqual({
      ok: false,
      error: 'not-pob2',
    });
  });

  it('refuses inflated text that is not XML', () => {
    expect(decodePobCode(toCode('{"json": true}'))).toEqual({ ok: false, error: 'not-pob2' });
  });

  it('refuses a document whose PathOfBuilding2 is not the root element', () => {
    expect(decodePobCode(toCode('<Wrapper><PathOfBuilding2/></Wrapper>'))).toEqual({ ok: false, error: 'not-pob2' });
  });
});

describe('decodePobCode — success', () => {
  it('decodes the real vendored code byte-for-byte', () => {
    const code = readFileSync('src/lib/pob/__fixtures__/sample-pob2-code.txt', 'utf8');
    const result = decodePobCode(code);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 36,691 bytes, as recorded by the decode spike.
      expect(Buffer.byteLength(result.xml)).toBe(36_691);
      expect(result.xml).toContain('<PathOfBuilding2>');
    }
  });

  it('tolerates surrounding whitespace and standard (non-URL-safe) base64', () => {
    const standard = deflateSync(Buffer.from('<PathOfBuilding2></PathOfBuilding2>')).toString('base64');
    expect(decodePobCode(`\n  ${standard}  \n`).ok).toBe(true);
  });

  it('accepts an XML declaration before the root', () => {
    expect(decodePobCode(toCode('<?xml version="1.0" encoding="UTF-8"?>\n<PathOfBuilding2></PathOfBuilding2>')).ok).toBe(
      true,
    );
  });
});
