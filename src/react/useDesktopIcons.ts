import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from 'react';
import type { AppId } from '../core/types';
import { launchApp } from './launchApp';
import { chain, composeRefs, type FrameProps } from './propHelpers';
import { useManagerSelector } from './useManagerSelector';
import { useWindowManagerContext } from './windowManagerContext';

/** Pixels the pointer must travel before a press on an icon becomes a drag. */
const DRAG_THRESHOLD = 4;

/** One desktop icon. */
export interface DesktopIconItem {
  appId: AppId;
  title: string;
  /** The app's `icon`, as given in its definition. */
  icon: unknown;
  /** True for the icon that holds the roving focus (the one in the tab order). */
  active: boolean;
  /** True while this icon is being dragged. */
  dragging: boolean;
  /** True while a dragged icon is over this one (dropping puts it in this place). */
  dropTarget: boolean;
  /** Role, roving tab index, keyboard focus tracking, double-click and drag to reorder. */
  getItemProps(props?: FrameProps): FrameProps;
  open(): void;
}

/** What `useDesktopIcons` returns. */
export interface UseDesktopIconsResult {
  /** The desktop icons in `iconOrder`. */
  icons: DesktopIconItem[];
  /** The app of the icon with the roving focus, or null when there are no icons. */
  activeAppId: AppId | null;
  /**
   * The grid element: a listbox with arrow key navigation (Home and End too) and Enter to open.
   * Rows are found from the icons' positions, so Up and Down work in any auto grid.
   */
  getListProps(props?: FrameProps): FrameProps;
  open(appId: AppId): void;
}

interface DragSession {
  appId: AppId;
  pointerId: number;
  originX: number;
  originY: number;
  started: boolean;
  drop: AppId | null;
}

/**
 * The desktop icons: roving focus (arrows, Home, End), open on double-click or Enter, and drag to
 * reorder (saved with `setIconOrder`).
 */
export function useDesktopIcons(): UseDesktopIconsResult {
  const { manager } = useWindowManagerContext();
  const iconOrder = useManagerSelector((state) => state.iconOrder);
  const [focusedId, setFocusedId] = useState<AppId | null>(null);
  const [drag, setDrag] = useState<{ appId: AppId; drop: AppId | null } | null>(null);
  const elements = useRef(new Map<AppId, HTMLElement>());
  const session = useRef<DragSession | null>(null);

  const activeAppId =
    focusedId !== null && iconOrder.includes(focusedId) ? focusedId : (iconOrder[0] ?? null);

  const open = (appId: AppId): void => {
    launchApp(manager, appId);
  };

  function columnCount(): number {
    const first = elements.current.get(iconOrder[0] as AppId);
    if (first === undefined) return 1;
    let columns = 0;
    for (const appId of iconOrder) {
      if (elements.current.get(appId)?.offsetTop !== first.offsetTop) break;
      columns += 1;
    }
    return Math.max(1, columns);
  }

  function moveFocus(to: number): void {
    const appId = iconOrder[to];
    if (appId === undefined) return;
    setFocusedId(appId);
    elements.current.get(appId)?.focus();
  }

  function onListKeyDown(event: ReactKeyboardEvent<HTMLElement>): void {
    const index = activeAppId === null ? -1 : iconOrder.indexOf(activeAppId);
    if (index === -1) return;
    const columns = columnCount();
    const targets: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      ArrowDown: index + columns,
      ArrowUp: index - columns,
      Home: 0,
      End: iconOrder.length - 1,
    };
    if (event.key === 'Enter' || event.key === ' ') {
      open(iconOrder[index] as AppId);
      event.preventDefault();
      return;
    }
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    if (target >= 0 && target < iconOrder.length) moveFocus(target);
  }

  /** The other icon whose box contains the pointer, if any. */
  function dropTargetAt(appId: AppId, x: number, y: number): AppId | null {
    for (const other of iconOrder) {
      if (other === appId) continue;
      const rect = elements.current.get(other)?.getBoundingClientRect();
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return other;
      }
    }
    return null;
  }

  function onItemPointerDown(appId: AppId, event: ReactPointerEvent<HTMLElement>): void {
    if (event.button !== 0 || !event.isPrimary) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    session.current = {
      appId,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      started: false,
      drop: null,
    };
  }

  function onItemPointerMove(event: ReactPointerEvent<HTMLElement>): void {
    const active = session.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    if (!active.started) {
      const distance = Math.hypot(event.clientX - active.originX, event.clientY - active.originY);
      if (distance < DRAG_THRESHOLD) return;
      active.started = true;
    }
    const drop = dropTargetAt(active.appId, event.clientX, event.clientY);
    active.drop = drop;
    setDrag((previous) =>
      previous?.appId === active.appId && previous.drop === drop
        ? previous
        : { appId: active.appId, drop },
    );
  }

  function endItemDrag(event: ReactPointerEvent<HTMLElement>, commit: boolean): void {
    const active = session.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    session.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDrag(null);
    if (!active.started || !commit || active.drop === null) return;
    const at = iconOrder.indexOf(active.drop);
    const next = iconOrder.filter((appId) => appId !== active.appId);
    next.splice(at, 0, active.appId);
    manager.setIconOrder(next);
  }

  const icons = iconOrder.map((appId): DesktopIconItem => {
    const app = manager.getApp(appId);
    const isActive = appId === activeAppId;
    const getItemProps = (props: FrameProps = {}): FrameProps => ({
      ...props,
      ref: composeRefs((node) => {
        if (node) elements.current.set(appId, node);
        else elements.current.delete(appId);
      }, props.ref),
      role: 'option',
      'aria-selected': isActive,
      'aria-label': props['aria-label'] ?? app.title,
      tabIndex: isActive ? 0 : -1,
      style: { touchAction: 'none', ...props.style },
      'data-dragging': drag?.appId === appId ? '' : undefined,
      'data-drop-target': drag?.drop === appId ? '' : undefined,
      onFocus: chain(props.onFocus, () => setFocusedId(appId)),
      onClick: chain(props.onClick, () => setFocusedId(appId)),
      onDoubleClick: chain(props.onDoubleClick, () => open(appId)),
      onPointerDown: chain<ReactPointerEvent<HTMLElement>>(props.onPointerDown, (event) =>
        onItemPointerDown(appId, event),
      ),
      onPointerMove: chain<ReactPointerEvent<HTMLElement>>(props.onPointerMove, onItemPointerMove),
      onPointerUp: chain<ReactPointerEvent<HTMLElement>>(props.onPointerUp, (event) =>
        endItemDrag(event, true),
      ),
      onPointerCancel: chain<ReactPointerEvent<HTMLElement>>(props.onPointerCancel, (event) =>
        endItemDrag(event, false),
      ),
    });
    return {
      appId,
      title: app.title,
      icon: app.icon,
      active: isActive,
      dragging: drag?.appId === appId,
      dropTarget: drag?.drop === appId,
      getItemProps,
      open: () => open(appId),
    };
  });

  function getListProps(props: FrameProps = {}): FrameProps {
    return {
      ...props,
      role: 'listbox',
      'aria-label': props['aria-label'] ?? 'Desktop icons',
      onKeyDown: chain<ReactKeyboardEvent<HTMLElement>>(props.onKeyDown, onListKeyDown),
    };
  }

  return { icons, activeAppId, getListProps, open };
}
