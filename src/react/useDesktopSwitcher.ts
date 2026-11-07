import { useMemo, useState } from 'react';
import type { DesktopId, Wallpaper } from '../core/types';
import { useManagerSelector } from './useManagerSelector';
import { useWindowManagerContext } from './windowManagerContext';

/** One desktop in the switcher list. */
export interface DesktopSwitcherEntry {
  id: DesktopId;
  name: string;
  active: boolean;
  /** Windows on this desktop, children included. */
  windowCount: number;
  wallpaper: Wallpaper | null;
}

/** What `useDesktopSwitcher` returns. */
export interface UseDesktopSwitcherResult {
  desktops: DesktopSwitcherEntry[];
  activeDesktopId: DesktopId;
  /** False while only one desktop is left. */
  canRemove: boolean;
  /** Adds a desktop and, unless `switchTo` is false, switches to it. Returns its id. */
  add(options?: { name?: string; switchTo?: boolean }): DesktopId;
  switchTo(id: DesktopId): void;
  /**
   * Removes a desktop. With `moveWindowsTo` its windows move there; without it they are closed
   * (their close guards run first). Resolves false when a guard refused. Ask the user first when
   * the entry's `windowCount` is above 0.
   */
  remove(id: DesktopId, options?: { moveWindowsTo?: DesktopId }): Promise<boolean>;
  /** The desktop whose name is being edited, or null. */
  editingId: DesktopId | null;
  startRename(id: DesktopId): void;
  /** Saves the new name (an empty name keeps the old one) and ends editing. */
  commitRename(name: string): void;
  cancelRename(): void;
}

/** Add, rename, remove (with the move-windows choice) and switch desktops. */
export function useDesktopSwitcher(): UseDesktopSwitcherResult {
  const { manager } = useWindowManagerContext();
  const desktops = useManagerSelector((state) => state.desktops);
  const activeDesktopId = useManagerSelector((state) => state.activeDesktopId);
  const windows = useManagerSelector((state) => state.windows);
  const [editingId, setEditingId] = useState<DesktopId | null>(null);

  const entries = useMemo((): DesktopSwitcherEntry[] => {
    const counts = new Map<DesktopId, number>();
    for (const win of Object.values(windows)) {
      counts.set(win.desktopId, (counts.get(win.desktopId) ?? 0) + 1);
    }
    return desktops.map((desktop) => ({
      id: desktop.id,
      name: desktop.name,
      active: desktop.id === activeDesktopId,
      windowCount: counts.get(desktop.id) ?? 0,
      wallpaper: desktop.wallpaper,
    }));
  }, [desktops, windows, activeDesktopId]);

  return {
    desktops: entries,
    activeDesktopId,
    canRemove: desktops.length > 1,
    add(options) {
      const id = manager.addDesktop(options?.name);
      if (options?.switchTo !== false) manager.switchDesktop(id);
      return id;
    },
    switchTo: (id) => manager.switchDesktop(id),
    remove: (id, options) => manager.removeDesktop(id, options),
    editingId,
    startRename: (id) => setEditingId(id),
    commitRename(name) {
      const id = editingId;
      setEditingId(null);
      const trimmed = name.trim();
      if (id !== null && trimmed !== '' && manager.getState().desktops.some((d) => d.id === id)) {
        manager.renameDesktop(id, trimmed);
      }
    },
    cancelRename: () => setEditingId(null),
  };
}
