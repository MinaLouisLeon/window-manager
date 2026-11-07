import { describe, expect, it } from 'vitest';
import {
  inlineMarkdown,
  renderMarkdown,
  renderShell,
  replaceLinks,
  typeLabel,
} from './siteLayout.mjs';

const linkFor = (name) => (name === 'Button' ? '../button/#api-Button' : null);

describe('replaceLinks', () => {
  it('turns {@link} tags into inline code or their label', () => {
    expect(replaceLinks('See {@link Button}.')).toBe('See `Button`.');
    expect(replaceLinks('See {@link Button | the button}.')).toBe('See the button.');
  });
});

describe('inlineMarkdown', () => {
  it('renders code, bold and links, and escapes the rest', () => {
    expect(inlineMarkdown('A **bold** `x < y` and [docs](https://a.dev) <b>')).toBe(
      'A <strong>bold</strong> <code>x &lt; y</code> and <a href="https://a.dev">docs</a> &lt;b&gt;',
    );
  });

  it('links inline code that names a documented export', () => {
    expect(inlineMarkdown('Props for {@link Button}.', { linkFor })).toBe(
      'Props for <a href="../button/#api-Button"><code>Button</code></a>.',
    );
    expect(inlineMarkdown('Call `Button()`.', { linkFor })).toContain(
      'href="../button/#api-Button"',
    );
  });

  it('leaves unsafe link targets as text', () => {
    expect(inlineMarkdown('[x](javascript:alert(1))')).not.toContain('<a');
  });
});

describe('renderMarkdown', () => {
  it('renders paragraphs, lists and code blocks', () => {
    const html = renderMarkdown(
      [
        'First line',
        'same paragraph.',
        '',
        '- one',
        '- two',
        '',
        '```tsx',
        '<Button />',
        '```',
      ].join('\n'),
    );
    expect(html).toContain('<p>First line same paragraph.</p>');
    expect(html).toContain('<ul><li>one</li><li>two</li></ul>');
    expect(html).toContain('<pre><code>&lt;Button /&gt;</code></pre>');
    expect(html).toContain('data-copy="&lt;Button /&gt;"');
  });
});

describe('typeLabel', () => {
  it('names registry types', () => {
    expect(typeLabel('registry:ui')).toBe('component');
    expect(typeLabel('registry:lib')).toBe('helper');
    expect(typeLabel('registry:style')).toBe('style');
  });
});

describe('renderShell', () => {
  const html = renderShell({
    title: 'Button · Integr8 UI',
    description: 'A button.',
    root: '../../',
    fontsHref: 'assets/fonts.css',
    footerNote: '@integr8-media/ui · v1.0.0',
    body: '<main id="main">Body</main>',
    script: 'console.log(1);',
  });

  it('points shared links at the site root', () => {
    expect(html).toContain('<link rel="stylesheet" href="../../assets/fonts.css">');
    expect(html).toContain('href="../../#components"');
    expect(html).toContain('class="brand" href="../../"');
  });

  it('includes the body, footer and scripts', () => {
    expect(html).toContain('<title>Button · Integr8 UI</title>');
    expect(html).toContain('<main id="main">Body</main>');
    expect(html).toContain('@integr8-media/ui · v1.0.0');
    expect(html).toContain('console.log(1);');
    expect(html).toContain('[data-copy]');
    expect(html).toContain('[data-expand]');
  });
});
