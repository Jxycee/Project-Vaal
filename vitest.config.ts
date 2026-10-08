import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    passWithNoTests: true,
    // The PoB catalogue, the oracle builds and the round-trip tests load megabytes of synced data; under a full
    // parallel run (and on a CI runner) they overrun vitest's 5s default and fail without anything being wrong.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
