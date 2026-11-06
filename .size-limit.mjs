// Bundle size budgets (docs/SPEC.md → Tests and playground). Run `npm run build` first.
// First guesses: after the first measured build, set each limit about 10% above the real size.
// The hook and shell entries are added with the milestones that create them (M6 and M10).
import { integr8SizeLimit } from '@integr8-media/config/size-limit';

export default integr8SizeLimit([
  {
    name: './core',
    path: 'dist/core/index.mjs',
    limit: '10 kB',
  },
  {
    name: 'styles.css',
    path: 'dist/styles.css',
    limit: '15 kB',
  },
]);
