import { SNAP_LAYOUTS } from '../core/geometry';
import type { SnapZone, WindowId } from '../core/types';
import { useManagerSelector } from './useManagerSelector';
import { useWindowManagerContext } from './windowManagerContext';

/** Labels of the snap layouts, by layout id. */
export const SNAP_LAYOUT_LABELS: Readonly<Record<string, string>> = {
  halves: 'Halves',
  quarters: 'Quarters',
  thirds: 'Thirds',
  'two-thirds-left': 'Two thirds and a third',
  'two-thirds-right': 'A third and two thirds',
};

/** One snap layout: the zones that tile the work area. */
export interface SnapLayoutEntry {
  id: string;
  label: string;
  zones: SnapZone[];
}

/** What `useSnapLayouts` returns. */
export interface UseSnapLayoutsResult {
  /** Every layout, for the menu on the maximize button. */
  layouts: SnapLayoutEntry[];
  /** False for fixed-size apps, fullscreen windows and closed windows: nothing can be applied. */
  available: boolean;
  /** The zone the window is snapped to now, or null. */
  snap: SnapZone | null;
  /** Snaps the window to `zone` of the layout `layoutId`. Ignored for a zone the layout lacks. */
  apply(layoutId: string, zone: SnapZone): void;
}

const LAYOUTS: SnapLayoutEntry[] = SNAP_LAYOUTS.map((layout) => ({
  id: layout.id,
  label: SNAP_LAYOUT_LABELS[layout.id] ?? layout.id,
  zones: layout.zones,
}));

/**
 * The snap layouts and an `apply(layoutId, zone)` action for one window: the model of the menu
 * that opens on the maximize button. The layouts are the same for every window.
 */
export function useSnapLayouts(id: WindowId): UseSnapLayoutsResult {
  const { manager } = useWindowManagerContext();
  const win = useManagerSelector((state) => state.windows[id] ?? null);
  const available =
    win !== null &&
    win.status !== 'fullscreen' &&
    manager.getApp(win.appId).size?.resizable !== false;

  return {
    layouts: LAYOUTS,
    available,
    snap: win?.snap ?? null,
    apply(layoutId, zone) {
      const layout = SNAP_LAYOUTS.find((entry) => entry.id === layoutId);
      if (!layout?.zones.includes(zone) || !available) return;
      manager.snap(id, zone);
    },
  };
}
