import { useMemo } from 'react';
import type {
  Bounds,
  Desktop,
  DesktopId,
  Point,
  SnapZone,
  Wallpaper,
  WindowId,
  WindowManager,
  WindowState,
} from '../core/types';
import { useManagerSelector } from './useManagerSelector';
import { useWindowManagerContext } from './windowManagerContext';

/** The window actions of the manager, bound to one window id. */
export interface WindowActions {
  /** Raises the window and gives it focus (restoring it when minimized). */
  focus(): void;
  minimize(): void;
  maximize(): void;
  /** Back to the normal bounds from minimized, maximized, snapped or fullscreen. */
  restore(): void;
  toggleMaximize(): void;
  setFullscreen(on: boolean): void;
  setAlwaysOnTop(on: boolean): void;
  move(to: Point): void;
  resize(bounds: Bounds): void;
  snap(zone: SnapZone | null): void;
  /** Resolves false when a close guard refused. */
  close(options?: { force?: boolean }): Promise<boolean>;
  moveToDesktop(desktopId: DesktopId): void;
  update(patch: Partial<Pick<WindowState, 'title' | 'badge' | 'dirty' | 'data'>>): void;
  setCloseGuard(guard: (() => boolean | Promise<boolean>) | null): void;
}

/** Binds the window actions of `manager` to `id`. */
export function createWindowActions(manager: WindowManager, id: WindowId): WindowActions {
  return {
    focus: () => manager.focus(id),
    minimize: () => manager.minimize(id),
    maximize: () => manager.maximize(id),
    restore: () => manager.restore(id),
    toggleMaximize: () => manager.toggleMaximize(id),
    setFullscreen: (on) => manager.setFullscreen(id, on),
    setAlwaysOnTop: (on) => manager.setAlwaysOnTop(id, on),
    move: (to) => manager.move(id, to),
    resize: (bounds) => manager.resize(id, bounds),
    snap: (zone) => manager.snap(id, zone),
    close: (options) => manager.close(id, options),
    moveToDesktop: (desktopId) => manager.moveToDesktop(id, desktopId),
    update: (patch) => manager.update(id, patch),
    setCloseGuard: (guard) => manager.setCloseGuard(id, guard),
  };
}

/** What `useWindow` returns: the window's state plus its actions. */
export interface UseWindowResult<TData = unknown> extends WindowActions {
  id: WindowId;
  /** The state of the window, or null once it is closed (or when the id is unknown). */
  window: WindowState<TData> | null;
  /** True while this window has focus. */
  focused: boolean;
}

/**
 * One window's state and its actions. Re-renders only when this window (or its focus) changes.
 * The actions throw `UNKNOWN_WINDOW` once the window is closed.
 */
export function useWindow<TData = unknown>(id: WindowId): UseWindowResult<TData> {
  const { manager } = useWindowManagerContext();
  const win = useManagerSelector((state) => state.windows[id] ?? null);
  const focused = useManagerSelector((state) => state.focusedId === id);
  const actions = useMemo(() => createWindowActions(manager, id), [manager, id]);
  return { id, window: win as WindowState<TData> | null, focused, ...actions };
}

/** What `useDesktops` returns. */
export interface UseDesktopsResult {
  desktops: Desktop[];
  activeDesktopId: DesktopId;
  activeDesktop: Desktop;
  /** Adds a desktop and returns its id (it does not switch to it). */
  add(name?: string): DesktopId;
  rename(id: DesktopId, name: string): void;
  /** Removes a desktop; resolves false when a close guard refused. */
  remove(id: DesktopId, options?: { moveWindowsTo?: DesktopId }): Promise<boolean>;
  switchTo(id: DesktopId): void;
  moveWindow(windowId: WindowId, desktopId: DesktopId): void;
  setWallpaper(id: DesktopId, wallpaper: Wallpaper | null): void;
}

/** The desktops, the active one and the actions that change them. */
export function useDesktops(): UseDesktopsResult {
  const { manager } = useWindowManagerContext();
  const desktops = useManagerSelector((state) => state.desktops);
  const activeDesktopId = useManagerSelector((state) => state.activeDesktopId);
  const actions = useMemo(
    () => ({
      add: (name?: string) => manager.addDesktop(name),
      rename: (id: DesktopId, name: string) => manager.renameDesktop(id, name),
      remove: (id: DesktopId, options?: { moveWindowsTo?: DesktopId }) =>
        manager.removeDesktop(id, options),
      switchTo: (id: DesktopId) => manager.switchDesktop(id),
      moveWindow: (windowId: WindowId, desktopId: DesktopId) =>
        manager.moveToDesktop(windowId, desktopId),
      setWallpaper: (id: DesktopId, wallpaper: Wallpaper | null) =>
        manager.setWallpaper(id, wallpaper),
    }),
    [manager],
  );
  const activeDesktop = (desktops.find((desktop) => desktop.id === activeDesktopId) ??
    desktops[0]) as Desktop;
  return { desktops, activeDesktopId, activeDesktop, ...actions };
}
