import { WindowManagerError } from '../core/errors';
import type { AppId, WindowId, WindowManager } from '../core/types';

/**
 * Opens a window of `appId`. A single-instance app focuses its window (the manager does that),
 * and an app at its `instances.max` focuses its topmost window instead of throwing.
 */
export function launchApp(manager: WindowManager, appId: AppId): WindowId {
  try {
    return manager.open({ appId });
  } catch (error) {
    if (!(error instanceof WindowManagerError) || error.code !== 'MAX_INSTANCES') throw error;
    const state = manager.getState();
    const topmost = [...state.order]
      .reverse()
      .find((id) => state.windows[id]?.appId === appId) as WindowId;
    manager.focus(topmost);
    return topmost;
  }
}
