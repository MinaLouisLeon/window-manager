// Generator config for the shadcn registry (scripts/buildRegistry.mjs).
// The registry is built from the same source files as the npm package. Imports from
// @integr8-media/ui become items of the ui registry, so a shadcn project needs neither package.

/** @type {import('../scripts/registryItems.mjs').RegistryConfig} */
export default {
  // Where this registry's JSON files are served (GitHub Pages by default). Set
  // REGISTRY_BASE_URL to move it.
  baseUrl: process.env.REGISTRY_BASE_URL ?? 'https://minalouisleon.github.io/window-manager/r',
  // The ui registry that `@integr8-media/ui` imports resolve to. Set UI_REGISTRY_BASE_URL to
  // point at another host.
  ui: {
    package: '@integr8-media/ui',
    baseUrl: process.env.UI_REGISTRY_BASE_URL ?? 'https://minalouisleon.github.io/integr8-ui/r',
    // Read from the installed ui package: its registry items and its package.json.
    registryDir: 'node_modules/@integr8-media/ui/dist/registry',
    packageJson: 'node_modules/@integr8-media/ui/package.json',
  },
  // Source folders that become items: core (one bundle), react (hooks), components (ui items).
  sources: ['src/core', 'src/react', 'src/components'],
  // Never part of the registry: tests and test helpers.
  exclude: [/\.test\.tsx?$/, /TestUtils\.tsx?$/],
  // `src/core/` is one multi-file item. Its files keep their names under lib/window-manager/,
  // so imports between core files stay relative.
  bundles: {
    'src/core/': {
      name: 'window-manager-core',
      title: 'Window manager core',
      description:
        'The framework-free window manager: createWindowManager, the geometry helpers, localStorageAdapter, WindowManagerError and all types.',
      target: '@lib/window-manager/',
      alias: '@/lib/window-manager/',
      categories: ['core'],
    },
  },
  // Registry categories: `hooks` for src/react, the lists below for src/components (by file name
  // without extension). A component that is in no list is filed under `shell`.
  componentCategories: {
    window: [
      'Desktop',
      'Window',
      'WindowTitleBar',
      'WindowControls',
      'WindowMenu',
      'SnapPreview',
      'CloseGuardDialog',
      'MenuItems',
      'SnapLayoutsMenu',
    ],
    shell: [
      'DesktopIcons',
      'Taskbar',
      'StartMenu',
      'WindowSwitcher',
      'DesktopSwitcher',
      'DesktopMenu',
      'WindowManagerShell',
      'DesktopOverview',
      'WallpaperPicker',
    ],
    'notification-area': [
      'NotificationArea',
      'TrayItem',
      'Clock',
      'NotificationCenter',
      'QuickSettings',
    ],
  },
  // `WindowManagerShell.tsx` becomes the `window-manager-shell` block: one command installs the
  // whole desktop, because the block depends on every component item.
  shell: {
    name: 'window-manager-shell',
    title: 'Window manager shell',
    description:
      'The whole desktop in one command: Desktop, Taskbar, StartMenu, switchers, menus and the close guard dialog.',
    categories: ['shell'],
  },
  // Packages provided by the app itself: never listed as dependencies.
  peerPackages: ['react', 'react-dom'],
  // Shown by `shadcn add` after installing an item.
  docs: 'Uses the Integr8 theme tokens: add `@integr8/theme` once per project (`npx shadcn@latest add @integr8/theme`).',
};
