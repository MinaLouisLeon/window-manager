import { integr8Tsdown } from '@integr8-media/config/tsdown';
import { defineConfig } from 'tsdown';

// `unbundle` keeps one output file per source file, so `dist/core/index.mjs` stays free of React
// and the registry-friendly file layout survives in the build.
export default defineConfig(
  integr8Tsdown({
    entry: ['src/index.ts', 'src/core/index.ts'],
    platform: 'browser',
    unbundle: true,
  }),
);
