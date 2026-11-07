// Shared layout of the registry site (landing page and item pages): the page shell (header,
// footer, fonts, styles in the integr8-media.com look), HTML helpers, a small Markdown renderer
// for TSDoc text, and the copy-button script. Pure functions, so they are easy to test.

/** Component groups in page order, by registry category. */
export const CATEGORIES = [
  ['shell', 'Shell'],
  ['window', 'Windows'],
  ['notification-area', 'Notification area'],
  ['hooks', 'Hooks'],
  ['core', 'Core'],
];

/** Short labels for registry types. */
export const TYPE_LABELS = {
  'registry:ui': 'component',
  'registry:hook': 'hook',
  'registry:lib': 'helper',
  'registry:item': 'setup',
};

/** Escapes text for HTML content and attribute values. */
export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** The short label of a registry type: `registry:ui` → `component`. */
export function typeLabel(type) {
  return TYPE_LABELS[type] ?? String(type).replace('registry:', '');
}

/**
 * Groups registry items by their first category, in page order. Items without a known
 * category go last, under "Other".
 *
 * @template {{ name: string; categories?: string[] }} T
 * @param {T[]} items
 * @returns {{ id: string; label: string; items: T[] }[]}
 */
export function groupItems(items) {
  const known = new Map(CATEGORIES);
  const groups = new Map(CATEGORIES.map(([id, label]) => [id, { id, label, items: [] }]));
  const other = { id: 'other', label: 'Other', items: [] };
  for (const item of items) {
    const category = item.categories?.[0];
    (category && known.has(category) ? groups.get(category) : other).items.push(item);
  }
  return [...groups.values(), other].filter((group) => group.items.length > 0);
}

/** A command line with a copy button. `display` defaults to the command itself. */
export function commandBlock(command, label, display = command) {
  return `<div class="cmd">
          <code>${escapeHtml(display)}</code>
          <button type="button" class="copy" data-copy="${escapeHtml(command)}" aria-label="${escapeHtml(label)}">Copy</button>
        </div>`;
}

/** A code sample with a copy button and an optional caption (for example a file path). */
export function codeBlock(code, label, caption) {
  return `<div class="code">
          ${caption ? `<div class="code-caption">${escapeHtml(caption)}</div>` : ''}
          <button type="button" class="copy" data-copy="${escapeHtml(code)}" aria-label="${escapeHtml(label)}">Copy</button>
          <pre><code>${escapeHtml(code)}</code></pre>
        </div>`;
}

/** `{@link X}` and `{@link X | label}` → inline code (`X`) or the label. */
export function replaceLinks(text) {
  return String(text).replace(
    /\{@link(?:code|plain)?\s+([^}|\s]+)(?:\s*\|\s*([^}]+))?\s*\}/g,
    (_all, target, label) => (label ? label.trim() : `\`${target}\``),
  );
}

/**
 * Inline Markdown: `code`, **bold** and [links](url). Inline code that names a documented
 * export becomes a link to it, through `linkFor`.
 *
 * @param {string} text
 * @param {{ linkFor?: (name: string) => string | null | undefined }} [options]
 */
export function inlineMarkdown(text, options = {}) {
  return replaceLinks(text)
    .split(/(`[^`\n]+`)/)
    .map((part) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
        const code = part.slice(1, -1);
        const href = options.linkFor?.(code.replace(/\(\)$/, ''));
        const html = `<code>${escapeHtml(code)}</code>`;
        return href ? `<a href="${escapeHtml(href)}">${html}</a>` : html;
      }
      return escapeHtml(part)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(
          /\[([^\]]+)\]\(((?:https?:\/\/|\.|\/|#)[^)\s]*)\)/g,
          (_all, label, href) => `<a href="${href}">${label}</a>`,
        );
    })
    .join('');
}

/**
 * Block Markdown for TSDoc text: paragraphs, `-` lists and fenced code blocks.
 *
 * @param {string} markdown
 * @param {{ linkFor?: (name: string) => string | null | undefined }} [options]
 */
export function renderMarkdown(markdown, options = {}) {
  const lines = String(markdown ?? '')
    .replace(/\r/g, '')
    .split('\n');
  const out = [];
  let paragraph = [];
  let list = [];
  const flushParagraph = () => {
    if (paragraph.length > 0) {
      out.push(`<p>${inlineMarkdown(paragraph.join(' '), options)}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      out.push(
        `<ul>${list.map((item) => `<li>${inlineMarkdown(item, options)}</li>`).join('')}</ul>`,
      );
      list = [];
    }
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const fence = line.match(/^\s*```\s*([\w-]*)/);
    if (fence) {
      flushParagraph();
      flushList();
      const code = [];
      index++;
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        code.push(lines[index]);
        index++;
      }
      out.push(codeBlock(code.join('\n'), 'Copy the example'));
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
    } else if (line.trim() === '') {
      flushParagraph();
      flushList();
    } else if (list.length > 0 && /^\s+/.test(line)) {
      list[list.length - 1] += ` ${line.trim()}`;
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return out.join('\n');
}

/** Copy buttons: any element with `data-copy` copies that text and says so. */
export const COPY_SCRIPT = `
    (function () {
      var status = document.getElementById('copy-status');
      document.addEventListener('click', function (event) {
        var button = event.target.closest('[data-copy]');
        if (!button || button.hasAttribute('data-copied')) return;
        var text = button.getAttribute('data-copy');
        var done = function () {
          var label = button.textContent;
          button.setAttribute('data-copied', '');
          button.textContent = 'Copied';
          status.textContent = 'Copied to the clipboard.';
          setTimeout(function () {
            button.removeAttribute('data-copied');
            button.textContent = label;
          }, 1600);
        };
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
      });
    })();
`;

/**
 * Full-screen preview: a `[data-expand]` button makes its `.viewer` cover the window and
 * turns into "Close full screen". Escape closes it too.
 */
export const VIEWER_SCRIPT = `
    (function () {
      function setExpanded(viewer, expanded) {
        viewer.classList.toggle('is-expanded', expanded);
        document.body.classList.toggle('viewer-open', expanded);
        var button = viewer.querySelector('[data-expand]');
        if (!button) return;
        button.setAttribute('aria-pressed', String(expanded));
        button.textContent = expanded ? 'Close full screen' : 'Full screen';
        button.focus();
      }
      document.addEventListener('click', function (event) {
        var button = event.target.closest('[data-expand]');
        if (!button) return;
        var viewer = button.closest('.viewer');
        if (viewer) setExpanded(viewer, !viewer.classList.contains('is-expanded'));
      });
      document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        var open = document.querySelector('.viewer.is-expanded');
        if (open) setExpanded(open, false);
      });
    })();
`;

/** Styles shared by every page: the integr8-media.com look. */
export const SITE_CSS = `
    :root {
      --bg: #07060b;
      --soft: #100e18;
      --raise: #15121f;
      --fg: #f4f2ff;
      --muted: #9a96b0;
      --line: rgba(255, 255, 255, 0.08);
      --line-strong: rgba(255, 255, 255, 0.16);
      --violet: #7c5cff;
      --cyan: #22d3ee;
      --lime: #c6ff3d;
      --pink: #ff4fd8;
      --font-sans: "Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif;
      --font-display: "Unbounded", "Inter Variable", "Inter", ui-sans-serif, system-ui, sans-serif;
      --font-mono: "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
      color-scheme: dark;
    }
    *, *::before, *::after { box-sizing: border-box; }
    [hidden] { display: none !important; }
    html { scroll-behavior: smooth; scroll-padding-top: 5rem; }
    body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 var(--font-sans); -webkit-font-smoothing: antialiased; overflow-x: hidden; }
    ::selection { background: var(--lime); color: #07060b; }
    a { color: inherit; }
    :focus-visible { outline: 2px solid var(--violet); outline-offset: 3px; }
    h1, h2, h3, h4 { font-family: var(--font-display); font-weight: 600; line-height: 1.15; margin: 0; letter-spacing: -0.01em; }
    p { margin: 0; }
    code, pre { font-family: var(--font-mono); font-size: 0.875rem; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .skip { position: absolute; left: 1rem; top: -4rem; z-index: 60; padding: 0.5rem 1rem; border-radius: 999px; background: var(--lime); color: #07060b; font-weight: 600; }
    .skip:focus { top: 1rem; }
    .wrap { width: 100%; max-width: 76rem; margin: 0 auto; padding: 0 1rem; }
    @media (min-width: 48rem) { .wrap { padding: 0 2rem; } }

    /* Film grain and background glow, as on integr8-media.com. */
    .grain { position: fixed; inset: 0; z-index: 50; pointer-events: none; opacity: 0.06; mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
    .glow { position: absolute; inset: 0 0 auto; height: 44rem; z-index: -1; pointer-events: none;
      background: radial-gradient(40rem 22rem at 18% 8%, rgba(124, 92, 255, 0.28), transparent 70%),
                  radial-gradient(34rem 20rem at 85% 18%, rgba(34, 211, 238, 0.16), transparent 70%),
                  radial-gradient(30rem 16rem at 55% 60%, rgba(198, 255, 61, 0.07), transparent 70%); }
    .gradient { background: linear-gradient(90deg, var(--violet), var(--cyan), var(--lime)); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; }

    /* Header */
    .nav { position: sticky; top: 0; z-index: 40; border-bottom: 1px solid var(--line); background: rgba(7, 6, 11, 0.72); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
    .nav .wrap { display: flex; align-items: center; gap: 1.5rem; height: 4rem; }
    .brand { display: flex; align-items: center; gap: 0.6rem; text-decoration: none; font-family: var(--font-display); font-weight: 600; font-size: 1.05rem; }
    .brand-mark { display: grid; place-items: center; width: 2rem; height: 2rem; border-radius: 0.6rem; background: linear-gradient(135deg, var(--violet), var(--cyan)); color: #07060b; font-size: 0.75rem; font-weight: 800; }
    .brand .slash { color: var(--lime); margin: 0 0.15rem; }
    .nav nav { display: flex; align-items: center; gap: 1.25rem; margin-left: auto; font-size: 0.925rem; }
    .nav nav a { text-decoration: none; color: var(--muted); transition: color 0.2s; }
    .nav nav a:hover { color: var(--fg); }
    @media (max-width: 40rem) { .nav-hide { display: none; } }

    /* Buttons */
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; min-height: 3rem; padding: 0 1.5rem; border-radius: 999px; font-weight: 600; text-decoration: none; border: 1px solid transparent; transition: transform 0.2s, background 0.2s, border-color 0.2s; }
    .btn:hover { transform: translateY(-1px); }
    .btn.primary { background: var(--lime); color: #07060b; }
    .btn.ghost { border-color: var(--line-strong); color: var(--fg); background: rgba(255, 255, 255, 0.03); }
    .btn.ghost:hover { border-color: var(--violet); }
    .pill-sm { display: inline-flex; align-items: center; min-height: 2rem; padding: 0 0.85rem; border-radius: 999px; border: 1px solid transparent; background: var(--lime); color: #07060b; font: 600 0.8rem var(--font-sans); text-decoration: none; cursor: pointer; }
    .pill-sm.ghost { background: transparent; color: var(--fg); border-color: var(--line-strong); }
    .pill-sm.ghost:hover { border-color: var(--violet); }
    .chip { display: inline-flex; align-items: center; gap: 0.4rem; min-height: 2.25rem; padding: 0 0.9rem; border-radius: 999px; border: 1px solid var(--line-strong); background: transparent; color: var(--muted); font: 500 0.85rem var(--font-sans); cursor: pointer; transition: all 0.2s; }
    .chip span { color: inherit; opacity: 0.6; font-size: 0.75rem; }
    .chip:hover { color: var(--fg); border-color: var(--violet); }
    .chip[aria-pressed="true"] { background: var(--violet); border-color: var(--violet); color: #fff; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }

    /* Hero */
    .hero { position: relative; padding: 5rem 0 4rem; }
    @media (min-width: 48rem) { .hero { padding: 7.5rem 0 5.5rem; } }
    .eyebrow { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--muted); font: 500 0.8rem var(--font-mono); text-transform: uppercase; letter-spacing: 0.12em; }
    .eyebrow::before { content: ""; width: 0.5rem; height: 0.5rem; border-radius: 999px; background: var(--lime); box-shadow: 0 0 12px var(--lime); }
    .hero h1 { margin-top: 1.25rem; font-size: clamp(2.4rem, 7vw, 5rem); font-weight: 800; max-width: 15ch; }
    .lead { color: var(--muted); font-size: 1.1rem; max-width: 42rem; }
    .hero .lead { margin-top: 1.5rem; font-size: clamp(1.05rem, 2vw, 1.25rem); }
    .cta { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 2.25rem; }
    .hero .cmd { margin-top: 2rem; max-width: 46rem; }
    .stats { display: flex; flex-wrap: wrap; gap: 2.5rem; margin: 3.5rem 0 0; padding: 0; list-style: none; }
    .stats strong { display: block; font: 700 2rem/1 var(--font-display); }
    .stats span { color: var(--muted); font-size: 0.875rem; }

    /* Command lines and code */
    .cmd { display: flex; align-items: center; gap: 0.5rem; min-width: 0; padding: 0.4rem 0.4rem 0.4rem 1rem; border: 1px solid var(--line-strong); border-radius: 999px; background: rgba(255, 255, 255, 0.03); }
    .cmd code { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--fg); }
    .cmd code::before { content: "$ "; color: var(--lime); }
    .copy { flex: none; min-height: 2.25rem; padding: 0 1rem; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--raise); color: var(--fg); font: 600 0.8rem var(--font-sans); cursor: pointer; transition: all 0.2s; }
    .copy:hover { border-color: var(--violet); }
    .copy[data-copied] { background: var(--lime); border-color: var(--lime); color: #07060b; }
    .code { position: relative; margin-top: 1rem; border: 1px solid var(--line); border-radius: 1rem; background: rgba(0, 0, 0, 0.35); min-width: 0; }
    .code pre { margin: 0; padding: 1rem 1.25rem; overflow-x: auto; color: #d9d5f5; }
    .code-caption { padding: 0.6rem 6rem 0.6rem 1.25rem; border-bottom: 1px solid var(--line); color: var(--muted); font: 500 0.8rem var(--font-mono); overflow-wrap: anywhere; }
    .code .copy { position: absolute; top: 0.45rem; right: 0.5rem; min-height: 2rem; }

    /* Sections */
    .section { padding: 4.5rem 0; border-top: 1px solid var(--line); }
    .section-head { max-width: 46rem; margin-bottom: 2.5rem; }
    .section-head h2 { margin-top: 1rem; font-size: clamp(1.8rem, 4.5vw, 3rem); }
    .section-head .lead { margin-top: 1rem; }

    /* Steps */
    .steps { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); margin: 0; padding: 0; list-style: none; counter-reset: step; }
    .step { position: relative; display: flex; flex-direction: column; gap: 0.75rem; padding: 1.5rem; border: 1px solid var(--line); border-radius: 2rem; background: var(--soft); min-width: 0; }
    .step::before { counter-increment: step; content: "0" counter(step); font: 700 0.85rem var(--font-mono); color: var(--lime); }
    .step h3 { font-size: 1.15rem; }
    .step p { color: var(--muted); font-size: 0.95rem; }
    .step .cmd { margin-top: auto; }
    .extras { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 26rem), 1fr)); margin-top: 1rem; }
    .extra { padding: 1.5rem; border: 1px solid var(--line); border-radius: 2rem; background: var(--soft); min-width: 0; }
    .extra h3 { font-size: 1.05rem; }
    .extra p { margin-top: 0.5rem; color: var(--muted); font-size: 0.95rem; }

    /* Live preview */
    .viewer { border: 1px solid var(--line-strong); border-radius: 2rem; overflow: hidden; background: var(--soft); }
    .viewer-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; padding: 0.9rem; border-bottom: 1px solid var(--line); }
    .viewer-bar .field { flex: 1 1 16rem; min-width: 0; }
    .viewer-bar .open-full { margin-left: auto; }
    select, input[type="search"] { width: 100%; min-height: 2.5rem; padding: 0 1rem; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--bg); color: var(--fg); font: 500 0.9rem var(--font-sans); }
    select:focus-visible, input[type="search"]:focus-visible { outline: 2px solid var(--violet); outline-offset: 1px; }
    .viewer iframe { display: block; width: 100%; height: min(72vh, 42rem); border: 0; background: var(--bg); }
    /* Full screen: the viewer covers the window; its bar keeps the close button. */
    .viewer.is-expanded { position: fixed; inset: 0; z-index: 70; display: flex; flex-direction: column; border: 0; border-radius: 0; }
    .viewer.is-expanded iframe { flex: 1; height: auto; }
    body.viewer-open { overflow: hidden; }
    .note { padding: 1rem 1.25rem; color: var(--muted); }

    /* Component list */
    .toolbar { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem; }
    .search { max-width: 28rem; }
    .group + .group { margin-top: 3rem; }
    .group h3 { font-size: 1.25rem; margin-bottom: 1.25rem; }
    .cards { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr)); margin: 0; padding: 0; list-style: none; }
    .card { position: relative; display: flex; flex-direction: column; gap: 0.75rem; padding: 1.25rem; border: 1px solid var(--line); border-radius: 1.25rem; background: var(--soft); transition: border-color 0.2s, transform 0.2s; min-width: 0; }
    .card:hover { border-color: rgba(124, 92, 255, 0.55); transform: translateY(-2px); }
    .card-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
    .card h4 { font-size: 0.95rem; overflow-wrap: anywhere; }
    .card h4 a { text-decoration: none; }
    .card h4 a:hover { color: var(--lime); }
    .card p { flex: 1; color: var(--muted); font-size: 0.875rem; }
    .tag { flex: none; padding: 0.15rem 0.55rem; border-radius: 999px; border: 1px solid var(--line-strong); color: var(--muted); font: 500 0.7rem var(--font-mono); }
    .card-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .card .copy { min-height: 2rem; background: var(--lime); color: #07060b; border-color: var(--lime); }
    .empty { padding: 3rem 0; text-align: center; color: var(--muted); }

    /* Item pages: sidebar + article */
    .docs { display: grid; gap: 2rem; padding-top: 2rem; padding-bottom: 4rem; }
    @media (min-width: 64rem) {
      .docs { grid-template-columns: 15rem minmax(0, 1fr); gap: 3rem; padding-top: 3rem; }
      .sidebar { position: sticky; top: 5rem; align-self: start; max-height: calc(100vh - 6rem); overflow-y: auto; padding-right: 0.5rem; }
      .side-nav[open] > summary { display: none; }
    }
    .side-nav { border: 1px solid var(--line); border-radius: 1.25rem; background: var(--soft); padding: 0.25rem 1rem; }
    @media (min-width: 64rem) { .side-nav[open] { border: 0; background: none; padding: 0; } }
    .side-nav summary { cursor: pointer; padding: 0.75rem 0; font-weight: 600; }
    .side-nav h2 { margin: 1.25rem 0 0.4rem; color: var(--muted); font: 600 0.72rem var(--font-mono); text-transform: uppercase; letter-spacing: 0.12em; }
    .side-nav ul { margin: 0; padding: 0; list-style: none; }
    .side-nav a { display: block; padding: 0.3rem 0.75rem; border-radius: 0.6rem; color: var(--muted); text-decoration: none; font-size: 0.9rem; overflow-wrap: anywhere; }
    .side-nav a:hover { color: var(--fg); background: rgba(255, 255, 255, 0.04); }
    .side-nav a[aria-current="page"] { color: var(--fg); background: rgba(124, 92, 255, 0.18); box-shadow: inset 2px 0 0 var(--violet); }
    .doc { min-width: 0; }
    .crumbs { display: flex; flex-wrap: wrap; gap: 0.5rem; color: var(--muted); font-size: 0.875rem; }
    .crumbs a { text-decoration: none; }
    .crumbs a:hover { color: var(--fg); }
    .doc-head { position: relative; margin-top: 1rem; padding-bottom: 2rem; }
    .doc-head .tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .doc-head h1 { margin-top: 0.75rem; font-size: clamp(2rem, 5vw, 3.25rem); overflow-wrap: anywhere; }
    .doc-head .lead { margin-top: 1rem; }
    .doc-head .cmd { margin-top: 1.5rem; max-width: 46rem; }
    .toc { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1.5rem; }
    .toc a { padding: 0.25rem 0.75rem; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); font-size: 0.8rem; text-decoration: none; }
    .toc a:hover { color: var(--fg); border-color: var(--violet); }
    .doc-section { padding: 2.5rem 0 0; }
    .doc-section > h2 { font-size: 1.5rem; margin-bottom: 1rem; }
    .doc-section > p, .prose p { color: var(--muted); }
    .prose { display: flex; flex-direction: column; gap: 0.75rem; }
    .prose ul { margin: 0; padding-left: 1.25rem; color: var(--muted); }
    .prose code, .doc-section p code, td code, .facts code { padding: 0.1em 0.35em; border-radius: 0.35rem; background: rgba(255, 255, 255, 0.06); color: var(--fg); overflow-wrap: anywhere; }
    .prose a, .doc-section a:not(.pill-sm):not(.chip) { color: var(--fg); text-decoration-color: var(--violet); text-underline-offset: 3px; }
    .facts { display: grid; gap: 0.75rem; margin: 1.25rem 0 0; padding: 0; list-style: none; }
    .facts li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.4rem; color: var(--muted); font-size: 0.925rem; }
    .facts strong { color: var(--fg); font-weight: 600; margin-right: 0.25rem; }
    .api { margin-top: 1.5rem; padding: 1.5rem; border: 1px solid var(--line); border-radius: 1.5rem; background: var(--soft); min-width: 0; }
    .api-head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; margin-bottom: 0.75rem; }
    .api-head h3 { font: 600 1.05rem var(--font-mono); overflow-wrap: anywhere; }
    .api-head .deprecated { border-color: #ff5470; color: #ff5470; }
    .api h4 { margin: 1.25rem 0 0.5rem; color: var(--muted); font: 600 0.72rem var(--font-mono); text-transform: uppercase; letter-spacing: 0.12em; }
    .sig { margin: 0.75rem 0 0; padding: 0.75rem 1rem; border-radius: 0.75rem; background: rgba(0, 0, 0, 0.35); overflow-x: auto; color: #d9d5f5; white-space: pre-wrap; overflow-wrap: anywhere; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 1rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th, td { padding: 0.65rem 0.85rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); }
    tr:last-child td { border-bottom: 0; }
    th { color: var(--muted); font: 600 0.72rem var(--font-mono); text-transform: uppercase; letter-spacing: 0.08em; background: rgba(255, 255, 255, 0.02); }
    td:first-child { white-space: nowrap; }
    td:first-child code { color: var(--lime); }
    td .muted { color: var(--muted); }
    details.source { margin-top: 1rem; border: 1px solid var(--line); border-radius: 1rem; background: var(--soft); }
    details.source > summary { cursor: pointer; padding: 0.9rem 1.25rem; font-weight: 600; }
    details.source .code { margin: 0 1rem 1rem; }
    details.source pre { max-height: 36rem; }
    .pager { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); margin-top: 3.5rem; }
    .pager a { display: flex; flex-direction: column; gap: 0.25rem; padding: 1rem 1.25rem; border: 1px solid var(--line); border-radius: 1.25rem; text-decoration: none; }
    .pager a:hover { border-color: var(--violet); }
    .pager span { color: var(--muted); font-size: 0.8rem; }
    .pager .next { text-align: right; }

    /* Footer */
    footer { border-top: 1px solid var(--line); padding: 2.5rem 0 3rem; color: var(--muted); font-size: 0.875rem; }
    footer .wrap { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem; }

    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      *, *::before, *::after { transition-duration: 0.01ms !important; }
      .btn:hover, .card:hover { transform: none; }
    }
`;

/**
 * The page shell shared by every page.
 *
 * @param {object} options
 * @param {string} options.title Page title.
 * @param {string} options.description Meta description.
 * @param {string} [options.root] Relative path from the page to the site root (`''` or `../../`).
 * @param {string} [options.fontsHref] Fonts stylesheet, relative to the site root.
 * @param {string} [options.repositoryUrl] Link to the source repository.
 * @param {string} [options.playgroundHref] Playground link, relative to the site root.
 * @param {string} options.footerNote Text at the start of the footer.
 * @param {string} options.body The page's `<main>`.
 * @param {string} [options.script] Extra page script (plain JavaScript).
 */
export function renderShell(options) {
  const root = options.root ?? '';
  const home = root || './';
  const fonts = options.fontsHref
    ? `<link rel="stylesheet" href="${escapeHtml(root + options.fontsHref)}">`
    : '';
  const repository = options.repositoryUrl
    ? `<a class="nav-hide" href="${escapeHtml(options.repositoryUrl)}">GitHub</a>`
    : '';
  const playground = options.playgroundHref
    ? `<a class="nav-hide" href="${escapeHtml(root + options.playgroundHref)}">Playground</a>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(options.title)}</title>
  <meta name="description" content="${escapeHtml(options.description)}">
  <meta name="theme-color" content="#07060b">
  ${fonts}
  <style>${SITE_CSS}</style>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <div class="grain" aria-hidden="true"></div>

  <header class="nav">
    <div class="wrap">
      <a class="brand" href="${escapeHtml(home)}" aria-label="Integr8 Window Manager home"><span class="brand-mark" aria-hidden="true">i8</span><span>integr8<span class="slash">/</span>window-manager</span></a>
      <nav aria-label="Main">
        <a class="nav-hide" href="${escapeHtml(root)}#start">Get started</a>
        <a class="nav-hide" href="${escapeHtml(root)}#components">Components</a>
        ${playground}
        ${repository}
      </nav>
    </div>
  </header>

  ${options.body}

  <footer>
    <div class="wrap">
      <span>${escapeHtml(options.footerNote)}</span>
      <span>Built for <a href="https://integr8-media.com">integr8-media.com</a></span>
    </div>
  </footer>

  <p id="copy-status" class="sr-only" aria-live="polite"></p>

  <script>${COPY_SCRIPT}${VIEWER_SCRIPT}${options.script ?? ''}</script>
</body>
</html>
`;
}
