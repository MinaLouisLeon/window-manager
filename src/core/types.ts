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

/** Options for `createWindowManager`. The remaining options arrive with their milestones. */
export interface WindowManagerOptions {
  apps: AppDefinition[];
  /** Default: one desktop named "Desktop 1". */
  desktops?: { id?: DesktopId; name: string; wallpaper?: Wallpaper }[];
  shell?: Partial<ShellSettings>;
  /** Pixels of a title bar that always stay in the work area, default 48. */
  minVisibleTitleBar?: number;
  /** Offset between cascaded windows, default 24. */
  cascadeOffset?: number;
}

/**
 * The window manager. This is the part implemented so far (windows, focus, close guards, events);
 * desktops, snapping, messaging, persistence and the notification area are added by later
 * milestones.
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
  /** Moves a normal window, keeping its title bar in the work area. */
  move(id: WindowId, to: Point): void;
  /** Resizes a normal window within its size rules. Throws `INVALID_BOUNDS`. */
  resize(id: WindowId, bounds: Bounds): void;
  /** Changes title, badge, dirty flag or data. */
  update<TData>(
    id: WindowId,
    patch: Partial<Pick<WindowState<TData>, 'title' | 'badge' | 'dirty' | 'data'>>,
  ): void;
  /** Focuses the next (1) or previous (-1) window in most-recently-used order. */
  cycleFocus(direction?: 1 | -1): void;
  /** Sets the viewport and taskbar insets and re-clamps every window. */
  setViewport(size: Size, insets?: Insets): void;
  /** Removes every listener. */
  destroy(): void;
}
