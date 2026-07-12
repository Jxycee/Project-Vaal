import { describe, it, expect } from 'vitest';
import manifest from '@/app/manifest';

describe('manifest', () => {
  it('has the required identity fields', () => {
    const result = manifest();
    expect(result.name).toBe('Project Vaal');
    expect(result.short_name).toBe('Vaal');
    expect(result.display).toBe('standalone');
    expect(result.start_url).toBe('/');
  });

  it('uses the exact dark-theme colors', () => {
    const result = manifest();
    expect(result.background_color).toBe('#0f0d0b');
    expect(result.theme_color).toBe('#c6a662');
  });

  it('includes 192 and 512 "any"-purpose icons plus a 512 maskable icon', () => {
    const result = manifest();
    const icons = result.icons ?? [];
    const any192 = icons.find((i) => i.sizes === '192x192' && i.purpose === 'any');
    const any512 = icons.find((i) => i.sizes === '512x512' && i.purpose === 'any');
    const maskable512 = icons.find((i) => i.sizes === '512x512' && i.purpose === 'maskable');
    expect(any192).toBeDefined();
    expect(any512).toBeDefined();
    expect(maskable512).toBeDefined();
    expect(any192?.src).toBe('/icons/pwa-192.png');
    expect(any512?.src).toBe('/icons/pwa-512.png');
    expect(maskable512?.src).toBe('/icons/pwa-512-maskable.png');
  });
});
