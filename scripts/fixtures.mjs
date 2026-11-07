// Checks the published shape of the package in three real apps:
//   fixtures/tailwind-app  uses theme.css with Tailwind v4
//   fixtures/plain-app     uses the prebuilt styles.css, no Tailwind
//   fixtures/shadcn-app    uses registry items installed with `npx shadcn add` from a local build
//
// Steps: build the package, pack it (as npm would publish it), install the tarball in the two npm
// fixtures, build each fixture, then add the registry items to the shadcn project (from a local
// build of the registry; the ui items come from the published ui registry, so this step needs
// network access), build it, and run fixtures/fixtures.spec.ts with Playwright against all three.
//
// Usage: npm run fixtures                (everything)
//        npm run fixtures -- --skip-build (reuse the current dist/)

import { execSync } from 'node:child_process';
import { createReadStream, existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = join(root, 'fixtures');
const tarball = join(fixturesDir, 'integr8-media-window-manager.tgz');
const apps = ['tailwind-app', 'plain-app'];
const registryPort = 61_300;

function run(command, cwd = root, env = {}) {
  console.log(`\n> ${command}  (${cwd === root ? '.' : cwd.slice(root.length + 1)})`);
  execSync(command, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
}

/** Serves dist/registry/ as http://localhost:<port>/r/<name>.json; resolves to a stop function. */
function serveRegistry() {
  const dir = join(root, 'dist', 'registry');
  const server = createServer((request, response) => {
    const file = join(dir, basename(new URL(request.url ?? '/', 'http://localhost').pathname));
    if (!existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    createReadStream(file).pipe(response);
  });
  return new Promise((done) => {
    server.listen(registryPort, () => done(() => server.close()));
  });
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

// The shadcn project: the items come from a local registry build whose URLs point at a local
// server; the ui items come from the published ui registry. dist/registry/ is rebuilt with the
// real URLs afterwards.
const shadcnDir = join(fixturesDir, 'shadcn-app');
run('node scripts/buildRegistry.mjs', root, {
  REGISTRY_BASE_URL: `http://localhost:${registryPort}/r`,
});
const stopRegistry = await serveRegistry();
try {
  run('npm install --no-package-lock --no-audit --no-fund', shadcnDir);
  run(
    'npx shadcn@latest add @integr8/theme @integr8-wm/window-manager-shell --yes --overwrite',
    shadcnDir,
  );
} finally {
  stopRegistry();
  run('node scripts/buildRegistry.mjs');
}
run('npm run build', shadcnDir);

run('npx --no playwright test --config fixtures/playwright.config.ts');
