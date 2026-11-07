import { type ComponentType, type ReactElement, type ReactNode, useMemo, useState } from 'react';
import type { AppId, WindowId, WindowManager } from '../core/types';
import { resolveShortcuts, type ShortcutOptions } from './shortcutCombos';
import { createUiStores } from './uiStores';
import { useManagerSelector } from './useManagerSelector';
import { useShortcuts } from './useShortcuts';
import {
  type AppWindowProps,
  type IconComponent,
  useWindowManagerContext,
  WindowManagerContext,
  WindowScopeContext,
} from './windowManagerContext';

const NO_ICONS: Record<string, IconComponent> = {};

/** Props of `WindowManagerProvider`. */
export interface WindowManagerProviderProps {
  /** The manager made with `createWindowManager`. The provider never destroys it. */
  manager: WindowManager;
  /** The content of each app's windows, by app id. */
  apps: Record<AppId, ComponentType<AppWindowProps>>;
  /** Components for the string icon keys used in app definitions (for example lucide icons). */
  icons?: Record<string, IconComponent>;
  /**
   * The keyboard shortcuts: leave it out for the defaults, pass overrides (a combo, or `false` to
   * turn one off), or pass `false` for none (then call `useShortcuts` yourself if you want some).
   */
  shortcuts?: ShortcutOptions | false;
  children?: ReactNode;
}

/** Registers the shortcuts; renders nothing. */
function ShortcutsHost({ options }: { options: ShortcutOptions | undefined }): null {
  useShortcuts(options);
  return null;
}

/**
 * Gives every hook below it the window manager, the app components and the icon map, and
 * registers the keyboard shortcuts. Keep the `apps` and `icons` objects stable (define them
 * outside the component or memoize them).
 */
export function WindowManagerProvider({
  manager,
  apps,
  icons,
  shortcuts,
  children,
}: WindowManagerProviderProps): ReactElement {
  const [stores] = useState(createUiStores);
  const shortcutKey = JSON.stringify(shortcuts ?? null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `shortcutKey` stands for `shortcuts`, which is often an inline object.
  const resolved = useMemo(
    () => (shortcuts === false ? {} : resolveShortcuts(shortcuts)),
    [shortcutKey],
  );
  const value = useMemo(
    () => ({ manager, apps, icons: icons ?? NO_ICONS, stores, shortcuts: resolved }),
    [manager, apps, icons, stores, resolved],
  );
  return (
    <WindowManagerContext value={value}>
      {shortcuts === false ? null : <ShortcutsHost options={shortcuts} />}
      {children}
    </WindowManagerContext>
  );
}

/**
 * Renders the app component of one window (with its `data`) and makes `useAppWindow` work inside
 * it. Renders nothing while the window is minimized, on another desktop or closed, so the content
 * is unmounted then: apps keep what they need in their own stores or in the window's `data`.
 */
export function AppWindowContent({ windowId }: { windowId: WindowId }): ReactElement | null {
  const { apps } = useWindowManagerContext();
  const win = useManagerSelector((state) => state.windows[windowId] ?? null);
  const visible = useManagerSelector((state) => {
    const found = state.windows[windowId];
    return (
      found !== undefined &&
      found.status !== 'minimized' &&
      found.desktopId === state.activeDesktopId
    );
  });
  if (win === null || !visible) return null;
  const Content = apps[win.appId];
  if (Content === undefined) return null;
  return (
    <WindowScopeContext value={windowId}>
      <Content windowId={windowId} data={win.data} />
    </WindowScopeContext>
  );
}
