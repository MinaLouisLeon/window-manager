// Builds the shadcn registry into dist/registry/: `window-manager-core` (the core as one item),
// one item per hook and per component, `window-manager-shell` (the whole desktop), plus
// registry.json (the index). Config: registry/registry.config.mjs.
//
// Usage: node scripts/buildRegistry.mjs   (runs as the last step of `npm run build`)
//   REGISTRY_BASE_URL=https://example.com/r node scripts/buildRegistry.mjs   (another host)
//
// It reads the installed @integr8-media/ui package (its dist/registry and package.json) to map
// ui imports to ui registry items, so run `npm install` first. Node built-ins only otherwise.
//
// Install an item into a shadcn project:
//   npx shadcn@latest add @integr8-wm/window-manager-shell

import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../registry/registry.config.mjs';
import { buildRegistryIndex, buildRegistryItems } from './registryItems.mjs';
import { loadUiItemMap } from './uiItemMap.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'dist', 'registry');

/** Every file under a folder (or the file itself), as repo-relative forward-slash paths. */
async function listFiles(source) {
  const absolute = join(root, source);
  let info;
  try {
    info = await stat(absolute);
  } catch (error) {
    // A source folder that a later milestone adds (src/react, src/components) may not exist yet.
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  if (info.isFile()) return [source];
  const entries = await readdir(absolute, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(tsx?)$/.test(entry.name))
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).replaceAll('\\', '/'));
}

const paths = (await Promise.all(config.sources.map(listFiles)))
  .flat()
  .filter((path) => !config.exclude.some((pattern) => pattern.test(path)))
  .sort();

const files = await Promise.all(
  paths.map(async (path) => ({ path, content: await readFile(join(root, path), 'utf8') })),
);

const pkgJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const uiPkgJson = JSON.parse(await readFile(join(root, config.ui.packageJson), 'utf8'));
const pkg = {
  name: pkgJson.name,
  version: pkgJson.version,
  homepage: pkgJson.homepage,
  // Version ranges for npm imports come from ui's package.json (for example lucide-react).
  dependencies: { ...uiPkgJson.dependencies, ...pkgJson.dependencies },
};

const uiMap = await loadUiItemMap(join(root, config.ui.registryDir));
const items = buildRegistryItems(files, pkg, config, uiMap);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await Promise.all(
  items.map((item) =>
    writeFile(join(outDir, `${item.name}.json`), `${JSON.stringify(item, null, 2)}\n`),
  ),
);
await writeFile(
  join(outDir, 'registry.json'),
  `${JSON.stringify(buildRegistryIndex(items, pkg), null, 2)}\n`,
);

console.log(`dist/registry/ (${items.length} items + registry.json)`);
