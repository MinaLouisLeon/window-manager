import { useEffect, useMemo } from 'react';
import type { ControlsStyle, TaskbarPosition } from '../core/types';
import { useExternalStore } from './externalStore';
import type { MenuItemModel } from './menuModel';
import { useManagerSelector } from './useManagerSelector';
import { useWindowManagerContext } from './windowManagerContext';

let nextRegistrationKey = 1;

const POSITIONS: readonly { value: TaskbarPosition; label: string }[] = [
  { value: 'bottom', label: 'Bottom' },
  { value: 'top', label: 'Top' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

const CONTROL_STYLES: readonly { value: ControlsStyle; label: string }[] = [
  { value: 'windows', label: 'Windows' },
  { value: 'mac', label: 'Mac' },
];

/** What `useDesktopMenu` returns. */
export interface UseDesktopMenuResult {
  /** Default entries followed by the entries apps registered. */
  items: MenuItemModel[];
}

/**
 * The model of the desktop's right-click menu: new desktop, show desktop, arrange icons (by
 * name), taskbar settings (position, auto-hide), window controls style, and any entries apps
 * registered with `useRegisterDesktopMenuItems`. Components turn it into ui menu items.
 */
export function useDesktopMenu(): UseDesktopMenuResult {
  const { manager, stores, shortcuts } = useWindowManagerContext();
  const shell = useManagerSelector((state) => state.shell);
  const iconOrder = useManagerSelector((state) => state.iconOrder);
  const registry = useExternalStore(stores.menus);

  const items = useMemo((): MenuItemModel[] => {
    const list: MenuItemModel[] = [
      {
        type: 'item',
        id: 'new-desktop',
        label: 'New desktop',
        onSelect: () => {
          manager.switchDesktop(manager.addDesktop());
        },
      },
      {
        type: 'item',
        id: 'show-desktop',
        label: 'Show desktop',
        shortcut: shortcuts.showDesktop,
        onSelect: () => manager.showDesktop(),
      },
      { type: 'separator', id: 'separator-icons' },
      {
        type: 'submenu',
        id: 'arrange-icons',
        label: 'Arrange icons',
        disabled: iconOrder.length < 2,
        items: [
          {
            type: 'item',
            id: 'arrange-by-name',
            label: 'By name',
            onSelect: () => {
              const sorted = [...manager.getState().iconOrder].sort((a, b) =>
                manager.getApp(a).title.localeCompare(manager.getApp(b).title),
              );
              manager.setIconOrder(sorted);
            },
          },
        ],
      },
      {
        type: 'submenu',
        id: 'taskbar',
        label: 'Taskbar',
        items: [
          ...POSITIONS.map(
            ({ value, label }): MenuItemModel => ({
              type: 'item',
              id: `taskbar-${value}`,
              label,
              kind: 'radio',
              checked: shell.taskbarPosition === value,
              onSelect: () => manager.setShellSettings({ taskbarPosition: value }),
            }),
          ),
          { type: 'separator', id: 'separator-auto-hide' },
          {
            type: 'item',
            id: 'taskbar-auto-hide',
            label: 'Auto-hide',
            kind: 'checkbox',
            checked: shell.taskbarAutoHide,
            onSelect: () => manager.setShellSettings({ taskbarAutoHide: !shell.taskbarAutoHide }),
          },
        ],
      },
      {
        type: 'submenu',
        id: 'controls-style',
        label: 'Window controls',
        items: CONTROL_STYLES.map(
          ({ value, label }): MenuItemModel => ({
            type: 'item',
            id: `controls-${value}`,
            label,
            kind: 'radio',
            checked: shell.controlsStyle === value,
            onSelect: () => manager.setShellSettings({ controlsStyle: value }),
          }),
        ),
      },
    ];
    const appItems = registry.desktopItems.flatMap((entry) => entry.items);
    if (appItems.length > 0) list.push({ type: 'separator', id: 'separator-app' }, ...appItems);
    return list;
  }, [manager, shell, iconOrder, registry, shortcuts]);

  return { items };
}

/**
 * Adds entries to the desktop menu, after the default ones. They are removed when the component
 * unmounts or `items` changes, so keep the array stable (module constant or `useMemo`).
 */
export function useRegisterDesktopMenuItems(items: MenuItemModel[]): void {
  const { stores } = useWindowManagerContext();
  useEffect(() => {
    const key = nextRegistrationKey;
    nextRegistrationKey += 1;
    stores.menus.set((previous) => ({
      ...previous,
      desktopItems: [...previous.desktopItems, { key, items }],
    }));
    return () => {
      stores.menus.set((previous) => ({
        ...previous,
        desktopItems: previous.desktopItems.filter((entry) => entry.key !== key),
      }));
    };
  }, [stores, items]);
}
