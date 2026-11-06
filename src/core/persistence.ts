import { WindowManagerError } from './errors';
import type { LayoutSnapshot, LayoutStorage } from './types';

const DEFAULT_KEY = 'integr8-wm-layout';

const STATUSES = ['normal', 'minimized', 'maximized', 'fullscreen'];
const ZONES = [
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'left-third',
  'center-third',
  'right-third',
  'left-two-thirds',
  'right-two-thirds',
];
const POSITIONS = ['bottom', 'top', 'left', 'right'];
const CONTROLS = ['windows', 'mac'];
const FITS = ['cover', 'contain', 'center'];

/** The part of the browser storage API the adapter needs. */
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function invalid(message: string): never {
  throw new WindowManagerError('INVALID_SNAPSHOT', `Invalid layout snapshot: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isBounds(value: unknown): boolean {
  return (
    isRecord(value) &&
    ['x', 'y', 'width', 'height'].every(
      (key) => typeof value[key] === 'number' && Number.isFinite(value[key]),
    ) &&
    (value.width as number) > 0 &&
    (value.height as number) > 0
  );
}

function checkStrings(value: unknown, what: string): void {
  if (!Array.isArray(value) || !value.every(isString)) {
    invalid(`${what} must be a list of strings.`);
  }
}

function checkWallpaper(value: unknown, where: string): void {
  if (value === null) return;
  if (!isRecord(value)) invalid(`${where} wallpaper is not an object.`);
  const record = value as Record<string, unknown>;
  const ok =
    record.type === 'theme' ||
    ((record.type === 'color' || record.type === 'gradient') && isString(record.value)) ||
    (record.type === 'image' &&
      isString(record.url) &&
      (record.fit === undefined || FITS.includes(record.fit as string)));
  if (!ok) invalid(`${where} wallpaper is not valid.`);
}

function checkWindow(value: unknown, index: number): void {
  const where = `window ${index}`;
  if (!isRecord(value)) invalid(`${where} is not an object.`);
  if (!isString(value.id) || !isString(value.appId) || !isString(value.desktopId)) {
    invalid(`${where} needs string id, appId and desktopId.`);
  }
  if (!isString(value.title)) invalid(`${where} needs a string title.`);
  if (!isBounds(value.bounds)) invalid(`${where} has invalid bounds.`);
  if (value.restoreBounds !== null && !isBounds(value.restoreBounds)) {
    invalid(`${where} has invalid restoreBounds.`);
  }
  if (!STATUSES.includes(value.status as string)) invalid(`${where} has an unknown status.`);
  if (value.snap !== null && !ZONES.includes(value.snap as string)) {
    invalid(`${where} has an unknown snap zone.`);
  }
  if (typeof value.z !== 'number' || !Number.isFinite(value.z)) {
    invalid(`${where} needs a number z.`);
  }
  if (typeof value.alwaysOnTop !== 'boolean' || typeof value.modal !== 'boolean') {
    invalid(`${where} needs boolean alwaysOnTop and modal.`);
  }
  if (typeof value.dirty !== 'boolean') invalid(`${where} needs a boolean dirty.`);
  if (value.parentId !== null && !isString(value.parentId)) {
    invalid(`${where} has a bad parentId.`);
  }
  const badge = value.badge;
  if (badge !== null && !isString(badge) && typeof badge !== 'number') {
    invalid(`${where} has a bad badge.`);
  }
}

/**
 * Checks that `value` has the shape of a version 1 `LayoutSnapshot` and returns it.
 * Throws `INVALID_SNAPSHOT` for another version or a broken shape.
 */
export function parseSnapshot(value: unknown): LayoutSnapshot {
  if (!isRecord(value)) return invalid('not an object.');
  if (value.version !== 1) invalid(`unsupported version ${String(value.version)}.`);

  if (!Array.isArray(value.desktops) || value.desktops.length === 0) {
    invalid('desktops must be a non-empty list.');
  }
  const desktopIds = new Set<string>();
  value.desktops.forEach((desktop: unknown, index: number) => {
    if (!isRecord(desktop) || !isString(desktop.id) || !isString(desktop.name)) {
      invalid(`desktop ${index} needs a string id and name.`);
    }
    if (desktopIds.has(desktop.id)) invalid(`duplicate desktop id "${desktop.id}".`);
    desktopIds.add(desktop.id);
    checkWallpaper(desktop.wallpaper ?? null, `desktop ${index}`);
  });
  if (!isString(value.activeDesktopId)) invalid('activeDesktopId must be a string.');

  if (!Array.isArray(value.windows)) invalid('windows must be a list.');
  const parents = new Map<string, string | null>();
  value.windows.forEach((win: unknown, index: number) => {
    checkWindow(win, index);
    const record = win as Record<string, unknown>;
    const id = record.id as string;
    if (parents.has(id)) invalid(`duplicate window id "${id}".`);
    parents.set(id, record.parentId as string | null);
  });
  for (const [id, parent] of parents) {
    let current = parent;
    for (let steps = 0; current !== null && steps <= parents.size; steps += 1) {
      if (current === id) invalid(`window "${id}" is its own ancestor.`);
      current = parents.get(current) ?? null;
    }
  }

  checkStrings(value.iconOrder, 'iconOrder');
  checkStrings(value.pinnedApps, 'pinnedApps');
  const shell = value.shell;
  if (
    !isRecord(shell) ||
    !POSITIONS.includes(shell.taskbarPosition as string) ||
    typeof shell.taskbarAutoHide !== 'boolean' ||
    !CONTROLS.includes(shell.controlsStyle as string)
  ) {
    invalid('shell settings are not valid.');
  }
  const from = value.minimizedFrom;
  const restorable = ['normal', 'maximized', 'fullscreen'];
  if (
    from !== undefined &&
    (!isRecord(from) ||
      !Object.values(from).every((status) => restorable.includes(status as string)))
  ) {
    invalid('minimizedFrom is not valid.');
  }
  return value as unknown as LayoutSnapshot;
}

/**
 * A storage adapter that keeps the layout as JSON in the browser's local storage under `key`
 * (default `'integr8-wm-layout'`). It does nothing where no local storage exists, and a failed
 * write (full quota, private mode) is ignored. Unparseable stored text throws `INVALID_SNAPSHOT`
 * from `load`.
 */
export function localStorageAdapter(key: string = DEFAULT_KEY): LayoutStorage {
  function store(): StorageLike | null {
    try {
      return (globalThis as { localStorage?: StorageLike }).localStorage ?? null;
    } catch {
      return null;
    }
  }
  return {
    load(): LayoutSnapshot | null {
      const raw = store()?.getItem(key) ?? null;
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as LayoutSnapshot;
      } catch {
        return invalid('stored text is not valid JSON.');
      }
    },
    save(snapshot: LayoutSnapshot): void {
      try {
        store()?.setItem(key, JSON.stringify(snapshot));
      } catch {
        // Storage is full or blocked: the layout is simply not saved this time.
      }
    },
  };
}
