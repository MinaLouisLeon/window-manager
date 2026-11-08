import { useMemo } from 'react';
import type { TrayItem } from '../core/types';
import { useManagerSelector } from './useManagerSelector';
import { useWindowManagerContext } from './windowManagerContext';

/** What `useTray` returns. */
export interface UseTrayResult {
  /** The tray items, sorted by `order` (items without one come last, in registration order). */
  items: TrayItem[];
  /** Adds (or replaces) an item; returns a function that removes it again. */
  register(item: TrayItem): () => void;
  /** Changes an item (an unknown id is ignored). */
  update(id: string, patch: Partial<TrayItem>): void;
}

/** The items of the notification area, and the actions to add and change them. */
export function useTray(): UseTrayResult {
  const { manager } = useWindowManagerContext();
  const tray = useManagerSelector((state) => state.tray);
  const items = useMemo(
    () =>
      tray
        .map((item, index) => ({ item, index }))
        .sort(
          (a, b) =>
            (a.item.order ?? Number.POSITIVE_INFINITY) -
              (b.item.order ?? Number.POSITIVE_INFINITY) || a.index - b.index,
        )
        .map(({ item }) => item),
    [tray],
  );
  return {
    items,
    register: (item) => manager.registerTrayItem(item),
    update: (id, patch) => manager.updateTrayItem(id, patch),
  };
}
