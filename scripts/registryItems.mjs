// Pure helpers for the shadcn registry generator (no file system access, so they are easy to
// test). scripts/buildRegistry.mjs reads the files and writes the JSON.
//
// Adapted from integr8-ui's generator. Differences: hooks come from src/react, components from
// src/components, imports from @integr8-media/ui are rewritten to ui registry items, and there
// is no theme or fonts item (the ui registry has them).

/**
 * A folder that becomes one registry item with many files (the core). Its files keep their
 * names and folders under `target`, so imports between them stay relative.
 *
 * @typedef {object} RegistryBundle
 * @property {string} name Item name, for example `window-manager-core`.
 * @property {string} title Item title.
 * @property {string} description Item description.
 * @property {string} target shadcn target placeholder for the folder, for example `@lib/window-manager/`.
 * @property {string} alias Import path of the folder in a shadcn project, for example `@/lib/window-manager/`.
 * @property {string[]} [registryDependencies] Names of other items it needs.
 * @property {string[]} [categories] Registry categories, for example `['core']`.
 * @property {string} [docs] Message shown after `shadcn add` (default: the config's `docs`).
 */

/**
 * @typedef {object} RegistryConfig
 * @property {string} baseUrl Where this registry's JSON files are served; `{name}` and `{version}` are filled in.
 * @property {{ package: string; baseUrl: string; registryDir: string; packageJson: string }} ui The ui package and its registry.
 * @property {string[]} sources Folders or files (relative to the repo root) to turn into items.
 * @property {RegExp[]} exclude Paths to skip.
 * @property {Record<string, RegistryBundle>} bundles Source folder prefix → one multi-file item.
 * @property {Record<string, string[]>} componentCategories Category → component file names (no extension).
 * @property {{ name: string; title: string; description: string; categories?: string[] }} shell The shell block.
 * @property {string[]} peerPackages Packages never listed as dependencies.
 * @property {string} docs Message shown after `shadcn add`; `{baseUrl}` is filled in.
 */

/**
 * @typedef {object} SourceFile
 * @property {string} path Repo-relative path with forward slashes, for example `src/components/Taskbar.tsx`.
 * @property {string} content The file's text.
 */

/**
 * @typedef {object} RegistryPackage
 * @property {string} name
 * @property {string} version
 * @property {string} [homepage]
 * @property {Record<string, string>} dependencies Version ranges for npm imports (ui's dependencies plus this package's own).
 */

/** Error thrown for an import the registry cannot represent. */
export class RegistryError extends Error {
  /**
   * @param {'UNRESOLVED_IMPORT' | 'DUPLICATE_NAME'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'RegistryError';
    this.code = code;
  }
}

const ITEM_SCHEMA = 'https://ui.shadcn.com/schema/registry-item.json';

/** `DataTableColumnHeader` → `data-table-column-header`, `useWindowFrame` → `use-window-frame`. */
export function toKebabCase(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function baseName(path) {
  const file = path.slice(path.lastIndexOf('/') + 1);
  return file.replace(/\.(tsx?|mjs|js)$/, '');
}

function extension(path) {
  return path.slice(path.lastIndexOf('.'));
}

/**
 * The registry type of a file: everything in `src/react/` is a hook item (the provider too),
 * everything in `src/components/` is a UI component, everything else is a lib file.
 *
 * @param {string} path
 * @returns {'registry:ui' | 'registry:hook' | 'registry:lib'}
 */
export function itemType(path) {
  if (path.startsWith('src/react/')) return 'registry:hook';
  if (path.startsWith('src/components/')) return 'registry:ui';
  return 'registry:lib';
}

/**
 * The item name and the file it becomes in a shadcn project.
 *
 * @param {string} path
 * @returns {{ name: string; file: string; type: ReturnType<typeof itemType> }}
 */
export function describeFile(path) {
  const type = itemType(path);
  const name = toKebabCase(baseName(path));
  const folder = type === 'registry:ui' ? 'ui' : type === 'registry:hook' ? 'hooks' : 'lib';
  return { name, file: `${folder}/${name}${extension(path)}`, type };
}

/** The `@/...` import path of a file inside a shadcn project. */
export function aliasFor(file) {
  const withoutExtension = file.replace(/\.(tsx?|mjs|js)$/, '');
  if (withoutExtension.startsWith('ui/')) return `@/components/${withoutExtension}`;
  return `@/${withoutExtension}`;
}

/** Joins a relative import onto the importing file's folder: `a/b/C.tsx` + `../d` → `a/d`. */
export function resolveRelative(fromPath, specifier) {
  const parts = fromPath.split('/').slice(0, -1);
  for (const segment of specifier.split('/')) {
    if (segment === '..') parts.pop();
    else if (segment !== '.') parts.push(segment);
  }
  return parts.join('/');
}

/** `lucide-react/icons` → `lucide-react`, `@scope/pkg/sub` → `@scope/pkg`. */
export function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/**
 * The registry category of a source file: `src/react/*` → `hooks`, a component → the list in
 * `config.componentCategories` that names it (default `shell`), anything else → `core`.
 *
 * @param {string} path
 * @param {RegistryConfig} config
 */
export function categoryOf(path, config) {
  if (path.startsWith('src/react/')) return 'hooks';
  if (path.startsWith('src/components/')) {
    const name = baseName(path);
    const found = Object.entries(config.componentCategories).find(([, names]) =>
      names.includes(name),
    );
    return found ? found[0] : 'shell';
  }
  return 'core';
}

/** The base URL with `{name}` and `{version}` filled in and no trailing slash. */
export function resolveBaseUrl(baseUrl, pkg) {
  return baseUrl.replace('{name}', pkg.name).replace('{version}', pkg.version).replace(/\/+$/, '');
}

// `import ... from '...'` and `export ... from '...'` at the start of a line, including
// multi-line import lists. Starting at a line start skips examples inside TSDoc comments
// (` * import ...`); excluding parentheses skips `export function ...` declarations.
const IMPORT_PATTERN = /^((?:import|export)\b[^'";()]*?\bfrom\s*)(['"])([^'"]+)\2/gm;
// Side-effect imports at the start of a line: `import 'x';`
const BARE_IMPORT_PATTERN = /^(import\s*)(['"])([^'"]+)\2/gm;

/**
 * Lists every module specifier a file imports.
 *
 * @param {string} content
 * @returns {string[]}
 */
export function importSpecifiers(content) {
  const found = new Set();
  for (const match of content.matchAll(IMPORT_PATTERN)) found.add(match[3]);
  for (const match of content.matchAll(BARE_IMPORT_PATTERN)) found.add(match[3]);
  return [...found];
}

/** Replaces every import specifier in a file with `rewrite(specifier)`. */
function rewriteImports(content, rewrite) {
  const replace = (_all, head, quote, specifier) => `${head}${quote}${rewrite(specifier)}${quote}`;
  return content.replace(IMPORT_PATTERN, replace).replace(BARE_IMPORT_PATTERN, replace);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rewrites the named imports from the ui package into imports from the ui registry items that
 * export those names. A statement that pulls names from several items is split into one
 * statement per import path. Type-only specifiers (`type X`) keep their `type` marker.
 *
 * @param {string} content Source text of one file.
 * @param {string} path Repo path of the file, for error messages.
 * @param {string} uiPackage The ui package name, `@integr8-media/ui`.
 * @param {Map<string, { item: string; alias: string }>} uiMap Exported name → ui item.
 * @returns {{ content: string; items: string[] }} The new text and the names of the ui items used.
 * @throws {RegistryError} `UNRESOLVED_IMPORT` for a name no ui item exports, a default or
 * namespace import, a deep import, or an `export ... from` of the ui package.
 */
export function rewriteUiImports(content, path, uiPackage, uiMap) {
  const items = new Set();
  const named = new RegExp(
    `^import\\s+(type\\s+)?\\{([^}]*)\\}\\s*from\\s*(['"])${escapeRegExp(uiPackage)}\\3[ \\t]*;?`,
    'gm',
  );

  const rewritten = content.replace(named, (_all, typeOnly, list) => {
    /** @type {Map<string, string[]>} */
    const byAlias = new Map();
    for (const part of list.split(',')) {
      const text = part.trim();
      if (text === '') continue;
      const inline = /^type\s+/.test(text);
      const specifier = text.replace(/^type\s+/, '');
      const importedName = specifier.split(/\s+as\s+/)[0].trim();
      const entry = uiMap.get(importedName);
      if (!entry) {
        throw new RegistryError(
          'UNRESOLVED_IMPORT',
          `Registry: ${path} imports ${importedName} from ${uiPackage}, but no ui registry item exports it.`,
        );
      }
      items.add(entry.item);
      const group = byAlias.get(entry.alias) ?? [];
      group.push(inline && !typeOnly ? `type ${specifier}` : specifier);
      byAlias.set(entry.alias, group);
    }
    return [...byAlias.entries()]
      .map(
        ([alias, names]) =>
          `import ${typeOnly ? 'type ' : ''}{ ${names.join(', ')} } from '${alias}';`,
      )
      .join('\n');
  });

  // Anything still pointing at the ui package (default, namespace, deep or re-export) cannot be
  // rewritten name by name.
  for (const specifier of importSpecifiers(rewritten)) {
    if (specifier === uiPackage || specifier.startsWith(`${uiPackage}/`)) {
      throw new RegistryError(
        'UNRESOLVED_IMPORT',
        `Registry: ${path} imports "${specifier}" in a form the registry cannot rewrite. Use named imports from ${uiPackage}.`,
      );
    }
  }
  return { content: rewritten, items: [...items] };
}

/** The first sentence of the TSDoc right above `export function <name>` (or the file's first doc). */
export function describeExport(content, name) {
  const docBefore = new RegExp(
    `/\\*\\*((?:(?!\\*/)[\\s\\S])*)\\*/\\s*export\\s+(?:function|const|class)\\s+${name}\\b`,
  );
  const match = content.match(docBefore) ?? content.match(/\/\*\*((?:(?!\*\/)[\s\S])*)\*\//);
  if (!match) return undefined;
  const text = match[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, ''))
    .filter((line) => !line.startsWith('@'))
    .join(' ')
    .replace(/\{@link\s+([^}]+)\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  const sentence = text.match(/^.*?[.!?](?=\s|$)/);
  return (sentence ? sentence[0] : text) || undefined;
}

/** `name@range` from the known dependency ranges, or the bare name. */
function withRange(pkg, name) {
  const range = pkg.dependencies[name];
  return range ? `${name}@${range}` : name;
}

/**
 * Builds every registry item from the source files.
 *
 * @param {SourceFile[]} files Every file under the configured sources (already filtered).
 * @param {RegistryPackage} pkg
 * @param {RegistryConfig} config
 * @param {Map<string, { item: string; alias: string }>} uiMap Exported name → ui registry item.
 * @returns {object[]} shadcn registry items, ready for JSON.stringify.
 * @throws {RegistryError} `UNRESOLVED_IMPORT` or `DUPLICATE_NAME`.
 */
export function buildRegistryItems(files, pkg, config, uiMap) {
  const baseUrl = resolveBaseUrl(config.baseUrl, pkg);
  const uiBaseUrl = config.ui.baseUrl.replace(/\/+$/, '');
  const urlOf = (name) => `${baseUrl}/${name}.json`;
  const uiUrlOf = (name) => `${uiBaseUrl}/${name}.json`;
  const docs = config.docs.replaceAll('{baseUrl}', baseUrl);
  const bundles = Object.entries(config.bundles ?? {});
  /** The bundle a repo path (with or without extension) belongs to. */
  const bundleOf = (path) => bundles.find(([prefix]) => `${path}/`.startsWith(prefix));

  const singles = files.filter((file) => !bundleOf(file.path));
  const byPath = new Map(
    // `source` is the repo file; `file` (from describeFile) is its path in a shadcn project.
    singles.map((file) => [file.path, { source: file, ...describeFile(file.path) }]),
  );
  const bundleFiles = new Map(
    bundles.map(([prefix]) => [prefix, files.filter((file) => file.path.startsWith(prefix))]),
  );

  // Every item name must be unique: single files and bundles.
  const seen = new Map();
  const claim = (name, owner) => {
    const other = seen.get(name);
    if (other) {
      throw new RegistryError(
        'DUPLICATE_NAME',
        `Registry: ${owner} and ${other} would both be "${name}".`,
      );
    }
    seen.set(name, owner);
  };
  for (const entry of byPath.values()) claim(entry.name, entry.source.path);
  for (const [prefix, bundle] of bundles) {
    if ((bundleFiles.get(prefix) ?? []).length > 0) claim(bundle.name, prefix);
  }

  /** Finds the single-file item a relative import points to (with or without extension). */
  const lookup = (resolved) =>
    byPath.get(resolved) ??
    byPath.get(`${resolved}.tsx`) ??
    byPath.get(`${resolved}.ts`) ??
    byPath.get(`${resolved}/index.ts`);

  /** Does a bundle hold the file a relative import points to? */
  const bundleHas = (prefix, resolved) =>
    (bundleFiles.get(prefix) ?? []).some((file) =>
      [resolved, `${resolved}.tsx`, `${resolved}.ts`, `${resolved}/index.ts`].includes(file.path),
    );

  /**
   * Rewrites the imports of one file and collects what it needs.
   *
   * @param {SourceFile} file
   * @param {string | undefined} ownPrefix The bundle the file belongs to, if any.
   */
  const rewriteFile = (file, ownPrefix, dependencies, registryDependencies) => {
    // ui imports first: they are split into one statement per ui item.
    const ui = rewriteUiImports(file.content, file.path, config.ui.package, uiMap);
    for (const item of ui.items) registryDependencies.add(uiUrlOf(item));

    return rewriteImports(ui.content, (specifier) => {
      if (!specifier.startsWith('.')) {
        const name = packageName(specifier);
        // Rewritten ui imports start with `@/`, which is not an npm package.
        if (specifier.startsWith('@/')) return specifier;
        if (!config.peerPackages.includes(name) && name !== config.ui.package) {
          dependencies.add(withRange(pkg, name));
        }
        return specifier;
      }
      const resolved = resolveRelative(file.path, specifier);
      const bundle = bundleOf(resolved);
      if (bundle) {
        const [prefix, target] = bundle;
        if (!bundleHas(prefix, resolved)) {
          throw new RegistryError(
            'UNRESOLVED_IMPORT',
            `Registry: ${file.path} imports ${specifier}, which is not part of the registry.`,
          );
        }
        // Inside its own bundle a file keeps its relative imports: the folder is copied as is.
        if (prefix === ownPrefix) return specifier;
        registryDependencies.add(urlOf(target.name));
        // `../core` (the folder itself) means its index file.
        return `${target.alias}${resolved.slice(prefix.length) || 'index'}`;
      }
      const single = lookup(resolved);
      if (!single) {
        throw new RegistryError(
          'UNRESOLVED_IMPORT',
          `Registry: ${file.path} imports ${specifier}, which is not part of the registry.`,
        );
      }
      registryDependencies.add(urlOf(single.name));
      return aliasFor(single.file);
    });
  };

  const singleItems = [...byPath.values()].map((entry) => {
    const file = entry.source;
    const dependencies = new Set();
    const registryDependencies = new Set();
    const content = rewriteFile(file, undefined, dependencies, registryDependencies);
    const title = baseName(file.path);
    const description = describeExport(file.content, title);
    return {
      $schema: ITEM_SCHEMA,
      name: entry.name,
      type: entry.type,
      title,
      ...(description ? { description } : {}),
      categories: [categoryOf(file.path, config)],
      ...(dependencies.size > 0 ? { dependencies: [...dependencies].sort() } : {}),
      ...(registryDependencies.size > 0
        ? { registryDependencies: [...registryDependencies].sort() }
        : {}),
      files: [{ path: entry.file, type: entry.type, content }],
      docs,
    };
  });

  const filledBundles = bundles.filter(([prefix]) => (bundleFiles.get(prefix) ?? []).length > 0);
  const bundleItems = filledBundles.map(([prefix, bundle]) => {
    const dependencies = new Set();
    const registryDependencies = new Set((bundle.registryDependencies ?? []).map(urlOf));
    const bundleFileItems = [...(bundleFiles.get(prefix) ?? [])]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((file) => {
        const relativePath = file.path.slice(prefix.length);
        return {
          path: `${bundle.alias.replace(/^@\//, '')}${relativePath}`,
          type: 'registry:lib',
          target: `${bundle.target}${relativePath}`,
          content: rewriteFile(file, prefix, dependencies, registryDependencies),
        };
      });

    return {
      $schema: ITEM_SCHEMA,
      name: bundle.name,
      type: 'registry:item',
      title: bundle.title,
      description: bundle.description,
      ...(bundle.categories ? { categories: bundle.categories } : {}),
      ...(dependencies.size > 0 ? { dependencies: [...dependencies].sort() } : {}),
      ...(registryDependencies.size > 0
        ? { registryDependencies: [...registryDependencies].sort() }
        : {}),
      files: bundleFileItems,
      docs: (bundle.docs ?? docs).replaceAll('{baseUrl}', baseUrl),
    };
  });

  return makeShellBlock([...singleItems, ...bundleItems], config, urlOf).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/**
 * Turns the item named `config.shell.name` (the `WindowManagerShell` component) into a
 * `registry:block` that depends on every other component item, so one `shadcn add` installs the
 * whole desktop. Without that component file, no block is made.
 */
function makeShellBlock(items, config, urlOf) {
  const shell = items.find((item) => item.name === config.shell.name);
  if (!shell) return items;
  const componentUrls = items
    .filter((item) => item.type === 'registry:ui' && item.name !== shell.name)
    .map((item) => urlOf(item.name));
  const registryDependencies = [
    ...new Set([...(shell.registryDependencies ?? []), ...componentUrls]),
  ];
  const block = {
    ...shell,
    type: 'registry:block',
    title: config.shell.title,
    description: config.shell.description,
    categories: config.shell.categories ?? shell.categories,
    registryDependencies: registryDependencies.sort(),
  };
  return items.map((item) => (item === shell ? block : item));
}

/**
 * The registry index (`registry.json`): every item without file contents.
 *
 * @param {object[]} items
 * @param {{ name: string; homepage?: string }} pkg
 */
export function buildRegistryIndex(items, pkg) {
  return {
    $schema: 'https://ui.shadcn.com/schema/registry.json',
    name: pkg.name,
    homepage: pkg.homepage ?? '',
    items: items.map(({ $schema: _schema, files, ...item }) => ({
      ...item,
      ...(files ? { files: files.map(({ content: _content, ...rest }) => rest) } : {}),
    })),
  };
}
