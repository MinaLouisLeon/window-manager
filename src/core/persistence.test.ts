import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWindowManager } from './createWindowManager';
import { WindowManagerError } from './errors';
import { localStorageAdapter, parseSnapshot } from './persistence';
import type {
  AppDefinition,
  LayoutSnapshot,
  LayoutStorage,
  WindowId,
  WindowManager,
  WindowManagerOptions,
  WindowState,
} from './types';

const apps: AppDefinition[] = [
  { id: 'notes', title: 'Notes', size: { default: { width: 400, height: 300 } } },
  { id: 'terminal', title: 'Terminal', placement: { pinned: true } },
  { id: 'hidden', title: 'Hidden', placement: { desktop: false } },
];

const desktops = [{ name: 'One' }, { name: 'Two' }];

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup(extra: Partial<WindowManagerOptions> = {}): WindowManager {
  const manager = createWindowManager({ apps, desktops, ...extra });
  manager.setViewport({ width: 1000, height: 700 });
  return manager;
}

function win(manager: WindowManager, id: WindowId): WindowState {
  return manager.getState().windows[id] as WindowState;
}

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof WindowManagerError ? error.code : 'OTHER';
  }
  return undefined;
}

/** A source manager with a bit of everything, and its snapshot. */
function sample(): { manager: WindowManager; snapshot: LayoutSnapshot; ids: WindowId[] } {
  const manager = setup();
  const a = manager.open({ appId: 'notes', data: { folder: '/docs' } });
  const b = manager.open({ appId: 'terminal' });
  manager.snap(b, 'left');
  manager.switchDesktop('desktop-2');
  const c = manager.open({ appId: 'notes' });
  manager.maximize(c);
  manager.switchDesktop('desktop-1');
  manager.pinApp('notes');
  manager.setShellSettings({ taskbarPosition: 'left', controlsStyle: 'mac' });
  manager.setWallpaper('desktop-2', { type: 'color', value: '#112233' });
  return { manager, snapshot: manager.serialize(), ids: [a, b, c] };
}

function memory(initial: LayoutSnapshot | null = null) {
  let saved = initial;
  const save = vi.fn((snapshot: LayoutSnapshot) => {
    saved = snapshot;
  });
  const storage: LayoutStorage = { load: () => saved, save };
  return { storage, save, saved: () => saved };
}

describe('serialize', () => {
  it('produces a version 1 snapshot, windows bottom to top', () => {
    const { manager, snapshot, ids } = sample();
    expect(snapshot.version).toBe(1);
    expect(snapshot.windows.map((w) => w.id)).toEqual(manager.getState().order);
    expect(snapshot.windows.map((w) => w.id).sort()).toEqual([...ids].sort());
    expect(snapshot.activeDesktopId).toBe('desktop-1');
    expect(snapshot.pinnedApps).toEqual(['terminal', 'notes']);
    expect(snapshot.shell).toEqual({
      taskbarPosition: 'left',
      taskbarAutoHide: false,
      controlsStyle: 'mac',
    });
    expect(snapshot.desktops[1]?.wallpaper).toEqual({ type: 'color', value: '#112233' });
  });

  it('returns copies, so the state is not exposed to changes', () => {
    const { manager, snapshot } = sample();
    (snapshot.windows[0] as WindowState).title = 'Changed';
    snapshot.pinnedApps.push('x');
    expect(manager.serialize().windows[0]?.title).not.toBe('Changed');
    expect(manager.getState().pinnedApps).not.toContain('x');
  });

  it('survives JSON', () => {
    const { snapshot } = sample();
    expect(() => parseSnapshot(JSON.parse(JSON.stringify(snapshot)))).not.toThrow();
  });
});

describe('restore', () => {
  it('restores the layout from storage when the manager starts', () => {
    const { manager: source, snapshot } = sample();
    const restored = setup({ storage: memory(snapshot).storage });
    expect(restored.getState().windows).toEqual(source.getState().windows);
    expect(restored.getState().order).toEqual(source.getState().order);
    expect(restored.getState().desktops).toEqual(source.getState().desktops);
    expect(restored.getState().activeDesktopId).toBe('desktop-1');
    expect(restored.getState().pinnedApps).toEqual(source.getState().pinnedApps);
    expect(restored.getState().shell).toEqual(source.getState().shell);
    expect(restored.getState().focusedId).toBe(source.getState().focusedId);
  });

  it('keeps saved positions when the viewport is reported after the restore', () => {
    const { snapshot } = sample();
    const manager = createWindowManager({ apps, storage: memory(snapshot).storage });
    manager.setViewport({ width: 1000, height: 700 });
    const notes = snapshot.windows.find((w) => w.appId === 'notes' && w.desktopId === 'desktop-1');
    expect(manager.getState().windows[notes?.id as string]?.bounds).toEqual(notes?.bounds);
  });

  it('refits windows to a different viewport', () => {
    const { snapshot } = sample();
    const manager = createWindowManager({ apps, storage: memory(snapshot).storage });
    manager.setViewport({ width: 500, height: 400 }, { top: 0, right: 0, bottom: 40, left: 0 });
    const maximized = Object.values(manager.getState().windows).find(
      (w) => w.status === 'maximized',
    );
    expect(maximized?.bounds).toEqual({ x: 0, y: 0, width: 500, height: 360 });
    const left = Object.values(manager.getState().windows).find((w) => w.snap === 'left');
    expect(left?.bounds).toEqual({ x: 0, y: 0, width: 250, height: 360 });
  });

  it('skips windows of unknown apps, windows `restore` refuses, and their children', () => {
    const { snapshot } = sample();
    const parent = snapshot.windows[0] as WindowState;
    const child: WindowState = { ...parent, id: 'window-90', parentId: parent.id };
    const stranger: WindowState = { ...parent, id: 'window-91', appId: 'gone', parentId: null };
    const manager = setup({
      storage: memory({ ...snapshot, windows: [...snapshot.windows, child, stranger] }).storage,
      restore: (w) => w.id !== parent.id,
    });
    const ids = Object.keys(manager.getState().windows);
    expect(ids).not.toContain(parent.id);
    expect(ids).not.toContain('window-90');
    expect(ids).not.toContain('window-91');
    expect(ids).toHaveLength(snapshot.windows.length - 1);
  });

  it('skips windows on desktops that do not exist and keeps children on their parent desktop', () => {
    const { snapshot } = sample();
    const base = snapshot.windows[0] as WindowState;
    const lost: WindowState = { ...base, id: 'window-80', desktopId: 'desktop-9' };
    const child: WindowState = {
      ...base,
      id: 'window-81',
      parentId: base.id,
      desktopId: base.desktopId === 'desktop-1' ? 'desktop-2' : 'desktop-1',
    };
    const manager = setup({
      storage: memory({ ...snapshot, windows: [...snapshot.windows, lost, child] }).storage,
    });
    expect(manager.getState().windows['window-80']).toBeUndefined();
    expect(manager.getState().windows['window-81']?.desktopId).toBe(base.desktopId);
  });

  it('merges icons and pins with the current apps', () => {
    const { snapshot } = sample();
    const manager = setup({
      storage: memory({
        ...snapshot,
        iconOrder: ['gone', 'terminal'],
        pinnedApps: ['gone', 'notes'],
      }).storage,
    });
    expect(manager.getState().iconOrder).toEqual(['terminal', 'notes']);
    expect(manager.getState().pinnedApps).toEqual(['notes']);
  });

  it('falls back to the first desktop when the saved active one is missing', () => {
    const { snapshot } = sample();
    const manager = setup({ storage: memory({ ...snapshot, activeDesktopId: 'nope' }).storage });
    expect(manager.getState().activeDesktopId).toBe('desktop-1');
  });

  it('brings a minimized window back as snapped, maximized or normal', () => {
    const source = setup();
    const a = source.open({ appId: 'notes' });
    const b = source.open({ appId: 'notes' });
    const c = source.open({ appId: 'notes' });
    source.snap(a, 'right');
    source.maximize(b);
    for (const id of [a, b, c]) source.minimize(id);
    const manager = setup({ storage: memory(source.serialize()).storage });
    manager.restore(a);
    expect(win(manager, a).status).toBe('normal');
    expect(win(manager, a).snap).toBe('right');
    manager.focus(b);
    expect(win(manager, b).status).toBe('maximized');
    manager.focus(c);
    expect(win(manager, c).status).toBe('normal');
  });

  it('saves where a minimized window comes back to, including fullscreen', () => {
    const source = setup();
    const a = source.open({ appId: 'notes' });
    const b = source.open({ appId: 'notes' });
    source.setFullscreen(a, true);
    source.maximize(b);
    source.minimize(a);
    source.minimize(b);
    const snapshot = source.serialize();
    expect(snapshot.minimizedFrom).toEqual({ [a]: 'fullscreen', [b]: 'maximized' });
    const manager = setup({ storage: memory(JSON.parse(JSON.stringify(snapshot))).storage });
    manager.focus(a);
    expect(win(manager, a).status).toBe('fullscreen');
    manager.focus(b);
    expect(win(manager, b).status).toBe('maximized');
  });

  it('leaves minimizedFrom out when nothing is minimized, and guesses without it', () => {
    const source = setup();
    const a = source.open({ appId: 'notes' });
    expect(source.serialize().minimizedFrom).toBeUndefined();
    source.maximize(a);
    source.minimize(a);
    const { minimizedFrom: _unused, ...legacy } = source.serialize();
    const manager = setup({ storage: memory(legacy).storage });
    manager.focus(a);
    expect(win(manager, a).status).toBe('maximized');
  });

  it('does not reuse window ids of restored windows', () => {
    const { snapshot, ids } = sample();
    const manager = setup({ storage: memory(snapshot).storage });
    const fresh = manager.open({ appId: 'notes' });
    expect(ids).not.toContain(fresh);
  });

  it('restoreLayout replaces the layout, reports it, and drops old guards', async () => {
    const { snapshot } = sample();
    const manager = setup();
    const old = manager.open({ appId: 'notes' });
    manager.setCloseGuard(old, () => false);
    const restored = vi.fn();
    const closed = vi.fn();
    const opened = vi.fn();
    manager.on('layout:restored', restored);
    manager.on('window:closed', closed);
    manager.on('window:opened', opened);

    manager.restoreLayout(snapshot);

    expect(restored).toHaveBeenCalledWith({ ok: true });
    expect(Object.keys(manager.getState().windows).sort()).toEqual(
      snapshot.windows.map((w) => w.id).sort(),
    );
    expect(opened).toHaveBeenCalledTimes(snapshot.windows.length - 1);
    expect(closed).not.toHaveBeenCalled(); // window-1 is part of the snapshot too
    expect(await manager.close(old)).toBe(true); // the old guard is gone
  });

  it('restoreLayout closes windows that are not in the snapshot', () => {
    const { snapshot } = sample();
    const manager = setup();
    manager.open({ appId: 'notes' });
    manager.open({ appId: 'notes' });
    manager.open({ appId: 'notes' });
    manager.open({ appId: 'notes' });
    const closed = vi.fn();
    manager.on('window:closed', closed);
    manager.restoreLayout({ ...snapshot, windows: [] });
    expect(closed).toHaveBeenCalledTimes(4);
    expect(manager.getState().order).toEqual([]);
    expect(manager.getState().focusedId).toBeNull();
  });

  it('ends show desktop mode when a layout is restored', () => {
    const { snapshot } = sample();
    const manager = setup();
    manager.open({ appId: 'notes' });
    manager.showDesktop(true);
    manager.restoreLayout(snapshot);
    expect(manager.getState().showingDesktop).toBe(false);
  });
});

describe('broken snapshots', () => {
  const valid = (): LayoutSnapshot => sample().snapshot;
  const broken: [string, Record<string, unknown>][] = [
    ['another version', { version: 2 }],
    ['no desktops', { desktops: [] }],
    ['a desktop without a name', { desktops: [{ id: 'd' }] }],
    [
      'duplicate desktops',
      {
        desktops: [
          { id: 'd', name: 'a', wallpaper: null },
          { id: 'd', name: 'b', wallpaper: null },
        ],
      },
    ],
    ['a bad wallpaper', { desktops: [{ id: 'd', name: 'a', wallpaper: { type: 'plaid' } }] }],
    ['windows not a list', { windows: {} }],
    ['a window that is not an object', { windows: [1] }],
    ['icon order not strings', { iconOrder: [1] }],
    ['pinned apps missing', { pinnedApps: undefined }],
    ['bad shell', { shell: { taskbarPosition: 'middle' } }],
    ['minimizedFrom with a bad status', { minimizedFrom: { 'window-1': 'minimized' } }],
    ['minimizedFrom that is not an object', { minimizedFrom: 'normal' }],
    ['a missing active desktop id', { activeDesktopId: undefined }],
  ];

  it.each(broken)('throws INVALID_SNAPSHOT for %s and changes nothing', (_name, patch) => {
    const snapshot = JSON.parse(JSON.stringify(valid())) as Record<string, unknown>;
    Object.assign(snapshot, patch);
    const manager = setup();
    manager.open({ appId: 'notes' });
    const before = manager.getState();
    expect(codeOf(() => manager.restoreLayout(snapshot as unknown as LayoutSnapshot))).toBe(
      'INVALID_SNAPSHOT',
    );
    expect(manager.getState()).toBe(before);
  });

  const brokenWindow: [string, Record<string, unknown>][] = [
    ['bounds', { bounds: { x: 0, y: 0, width: 0, height: 10 } }],
    ['restoreBounds', { restoreBounds: { x: 0 } }],
    ['status', { status: 'hovering' }],
    ['snap', { snap: 'middle' }],
    ['z', { z: 'high' }],
    ['alwaysOnTop', { alwaysOnTop: 1 }],
    ['dirty', { dirty: null }],
    ['parentId', { parentId: 5 }],
    ['badge', { badge: {} }],
    ['title', { title: 3 }],
    ['id', { id: 3 }],
  ];

  it.each(brokenWindow)('rejects a window with a bad %s', (_name, patch) => {
    const snapshot = valid();
    const windows = [{ ...snapshot.windows[0], ...patch }] as unknown as WindowState[];
    expect(codeOf(() => parseSnapshot({ ...snapshot, windows }))).toBe('INVALID_SNAPSHOT');
  });

  it('rejects duplicate window ids and parent cycles', () => {
    const snapshot = valid();
    const [first, second] = snapshot.windows as [WindowState, WindowState];
    expect(codeOf(() => parseSnapshot({ ...snapshot, windows: [first, first] }))).toBe(
      'INVALID_SNAPSHOT',
    );
    const a = { ...first, parentId: second.id };
    const b = { ...second, parentId: first.id };
    expect(codeOf(() => parseSnapshot({ ...snapshot, windows: [a, b] }))).toBe('INVALID_SNAPSHOT');
    const self = { ...first, parentId: first.id };
    expect(codeOf(() => parseSnapshot({ ...snapshot, windows: [self] }))).toBe('INVALID_SNAPSHOT');
  });

  it('accepts every wallpaper type, a badge and a missing wallpaper', () => {
    const snapshot = valid();
    const wallpapers = [
      { type: 'theme' },
      { type: 'gradient', value: 'linear-gradient(red, blue)' },
      { type: 'image', url: '/a.png', fit: 'cover' },
      { type: 'image', url: '/a.png' },
    ];
    const list = wallpapers.map((wallpaper, i) => ({ id: `d${i}`, name: 'n', wallpaper }));
    expect(() =>
      parseSnapshot({ ...snapshot, desktops: [...list, { id: 'x', name: 'n' }], windows: [] }),
    ).not.toThrow();
    const badged = [
      { ...snapshot.windows[0], badge: 3 },
      { ...snapshot.windows[1], badge: 'new' },
    ];
    expect(() => parseSnapshot({ ...snapshot, windows: badged })).not.toThrow();
  });

  it('starts empty and reports ok: false when the stored layout is broken (async load)', async () => {
    const saved = vi.fn();
    const manager = createWindowManager({
      apps,
      storage: { load: async () => ({ version: 3 }) as never, save: saved },
    });
    const restored = vi.fn();
    manager.on('layout:restored', restored);
    await manager.flush();
    expect(restored).toHaveBeenCalledWith({ ok: false });
    expect(manager.getState().order).toEqual([]);
    expect(saved).toHaveBeenCalledTimes(1); // saving is enabled afterwards
  });

  it('starts empty and reports ok: false when load throws or rejects', async () => {
    const throwing = createWindowManager({
      apps,
      storage: {
        load: () => {
          throw new Error('disk');
        },
        save: vi.fn(),
      },
    });
    expect(throwing.getState().order).toEqual([]);

    const rejecting = createWindowManager({
      apps,
      storage: { load: () => Promise.reject(new Error('net')), save: vi.fn() },
    });
    const restored = vi.fn();
    rejecting.on('layout:restored', restored);
    await rejecting.flush();
    expect(restored).toHaveBeenCalledWith({ ok: false });
  });

  it('starts empty when a synchronous load returns a broken layout', () => {
    const manager = createWindowManager({
      apps,
      storage: { load: () => ({ version: 9 }) as never, save: vi.fn() },
    });
    expect(manager.getState().order).toEqual([]);
  });
});

describe('saving', () => {
  it('saves once, after the debounce, with the latest state', () => {
    vi.useFakeTimers();
    const store = memory();
    const manager = setup({ storage: store.storage, saveDebounceMs: 500 });
    manager.open({ appId: 'notes' });
    vi.advanceTimersByTime(300);
    manager.open({ appId: 'terminal' });
    vi.advanceTimersByTime(499);
    expect(store.save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(store.saved()?.windows).toHaveLength(2);
  });

  it('uses 500 ms by default', () => {
    vi.useFakeTimers();
    const store = memory();
    const manager = setup({ storage: store.storage });
    manager.open({ appId: 'notes' });
    vi.advanceTimersByTime(499);
    expect(store.save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it('saves for layout changes of every kind', () => {
    vi.useFakeTimers();
    const store = memory();
    const manager = setup({ storage: store.storage, saveDebounceMs: 10 });
    const changes: (() => void)[] = [
      () => manager.switchDesktop('desktop-2'),
      () => manager.renameDesktop('desktop-1', 'Home'),
      () => manager.setIconOrder(['terminal', 'notes']),
      () => manager.pinApp('notes'),
      () => manager.setShellSettings({ taskbarAutoHide: true }),
      () => manager.setWallpaper('desktop-1', { type: 'theme' }),
    ];
    for (const change of changes) {
      store.save.mockClear();
      change();
      vi.advanceTimersByTime(10);
      expect(store.save).toHaveBeenCalledTimes(1);
    }
  });

  it('does not save for changes that are not part of a layout', () => {
    vi.useFakeTimers();
    const store = memory();
    const manager = setup({ storage: store.storage, saveDebounceMs: 10 });
    vi.advanceTimersByTime(100);
    manager.setViewport({ width: 1000, height: 700 });
    manager.setViewport({ width: 2000, height: 1000 });
    vi.advanceTimersByTime(100);
    expect(store.save).not.toHaveBeenCalled();
  });

  it('does not save at all without storage', () => {
    vi.useFakeTimers();
    const manager = setup();
    manager.open({ appId: 'notes' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('flush saves now and cancels the pending save', async () => {
    vi.useFakeTimers();
    const store = memory();
    const manager = setup({ storage: store.storage });
    manager.open({ appId: 'notes' });
    await manager.flush();
    expect(store.save).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it('flush without storage does nothing, and flush errors reach the caller', async () => {
    await expect(setup().flush()).resolves.toBeUndefined();
    const manager = setup({
      storage: {
        load: () => null,
        save: () => {
          throw new Error('full');
        },
      },
    });
    await expect(manager.flush()).rejects.toThrow('full');
  });

  it('a failed background save does not throw', () => {
    vi.useFakeTimers();
    const manager = setup({
      storage: {
        load: () => null,
        save: () => Promise.reject(new Error('offline')),
      },
      saveDebounceMs: 10,
    });
    manager.open({ appId: 'notes' });
    expect(() => vi.advanceTimersByTime(10)).not.toThrow();
  });

  it('destroy cancels a pending save and later changes never save', () => {
    vi.useFakeTimers();
    const store = memory();
    const manager = setup({ storage: store.storage, saveDebounceMs: 10 });
    manager.open({ appId: 'notes' });
    manager.destroy();
    manager.open({ appId: 'notes' });
    vi.advanceTimersByTime(100);
    expect(store.save).not.toHaveBeenCalled();
  });

  it('does not save before an asynchronous load has finished', async () => {
    vi.useFakeTimers();
    const { snapshot } = sample();
    let release: (value: LayoutSnapshot) => void = () => {};
    const save = vi.fn();
    const manager = createWindowManager({
      apps,
      desktops,
      storage: {
        load: () =>
          new Promise<LayoutSnapshot>((resolve) => {
            release = resolve;
          }),
        save,
      },
      saveDebounceMs: 10,
    });
    manager.setViewport({ width: 1000, height: 700 });
    manager.open({ appId: 'notes' });
    vi.advanceTimersByTime(100);
    expect(save).not.toHaveBeenCalled();

    release(snapshot);
    await manager.flush(); // waits for the load, then saves what was loaded
    expect(Object.keys(manager.getState().windows).sort()).toEqual(
      snapshot.windows.map((w) => w.id).sort(),
    );
    expect(save).toHaveBeenCalledTimes(1);
    manager.open({ appId: 'notes' });
    vi.advanceTimersByTime(10);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('ignores a load that finishes after destroy', async () => {
    const { snapshot } = sample();
    const manager = createWindowManager({
      apps,
      desktops,
      storage: { load: async () => snapshot, save: vi.fn() },
    });
    manager.destroy();
    await manager.flush();
    expect(manager.getState().order).toEqual([]);
  });

  it('round-trips through a custom adapter', async () => {
    const store = memory();
    const first = setup({ storage: store.storage });
    first.open({ appId: 'notes', data: { folder: '/x' } });
    first.setShellSettings({ controlsStyle: 'mac' });
    await first.flush();

    const second = setup({ storage: store.storage });
    expect(Object.values(second.getState().windows).map((w) => w.data)).toEqual([{ folder: '/x' }]);
    expect(second.getState().shell.controlsStyle).toBe('mac');
  });
});

describe('localStorageAdapter', () => {
  function fakeStorage(): {
    data: Map<string, string>;
    api: { getItem(k: string): string | null; setItem(k: string, v: string): void };
  } {
    const data = new Map<string, string>();
    return {
      data,
      api: {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => void data.set(key, value),
      },
    };
  }

  it('saves and loads under the default key', () => {
    const fake = fakeStorage();
    vi.stubGlobal('localStorage', fake.api);
    const adapter = localStorageAdapter();
    expect(adapter.load()).toBeNull();
    const { snapshot } = sample();
    adapter.save(snapshot);
    expect([...fake.data.keys()]).toEqual(['integr8-wm-layout']);
    expect(adapter.load()).toEqual(snapshot);
  });

  it('uses a custom key', () => {
    const fake = fakeStorage();
    vi.stubGlobal('localStorage', fake.api);
    localStorageAdapter('mine').save(sample().snapshot);
    expect([...fake.data.keys()]).toEqual(['mine']);
    expect(localStorageAdapter().load()).toBeNull();
  });

  it('throws INVALID_SNAPSHOT for stored text that is not JSON', () => {
    const fake = fakeStorage();
    fake.data.set('integr8-wm-layout', '{oops');
    vi.stubGlobal('localStorage', fake.api);
    expect(codeOf(() => localStorageAdapter().load())).toBe('INVALID_SNAPSHOT');
  });

  it('ignores a write that fails', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(() => localStorageAdapter().save(sample().snapshot)).not.toThrow();
  });

  it('does nothing where there is no local storage', () => {
    vi.stubGlobal('localStorage', undefined);
    const adapter = localStorageAdapter();
    expect(adapter.load()).toBeNull();
    expect(() => adapter.save(sample().snapshot)).not.toThrow();
  });

  it('copes with an accessor that throws (blocked storage)', () => {
    vi.stubGlobal('localStorage', undefined);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      expect(localStorageAdapter().load()).toBeNull();
    } finally {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });

  it('restores a manager through the adapter', async () => {
    const fake = fakeStorage();
    vi.stubGlobal('localStorage', fake.api);
    const first = setup({ storage: localStorageAdapter() });
    first.open({ appId: 'terminal' });
    await first.flush();
    const second = setup({ storage: localStorageAdapter() });
    expect(Object.values(second.getState().windows).map((w) => w.appId)).toEqual(['terminal']);
  });
});
