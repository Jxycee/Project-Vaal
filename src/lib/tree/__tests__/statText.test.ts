import { describe, it, expect } from 'vitest';
import { parseStatText } from '@/lib/tree/statText';

// Cases mirror the markup forms documented in statText.ts's own header
// comment, verified against real 0.5.2 node data.
describe('parseStatText', () => {
  it('leaves plain text untouched', () => {
    expect(parseStatText('+10 to maximum Life')).toBe('+10 to maximum Life');
  });

  it('unwraps [Token|Display] to the display text', () => {
    expect(parseStatText('[Fire|Fire] Damage')).toBe('Fire Damage');
  });

  it('unwraps a bare [Word] with no pipe to the word itself', () => {
    expect(parseStatText('[Poison]')).toBe('Poison');
  });

  it('strips <tag> wrappers around a granted skill name', () => {
    expect(parseStatText('<b>Bold</b> text')).toBe('Bold text');
  });

  it('unwraps {text} wrappers', () => {
    expect(parseStatText('Grants {Level 1} Fireball')).toBe('Grants Level 1 Fireball');
  });

  it('handles multiple markup forms combined in one line', () => {
    expect(parseStatText('[Cold|Cold] Resistance <i>+10%</i> {Notable}')).toBe(
      'Cold Resistance +10% Notable',
    );
  });

  it('handles an empty string', () => {
    expect(parseStatText('')).toBe('');
  });
});
