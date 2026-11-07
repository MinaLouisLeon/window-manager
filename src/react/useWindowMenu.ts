import { useContext, useEffect, useMemo } from 'react';
import { WindowManagerError } from '../core/errors';
import type { SnapZone, WindowId } from '../core/types';
import { useExternalStore } from './externalStore';
import type { MenuItemModel } from './menuModel';
import { useManagerSelector } from './useManagerSelector';
import { useWindowManagerContext, WindowScopeContext } from './windowManagerContext';

let nextRegistrationKey = 1;

/** The snap zones in the order the window menu lists them, with their labels. */
export const SNAP_ZONE_LABELS: readonly { zone: SnapZone; label: string }[] = [
  { zone: 'left', label: 'Left half' },
  { zone: 'right', label: 'Right half' },
  { zone: 'top-left', label: 'Top left' },
  { zone: 'top-right', label: 'Top right' },
  { zone: 'bottom-left', label: 'Bottom left' },
  { zone: 'bottom-right', label: 'Bottom right' },
  { zone: 'left-third', label: 'Left third' },
  { zone: 'center-third', label: 'Center third' },
  { zone: 'right-third', label: 'Right third' },
  { zone: 'left-two-thirds', label: 'Left two thirds' },
  { zone: 'right-two-thirds', label: 'Right two thirds' },
];

/** Options of `useWindowMenu`. */
export interface UseWindowMenuOptions {
  /** Called by the "Move" entry (pass the frame's `startKeyboardMove`). Without it, no entry. */
  onMove?: () => void;
  /** Called by the "Resize" entry (pass the frame's `startKeyboardResize`). Without it, no entry. */
  onResize?: () => void;
}

/** What `useWindowMenu` returns. */
export interface UseWindowMenuResult {
  /** Default entries followed by the entries apps registered for this window. */
  items: MenuItemModel[];
}

/**
 * The model of a window's menu: minimize, maximize or restore, snap (every zone), always on top,
 * fullscreen, move to desktop, move, resize, any entries the window's app registered with
 * `useRegisterWindowMenuItems`, and close. Components turn it into ui menu items.
 */
export function useWindowMenu(
  id: WindowId,
  options: UseWindowMenuOptions = {},
): UseWindowMenuResult {
  const { manager, stores, shortcuts } = useWindowManagerContext();
  const win = useManagerSelector((state) => state.windows[id] ?? null);
  const desktops = useManagerSelector((state) => state.desktops);
  const registry = useExternalStore(stores.menus);
  const { onMove, onResize } = options;

  const items = useMemo((): MenuItemModel[] => {
    if (win === null) return [];
    const resizable = manager.getApp(win.appId).size?.resizable !== false;
    const restorable = win.status === 'maximized' || win.snap !== null;
    const list: MenuItemModel[] = [
      {
        type: 'item',
        id: 'minimize',
        label: 'Minimize',
        shortcut: shortcuts.minimizeWindow,
        disabled: win.status === 'minimized',
        onSelect: () => manager.minimize(id),
      },
      restorable
        ? {
            type: 'item',
            id: 'restore',
            label: 'Restore',
            shortcut: shortcuts.toggleMaximize,
            onSelect: () => manager.restore(id),
          }
        : {
            type: 'item',
            id: 'maximize',
            label: 'Maximize',
            shortcut: shortcuts.toggleMaximize,
            disabled: !resizable || win.status === 'fullscreen',
            onSelect: () => manager.maximize(id),
          },
      {
        type: 'submenu',
        id: 'snap',
        label: 'Snap',
        disabled: !resizable || win.status === 'fullscreen',
        items: SNAP_ZONE_LABELS.map(({ zone, label }) => ({
          type: 'item' as const,
          id: `snap-${zone}`,
          label,
          kind: 'radio' as const,
          checked: win.snap === zone,
          shortcut:
            zone === 'left'
              ? shortcuts.snapLeft
              : zone === 'right'
                ? shortcuts.snapRight
                : undefined,
          onSelect: () => manager.snap(id, zone),
        })),
      },
      { type: 'separator', id: 'separator-state' },
      {
        type: 'item',
        id: 'always-on-top',
        label: 'Always on top',
        kind: 'checkbox',
        checked: win.alwaysOnTop,
        shortcut: shortcuts.toggleAlwaysOnTop,
        onSelect: () => manager.setAlwaysOnTop(id, !win.alwaysOnTop),
      },
      {
        type: 'item',
        id: 'fullscreen',
        label: 'Fullscreen',
        kind: 'checkbox',
        checked: win.status === 'fullscreen',
        shortcut: shortcuts.toggleFullscreen,
        onSelect: () => manager.setFullscreen(id, win.status !== 'fullscreen'),
      },
    ];
    if (desktops.length > 1 && win.parentId === null) {
      list.push({
        type: 'submenu',
        id: 'move-to-desktop',
        label: 'Move to desktop',
        items: desktops.map((desktop) => ({
          type: 'item' as const,
          id: `desktop-${desktop.id}`,
          label: desktop.name,
          kind: 'radio' as const,
          checked: desktop.id === win.desktopId,
          onSelect: () => manager.moveToDesktop(id, desktop.id),
        })),
      });
    }
    if (onMove || onResize) {
      list.push({ type: 'separator', id: 'separator-keyboard' });
      if (onMove) {
        list.push({
          type: 'item',
          id: 'move',
          label: 'Move',
          disabled: win.status !== 'normal',
          onSelect: onMove,
        });
      }
      if (onResize) {
        list.push({
          type: 'item',
          id: 'resize',
          label: 'Resize',
          disabled: win.status !== 'normal' || !resizable,
          onSelect: onResize,
        });
      }
    }
    const appItems = registry.windowItems
      .filter((entry) => entry.windowId === id)
      .flatMap((entry) => entry.items);
    if (appItems.length > 0) {
      list.push({ type: 'separator', id: 'separator-app' }, ...appItems);
    }
    list.push(
      { type: 'separator', id: 'separator-close' },
      {
        type: 'item',
        id: 'close',
        label: 'Close',
        shortcut: shortcuts.closeWindow,
        destructive: true,
        onSelect: () => {
          void manager.close(id);
        },
      },
    );
    return list;
  }, [win, desktops, registry, shortcuts, manager, id, onMove, onResize]);

  return { items };
}

/**
 * Adds entries to the menu of the window this component is shown in (call it from an app
 * component). They appear after the default entries and are removed when the component unmounts
 * or `items` changes, so keep the array stable (module constant or `useMemo`).
 */
export function useRegisterWindowMenuItems(items: MenuItemModel[]): void {
  const { stores } = useWindowManagerContext();
  const windowId = useContext(WindowScopeContext);
  if (windowId === null) {
    throw new WindowManagerError(
      'NO_PROVIDER',
      'useRegisterWindowMenuItems must be used inside an app window (rendered by AppWindowContent).',
    );
  }
  useEffect(() => {
    const key = nextRegistrationKey;
    nextRegistrationKey += 1;
    stores.menus.set((previous) => ({
      ...previous,
      windowItems: [...previous.windowItems, { key, windowId, items }],
    }));
    return () => {
      stores.menus.set((previous) => ({
        ...previous,
        windowItems: previous.windowItems.filter((entry) => entry.key !== key),
      }));
    };
  }, [stores, windowId, items]);
}
