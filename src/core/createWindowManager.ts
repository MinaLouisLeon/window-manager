import { buildDeepLink, parseDeepLink } from './deepLinks';
import { WindowManagerError } from './errors';
import { boundsForZone, cascade, clampBounds, workArea } from './geometry';
import { createMessageBus } from './messaging';
import { parseSnapshot } from './persistence';
import type {
  AppDefinition,
  AppId,
  Bounds,
  Desktop,
  DesktopId,
  EventPayload,
  Insets,
  LayoutSnapshot,
  ManagerState,
  OpenOptions,
  Point,
  ShellSettings,
  Size,
  WindowId,
  WindowManager,
  WindowManagerEvent,
  WindowManagerOptions,
  WindowState,
  WindowStatus,
} from './types';

const DEFAULT_SIZE: Size = { width: 800, height: 600 };
const DEFAULT_MIN: Size = { width: 240, height: 160 };
/** Used until the surface reports its size with `setViewport`. */
const DEFAULT_VIEWPORT: Size = { width: 1024, height: 768 };
const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

type RestorableStatus = Exclude<WindowStatus, 'minimized'>;
type Guard = () => boolean | Promise<boolean>;

function boundsEqual(a: Bounds | null, b: Bounds | null): boolean {
  if (a === null || b === null) return a === b;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** Compares two versions of a window; `z` alone counts as 'z', anything else as 'changed'. */
function windowDiff(a: WindowState, b: WindowState): 'same' | 'z' | 'changed' {
  for (const key of Object.keys(a) as (keyof WindowState)[]) {
    if (key === 'z') continue;
    if (key === 'bounds') {
      if (!boundsEqual(a.bounds, b.bounds)) return 'changed';
    } else if (key === 'restoreBounds') {
      if (!boundsEqual(a.restoreBounds, b.restoreBounds)) return 'changed';
    } else if (!Object.is(a[key], b[key])) {
      return 'changed';
    }
  }
  return a.z === b.z ? 'same' : 'z';
}

function sameSize(a: Size, b: Size): boolean {
  return a.width === b.width && a.height === b.height;
}

function sameInsets(a: Insets, b: Insets): boolean {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}

function sameShell(a: ShellSettings, b: ShellSettings): boolean {
  return (
    a.taskbarPosition === b.taskbarPosition &&
    a.taskbarAutoHide === b.taskbarAutoHide &&
    a.controlsStyle === b.controlsStyle
  );
}

function assertFinite(values: Record<string, number | undefined>, message: string): void {
  for (const value of Object.values(values)) {
    if (value !== undefined && !Number.isFinite(value)) {
      throw new WindowManagerError('INVALID_BOUNDS', message);
    }
  }
}

function assertPositiveSize(width: number | undefined, height: number | undefined): void {
  if ((width !== undefined && width <= 0) || (height !== undefined && height <= 0)) {
    throw new WindowManagerError('INVALID_BOUNDS', 'Width and height must be greater than 0.');
  }
}

/** The ids below `id` (children, then their children), without `id` itself. */
function descendantsOf(windows: Record<WindowId, WindowState>, id: WindowId): WindowId[] {
  const queue: WindowId[] = [id];
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i];
    for (const win of Object.values(windows)) {
      if (win.parentId === current) queue.push(win.id);
    }
  }
  return queue.slice(1);
}

/**
 * Creates a window manager: the store behind every window, plus the rules that keep it
 * consistent. Framework-free; the React layer subscribes to it with `useSyncExternalStore`.
 */
export function createWindowManager(options: WindowManagerOptions): WindowManager {
  const apps = new Map<AppId, AppDefinition>();
  for (const app of options.apps) {
    if (apps.has(app.id)) {
      throw new WindowManagerError('DUPLICATE_APP', `Duplicate app id "${app.id}".`);
    }
    apps.set(app.id, app);
  }
  const minVisibleTitleBar = options.minVisibleTitleBar ?? 48;
  const cascadeOffset = options.cascadeOffset ?? 24;

  const desktops: Desktop[] = (
    options.desktops && options.desktops.length > 0 ? options.desktops : [{ name: 'Desktop 1' }]
  ).map((desktop, index) => ({
    id: desktop.id ?? `desktop-${index + 1}`,
    name: desktop.name,
    wallpaper: desktop.wallpaper ?? null,
  }));
  const firstDesktop = desktops[0] as Desktop;

  let state: ManagerState = {
    windows: {},
    order: [],
    focusedId: null,
    desktops,
    activeDesktopId: firstDesktop.id,
    viewport: DEFAULT_VIEWPORT,
    insets: NO_INSETS,
    showingDesktop: false,
    iconOrder: options.apps.filter((app) => app.placement?.desktop !== false).map((app) => app.id),
    pinnedApps: options.apps.filter((app) => app.placement?.pinned === true).map((app) => app.id),
    shell: {
      taskbarPosition: 'bottom',
      taskbarAutoHide: false,
      controlsStyle: 'windows',
      ...options.shell,
    },
    tray: [],
    notifications: [],
  };

  let nextWindowNumber = 1;
  const listeners = new Set<(next: ManagerState) => void>();
  const handlers = new Map<WindowManagerEvent, Set<(payload: never) => void>>();
  const guards = new Map<WindowId, Guard>();
  /** Status a minimized window returns to. */
  const statusBeforeMinimize = new Map<WindowId, RestorableStatus>();
  /** Windows that went fullscreen from maximized; leaving fullscreen returns them there. */
  const maximizedBeforeFullscreen = new Set<WindowId>();
  /** Most recently focused first. */
  let recent: WindowId[] = [];
  let nextDesktopNumber = desktops.length + 1;
  const bus = createMessageBus();
  /** False until `setViewport` ran; a layout restored before that is fitted by the first call. */
  let viewportSet = false;
  /** Per desktop: the windows `showDesktop(true)` minimized and the window that had focus. */
  const showing = new Map<DesktopId, { ids: WindowId[]; focus: WindowId | null }>();

  // ---------- helpers ----------

  function needDesktop(draft: ManagerState, id: DesktopId): Desktop {
    const desktop = draft.desktops.find((entry) => entry.id === id);
    if (!desktop) throw new WindowManagerError('UNKNOWN_DESKTOP', `Unknown desktop "${id}".`);
    return desktop;
  }

  function checkApps(appIds: AppId[]): AppId[] {
    for (const appId of appIds) getApp(appId);
    return [...new Set(appIds)];
  }

  /** `first`, then the entries of `current` it does not mention, in their current order. */
  function withRest(first: AppId[], current: readonly AppId[]): AppId[] {
    return [...first, ...current.filter((appId) => !first.includes(appId))];
  }

  function sameList(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((value, i) => value === b[i]);
  }

  function getApp(appId: AppId): AppDefinition {
    const app = apps.get(appId);
    if (!app) throw new WindowManagerError('UNKNOWN_APP', `Unknown app "${appId}".`);
    return app;
  }

  function need(draft: ManagerState, id: WindowId): WindowState {
    const win = draft.windows[id];
    if (!win) throw new WindowManagerError('UNKNOWN_WINDOW', `Unknown window "${id}".`);
    return win;
  }

  function begin(): ManagerState {
    return { ...state, windows: { ...state.windows }, order: [...state.order] };
  }

  function emit<E extends WindowManagerEvent>(event: E, payload: EventPayload<E>): void {
    const set = handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      (handler as (payload: EventPayload<E>) => void)(payload);
    }
  }

  function rulesFor(app: AppDefinition): {
    min: Size;
    max?: Size;
    minVisibleTitleBar: number;
  } {
    const max = app.size?.max;
    return {
      min: app.size?.min ?? DEFAULT_MIN,
      ...(max ? { max } : {}),
      minVisibleTitleBar,
    };
  }

  function isResizable(win: WindowState): boolean {
    return getApp(win.appId).size?.resizable !== false;
  }

  function areaOf(draft: ManagerState): Bounds {
    return workArea(draft.viewport, draft.insets);
  }

  function fullViewport(draft: ManagerState): Bounds {
    return { x: 0, y: 0, width: draft.viewport.width, height: draft.viewport.height };
  }

  function clampWindowBounds(draft: ManagerState, win: WindowState, bounds: Bounds): Bounds {
    return clampBounds(bounds, areaOf(draft), rulesFor(getApp(win.appId)));
  }

  /** Puts the always-on-top layer last and compacts `z` inside each layer. */
  function normalize(draft: ManagerState): void {
    const normalIds: WindowId[] = [];
    const topIds: WindowId[] = [];
    for (const id of draft.order) {
      const win = draft.windows[id];
      if (win) (win.alwaysOnTop ? topIds : normalIds).push(id);
    }
    draft.order = [...normalIds, ...topIds];
    for (const layer of [normalIds, topIds]) {
      layer.forEach((id, z) => {
        const win = draft.windows[id];
        if (win && win.z !== z) draft.windows[id] = { ...win, z };
      });
    }
    if (draft.focusedId !== null && !draft.windows[draft.focusedId]) draft.focusedId = null;
  }

  function commit(next: ManagerState): void {
    const prev = state;
    normalize(next);
    for (const desktopId of [...showing.keys()]) {
      if (!next.desktops.some((desktop) => desktop.id === desktopId)) showing.delete(desktopId);
    }
    next.showingDesktop = showing.has(next.activeDesktopId);

    const closed = prev.order.filter((id) => !next.windows[id]);
    const opened = next.order.filter((id) => !prev.windows[id]);
    const changed: WindowId[] = [];
    let anyDiff = closed.length > 0 || opened.length > 0;
    for (const id of next.order) {
      const before = prev.windows[id];
      const after = next.windows[id];
      if (!before || !after) continue;
      const diff = windowDiff(before, after);
      if (diff === 'changed') changed.push(id);
      if (diff !== 'same') anyDiff = true;
    }
    const focusChanged = prev.focusedId !== next.focusedId;
    const desktopChanged = prev.activeDesktopId !== next.activeDesktopId;
    const shellChanged = !sameShell(prev.shell, next.shell);
    const orderChanged =
      prev.order.length !== next.order.length || prev.order.some((id, i) => id !== next.order[i]);
    if (
      !anyDiff &&
      !focusChanged &&
      !desktopChanged &&
      !shellChanged &&
      !orderChanged &&
      prev.desktops === next.desktops &&
      prev.iconOrder === next.iconOrder &&
      prev.pinnedApps === next.pinnedApps &&
      prev.showingDesktop === next.showingDesktop &&
      sameSize(prev.viewport, next.viewport) &&
      sameInsets(prev.insets, next.insets)
    ) {
      return;
    }

    recent = recent.filter((id) => next.windows[id] !== undefined);
    if (focusChanged && next.focusedId !== null) {
      recent = [next.focusedId, ...recent.filter((id) => id !== next.focusedId)];
    }
    for (const id of closed) {
      guards.delete(id);
      bus.dropWindow(id);
      statusBeforeMinimize.delete(id);
      maximizedBeforeFullscreen.delete(id);
    }

    state = next;
    if (persistedChanged(prev, next)) scheduleSave();
    for (const listener of [...listeners]) listener(state);

    for (const id of closed) {
      const win = prev.windows[id];
      if (win) emit('window:closed', { window: win });
    }
    for (const id of opened) {
      const win = next.windows[id];
      if (win) emit('window:opened', { window: win });
    }
    for (const id of changed) {
      const win = next.windows[id];
      if (win) emit('window:changed', { window: win });
    }
    if (focusChanged) emit('window:focused', { windowId: next.focusedId });
    if (desktopChanged) emit('desktop:changed', { desktopId: next.activeDesktopId });
    if (shellChanged) emit('shell:changed', { shell: next.shell });
  }

  /** Moves `id` and its descendants to the top of their layers (parent first). */
  function raiseGroup(draft: ManagerState, id: WindowId): void {
    const below = descendantsOf(draft.windows, id).sort(
      (a, b) => draft.order.indexOf(a) - draft.order.indexOf(b),
    );
    const group = [id, ...below];
    draft.order = [...draft.order.filter((other) => !group.includes(other)), ...group];
  }

  /** The window that really receives focus: the topmost modal child below `id`, or `id`. */
  function resolveModal(draft: ManagerState, id: WindowId): WindowId {
    let target = id;
    for (;;) {
      let found: WindowId | null = null;
      let foundIndex = -1;
      for (const win of Object.values(draft.windows)) {
        if (win.parentId === target && win.modal) {
          const index = draft.order.indexOf(win.id);
          if (index > foundIndex) {
            found = win.id;
            foundIndex = index;
          }
        }
      }
      if (found === null) return target;
      target = found;
    }
  }

  /** Brings back `id` and every minimized window below it. */
  function restoreTree(draft: ManagerState, id: WindowId): void {
    for (const wid of [id, ...descendantsOf(draft.windows, id)]) {
      const win = draft.windows[wid];
      if (win && win.status === 'minimized') {
        draft.windows[wid] = { ...win, status: statusBeforeMinimize.get(wid) ?? 'normal' };
        statusBeforeMinimize.delete(wid);
      }
    }
  }

  function minimizedRoot(draft: ManagerState, id: WindowId): WindowId {
    let root = id;
    for (;;) {
      const parentId: WindowId | null = need(draft, root).parentId;
      const parent = parentId !== null ? draft.windows[parentId] : undefined;
      if (parent?.status !== 'minimized') return root;
      root = parent.id;
    }
  }

  function applyFocus(draft: ManagerState, id: WindowId): void {
    need(draft, id);
    const target = resolveModal(draft, id);
    if (need(draft, target).status === 'minimized') {
      restoreTree(draft, minimizedRoot(draft, target));
    }
    const win = need(draft, target);
    showing.delete(win.desktopId); // focusing a window ends "show desktop" there
    draft.activeDesktopId = win.desktopId;
    raiseGroup(draft, target);
    draft.focusedId = target;
  }

  /** Focuses the parent or the topmost visible window of the desktop, or nothing. */
  function focusNext(draft: ManagerState, desktopId: DesktopId, parentId: WindowId | null): void {
    const parent = parentId !== null ? draft.windows[parentId] : undefined;
    if (parent && parent.status !== 'minimized' && parent.desktopId === desktopId) {
      applyFocus(draft, parent.id);
      return;
    }
    for (let i = draft.order.length - 1; i >= 0; i -= 1) {
      const win = draft.windows[draft.order[i] as WindowId];
      if (win && win.desktopId === desktopId && win.status !== 'minimized') {
        applyFocus(draft, win.id);
        return;
      }
    }
    draft.focusedId = null;
  }

  function setWindow(draft: ManagerState, win: WindowState): void {
    draft.windows[win.id] = win;
  }

  function toNormal(draft: ManagerState, win: WindowState): WindowState {
    const bounds = clampWindowBounds(draft, win, win.restoreBounds ?? win.bounds);
    return { ...win, status: 'normal', snap: null, bounds, restoreBounds: null };
  }

  /** Brings a window back to normal bounds; a minimized one comes back as it was. */
  function restoreInDraft(draft: ManagerState, id: WindowId): void {
    const win = need(draft, id);
    if (win.status === 'minimized') {
      restoreTree(draft, minimizedRoot(draft, id));
      applyFocus(draft, id);
      return;
    }
    maximizedBeforeFullscreen.delete(id);
    if (win.status === 'normal' && win.snap === null) return;
    setWindow(draft, toNormal(draft, win));
  }

  /** Fits every window to the current work area (used after the viewport or a layout changes). */
  function refit(draft: ManagerState): void {
    const area = areaOf(draft);
    for (const win of Object.values(draft.windows)) {
      const effective: WindowStatus =
        win.status === 'minimized' ? (statusBeforeMinimize.get(win.id) ?? 'normal') : win.status;
      const rules = rulesFor(getApp(win.appId));
      const restoreBounds = win.restoreBounds ? clampBounds(win.restoreBounds, area, rules) : null;
      if (effective === 'maximized') {
        setWindow(draft, { ...win, bounds: area, restoreBounds });
      } else if (effective === 'fullscreen') {
        setWindow(draft, { ...win, bounds: fullViewport(draft), restoreBounds });
      } else {
        // A snapped window keeps its zone, so it is fitted to the new area, not just clamped.
        const target = win.snap !== null ? boundsForZone(win.snap, area) : win.bounds;
        setWindow(draft, { ...win, bounds: clampBounds(target, area, rules), restoreBounds });
      }
    }
  }

  /** Replaces the layout with a snapshot. Throws `INVALID_SNAPSHOT` before changing anything. */
  function applySnapshot(raw: unknown): void {
    const snapshot = parseSnapshot(raw);
    const desktopList: Desktop[] = snapshot.desktops.map((desktop) => ({
      id: desktop.id,
      name: desktop.name,
      wallpaper: desktop.wallpaper ?? null,
    }));
    const desktopIds = new Set(desktopList.map((desktop) => desktop.id));

    let kept = snapshot.windows.filter(
      (win) =>
        apps.has(win.appId) && desktopIds.has(win.desktopId) && (options.restore?.(win) ?? true),
    );
    for (;;) {
      const ids = new Set(kept.map((win) => win.id));
      const next = kept.filter((win) => win.parentId === null || ids.has(win.parentId));
      if (next.length === kept.length) break;
      kept = next;
    }
    const byId = new Map(kept.map((win) => [win.id, win]));

    const draft = begin();
    guards.clear();
    statusBeforeMinimize.clear();
    maximizedBeforeFullscreen.clear();
    showing.clear();
    recent = [];

    draft.windows = {};
    draft.order = [];
    let highest = 0;
    for (const saved of kept) {
      const parent = saved.parentId !== null ? byId.get(saved.parentId) : undefined;
      const win: WindowState = {
        ...saved,
        bounds: { ...saved.bounds },
        restoreBounds: saved.restoreBounds ? { ...saved.restoreBounds } : null,
        // A child always lives on its parent's desktop.
        desktopId: parent ? parent.desktopId : saved.desktopId,
      };
      if (win.status === 'minimized') {
        // Older snapshots have no `minimizedFrom`; snapped or maximized is then the best guess.
        statusBeforeMinimize.set(
          win.id,
          snapshot.minimizedFrom?.[win.id] ??
            (win.snap !== null || win.restoreBounds === null ? 'normal' : 'maximized'),
        );
      }
      draft.windows[win.id] = win;
      draft.order.push(win.id);
      const number = /^window-(\d+)$/.exec(win.id)?.[1];
      if (number !== undefined) highest = Math.max(highest, Number(number));
    }
    nextWindowNumber = Math.max(nextWindowNumber, highest + 1);

    draft.desktops = desktopList;
    nextDesktopNumber = desktopList.length + 1;
    draft.activeDesktopId = desktopIds.has(snapshot.activeDesktopId)
      ? snapshot.activeDesktopId
      : (desktopList[0] as Desktop).id;
    const listed = checkKnown(snapshot.iconOrder);
    draft.iconOrder = [
      ...listed,
      ...options.apps
        .filter((app) => app.placement?.desktop !== false && !listed.includes(app.id))
        .map((app) => app.id),
    ];
    draft.pinnedApps = checkKnown(snapshot.pinnedApps);
    draft.shell = { ...snapshot.shell };

    if (viewportSet) refit(draft);
    draft.focusedId = null;
    focusNext(draft, draft.activeDesktopId, null);
    commit(draft);
  }

  function checkKnown(appIds: AppId[]): AppId[] {
    return [...new Set(appIds.filter((appId) => apps.has(appId)))];
  }

  // ---------- saving ----------

  const storage = options.storage;
  const saveDebounceMs = options.saveDebounceMs ?? 500;
  let destroyed = false;
  /** Saving waits until the first load finished, so an empty start never overwrites a layout. */
  let loaded = storage === undefined;
  let loading: Promise<void> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  function clearSaveTimer(): void {
    if (saveTimer !== undefined) clearTimeout(saveTimer);
    saveTimer = undefined;
  }

  function scheduleSave(): void {
    if (!storage || !loaded || destroyed) return;
    clearSaveTimer();
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      void (async () => {
        try {
          await storage.save(manager.serialize());
        } catch {
          // A failed background save is dropped; `flush` reports errors to its caller.
        }
      })();
    }, saveDebounceMs);
  }

  /** True when something that goes into a snapshot differs. */
  function persistedChanged(prev: ManagerState, next: ManagerState): boolean {
    return (
      prev.desktops !== next.desktops ||
      prev.iconOrder !== next.iconOrder ||
      prev.pinnedApps !== next.pinnedApps ||
      prev.activeDesktopId !== next.activeDesktopId ||
      !sameShell(prev.shell, next.shell) ||
      prev.order.length !== next.order.length ||
      prev.order.some((id, i) => id !== next.order[i] || prev.windows[id] !== next.windows[id])
    );
  }

  // ---------- manager ----------

  const manager: WindowManager = {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    on(event, handler) {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      const entry = handler as (payload: never) => void;
      set.add(entry);
      return () => {
        set?.delete(entry);
      };
    },

    getApp,

    open<TData>(opts: OpenOptions<TData>): WindowId {
      const app = getApp(opts.appId);
      const draft = begin();
      const parent = opts.parentId !== undefined ? need(draft, opts.parentId) : null;
      const desktopId = parent ? parent.desktopId : (opts.desktopId ?? draft.activeDesktopId);
      if (!draft.desktops.some((desktop) => desktop.id === desktopId)) {
        throw new WindowManagerError('UNKNOWN_DESKTOP', `Unknown desktop "${desktopId}".`);
      }

      const existing = Object.values(draft.windows).filter((win) => win.appId === app.id);
      if (app.instances?.single && existing.length > 0) {
        const top = [...existing].sort((a, b) => b.z - a.z)[0] as WindowState;
        applyFocus(draft, top.id);
        commit(draft);
        return top.id;
      }
      const maxInstances = app.instances?.max;
      if (maxInstances !== undefined && existing.length >= maxInstances) {
        throw new WindowManagerError(
          'MAX_INSTANCES',
          `App "${app.id}" allows at most ${maxInstances} window(s).`,
        );
      }

      const requested = opts.bounds ?? {};
      assertFinite(
        { x: requested.x, y: requested.y, width: requested.width, height: requested.height },
        'Bounds must be finite numbers.',
      );
      assertPositiveSize(requested.width, requested.height);

      const area = areaOf(draft);
      const rules = rulesFor(app);
      const fitMax: Size = {
        width: Math.min(rules.max?.width ?? Number.POSITIVE_INFINITY, area.width),
        height: Math.min(rules.max?.height ?? Number.POSITIVE_INFINITY, area.height),
      };
      const fitRules = { ...rules, max: fitMax };
      const defaultSize = app.size?.default ?? DEFAULT_SIZE;
      const sized = clampBounds(
        {
          x: 0,
          y: 0,
          width: requested.width ?? defaultSize.width,
          height: requested.height ?? defaultSize.height,
        },
        area,
        fitRules,
      );
      const onDesktop = Object.values(draft.windows).filter(
        (win) => win.desktopId === desktopId,
      ).length;
      const origin = cascade(onDesktop, area, sized, cascadeOffset);
      const normalBounds = clampBounds(
        { ...sized, x: requested.x ?? origin.x, y: requested.y ?? origin.y },
        area,
        fitRules,
      );

      const status = opts.status ?? 'normal';
      const id = `window-${nextWindowNumber}`;
      nextWindowNumber += 1;
      const win: WindowState = {
        id,
        appId: app.id,
        title: opts.title ?? app.title,
        desktopId,
        bounds:
          status === 'maximized'
            ? area
            : status === 'fullscreen'
              ? fullViewport(draft)
              : normalBounds,
        restoreBounds: status === 'maximized' || status === 'fullscreen' ? normalBounds : null,
        status,
        snap: null,
        z: 0,
        alwaysOnTop: opts.alwaysOnTop ?? parent?.alwaysOnTop ?? false,
        parentId: parent ? parent.id : null,
        modal: parent !== null && opts.modal === true,
        badge: null,
        dirty: false,
        data: opts.data !== undefined ? opts.data : app.defaultData,
      };
      if (status === 'minimized') statusBeforeMinimize.set(id, 'normal');
      setWindow(draft, win);
      draft.order.push(id);
      if (status !== 'minimized' && desktopId === draft.activeDesktopId) applyFocus(draft, id);
      commit(draft);
      return id;
    },

    async close(id, closeOptions) {
      need(state, id);
      if (closeOptions?.force !== true) {
        for (const wid of [id, ...descendantsOf(state.windows, id)]) {
          const guard = guards.get(wid);
          if (guard && !(await guard())) return false;
        }
      }
      const root = state.windows[id];
      if (!root) return true;

      const draft = begin();
      const removed = [id, ...descendantsOf(draft.windows, id)];
      const focusWasRemoved = draft.focusedId !== null && removed.includes(draft.focusedId);
      for (const wid of removed) {
        delete draft.windows[wid];
      }
      draft.order = draft.order.filter((wid) => !removed.includes(wid));
      if (focusWasRemoved) focusNext(draft, root.desktopId, root.parentId);
      commit(draft);
      return true;
    },

    setCloseGuard(id, guard) {
      need(state, id);
      if (guard) guards.set(id, guard);
      else guards.delete(id);
    },

    focus(id) {
      const draft = begin();
      applyFocus(draft, id);
      commit(draft);
    },

    minimize(id) {
      const draft = begin();
      const root = need(draft, id);
      const targets = [id, ...descendantsOf(draft.windows, id)];
      let focusLost = false;
      for (const wid of targets) {
        const win = draft.windows[wid];
        if (!win || win.status === 'minimized') continue;
        statusBeforeMinimize.set(wid, win.status);
        setWindow(draft, { ...win, status: 'minimized' });
        if (draft.focusedId === wid) focusLost = true;
      }
      if (focusLost) focusNext(draft, root.desktopId, root.parentId);
      commit(draft);
    },

    maximize(id) {
      const draft = begin();
      const win = need(draft, id);
      if (!isResizable(win)) return;
      if (win.status === 'minimized') restoreTree(draft, minimizedRoot(draft, id));
      const current = need(draft, id);
      maximizedBeforeFullscreen.delete(id);
      setWindow(draft, {
        ...current,
        status: 'maximized',
        snap: null,
        restoreBounds: current.restoreBounds ?? current.bounds,
        bounds: areaOf(draft),
      });
      applyFocus(draft, id);
      commit(draft);
    },

    restore(id) {
      const draft = begin();
      restoreInDraft(draft, id);
      commit(draft);
    },

    toggleMaximize(id) {
      if (need(state, id).status === 'maximized') manager.restore(id);
      else manager.maximize(id);
    },

    setFullscreen(id, on) {
      const draft = begin();
      const win = need(draft, id);
      if (on) {
        if (win.status === 'fullscreen') return;
        if (win.status === 'minimized') restoreTree(draft, minimizedRoot(draft, id));
        const current = need(draft, id);
        if (current.status === 'maximized') maximizedBeforeFullscreen.add(id);
        setWindow(draft, {
          ...current,
          status: 'fullscreen',
          snap: null,
          restoreBounds: current.restoreBounds ?? current.bounds,
          bounds: fullViewport(draft),
        });
        applyFocus(draft, id);
      } else {
        if (win.status !== 'fullscreen') return;
        if (maximizedBeforeFullscreen.delete(id)) {
          setWindow(draft, { ...win, status: 'maximized', bounds: areaOf(draft) });
        } else {
          setWindow(draft, toNormal(draft, win));
        }
      }
      commit(draft);
    },

    setAlwaysOnTop(id, on) {
      const draft = begin();
      need(draft, id);
      for (const wid of [id, ...descendantsOf(draft.windows, id)]) {
        const win = draft.windows[wid];
        if (win && win.alwaysOnTop !== on) setWindow(draft, { ...win, alwaysOnTop: on });
      }
      raiseGroup(draft, id);
      commit(draft);
    },

    move(id, to: Point) {
      assertFinite({ x: to.x, y: to.y }, 'Position must be finite numbers.');
      const draft = begin();
      const win = need(draft, id);
      if (win.status !== 'normal') return;
      // Moving a snapped window unsnaps it: it goes back to its normal size at the new position.
      const size = win.snap !== null && win.restoreBounds ? win.restoreBounds : win.bounds;
      const bounds = clampWindowBounds(draft, win, { ...size, x: to.x, y: to.y });
      setWindow(draft, { ...win, bounds, snap: null, restoreBounds: null });
      commit(draft);
    },

    resize(id, bounds) {
      assertFinite(
        { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        'Bounds must be finite numbers.',
      );
      assertPositiveSize(bounds.width, bounds.height);
      const draft = begin();
      const win = need(draft, id);
      if (win.status !== 'normal' || !isResizable(win)) return;
      // Resizing a snapped window unsnaps it.
      setWindow(draft, {
        ...win,
        bounds: clampWindowBounds(draft, win, bounds),
        snap: null,
        restoreBounds: null,
      });
      commit(draft);
    },

    snap(id, zone) {
      const draft = begin();
      const win = need(draft, id);
      if (zone === null) {
        if (win.snap === null) return;
        const normal = toNormal(draft, win);
        setWindow(draft, win.status === 'minimized' ? { ...normal, status: 'minimized' } : normal);
        commit(draft);
        return;
      }
      if (!isResizable(win) || win.status === 'fullscreen') return;
      if (win.status === 'minimized') restoreTree(draft, minimizedRoot(draft, id));
      const current = need(draft, id);
      maximizedBeforeFullscreen.delete(id);
      setWindow(draft, {
        ...current,
        status: 'normal',
        snap: zone,
        restoreBounds: current.restoreBounds ?? current.bounds,
        bounds: clampWindowBounds(draft, current, boundsForZone(zone, areaOf(draft))),
      });
      applyFocus(draft, id);
      commit(draft);
    },

    update(id, patch) {
      const draft = begin();
      const win = need(draft, id);
      const next: WindowState = { ...win };
      if (patch.title !== undefined) next.title = patch.title;
      if (patch.badge !== undefined) next.badge = patch.badge;
      if (patch.dirty !== undefined) next.dirty = patch.dirty;
      if ('data' in patch) next.data = patch.data;
      setWindow(draft, next);
      commit(draft);
    },

    cycleFocus(direction = 1) {
      const rank = (id: WindowId): number => {
        const index = recent.indexOf(id);
        return index === -1 ? Number.POSITIVE_INFINITY : index;
      };
      const candidates = [...state.order]
        .reverse()
        .filter((id) => {
          const win = state.windows[id];
          return (
            win !== undefined &&
            win.desktopId === state.activeDesktopId &&
            win.status !== 'minimized'
          );
        })
        .sort((a, b) => rank(a) - rank(b));
      if (candidates.length === 0) return;
      const current = state.focusedId === null ? -1 : candidates.indexOf(state.focusedId);
      let target: WindowId | undefined;
      if (current === -1) target = candidates[0];
      else if (direction === 1) target = candidates[(current + 1) % candidates.length];
      else target = candidates[candidates.length - 1];
      if (target !== undefined) manager.focus(target);
    },

    setViewport(size, insets) {
      assertFinite({ width: size.width, height: size.height }, 'Viewport must be finite numbers.');
      if (size.width < 0 || size.height < 0) {
        throw new WindowManagerError('INVALID_BOUNDS', 'Viewport size cannot be negative.');
      }
      const draft = begin();
      draft.viewport = { width: size.width, height: size.height };
      if (insets) draft.insets = { ...insets };
      viewportSet = true;
      refit(draft);
      commit(draft);
    },

    send(target, message, sendOptions) {
      const from = sendOptions?.from ?? null;
      if (from !== null) need(state, from);
      const recipients = [...bus.handlersFor(target)];
      if ('windowId' in target) {
        need(state, target.windowId);
      } else {
        getApp(target.appId);
        for (const id of state.order) {
          if (state.windows[id]?.appId === target.appId) {
            recipients.push(...bus.handlersFor({ windowId: id }));
          }
        }
      }
      for (const handler of recipients) handler(message, from);
      emit('message', { target, message, from });
    },

    onMessage(target, handler) {
      if ('windowId' in target) need(state, target.windowId);
      else getApp(target.appId);
      return bus.subscribe(target, handler);
    },

    openFromUrl(url) {
      const link = parseDeepLink(url);
      if (link === null || !apps.has(link.appId)) return null;
      const app = getApp(link.appId);
      const hasParams = Object.keys(link.params).length > 0;
      const base = app.defaultData;
      const data = !hasParams
        ? undefined
        : typeof base === 'object' && base !== null && !Array.isArray(base)
          ? { ...base, ...link.params }
          : link.params;
      try {
        return manager.open({ appId: link.appId, ...(data !== undefined ? { data } : {}) });
      } catch (error) {
        if (error instanceof WindowManagerError && error.code === 'MAX_INSTANCES') return null;
        throw error;
      }
    },

    toUrl(target, params) {
      if ('windowId' in target) {
        return buildDeepLink(need(state, target.windowId).appId, params);
      }
      return buildDeepLink(getApp(target.appId).id, params);
    },

    serialize() {
      const minimizedFrom: Record<WindowId, RestorableStatus> = {};
      for (const win of Object.values(state.windows)) {
        if (win.status === 'minimized') {
          minimizedFrom[win.id] = statusBeforeMinimize.get(win.id) ?? 'normal';
        }
      }
      return {
        version: 1,
        ...(Object.keys(minimizedFrom).length > 0 ? { minimizedFrom } : {}),
        desktops: state.desktops.map((desktop) => ({ ...desktop })),
        activeDesktopId: state.activeDesktopId,
        windows: state.order.flatMap((id) => {
          const win = state.windows[id];
          return win ? [{ ...win }] : [];
        }),
        iconOrder: [...state.iconOrder],
        pinnedApps: [...state.pinnedApps],
        shell: { ...state.shell },
      };
    },

    restoreLayout(snapshot) {
      applySnapshot(snapshot);
      emit('layout:restored', { ok: true });
    },

    async flush() {
      if (!storage) return;
      if (loading) await loading;
      clearSaveTimer();
      if (destroyed) return;
      await storage.save(manager.serialize());
    },

    showDesktop(on) {
      const active = state.activeDesktopId;
      const entry = showing.get(active);
      const enable = on ?? entry === undefined;
      const draft = begin();
      if (enable) {
        if (entry) return;
        const ids: WindowId[] = [];
        for (const id of draft.order) {
          const win = draft.windows[id];
          if (!win || win.desktopId !== active || win.status === 'minimized') continue;
          statusBeforeMinimize.set(id, win.status);
          setWindow(draft, { ...win, status: 'minimized' });
          ids.push(id);
        }
        showing.set(active, { ids, focus: draft.focusedId });
        draft.focusedId = null;
      } else {
        if (!entry) return;
        showing.delete(active);
        const restored: WindowId[] = [];
        for (const id of entry.ids) {
          const win = draft.windows[id];
          if (!win || win.desktopId !== active || win.status !== 'minimized') continue;
          setWindow(draft, { ...win, status: statusBeforeMinimize.get(id) ?? 'normal' });
          statusBeforeMinimize.delete(id);
          restored.push(id);
        }
        const target =
          entry.focus !== null && restored.includes(entry.focus)
            ? entry.focus
            : [...draft.order].reverse().find((id) => restored.includes(id));
        if (target !== undefined) applyFocus(draft, target);
      }
      commit(draft);
    },

    addDesktop(name) {
      const draft = begin();
      let number = nextDesktopNumber;
      while (draft.desktops.some((desktop) => desktop.id === `desktop-${number}`)) number += 1;
      nextDesktopNumber = number + 1;
      const id = `desktop-${number}`;
      draft.desktops = [
        ...draft.desktops,
        { id, name: name ?? `Desktop ${number}`, wallpaper: null },
      ];
      commit(draft);
      return id;
    },

    renameDesktop(id, name) {
      const draft = begin();
      const desktop = needDesktop(draft, id);
      if (desktop.name === name) return;
      draft.desktops = draft.desktops.map((entry) =>
        entry.id === id ? { ...entry, name } : entry,
      );
      commit(draft);
    },

    async removeDesktop(id, removeOptions) {
      needDesktop(state, id);
      if (state.desktops.length === 1) {
        throw new WindowManagerError('LAST_DESKTOP', 'The last desktop cannot be removed.');
      }
      const requested = removeOptions?.moveWindowsTo;
      // Moving windows onto the desktop being removed makes no sense, so it counts as not given.
      const moveTo = requested === id ? undefined : requested;
      if (moveTo !== undefined) {
        needDesktop(state, moveTo);
      } else {
        for (const wid of state.order) {
          const guard = state.windows[wid]?.desktopId === id ? guards.get(wid) : undefined;
          if (guard && !(await guard())) return false;
        }
      }

      const draft = begin();
      const index = draft.desktops.findIndex((desktop) => desktop.id === id);
      if (index === -1 || draft.desktops.length === 1) return true; // changed while guards ran
      if (moveTo !== undefined) needDesktop(draft, moveTo);
      const wasActive = draft.activeDesktopId === id;
      const onDesktop = draft.order.filter((wid) => draft.windows[wid]?.desktopId === id);
      if (moveTo !== undefined) {
        for (const wid of onDesktop) {
          const win = need(draft, wid);
          setWindow(draft, { ...win, desktopId: moveTo });
        }
      } else {
        for (const wid of onDesktop) delete draft.windows[wid];
        draft.order = draft.order.filter((wid) => draft.windows[wid] !== undefined);
      }
      draft.desktops = draft.desktops.filter((desktop) => desktop.id !== id);
      if (wasActive) {
        const fallback = (draft.desktops[index - 1] ?? draft.desktops[index]) as Desktop;
        draft.activeDesktopId = moveTo ?? fallback.id;
        focusNext(draft, draft.activeDesktopId, null);
      }
      commit(draft);
      return true;
    },

    switchDesktop(id) {
      const draft = begin();
      needDesktop(draft, id);
      if (draft.activeDesktopId === id) return;
      draft.activeDesktopId = id;
      focusNext(draft, id, null);
      commit(draft);
    },

    moveToDesktop(windowId, desktopId) {
      const draft = begin();
      needDesktop(draft, desktopId);
      let root = need(draft, windowId);
      while (root.parentId !== null) root = need(draft, root.parentId);
      if (root.desktopId === desktopId) return;
      for (const wid of [root.id, ...descendantsOf(draft.windows, root.id)]) {
        setWindow(draft, { ...need(draft, wid), desktopId });
      }
      const focused = draft.focusedId !== null ? draft.windows[draft.focusedId] : undefined;
      if (focused && focused.desktopId !== draft.activeDesktopId) {
        focusNext(draft, draft.activeDesktopId, null);
      }
      commit(draft);
    },

    setWallpaper(desktopId, wallpaper) {
      const draft = begin();
      needDesktop(draft, desktopId);
      draft.desktops = draft.desktops.map((entry) =>
        entry.id === desktopId ? { ...entry, wallpaper } : entry,
      );
      commit(draft);
    },

    setIconOrder(appIds) {
      const next = withRest(checkApps(appIds), state.iconOrder);
      if (sameList(next, state.iconOrder)) return;
      const draft = begin();
      draft.iconOrder = next;
      commit(draft);
    },

    pinApp(appId, index) {
      getApp(appId);
      const already = state.pinnedApps.includes(appId);
      if (already && index === undefined) return;
      const rest = state.pinnedApps.filter((id) => id !== appId);
      const at =
        index === undefined || !Number.isFinite(index)
          ? rest.length
          : Math.max(0, Math.min(Math.trunc(index), rest.length));
      const next = [...rest.slice(0, at), appId, ...rest.slice(at)];
      if (sameList(next, state.pinnedApps)) return;
      const draft = begin();
      draft.pinnedApps = next;
      commit(draft);
    },

    unpinApp(appId) {
      if (!state.pinnedApps.includes(appId)) return;
      const draft = begin();
      draft.pinnedApps = state.pinnedApps.filter((id) => id !== appId);
      commit(draft);
    },

    setPinnedOrder(appIds) {
      const next = withRest(checkApps(appIds), state.pinnedApps);
      if (sameList(next, state.pinnedApps)) return;
      const draft = begin();
      draft.pinnedApps = next;
      commit(draft);
    },

    setShellSettings(patch) {
      const next: ShellSettings = { ...state.shell };
      if (patch.taskbarPosition !== undefined) next.taskbarPosition = patch.taskbarPosition;
      if (patch.taskbarAutoHide !== undefined) next.taskbarAutoHide = patch.taskbarAutoHide;
      if (patch.controlsStyle !== undefined) next.controlsStyle = patch.controlsStyle;
      if (sameShell(state.shell, next)) return;
      const draft = begin();
      draft.shell = next;
      commit(draft);
    },

    destroy() {
      destroyed = true;
      clearSaveTimer();
      listeners.clear();
      handlers.clear();
      guards.clear();
      showing.clear();
      bus.clear();
    },
  };

  // ---------- loading ----------

  function finishLoad(snapshot: LayoutSnapshot | null, failed: boolean): void {
    if (destroyed) return;
    let ok = !failed;
    if (ok && snapshot !== null) {
      try {
        applySnapshot(snapshot);
        emit('layout:restored', { ok: true });
        ok = true;
      } catch {
        ok = false;
      }
    }
    loaded = true;
    if (!ok) emit('layout:restored', { ok: false });
  }

  if (storage) {
    let result: LayoutSnapshot | null | Promise<LayoutSnapshot | null> = null;
    let failed = false;
    try {
      result = storage.load();
    } catch {
      failed = true;
    }
    if (result instanceof Promise) {
      loading = result.then(
        (snapshot) => finishLoad(snapshot, false),
        () => finishLoad(null, true),
      );
    } else {
      finishLoad(result, failed);
    }
  }

  return manager;
}
