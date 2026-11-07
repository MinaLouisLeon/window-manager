// Builds the static registry site into site/, in the same look as the integr8-ui site:
//   site/index.html                    landing page (scripts/registryPage.mjs)
//   site/components/<name>/index.html  one documentation page per item (scripts/itemPage.mjs)
//   site/r/                            the registry JSON files (from dist/registry/)
//   site/assets/fonts.css              self-hosted fonts (copied from the installed ui package)
//   site/playground/                   the Ladle playground (from playground/dist/), if built
//
// .github/workflows/registry.yml deploys site/ to GitHub Pages. The fonts and the playground are
// optional: without them the pages fall back to system fonts and have no live previews.
//
// Usage: node scripts/buildRegistry.mjs && node scripts/buildRegistrySite.mjs

import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../registry/registry.config.mjs';
import { itemDocs, itemNameFromUrl, renderItemPage } from './itemPage.mjs';
import { resolveBaseUrl } from './registryItems.mjs';
import { renderRegistryPage } from './registryPage.mjs';
import { groupItems } from './siteLayout.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registryDir = join(root, 'dist', 'registry');
const playgroundDir = join(root, 'playground', 'dist');
// The ui package ships its self-hosted fonts next to its registry.
const uiDistDir = dirname(join(root, config.ui.registryDir));
const siteDir = join(root, 'site');
const docsPath = 'components/';

const pkgJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const index = JSON.parse(await readFile(join(registryDir, 'registry.json'), 'utf8'));
const baseUrl = resolveBaseUrl(config.baseUrl, pkgJson);
const uiBaseUrl = config.ui.baseUrl.replace(/\/$/, '');
// The ui site keeps its item pages next to its registry folder: …/integr8-ui/components/<name>/.
const uiDocsUrl = `${uiBaseUrl.replace(/\/r$/, '/')}components/`;
const repositoryUrl = `https://github.com/${process.env.GITHUB_REPOSITORY ?? 'MinaLouisLeon/window-manager'}`;

/**
 * Which Ladle stories show which item: a part of the story id (Ladle ids look like
 * `components--window-default`). An item that is not listed has no live preview.
 */
export const STORIES = {
  window: ['--window-'],
  'window-title-bar': ['--title-bar-and-controls-'],
  'window-controls': ['--title-bar-and-controls-'],
  'window-menu': ['--window-menu-content'],
  'snap-preview': ['--desktop-surface'],
  'close-guard-dialog': ['--close-guard'],
  desktop: ['--desktop-surface'],
  'desktop-icons': ['--desktop-icons-grid'],
  'desktop-menu': ['--desktop-menu-content'],
  taskbar: ['--taskbar-'],
  'start-menu': ['--start-menu-open'],
  'window-switcher': ['--window-switcher-overlay'],
  'desktop-switcher': ['--desktop-switcher-popover'],
  'window-manager-shell': ['shell--'],
};

// Full items (with file contents); registry.json leaves them out.
const items = await Promise.all(
  index.items.map(async ({ name }) =>
    JSON.parse(await readFile(join(registryDir, `${name}.json`), 'utf8')),
  ),
);

await rm(siteDir, { recursive: true, force: true });
await mkdir(siteDir, { recursive: true });
await cp(registryDir, join(siteDir, 'r'), { recursive: true });

const hasFonts = existsSync(join(uiDistDir, 'fonts.css')) && existsSync(join(uiDistDir, 'fonts'));
if (hasFonts) {
  await mkdir(join(siteDir, 'assets'), { recursive: true });
  await cp(join(uiDistDir, 'fonts.css'), join(siteDir, 'assets', 'fonts.css'));
  await cp(join(uiDistDir, 'fonts'), join(siteDir, 'assets', 'fonts'), { recursive: true });
}

const hasPlayground = existsSync(join(playgroundDir, 'index.html'));
let ladleStories = {};
if (hasPlayground) {
  await cp(playgroundDir, join(siteDir, 'playground'), { recursive: true });
  const metaPath = join(playgroundDir, 'meta.json');
  if (existsSync(metaPath)) {
    ladleStories = JSON.parse(await readFile(metaPath, 'utf8')).stories ?? {};
  }
}

function storiesOf(name) {
  const parts = STORIES[name] ?? [];
  return Object.entries(ladleStories)
    .filter(([id]) => parts.some((part) => id.includes(part)))
    .map(([id, story]) => ({ id, name: story.name ?? id }));
}

// The first story of each item, for the landing page's "Preview" buttons.
const previewStories = {};
for (const { name } of index.items) {
  const first = storiesOf(name)[0];
  if (first) previewStories[name] = first.id;
}

// Who documents which export (for links between pages), and who uses which item.
const exportOwners = new Map();
const usedBy = new Map();
for (const item of items) {
  for (const doc of itemDocs(item)) {
    if (!exportOwners.has(doc.name)) exportOwners.set(doc.name, item.name);
  }
  for (const url of item.registryDependencies ?? []) {
    const dependency = itemNameFromUrl(url);
    usedBy.set(dependency, [...(usedBy.get(dependency) ?? []), item.name]);
  }
}

const groups = groupItems(index.items);
const site = {
  baseUrl,
  uiBaseUrl,
  uiDocsUrl,
  version: pkgJson.version,
  registryName: pkgJson.name,
  groups,
  order: groups.flatMap((group) => group.items),
  exportOwners,
  docsPath,
  repositoryUrl,
  ...(hasPlayground ? { playgroundPath: 'playground/' } : {}),
  ...(hasFonts ? { fontsHref: 'assets/fonts.css' } : {}),
};

for (const item of items) {
  const folder = join(siteDir, docsPath, item.name);
  await mkdir(folder, { recursive: true });
  await writeFile(
    join(folder, 'index.html'),
    renderItemPage(
      { item, stories: storiesOf(item.name), usedBy: [...(usedBy.get(item.name) ?? [])].sort() },
      site,
    ),
  );
}

await writeFile(
  join(siteDir, 'index.html'),
  renderRegistryPage(index, {
    baseUrl,
    uiBaseUrl,
    version: pkgJson.version,
    docsPath,
    repositoryUrl,
    previewStories,
    ...(previewStories['window-manager-shell']
      ? { defaultStory: previewStories['window-manager-shell'] }
      : {}),
    ...(hasPlayground ? { playgroundPath: 'playground/' } : {}),
    ...(hasFonts ? { fontsHref: 'assets/fonts.css' } : {}),
  }),
);
// Serve files as they are (no Jekyll processing on GitHub Pages).
await writeFile(join(siteDir, '.nojekyll'), '');

console.log(
  `site/ (index.html + ${items.length} item pages + r/${hasFonts ? ', fonts' : ''}${hasPlayground ? ', playground' : ''}) for ${baseUrl}`,
);
