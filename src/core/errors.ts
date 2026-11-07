/** Reason a window manager call failed. */
export type WindowManagerErrorCode =
  | 'UNKNOWN_APP'
  | 'UNKNOWN_WINDOW'
  | 'UNKNOWN_DESKTOP'
  | 'DUPLICATE_APP'
  | 'MAX_INSTANCES'
  | 'LAST_DESKTOP'
  | 'INVALID_BOUNDS'
  | 'INVALID_SNAPSHOT'
  | 'NO_PROVIDER';

/** Error thrown by the window manager; check `code` to tell causes apart. */
export class WindowManagerError extends Error {
  readonly code: WindowManagerErrorCode;

  constructor(code: WindowManagerErrorCode, message: string) {
    super(message);
    this.name = 'WindowManagerError';
    this.code = code;
  }
}
