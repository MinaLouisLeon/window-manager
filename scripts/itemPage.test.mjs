import { describe, expect, it } from 'vitest';
import { itemNameFromUrl, renderItemPage } from './itemPage.mjs';

const item = {
  name: 'taskbar',
  type: 'registry:ui',
  title: 'Taskbar',
  description: 'The taskbar.',
  categories: ['shell'],
  dependencies: ['react'],
  registryDependencies: [
    'https://example.com/wm/r/window.json',
    'https://example.com/ui/r/button.json',
  ],
  files: [
    {
      path: 'components/Taskbar.tsx',
      target: '@/components/taskbar.tsx',
      content: [
        '/** The taskbar. */',
        'export function Taskbar(): null {',
        '  return null;',
        '}',
      ].join('\n'),
    },
  ],
};

const site = {
  baseUrl: 'https://example.com/wm/r',
  uiBaseUrl: 'https://example.com/ui/r',
  uiDocsUrl: 'https://example.com/ui/components/',
  version: '1.0.0',
  registryName: '@integr8-media/window-manager',
  groups: [
    {
      id: 'shell',
      label: 'Shell',
      items: [{ name: 'taskbar', title: 'Taskbar' }],
    },
    {
      id: 'window',
      label: 'Windows',
      items: [{ name: 'window', title: 'Window' }],
    },
  ],
  order: [
    { name: 'taskbar', title: 'Taskbar' },
    { name: 'window', title: 'Window' },
  ],
  exportOwners: new Map([['Taskbar', 'taskbar']]),
  docsPath: 'components/',
  playgroundPath: 'playground/',
};

describe('itemNameFromUrl', () => {
  it('takes the item name from a registry URL', () => {
    expect(itemNameFromUrl('https://example.com/r/window.json')).toBe('window');
  });
});

describe('renderItemPage', () => {
  const html = renderItemPage(
    { item, stories: [{ id: 'components--taskbar-top', name: 'Top' }] },
    site,
  );

  it('shows the install command and the live preview', () => {
    expect(html).toContain('npx shadcn@latest add https://example.com/wm/r/taskbar.json');
    expect(html).toContain('story=components--taskbar-top');
    expect(html).not.toContain('integr8Theme');
  });

  it('links dependencies to this site or to the ui site', () => {
    expect(html).toContain('href="../../components/window/"');
    expect(html).toContain('href="https://example.com/ui/components/button/"');
  });

  it('documents the exports from the TSDoc comments', () => {
    expect(html).toContain('id="api-Taskbar"');
  });

  it('has the previous and next links', () => {
    expect(html).toContain('<span>Next</span>Window');
  });
});
