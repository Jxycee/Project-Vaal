import { describe, it, expect } from 'vitest';
import { fmt, fmtCount, relativeTime } from './format';

describe('fmt', () => {
  it('renders non-finite input as an em dash', () => {
    expect(fmt(NaN)).toBe('—');
    expect(fmt(Infinity)).toBe('—');
  });

  it('renders zero as a bare 0', () => {
    expect(fmt(0)).toBe('0');
  });

  it('adds thousands separators above 1000', () => {
    expect(fmt(1972062)).toBe('1,972,062');
  });

  it('drops decimals in the hundreds', () => {
    expect(fmt(357.4)).toBe('357');
  });

  it('keeps one decimal in the tens', () => {
    expect(fmt(31.44)).toBe('31.4');
  });

  it('keeps two decimals below 10', () => {
    expect(fmt(2.61)).toBe('2.61');
  });

  it('inverts sub-0.01 values to a "1 / N" form', () => {
    expect(fmt(1 / 500)).toBe('1 / 500');
  });
});

describe('fmtCount', () => {
  it('renders non-finite input as an em dash', () => {
    expect(fmtCount(NaN)).toBe('—');
  });

  it('adds thousands separators above 100', () => {
    expect(fmtCount(1234)).toBe('1,234');
  });

  it('keeps one decimal in the tens', () => {
    expect(fmtCount(12.34)).toBe('12.3');
  });

  it('keeps two decimals below 10', () => {
    expect(fmtCount(1.234)).toBe('1.23');
  });
});

describe('relativeTime', () => {
  it('reports sub-minute timestamps as "just now"', () => {
    expect(relativeTime(new Date().toISOString())).toBe('just now');
  });

  it('reports minutes for timestamps under an hour old', () => {
    expect(relativeTime(new Date(Date.now() - 5 * 60000).toISOString())).toBe('5 min ago');
  });

  it('reports hours for timestamps under a day old', () => {
    expect(relativeTime(new Date(Date.now() - 3 * 3600000).toISOString())).toBe('3 hr ago');
  });

  it('reports singular "day" for exactly one day old', () => {
    expect(relativeTime(new Date(Date.now() - 24 * 3600000).toISOString())).toBe('1 day ago');
  });

  it('reports plural "days" for multiple days old', () => {
    expect(relativeTime(new Date(Date.now() - 3 * 24 * 3600000).toISOString())).toBe('3 days ago');
  });
});
