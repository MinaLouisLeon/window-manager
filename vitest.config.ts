import { integr8Vitest } from '@integr8-media/config/vitest';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  integr8Vitest({ environment: 'jsdom', coverageThreshold: 80, setupFiles: './test/setup.ts' }),
  defineConfig({
    test: {
      // Unit tests sit next to the code. scripts/ tests cover the registry generator (outside
      // coverage, which is src/). The preset already skips playground/ and fixtures/ specs.
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
      // Vitest blanks CSS imports by default; tests that read the stylesheets use ?raw.
      css: { include: [/src[\\/]styles[\\/].*\.css/] },
      // M0 has no source tests yet; later milestones add them.
      passWithNoTests: true,
    },
  }),
);
