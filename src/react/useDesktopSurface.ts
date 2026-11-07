import { type RefCallback, useLayoutEffect, useState } from 'react';
import type {
  Desktop,
  DesktopId,
  Insets,
  TaskbarPosition,
  Wallpaper,
  WindowState,
} from '../core/types';
import { shallowEqualArray, useManagerSelector } from './useManagerSelector';
import { useWindowManagerContext } from './windowManagerContext';

/** 3rem at the default font size: used when `--wm-taskbar-size` cannot be measured. */
const FALLBACK_TASKBAR_SIZE = 48;

/** Options of `useDesktopSurface`. */
export interface UseDesktopSurfaceOptions {
  /** Taskbar thickness in px. Default: the value of `--wm-taskbar-size` on the surface. */
  taskbarSize?: number;
}

/** What `useDesktopSurface` returns. */
export interface UseDesktopSurfaceResult {
  /** Put this on the desktop element: it is measured and reported to the manager. */
  ref: RefCallback<HTMLElement>;
  /**
   * Every window of the active desktop in paint order, bottom to top. Minimized windows are
   * included (so they can animate away); their `status` tells them apart.
   */
  windows: WindowState[];
  activeDesktopId: DesktopId;
  /** The active desktop. */
  desktop: Desktop;
  /** The wallpaper of the active desktop (null: use the theme's). */
  wallpaper: Wallpaper | null;
  /** The space the taskbar takes (all zero while it auto-hides). */
  insets: Insets;
}

/** The space a taskbar of `size` px takes at `position` (none when it hides by itself). */
export function taskbarInsets(position: TaskbarPosition, autoHide: boolean, size: number): Insets {
  const taken = autoHide ? 0 : size;
  return {
    top: position === 'top' ? taken : 0,
    right: position === 'right' ? taken : 0,
    bottom: position === 'bottom' ? taken : 0,
    left: position === 'left' ? taken : 0,
  };
}

/** Resolves `--wm-taskbar-size` (any CSS length) to px by measuring a probe inside `element`. */
function measureTaskbarSize(element: HTMLElement): number {
  const probe = element.ownerDocument.createElement('div');
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;height:0;width:var(--wm-taskbar-size, 3rem)';
  element.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width > 0 ? width : FALLBACK_TASKBAR_SIZE;
}

/**
 * Wiring for the desktop element: measures it (and keeps measuring when it resizes), tells the
 * manager its size and the taskbar insets, and returns the windows and wallpaper to draw. The
 * element should cover the whole viewport, be `position: relative` and clip its content.
 */
export function useDesktopSurface(options: UseDesktopSurfaceOptions = {}): UseDesktopSurfaceResult {
  const { manager } = useWindowManagerContext();
  const [element, setElement] = useState<HTMLElement | null>(null);
  const { taskbarSize } = options;

  const taskbarPosition = useManagerSelector((state) => state.shell.taskbarPosition);
  const autoHide = useManagerSelector((state) => state.shell.taskbarAutoHide);
  const activeDesktopId = useManagerSelector((state) => state.activeDesktopId);
  const desktop = useManagerSelector(
    (state) =>
      (state.desktops.find((entry) => entry.id === state.activeDesktopId) ??
        state.desktops[0]) as Desktop,
  );
  const insets = useManagerSelector((state) => state.insets, sameInsets);
  const windows = useManagerSelector(
    (state) =>
      state.order.flatMap((id) => {
        const win = state.windows[id];
        return win !== undefined && win.desktopId === state.activeDesktopId ? [win] : [];
      }),
    shallowEqualArray,
  );

  useLayoutEffect(() => {
    if (element === null) return;
    const size = taskbarSize ?? measureTaskbarSize(element);
    const taken = taskbarInsets(taskbarPosition, autoHide, size);
    const report = (): void => {
      manager.setViewport({ width: element.clientWidth, height: element.clientHeight }, taken);
    };
    report();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, manager, taskbarPosition, autoHide, taskbarSize]);

  return {
    ref: setElement,
    windows,
    activeDesktopId,
    desktop,
    wallpaper: desktop.wallpaper,
    insets,
  };
}

function sameInsets(a: Insets, b: Insets): boolean {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}
