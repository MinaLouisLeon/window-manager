/**
 * Framework-free core of `@integr8-media/window-manager`: `createWindowManager()`, the pure
 * geometry helpers, `localStorageAdapter`, `WindowManagerError` and all types. No React, no DOM,
 * no `@integr8-media/ui`. The public API is added milestone by milestone (M1 to M5).
 */
export { createWindowManager } from './createWindowManager';
export type { WindowManagerErrorCode } from './errors';
export { WindowManagerError } from './errors';
export { cascade, clampBounds, workArea } from './geometry';
export type * from './types';
