// Checks the published shape of the package in three real apps:
//   fixtures/tailwind-app  uses theme.css with Tailwind v4
//   fixtures/plain-app     uses the prebuilt styles.css, no Tailwind
//   fixtures/shadcn-app    uses registry items installed with `npx shadcn add` from a local build
//
// Steps: build the package, pack it (as npm would publish it), install the tarball in the two npm
// fixtures, build each fixture, then run fixtures/fixtures.spec.ts with Playwright.
// M0 only installs and builds the two npm fixtures; M11 fills in the shadcn-app and the checks.
//
// Usage: npm run fixtures                (everything)
//        npm run fixtures -- --skip-build (reuse the current dist/)

import { execSync } from 'node:child_process';
import { readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = join(root, 'fixtures');
const tarball = join(fixturesDir, 'integr8-media-window-manager.tgz');
const apps = ['tailwind-app', 'plain-app'];

function run(command, cwd = root) {
  console.log(`\n> ${command}  (${cwd === root ? '.' : cwd.slice(root.length + 1)})`);
  execSync(command, { cwd, stdio: 'inherit' });
}

if (!process.argv.includes('--skip-build')) run('npm run build');

// Pack exactly what npm would publish, under a fixed name the fixtures point at.
for (const file of readdirSync(fixturesDir)) {
  if (file.endsWith('.tgz')) rmSync(join(fixturesDir, file));
}
run(`npm pack --pack-destination "${fixturesDir}"`);
const packed = readdirSync(fixturesDir).find((file) => file.endsWith('.tgz'));
if (!packed) throw new Error('fixtures: npm pack did not write a tarball.');
renameSync(join(fixturesDir, packed), tarball);

for (const app of apps) {
  const cwd = join(fixturesDir, app);
  // Drop the old copy so npm unpacks the new tarball (the version may not have changed).
  rmSync(join(cwd, 'node_modules', '@integr8-media', 'window-manager'), {
    recursive: true,
    force: true,
  });
  run('npm install --no-package-lock --no-audit --no-fund', cwd);
  run('npm run build', cwd);
}

run('npx --no playwright test --config fixtures/playwright.config.ts');
