import { useMemo } from 'react';
import type { AppId, WindowId, WindowManager } from '../core/types';
import { type ExternalStore, useExternalStore } from './externalStore';
import { SWITCHER_CLOSED, type SwitcherState } from './uiStores';
import { useManagerSelector } from './useManagerSelector';
import { useWindowManagerContext } from './windowManagerContext';

/** Opens the switcher on the next (1) or previous (-1) window, or moves its selection. */
export function cycleSwitcher(
  manager: WindowManager,
  store: ExternalStore<SwitcherState>,
  direction: 1 | -1,
): void {
  const current = store.get();
  if (!current.open) {
    const state = manager.getState();
    const ids = [...state.order]
      .reverse()
      .filter((id) => state.windows[id]?.desktopId === state.activeDesktopId);
    if (ids.length < 2) return;
    // The focused window comes first, so the first press selects the one used before it.
    if (state.focusedId !== null && ids.includes(state.focusedId)) {
      ids.splice(ids.indexOf(state.focusedId), 1);
      ids.unshift(state.focusedId);
    }
    store.set({ open: true, ids, index: direction === 1 ? 1 : ids.length - 1 });
    return;
  }
  const count = current.ids.length;
  store.set({ ...current, index: (current.index + direction + count) % count });
}

/** Closes the switcher and focuses the selected window. */
export function commitSwitcher(manager: WindowManager, store: ExternalStore<SwitcherState>): void {
  const current = store.get();
  if (!current.open) return;
  store.set(SWITCHER_CLOSED);
  const id = current.ids[current.index];
  if (id !== undefined && manager.getState().windows[id] !== undefined) manager.focus(id);
}

/** One window in the switcher list. */
export interface SwitcherWindow {
  id: WindowId;
  title: string;
  appId: AppId;
  /** The app's `icon`, as given in its definition. */
  icon: unknown;
  minimized: boolean;
}

/** What `useWindowSwitcher` returns. */
export interface UseWindowSwitcherResult {
  open: boolean;
  /** The windows of the active desktop, most recently used first (empty while closed). */
  windows: SwitcherWindow[];
  selectedIndex: number;
  selectedId: WindowId | null;
  /** Opens the switcher or moves the selection by one. */
  cycle(direction?: 1 | -1): void;
  /** Selects an entry (for example on hover). */
  select(index: number): void;
  /** Focuses the selected window and closes the switcher. */
  commit(): void;
  /** Closes the switcher without changing focus. */
  cancel(): void;
}

/**
 * The window switcher: it opens while the cycle shortcut (Ctrl+`) is held, with the windows of
 * the active desktop in most-recently-used order; releasing the modifier focuses the selection.
 */
export function useWindowSwitcher(): UseWindowSwitcherResult {
  const { manager, stores } = useWindowManagerContext();
  const switcher = useExternalStore(stores.switcher);
  const windows = useManagerSelector((state) => state.windows);

  const list = useMemo((): SwitcherWindow[] => {
    if (!switcher.open) return [];
    return switcher.ids.flatMap((id) => {
      const win = windows[id];
      if (win === undefined) return [];
      return [
        {
          id,
          title: win.title,
          appId: win.appId,
          icon: manager.getApp(win.appId).icon,
          minimized: win.status === 'minimized',
        },
      ];
    });
  }, [switcher, windows, manager]);

  const actions = useMemo(
    () => ({
      cycle: (direction: 1 | -1 = 1): void => cycleSwitcher(manager, stores.switcher, direction),
      select: (index: number): void => {
        stores.switcher.set((previous) =>
          previous.open && index >= 0 && index < previous.ids.length
            ? { ...previous, index }
            : previous,
        );
      },
      commit: (): void => commitSwitcher(manager, stores.switcher),
      cancel: (): void => stores.switcher.set(SWITCHER_CLOSED),
    }),
    [manager, stores],
  );

  return {
    open: switcher.open,
    windows: list,
    selectedIndex: switcher.index,
    selectedId: switcher.open ? (switcher.ids[switcher.index] ?? null) : null,
    ...actions,
  };
}
