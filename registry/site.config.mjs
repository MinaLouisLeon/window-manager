// Configuration of the registry site (landing page, item pages, live previews). The generator,
// layout and theme come from @integr8-media/config; this file only holds what is specific to the
// window manager. Build it with `npm run site:build`, or look at it with `npm run site`.
// To turn the site off for a package, set `"integr8": { "site": false }` in package.json.

import { defineRegistrySite } from '@integr8-media/config/registry-site';

export default defineRegistrySite({
  brand: {
    name: 'Integr8 Window Manager',
    slug: 'window-manager',
    eyebrow: 'Window manager',
    heroTitle: 'A full desktop',
    heroAccent: 'inside your React app.',
    lead: 'Floating windows with drag, resize and snapping, multiple desktops, a taskbar, a start menu and saved layouts. Use the npm package, or copy in only the pieces you need with shadcn.',
    title: 'Integr8 Window Manager',
    description:
      'A full mini desktop for any React app, as an npm package and a shadcn registry: copy in only the pieces you need.',
    playgroundLink: true,
  },
  // Keep this the same as `baseUrl` in registry.config.mjs. REGISTRY_BASE_URL overrides both.
  registryUrl: 'https://minalouisleon.github.io/window-manager/r',
  categories: [
    ['shell', 'Shell'],
    ['window', 'Windows'],
    ['notification-area', 'Notification area'],
    ['hooks', 'Hooks'],
    ['core', 'Core'],
  ],
  // Which Ladle stories show which item: a part of the story id (ids look like
  // `components--window-default`). An item that is not listed has no live preview.
  stories: {
    window: ['--window-'],
    'window-title-bar': ['--title-bar-and-controls-'],
    'window-controls': ['--title-bar-and-controls-'],
    'window-menu': ['--window-menu-content'],
    'snap-preview': ['--desktop-surface'],
    'close-guard-dialog': ['--close-guard'],
    desktop: ['--desktop-surface'],
    'desktop-icons': ['--desktop-icons-grid'],
    'desktop-menu': ['--desktop-menu-content'],
    taskbar: ['--taskbar-'],
    'start-menu': ['--start-menu-open'],
    'window-switcher': ['--window-switcher-overlay'],
    'desktop-switcher': ['--desktop-switcher-popover'],
    'window-manager-shell': ['shell--'],
  },
  defaultStory: 'window-manager-shell',
  ui: {
    registryUrl: process.env.UI_REGISTRY_BASE_URL ?? 'https://minalouisleon.github.io/integr8-ui/r',
  },
  setup: {
    namespace: '@integr8-wm',
    lead: 'Works in any React 19 app set up for shadcn/ui with Tailwind v4: Next.js, Vite, React Router. Prefer npm? The README covers the package.',
    steps: [
      {
        title: 'Set up shadcn',
        text: 'Skip this if your project already has a `components.json`.',
        command: 'npx shadcn@latest init',
      },
      {
        title: 'Add the theme',
        text: 'Once per project: the Integr8 theme tokens from the ui registry.',
        command: 'npx shadcn@latest add {uiRegistryUrl}/theme.json',
      },
      {
        title: 'Add the desktop',
        text: 'The shell brings every part it needs. The code is yours to change.',
        command: 'npx shadcn@latest add {registryUrl}/window-manager-shell.json',
      },
    ],
    extras: [
      {
        title: 'Render the shell',
        text: 'Render it inside a `WindowManagerProvider`. The shell draws the desktop, windows and taskbar.',
        code: "import { WindowManagerShell } from '@/components/window-manager-shell';\n\nexport function App() {\n  return <WindowManagerShell />;\n}",
      },
    ],
  },
  copy: {
    previewLead:
      'Every window, taskbar and menu runs live from the Ladle playground. Pick a story.',
  },
});
