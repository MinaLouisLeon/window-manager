# @integr8-media/window-manager — spec

A full mini desktop for any React app: floating windows (drag, resize, minimize, maximize, fullscreen, always on top, child and modal windows), snapping (halves, quarters, thirds, snap layouts, sticky edges), multiple desktops with an overview and wallpapers, desktop icons, a taskbar with pinned apps and a notification area, a start menu, switchers, context menus, messaging between windows, deep links and saved layouts. Build order 3, in a fresh repo. **Status: decisions locked 2026-11-06; nothing built yet.**

It ships two ways, like `@integr8-media/ui`:

1. **The whole package from npm** (`npm install @integr8-media/window-manager`), built on the published `@integr8-media/ui`.
2. **Single items with shadcn** from this repo's own registry, generated from the same source files. ui imports become ui registry items, so a shadcn project needs neither npm package.

React 19 only for now; other frameworks come later together with the whole ui library.

## Package facts

| Item | Value |
| --- | --- |
| GitHub repo | integr8-window-manager (visibility decided at creation; public gives npm provenance) |
| npm | @integr8-media/window-manager, public |
| License | MIT |
| Requires | Node 24 LTS (tooling), React 19 |
| Peer dependencies | react ^19, react-dom ^19, @integr8-media/ui ^1.2.1 (components, `cn`, theme, calendar); tailwindcss ^4 optional (only for `theme.css`) |
| Tooling | @integr8-media/config ^1.1.0: tsconfig `react-library.json`, Biome preset, `integr8Vitest({ environment: 'jsdom', coverageThreshold: 80 })`, `integr8Tsdown({ platform: 'browser', unbundle: true })`, `integr8SizeLimit()`, Lefthook base |
| Package manager | npm |
| Playground | Ladle, with the five ui themes in its toolbar |
| Registry | `https://minalouisleon.github.io/integr8-window-manager/r/<name>.json` (GitHub Pages; host set by `REGISTRY_BASE_URL`) |

**Runtime dependencies (approved list; anything else must be asked first):** none of its own. Everything visual comes from the `@integr8-media/ui` peer (which brings radix-ui, lucide-react, react-day-picker, date-fns, …). The core has no dependency at all. If a component needs an icon, import it from `lucide-react`; it is a dependency of ui, so add `lucide-react` as a peer dependency with ui's range (approved).

**Dev dependencies (approved):** the same set integr8-ui uses: @integr8-media/config, @biomejs/biome, typescript, tsdown, vitest, @vitest/coverage-v8, jsdom, @testing-library/react, @testing-library/user-event, @testing-library/dom, @ladle/react, @tailwindcss/vite, @tailwindcss/cli, tailwindcss, @playwright/test, size-limit, @size-limit/file, @size-limit/esbuild, publint, @arethetypeswrong/cli, typedoc, lefthook, react, react-dom, @types/react, @types/react-dom, @integr8-media/ui. Use the versions integr8-ui uses.

## Using it

**npm, app without Tailwind:**

```tsx
import '@integr8-media/ui/fonts.css';
import '@integr8-media/ui/styles.css';                  // ui tokens and component classes
import '@integr8-media/window-manager/styles.css';      // window-manager classes only (no tokens)
```

**npm, Tailwind v4 app:**

```css
@import "tailwindcss";
@import "@integr8-media/ui/theme.css";
@import "@integr8-media/window-manager/theme.css";      /* @source for the package's built files */
@import "@integr8-media/ui/fonts.css";
```

**shadcn registry:** add the namespace once, then install items:

```json
{ "registries": {
  "@integr8": "https://minalouisleon.github.io/integr8-ui/r/{name}.json",
  "@integr8-wm": "https://minalouisleon.github.io/integr8-window-manager/r/{name}.json"
} }
```

```sh
npx shadcn@latest add @integr8/theme          # once per project (ui tokens)
npx shadcn@latest add @integr8-wm/window-manager-shell   # everything, or single items: @integr8-wm/window, @integr8-wm/taskbar, …
```

## Exports (npm)

| Import path | What it is |
| --- | --- |
| `@integr8-media/window-manager/core` | `createWindowManager()`, the pure geometry helpers, `localStorageAdapter`, `WindowManagerError` and all types. No React, no DOM, no ui |
| `@integr8-media/window-manager` | `WindowManagerProvider`, every hook and every component (re-exports the core types) |
| `@integr8-media/window-manager/styles.css` | Prebuilt CSS for apps without Tailwind: every class the components use, built against ui's tokens (the tokens themselves come from ui's `styles.css`) |
| `@integr8-media/window-manager/theme.css` | Tailwind v4 preset: `@source` pointing at the package's built files, plus the `--wm-*` size variables |

## Registry

Generated from the same source by `scripts/buildRegistry.mjs` (config `registry/registry.config.mjs`). Start from integr8-ui's generator (`scripts/buildRegistry.mjs`, `scripts/registryItems.mjs` and their tests; the developer copies them in) and extend it:

- `src/core/` becomes one multi-file item **`window-manager-core`** (`registry:lib`) copied to `@/lib/window-manager/` with its file names, so imports between core files stay relative (same pattern as ui's `theme` bundle).
- Each file in `src/react/` becomes a `registry:hook` item (`useWindowFrame.ts` → `use-window-frame`), installed to `@/hooks/`; the provider file becomes `window-manager-provider`.
- Each file in `src/components/` becomes a `registry:ui` item (`Taskbar.tsx` → `taskbar`), installed to `@/components/ui/`.
- **ui imports:** an import from `@integr8-media/ui` is rewritten to the ui item that exports that name (`Button` → `@/components/ui/button`, `cn` → `@/lib/utils`, `useTheme` → `@/lib/theme/useTheme`) and that item's full URL is added to `registryDependencies`. The name → item map is built from the installed ui package's `dist/registry/*.json` (`node_modules/@integr8-media/ui/registry/`), by reading each item's exports. An imported name that no ui item exports fails the build with `RegistryError` code `UNRESOLVED_IMPORT`.
- Imports between this repo's own files become `@/lib/window-manager/*`, `@/hooks/*` or `@/components/ui/*` and are listed as `registryDependencies` (full URLs of this registry).
- npm imports other than react, react-dom and `@integr8-media/ui` are listed as `dependencies` with the version ranges from ui's package.json (for example `lucide-react`).
- **`window-manager-shell`** (`registry:block`): no files of its own; it depends on every component item, so one command installs the whole desktop.
- Every item: `categories` (`core`, `hooks`, `window`, `shell`, `notification-area`), and `docs` saying to add `@integr8/theme` once.
- `.github/workflows/registry.yml` builds the JSON, a landing page (adapted from ui's `buildRegistrySite.mjs`: setup, item list by category, one page per item) and the Ladle playground, and deploys them to GitHub Pages on every push to main.
- The registry is also published inside the npm package as `dist/registry/` (export `./registry/*`), like ui.

## Core (framework-free)

`src/core/`. Plain TypeScript; no React, no DOM, no `@integr8-media/ui`.

### Types

```ts
export type WindowId = string;
export type AppId = string;
export type DesktopId = string;

export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface Bounds extends Point, Size {}
export interface Insets { top: number; right: number; bottom: number; left: number }

export type WindowStatus = 'normal' | 'minimized' | 'maximized' | 'fullscreen';
export type SnapZone =
  | 'left' | 'right'                                         // halves
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' // quarters
  | 'left-third' | 'center-third' | 'right-third'            // thirds
  | 'left-two-thirds' | 'right-two-thirds';                   // for snap layouts
export type ControlsStyle = 'windows' | 'mac';
export type TaskbarPosition = 'bottom' | 'top' | 'left' | 'right';

export interface AppDefinition<TData = unknown> {
  id: AppId;
  title: string;
  /** Opaque to the core. The React layer renders a string as a key of the provider's `icons` map,
   *  `{ src, alt }` as an image, and a React element as is. */
  icon?: unknown;
  size?: { default?: Size; min?: Size; max?: Size; resizable?: boolean }; // default 800×600, min 240×160, resizable
  instances?: { single?: boolean; max?: number };                        // default: unlimited
  placement?: {
    desktop?: boolean;                                                   // icon on the desktop, default true
    pinned?: boolean;                                                    // pinned to the taskbar on first run, default false
    startMenu?: boolean | { category?: string; keywords?: string[] };   // default true
  };
  controlsStyle?: ControlsStyle;                                         // overrides the shell setting
  defaultData?: TData;
}

export interface WindowState<TData = unknown> {
  id: WindowId;
  appId: AppId;
  title: string;
  desktopId: DesktopId;
  bounds: Bounds;                 // position and size in the normal state
  restoreBounds: Bounds | null;   // set while maximized, snapped or fullscreen
  status: WindowStatus;
  snap: SnapZone | null;
  z: number;                      // within its layer
  alwaysOnTop: boolean;
  parentId: WindowId | null;
  modal: boolean;                 // blocks input to the parent while open
  badge: string | number | null;
  dirty: boolean;
  data: TData;
}

export interface Desktop { id: DesktopId; name: string; wallpaper: Wallpaper | null }
export type Wallpaper =
  | { type: 'theme' }
  | { type: 'color'; value: string }
  | { type: 'gradient'; value: string }                    // a CSS gradient
  | { type: 'image'; url: string; fit?: 'cover' | 'contain' | 'center' };

export interface ShellSettings {
  taskbarPosition: TaskbarPosition;  // default 'bottom'
  taskbarAutoHide: boolean;          // default false
  controlsStyle: ControlsStyle;      // default 'windows'
}

export interface TrayItem { id: string; appId?: AppId; label: string; icon?: unknown; badge?: string | number | null; order?: number }
export interface Notification {
  id: string; appId?: AppId; title: string; body?: string;
  level?: 'info' | 'success' | 'warning' | 'error';
  createdAt: number; read: boolean;
  action?: { label: string; open?: OpenOptions };
}

export interface ManagerState {
  windows: Record<WindowId, WindowState>;
  order: WindowId[];                 // paint order, bottom to top (always-on-top layer last)
  focusedId: WindowId | null;
  desktops: Desktop[];
  activeDesktopId: DesktopId;
  viewport: Size;
  insets: Insets;                    // taskbar space; work area = viewport minus insets
  showingDesktop: boolean;
  iconOrder: AppId[];
  pinnedApps: AppId[];
  shell: ShellSettings;
  tray: TrayItem[];
  notifications: Notification[];
}

export interface OpenOptions<TData = unknown> {
  appId: AppId;
  title?: string;
  bounds?: Partial<Bounds>;
  desktopId?: DesktopId;          // default: active desktop
  status?: WindowStatus;
  data?: TData;
  parentId?: WindowId;
  modal?: boolean;                // only with parentId
  alwaysOnTop?: boolean;
}
```

### createWindowManager

```ts
export interface WindowManagerOptions {
  apps: AppDefinition[];
  desktops?: { id?: DesktopId; name: string; wallpaper?: Wallpaper }[]; // default one desktop "Desktop 1"
  shell?: Partial<ShellSettings>;
  storage?: LayoutStorage;          // persistence adapter (below)
  restore?: (win: WindowState) => boolean; // which saved windows to reopen, default all
  saveDebounceMs?: number;          // default 500
  snapThreshold?: number;           // px from an edge that starts a snap preview, default 16
  edgeMagnet?: number | false;      // px that make edges stick (1.1.0), default 8
  minVisibleTitleBar?: number;      // px of a title bar that always stays in the work area, default 48
  cascadeOffset?: number;           // default 24
  now?: () => number;               // injectable clock for tests
}

export interface WindowManager {
  getState(): ManagerState;
  subscribe(listener: (state: ManagerState) => void): () => void;  // for useSyncExternalStore
  on<E extends WindowManagerEvent>(event: E, handler: (payload: EventPayload<E>) => void): () => void;
  getApp(appId: AppId): AppDefinition;

  // windows
  open<TData>(options: OpenOptions<TData>): WindowId;
  close(id: WindowId, options?: { force?: boolean }): Promise<boolean>; // false if a guard refused
  setCloseGuard(id: WindowId, guard: (() => boolean | Promise<boolean>) | null): void;
  focus(id: WindowId): void;
  minimize(id: WindowId): void;
  maximize(id: WindowId): void;
  restore(id: WindowId): void;
  toggleMaximize(id: WindowId): void;
  setFullscreen(id: WindowId, on: boolean): void;
  setAlwaysOnTop(id: WindowId, on: boolean): void;
  move(id: WindowId, to: Point): void;
  resize(id: WindowId, bounds: Bounds): void;
  snap(id: WindowId, zone: SnapZone | null): void;
  update<TData>(id: WindowId, patch: Partial<Pick<WindowState<TData>, 'title' | 'badge' | 'dirty' | 'data'>>): void;
  cycleFocus(direction?: 1 | -1): void;
  showDesktop(on?: boolean): void;                                     // toggles when omitted

  // desktops
  addDesktop(name?: string): DesktopId;
  renameDesktop(id: DesktopId, name: string): void;
  removeDesktop(id: DesktopId, options?: { moveWindowsTo?: DesktopId }): Promise<boolean>; // closes windows when not moved
  switchDesktop(id: DesktopId): void;
  moveToDesktop(windowId: WindowId, desktopId: DesktopId): void;
  setWallpaper(desktopId: DesktopId, wallpaper: Wallpaper | null): void;

  // icons, taskbar, shell
  setIconOrder(appIds: AppId[]): void;
  pinApp(appId: AppId, index?: number): void;
  unpinApp(appId: AppId): void;
  setPinnedOrder(appIds: AppId[]): void;
  setShellSettings(patch: Partial<ShellSettings>): void;
  setViewport(size: Size, insets?: Insets): void;

  // messaging and deep links
  send(target: { windowId: WindowId } | { appId: AppId }, message: unknown): void;
  onMessage(target: { windowId: WindowId } | { appId: AppId }, handler: (message: unknown, from: WindowId | null) => void): () => void;
  openFromUrl(url: string | URL | URLSearchParams): WindowId | null;   // ?open=<appId>&<data params>
  toUrl(target: { windowId: WindowId } | { appId: AppId }, params?: Record<string, string>): string;

  // notification area (1.1.0)
  registerTrayItem(item: TrayItem): () => void;
  updateTrayItem(id: string, patch: Partial<TrayItem>): void;
  notify(notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): string;
  markRead(id: string | 'all'): void;
  dismiss(id: string): void;
  clearNotifications(): void;

  // persistence
  serialize(): LayoutSnapshot;
  restoreLayout(snapshot: LayoutSnapshot): void;
  flush(): Promise<void>;           // save now, skipping the debounce
  destroy(): void;
}

export function createWindowManager(options: WindowManagerOptions): WindowManager;
```

### Pure geometry helpers (exported, unit-tested)

```ts
export function workArea(viewport: Size, insets: Insets): Bounds;
export function boundsForZone(zone: SnapZone, area: Bounds): Bounds;
export function zoneAtPoint(point: Point, area: Bounds, threshold: number): SnapZone | 'maximize' | null;
export function clampBounds(bounds: Bounds, area: Bounds, rules: { min: Size; max?: Size; minVisibleTitleBar: number }): Bounds;
export function cascade(index: number, area: Bounds, size: Size, offset: number): Point;
export function magnetize(bounds: Bounds, area: Bounds, others: Bounds[], distance: number): Bounds; // 1.1.0
export const SNAP_LAYOUTS: { id: string; zones: SnapZone[] }[]; // 1.1.0: halves, quarters, thirds, two-thirds + third
```

Drag zones: left/right edge → half; a corner → quarter; top edge → maximize. Thirds and two-thirds come from the window menu, the API and (1.1.0) the snap layouts menu.

### Rules the core enforces

- New windows open cascaded at the app's default size, clamped to min/max and the work area.
- Layers: normal windows, then always-on-top windows. Focus raises a window to the top of its layer; z values are compacted (no unbounded growth).
- At least `minVisibleTitleBar` px of a title bar stays inside the work area; `setViewport` re-clamps every window.
- Maximize, snap and fullscreen store `restoreBounds`; restore brings it back. Dragging a maximized or snapped window restores its size with the pointer at the same relative spot on the title bar.
- Child windows (`parentId`) stay on their parent's desktop, are raised with it, are minimized and closed with it; a modal child blocks focus and input to its parent (focusing the parent focuses the child).
- Fullscreen fills the whole viewport (ignoring insets) and hides the taskbar; Esc (handled by the React layer) leaves it.
- `instances.single`: `open` focuses the existing window. `instances.max`: `open` beyond the limit throws `WindowManagerError` `MAX_INSTANCES`.
- `close` runs the window's guard and then its children's guards; any `false` cancels. `force` skips guards.
- Closing the focused window focuses the next one on the same desktop (top of the z order).
- `removeDesktop` on the last desktop throws `LAST_DESKTOP`.
- `showDesktop(true)` minimizes every window on the active desktop and remembers them; `showDesktop(false)` restores exactly those.
- Unknown ids throw `UNKNOWN_APP`, `UNKNOWN_WINDOW` or `UNKNOWN_DESKTOP`; duplicate app ids in options throw `DUPLICATE_APP`.
- Events: `window:opened`, `window:closed`, `window:focused`, `window:changed`, `desktop:changed`, `shell:changed`, `layout:restored`, `message`, `notification`.

### Errors

```ts
export type WindowManagerErrorCode =
  | 'UNKNOWN_APP' | 'UNKNOWN_WINDOW' | 'UNKNOWN_DESKTOP' | 'DUPLICATE_APP'
  | 'MAX_INSTANCES' | 'LAST_DESKTOP' | 'INVALID_BOUNDS' | 'INVALID_SNAPSHOT' | 'NO_PROVIDER';
export class WindowManagerError extends Error { readonly code: WindowManagerErrorCode }
```

## Persistence

```ts
export interface LayoutStorage {
  load(): LayoutSnapshot | null | Promise<LayoutSnapshot | null>;
  save(snapshot: LayoutSnapshot): void | Promise<void>;
}
export function localStorageAdapter(key?: string): LayoutStorage; // default key 'integr8-wm-layout'

export interface LayoutSnapshot {
  version: 1;
  desktops: Desktop[];
  activeDesktopId: DesktopId;
  windows: WindowState[];          // bounds, status, snap, z, alwaysOnTop, parentId, modal, data
  iconOrder: AppId[];
  pinnedApps: AppId[];
  shell: ShellSettings;
}
```

- Loaded once on start, filtered by `restore`; windows of unknown apps are skipped; a snapshot with another `version` or a broken shape throws `INVALID_SNAPSHOT` (the manager then starts empty and fires `layout:restored` with `{ ok: false }`).
- Saved after every change, debounced (`saveDebounceMs`). Notifications and tray items are not saved.
- Each window's own state goes in `data` (for example the open folder); apps keep anything bigger outside (Integr8 Workbench saves on the agent per device and per connection).

## React layer (headless)

`src/react/`. Every hook returns state, actions and prop getters (handlers, ARIA and `data-*` attributes) that the components spread. Any app can build its own visuals on the hooks alone.

Window content is **always unmounted** while its window is minimized or on another desktop. Apps keep state they need in their own stores or in the window's `data`.

```ts
export function WindowManagerProvider(props: {
  manager: WindowManager;
  apps: Record<AppId, ComponentType<AppWindowProps>>;   // content of each app's windows
  icons?: Record<string, ComponentType<{ className?: string }>>; // string icon keys → components (e.g. lucide icons)
  shortcuts?: ShortcutOptions | false;                   // default: the default shortcuts
  children: ReactNode;
}): JSX.Element;

export interface AppWindowProps<TData = unknown> { windowId: WindowId; data: TData }
```

| Hook | Returns |
| --- | --- |
| `useWindowManager(selector?)` | The manager's actions and the selected state slice (re-renders only when the slice changes) |
| `useWindow(id)`, `useDesktops()` | One window's state and bound actions; desktops, active desktop and their actions |
| `useAppWindow()` | Inside a window: its id, state, `setTitle`, `setBadge`, `setDirty`, `setData`, `setCloseGuard`, `close`, `open` (child or other windows), `send`, `onMessage` |
| `useDesktopSurface()` | Ref for the desktop element (measures it, calls `setViewport` with the taskbar insets), the windows to render for the active desktop, wallpaper |
| `useWindowFrame(id)` | Prop getters: `getRootProps`, `getTitleBarProps` (drag, double-click maximize; slot areas marked `data-wm-no-drag` do not drag), `getResizeHandleProps(edge)` for the 8 edges, `getControlProps('minimize' \| 'maximize' \| 'close')`; keyboard move/resize mode (`startKeyboardMove`, `startKeyboardResize`); `dragging`, `resizing`, `snapPreview` |
| `useSnapPreview()` | The zone and bounds to preview while a window is dragged |
| `useSnapLayouts(id)` | (1.1.0) Layout list and `apply(layoutId, zone)` for the menu on the maximize button |
| `useDesktopIcons()` | Icons in `iconOrder`, roving focus (arrows, Home/End), open on double-click or Enter, drag to reorder |
| `useTaskbar()` | Pinned apps, open windows grouped by app with focused/minimized state, click behavior (focus, minimize, cycle instances), position, auto-hide reveal state, preview list (titles and icons) |
| `useStartMenu()` | Open state, search text, filtered apps by category and keywords, launch |
| `useWindowSwitcher()` | Open state and ordered window list while cycling with the keyboard |
| `useDesktopSwitcher()` | Add, rename, remove (with the move-windows choice), switch |
| `useDesktopOverview()` | (1.1.0) Open state, desktops with their window frames, drag a window to another desktop |
| `useWindowMenu(id)`, `useDesktopMenu()` | Menu models: default entries plus app-added entries (`registerWindowMenuItems`, `registerDesktopMenuItems`) |
| `useTray()`, `useNotifications()`, `useClock()`, `useQuickSettings()` | (1.1.0) Notification-area pieces |
| `useShortcuts(options)` | Registers the default shortcuts; per-shortcut override or `false` to disable |

## Components

`src/components/`. Built only from `@integr8-media/ui` (Button, Tooltip, ContextMenu, DropdownMenu, Toolbar, Badge, Popover, Command, Dialog, AlertDialog, Card, Kbd, Shortcut, ScrollArea, Separator, Input, Switch, Select, Calendar, Toaster/`toast`, ThemeSwitcher) and the hooks above. Each accepts `className` and `style` and forwards its ref.

| Component | Registry item | Release | Notes |
| --- | --- | --- | --- |
| `Desktop` | `desktop` | 1.0.0 | The surface: wallpaper, windows of the active desktop, desktop icons, snap preview, desktop menu |
| `Window` | `window` | 1.0.0 | Frame, title bar, 8 resize handles, content (the app component); modal blocker over a parent |
| `WindowTitleBar` | `window-title-bar` | 1.0.0 | Icon, title, dirty dot, badge; `start`, `center`, `end` slots for app content (tabs, toolbar, search) |
| `WindowControls` | `window-controls` | 1.0.0 | `controlsStyle="windows"` (icon buttons on the right) or `"mac"` (round buttons on the left, using the destructive/warning/success tokens) |
| `WindowMenu` | `window-menu` | 1.0.0 | Minimize, maximize/restore, snap (all zones), always on top, fullscreen, move to desktop, move, resize, close, app items |
| `SnapPreview` | `snap-preview` | 1.0.0 | Translucent box where the window will land |
| `CloseGuardDialog` | `close-guard-dialog` | 1.0.0 | AlertDialog for guards that ask (save, discard, cancel) |
| `DesktopIcons` | `desktop-icons` | 1.0.0 | Auto grid, drag to reorder |
| `Taskbar` | `taskbar` | 1.0.0 | Start button, pinned apps, running windows, preview popover (title + icon list), desktop switcher button, notification-area slot; any position; auto-hide |
| `StartMenu` | `start-menu` | 1.0.0 | Command-based search, categories, launch |
| `WindowSwitcher` | `window-switcher` | 1.0.0 | Overlay while cycling |
| `DesktopSwitcher` | `desktop-switcher` | 1.0.0 | Popover: list, add, rename, remove |
| `DesktopMenu` | `desktop-menu` | 1.0.0 | Right-click on the desktop: new desktop, arrange icons, wallpaper (1.1.0), taskbar settings, app items |
| `WindowManagerShell` | `window-manager-shell` | 1.0.0 | Default composition: Desktop + Taskbar + StartMenu + switchers + CloseGuardDialog (+ notification area in 1.1.0) |
| `SnapLayoutsMenu` | `snap-layouts-menu` | 1.1.0 | Opens on hovering or long-pressing the maximize button |
| `DesktopOverview` | `desktop-overview` | 1.1.0 | All desktops with window frames (icon + title); drag between desktops |
| `WallpaperPicker` | `wallpaper-picker` | 1.1.0 | Theme default, colors, gradients, image URL or upload (the app stores uploads through a callback) |
| `NotificationArea` | `notification-area` | 1.1.0 | Tray items, clock, notification bell, quick settings |
| `TrayItem` | `tray-item` | 1.1.0 | Icon button with badge and popover content |
| `Clock` | `clock` | 1.1.0 | Time and date; popover with ui's `Calendar` in display-only mode |
| `NotificationCenter` | `notification-center` | 1.1.0 | List of notifications; new ones also show as toasts through ui's `toast()` |
| `QuickSettings` | `quick-settings` | 1.1.0 | Theme (ui ThemeSwitcher), taskbar position, auto-hide, controls style |

Small screens behave like desktop (no special mode). Simple CSS transitions (open, close, minimize, maximize, snap), off with `prefers-reduced-motion`; no animation library. Taskbar previews are a list of titles and icons, never live thumbnails.

## Styling

- Colors only from ui tokens: window `card` / `card-foreground` with `border`; focused window title bar `muted`, unfocused `card` with `muted-foreground` text; focus ring `ring`; snap preview `primary` at low opacity with a `ring` border; taskbar `card` with `border`; active taskbar item `accent`; close button hover `destructive`; badges use ui `Badge`.
- Size variables (in `styles.css` and `theme.css`, overridable): `--wm-titlebar-height: 2.25rem`, `--wm-taskbar-size: 3rem`, `--wm-resize-handle: 6px`, `--wm-icon-size: 3rem`, `--wm-window-radius: var(--radius)`, `--wm-shadow` (two values, focused and unfocused, built from `--foreground` with low alpha).
- Data attributes: `data-wm-window`, `data-state="focused|unfocused"`, `data-status`, `data-snap`, `data-dragging`, `data-resizing`, `data-always-on-top`, `data-blocked` (modal child open), `data-controls-style`, `data-taskbar-position`, `data-wm-no-drag`.
- Works in light, dark, integr8 and integr8-light (and system), in both control styles and all four taskbar positions.

## Keyboard shortcuts (defaults, all configurable or disabled)

| Action | Default |
| --- | --- |
| Cycle windows (window switcher) | Ctrl+\` / Ctrl+Shift+\` |
| Close focused window | Ctrl+Alt+W |
| Minimize / toggle maximize | Ctrl+Alt+M / Ctrl+Alt+Up |
| Snap left / right | Ctrl+Alt+Left / Ctrl+Alt+Right |
| Toggle fullscreen / always on top | Ctrl+Alt+F / Ctrl+Alt+T |
| Show desktop / desktop overview (1.1.0) | Ctrl+Alt+D / Ctrl+Alt+O |
| Switch to desktop 1–9 | Ctrl+Alt+1 … 9 |
| Open start menu | Ctrl+Alt+Space |
| Move or resize with the keyboard | Window menu → Move / Resize, then arrows (Shift: 10× step), Enter commits, Esc cancels |
| Leave fullscreen | Esc |

Shortcuts are shown with ui's `Shortcut` (OS-aware). They are ignored while focus is in an input unless they use Ctrl+Alt.

## Accessibility

- Every action is reachable by keyboard; windows have `role="dialog"`, `aria-labelledby` (title), `aria-modal="true"` only for modal children.
- The taskbar is a `toolbar` (roving focus); desktop icons are a `listbox`-style grid with roving focus; menus come from ui (Radix).
- Focus returns to the right place after close (next window or the taskbar button), minimize (taskbar button) and desktop switch (focused window of that desktop).
- A polite live region announces snap, minimize, maximize, desktop switch and new notifications.
- Resize handles are hidden from screen readers; keyboard resize is the accessible path.

## Folder layout

```text
src/
  core/                    createWindowManager.ts, state.ts, geometry.ts (snapZones, clamp, cascade, magnet),
                           desktops.ts, messaging.ts, deepLinks.ts, notifications.ts, persistence.ts,
                           localStorageAdapter.ts, errors.ts, types.ts, index.ts
  react/                   WindowManagerProvider.tsx, useWindowManager.ts, useWindow.ts, useAppWindow.ts,
                           useDesktopSurface.ts, useWindowFrame.ts, useSnapPreview.ts, useDesktopIcons.ts,
                           useTaskbar.ts, useStartMenu.ts, useWindowSwitcher.ts, useDesktopSwitcher.ts,
                           useWindowMenu.ts, useDesktopMenu.ts, useShortcuts.ts, (1.1.0) useSnapLayouts.ts,
                           useDesktopOverview.ts, useTray.ts, useNotifications.ts, useClock.ts, useQuickSettings.ts
  components/              Desktop.tsx, Window.tsx, WindowTitleBar.tsx, ... (one file per component)
  styles/                  styles.entry.css (Tailwind build for styles.css), theme.css, wm.css (--wm-* variables)
  index.ts                 React entry (public exports only)
registry/                  registry.config.mjs
scripts/                   buildRegistry.mjs, registryItems.mjs (+ tests), uiItemMap.mjs (+ test), buildRegistrySite.mjs, fixtures.mjs
fixtures/                  plain-app/ (npm + styles.css), tailwind-app/ (npm + theme.css), shadcn-app/ (registry items), fixtures.spec.ts
playground/                Ladle config (Tailwind Vite plugin, ui theme toolbar) + stories
test/                      setup.ts (ResizeObserver, pointer capture and matchMedia stubs)
docs/SPEC.md
.github/workflows/         ci.yml, release.yml, registry.yml (same shape as integr8-ui)
```

## Example

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

## Non-goals

- No app content, routing or data fetching
- No native OS windows (Tauri multi-window) and no tiling beyond the snap zones and layouts
- No live window thumbnails (taskbar previews and the overview show titles and icons)
- No animation library; no frameworks other than React for now
- No duplicated ui components; no own color tokens

## Tests and playground

- Core unit tests (Vitest, no DOM): open and cascade, size rules and clamping, instances, focus layers and z compaction, always on top, child and modal windows (raise, minimize, close, guard order), fullscreen, minimize/maximize/restore, every snap zone, drag-restore of snapped windows, viewport and insets re-clamp, close guards and `force`, desktops (add, rename, remove with and without moving, last desktop), show desktop, icons and pinned apps, shell settings, messaging, deep links (`openFromUrl`, `toUrl`), notifications and tray (1.1.0), magnet (1.1.0), serialize/restore and broken snapshots, debounced save, events. Core aims for 95% coverage.
- Hook tests (jsdom, `renderHook` and Testing Library): drag and 8-way resize through the prop getters (pointer events), `data-wm-no-drag` slots, double-click maximize, keyboard move/resize, snap preview, shortcuts (override, disable, ignored in inputs), desktop icons roving focus and reorder, taskbar grouping and click behavior, start-menu search, switchers, menus with app items, `useAppWindow`, focus return, selector re-renders, unmount when minimized.
- Component tests: render, ARIA, data attributes, both control styles, taskbar positions.
- Registry generator tests (`scripts/*.test.mjs`, outside coverage): ui import rewriting, `UNRESOLVED_IMPORT`, core bundle, hook and component items, `window-manager-shell` dependencies.
- Ladle: an unstyled demo built only on the hooks; styled stories for every component; a full shell story (30 windows, touch, every taskbar position, both control styles); every story in light, dark, integr8 and integr8-light.
- `playground:smoke` (by hand): Playwright opens every story in every theme and fails on console errors.
- `fixtures` (by hand): packs the package and installs it in `plain-app` (styles.css) and `tailwind-app` (theme.css); installs the registry items with `npx shadcn add` into `shadcn-app` from a local build of the registry; builds all three and checks with Playwright that a window opens, drags, snaps and the taskbar works.
- 80% line coverage overall (CI floor).
- size-limit (`.size-limit.mjs`, first guesses; after the first measured build set each to about 10% above): `./core` ≤ 10 kB gzip; `import { useWindowFrame }` ≤ 14 kB; `import { WindowManagerShell }` measured with ui external; `styles.css` ≤ 15 kB.

## Milestones

Each milestone is one `feature/*` branch from `dev` and one pull request into `dev`; it must pass CI on its own and includes its own tests, stories and registry items. A milestone is done when its exit criteria are met and its Progress row is updated.

**1.0.0** = windows, snapping (halves, quarters, thirds), desktops, icons, taskbar, start menu, switchers, menus, messaging, deep links, persistence. **1.1.0** = snap layouts menu, edge magnet, desktop overview, wallpapers, notification area.

| # | Milestone | Branch | Release |
| --- | --- | --- | --- |
| M0 | Repo scaffold: package.json (npm), configs (tsconfig, Biome, Vitest, tsdown, size-limit, Lefthook, TypeDoc), entries `./core`, `.`, `styles.css`, `theme.css`, `./registry/*`; Tailwind CSS build; registry generator with the ui import map; Ladle with the ui theme toolbar; fixtures skeleton; ci.yml, release.yml, registry.yml; README stub | `feature/repo-scaffold` | 1.0.0 |
| M1 | Core store: windows, focus layers, always on top, child and modal windows, fullscreen, size rules, instances, close guards, events, errors | `feature/core-store` | 1.0.0 |
| M2 | Core geometry: work area and insets, halves, quarters, thirds, maximize, clamping, cascade, drag-restore | `feature/core-geometry` | 1.0.0 |
| M3 | Core desktops, show desktop, icons, pinned apps, shell settings | `feature/core-desktops` | 1.0.0 |
| M4 | Persistence (snapshot v1, localStorageAdapter, debounce, restore filter) | `feature/persistence` | 1.0.0 |
| M5 | Messaging and deep links | `feature/core-messaging` | 1.0.0 |
| M6 | Hooks: provider, `useWindowManager`, `useWindow`, `useDesktops`, `useAppWindow`, `useDesktopSurface`, `useWindowFrame` (with keyboard move/resize) | `feature/hooks-window` | 1.0.0 |
| M7 | Hooks: `useSnapPreview`, `useShortcuts`, `useDesktopIcons` | `feature/hooks-snap-icons` | 1.0.0 |
| M8 | Hooks: `useTaskbar`, `useStartMenu`, `useWindowSwitcher`, `useDesktopSwitcher`, `useWindowMenu`, `useDesktopMenu` | `feature/hooks-shell` | 1.0.0 |
| M9 | Components: Desktop, Window, WindowTitleBar, WindowControls, WindowMenu, SnapPreview, CloseGuardDialog | `feature/window-components` | 1.0.0 |
| M10 | Components: DesktopIcons, Taskbar, StartMenu, WindowSwitcher, DesktopSwitcher, DesktopMenu, WindowManagerShell | `feature/shell-components` | 1.0.0 |
| M11 | Unstyled demo, full shell stories, accessibility pass, fixture apps, registry site | `feature/playground` | 1.0.0 |
| M12 | Release 1.0.0 readiness: README, TypeDoc, budgets, Done-when check | `feature/release-1-0` | 1.0.0 |
| M13 | Snap layouts menu and edge magnet | `feature/snap-layouts` | 1.1.0 |
| M14 | Desktop overview and wallpapers | `feature/overview-wallpapers` | 1.1.0 |
| M15 | Notification area: tray, clock with ui Calendar, notification center, quick settings | `feature/notification-area` | 1.1.0 |
| M16 | Release 1.1.0 readiness | `feature/release-1-1` | 1.1.0 |

- **M0 exit:** build produces `dist/core/index.mjs`, `dist/index.mjs`, `dist/styles.css`, `dist/theme.css` and `dist/registry/`; an empty test run, typecheck, lint, publint and attw pass; `registry.yml` deploys an (empty) site.
- **M1–M5 exit:** core tests as listed; `./core` within budget; core coverage at least 95%; no React, DOM or ui import under `src/core/` (a test checks the imports).
- **M6–M8 exit:** hook tests as listed; hooks render nothing visible and import no ui component.
- **M9–M11 exit:** stories for every component in every theme; the developer confirms the full shell drags, resizes, snaps, switches desktops and restores a saved layout with mouse, touch and keyboard; all three fixture apps build.
- **M12 / M16 exit:** every Done-when box for that release is checked; ready for the first manual publish (1.0.0) or a tag (1.1.0).

## Done when (1.0.0)

- [ ] Core complete with the rules above and full unit tests
- [ ] Hooks and components cover every 1.0.0 feature with mouse, touch and keyboard
- [ ] Works three ways: npm + styles.css, npm + theme.css in a Tailwind app, shadcn items from this registry (with ui items pulled from the ui registry)
- [ ] Every component works in light, dark, integr8 and integr8-light, in both control styles and all taskbar positions
- [ ] Layout persists and restores through `localStorageAdapter` and a custom adapter
- [ ] Accessibility as above
- [ ] Tests at 80% (core 95%); publint and attw pass; size budgets met
- [ ] Registry hosted on GitHub Pages with a page per item
- [ ] README (three ways to use it, theming, shortcuts, persistence) and TypeDoc API reference

## Done when (1.1.0)

- [ ] Snap layouts menu and edge magnet
- [ ] Desktop overview and wallpapers (theme default, color, gradient, image URL or upload)
- [ ] Notification area: tray items, clock with ui Calendar, notification center with toasts, quick settings
- [ ] Tests, stories, registry items and budgets for all of them

## Progress

Updated by Claude Code after every finished task, in the same commit.

| Milestone | Status | Branch | Notes |
| --- | --- | --- | --- |
| M0 Repo scaffold | Written, not yet verified | `feature/repo-scaffold` | All configs, entries, CSS, registry generator with ui import map (+ tests), Ladle with theme toolbar, fixtures skeleton, workflows, README stub. Not run yet: install, lint, typecheck, build, publint/attw, CSS build. Not implemented: per-item registry site pages (M11), shadcn-app fixture (M11), hook/shell size budgets (M6/M10). |
| M1 Core store | Written, not yet verified | `feature/core-store` | `types.ts`, `errors.ts`, `createWindowManager.ts` (open, close + guards, focus layers, always on top, child/modal, minimize/maximize/restore/fullscreen, move/resize, update, cycleFocus (MRU), setViewport, events, subscribe), `geometry.ts` (workArea, clampBounds, cascade, needed by open/maximize), tests incl. a no-React/DOM/ui import check. Not run yet: typecheck, lint, tests, coverage. Not implemented (later milestones): desktops API, showDesktop, snap, messaging, persistence, tray/notifications; `WindowManager` type lists only the M1 methods so far. |
| M2 Core geometry | Not started | | workArea, clampBounds and cascade already exist (from M1); still to do: zones, `zoneAtPoint`, `boundsForZone`, `snap`, drag-restore |
| M3 Core desktops | Not started | | |
| M4 Persistence | Not started | | |
| M5 Messaging and deep links | Not started | | |
| M6 Hooks: window | Not started | | |
| M7 Hooks: snap, shortcuts, icons | Not started | | |
| M8 Hooks: shell | Not started | | |
| M9 Window components | Not started | | |
| M10 Shell components | Not started | | |
| M11 Playground, fixtures, site | Not started | | |
| M12 Release 1.0.0 | Not started | | |
| M13 Snap layouts, magnet | Not started | | |
| M14 Overview, wallpapers | Not started | | |
| M15 Notification area | Not started | | |
| M16 Release 1.1.0 | Not started | | |

## Open points for review

- Registry namespace for direct installs: `@integr8-wm` (used above), or another name?
- Showing the window manager inside the ui library: a link and screenshots on ui's registry site (no dependency), or ui's playground importing this package as a dev dependency (circular: this package peer-depends on ui)? Proposed: link only.
- Size budgets are first guesses; adjust after the first build.
