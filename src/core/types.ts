/** Identifier of one open window. */
export type WindowId = string;
/** Identifier of an app (the thing a window shows). */
export type AppId = string;
/** Identifier of a desktop. */
export type DesktopId = string;

/** A point in viewport pixels. */
export interface Point {
  x: number;
  y: number;
}
/** A width and height in pixels. */
export interface Size {
  width: number;
  height: number;
}
/** A position and a size in viewport pixels. */
export interface Bounds extends Point, Size {}
/** Space taken from each side of the viewport (for example by the taskbar). */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** How a window is shown. */
export type WindowStatus = 'normal' | 'minimized' | 'maximized' | 'fullscreen';
/** Where a snapped window sits in the work area. */
export type SnapZone =
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'left-third'
  | 'center-third'
  | 'right-third'
  | 'left-two-thirds'
  | 'right-two-thirds';
/** Look of the window control buttons. */
export type ControlsStyle = 'windows' | 'mac';
/** Edge of the viewport the taskbar sits on. */
export type TaskbarPosition = 'bottom' | 'top' | 'left' | 'right';

/** Describes an app: its title, icon, size rules, instance limits and placement. */
export interface AppDefinition<TData = unknown> {
  id: AppId;
  title: string;
  /**
   * Opaque to the core. The React layer renders a string as a key of the provider's `icons` map,
   * `{ src, alt }` as an image, and a React element as is.
   */
  icon?: unknown;
  /** Defaults: 800×600, min 240×160, resizable. */
  size?: { default?: Size; min?: Size; max?: Size; resizable?: boolean };
  /** Default: unlimited instances. */
  instances?: { single?: boolean; max?: number };
  placement?: {
    /** Icon on the desktop, default true. */
    desktop?: boolean;
    /** Pinned to the taskbar on first run, default false. */
    pinned?: boolean;
    /** Listed in the start menu, default true. */
    startMenu?: boolean | { category?: string; keywords?: string[] };
  };
  /** Overrides the shell setting. */
  controlsStyle?: ControlsStyle;
  defaultData?: TData;
}

/** The complete state of one window. */
export interface WindowState<TData = unknown> {
  id: WindowId;
  appId: AppId;
  title: string;
  desktopId: DesktopId;
  /** Where the window is on screen right now (the maximized or fullscreen rectangle while it is). */
  bounds: Bounds;
  /** The normal bounds to go back to; set while maximized, snapped or fullscreen. */
  restoreBounds: Bounds | null;
  status: WindowStatus;
  snap: SnapZone | null;
  /** Position within its layer (0 is the bottom). */
  z: number;
  alwaysOnTop: boolean;
  parentId: WindowId | null;
  /** Blocks input to the parent while open. */
  modal: boolean;
  badge: string | number | null;
  dirty: boolean;
  data: TData;
}

/** A wallpaper for one desktop. */
export type Wallpaper =
  | { type: 'theme' }
  | { type: 'color'; value: string }
  | { type: 'gradient'; value: string }
  | { type: 'image'; url: string; fit?: 'cover' | 'contain' | 'center' };

/** One desktop. */
export interface Desktop {
  id: DesktopId;
  name: string;
  wallpaper: Wallpaper | null;
}

/** Settings of the shell around the windows. */
export interface ShellSettings {
  /** Default 'bottom'. */
  taskbarPosition: TaskbarPosition;
  /** Default false. */
  taskbarAutoHide: boolean;
  /** Default 'windows'. */
  controlsStyle: ControlsStyle;
}

/** An item in the notification area. */
export interface TrayItem {
  id: string;
  appId?: AppId;
  label: string;
  icon?: unknown;
  badge?: string | number | null;
  order?: number;
}

/** A notification shown in the notification center. */
export interface Notification {
  id: string;
  appId?: AppId;
  title: string;
  body?: string;
  level?: 'info' | 'success' | 'warning' | 'error';
  createdAt: number;
  read: boolean;
  action?: { label: string; open?: OpenOptions };
}

/** Everything the manager knows; replaced (never mutated) on every change. */
export interface ManagerState {
  windows: Record<WindowId, WindowState>;
  /** Paint order, bottom to top (the always-on-top layer is last). */
  order: WindowId[];
  focusedId: WindowId | null;
  desktops: Desktop[];
  activeDesktopId: DesktopId;
  viewport: Size;
  /** Taskbar space; the work area is the viewport minus the insets. */
  insets: Insets;
  showingDesktop: boolean;
  iconOrder: AppId[];
  pinnedApps: AppId[];
  shell: ShellSettings;
  tray: TrayItem[];
  notifications: Notification[];
}

/** Options for opening a window. */
export interface OpenOptions<TData = unknown> {
  appId: AppId;
  title?: string;
  bounds?: Partial<Bounds>;
  /** Default: the active desktop. */
  desktopId?: DesktopId;
  status?: WindowStatus;
  data?: TData;
  parentId?: WindowId;
  /** Only with `parentId`. */
  modal?: boolean;
  alwaysOnTop?: boolean;
}

/** Events the manager emits, with `on(event, handler)`. */
export interface WindowManagerEvents {
  'window:opened': { window: WindowState };
  'window:closed': { window: WindowState };
  'window:focused': { windowId: WindowId | null };
  'window:changed': { window: WindowState };
  'desktop:changed': { desktopId: DesktopId };
  'shell:changed': { shell: ShellSettings };
  'layout:restored': { ok: boolean };
  message: {
    target: { windowId: WindowId } | { appId: AppId };
    message: unknown;
    from: WindowId | null;
  };
  notification: { notification: Notification };
}
/** Name of an event. */
export type WindowManagerEvent = keyof WindowManagerEvents;
/** Payload of an event. */
export type EventPayload<E extends WindowManagerEvent> = WindowManagerEvents[E];

/** Where a layout is saved and loaded. */
export interface LayoutStorage {
  /** Returns the saved layout, or null when there is none. */
  load(): LayoutSnapshot | null | Promise<LayoutSnapshot | null>;
  /** Saves a layout. */
  save(snapshot: LayoutSnapshot): void | Promise<void>;
}

/** A saved layout (version 1). Notifications and tray items are not part of it. */
export interface LayoutSnapshot {
  version: 1;
  desktops: Desktop[];
  activeDesktopId: DesktopId;
  /** Bounds, status, snap, z, alwaysOnTop, parentId, modal and data of each window. */
  windows: WindowState[];
  iconOrder: AppId[];
  pinnedApps: AppId[];
  shell: ShellSettings;
  /** For each minimized window, the status it returns to (absent in older snapshots). */
  minimizedFrom?: Record<WindowId, 'normal' | 'maximized' | 'fullscreen'>;
}

/** Options for `createWindowManager`. The remaining options arrive with their milestones. */
export interface WindowManagerOptions {
  apps: AppDefinition[];
  /** Default: one desktop named "Desktop 1". */
  desktops?: { id?: DesktopId; name: string; wallpaper?: Wallpaper }[];
  shell?: Partial<ShellSettings>;
  /**
   * Where the layout is loaded from on start and saved to after changes. A synchronous `load`
   * restores the layout before `createWindowManager` returns.
   */
  storage?: LayoutStorage;
  /** Which saved windows to reopen; default all. */
  restore?: (win: WindowState) => boolean;
  /** Delay before a change is saved, default 500. */
  saveDebounceMs?: number;
  /** Pixels from an edge that start a snap preview while a window is dragged, default 16. */
  snapThreshold?: number;
  /** Pixels at which window edges stick while dragging, or `false` for no magnet; default 8. */
  edgeMagnet?: number | false;
  /** Pixels of a title bar that always stay in the work area, default 48. */
  minVisibleTitleBar?: number;
  /** Offset between cascaded windows, default 24. */
  cascadeOffset?: number;
  /** The clock used for `Notification.createdAt` (milliseconds); default `Date.now`. For tests. */
  now?: () => number;
}

/** The behavior settings of a manager, with the defaults filled in (see `getConfig`). */
export interface WindowManagerConfig {
  /** Pixels from an edge that start a snap preview while dragging. */
  snapThreshold: number;
  /** Pixels at which edges stick while dragging; `false` turns the magnet off. */
  edgeMagnet: number | false;
  /** Pixels of a title bar that always stay in the work area. */
  minVisibleTitleBar: number;
  /** Offset between cascaded windows. */
  cascadeOffset: number;
}

/**
 * The window manager: windows, focus, close guards, events, snapping, desktops, wallpapers, icons,
 * pinned apps, shell settings, persistence, messaging, deep links and the notification area.
 */
export interface WindowManager {
  /** The current state. */
  getState(): ManagerState;
  /** Calls `listener` after every change; returns an unsubscribe function. */
  subscribe(listener: (state: ManagerState) => void): () => void;
  /** Listens to one event; returns an unsubscribe function. */
  on<E extends WindowManagerEvent>(
    event: E,
    handler: (payload: EventPayload<E>) => void,
  ): () => void;
  /** The definition of an app. Throws `UNKNOWN_APP`. */
  getApp(appId: AppId): AppDefinition;
  /** The behavior options this manager was created with, defaults filled in. Never changes. */
  getConfig(): WindowManagerConfig;

  /** Opens a window (or focuses the existing one of a single-instance app). */
  open<TData>(options: OpenOptions<TData>): WindowId;
  /** Closes a window and its children; resolves false when a guard refused. */
  close(id: WindowId, options?: { force?: boolean }): Promise<boolean>;
  /** Sets or clears the function that decides whether a window may close. */
  setCloseGuard(id: WindowId, guard: (() => boolean | Promise<boolean>) | null): void;
  /** Raises a window and gives it focus (restoring it when minimized). */
  focus(id: WindowId): void;
  /** Minimizes a window and its children. */
  minimize(id: WindowId): void;
  /** Maximizes a window to the work area. */
  maximize(id: WindowId): void;
  /** Brings a minimized, maximized, snapped or fullscreen window back to its normal bounds. */
  restore(id: WindowId): void;
  /** Maximizes, or restores when already maximized. */
  toggleMaximize(id: WindowId): void;
  /** Enters or leaves fullscreen (the whole viewport, ignoring insets). */
  setFullscreen(id: WindowId, on: boolean): void;
  /** Moves a window (and its children) to or from the always-on-top layer. */
  setAlwaysOnTop(id: WindowId, on: boolean): void;
  /** Moves a normal window, keeping its title bar in the work area (a snapped one is unsnapped). */
  move(id: WindowId, to: Point): void;
  /** Resizes a normal window within its size rules. Throws `INVALID_BOUNDS`. */
  resize(id: WindowId, bounds: Bounds): void;
  /**
   * Snaps a window to a zone of the work area (restoring a minimized or maximized one first), or
   * back to its normal bounds with `null`. Ignored for fixed-size apps and fullscreen windows.
   */
  snap(id: WindowId, zone: SnapZone | null): void;
  /** Changes title, badge, dirty flag or data. */
  update<TData>(
    id: WindowId,
    patch: Partial<Pick<WindowState<TData>, 'title' | 'badge' | 'dirty' | 'data'>>,
  ): void;
  /** Focuses the next (1) or previous (-1) window in most-recently-used order. */
  cycleFocus(direction?: 1 | -1): void;
  /**
   * Minimizes every window of the active desktop and remembers them (`true`), or brings back
   * exactly those (`false`); toggles when omitted. Focusing or opening a window ends the mode.
   */
  showDesktop(on?: boolean): void;

  /** Adds a desktop (default name "Desktop N") and returns its id. It does not switch to it. */
  addDesktop(name?: string): DesktopId;
  /** Renames a desktop. Throws `UNKNOWN_DESKTOP`. */
  renameDesktop(id: DesktopId, name: string): void;
  /**
   * Removes a desktop. Its windows move to `moveWindowsTo`, or are closed (their close guards
   * run first; resolves false when one refused); `moveWindowsTo` equal to the removed desktop is
   * ignored. Throws `LAST_DESKTOP` for the only desktop and `UNKNOWN_DESKTOP` for a missing one.
   */
  removeDesktop(id: DesktopId, options?: { moveWindowsTo?: DesktopId }): Promise<boolean>;
  /** Makes a desktop active and focuses its topmost visible window. */
  switchDesktop(id: DesktopId): void;
  /**
   * Moves a window to another desktop. Child windows stay with their parent, so the whole tree
   * moves together.
   */
  moveToDesktop(windowId: WindowId, desktopId: DesktopId): void;
  /** Sets (or with `null` clears) the wallpaper of a desktop. */
  setWallpaper(desktopId: DesktopId, wallpaper: Wallpaper | null): void;

  /**
   * Sets the order of the desktop icons: the listed apps first (duplicates dropped), then any
   * icons not listed, in their current order. Throws `UNKNOWN_APP`.
   */
  setIconOrder(appIds: AppId[]): void;
  /** Pins an app to the taskbar at `index` (default: the end); an already pinned app is moved. */
  pinApp(appId: AppId, index?: number): void;
  /** Removes an app from the taskbar pins. */
  unpinApp(appId: AppId): void;
  /**
   * Sets the order of the pinned apps: the listed apps first (duplicates dropped), then any pins
   * not listed, in their current order. Use `unpinApp` to remove one. Throws `UNKNOWN_APP`.
   */
  setPinnedOrder(appIds: AppId[]): void;
  /** Changes taskbar position, auto-hide or controls style. */
  setShellSettings(patch: Partial<ShellSettings>): void;

  /** Sets the viewport and taskbar insets and re-clamps every window. */
  setViewport(size: Size, insets?: Insets): void;
  /**
   * Sends a message to one window, or to an app: its `onMessage` listeners and the listeners of
   * every open window of that app. Nothing is queued: a window whose content is not mounted
   * (minimized, other desktop) does not receive it. `options.from` is the sending window, passed
   * to the listeners (default null). Throws `UNKNOWN_WINDOW` or `UNKNOWN_APP`.
   */
  send(
    target: { windowId: WindowId } | { appId: AppId },
    message: unknown,
    options?: { from?: WindowId },
  ): void;
  /**
   * Listens for messages sent to a window or an app; returns an unsubscribe function. Listeners
   * of a window are dropped when it closes. Throws `UNKNOWN_WINDOW` or `UNKNOWN_APP`.
   */
  onMessage(
    target: { windowId: WindowId } | { appId: AppId },
    handler: (message: unknown, from: WindowId | null) => void,
  ): () => void;
  /**
   * Opens the app named by `?open=<appId>&<params>`, passing the other parameters as the window's
   * `data` (merged over an object `defaultData`). Returns the window id, or null when there is no
   * `open` parameter, the app is unknown, or the app's instance limit is reached.
   */
  openFromUrl(url: string | URL | URLSearchParams): WindowId | null;
  /**
   * Builds the query string `?open=<appId>&<params>` that `openFromUrl` understands. For a window
   * it uses the window's app. Throws `UNKNOWN_WINDOW` or `UNKNOWN_APP`.
   */
  toUrl(target: { windowId: WindowId } | { appId: AppId }, params?: Record<string, string>): string;

  /**
   * Adds an item to the notification area (an item with the same `id` is replaced); returns a
   * function that removes it again (a no-op once another registration replaced it).
   */
  registerTrayItem(item: TrayItem): () => void;
  /** Changes a tray item (its `id` stays). An unknown id is ignored. */
  updateTrayItem(id: string, patch: Partial<TrayItem>): void;
  /**
   * Adds a notification (unread, newest first) and returns its id. Emits the `notification` event.
   * Notifications are not saved with the layout.
   */
  notify(notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): string;
  /** Marks one notification, or with `'all'` every notification, as read. */
  markRead(id: string | 'all'): void;
  /** Removes one notification. An unknown id is ignored. */
  dismiss(id: string): void;
  /** Removes every notification. */
  clearNotifications(): void;

  /** The current layout as a snapshot (what gets saved). */
  serialize(): LayoutSnapshot;
  /**
   * Replaces the layout with a snapshot: unknown apps and windows `restore` refuses are skipped,
   * missing icons are appended, windows are re-fitted to the current work area. Throws
   * `INVALID_SNAPSHOT` for another version or a broken shape (nothing changes). A minimized
   * window returns to the status in `minimizedFrom`; without it, to snapped, maximized or
   * normal by a guess.
   */
  restoreLayout(snapshot: LayoutSnapshot): void;
  /** Saves the layout now, skipping the debounce (waits for a pending load first). */
  flush(): Promise<void>;
  /** Removes every listener and cancels a pending save (call `flush` first to keep it). */
  destroy(): void;
}
