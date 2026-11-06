import { describe, expect, it } from 'vitest';
import config from '../registry/registry.config.mjs';
import {
  aliasFor,
  buildRegistryIndex,
  buildRegistryItems,
  categoryOf,
  describeExport,
  describeFile,
  importSpecifiers,
  itemType,
  packageName,
  RegistryError,
  resolveBaseUrl,
  resolveRelative,
  rewriteUiImports,
  toKebabCase,
} from './registryItems.mjs';

const BASE = 'https://minalouisleon.github.io/integr8-window-manager/r';
const UI_BASE = 'https://minalouisleon.github.io/integr8-ui/r';

const testConfig = { ...config, baseUrl: BASE, ui: { ...config.ui, baseUrl: UI_BASE } };

const pkg = {
  name: '@integr8-media/window-manager',
  version: '0.1.0',
  dependencies: { 'lucide-react': '^1.47.0' },
};

const uiMap = new Map([
  ['Button', { item: 'button', alias: '@/components/ui/button' }],
  ['ButtonProps', { item: 'button', alias: '@/components/ui/button' }],
  ['Tooltip', { item: 'tooltip', alias: '@/components/ui/tooltip' }],
  ['cn', { item: 'utils', alias: '@/lib/utils' }],
  ['useTheme', { item: 'theme', alias: '@/lib/theme/useTheme' }],
]);

const coreFiles = [
  {
    path: 'src/core/index.ts',
    content: "export { createWindowManager } from './createWindowManager';\n",
  },
  {
    path: 'src/core/createWindowManager.ts',
    content:
      "import { clamp } from './geometry';\n/** Creates it. */\nexport function createWindowManager() { return clamp; }\n",
  },
  { path: 'src/core/geometry.ts', content: 'export function clamp() {}\n' },
];

describe('naming helpers', () => {
  it('turns names into kebab case', () => {
    expect(toKebabCase('useWindowFrame')).toBe('use-window-frame');
    expect(toKebabCase('WindowManagerProvider')).toBe('window-manager-provider');
    expect(toKebabCase('Taskbar')).toBe('taskbar');
    expect(toKebabCase('SnapUIMenu')).toBe('snap-ui-menu');
  });

  it('types files by folder: react → hook, components → ui, the rest → lib', () => {
    expect(itemType('src/react/useWindowFrame.ts')).toBe('registry:hook');
    expect(itemType('src/react/WindowManagerProvider.tsx')).toBe('registry:hook');
    expect(itemType('src/components/Taskbar.tsx')).toBe('registry:ui');
    expect(itemType('src/core/geometry.ts')).toBe('registry:lib');
  });

  it('describes the item name and install path', () => {
    expect(describeFile('src/react/useWindowFrame.ts')).toEqual({
      name: 'use-window-frame',
      file: 'hooks/use-window-frame.ts',
      type: 'registry:hook',
    });
    expect(describeFile('src/react/WindowManagerProvider.tsx')).toEqual({
      name: 'window-manager-provider',
      file: 'hooks/window-manager-provider.tsx',
      type: 'registry:hook',
    });
    expect(describeFile('src/components/Taskbar.tsx')).toEqual({
      name: 'taskbar',
      file: 'ui/taskbar.tsx',
      type: 'registry:ui',
    });
  });

  it('builds import aliases', () => {
    expect(aliasFor('ui/taskbar.tsx')).toBe('@/components/ui/taskbar');
    expect(aliasFor('hooks/use-window-frame.ts')).toBe('@/hooks/use-window-frame');
  });

  it('resolves relative imports and package names', () => {
    expect(resolveRelative('src/react/useX.ts', '../core')).toBe('src/core');
    expect(resolveRelative('src/components/A.tsx', './B')).toBe('src/components/B');
    expect(packageName('lucide-react')).toBe('lucide-react');
    expect(packageName('@scope/pkg/sub')).toBe('@scope/pkg');
  });

  it('files items under the spec categories', () => {
    expect(categoryOf('src/react/useX.ts', testConfig)).toBe('hooks');
    expect(categoryOf('src/components/Window.tsx', testConfig)).toBe('window');
    expect(categoryOf('src/components/Taskbar.tsx', testConfig)).toBe('shell');
    expect(categoryOf('src/components/Clock.tsx', testConfig)).toBe('notification-area');
    expect(categoryOf('src/components/Unlisted.tsx', testConfig)).toBe('shell');
    expect(categoryOf('src/core/index.ts', testConfig)).toBe('core');
  });

  it('fills the base URL', () => {
    expect(resolveBaseUrl('https://x.test/{name}/{version}/', pkg)).toBe(
      'https://x.test/@integr8-media/window-manager/0.1.0',
    );
  });

  it('lists import specifiers and skips comments', () => {
    const source =
      "import a from 'a';\nimport type { B } from './b';\nimport 'side';\n/**\n * import c from 'c';\n */\nexport function x() {}\n";
    expect(importSpecifiers(source)).toEqual(['a', './b', 'side']);
  });

  it('describes an export from its TSDoc', () => {
    expect(
      describeExport('/** Opens a window. More text. */\nexport function open() {}', 'open'),
    ).toBe('Opens a window.');
    expect(describeExport('export function nothing() {}', 'nothing')).toBeUndefined();
  });
});

describe('rewriteUiImports', () => {
  const run = (source) =>
    rewriteUiImports(source, 'src/components/X.tsx', '@integr8-media/ui', uiMap);

  it('rewrites a name to the ui item that exports it', () => {
    const result = run("import { Button } from '@integr8-media/ui';\n");
    expect(result.content).toBe("import { Button } from '@/components/ui/button';\n");
    expect(result.items).toEqual(['button']);
  });

  it('splits one statement over several items and keeps order', () => {
    const result = run(
      "import { Button, cn, Tooltip, type ButtonProps } from '@integr8-media/ui';\n",
    );
    expect(result.content).toBe(
      [
        "import { Button, type ButtonProps } from '@/components/ui/button';",
        "import { cn } from '@/lib/utils';",
        "import { Tooltip } from '@/components/ui/tooltip';",
        '',
      ].join('\n'),
    );
    expect(result.items.sort()).toEqual(['button', 'tooltip', 'utils']);
  });

  it('keeps import type statements type-only and handles multi-line lists and aliases', () => {
    const result = run(
      'import type {\n  ButtonProps,\n  Button as B,\n} from "@integr8-media/ui";\n',
    );
    expect(result.content).toBe(
      "import type { ButtonProps, Button as B } from '@/components/ui/button';\n",
    );
  });

  it('maps theme hooks to their file inside the theme bundle', () => {
    expect(run("import { useTheme } from '@integr8-media/ui';").content).toBe(
      "import { useTheme } from '@/lib/theme/useTheme';",
    );
  });

  it('throws UNRESOLVED_IMPORT for a name no ui item exports', () => {
    expect(() => run("import { Nope } from '@integr8-media/ui';")).toThrowError(RegistryError);
    try {
      run("import { Nope } from '@integr8-media/ui';");
    } catch (error) {
      expect(error.code).toBe('UNRESOLVED_IMPORT');
      expect(error.message).toContain('Nope');
    }
  });

  it('throws UNRESOLVED_IMPORT for default, namespace, deep and re-export forms', () => {
    for (const source of [
      "import ui from '@integr8-media/ui';",
      "import * as ui from '@integr8-media/ui';",
      "import { x } from '@integr8-media/ui/deep';",
      "export { Button } from '@integr8-media/ui';",
    ]) {
      expect(() => run(source)).toThrowError(/cannot rewrite/);
    }
  });

  it('leaves files without ui imports alone', () => {
    const source = "import { useState } from 'react';\n";
    expect(run(source)).toEqual({ content: source, items: [] });
  });
});

describe('buildRegistryItems', () => {
  const files = [
    ...coreFiles,
    {
      path: 'src/react/useWindowFrame.ts',
      content:
        "import { useState } from 'react';\nimport { clamp } from '../core';\nimport { createWindowManager } from '../core/createWindowManager';\n/** Frame props for a window. */\nexport function useWindowFrame() { return [useState, clamp, createWindowManager]; }\n",
    },
    {
      path: 'src/react/WindowManagerProvider.tsx',
      content:
        "import { useWindowFrame } from './useWindowFrame';\nexport function WindowManagerProvider() { return useWindowFrame; }\n",
    },
    {
      path: 'src/components/Taskbar.tsx',
      content:
        "import { Button, cn } from '@integr8-media/ui';\nimport { X } from 'lucide-react';\nimport { useWindowFrame } from '../react/useWindowFrame';\n/** The taskbar. */\nexport function Taskbar() { return [Button, cn, X, useWindowFrame]; }\n",
    },
    {
      path: 'src/components/Window.tsx',
      content:
        "import { Tooltip } from '@integr8-media/ui';\nexport function Window() { return Tooltip; }\n",
    },
    {
      path: 'src/components/WindowManagerShell.tsx',
      content:
        "import { Taskbar } from './Taskbar';\nimport { Window } from './Window';\n/** The whole desktop. */\nexport function WindowManagerShell() { return [Taskbar, Window]; }\n",
    },
  ];

  const items = buildRegistryItems(files, pkg, testConfig, uiMap);
  const byName = (name) => items.find((item) => item.name === name);

  it('makes the core one multi-file lib item with relative imports intact', () => {
    const core = byName('window-manager-core');
    expect(core.type).toBe('registry:item');
    expect(core.categories).toEqual(['core']);
    expect(core.files.map((file) => file.target)).toEqual([
      '@lib/window-manager/createWindowManager.ts',
      '@lib/window-manager/geometry.ts',
      '@lib/window-manager/index.ts',
    ]);
    expect(core.files[0].content).toContain("from './geometry'");
    expect(core.registryDependencies).toBeUndefined();
  });

  it('makes a hook item per src/react file, with the provider installed as a hook', () => {
    const hook = byName('use-window-frame');
    expect(hook.type).toBe('registry:hook');
    expect(hook.files[0].path).toBe('hooks/use-window-frame.ts');
    expect(hook.categories).toEqual(['hooks']);
    expect(hook.registryDependencies).toEqual([`${BASE}/window-manager-core.json`]);
    expect(hook.files[0].content).toContain("from '@/lib/window-manager/index'");
    expect(hook.files[0].content).toContain("from '@/lib/window-manager/createWindowManager'");
    expect(hook.dependencies).toBeUndefined();

    const provider = byName('window-manager-provider');
    expect(provider.type).toBe('registry:hook');
    expect(provider.files[0].path).toBe('hooks/window-manager-provider.tsx');
    expect(provider.registryDependencies).toEqual([`${BASE}/use-window-frame.json`]);
    expect(provider.files[0].content).toContain("from '@/hooks/use-window-frame'");
  });

  it('makes a ui item per component and rewrites ui imports to ui registry items', () => {
    const taskbar = byName('taskbar');
    expect(taskbar.type).toBe('registry:ui');
    expect(taskbar.files[0].path).toBe('ui/taskbar.tsx');
    expect(taskbar.description).toBe('The taskbar.');
    expect(taskbar.files[0].content).toContain("import { Button } from '@/components/ui/button';");
    expect(taskbar.files[0].content).toContain("import { cn } from '@/lib/utils';");
    expect(taskbar.files[0].content).toContain("from '@/hooks/use-window-frame'");
    expect(taskbar.registryDependencies).toEqual(
      [`${UI_BASE}/button.json`, `${UI_BASE}/utils.json`, `${BASE}/use-window-frame.json`].sort(),
    );
  });

  it('lists npm imports other than react and ui as dependencies with ui ranges', () => {
    expect(byName('taskbar').dependencies).toEqual(['lucide-react@^1.47.0']);
    expect(byName('window').dependencies).toBeUndefined();
  });

  it('turns WindowManagerShell into a block that depends on every component item', () => {
    const shell = byName('window-manager-shell');
    expect(shell.type).toBe('registry:block');
    expect(shell.categories).toEqual(['shell']);
    expect(shell.registryDependencies).toEqual(
      [`${BASE}/taskbar.json`, `${BASE}/window.json`].sort(),
    );
    expect(items.filter((item) => item.name === 'window-manager-shell')).toHaveLength(1);
  });

  it('adds the theme hint to every single-file item', () => {
    for (const name of ['use-window-frame', 'taskbar', 'window']) {
      expect(byName(name).docs).toContain('@integr8/theme');
    }
  });

  it('sorts items by name', () => {
    const names = items.map((item) => item.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('throws UNRESOLVED_IMPORT for a ui name that is not in the ui registry', () => {
    const bad = [
      { path: 'src/components/Bad.tsx', content: "import { Missing } from '@integr8-media/ui';\n" },
    ];
    expect(() => buildRegistryItems(bad, pkg, testConfig, uiMap)).toThrowError(/Missing/);
  });

  it('throws UNRESOLVED_IMPORT for a relative import outside the registry', () => {
    const bad = [{ path: 'src/components/Bad.tsx', content: "import { x } from './Gone';\n" }];
    expect(() => buildRegistryItems(bad, pkg, testConfig, uiMap)).toThrowError(
      /not part of the registry/,
    );
  });

  it('throws DUPLICATE_NAME when two files would become the same item', () => {
    const clash = [
      { path: 'src/react/useThing.ts', content: 'export function useThing() {}\n' },
      { path: 'src/react/UseThing.tsx', content: 'export function UseThing() {}\n' },
    ];
    expect(() => buildRegistryItems(clash, pkg, testConfig, uiMap)).toThrowError(/would both be/);
  });

  it('makes no block and no core item when the files are missing', () => {
    expect(buildRegistryItems([], pkg, testConfig, uiMap)).toEqual([]);
  });

  it('builds an index without file contents', () => {
    const index = buildRegistryIndex(items, { name: pkg.name, homepage: 'https://x.test' });
    expect(index.name).toBe(pkg.name);
    expect(index.items).toHaveLength(items.length);
    for (const item of index.items) {
      expect(item).not.toHaveProperty('$schema');
      for (const file of item.files ?? []) expect(file).not.toHaveProperty('content');
    }
  });
});
