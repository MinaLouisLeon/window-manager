// Maps every name that @integr8-media/ui exports to the ui registry item that holds it, so the
// registry generator can rewrite `import { Button } from '@integr8-media/ui'` into
// `import { Button } from '@/components/ui/button'` and depend on the ui `button` item.
//
// The map is built from the installed ui package's registry (its `dist/registry/*.json`), by
// reading the exports of each item's files. Pure helpers first, file reading last.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * @typedef {object} UiItemEntry
 * @property {string} item Name of the ui registry item, for example `button`.
 * @property {string} alias Import path in a shadcn project, for example `@/components/ui/button`.
 */

/** `ui/button.tsx` → `@/components/ui/button`, `lib/theme/useTheme.ts` → `@/lib/theme/useTheme`. */
export function aliasForFile(file) {
  const withoutExtension = file.replace(/\.(tsx?|mjs|js)$/, '');
  if (withoutExtension.startsWith('ui/')) return `@/components/${withoutExtension}`;
  return `@/${withoutExtension}`;
}

const DECLARATION =
  /^export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|enum|interface|type)\s+([A-Za-z_$][\w$]*)/gm;
const LIST = /^export\s+(?:type\s+)?\{([^}]*)\}/gm;

/**
 * Lists the names a source file exports: declarations (`export function X`, `export const X`,
 * `export type X`, ...) and export lists (`export { a, b as c }`, with or without `from`).
 * `export default` and `export *` are not names and are skipped.
 *
 * @param {string} content
 * @returns {string[]}
 */
export function exportedNames(content) {
  const names = new Set();
  for (const match of content.matchAll(DECLARATION)) names.add(match[1]);
  for (const match of content.matchAll(LIST)) {
    for (const part of match[1].split(',')) {
      const cleaned = part.trim().replace(/^type\s+/, '');
      if (cleaned === '') continue;
      const exported = cleaned.split(/\s+as\s+/).pop();
      if (exported && exported !== 'default') names.add(exported.trim());
    }
  }
  return [...names];
}

/**
 * Builds the name → item map from ui registry items (the parsed `<name>.json` files).
 * Items are read in name order; when two items export the same name, the first one wins.
 *
 * @param {{ name: string; files?: { path: string; content?: string }[] }[]} items
 * @returns {Map<string, UiItemEntry>}
 */
export function buildUiItemMap(items) {
  /** @type {Map<string, UiItemEntry>} */
  const map = new Map();
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
  for (const item of sorted) {
    for (const file of item.files ?? []) {
      if (typeof file.content !== 'string') continue;
      for (const name of exportedNames(file.content)) {
        if (!map.has(name)) map.set(name, { item: item.name, alias: aliasForFile(file.path) });
      }
    }
  }
  return map;
}

/**
 * Reads a ui registry folder (`node_modules/@integr8-media/ui/dist/registry`) and builds the map.
 *
 * @param {string} directory Folder that holds `<item>.json` files and `registry.json`.
 * @returns {Promise<Map<string, UiItemEntry>>}
 */
export async function loadUiItemMap(directory) {
  let entries;
  try {
    entries = await readdir(directory);
  } catch {
    throw new Error(
      `uiItemMap: cannot read ${directory}. Install @integr8-media/ui first (npm install).`,
    );
  }
  const names = entries.filter((entry) => entry.endsWith('.json') && entry !== 'registry.json');
  const items = await Promise.all(
    names.map(async (entry) => JSON.parse(await readFile(join(directory, entry), 'utf8'))),
  );
  return buildUiItemMap(items);
}
