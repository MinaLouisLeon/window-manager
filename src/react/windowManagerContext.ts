import { type ComponentType, type Context, createContext, useContext } from 'react';
import { WindowManagerError } from '../core/errors';
import type { AppId, WindowId, WindowManager } from '../core/types';
import type { ResolvedShortcuts } from './shortcutCombos';
import type { UiStores } from './uiStores';

/** Props every app component receives: the window it is shown in and that window's `data`. */
export interface AppWindowProps<TData = unknown> {
  windowId: WindowId;
  data: TData;
}

/** A component used for a string icon key (for example a lucide icon). */
export type IconComponent = ComponentType<{ className?: string }>;

/** What `WindowManagerProvider` shares with the hooks below it. */
export interface WindowManagerContextValue {
  manager: WindowManager;
  apps: Record<AppId, ComponentType<AppWindowProps>>;
  icons: Record<string, IconComponent>;
  /** Snap preview, window switcher, start menu and registered menu entries. */
  stores: UiStores;
  /** The shortcuts in use (empty when the provider's `shortcuts` is `false`). */
  shortcuts: ResolvedShortcuts;
}

/** Holds the manager, the app components and the icon map. */
export const WindowManagerContext: Context<WindowManagerContextValue | null> =
  createContext<WindowManagerContextValue | null>(null);

/** Holds the id of the window whose content is being rendered (set by `AppWindowContent`). */
export const WindowScopeContext: Context<WindowId | null> = createContext<WindowId | null>(null);

/** The provider's value. Throws `NO_PROVIDER` outside a `WindowManagerProvider`. */
export function useWindowManagerContext(): WindowManagerContextValue {
  const value = useContext(WindowManagerContext);
  if (value === null) {
    throw new WindowManagerError(
      'NO_PROVIDER',
      'Window manager hooks must be used inside a <WindowManagerProvider>.',
    );
  }
  return value;
}
