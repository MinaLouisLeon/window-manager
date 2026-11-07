// Builds the static registry site into site/:
//   site/index.html                    landing page: setup and the item list by category
//   site/components/<name>/index.html  one page per item: install command, dependencies, live
//                                      stories from the playground and the source files
//   site/r/                            the registry JSON files (from dist/registry/)
//   site/playground/                   the Ladle playground (from playground/dist/), if built
//
// .github/workflows/registry.yml deploys site/ to GitHub Pages. The playground is optional:
// without it the item pages have no live previews.
//
// Usage: node scripts/buildRegistry.mjs && node scripts/buildRegistrySite.mjs

import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../registry/registry.config.mjs';
import { resolveBaseUrl } from './registryItems.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registryDir = join(root, 'dist', 'registry');
const playgroundDir = join(root, 'playground', 'dist');
const siteDir = join(root, 'site');

const pkgJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const index = JSON.parse(await readFile(join(registryDir, 'registry.json'), 'utf8'));
const baseUrl = resolveBaseUrl(config.baseUrl, pkgJson);
const namespace = '@integr8-wm';

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

/** Escapes text for HTML. */
function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** The item name in a registry dependency URL (`…/r/window.json` → `window`). */
function itemNameFromUrl(url) {
  return String(url)
    .replace(/[?#].*$/, '')
    .replace(/^.*\//, '')
    .replace(/\.json$/, '');
}

/** Items grouped by their first category, in a fixed order. */
function groupByCategory(items) {
  const order = ['core', 'hooks', 'window', 'shell', 'notification-area'];
  const groups = new Map();
  for (const item of items) {
    const category = item.categories?.[0] ?? 'other';
    groups.set(category, [...(groups.get(category) ?? []), item]);
  }
  return [...groups.entries()].sort(
    ([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99),
  );
}

const STYLE = `<style>
:root { color-scheme: light dark; }
body { font: 16px/1.5 system-ui, sans-serif; max-width: 56rem; margin: 0 auto; padding: 1rem; }
pre { overflow-x: auto; padding: 0.75rem; border-radius: 0.5rem; background: color-mix(in oklab, currentColor 8%, transparent); font-size: 0.85rem; }
iframe { width: 100%; height: 28rem; border: 1px solid color-mix(in oklab, currentColor 25%, transparent); border-radius: 0.5rem; }
nav a { margin-right: 1rem; }
details { margin: 0.5rem 0; }
summary { cursor: pointer; font-family: ui-monospace, monospace; }
</style>`;

function page(title, body, depth) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${STYLE}
</head>
<body>
<nav><a href="${'../'.repeat(depth)}./">Registry</a>${
    existsSync(join(playgroundDir, 'index.html'))
      ? `<a href="${'../'.repeat(depth)}playground/">Playground</a>`
      : ''
  }</nav>
${body}
</body>
</html>
`;
}

// Full items (with file contents); registry.json leaves them out.
const items = await Promise.all(
  index.items.map(async ({ name }) =>
    JSON.parse(await readFile(join(registryDir, `${name}.json`), 'utf8')),
  ),
);

await rm(siteDir, { recursive: true, force: true });
await mkdir(siteDir, { recursive: true });
await cp(registryDir, join(siteDir, 'r'), { recursive: true });

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

const usedBy = new Map();
for (const item of items) {
  for (const url of item.registryDependencies ?? []) {
    const dependency = itemNameFromUrl(url);
    usedBy.set(dependency, [...(usedBy.get(dependency) ?? []), item.name]);
  }
}

const itemLink = (name, depth) => `${'../'.repeat(depth)}components/${name}/`;

function renderItemPage(item) {
  const stories = storiesOf(item.name);
  const dependencies = (item.registryDependencies ?? []).map(itemNameFromUrl);
  const list = (names, depth = 2) =>
    names.length === 0
      ? '<p>None.</p>'
      : `<ul>${names
          .map((name) => {
            const known = items.some((entry) => entry.name === name);
            return `<li>${known ? `<a href="${itemLink(name, depth)}"><code>${escapeHtml(name)}</code></a>` : `<code>${escapeHtml(name)}</code> (ui registry)`}</li>`;
          })
          .join('')}</ul>`;
  const body = `<h1>${escapeHtml(item.title ?? item.name)}</h1>
<p>${escapeHtml(item.description ?? '')}</p>
<h2>Install</h2>
<pre>npx shadcn@latest add ${namespace}/${escapeHtml(item.name)}</pre>
${item.docs ? `<p>${escapeHtml(item.docs)}</p>` : ''}
<p><a href="../../r/${escapeHtml(item.name)}.json">Registry JSON</a>${
    item.categories?.length ? ` · category: ${escapeHtml(item.categories.join(', '))}` : ''
  }</p>
${
  stories.length === 0 || !hasPlayground
    ? ''
    : `<h2>Live</h2>
${stories
  .map(
    (story) => `<h3>${escapeHtml(story.name)}</h3>
<iframe loading="lazy" title="${escapeHtml(story.name)}" src="../../playground/?story=${encodeURIComponent(story.id)}&amp;mode=preview&amp;integr8Embed=1"></iframe>`,
  )
  .join('\n')}`
}
<h2>Needs</h2>
<h3>Registry items</h3>
${list(dependencies)}
<h3>npm packages</h3>
${
  (item.dependencies ?? []).length === 0
    ? '<p>None.</p>'
    : `<ul>${item.dependencies.map((name) => `<li><code>${escapeHtml(name)}</code></li>`).join('')}</ul>`
}
<h3>Used by</h3>
${list([...new Set(usedBy.get(item.name) ?? [])].sort())}
<h2>Files</h2>
${(item.files ?? [])
  .map(
    (file) => `<details>
<summary>${escapeHtml(file.target ?? file.path)}</summary>
<pre><code>${escapeHtml(file.content ?? '')}</code></pre>
</details>`,
  )
  .join('\n')}`;
  return page(`${item.title ?? item.name} · ${pkgJson.name}`, body, 2);
}

for (const item of items) {
  const dir = join(siteDir, 'components', item.name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), renderItemPage(item));
}

const groups = groupByCategory(index.items);
const sections = groups
  .map(
    ([category, entries]) => `<section>
<h2>${escapeHtml(category)}</h2>
<ul>
${entries
  .map(
    (item) =>
      `<li><a href="components/${escapeHtml(item.name)}/"><code>${escapeHtml(item.name)}</code></a> – ${escapeHtml(item.description ?? item.title ?? '')}</li>`,
  )
  .join('\n')}
</ul>
</section>`,
  )
  .join('\n');

const landing = `<h1>${escapeHtml(pkgJson.name)}</h1>
<p>${escapeHtml(pkgJson.description)}</p>
<h2>Setup</h2>
<p>Add the namespaces once to <code>components.json</code>:</p>
<pre>{ "registries": {
  "@integr8": "https://minalouisleon.github.io/integr8-ui/r/{name}.json",
  "${namespace}": "${escapeHtml(baseUrl)}/{name}.json"
} }</pre>
<pre>npx shadcn@latest add @integr8/theme
npx shadcn@latest add ${namespace}/window-manager-shell</pre>
<h2>Items</h2>
${index.items.length === 0 ? '<p>No items yet.</p>' : sections}
<p><small>Version ${escapeHtml(pkgJson.version)} · registry at <code>${escapeHtml(baseUrl)}</code></small></p>`;

await writeFile(join(siteDir, 'index.html'), page(`${pkgJson.name} registry`, landing, 0));
// Serve files as they are (no Jekyll processing on GitHub Pages).
await writeFile(join(siteDir, '.nojekyll'), '');

console.log(
  `site/ (index.html + ${items.length} item pages + r/${hasPlayground ? ' + playground/' : ''}) for ${baseUrl}`,
);
