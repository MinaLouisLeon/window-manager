import {
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  boundsForZone,
  clampBounds,
  DEFAULT_MIN_SIZE,
  DEFAULT_MIN_VISIBLE_TITLE_BAR,
  DEFAULT_SNAP_THRESHOLD,
  dragRestoreBounds,
  type ResizeEdge,
  resizeBounds,
  workArea,
  zoneAtPoint,
} from '../core/geometry';
import type {
  Bounds,
  ControlsStyle,
  ManagerState,
  Size,
  SnapZone,
  WindowId,
  WindowManager,
  WindowState,
} from '../core/types';
import { useExternalStore } from './externalStore';
import { chain, composeRefs, type FrameControlProps, type FrameProps } from './propHelpers';
import type { SnapPreviewState } from './uiStores';
import { useManagerSelector } from './useManagerSelector';
import { useWindowManagerContext } from './windowManagerContext';

/** Pixels the pointer must travel before a press on the title bar becomes a drag. */
const DRAG_THRESHOLD = 3;
/** Pixels one arrow key press moves or resizes a window in keyboard mode (Shift: 10 times). */
const KEYBOARD_STEP = 8;

export type { FrameControlProps, FrameProps, ResizeEdge };

/** One of the window control buttons. */
export type WindowControl = 'minimize' | 'maximize' | 'close';

/** What `useWindowFrame` returns. */
export interface UseWindowFrameResult {
  /** The state of the window, or null once it is closed. */
  window: WindowState | null;
  focused: boolean;
  /** True while a modal child window is open over this window. */
  blocked: boolean;
  /** False for fixed-size apps: they cannot be resized or maximized. */
  resizable: boolean;
  /** The app's `controlsStyle`, or the shell's. */
  controlsStyle: ControlsStyle;
  /** Put this `id` on the title text element; the root's `aria-labelledby` points to it. */
  titleId: string;
  /** True while the title bar is being dragged. */
  dragging: boolean;
  /** True while a resize handle is being dragged. */
  resizing: boolean;
  /** Set between `startKeyboardMove` / `startKeyboardResize` and Enter or Esc. */
  keyboardMode: 'move' | 'resize' | null;
  /**
   * While this window is dragged near an edge: where it would snap (a drag to the top edge
   * maximizes). Releasing the window there applies it. Null otherwise.
   */
  snapPreview: SnapPreviewState;
  /** Position, size, ARIA and `data-*` attributes, and focus-on-press for the window element. */
  getRootProps(props?: FrameProps): FrameProps;
  /**
   * Drag to move (a maximized or snapped window is restored first, keeping the pointer at the
   * same spot on the title bar), double-click to maximize. Anything inside an element marked
   * `data-wm-no-drag` does neither.
   */
  getTitleBarProps(props?: FrameProps): FrameProps;
  /** One of the 8 resize handles; hidden from screen readers and from windows that cannot resize. */
  getResizeHandleProps(edge: ResizeEdge, props?: FrameProps): FrameProps;
  /** A minimize, maximize (restore) or close button. */
  getControlProps(control: WindowControl, props?: FrameControlProps): FrameControlProps;
  /** Enters keyboard move mode: arrows move (Shift: 10 times), Enter commits, Esc cancels. */
  startKeyboardMove(): void;
  /** Enters keyboard resize mode: arrows resize from the bottom right, same keys as move. */
  startKeyboardResize(): void;
}

interface Session {
  kind: 'drag' | 'resize';
  edge: ResizeEdge;
  pointerId: number;
  originX: number;
  originY: number;
  base: Bounds;
  latest: Bounds;
  started: boolean;
  /** Where the surface sits on screen, to turn pointer positions into work-area positions. */
  surfaceLeft: number;
  surfaceTop: number;
  /** The snap zone under the pointer (drags only). */
  zone: SnapZone | 'maximize' | null;
}

interface KeyboardSession {
  mode: 'move' | 'resize';
  latest: Bounds;
}

const HANDLE = 'var(--wm-resize-handle, 6px)';
const CORNER = 'calc(var(--wm-resize-handle, 6px) * 2)';
const HANDLE_STYLES: Record<ResizeEdge, CSSProperties> = {
  n: { top: 0, left: 0, right: 0, height: HANDLE, cursor: 'ns-resize' },
  s: { bottom: 0, left: 0, right: 0, height: HANDLE, cursor: 'ns-resize' },
  e: { top: 0, right: 0, bottom: 0, width: HANDLE, cursor: 'ew-resize' },
  w: { top: 0, left: 0, bottom: 0, width: HANDLE, cursor: 'ew-resize' },
  nw: { top: 0, left: 0, width: CORNER, height: CORNER, cursor: 'nwse-resize', zIndex: 1 },
  ne: { top: 0, right: 0, width: CORNER, height: CORNER, cursor: 'nesw-resize', zIndex: 1 },
  sw: { bottom: 0, left: 0, width: CORNER, height: CORNER, cursor: 'nesw-resize', zIndex: 1 },
  se: { bottom: 0, right: 0, width: CORNER, height: CORNER, cursor: 'nwse-resize', zIndex: 1 },
};

function hasModalChild(state: ManagerState, id: WindowId): boolean {
  return Object.values(state.windows).some((win) => win.parentId === id && win.modal);
}

function isResizable(manager: WindowManager, win: WindowState): boolean {
  return manager.getApp(win.appId).size?.resizable !== false;
}

function sizeRules(manager: WindowManager, win: WindowState): { min: Size; max?: Size } {
  const size = manager.getApp(win.appId).size;
  return { min: size?.min ?? DEFAULT_MIN_SIZE, ...(size?.max ? { max: size.max } : {}) };
}

function currentArea(manager: WindowManager): Bounds {
  const state = manager.getState();
  return workArea(state.viewport, state.insets);
}

/** Writes bounds straight to the element, so a drag costs no React render. */
function paint(element: HTMLElement | null, bounds: Bounds): void {
  if (element === null) return;
  element.style.transform = `translate(${bounds.x}px, ${bounds.y}px)`;
  element.style.width = `${bounds.width}px`;
  element.style.height = `${bounds.height}px`;
}

function release(element: HTMLElement, pointerId: number): void {
  if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
}

/** True when the event started inside a `data-wm-no-drag` area of `container`. */
function inNoDragArea(event: ReactMouseEvent<HTMLElement>): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  const hit = target.closest('[data-wm-no-drag]');
  return hit !== null && event.currentTarget.contains(hit);
}

/**
 * Everything a window frame needs: prop getters for the root, the title bar, the 8 resize handles
 * and the control buttons, plus keyboard move and resize. The window is positioned with
 * `transform`, and dragging or resizing writes to the element directly and commits to the manager
 * on release, so there is no React render per pointer move.
 */
export function useWindowFrame(id: WindowId): UseWindowFrameResult {
  const { manager, stores } = useWindowManagerContext();
  const preview = useExternalStore(stores.snapPreview);
  const win = useManagerSelector((state) => state.windows[id] ?? null);
  const focused = useManagerSelector((state) => state.focusedId === id);
  const blocked = useManagerSelector((state) => hasModalChild(state, id));
  const stackIndex = useManagerSelector((state) => state.order.indexOf(id));
  const taskbarPosition = useManagerSelector((state) => state.shell.taskbarPosition);
  const shellControls = useManagerSelector((state) => state.shell.controlsStyle);

  const titleId = useId();
  const rootElement = useRef<HTMLElement | null>(null);
  const session = useRef<Session | null>(null);
  const keyboard = useRef<KeyboardSession | null>(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [keyboardMode, setKeyboardMode] = useState<'move' | 'resize' | null>(null);

  const rootRef = useCallback((node: HTMLElement | null): void => {
    rootElement.current = node;
  }, []);

  const resizable = win !== null && isResizable(manager, win);
  const controlsStyle =
    (win !== null ? manager.getApp(win.appId).controlsStyle : undefined) ?? shellControls;
  const isNormal = win?.status === 'normal';

  // Keyboard mode ends when the window can no longer move (minimized, maximized, closed).
  useEffect(() => {
    if (!isNormal && keyboard.current !== null) {
      keyboard.current = null;
      setKeyboardMode(null);
    }
  }, [isNormal]);

  // Keyboard move and resize listen on the document, so they work wherever focus is.
  useEffect(() => {
    if (keyboardMode === null) return;

    const finish = (commit: boolean): void => {
      const active = keyboard.current;
      keyboard.current = null;
      setKeyboardMode(null);
      const current = manager.getState().windows[id];
      if (current === undefined) return;
      paint(rootElement.current, current.bounds);
      if (!commit || active === null) return;
      if (active.mode === 'move') manager.move(id, { x: active.latest.x, y: active.latest.y });
      else manager.resize(id, active.latest);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      const active = keyboard.current;
      if (active === null) return;
      const current = manager.getState().windows[id];
      if (current === undefined) {
        finish(false);
        return;
      }
      if (event.key === 'Escape') {
        finish(false);
      } else if (event.key === 'Enter') {
        finish(true);
      } else {
        const step = event.shiftKey ? KEYBOARD_STEP * 10 : KEYBOARD_STEP;
        const dx = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
        const dy = event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0;
        if (dx === 0 && dy === 0) return;
        const area = currentArea(manager);
        const rules = sizeRules(manager, current);
        active.latest =
          active.mode === 'move'
            ? clampBounds(
                { ...active.latest, x: active.latest.x + dx, y: active.latest.y + dy },
                area,
                {
                  ...rules,
                  minVisibleTitleBar: DEFAULT_MIN_VISIBLE_TITLE_BAR,
                },
              )
            : resizeBounds(active.latest, 'se', dx, dy, rules, area);
        paint(rootElement.current, active.latest);
      }
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [keyboardMode, manager, id]);

  function startKeyboard(mode: 'move' | 'resize'): void {
    const state = manager.getState();
    const current = state.windows[id];
    if (current === undefined || current.status !== 'normal') return;
    if (hasModalChild(state, id) || session.current !== null) return;
    if (mode === 'resize' && !isResizable(manager, current)) return;
    keyboard.current = { mode, latest: current.bounds };
    rootElement.current?.focus({ preventScroll: true });
    setKeyboardMode(mode);
  }

  // ---------- pointer: drag ----------

  function onTitlePointerDown(event: ReactPointerEvent<HTMLElement>): void {
    if (event.button !== 0 || !event.isPrimary || inNoDragArea(event)) return;
    const state = manager.getState();
    const current = state.windows[id];
    if (
      current === undefined ||
      current.status === 'minimized' ||
      current.status === 'fullscreen'
    ) {
      return;
    }
    if (hasModalChild(state, id) || keyboard.current !== null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = rootElement.current?.getBoundingClientRect();
    session.current = {
      kind: 'drag',
      edge: 'n',
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      base: current.bounds,
      latest: current.bounds,
      started: false,
      surfaceLeft: (rect?.left ?? 0) - current.bounds.x,
      surfaceTop: (rect?.top ?? 0) - current.bounds.y,
      zone: null,
    };
  }

  /** Shows (or hides) the snap preview for the zone under the pointer. */
  function updateSnapZone(active: Session, event: ReactPointerEvent<HTMLElement>): void {
    const current = manager.getState().windows[id];
    let zone: Session['zone'] = null;
    let area = currentArea(manager);
    if (current !== undefined && isResizable(manager, current)) {
      zone = zoneAtPoint(
        { x: event.clientX - active.surfaceLeft, y: event.clientY - active.surfaceTop },
        area,
        DEFAULT_SNAP_THRESHOLD,
      );
    }
    if (zone === active.zone) return;
    active.zone = zone;
    area = currentArea(manager);
    stores.snapPreview.set(
      zone === null
        ? null
        : { zone, bounds: zone === 'maximize' ? area : boundsForZone(zone, area) },
    );
  }

  function onTitlePointerMove(event: ReactPointerEvent<HTMLElement>): void {
    const active = session.current;
    if (active === null || active.kind !== 'drag' || active.pointerId !== event.pointerId) return;
    if (!active.started) {
      if (
        Math.hypot(event.clientX - active.originX, event.clientY - active.originY) < DRAG_THRESHOLD
      ) {
        return;
      }
      const current = manager.getState().windows[id];
      if (current === undefined) {
        session.current = null;
        return;
      }
      active.started = true;
      setDragging(true);
      if (current.status === 'maximized' || current.snap !== null) {
        // Bring back the normal size, with the pointer at the same spot on the title bar.
        const rect = rootElement.current?.getBoundingClientRect();
        const pointer = {
          x: current.bounds.x + (event.clientX - (rect?.left ?? 0)),
          y: current.bounds.y + (event.clientY - (rect?.top ?? 0)),
        };
        const target = dragRestoreBounds(
          pointer,
          current.bounds,
          current.restoreBounds ?? current.bounds,
        );
        manager.restore(id);
        manager.move(id, { x: target.x, y: target.y });
        const restored = manager.getState().windows[id];
        if (restored === undefined) {
          session.current = null;
          setDragging(false);
          return;
        }
        active.base = restored.bounds;
        active.originX = event.clientX;
        active.originY = event.clientY;
        paint(rootElement.current, restored.bounds);
      }
    }
    const current = manager.getState().windows[id];
    if (current === undefined) return;
    active.latest = clampBounds(
      {
        ...active.base,
        x: active.base.x + event.clientX - active.originX,
        y: active.base.y + event.clientY - active.originY,
      },
      currentArea(manager),
      { ...sizeRules(manager, current), minVisibleTitleBar: DEFAULT_MIN_VISIBLE_TITLE_BAR },
    );
    paint(rootElement.current, active.latest);
    updateSnapZone(active, event);
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>, commit: boolean): void {
    const active = session.current;
    if (active === null || active.kind !== 'drag' || active.pointerId !== event.pointerId) return;
    session.current = null;
    release(event.currentTarget, event.pointerId);
    if (!active.started) return;
    setDragging(false);
    stores.snapPreview.set(null);
    const current = manager.getState().windows[id];
    if (current === undefined) return;
    paint(rootElement.current, current.bounds);
    if (!commit) return;
    manager.move(id, { x: active.latest.x, y: active.latest.y });
    if (active.zone === 'maximize') manager.maximize(id);
    else if (active.zone !== null) manager.snap(id, active.zone);
  }

  function onTitleDoubleClick(event: ReactMouseEvent<HTMLElement>): void {
    if (inNoDragArea(event)) return;
    const state = manager.getState();
    const current = state.windows[id];
    if (
      current === undefined ||
      current.status === 'minimized' ||
      current.status === 'fullscreen'
    ) {
      return;
    }
    if (hasModalChild(state, id) || !isResizable(manager, current)) return;
    manager.toggleMaximize(id);
  }

  // ---------- pointer: resize ----------

  function onHandlePointerDown(edge: ResizeEdge, event: ReactPointerEvent<HTMLElement>): void {
    if (event.button !== 0 || !event.isPrimary) return;
    const state = manager.getState();
    const current = state.windows[id];
    if (current === undefined || current.status !== 'normal' || !isResizable(manager, current)) {
      return;
    }
    if (hasModalChild(state, id) || keyboard.current !== null) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    session.current = {
      kind: 'resize',
      edge,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      base: current.bounds,
      latest: current.bounds,
      started: false,
      surfaceLeft: 0,
      surfaceTop: 0,
      zone: null,
    };
  }

  function onHandlePointerMove(event: ReactPointerEvent<HTMLElement>): void {
    const active = session.current;
    if (active === null || active.kind !== 'resize' || active.pointerId !== event.pointerId) return;
    const current = manager.getState().windows[id];
    if (current === undefined) return;
    if (!active.started) {
      active.started = true;
      setResizing(true);
    }
    active.latest = resizeBounds(
      active.base,
      active.edge,
      event.clientX - active.originX,
      event.clientY - active.originY,
      sizeRules(manager, current),
      currentArea(manager),
    );
    paint(rootElement.current, active.latest);
  }

  function endResize(event: ReactPointerEvent<HTMLElement>, commit: boolean): void {
    const active = session.current;
    if (active === null || active.kind !== 'resize' || active.pointerId !== event.pointerId) return;
    session.current = null;
    release(event.currentTarget, event.pointerId);
    if (!active.started) return;
    setResizing(false);
    const current = manager.getState().windows[id];
    if (current === undefined) return;
    paint(rootElement.current, current.bounds);
    if (commit) manager.resize(id, active.latest);
  }

  // ---------- prop getters ----------

  function getRootProps(props: FrameProps = {}): FrameProps {
    const bounds = win?.bounds;
    const style: CSSProperties | undefined =
      win === null || bounds === undefined
        ? props.style
        : {
            position: 'absolute',
            top: 0,
            left: 0,
            width: bounds.width,
            height: bounds.height,
            transform: `translate(${bounds.x}px, ${bounds.y}px)`,
            zIndex: stackIndex + 1,
            ...(win.status === 'minimized' ? { display: 'none' } : {}),
            ...props.style,
          };
    return {
      ...props,
      ref: composeRefs(rootRef, props.ref),
      role: 'dialog',
      'aria-labelledby': titleId,
      'aria-modal': win?.modal ? true : undefined,
      tabIndex: props.tabIndex ?? -1,
      style,
      'data-wm-window': '',
      'data-state': focused ? 'focused' : 'unfocused',
      'data-status': win?.status,
      'data-snap': win?.snap ?? undefined,
      'data-dragging': dragging ? '' : undefined,
      'data-resizing': resizing ? '' : undefined,
      'data-always-on-top': win?.alwaysOnTop ? '' : undefined,
      'data-blocked': blocked ? '' : undefined,
      'data-controls-style': controlsStyle,
      'data-taskbar-position': taskbarPosition,
      onPointerDownCapture: chain<ReactPointerEvent<HTMLElement>>(
        props.onPointerDownCapture,
        () => {
          if (manager.getState().windows[id] !== undefined) manager.focus(id);
        },
      ),
      onFocusCapture: chain<ReactFocusEvent<HTMLElement>>(props.onFocusCapture, () => {
        const state = manager.getState();
        if (state.windows[id] !== undefined && state.focusedId !== id) manager.focus(id);
      }),
    };
  }

  function getTitleBarProps(props: FrameProps = {}): FrameProps {
    return {
      ...props,
      style: { touchAction: 'none', userSelect: 'none', ...props.style },
      onPointerDown: chain<ReactPointerEvent<HTMLElement>>(props.onPointerDown, onTitlePointerDown),
      onPointerMove: chain<ReactPointerEvent<HTMLElement>>(props.onPointerMove, onTitlePointerMove),
      onPointerUp: chain<ReactPointerEvent<HTMLElement>>(props.onPointerUp, (event) =>
        endDrag(event, true),
      ),
      onPointerCancel: chain<ReactPointerEvent<HTMLElement>>(props.onPointerCancel, (event) =>
        endDrag(event, false),
      ),
      onDoubleClick: chain<ReactMouseEvent<HTMLElement>>(props.onDoubleClick, onTitleDoubleClick),
    };
  }

  function getResizeHandleProps(edge: ResizeEdge, props: FrameProps = {}): FrameProps {
    const usable = win !== null && win.status === 'normal' && resizable && !blocked;
    return {
      ...props,
      'aria-hidden': true,
      style: {
        position: 'absolute',
        touchAction: 'none',
        ...HANDLE_STYLES[edge],
        ...(usable ? {} : { display: 'none' }),
        ...props.style,
      },
      onPointerDown: chain<ReactPointerEvent<HTMLElement>>(props.onPointerDown, (event) =>
        onHandlePointerDown(edge, event),
      ),
      onPointerMove: chain<ReactPointerEvent<HTMLElement>>(
        props.onPointerMove,
        onHandlePointerMove,
      ),
      onPointerUp: chain<ReactPointerEvent<HTMLElement>>(props.onPointerUp, (event) =>
        endResize(event, true),
      ),
      onPointerCancel: chain<ReactPointerEvent<HTMLElement>>(props.onPointerCancel, (event) =>
        endResize(event, false),
      ),
    };
  }

  function getControlProps(
    control: WindowControl,
    props: FrameControlProps = {},
  ): FrameControlProps {
    const label =
      control === 'minimize'
        ? 'Minimize'
        : control === 'close'
          ? 'Close'
          : win?.status === 'maximized'
            ? 'Restore'
            : 'Maximize';
    return {
      ...props,
      type: 'button',
      'aria-label': props['aria-label'] ?? label,
      disabled: props.disabled ?? (control === 'maximize' && !resizable),
      'data-wm-no-drag': '',
      onClick: chain<ReactMouseEvent<HTMLButtonElement>>(props.onClick, () => {
        const state = manager.getState();
        if (state.windows[id] === undefined || hasModalChild(state, id)) return;
        if (control === 'minimize') manager.minimize(id);
        else if (control === 'maximize') manager.toggleMaximize(id);
        else void manager.close(id);
      }),
    };
  }

  return {
    window: win,
    focused,
    blocked,
    resizable,
    controlsStyle,
    titleId,
    dragging,
    resizing,
    keyboardMode,
    snapPreview: dragging ? preview : null,
    getRootProps,
    getTitleBarProps,
    getResizeHandleProps,
    getControlProps,
    startKeyboardMove: () => startKeyboard('move'),
    startKeyboardResize: () => startKeyboard('resize'),
  };
}
