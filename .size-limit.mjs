// Bundle size budgets (docs/SPEC.md → Tests and playground). Run `npm run build` first.
// size-limit ignores peerDependencies (react, ui, lucide-react), so the React entries are
// measured with ui external, as the spec asks.
// Limits are about 10% above the size measured with the 1.1.0 features (npm run build, npm run
// size): core 8.12 kB, useWindowFrame 3.73 kB, shell 21.98 kB, styles.css 10.66 kB.
import { integr8SizeLimit } from '@integr8-media/config/size-limit';

export default integr8SizeLimit([
  {
    name: './core',
    path: 'dist/core/index.mjs',
    limit: '9 kB',
  },
  {
    name: 'import { useWindowFrame }',
    path: 'dist/index.mjs',
    import: '{ useWindowFrame }',
    limit: '4.1 kB',
  },
  {
    // The spec gives no number for the whole shell (ui is external): measured, then +10%.
    name: 'import { WindowManagerShell }',
    path: 'dist/index.mjs',
    import: '{ WindowManagerShell }',
    limit: '24.2 kB',
  },
  {
    name: 'styles.css',
    path: 'dist/styles.css',
    limit: '11.7 kB',
  },
]);
