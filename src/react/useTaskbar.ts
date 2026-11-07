import {
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AppId, ManagerState, TaskbarPosition, WindowId, WindowManager } from '../core/types';
import { useExternalStore } from './externalStore';
import { launchApp } from './launchApp';
import { chain, composeRefs, type FrameControlProps, type FrameProps } from './propHelpers';
import { useManagerSelector } from './useManagerSelector';
import { useWindowManagerContext } from './windowManagerContext';

/** One window in a taskbar item's preview list. */
export interface TaskbarWindow {
  id: WindowId;
  title: string;
  minimized: boolean;
  focused: boolean;
  badge: string | number | null;
  dirty: boolean;
}

/** One app on the taskbar: pinned, running, or both. */
export interface TaskbarItem {
  appId: AppId;
  title: string;
  /** The app's `icon`, as given in its definition. */
  icon: unknown;
  pinned: boolean;
  running: boolean;
  /** True when one of the app's windows has focus. */
  focused: boolean;
  /** True when the app has windows and all of them are minimized. */
  minimized: boolean;
  /** The app's windows on the active desktop in creation order (the preview list). */
  windows: TaskbarWindow[];
}

/** What `useTaskbar` returns. */
export interface UseTaskbarResult {
  position: TaskbarPosition;
  autoHide: boolean;
  /** True while an auto-hiding taskbar is shown (pointer over it, focus in it, or start menu open). */
  revealed: boolean;
  /** True when the taskbar should be tucked away: `autoHide` and not `revealed`. */
  hidden: boolean;
  /** Pinned apps in their order, then running apps that are not pinned. */
  items: TaskbarItem[];
  /**
   * What a click on an item does: open the app when it has no window; with one window, focus it
   * (or minimize it when it already has focus); with several, focus the first one, then cycle
   * through the instances on each click.
   */
  activate(appId: AppId): void;
  focusWindow(windowId: WindowId): void;
  closeWindow(windowId: WindowId): void;
  pin(appId: AppId, index?: number): void;
  unpin(appId: AppId): void;
  setPinnedOrder(appIds: AppId[]): void;
  /** Shows an auto-hiding taskbar (for example from a hot zone at the screen edge). */
  reveal(): void;
  /** Hides it again (unless the start menu is open). */
  conceal(): void;
  /** The toolbar element: role, orientation, roving focus with the arrow keys, auto-hide reveal. */
  getRootProps(props?: FrameProps): FrameProps;
  /** The start button: toggles the start menu. Part of the roving focus. */
  getStartButtonProps(props?: FrameControlProps): FrameControlProps;
  /** The button of an item: click behavior and roving focus. */
  getItemProps(appId: AppId, props?: FrameControlProps): FrameControlProps;
}

function windowNumber(id: WindowId): number {
  const match = /(\d+)$/.exec(id);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

/** The taskbar items for the active desktop. Pure; exported for tests and custom taskbars. */
export function taskbarItems(manager: WindowManager, state: ManagerState): TaskbarItem[] {
  const byApp = new Map<AppId, TaskbarWindow[]>();
  const windows = Object.values(state.windows)
    .filter((win) => win.desktopId === state.activeDesktopId && win.parentId === null)
    .sort((a, b) => windowNumber(a.id) - windowNumber(b.id));
  for (const win of windows) {
    const list = byApp.get(win.appId) ?? [];
    list.push({
      id: win.id,
      title: win.title,
      minimized: win.status === 'minimized',
      focused: isFocusedTree(state, win.id),
      badge: win.badge,
      dirty: win.dirty,
    });
    byApp.set(win.appId, list);
  }
  const appIds = [
    ...state.pinnedApps,
    ...[...byApp.keys()].filter((appId) => !state.pinnedApps.includes(appId)),
  ];
  return appIds.map((appId) => {
    const app = manager.getApp(appId);
    const list = byApp.get(appId) ?? [];
    return {
      appId,
      title: app.title,
      icon: app.icon,
      pinned: state.pinnedApps.includes(appId),
      running: list.length > 0,
      focused: list.some((win) => win.focused),
      minimized: list.length > 0 && list.every((win) => win.minimized),
      windows: list,
    };
  });
}

/** True when `id` or one of its descendants has focus (a focused child counts for its parent). */
function isFocusedTree(state: ManagerState, id: WindowId): boolean {
  let current = state.focusedId;
  while (current !== null) {
    if (current === id) return true;
    current = state.windows[current]?.parentId ?? null;
  }
  return false;
}

const START = 'start';

/**
 * The taskbar: pinned apps, running windows grouped by app, click behavior, position, auto-hide
 * and the roving focus of a toolbar. Auto-hide only reports `hidden`; the component slides it.
 */
export function useTaskbar(): UseTaskbarResult {
  const { manager, stores } = useWindowManagerContext();
  const windows = useManagerSelector((state) => state.windows);
  const focusedId = useManagerSelector((state) => state.focusedId);
  const pinnedApps = useManagerSelector((state) => state.pinnedApps);
  const activeDesktopId = useManagerSelector((state) => state.activeDesktopId);
  const position = useManagerSelector((state) => state.shell.taskbarPosition);
  const autoHide = useManagerSelector((state) => state.shell.taskbarAutoHide);
  const startOpen = useExternalStore(stores.startMenu).open;

  const [hovered, setHovered] = useState(false);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const elements = useRef(new Map<string, HTMLElement>());

  // biome-ignore lint/correctness/useExhaustiveDependencies: the listed slices are what the items are made from; `manager.getState()` is read inside.
  const items = useMemo(
    () => taskbarItems(manager, manager.getState()),
    [manager, windows, focusedId, pinnedApps, activeDesktopId],
  );

  const revealed = !autoHide || hovered || startOpen;

  const actions = useMemo(
    () => ({
      activate(appId: AppId): void {
        const state = manager.getState();
        const item = taskbarItems(manager, state).find((entry) => entry.appId === appId);
        const group = item?.windows ?? [];
        const [only] = group;
        if (only === undefined) {
          launchApp(manager, appId);
        } else if (group.length === 1) {
          if (only.focused && !only.minimized) manager.minimize(only.id);
          else manager.focus(only.id);
        } else {
          const at = group.findIndex((win) => win.focused && !win.minimized);
          const targetId =
            at === -1 ? mostRecent(state, group) : group[(at + 1) % group.length]?.id;
          if (targetId !== undefined) manager.focus(targetId);
        }
      },
      focusWindow: (windowId: WindowId): void => manager.focus(windowId),
      closeWindow: (windowId: WindowId): void => {
        void manager.close(windowId);
      },
      pin: (appId: AppId, index?: number): void => manager.pinApp(appId, index),
      unpin: (appId: AppId): void => manager.unpinApp(appId),
      setPinnedOrder: (appIds: AppId[]): void => manager.setPinnedOrder(appIds),
    }),
    [manager],
  );

  const keys = (): string[] =>
    [...elements.current.entries()]
      .sort(([, a], [, b]) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      )
      .map(([key]) => key);

  /** The button in the tab order, read from the DOM when a key is pressed. */
  const rovingKey = (): string | null => {
    const all = keys();
    return focusedKey !== null && all.includes(focusedKey) ? focusedKey : (all[0] ?? null);
  };
  // Until a button gets focus, the start button (or the first item without one) is the tab stop.
  // This is known while rendering, before the buttons are in the DOM.
  const startRendered = useRef(false);
  startRendered.current = false;

  function onKeyDown(event: ReactKeyboardEvent<HTMLElement>): void {
    const vertical = position === 'left' || position === 'right';
    const previousKey = vertical ? 'ArrowUp' : 'ArrowLeft';
    const nextKey = vertical ? 'ArrowDown' : 'ArrowRight';
    const all = keys();
    const index = all.indexOf(rovingKey() ?? '');
    let target = -1;
    if (event.key === nextKey) target = (index + 1) % all.length;
    else if (event.key === previousKey) target = (index - 1 + all.length) % all.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = all.length - 1;
    const key = all[target];
    if (key === undefined) return;
    event.preventDefault();
    setFocusedKey(key);
    elements.current.get(key)?.focus();
  }

  const register = (key: string) => (node: HTMLElement | null) => {
    if (node) elements.current.set(key, node);
    else elements.current.delete(key);
  };

  function getRootProps(props: FrameProps = {}): FrameProps {
    const vertical = position === 'left' || position === 'right';
    return {
      ...props,
      role: 'toolbar',
      'aria-label': props['aria-label'] ?? 'Taskbar',
      'aria-orientation': vertical ? 'vertical' : 'horizontal',
      'data-taskbar-position': position,
      'data-state': hidden() ? 'hidden' : 'visible',
      onKeyDown: chain<ReactKeyboardEvent<HTMLElement>>(props.onKeyDown, onKeyDown),
      onPointerEnter: chain<ReactPointerEvent<HTMLElement>>(props.onPointerEnter, () =>
        setHovered(true),
      ),
      onPointerLeave: chain<ReactPointerEvent<HTMLElement>>(props.onPointerLeave, () =>
        setHovered(false),
      ),
      onFocus: chain<ReactFocusEvent<HTMLElement>>(props.onFocus, () => setHovered(true)),
      onBlur: chain<ReactFocusEvent<HTMLElement>>(props.onBlur, (event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(false);
      }),
    };
  }

  function hidden(): boolean {
    return autoHide && !revealed;
  }

  function getStartButtonProps(props: FrameControlProps = {}): FrameControlProps {
    startRendered.current = true;
    return {
      ...props,
      ref: composeRefs(register(START), props.ref),
      type: 'button',
      'aria-label': props['aria-label'] ?? 'Start',
      'aria-haspopup': 'dialog',
      'aria-expanded': startOpen,
      tabIndex: focusedKey === null || focusedKey === START ? 0 : -1,
      onFocus: chain(props.onFocus, () => setFocusedKey(START)),
      onClick: chain(props.onClick, () => {
        stores.startMenu.set((previous) => ({ open: !previous.open, search: '' }));
      }),
    };
  }

  function getItemProps(appId: AppId, props: FrameControlProps = {}): FrameControlProps {
    const item = items.find((entry) => entry.appId === appId);
    return {
      ...props,
      ref: composeRefs(register(appId), props.ref),
      type: 'button',
      'aria-label': props['aria-label'] ?? item?.title ?? appId,
      'aria-pressed': item?.focused === true,
      tabIndex:
        focusedKey === appId ||
        (focusedKey === null && !startRendered.current && items[0]?.appId === appId)
          ? 0
          : -1,
      onFocus: chain(props.onFocus, () => setFocusedKey(appId)),
      onClick: chain(props.onClick, () => actions.activate(appId)),
    };
  }

  return {
    position,
    autoHide,
    revealed,
    hidden: hidden(),
    items,
    ...actions,
    reveal: () => setHovered(true),
    conceal: () => setHovered(false),
    getRootProps,
    getStartButtonProps,
    getItemProps,
  };
}

/** The window of `group` that is highest in the paint order. */
function mostRecent(state: ManagerState, group: TaskbarWindow[]): WindowId | undefined {
  return [...state.order].reverse().find((id) => group.some((win) => win.id === id));
}
