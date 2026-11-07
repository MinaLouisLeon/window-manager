import { describe, expect, it } from 'vitest';
import { renderRegistryPage } from './registryPage.mjs';

const index = {
  name: '@integr8-media/window-manager',
  items: [
    {
      name: 'window-manager-shell',
      type: 'registry:ui',
      title: 'Window manager shell',
      description: 'The whole desktop.',
      categories: ['shell'],
    },
    {
      name: 'window-manager-core',
      type: 'registry:lib',
      title: 'Window manager core',
      description: 'The framework-free core.',
      categories: ['core'],
    },
  ],
};

const options = {
  baseUrl: 'https://example.com/wm/r',
  uiBaseUrl: 'https://example.com/ui/r',
  version: '1.0.0',
  docsPath: 'components/',
  playgroundPath: 'playground/',
  previewStories: { 'window-manager-shell': 'shell--default' },
  defaultStory: 'shell--default',
};

describe('renderRegistryPage', () => {
  const html = renderRegistryPage(index, options);

  it('shows install commands for this registry and the ui theme', () => {
    expect(html).toContain(
      'npx shadcn@latest add https://example.com/wm/r/window-manager-shell.json',
    );
    expect(html).toContain('npx shadcn@latest add https://example.com/ui/r/theme.json');
  });

  it('lists every item in a group, linked to its page', () => {
    expect(html).toContain('href="components/window-manager-shell/"');
    expect(html).toContain('data-group="shell"');
    expect(html).toContain('data-group="core"');
  });

  it('adds a preview button only to items that have a story', () => {
    expect(html).toContain('data-story="shell--default"');
    expect(html.match(/data-story="/g)).toHaveLength(1);
  });

  it('embeds the playground and the default story', () => {
    expect(html).toContain('data-playground="playground/"');
    expect(html).toContain('data-default-story="shell--default"');
  });

  it('leaves the preview out without a playground', () => {
    const plain = renderRegistryPage(index, { ...options, playgroundPath: undefined });
    expect(plain).not.toContain('id="preview"');
  });
});
