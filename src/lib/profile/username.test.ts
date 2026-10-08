// Written BEFORE username.ts (AGENTS.md: isolated systems get their failure
// modes listed first). Ways this can fail:
//
//  format
//   1. Too short (2) or too long (21) slips through, or the bounds are off by one.
//   2. A character outside [A-Za-z0-9_-] (space, dot, unicode, emoji) is accepted.
//   3. Surrounding whitespace is rejected instead of trimmed - or interior
//      whitespace is silently trimmed into a different name.
//   4. Non-string input (server functions are reachable by direct POST) throws.
//
//  filter too LOOSE
//   5. A blocked term is caught only in one case ("NAME" vs "name").
//   6. A leetspeak / repeated-letter disguise of a blocked term gets through.
//   7. A blocked term glued between separators ("x_<term>_y", "x-<term>") gets through.
//
//  filter too STRICT (the user's explicit worry)
//   8. General profanity (fuck/bitch/shit/ass/dick...) is blocked, incl. mixed
//      case and embedded in a longer name ("FuckThisBoss").
//   9. Innocent names containing a blocked term as a substring (Scunthorpe
//      problem: "Essex", "Classic", "Assassin") are blocked.
//  10. Every ordinary name is blocked because the matcher is misbuilt.
//
// Blocked terms are NOT written literally here: they are derived from the
// tuned dataset itself, so this file stays clean and cannot drift from it.
import { describe, expect, it } from 'vitest';
import { DataSet, RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';
import { ALLOWED_PROFANITY, USERNAME_RE, isOffensive, validateUsername } from './username';

function allOriginalWords(): string[] {
  const words: string[] = [];
  new DataSet<{ originalWord: string }>().addAll(englishDataset).removePhrasesIf((p) => {
    if (p.metadata?.originalWord) words.push(p.metadata.originalWord);
    return false;
  });
  return [...new Set(words)];
}

// A few dataset originalWords are not themselves matched by their own pattern
// (the dataset stores a stem or a spaced form), so only take words the UNTUNED
// dataset flags. That keeps the list to real, testable terms.
const baseline = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });
const STILL_BLOCKED = allOriginalWords().filter(
  (w) => !ALLOWED_PROFANITY.has(w) && /^[a-z]+$/.test(w) && w.length >= 4 && baseline.hasMatch(w),
);

// Simple leetspeak: vowels to digits/symbols the transformers should undo.
function leet(word: string): string {
  return word.replace(/a/g, '4').replace(/e/g, '3').replace(/i/g, '1').replace(/o/g, '0');
}

describe('validateUsername - format', () => {
  it('accepts the 3 and 20 character bounds, and underscore, hyphen, digits, mixed case', () => {
    expect(validateUsername('abc')).toEqual({ ok: true, value: 'abc' });
    expect(validateUsername('a'.repeat(20))).toEqual({ ok: true, value: 'a'.repeat(20) });
    for (const n of ['Under_Score', 'hy-phen', '123', 'MiXeD_9-z']) {
      expect(validateUsername(n)).toEqual({ ok: true, value: n });
    }
  });
  it('rejects 2 and 21 characters with the format message', () => {
    for (const n of ['ab', 'a'.repeat(21), '']) {
      const r = validateUsername(n);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe('3–20 characters: letters, numbers, _ or -');
    }
  });
  it('rejects characters outside letters, digits, _ and -', () => {
    for (const n of ['has space', 'dot.name', 'ünïcode', 'emoji😀ok', 'semi;colon', 'slash/name']) {
      expect(validateUsername(n).ok).toBe(false);
    }
  });
  it('trims surrounding whitespace but not interior', () => {
    expect(validateUsername('  padded  ')).toEqual({ ok: true, value: 'padded' });
    expect(validateUsername('in ner').ok).toBe(false);
  });
  it('does not throw on non-string input', () => {
    for (const v of [null, undefined, 42, {}, ['abc']]) {
      expect(validateUsername(v as unknown as string).ok).toBe(false);
    }
  });
  it('USERNAME_RE agrees with the database CHECK', () => {
    expect(USERNAME_RE.source).toBe('^[A-Za-z0-9_-]{3,20}$');
  });
});

describe('isOffensive - general profanity stays allowed', () => {
  it('allows general profanity: bare, mixed case, embedded, separated', () => {
    for (const name of ['fuck', 'Bitch', 'DiCk', 'FuckThisBoss', 'holy-shit', 'BadAss99']) {
      expect(isOffensive(name), name).toBe(false);
      expect(validateUsername(name).ok, name).toBe(true);
    }
  });
  it('does not flag Scunthorpe-style innocent names or ordinary names', () => {
    for (const n of ['Essex', 'Classic', 'Assassin', 'Scunthorpe', 'Therapist', 'Witch_Queen', 'Ranger99', 'Vaal-Orb']) {
      expect(isOffensive(n), n).toBe(false);
    }
  });
});

describe('isOffensive - blocked terms stay blocked', () => {
  it('the dataset still yields blocked terms to test (guards against an empty derivation)', () => {
    expect(STILL_BLOCKED.length).toBeGreaterThan(20);
  });
  it('blocks every remaining term, in any case, and inside separators', () => {
    for (const w of STILL_BLOCKED) {
      expect(isOffensive(w), w).toBe(true);
      expect(isOffensive(w.toUpperCase()), w).toBe(true);
      expect(isOffensive(`x_${w}_y`), w).toBe(true);
      expect(validateUsername(`x_${w}`).ok, w).toBe(false);
    }
  });
  it('blocks leetspeak disguises for most terms', () => {
    const disguised = STILL_BLOCKED.map(leet).filter((d, i) => d !== STILL_BLOCKED[i]);
    expect(disguised.length).toBeGreaterThan(10);
    const caught = disguised.filter((d) => isOffensive(d)).length;
    // Transformers undo digit/symbol substitution; expect near-total coverage.
    expect(caught / disguised.length).toBeGreaterThan(0.9);
  });
  it('blocks a repeated-letter disguise', () => {
    const w = STILL_BLOCKED[0];
    const stretched = w.replace(/(.)/g, '$1$1');
    expect(isOffensive(stretched), stretched).toBe(true);
  });
  it('every allow-listed word is a real dataset entry that is now permitted', () => {
    // Guards the allow-list against going stale (a renamed/removed dataset
    // entry would otherwise silently stop doing anything) and proves each
    // removal took effect.
    const inDataset = new Set(allOriginalWords());
    for (const w of ALLOWED_PROFANITY) {
      expect(inDataset.has(w), w).toBe(true);
      expect(baseline.hasMatch(w), w).toBe(true);
      expect(isOffensive(w), w).toBe(false);
    }
  });
});
