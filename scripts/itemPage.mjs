// The documentation page of one registry item (site/components/<name>/index.html): live
// preview of its Ladle stories, installation, usage, API reference from the TSDoc comments
// (scripts/sourceDocs.mjs), source code, "used by" and previous/next links, with a sidebar of
// every item. Pure function, so it is easy to test; scripts/buildRegistrySite.mjs writes it.

import { aliasFor, toKebabCase } from './registryItems.mjs';
import {
  codeBlock,
  commandBlock,
  escapeHtml,
  inlineMarkdown,
  renderMarkdown,
  renderShell,
  typeLabel,
} from './siteLayout.mjs';
import { extractDocs } from './sourceDocs.mjs';

/** Kinds that can be imported as values (the rest are types). */
const VALUE_KINDS = new Set(['component', 'hook', 'function', 'constant', 'class', 'enum']);

/** Anchor id of an export on its item page. */
export const apiAnchor = (name) => `api-${name}`;

/** Item name from a registry dependency URL: `https://x/r/button.json` → `button`. */
export function itemNameFromUrl(url) {
  return url.match(/([^/]+)\.json$/)?.[1] ?? url;
}

/**
 * Every documented export of an item, the main one first (the export whose kebab-case name is
 * the item name, for example `Button` for `button`), then in file and source order.
 *
 * @param {{ name: string; files?: { path: string; content?: string }[] }} item
 * @returns {(import('./sourceDocs.mjs').ExportDoc & { file: string })[]}
 */
export function itemDocs(item) {
  const docs = (item.files ?? []).flatMap((file) =>
    file.content && /\.(tsx?|mts)$/.test(file.path)
      ? extractDocs(file.path, file.content).map((doc) => ({ ...doc, file: file.path }))
      : [],
  );
  const main = docs.findIndex((doc) => toKebabCase(doc.name) === item.name);
  if (main > 0) docs.unshift(...docs.splice(main, 1));
  return docs;
}

/** `<code>` of a type, linked when it names a documented export. */
function typeCode(type, linkFor) {
  const href = linkFor(type);
  const html = `<code>${escapeHtml(type)}</code>`;
  return href ? `<a href="${escapeHtml(href)}">${html}</a>` : html;
}

/** A props, parameters or members table. */
function membersTable(caption, rows, linkFor) {
  const body = rows
    .map(
      (row) => `<tr>
                <td><code>${escapeHtml(row.name)}${row.optional && !row.name.startsWith('...') ? '?' : ''}</code>${row.deprecated ? ' <span class="tag deprecated">deprecated</span>' : ''}</td>
                <td>${row.type ? typeCode(row.type, linkFor) : '<span class="muted">—</span>'}</td>
                <td>${row.defaultValue !== undefined ? `<code>${escapeHtml(row.defaultValue)}</code>` : '<span class="muted">—</span>'}</td>
                <td>${row.description ? inlineMarkdown(row.description.replace(/\s*\n\s*/g, ' '), { linkFor }) : ''}</td>
              </tr>`,
    )
    .join('\n              ');
  return `<h4>${escapeHtml(caption)}</h4>
            <div class="table-wrap">
              <table>
                <thead><tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Default</th><th scope="col">Description</th></tr></thead>
                <tbody>
              ${body}
                </tbody>
              </table>
            </div>`;
}

/** One export in the API reference. */
function apiEntry(doc, linkFor) {
  const markdown = (text) => renderMarkdown(text, { linkFor });
  const parts = [];
  if (doc.deprecated)
    parts.push(
      `<div class="prose"><p><strong>Deprecated.</strong></p>${markdown(doc.deprecated)}</div>`,
    );
  if (doc.summary) parts.push(`<div class="prose">${markdown(doc.summary)}</div>`);
  parts.push(`<pre class="sig"><code>${escapeHtml(doc.signature)}</code></pre>`);
  if (doc.extends?.length) {
    parts.push(
      `<h4>Also accepts</h4>
            <p>${doc.extends.map((type) => typeCode(type, linkFor)).join(', ')}</p>`,
    );
  }
  if (doc.params?.length && doc.kind !== 'interface' && doc.kind !== 'type') {
    parts.push(
      membersTable(doc.kind === 'class' ? 'Constructor' : 'Parameters', doc.params, linkFor),
    );
  }
  if (doc.members?.length) {
    const caption =
      doc.kind === 'enum' ? 'Members' : /Props$/.test(doc.name) ? 'Props' : 'Properties';
    parts.push(membersTable(caption, doc.members, linkFor));
  }
  if (doc.returnsDescription || (doc.returns && doc.kind !== 'component')) {
    parts.push(
      `<h4>Returns</h4>
            <p>${doc.returns ? typeCode(doc.returns, linkFor) : ''} ${doc.returnsDescription ? inlineMarkdown(doc.returnsDescription, { linkFor }) : ''}</p>`,
    );
  }
  if (doc.throws.length > 0) {
    parts.push(
      `<h4>Throws</h4>\n            <div class="prose">${doc.throws.map(markdown).join('\n')}</div>`,
    );
  }
  for (const example of doc.examples) {
    parts.push(`<h4>Example</h4>\n            ${markdown(example)}`);
  }
  return `<section class="api" id="${escapeHtml(apiAnchor(doc.name))}" aria-labelledby="${escapeHtml(apiAnchor(doc.name))}-title">
            <div class="api-head">
              <h3 id="${escapeHtml(apiAnchor(doc.name))}-title">${escapeHtml(doc.name)}</h3>
              <span class="tag">${escapeHtml(doc.kind)}</span>
              ${doc.deprecated ? '<span class="tag deprecated">deprecated</span>' : ''}
            </div>
            ${parts.join('\n            ')}
          </section>`;
}

/**
 * A shadcn item's `css` object as CSS text: selectors and at-rules become blocks, strings
 * become declarations, empty objects become block-less at-rules (`@import "x";`).
 *
 * @param {Record<string, unknown>} css
 */
export function cssToText(css, indent = '') {
  return Object.entries(css)
    .map(([key, value]) => {
      if (typeof value === 'string') return `${indent}${key}: ${value};`;
      const entries = Object.entries(value ?? {});
      if (entries.length === 0) return `${indent}${key};`;
      return `${indent}${key} {\n${cssToText(value, `${indent}  `)}\n${indent}}`;
    })
    .join('\n');
}

/** Import lines for the value exports of each file: `import { Button } from '@/components/ui/button';`. */
export function importLines(docs) {
  const byFile = new Map();
  for (const doc of docs) {
    if (!VALUE_KINDS.has(doc.kind)) continue;
    const names = byFile.get(doc.file) ?? [];
    names.push(doc.name);
    byFile.set(doc.file, names);
  }
  return [...byFile.entries()].map(
    ([file, names]) => `import { ${names.join(', ')} } from '${aliasFor(file)}';`,
  );
}

const ITEM_SCRIPT = `
    (function () {
      // Sidebar: open on wide screens, with the current item in view.
      var nav = document.querySelector('.side-nav');
      if (nav && window.matchMedia('(min-width: 64rem)').matches) {
        nav.open = true;
        var current = nav.querySelector('[aria-current="page"]');
        var sidebar = document.querySelector('.sidebar');
        if (current && sidebar) sidebar.scrollTop = current.offsetTop - sidebar.clientHeight / 3;
      }

      // Live preview: switch story.
      var preview = document.getElementById('preview');
      if (!preview) return;
      var base = preview.getAttribute('data-playground');
      var story = preview.getAttribute('data-story');
      var select = document.getElementById('story-select');
      var frame = document.getElementById('story-frame');
      function show() {
        frame.src = base + '?story=' + encodeURIComponent(story) + '&mode=preview&integr8Embed=1';
      }
      if (select) select.addEventListener('change', function () { story = select.value; show(); });
    })();
`;

/**
 * Renders the documentation page of one registry item.
 *
 * @param {object} page
 * @param {{ name: string; type: string; title?: string; description?: string; categories?: string[]; dependencies?: string[]; registryDependencies?: string[]; files?: { path: string; type?: string; target?: string; content?: string }[] }} page.item
 *   The full registry item (with file contents).
 * @param {{ id: string; name: string }[]} [page.stories] Its Ladle stories.
 * @param {string[]} [page.usedBy] Names of the items that depend on it.
 * @param {object} site
 * @param {string} site.baseUrl Where the item JSON files are served.
 * @param {string} site.version Package version.
 * @param {string} site.registryName Package name, for the footer.
 * @param {{ id: string; label: string; items: { name: string; title?: string }[] }[]} site.groups
 *   Every item, grouped (sidebar).
 * @param {{ name: string; title?: string }[]} site.order Every item in page order (previous/next).
 * @param {Map<string, string>} site.exportOwners Export name → item name, for links.
 * @param {string} [site.docsPath] Folder of the item pages, relative to the site root.
 * @param {string} [site.playgroundPath] Ladle playground, relative to the site root.
 * @param {string} [site.fontsHref] Fonts stylesheet, relative to the site root.
 * @param {string} site.uiBaseUrl Where the `@integr8-media/ui` registry JSON files are served.
 * @param {string} [site.uiDocsUrl] Where the ui item pages are, for links (ends with `/`).
 * @param {string} [site.repositoryUrl] Link to the source repository.
 */
export function renderItemPage(page, site) {
  const { item } = page;
  const stories = page.stories ?? [];
  const usedBy = page.usedBy ?? [];
  const docsPath = site.docsPath ?? 'components/';
  const root = '../'.repeat(docsPath.split('/').filter(Boolean).length + 1);
  const pageOf = (name) => `${root}${docsPath}${name}/`;
  const title = item.title ?? item.name;
  const install = `npx shadcn@latest add ${site.baseUrl}/${item.name}.json`;

  const known = new Set(site.order.map((other) => other.name));
  const dependencyLink = (name) => {
    const label = `<code>${escapeHtml(name)}</code>`;
    if (known.has(name)) return `<a href="${escapeHtml(pageOf(name))}">${label}</a>`;
    return site.uiDocsUrl
      ? `<a href="${escapeHtml(`${site.uiDocsUrl}${name}/`)}">${label}</a> <span class="muted">(ui)</span>`
      : label;
  };

  const linkFor = (name) => {
    const owner = site.exportOwners.get(name);
    if (!owner) return null;
    return owner === item.name ? `#${apiAnchor(name)}` : `${pageOf(owner)}#${apiAnchor(name)}`;
  };

  const docs = itemDocs(item);
  const group = site.groups.find((candidate) =>
    candidate.items.some((other) => other.name === item.name),
  );

  // Sidebar
  const sidebar = site.groups
    .map(
      (candidate) => `<h2>${escapeHtml(candidate.label)}</h2>
          <ul>
            ${candidate.items
              .map(
                (other) =>
                  `<li><a href="${escapeHtml(pageOf(other.name))}"${other.name === item.name ? ' aria-current="page"' : ''}>${escapeHtml(other.title ?? other.name)}</a></li>`,
              )
              .join('\n            ')}
          </ul>`,
    )
    .join('\n          ');

  // Preview
  const toc = [];
  let preview = '';
  if (site.playgroundPath && stories.length > 0) {
    toc.push(['preview', 'Preview']);
    const playground = root + site.playgroundPath;
    const first = stories[0].id;
    const storyUrl = `${playground}?story=${encodeURIComponent(first)}&mode=preview&integr8Embed=1`;
    const select =
      stories.length > 1
        ? `<label class="field">
                <span class="sr-only">Story</span>
                <select id="story-select">
                  ${stories.map((story) => `<option value="${escapeHtml(story.id)}">${escapeHtml(story.name)}</option>`).join('\n                  ')}
                </select>
              </label>`
        : '';
    preview = `<section id="preview" class="doc-section" aria-labelledby="preview-title" data-playground="${escapeHtml(playground)}" data-story="${escapeHtml(first)}">
          <h2 id="preview-title">Preview</h2>
          <div class="viewer">
            <div class="viewer-bar">
              ${select}
              <button type="button" class="pill-sm ghost open-full" data-expand aria-pressed="false">Full screen</button>
            </div>
            <iframe id="story-frame" title="${escapeHtml(title)} preview" src="${escapeHtml(storyUrl)}" loading="lazy"></iframe>
          </div>
        </section>`;
  }

  // Installation
  toc.push(['installation', 'Installation']);
  const facts = [];
  if (item.dependencies?.length) {
    facts.push(
      `<li><strong>npm packages</strong>${item.dependencies.map((dep) => `<code>${escapeHtml(dep)}</code>`).join(' ')}</li>`,
    );
  }
  if (item.registryDependencies?.length) {
    facts.push(
      `<li><strong>Also adds</strong>${item.registryDependencies
        .map(itemNameFromUrl)
        .map(dependencyLink)
        .join(' ')}</li>`,
    );
  }
  if (item.files?.length) {
    facts.push(
      `<li><strong>Files</strong>${item.files
        .map((file) => `<code>${escapeHtml(file.target ?? file.path)}</code>`)
        .join(' ')}</li>`,
    );
  }
  const themeNote = `<p>Uses the Integr8 theme tokens: add the <a href="${escapeHtml(site.uiDocsUrl ? `${site.uiDocsUrl}theme/` : site.uiBaseUrl)}">ui theme</a> once per project first (<code>npx shadcn@latest add ${escapeHtml(site.uiBaseUrl)}/theme.json</code>).</p>`;
  const installation = `<section id="installation" class="doc-section" aria-labelledby="installation-title">
          <h2 id="installation-title">Installation</h2>
          ${themeNote}
          ${commandBlock(install, `Copy the install command for ${item.name}`)}
          ${facts.length > 0 ? `<ul class="facts">\n            ${facts.join('\n            ')}\n          </ul>` : ''}
        </section>`;

  // Usage
  const imports = importLines(docs);
  const mainExamples = docs.find((doc) => doc.examples.length > 0)?.examples ?? [];
  let usage = '';
  if (imports.length > 0 || mainExamples.length > 0) {
    toc.push(['usage', 'Usage']);
    usage = `<section id="usage" class="doc-section" aria-labelledby="usage-title">
          <h2 id="usage-title">Usage</h2>
          ${imports.length > 0 ? codeBlock(imports.join('\n'), 'Copy the import') : ''}
          ${mainExamples.map((example) => renderMarkdown(example, { linkFor })).join('\n          ')}
        </section>`;
  }

  // Styles the item adds to the project's CSS (theme, fonts)
  let styles = '';
  if (item.cssVars || item.css) {
    toc.push(['styles', 'Styles']);
    const light = item.cssVars?.light ?? {};
    const dark = item.cssVars?.dark ?? {};
    const tokens = [...new Set([...Object.keys(light), ...Object.keys(dark)])];
    const swatch = (value) =>
      value === undefined ? '<span class="muted">—</span>' : `<code>${escapeHtml(value)}</code>`;
    const tokenTable =
      tokens.length > 0
        ? `<h3 class="sr-only">Tokens</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th scope="col">Token</th><th scope="col">Light (<code>:root</code>)</th><th scope="col">Dark (<code>.dark</code>)</th></tr></thead>
              <tbody>
              ${tokens.map((token) => `<tr><td><code>--${escapeHtml(token)}</code></td><td>${swatch(light[token])}</td><td>${swatch(dark[token])}</td></tr>`).join('\n              ')}
              </tbody>
            </table>
          </div>`
        : '';
    const cssText = item.css ? cssToText(item.css) : '';
    styles = `<section id="styles" class="doc-section" aria-labelledby="styles-title">
          <h2 id="styles-title">Styles</h2>
          <p>What <code>shadcn add</code> writes into your CSS file${tokens.length > 0 ? ': the theme tokens below, plus the rules for the other themes and the Integr8 extras' : ''}.</p>
          ${tokenTable}
          ${cssText ? `<details class="source"><summary>View the CSS</summary>${codeBlock(cssText, 'Copy the CSS', 'CSS')}</details>` : ''}
        </section>`;
  }

  // API reference (items with code only)
  const hasCode = (item.files ?? []).some((file) => typeof file.content === 'string');
  if (hasCode) toc.push(['api', 'API reference']);
  const api = !hasCode
    ? ''
    : `<section id="api" class="doc-section" aria-labelledby="api-title">
          <h2 id="api-title">API reference</h2>
          ${
            docs.length > 0
              ? docs.map((doc) => apiEntry(doc, linkFor)).join('\n          ')
              : '<p>This item has no public API of its own: other components use it. See the source below.</p>'
          }
        </section>`;

  // Source
  const sourceFiles = (item.files ?? []).filter((file) => typeof file.content === 'string');
  let source = '';
  if (sourceFiles.length > 0) {
    toc.push(['source', 'Source']);
    source = `<section id="source" class="doc-section" aria-labelledby="source-title">
          <h2 id="source-title">Source</h2>
          <p>The code <code>shadcn add</code> copies into your project. It's yours to change.</p>
          <details class="source">
            <summary>View the source (${sourceFiles.length} ${sourceFiles.length === 1 ? 'file' : 'files'})</summary>
            ${sourceFiles.map((file) => codeBlock(file.content, `Copy ${file.target ?? file.path}`, file.target ?? file.path)).join('\n            ')}
          </details>
        </section>`;
  }

  // Used by
  const usedBySection =
    usedBy.length > 0
      ? `<section id="used-by" class="doc-section" aria-labelledby="used-by-title">
          <h2 id="used-by-title">Used by</h2>
          <div class="chips">
            ${usedBy.map((name) => `<a class="chip" href="${escapeHtml(pageOf(name))}">${escapeHtml(name)}</a>`).join('\n            ')}
          </div>
        </section>`
      : '';

  // Previous / next
  const position = site.order.findIndex((other) => other.name === item.name);
  const previous = position > 0 ? site.order[position - 1] : null;
  const next = position >= 0 && position < site.order.length - 1 ? site.order[position + 1] : null;
  const pager = `<nav class="pager" aria-label="Previous and next item">
          ${previous ? `<a href="${escapeHtml(pageOf(previous.name))}"><span>Previous</span>${escapeHtml(previous.title ?? previous.name)}</a>` : '<span></span>'}
          ${next ? `<a class="next" href="${escapeHtml(pageOf(next.name))}"><span>Next</span>${escapeHtml(next.title ?? next.name)}</a>` : ''}
        </nav>`;

  const body = `<main id="main">
    <div class="wrap docs">
      <aside class="sidebar">
        <details class="side-nav">
          <summary>Browse all items</summary>
          <nav aria-label="Registry items">
          ${sidebar}
          </nav>
        </details>
      </aside>
      <article class="doc">
        <nav class="crumbs" aria-label="Breadcrumb">
          <a href="${escapeHtml(root)}#components">Registry</a><span aria-hidden="true">/</span>
          <span>${escapeHtml(group?.label ?? 'Other')}</span>
        </nav>
        <header class="doc-head">
          <div class="tags">
            <span class="tag">${escapeHtml(typeLabel(item.type))}</span>
            <span class="tag">${escapeHtml(item.name)}</span>
          </div>
          <h1>${escapeHtml(title)}</h1>
          ${item.description ? `<p class="lead">${inlineMarkdown(item.description, { linkFor })}</p>` : ''}
          ${commandBlock(install, `Copy the install command for ${item.name}`)}
          <nav class="toc" aria-label="On this page">
            ${toc.map(([id, label]) => `<a href="#${id}">${label}</a>`).join('\n            ')}
          </nav>
        </header>
        ${preview}
        ${installation}
        ${usage}
        ${styles}
        ${api}
        ${source}
        ${usedBySection}
        ${pager}
      </article>
    </div>
  </main>`;

  return renderShell({
    title: `${title} · Integr8 Window Manager`,
    description: item.description ?? `${title}: an Integr8 Window Manager registry item.`,
    root,
    fontsHref: site.fontsHref,
    repositoryUrl: site.repositoryUrl,
    ...(site.playgroundPath ? { playgroundHref: site.playgroundPath } : {}),
    footerNote: `${site.registryName} · v${site.version}`,
    body,
    script: ITEM_SCRIPT,
  });
}
