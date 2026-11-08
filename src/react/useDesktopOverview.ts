import {
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AppId, DesktopId, Wallpaper, WindowId } from '../core/types';
import { useExternalStore } from './externalStore';
import { chain, type FrameProps } from './propHelpers';
import { useManagerSelector } from './useManagerSelector';
import { useWindowManagerContext } from './windowManagerContext';

/** A window frame in the overview: where the window sits, as fractions of the viewport. */
export interface OverviewWindow {
  id: WindowId;
  appId: AppId;
  title: string;
  /** The app's `icon` (draw it with `AppIcon`). */
  icon: unknown;
  focused: boolean;
  minimized: boolean;
  dirty: boolean;
  /** Left, top, width and height from 0 to 1 of the viewport. */
  frame: { left: number; top: number; width: number; height: number };
}

/** One desktop in the overview, with the frames of its windows in paint order. */
export interface OverviewDesktop {
  id: DesktopId;
  name: string;
  active: boolean;
  wallpaper: Wallpaper | null;
  windows: OverviewWindow[];
}

/** What `useDesktopOverview` returns. */
export interface UseDesktopOverviewResult {
  open: boolean;
  setOpen(open: boolean): void;
  toggle(): void;
  desktops: OverviewDesktop[];
  /** The window being dragged, or null. */
  draggingId: WindowId | null;
  /** The desktop under the dragged window, or null. */
  dropTargetId: DesktopId | null;
  /** Switches to a desktop and closes the overview. */
  switchTo(id: DesktopId): void;
  /** Switches to the window's desktop, focuses the window (restoring it) and closes the overview. */
  focusWindow(id: WindowId): void;
  /** Moves a window (with its child windows) to another desktop. */
  moveWindow(windowId: WindowId, desktopId: DesktopId): void;
  /** Adds a desktop (the overview stays open) and returns its id. */
  add(): DesktopId;
  /**
   * Props for the element that stands for a window: draggable to another desktop, and
   * Shift+ArrowLeft / Shift+ArrowRight move it to the previous / next desktop.
   */
  getWindowProps(windowId: WindowId, props?: FrameProps): FrameProps;
  /** Props for the element that stands for a desktop: the drop target for dragged windows. */
  getDesktopProps(desktopId: DesktopId, props?: FrameProps): FrameProps;
}

/**
 * The model of the desktop overview: whether it is open (Ctrl+Alt+O toggles it, Esc closes it),
 * every desktop with its window frames, and the actions to switch, focus and move windows between
 * desktops by dragging. Components draw the frames; this hook only describes them.
 */
export function useDesktopOverview(): UseDesktopOverviewResult {
  const { manager, stores } = useWindowManagerContext();
  const open = useExternalStore(stores.overview);
  const desktops = useManagerSelector((state) => state.desktops);
  const activeDesktopId = useManagerSelector((state) => state.activeDesktopId);
  const windows = useManagerSelector((state) => state.windows);
  const order = useManagerSelector((state) => state.order);
  const focusedId = useManagerSelector((state) => state.focusedId);
  const viewport = useManagerSelector((state) => state.viewport);
  const [draggingId, setDraggingId] = useState<WindowId | null>(null);
  const [dropTargetId, setDropTargetId] = useState<DesktopId | null>(null);

  // Esc closes the overview, before anything else (such as "leave fullscreen") reacts to it.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      stores.overview.set(false);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, stores]);

  const entries = useMemo((): OverviewDesktop[] => {
    const width = viewport.width > 0 ? viewport.width : 1;
    const height = viewport.height > 0 ? viewport.height : 1;
    return desktops.map((desktop) => ({
      id: desktop.id,
      name: desktop.name,
      active: desktop.id === activeDesktopId,
      wallpaper: desktop.wallpaper,
      windows: order.flatMap((id): OverviewWindow[] => {
        const win = windows[id];
        if (win === undefined || win.desktopId !== desktop.id) return [];
        return [
          {
            id: win.id,
            appId: win.appId,
            title: win.title,
            icon: manager.getApp(win.appId).icon,
            focused: win.id === focusedId,
            minimized: win.status === 'minimized',
            dirty: win.dirty,
            frame: {
              left: win.bounds.x / width,
              top: win.bounds.y / height,
              width: win.bounds.width / width,
              height: win.bounds.height / height,
            },
          },
        ];
      }),
    }));
  }, [desktops, activeDesktopId, windows, order, focusedId, viewport, manager]);

  const setOpen = (next: boolean): void => {
    stores.overview.set(next);
    if (!next) {
      setDraggingId(null);
      setDropTargetId(null);
    }
  };

  function moveWindow(windowId: WindowId, desktopId: DesktopId): void {
    const state = manager.getState();
    if (state.windows[windowId] === undefined) return;
    if (!state.desktops.some((desktop) => desktop.id === desktopId)) return;
    manager.moveToDesktop(windowId, desktopId);
  }

  function neighbourDesktop(windowId: WindowId, step: 1 | -1): DesktopId | null {
    const state = manager.getState();
    const current = state.windows[windowId]?.desktopId;
    const index = state.desktops.findIndex((desktop) => desktop.id === current);
    if (index === -1) return null;
    return state.desktops[index + step]?.id ?? null;
  }

  return {
    open,
    setOpen,
    toggle: () => setOpen(!stores.overview.get()),
    desktops: entries,
    draggingId,
    dropTargetId,
    switchTo(id) {
      manager.switchDesktop(id);
      setOpen(false);
    },
    focusWindow(id) {
      if (manager.getState().windows[id] === undefined) return;
      manager.focus(id);
      setOpen(false);
    },
    moveWindow,
    add: () => manager.addDesktop(),

    getWindowProps(windowId, props = {}) {
      return {
        ...props,
        draggable: true,
        'data-wm-overview-window': windowId,
        'data-dragging': draggingId === windowId ? '' : undefined,
        onDragStart: chain<ReactDragEvent<HTMLElement>>(props.onDragStart, (event) => {
          setDraggingId(windowId);
          event.dataTransfer?.setData('text/plain', windowId);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        }),
        onDragEnd: chain<ReactDragEvent<HTMLElement>>(props.onDragEnd, () => {
          setDraggingId(null);
          setDropTargetId(null);
        }),
        onKeyDown: chain<ReactKeyboardEvent<HTMLElement>>(props.onKeyDown, (event) => {
          if (!event.shiftKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
          const target = neighbourDesktop(windowId, event.key === 'ArrowRight' ? 1 : -1);
          event.preventDefault();
          if (target !== null) moveWindow(windowId, target);
        }),
      };
    },

    getDesktopProps(desktopId, props = {}) {
      return {
        ...props,
        'data-wm-overview-desktop': desktopId,
        'data-drop-target': dropTargetId === desktopId ? '' : undefined,
        onDragOver: chain<ReactDragEvent<HTMLElement>>(props.onDragOver, (event) => {
          if (draggingId === null) return;
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
          setDropTargetId(desktopId);
        }),
        onDragLeave: chain<ReactDragEvent<HTMLElement>>(props.onDragLeave, (event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setDropTargetId((current) => (current === desktopId ? null : current));
        }),
        onDrop: chain<ReactDragEvent<HTMLElement>>(props.onDrop, (event) => {
          if (draggingId === null) return;
          event.preventDefault();
          const dragged = draggingId;
          setDraggingId(null);
          setDropTargetId(null);
          moveWindow(dragged, desktopId);
        }),
      };
    },
  };
}
