import { useContext, useMemo } from 'react';
import { WindowManagerError } from '../core/errors';
import type { AppId, OpenOptions, WindowId, WindowState } from '../core/types';
import type { SaveHandler } from './uiStores';
import { useManagerSelector } from './useManagerSelector';
import { useWindowManagerContext, WindowScopeContext } from './windowManagerContext';

/** Who a message goes to: one window or every window of an app. */
export type MessageTarget = { windowId: WindowId } | { appId: AppId };

/** What `useAppWindow` returns. */
export interface UseAppWindowResult<TData = unknown> {
  /** The id of the window this component is shown in. */
  id: WindowId;
  /** The window's state (null only while it is being closed). */
  window: WindowState<TData> | null;
  setTitle(title: string): void;
  setBadge(badge: string | number | null): void;
  setDirty(dirty: boolean): void;
  /** Replaces the window's `data` (saved with the layout), or computes it from the old value. */
  setData(data: TData | ((previous: TData) => TData)): void;
  /** Sets or clears the function that decides whether the window may close. */
  setCloseGuard(guard: (() => boolean | Promise<boolean>) | null): void;
  /**
   * Sets or clears what "Save" does in the close dialog of a window with unsaved changes. Without
   * a handler the dialog only offers "Discard changes" and "Cancel". Return `false` (or throw)
   * when saving failed: the window then stays open. Call it from an effect and clear it on cleanup.
   */
  setSaveHandler(handler: SaveHandler | null): void;
  /** Closes this window; resolves false when a close guard refused. */
  close(options?: { force?: boolean }): Promise<boolean>;
  /** Opens another window. Pass `parentId: id` for a child window (add `modal: true` to block this one). */
  open(options: OpenOptions): WindowId;
  /** Sends a message; listeners get this window's id as the sender. */
  send(target: MessageTarget, message: unknown): void;
  /**
   * Listens for messages sent to this window (or to `target`); returns an unsubscribe function.
   * Meant for effects: `useEffect(() => win.onMessage(handler), [])`.
   */
  onMessage(
    handler: (message: unknown, from: WindowId | null) => void,
    target?: MessageTarget,
  ): () => void;
}

/**
 * For app components: the window they are shown in. Works inside what `AppWindowContent` renders;
 * throws `NO_PROVIDER` anywhere else. The setters do nothing once the window is gone, so they are
 * safe in effect cleanups.
 */
export function useAppWindow<TData = unknown>(): UseAppWindowResult<TData> {
  const { manager, stores } = useWindowManagerContext();
  const windowId = useContext(WindowScopeContext);
  if (windowId === null) {
    throw new WindowManagerError(
      'NO_PROVIDER',
      'useAppWindow must be used inside an app window (rendered by AppWindowContent).',
    );
  }
  const win = useManagerSelector((state) => state.windows[windowId] ?? null);

  const actions = useMemo(() => {
    const alive = (): boolean => manager.getState().windows[windowId] !== undefined;
    return {
      setTitle: (title: string): void => {
        if (alive()) manager.update(windowId, { title });
      },
      setBadge: (badge: string | number | null): void => {
        if (alive()) manager.update(windowId, { badge });
      },
      setDirty: (dirty: boolean): void => {
        if (alive()) manager.update(windowId, { dirty });
      },
      setData: (data: TData | ((previous: TData) => TData)): void => {
        const current = manager.getState().windows[windowId];
        if (!current) return;
        const next =
          typeof data === 'function'
            ? (data as (previous: TData) => TData)(current.data as TData)
            : data;
        manager.update(windowId, { data: next });
      },
      setCloseGuard: (guard: (() => boolean | Promise<boolean>) | null): void => {
        if (alive()) manager.setCloseGuard(windowId, guard);
      },
      setSaveHandler: (handler: SaveHandler | null): void => {
        if (handler === null) stores.saveHandlers.delete(windowId);
        else if (alive()) stores.saveHandlers.set(windowId, handler);
      },
      close: async (options?: { force?: boolean }): Promise<boolean> =>
        alive() ? manager.close(windowId, options) : true,
      open: (options: OpenOptions): WindowId => manager.open(options),
      send: (target: MessageTarget, message: unknown): void =>
        manager.send(target, message, { from: windowId }),
      onMessage: (
        handler: (message: unknown, from: WindowId | null) => void,
        target: MessageTarget = { windowId },
      ): (() => void) => manager.onMessage(target, handler),
    };
  }, [manager, stores, windowId]);

  return { id: windowId, window: win as WindowState<TData> | null, ...actions };
}
