# @integr8-media/window-manager

A full mini desktop for any React app: floating windows (drag, resize, minimize, maximize,
fullscreen, always on top, child and modal windows), snapping (halves, quarters, thirds), multiple
desktops with wallpapers, desktop icons, a taskbar with pinned apps, a start menu, window and
desktop switchers, context menus, messaging between windows, deep links and saved layouts.

Every visual piece comes from [`@integr8-media/ui`](https://github.com/MinaLouisLeon/integr8-ui);
this package adds no colors and no components of its own that ui already has. React 19 only.

- Headless first: every feature is a hook that returns state, actions and prop getters, so you can
  build your own visuals on the hooks alone.
- A framework-free core (`createWindowManager`) that you can test without a DOM.
- Works with a ui theme: light, dark, integr8, integr8-light and system.

## Three ways to use it

### 1. npm, app without Tailwind

```sh
npm install @integr8-media/window-manager @integr8-media/ui lucide-react react react-dom
```

```tsx
import '@integr8-media/ui/fonts.css';
import '@integr8-media/ui/styles.css'; // ui tokens and component classes
import '@integr8-media/window-manager/styles.css'; // window-manager classes only (no tokens)
```

### 2. npm, Tailwind v4 app

```css
@import "tailwindcss";
@import "@integr8-media/ui/theme.css";
@import "@integr8-media/window-manager/theme.css"; /* @source for the built files + --wm-* variables */
@import "@integr8-media/ui/fonts.css";
```

### 3. shadcn registry (single items, no npm package needed)

Add the namespaces once to `components.json`:

```json
{
  "registries": {
    "@integr8": "https://minalouisleon.github.io/integr8-ui/r/{name}.json",
    "@integr8-wm": "https://minalouisleon.github.io/integr8-window-manager/r/{name}.json"
  }
}
```

```sh
npx shadcn@latest add @integr8/theme                     # once per project (ui tokens)
npx shadcn@latest add @integr8-wm/window-manager-shell   # the whole desktop
npx shadcn@latest add @integr8-wm/window @integr8-wm/taskbar   # or single items
```

Items that import from ui pull the matching ui items from the ui registry automatically. The
registry site has a page per item with its install command, a live story and the source.

## Quick example

```tsx
import '@integr8-media/ui/fonts.css';
import '@integr8-media/ui/styles.css';
import '@integr8-media/window-manager/styles.css';
import { ThemeProvider, Toaster } from '@integr8-media/ui';
import { createWindowManager, localStorageAdapter } from '@integr8-media/window-manager/core';
import { WindowManagerProvider, WindowManagerShell, useAppWindow } from '@integr8-media/window-manager';
import { NotebookPen, Terminal } from 'lucide-react';

const manager = createWindowManager({
  apps: [
    { id: 'notes', title: 'Notes', icon: 'notes', size: { default: { width: 640, height: 480 } } },
    { id: 'terminal', title: 'Terminal', icon: 'terminal', placement: { pinned: true } },
  ],
  storage: localStorageAdapter(),
});

function Notes() {
  const win = useAppWindow();
  return <textarea onChange={() => win.setDirty(true)} />;
}

export function App() {
  return (
    <ThemeProvider defaultTheme="integr8">
      <WindowManagerProvider
        manager={manager}
        apps={{ notes: Notes, terminal: () => <pre>$</pre> }}
        icons={{ notes: NotebookPen, terminal: Terminal }}
      >
        <WindowManagerShell />
      </WindowManagerProvider>
      <Toaster />
    </ThemeProvider>
  );
}
```

Window content is unmounted while its window is minimized or on another desktop. Keep state you
need to survive that in your own store or in the window's `data` (`useAppWindow().setData`).

## Entries

| Import path | What it is |
| --- | --- |
| `@integr8-media/window-manager/core` | `createWindowManager()`, geometry helpers, `localStorageAdapter`, deep-link helpers, `WindowManagerError` and all types. No React, no DOM, no ui |
| `@integr8-media/window-manager` | `WindowManagerProvider`, every hook and every component (re-exports the core types) |
| `@integr8-media/window-manager/styles.css` | Prebuilt CSS for apps without Tailwind |
| `@integr8-media/window-manager/theme.css` | Tailwind v4 preset |

Peer dependencies: `react` and `react-dom` 19, `@integr8-media/ui`, `lucide-react`, and
`tailwindcss` 4 (optional, only for `theme.css`).

## Building blocks

**Components:** `WindowManagerShell` (the default composition), `Desktop`, `Window`,
`WindowTitleBar`, `WindowControls`, `WindowMenu`, `SnapPreview`, `SnapLayoutsMenu`,
`CloseGuardDialog`, `DesktopIcons`, `Taskbar`, `StartMenu`, `WindowSwitcher`, `DesktopSwitcher`,
`DesktopMenu`, `DesktopOverview`, `WallpaperPicker`, and the notification area: `NotificationArea`,
`NotificationTrayItem`, `Clock`, `NotificationCenter`, `QuickSettings`.

**Hooks:** `useWindowManager`, `useWindow`, `useDesktops`, `useAppWindow`, `useDesktopSurface`,
`useWindowFrame`, `useSnapPreview`, `useSnapLayouts`, `useDesktopIcons`, `useTaskbar`,
`useStartMenu`, `useWindowSwitcher`, `useDesktopSwitcher`, `useDesktopOverview`, `useWindowMenu`,
`useDesktopMenu`, `useShortcuts`, `useTray`, `useNotifications`, `useClock`, `useQuickSettings`,
and `useRegisterWindowMenuItems` / `useRegisterDesktopMenuItems` to add your own menu entries.

Each component accepts `className` and `style` and forwards its ref. Compose your own shell from
the parts, or skip the components and build on the hooks.

### Inside a window

`useAppWindow()` gives the app's window component its id and state plus `setTitle`, `setBadge`,
`setDirty`, `setData`, `setCloseGuard`, `close`, `open` (child or other windows), `send` and
`onMessage`. A window marked `dirty` asks before closing (`CloseGuardDialog`): "Discard changes" or
"Cancel", plus "Save" when the app set a save handler with `setSaveHandler`. A handler that returns
`false` (or throws) keeps the window open.

```tsx
const win = useAppWindow();
useEffect(() => {
  win.setSaveHandler(() => saveDocument()); // a promise that rejects or resolves false: stay open
  return () => win.setSaveHandler(null);
}, [win.setSaveHandler]);
win.open({ appId: 'settings', parentId: win.id, modal: true }); // a modal child of this window
win.send({ appId: 'terminal' }, { run: 'ls' }); // message another app
```

### Deep links

```ts
manager.openFromUrl('?open=notes&file=todo.txt'); // opens Notes with data { file: 'todo.txt' }
manager.toUrl({ appId: 'notes' }, { file: 'todo.txt' }); // '?open=notes&file=todo.txt'
```

### Snap layouts and edge magnet

Hover the maximize button of a window (or press and hold it on a touch screen) to open the snap
layouts menu: halves, quarters, thirds, and two thirds with a third. Pick a zone and the window
snaps there. `SnapLayoutsMenu` is part of `WindowControls`; `useSnapLayouts(windowId)` gives the
layouts and `apply(layoutId, zone)` for your own menu. While a window is dragged its edges stick to
the edges of the work area and of the other windows (8 px). Tune it with the manager options
`edgeMagnet` (pixels, or `false` for no magnet), `snapThreshold` (pixels from an edge that start a
snap preview, default 16) and `minVisibleTitleBar`; `manager.getConfig()` returns the values in
use. The pure helpers `magnetize()` and `SNAP_LAYOUTS` are exported from
`@integr8-media/window-manager/core`.

### Desktop overview and wallpapers

`DesktopOverview` shows every desktop with a frame (icon and title, never a live thumbnail) for
each window. Click a desktop to switch, click a window to focus it, drag a window onto another
desktop to move it (Shift+Left or Right does the same from the keyboard). Open it with Ctrl+Alt+O,
the desktop menu or the desktop switcher; Esc closes it. `useDesktopOverview()` is the headless
version.

Each desktop has its own wallpaper: `{ type: 'theme' | 'color' | 'gradient' | 'image' }`, set in
`createWindowManager({ desktops })` or with `manager.setWallpaper(desktopId, wallpaper)`, and saved
with the layout. The desktop menu's "Change wallpaper…" opens `WallpaperPicker` (theme background,
colors and gradients built from the theme tokens, any CSS color or gradient, an image URL). The app
stores uploads itself:

```tsx
<WindowManagerShell
  desktop={{ onWallpaperUpload: async (file) => (await uploadToMyServer(file)).url }}
/>
```

### Notification area

`WindowManagerShell` puts a `NotificationArea` at the end of the taskbar: tray items, the clock
(a popover with ui's `Calendar`), the notification bell and the quick settings (theme, taskbar
position, auto-hide, window controls style). Pass your own with `notificationArea`, or `null` for
none.

```ts
const unregister = manager.registerTrayItem({ id: 'sync', label: 'Sync', icon: 'sync', appId: 'files' });
manager.updateTrayItem('sync', { badge: 2 });

manager.notify({
  title: 'Export finished',
  body: 'report.pdf is ready.',
  level: 'success', // 'info' | 'success' | 'warning' | 'error'
  action: { label: 'Open', open: { appId: 'files' } },
});
```

New notifications also show as toasts through ui's `toast()`: mount ui's `<Toaster />` once in your
app (or turn them off with `<NotificationArea notifications={{ toasts: false }} />`). The Toaster
is positioned against the browser window; when the shell fills only part of the page, put the
Toaster inside an element with a CSS `transform` that wraps the shell to keep toasts inside it, and
use its `offset` to clear the taskbar. Notifications
and tray items are not saved with the layout.

## Theming

Colors come only from the ui theme tokens, so a window manager follows whatever ui theme is active
(`ThemeProvider`, `ThemeSwitcher`). Sizes are CSS variables you can override on any ancestor:

| Variable | Default |
| --- | --- |
| `--wm-titlebar-height` | `2.25rem` |
| `--wm-taskbar-size` | `3rem` |
| `--wm-resize-handle` | `6px` |
| `--wm-icon-size` | `3rem` |
| `--wm-window-radius` | `var(--radius)` |
| `--wm-shadow` | two values, focused and unfocused |

Style hooks for your own CSS: `data-wm-window`, `data-state="focused|unfocused"`, `data-status`,
`data-snap`, `data-dragging`, `data-resizing`, `data-always-on-top`, `data-blocked`,
`data-controls-style` (`windows` or `mac`), `data-taskbar-position` and `data-wm-no-drag` (put it
on title bar content that must not start a drag). Transitions are off with
`prefers-reduced-motion`.

Shell settings (taskbar position `bottom | top | left | right`, taskbar auto-hide, window controls
style) are set in `createWindowManager({ shell })`, changed with `manager.setShellSettings()` or
the desktop menu, and saved with the layout. An app can override the controls style with
`controlsStyle` in its definition.

## Persistence

Pass a `storage` adapter to save and restore the layout (windows, bounds, snap state, desktops,
wallpapers, icon order, pinned apps, shell settings):

```ts
import { createWindowManager, localStorageAdapter } from '@integr8-media/window-manager/core';

createWindowManager({
  apps,
  storage: localStorageAdapter('my-app-layout'), // default key 'integr8-wm-layout'
  restore: (win) => win.appId !== 'terminal', // which saved windows to reopen (default all)
  saveDebounceMs: 500,
});
```

- The layout is loaded once on start and saved after every change, debounced.
- Windows of unknown apps are skipped. A snapshot with another `version` or a broken shape is
  rejected with `INVALID_SNAPSHOT`; the manager starts empty and fires `layout:restored` with
  `{ ok: false }`.
- Notifications and tray items are not saved.
- Keep a window's own state (for example the open folder) in its `data`; keep anything bigger in
  your own store.
- `manager.serialize()`, `manager.restoreLayout(snapshot)` and `manager.flush()` give manual
  control.

A custom adapter is any object with `load()` and `save(snapshot)`; both may be async:

```ts
const storage: LayoutStorage = {
  load: async () => (await fetch('/api/layout')).json(),
  save: async (snapshot) => {
    await fetch('/api/layout', { method: 'PUT', body: JSON.stringify(snapshot) });
  },
};
```

## Keyboard shortcuts

All defaults can be changed per shortcut, or set to `false`, through the provider's `shortcuts`
prop (or `false` to disable them all). They are ignored while focus is in an input, unless they
use Ctrl+Alt.

| Action | Default |
| --- | --- |
| Cycle windows (window switcher) | Ctrl+\` / Ctrl+Shift+\` |
| Close focused window | Ctrl+Alt+W |
| Minimize / toggle maximize | Ctrl+Alt+M / Ctrl+Alt+Up |
| Snap left / right | Ctrl+Alt+Left / Ctrl+Alt+Right |
| Toggle fullscreen / always on top | Ctrl+Alt+F / Ctrl+Alt+T |
| Show desktop / desktop overview | Ctrl+Alt+D / Ctrl+Alt+O |
| Switch to desktop 1–9 | Ctrl+Alt+1 … 9 |
| Open start menu | Ctrl+Alt+Space |
| Move or resize with the keyboard | Window menu → Move / Resize, then arrows (Shift: 10× step), Enter commits, Esc cancels |
| Leave fullscreen | Esc |

```tsx
<WindowManagerProvider
  manager={manager}
  apps={apps}
  shortcuts={{ closeWindow: 'Ctrl+Alt+Q', toggleAlwaysOnTop: false }}
>
```

## Accessibility

Every action is reachable by keyboard. Windows are `role="dialog"` labelled by their title
(`aria-modal` only for modal children); the taskbar is a `toolbar` and the desktop icons a grid,
both with roving focus. Focus returns to the next window or the taskbar button after close,
minimize and desktop switch, and a polite live region announces snap, minimize, maximize and
desktop switches. Resize handles are hidden from screen readers; keyboard resize is the accessible
path.

## API reference

```sh
npm run docs   # TypeDoc → docs/api
```

Every public export has TSDoc, which TypeDoc and the registry site read.

## Non-goals

- No app content, routing or data fetching
- No native OS windows (Tauri multi-window) and no tiling beyond the snap zones
- No live window thumbnails (taskbar previews show titles and icons)
- No animation library; no frameworks other than React for now
- No duplicated ui components and no color tokens of its own

## Development

```sh
npm install
npm run lint && npm run typecheck && npm run test:coverage && npm run build
npm run size             # bundle budgets, after a build
npm run check:exports    # publint + are-the-types-wrong
npm run playground       # Ladle, with the five ui themes in its toolbar
npm run playground:smoke # Playwright over every story and theme
npm run fixtures         # npm, Tailwind and shadcn fixture apps
```

The spec lives in `docs/SPEC.md`.

## License

MIT
