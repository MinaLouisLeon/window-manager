// Builds the static registry site into site/:
//   site/index.html   landing page: setup and the item list by category (a basic version; M11
//                     adds one documentation page per item, adapted from integr8-ui's site)
//   site/r/           the registry JSON files (from dist/registry/)
//   site/playground/  the Ladle playground (from playground/dist/), if built
//
// .github/workflows/registry.yml deploys site/ to GitHub Pages.
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

/** Escapes text for HTML. */
function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
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

await rm(siteDir, { recursive: true, force: true });
await mkdir(siteDir, { recursive: true });
await cp(registryDir, join(siteDir, 'r'), { recursive: true });

const hasPlayground = existsSync(join(playgroundDir, 'index.html'));
if (hasPlayground) await cp(playgroundDir, join(siteDir, 'playground'), { recursive: true });

const namespace = baseUrl.replace(/\/r$/, '');
const groups = groupByCategory(index.items);
const sections = groups
  .map(
    ([category, items]) => `<section>
<h2>${escapeHtml(category)}</h2>
<ul>
${items
  .map(
    (item) =>
      `<li><code>${escapeHtml(item.name)}</code> – ${escapeHtml(item.description ?? item.title ?? '')} <a href="r/${escapeHtml(item.name)}.json">JSON</a></li>`,
  )
  .join('\n')}
</ul>
</section>`,
  )
  .join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(pkgJson.name)} registry</title>
<style>
:root { color-scheme: light dark; }
body { font: 16px/1.5 system-ui, sans-serif; max-width: 52rem; margin: 0 auto; padding: 1rem; }
pre { overflow-x: auto; padding: 0.75rem; border-radius: 0.5rem; background: color-mix(in oklab, currentColor 8%, transparent); }
</style>
</head>
<body>
<h1>${escapeHtml(pkgJson.name)}</h1>
<p>${escapeHtml(pkgJson.description)}</p>
<h2>Setup</h2>
<p>Add the namespaces once to <code>components.json</code>:</p>
<pre>{ "registries": {
  "@integr8": "https://minalouisleon.github.io/integr8-ui/r/{name}.json",
  "@integr8-wm": "${escapeHtml(baseUrl)}/{name}.json"
} }</pre>
<pre>npx shadcn@latest add @integr8/theme
npx shadcn@latest add @integr8-wm/window-manager-shell</pre>
${hasPlayground ? '<p><a href="playground/">Playground</a></p>' : ''}
<h2>Items</h2>
${index.items.length === 0 ? '<p>No items yet.</p>' : sections}
<p><small>Version ${escapeHtml(pkgJson.version)} · registry at <code>${escapeHtml(namespace)}</code></small></p>
</body>
</html>
`;

await writeFile(join(siteDir, 'index.html'), html);
// Serve files as they are (no Jekyll processing on GitHub Pages).
await writeFile(join(siteDir, '.nojekyll'), '');

console.log(`site/ (index.html + r/${hasPlayground ? ' + playground/' : ''}) for ${baseUrl}`);
