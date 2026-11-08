/**
 * Framework-free core of `@integr8-media/window-manager`: `createWindowManager()`, the pure
 * geometry helpers, `localStorageAdapter`, `WindowManagerError` and all types. No React, no DOM,
 * no `@integr8-media/ui`.
 */
export { createWindowManager } from './createWindowManager';
export type { DeepLink } from './deepLinks';
export { buildDeepLink, parseDeepLink } from './deepLinks';
export type { WindowManagerErrorCode } from './errors';
export { WindowManagerError } from './errors';
export {
  boundsForZone,
  cascade,
  clampBounds,
  magnetize,
  SNAP_LAYOUTS,
  workArea,
  zoneAtPoint,
} from './geometry';
export { localStorageAdapter } from './persistence';
export type * from './types';
