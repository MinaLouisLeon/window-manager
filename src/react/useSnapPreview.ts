import { useExternalStore } from './externalStore';
import type { SnapPreviewState } from './uiStores';
import { useWindowManagerContext } from './windowManagerContext';

/**
 * The zone and bounds to preview while a window is dragged near an edge, or null. Drop the
 * window there and it snaps (a drag to the top edge maximizes it).
 */
export function useSnapPreview(): SnapPreviewState {
  const { stores } = useWindowManagerContext();
  return useExternalStore(stores.snapPreview);
}
