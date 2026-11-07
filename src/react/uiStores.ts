import type { Bounds, SnapZone, WindowId } from '../core/types';
import { createExternalStore, type ExternalStore } from './externalStore';
import type { MenuItemModel } from './menuModel';

/** Where a dragged window would land: the zone and the rectangle to preview. */
export type SnapPreviewState = { zone: SnapZone | 'maximize'; bounds: Bounds } | null;

/** The window switcher overlay: shown while the cycle shortcut's modifier is held down. */
export interface SwitcherState {
  open: boolean;
  /** Windows of the desktop, most recently used first, frozen when the switcher opens. */
  ids: WindowId[];
  index: number;
}

/** The start menu: open or closed, and the text typed in its search field. */
export interface StartMenuState {
  open: boolean;
  search: string;
}

/** Menu entries that apps added, for window menus and the desktop menu. */
export interface MenuRegistry {
  windowItems: { key: number; windowId: WindowId; items: MenuItemModel[] }[];
  desktopItems: { key: number; items: MenuItemModel[] }[];
}

/** UI state shared between hooks and components; one set per `WindowManagerProvider`. */
export interface UiStores {
  snapPreview: ExternalStore<SnapPreviewState>;
  switcher: ExternalStore<SwitcherState>;
  startMenu: ExternalStore<StartMenuState>;
  menus: ExternalStore<MenuRegistry>;
}

/** The switcher's closed state. */
export const SWITCHER_CLOSED: SwitcherState = { open: false, ids: [], index: 0 };

/** Creates a fresh set of UI stores. */
export function createUiStores(): UiStores {
  return {
    snapPreview: createExternalStore<SnapPreviewState>(null),
    switcher: createExternalStore<SwitcherState>(SWITCHER_CLOSED),
    startMenu: createExternalStore<StartMenuState>({ open: false, search: '' }),
    menus: createExternalStore<MenuRegistry>({ windowItems: [], desktopItems: [] }),
  };
}
