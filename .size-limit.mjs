// Bundle size budgets (docs/SPEC.md → Tests and playground). Run `npm run build` first.
// size-limit ignores peerDependencies (react, ui, lucide-react), so the React entries are
// measured with ui external, as the spec asks.
// First guesses: after the first measured build, set each limit about 10% above the real size.
import { integr8SizeLimit } from '@integr8-media/config/size-limit';

export default integr8SizeLimit([
  {
    name: './core',
    path: 'dist/core/index.mjs',
    limit: '10 kB',
  },
  {
    name: 'import { useWindowFrame }',
    path: 'dist/index.mjs',
    import: '{ useWindowFrame }',
    limit: '14 kB',
  },
  {
    // The spec gives no number for the whole shell: this is a placeholder until measured.
    name: 'import { WindowManagerShell }',
    path: 'dist/index.mjs',
    import: '{ WindowManagerShell }',
    limit: '50 kB',
  },
  {
    name: 'styles.css',
    path: 'dist/styles.css',
    limit: '15 kB',
  },
]);
