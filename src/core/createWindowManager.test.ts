import { describe, expect, it, vi } from 'vitest';
import { createWindowManager } from './createWindowManager';
import { WindowManagerError } from './errors';
import { dragRestoreBounds } from './geometry';
import type { AppDefinition, WindowId, WindowManager, WindowState } from './types';

const apps: AppDefinition[] = [
  { id: 'notes', title: 'Notes', size: { default: { width: 400, height: 300 } } },
  { id: 'single', title: 'Single', instances: { single: true } },
  { id: 'pair', title: 'Pair', instances: { max: 2 } },
  { id: 'fixed', title: 'Fixed', size: { resizable: false, default: { width: 300, height: 200 } } },
  {
    id: 'bounded',
    title: 'Bounded',
    size: {
      min: { width: 300, height: 200 },
      max: { width: 500, height: 400 },
      default: { width: 350, height: 250 },
    },
    defaultData: { folder: '/' },
  },
];

function setup(): WindowManager {
  const manager = createWindowManager({ apps });
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

describe('creation', () => {
  it('starts empty with one desktop, icons and pinned apps from the app definitions', () => {
    const manager = createWindowManager({
      apps: [
        { id: 'a', title: 'A', placement: { pinned: true } },
        { id: 'b', title: 'B', placement: { desktop: false } },
      ],
    });
    const state = manager.getState();
    expect(state.windows).toEqual({});
    expect(state.order).toEqual([]);
    expect(state.focusedId).toBeNull();
    expect(state.desktops).toEqual([{ id: 'desktop-1', name: 'Desktop 1', wallpaper: null }]);
    expect(state.activeDesktopId).toBe('desktop-1');
    expect(state.iconOrder).toEqual(['a']);
    expect(state.pinnedApps).toEqual(['a']);
    expect(state.shell).toEqual({
      taskbarPosition: 'bottom',
      taskbarAutoHide: false,
      controlsStyle: 'windows',
    });
  });

  it('merges shell settings and uses the given desktops', () => {
    const manager = createWindowManager({
      apps,
      shell: { taskbarPosition: 'left' },
      desktops: [{ name: 'Work', id: 'work' }, { name: 'Home' }],
    });
    expect(manager.getState().shell.taskbarPosition).toBe('left');
    expect(manager.getState().desktops.map((d) => d.id)).toEqual(['work', 'desktop-2']);
    expect(manager.getState().activeDesktopId).toBe('work');
  });

  it('throws DUPLICATE_APP', () => {
    expect(
      codeOf(() =>
        createWindowManager({
          apps: [
            { id: 'a', title: 'A' },
            { id: 'a', title: 'A again' },
          ],
        }),
      ),
    ).toBe('DUPLICATE_APP');
  });

  it('getApp returns a definition or throws UNKNOWN_APP', () => {
    const manager = setup();
    expect(manager.getApp('notes').title).toBe('Notes');
    expect(codeOf(() => manager.getApp('nope'))).toBe('UNKNOWN_APP');
  });
});

describe('open', () => {
  it('opens at the default size, focused, with the app title', () => {
    const manager = setup();
    const id = manager.open({ appId: 'notes' });
    expect(win(manager, id)).toMatchObject({
      appId: 'notes',
      title: 'Notes',
      status: 'normal',
      bounds: { x: 0, y: 0, width: 400, height: 300 },
      restoreBounds: null,
      snap: null,
      parentId: null,
      modal: false,
      alwaysOnTop: false,
      badge: null,
      dirty: false,
    });
    expect(manager.getState().focusedId).toBe(id);
    expect(manager.getState().order).toEqual([id]);
  });

  it('uses 800×600 when the app gives no size', () => {
    const manager = setup();
    const id = manager.open({ appId: 'single' });
    expect(win(manager, id).bounds).toMatchObject({ width: 800, height: 600 });
  });

  it('gives every window a distinct id and cascades them', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const b = manager.open({ appId: 'notes' });
    const c = manager.open({ appId: 'notes' });
    expect(new Set([a, b, c]).size).toBe(3);
    expect(win(manager, b).bounds).toMatchObject({ x: 24, y: 24 });
    expect(win(manager, c).bounds).toMatchObject({ x: 48, y: 48 });
  });

  it('takes title and data from the options, else the app default data', () => {
    const manager = setup();
    const a = manager.open({ appId: 'bounded', title: 'Mine', data: { folder: '/x' } });
    const b = manager.open({ appId: 'bounded' });
    expect(win(manager, a).title).toBe('Mine');
    expect(win(manager, a).data).toEqual({ folder: '/x' });
    expect(win(manager, b).data).toEqual({ folder: '/' });
  });

  it('clamps the requested size to min, max and the work area', () => {
    const manager = setup();
    const big = manager.open({ appId: 'bounded', bounds: { width: 9999, height: 9999 } });
    const small = manager.open({ appId: 'bounded', bounds: { width: 10, height: 10 } });
    const plain = manager.open({ appId: 'notes', bounds: { width: 10, height: 10 } });
    expect(win(manager, big).bounds).toMatchObject({ width: 500, height: 400 });
    expect(win(manager, small).bounds).toMatchObject({ width: 300, height: 200 });
    expect(win(manager, plain).bounds).toMatchObject({ width: 240, height: 160 });

    manager.setViewport({ width: 300, height: 300 });
    const fitted = manager.open({ appId: 'notes' });
    expect(win(manager, fitted).bounds).toEqual({ x: 0, y: 0, width: 300, height: 300 });
  });

  it('keeps the title bar inside the work area for a requested position', () => {
    const manager = setup();
    const id = manager.open({
      appId: 'notes',
      bounds: { x: -5000, y: -5000, width: 400, height: 300 },
    });
    expect(win(manager, id).bounds).toMatchObject({ x: -352, y: 0 });
  });

  it('rejects invalid bounds with INVALID_BOUNDS', () => {
    const manager = setup();
    expect(codeOf(() => manager.open({ appId: 'notes', bounds: { width: 0 } }))).toBe(
      'INVALID_BOUNDS',
    );
    expect(codeOf(() => manager.open({ appId: 'notes', bounds: { x: Number.NaN } }))).toBe(
      'INVALID_BOUNDS',
    );
  });

  it('throws for unknown apps, parents and desktops', () => {
    const manager = setup();
    expect(codeOf(() => manager.open({ appId: 'nope' }))).toBe('UNKNOWN_APP');
    expect(codeOf(() => manager.open({ appId: 'notes', parentId: 'nope' }))).toBe('UNKNOWN_WINDOW');
    expect(codeOf(() => manager.open({ appId: 'notes', desktopId: 'nope' }))).toBe(
      'UNKNOWN_DESKTOP',
    );
  });

  it('opens maximized, fullscreen or minimized', () => {
    const manager = setup();
    const max = manager.open({ appId: 'notes', status: 'maximized' });
    expect(win(manager, max)).toMatchObject({
      status: 'maximized',
      bounds: { x: 0, y: 0, width: 1000, height: 700 },
      restoreBounds: { x: 0, y: 0, width: 400, height: 300 },
    });
    const full = manager.open({ appId: 'notes', status: 'fullscreen' });
    expect(win(manager, full).status).toBe('fullscreen');
    const min = manager.open({ appId: 'notes', status: 'minimized' });
    expect(win(manager, min).status).toBe('minimized');
    expect(manager.getState().focusedId).toBe(full);
  });

  it('opens on another desktop without taking focus or switching desktops', () => {
    const manager = createWindowManager({
      apps,
      desktops: [
        { id: 'one', name: 'One' },
        { id: 'two', name: 'Two' },
      ],
    });
    const first = manager.open({ appId: 'notes' });
    const other = manager.open({ appId: 'notes', desktopId: 'two' });
    expect(win(manager, other).desktopId).toBe('two');
    expect(manager.getState().focusedId).toBe(first);
    expect(manager.getState().activeDesktopId).toBe('one');

    const listener = vi.fn();
    manager.on('desktop:changed', listener);
    manager.focus(other);
    expect(manager.getState().activeDesktopId).toBe('two');
    expect(listener).toHaveBeenCalledWith({ desktopId: 'two' });
  });
});

describe('instances', () => {
  it('focuses the existing window of a single-instance app', () => {
    const manager = setup();
    const a = manager.open({ appId: 'single' });
    const other = manager.open({ appId: 'notes' });
    expect(manager.getState().focusedId).toBe(other);
    expect(manager.open({ appId: 'single' })).toBe(a);
    expect(manager.getState().focusedId).toBe(a);
    expect(Object.keys(manager.getState().windows)).toHaveLength(2);
  });

  it('restores a minimized single-instance window', () => {
    const manager = setup();
    const a = manager.open({ appId: 'single' });
    manager.minimize(a);
    manager.open({ appId: 'single' });
    expect(win(manager, a).status).toBe('normal');
    expect(manager.getState().focusedId).toBe(a);
  });

  it('throws MAX_INSTANCES beyond the limit, and allows a new one after a close', async () => {
    const manager = setup();
    const a = manager.open({ appId: 'pair' });
    manager.open({ appId: 'pair' });
    expect(codeOf(() => manager.open({ appId: 'pair' }))).toBe('MAX_INSTANCES');
    await manager.close(a);
    expect(codeOf(() => manager.open({ appId: 'pair' }))).toBeUndefined();
  });
});

describe('focus and layers', () => {
  it('raises the focused window and compacts z', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const b = manager.open({ appId: 'notes' });
    const c = manager.open({ appId: 'notes' });
    manager.focus(a);
    expect(manager.getState().order).toEqual([b, c, a]);
    expect([b, c, a].map((id) => win(manager, id).z)).toEqual([0, 1, 2]);
    expect(manager.getState().focusedId).toBe(a);
  });

  it('does not grow z without bound', () => {
    const manager = setup();
    const ids = Array.from({ length: 5 }, () => manager.open({ appId: 'notes' }));
    for (let i = 0; i < 40; i += 1) manager.focus(ids[i % 5] as WindowId);
    const zs = ids.map((id) => win(manager, id).z).sort();
    expect(zs).toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps always-on-top windows above the others', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const b = manager.open({ appId: 'notes' });
    manager.setAlwaysOnTop(a, true);
    expect(manager.getState().order).toEqual([b, a]);
    manager.focus(b);
    expect(manager.getState().order).toEqual([b, a]);
    expect(win(manager, a).z).toBe(0);
    expect(win(manager, b).z).toBe(0);
    const c = manager.open({ appId: 'notes' });
    expect(manager.getState().order).toEqual([b, c, a]);
    manager.setAlwaysOnTop(a, false);
    expect(manager.getState().order).toEqual([b, c, a]);
    expect(win(manager, a).alwaysOnTop).toBe(false);
  });

  it('opens a window always on top', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes', alwaysOnTop: true });
    const b = manager.open({ appId: 'notes' });
    expect(manager.getState().order).toEqual([b, a]);
  });

  it('throws UNKNOWN_WINDOW for unknown ids', async () => {
    const manager = setup();
    expect(codeOf(() => manager.focus('nope'))).toBe('UNKNOWN_WINDOW');
    expect(codeOf(() => manager.minimize('nope'))).toBe('UNKNOWN_WINDOW');
    expect(codeOf(() => manager.setCloseGuard('nope', null))).toBe('UNKNOWN_WINDOW');
    await expect(manager.close('nope')).rejects.toMatchObject({ code: 'UNKNOWN_WINDOW' });
  });

  it('cycles in most-recently-used order and skips minimized windows', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const b = manager.open({ appId: 'notes' });
    const c = manager.open({ appId: 'notes' });
    manager.cycleFocus();
    expect(manager.getState().focusedId).toBe(b);
    manager.cycleFocus();
    expect(manager.getState().focusedId).toBe(c);
    manager.cycleFocus(-1);
    expect(manager.getState().focusedId).toBe(a);
    manager.minimize(b);
    manager.focus(c);
    manager.cycleFocus();
    expect(manager.getState().focusedId).toBe(a);
  });

  it('does nothing when cycling with no windows', () => {
    const manager = setup();
    manager.cycleFocus();
    expect(manager.getState().focusedId).toBeNull();
  });
});

describe('minimize, maximize, restore, fullscreen', () => {
  it('minimizes, moves focus to the next window and restores on focus', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const b = manager.open({ appId: 'notes' });
    manager.minimize(b);
    expect(win(manager, b).status).toBe('minimized');
    expect(manager.getState().focusedId).toBe(a);
    manager.focus(b);
    expect(win(manager, b).status).toBe('normal');
    expect(manager.getState().focusedId).toBe(b);
  });

  it('leaves nothing focused when the last window is minimized', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.minimize(a);
    expect(manager.getState().focusedId).toBeNull();
    manager.restore(a);
    expect(manager.getState().focusedId).toBe(a);
  });

  it('maximizes to the work area and restores the old bounds', () => {
    const manager = setup();
    manager.setViewport({ width: 1000, height: 700 }, { top: 0, right: 0, bottom: 48, left: 0 });
    const a = manager.open({ appId: 'notes', bounds: { x: 100, y: 50 } });
    const before = win(manager, a).bounds;
    manager.maximize(a);
    expect(win(manager, a)).toMatchObject({
      status: 'maximized',
      bounds: { x: 0, y: 0, width: 1000, height: 652 },
      restoreBounds: before,
    });
    manager.restore(a);
    expect(win(manager, a)).toMatchObject({
      status: 'normal',
      bounds: before,
      restoreBounds: null,
    });
  });

  it('toggles maximize', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.toggleMaximize(a);
    expect(win(manager, a).status).toBe('maximized');
    manager.toggleMaximize(a);
    expect(win(manager, a).status).toBe('normal');
  });

  it('does not maximize or resize a window that is not resizable', () => {
    const manager = setup();
    const a = manager.open({ appId: 'fixed' });
    const before = win(manager, a).bounds;
    manager.maximize(a);
    manager.resize(a, { x: 0, y: 0, width: 700, height: 500 });
    expect(win(manager, a)).toMatchObject({ status: 'normal', bounds: before });
  });

  it('returns a minimized maximized window to maximized', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.maximize(a);
    manager.minimize(a);
    expect(win(manager, a).status).toBe('minimized');
    manager.restore(a);
    expect(win(manager, a).status).toBe('maximized');
  });

  it('maximizes a minimized window', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.minimize(a);
    manager.maximize(a);
    expect(win(manager, a).status).toBe('maximized');
    expect(manager.getState().focusedId).toBe(a);
  });

  it('goes fullscreen over the whole viewport, ignoring insets, and back', () => {
    const manager = setup();
    manager.setViewport({ width: 1000, height: 700 }, { top: 0, right: 0, bottom: 48, left: 0 });
    const a = manager.open({ appId: 'notes' });
    const before = win(manager, a).bounds;
    manager.setFullscreen(a, true);
    expect(win(manager, a)).toMatchObject({
      status: 'fullscreen',
      bounds: { x: 0, y: 0, width: 1000, height: 700 },
      restoreBounds: before,
    });
    manager.setFullscreen(a, true);
    manager.setFullscreen(a, false);
    expect(win(manager, a)).toMatchObject({
      status: 'normal',
      bounds: before,
      restoreBounds: null,
    });
    manager.setFullscreen(a, false);
    expect(win(manager, a).status).toBe('normal');
  });

  it('returns from fullscreen to maximized when it started there', () => {
    const manager = setup();
    manager.setViewport({ width: 1000, height: 700 }, { top: 0, right: 0, bottom: 48, left: 0 });
    const a = manager.open({ appId: 'notes' });
    manager.maximize(a);
    manager.setFullscreen(a, true);
    manager.setFullscreen(a, false);
    expect(win(manager, a)).toMatchObject({
      status: 'maximized',
      bounds: { x: 0, y: 0, width: 1000, height: 652 },
    });
  });

  it('restore leaves fullscreen for the normal bounds', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const before = win(manager, a).bounds;
    manager.maximize(a);
    manager.setFullscreen(a, true);
    manager.restore(a);
    expect(win(manager, a)).toMatchObject({ status: 'normal', bounds: before });
  });

  it('goes fullscreen from minimized', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.minimize(a);
    manager.setFullscreen(a, true);
    expect(win(manager, a).status).toBe('fullscreen');
  });

  it('does not notify when nothing changes', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.restore(a);
    manager.setFullscreen(a, false);
    manager.focus(a);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('move and resize', () => {
  it('moves a normal window and keeps the title bar visible', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.move(a, { x: 200, y: 120 });
    expect(win(manager, a).bounds).toMatchObject({ x: 200, y: 120 });
    manager.move(a, { x: 5000, y: 5000 });
    expect(win(manager, a).bounds).toMatchObject({ x: 952, y: 652 });
    manager.move(a, { x: -5000, y: -5000 });
    expect(win(manager, a).bounds).toMatchObject({ x: -352, y: 0 });
  });

  it('ignores move and resize for maximized windows', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.maximize(a);
    manager.move(a, { x: 10, y: 10 });
    manager.resize(a, { x: 0, y: 0, width: 300, height: 300 });
    expect(win(manager, a).bounds).toEqual({ x: 0, y: 0, width: 1000, height: 700 });
  });

  it('resizes within the size rules', () => {
    const manager = setup();
    const a = manager.open({ appId: 'bounded' });
    manager.resize(a, { x: 10, y: 10, width: 9999, height: 50 });
    expect(win(manager, a).bounds).toEqual({ x: 10, y: 10, width: 500, height: 200 });
  });

  it('rejects invalid values with INVALID_BOUNDS', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    expect(codeOf(() => manager.move(a, { x: Number.POSITIVE_INFINITY, y: 0 }))).toBe(
      'INVALID_BOUNDS',
    );
    expect(codeOf(() => manager.resize(a, { x: 0, y: 0, width: -1, height: 100 }))).toBe(
      'INVALID_BOUNDS',
    );
  });

  it('re-clamps every window when the viewport changes', () => {
    const manager = setup();
    const normal = manager.open({ appId: 'notes', bounds: { x: 900, y: 100 } });
    const max = manager.open({ appId: 'notes' });
    manager.maximize(max);
    const full = manager.open({ appId: 'notes' });
    manager.setFullscreen(full, true);
    const hidden = manager.open({ appId: 'notes' });
    manager.maximize(hidden);
    manager.minimize(hidden);

    manager.setViewport({ width: 500, height: 400 }, { top: 0, right: 0, bottom: 40, left: 0 });
    expect(win(manager, normal).bounds).toMatchObject({ x: 452, y: 100 });
    expect(win(manager, max).bounds).toEqual({ x: 0, y: 0, width: 500, height: 360 });
    expect(win(manager, full).bounds).toEqual({ x: 0, y: 0, width: 500, height: 400 });
    expect(win(manager, hidden).bounds).toEqual({ x: 0, y: 0, width: 500, height: 360 });
    expect(manager.getState().viewport).toEqual({ width: 500, height: 400 });
  });

  it('rejects an invalid viewport', () => {
    const manager = setup();
    expect(codeOf(() => manager.setViewport({ width: -1, height: 100 }))).toBe('INVALID_BOUNDS');
    expect(codeOf(() => manager.setViewport({ width: Number.NaN, height: 100 }))).toBe(
      'INVALID_BOUNDS',
    );
  });
});

describe('snap', () => {
  const start = { x: 100, y: 50, width: 400, height: 300 };

  function opened(manager: WindowManager): WindowId {
    return manager.open({ appId: 'notes', bounds: start });
  }

  it('snaps to a zone of the work area and remembers the normal bounds', () => {
    const manager = setup();
    manager.setViewport({ width: 1000, height: 700 }, { top: 0, right: 0, bottom: 48, left: 0 });
    const a = opened(manager);
    manager.snap(a, 'right');
    expect(win(manager, a)).toMatchObject({
      status: 'normal',
      snap: 'right',
      bounds: { x: 500, y: 0, width: 500, height: 652 },
      restoreBounds: start,
    });
    manager.snap(a, 'bottom-left');
    expect(win(manager, a)).toMatchObject({
      snap: 'bottom-left',
      bounds: { x: 0, y: 326, width: 500, height: 326 },
      restoreBounds: start,
    });
    manager.snap(a, 'center-third');
    expect(win(manager, a)).toMatchObject({
      snap: 'center-third',
      bounds: { x: 333, y: 0, width: 334, height: 652 },
      restoreBounds: start,
    });
  });

  it('focuses and raises the snapped window', () => {
    const manager = setup();
    const a = opened(manager);
    const b = opened(manager);
    manager.snap(a, 'left');
    expect(manager.getState().focusedId).toBe(a);
    expect(manager.getState().order).toEqual([b, a]);
  });

  it('restore and snap(null) bring back the normal bounds', () => {
    const manager = setup();
    const a = opened(manager);
    manager.snap(a, 'left');
    manager.restore(a);
    expect(win(manager, a)).toMatchObject({ snap: null, bounds: start, restoreBounds: null });

    manager.snap(a, 'left');
    manager.snap(a, null);
    expect(win(manager, a)).toMatchObject({
      status: 'normal',
      snap: null,
      bounds: start,
      restoreBounds: null,
    });
  });

  it('snap(null) on a window that is not snapped does nothing', () => {
    const manager = setup();
    const a = opened(manager);
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.snap(a, null);
    manager.maximize(a);
    listener.mockClear();
    manager.snap(a, null);
    expect(listener).not.toHaveBeenCalled();
    expect(win(manager, a).status).toBe('maximized');
  });

  it('snapping a maximized window keeps the original normal bounds', () => {
    const manager = setup();
    const a = opened(manager);
    manager.maximize(a);
    manager.snap(a, 'left');
    expect(win(manager, a)).toMatchObject({
      status: 'normal',
      snap: 'left',
      restoreBounds: start,
    });
    manager.restore(a);
    expect(win(manager, a).bounds).toEqual(start);
  });

  it('maximizing a snapped window clears the snap and keeps the original bounds', () => {
    const manager = setup();
    const a = opened(manager);
    manager.snap(a, 'right');
    manager.maximize(a);
    expect(win(manager, a)).toMatchObject({
      status: 'maximized',
      snap: null,
      restoreBounds: start,
    });
    manager.restore(a);
    expect(win(manager, a).bounds).toEqual(start);
  });

  it('going fullscreen from a snap clears it, and leaving returns to the normal bounds', () => {
    const manager = setup();
    const a = opened(manager);
    manager.snap(a, 'right');
    manager.setFullscreen(a, true);
    expect(win(manager, a)).toMatchObject({ status: 'fullscreen', snap: null });
    manager.setFullscreen(a, false);
    expect(win(manager, a)).toMatchObject({ status: 'normal', snap: null, bounds: start });
  });

  it('snaps a minimized window and brings it back', () => {
    const manager = setup();
    const a = opened(manager);
    manager.minimize(a);
    manager.snap(a, 'left');
    expect(win(manager, a)).toMatchObject({ status: 'normal', snap: 'left', restoreBounds: start });
    expect(manager.getState().focusedId).toBe(a);
  });

  it('keeps the snap through minimize and restore', () => {
    const manager = setup();
    const a = opened(manager);
    manager.snap(a, 'left');
    manager.minimize(a);
    manager.restore(a);
    expect(win(manager, a)).toMatchObject({ status: 'normal', snap: 'left' });
  });

  it('unsnaps a minimized window without restoring it', () => {
    const manager = setup();
    const a = opened(manager);
    manager.snap(a, 'left');
    manager.minimize(a);
    manager.snap(a, null);
    expect(win(manager, a)).toMatchObject({
      status: 'minimized',
      snap: null,
      bounds: start,
      restoreBounds: null,
    });
  });

  it('ignores snapping for fixed-size apps and fullscreen windows', () => {
    const manager = setup();
    const fixed = manager.open({ appId: 'fixed' });
    const fixedBefore = win(manager, fixed);
    manager.snap(fixed, 'left');
    expect(win(manager, fixed)).toEqual(fixedBefore);

    const a = opened(manager);
    manager.setFullscreen(a, true);
    manager.snap(a, 'left');
    expect(win(manager, a)).toMatchObject({ status: 'fullscreen', snap: null });
  });

  it('respects the min size of the app when a zone is smaller', () => {
    const manager = setup();
    manager.setViewport({ width: 600, height: 400 });
    const a = manager.open({ appId: 'bounded' });
    manager.snap(a, 'left-third');
    expect(win(manager, a).bounds).toMatchObject({ width: 300, height: 400 });
    manager.snap(a, 'top-left');
    expect(win(manager, a).bounds).toMatchObject({ width: 300, height: 200 });
  });

  it('moving or resizing a snapped window unsnaps it', () => {
    const manager = setup();
    const a = opened(manager);
    manager.snap(a, 'left');
    manager.move(a, { x: 300, y: 200 });
    expect(win(manager, a)).toMatchObject({
      snap: null,
      restoreBounds: null,
      bounds: { x: 300, y: 200, width: 400, height: 300 },
    });

    manager.snap(a, 'right');
    manager.resize(a, { x: 10, y: 10, width: 320, height: 240 });
    expect(win(manager, a)).toMatchObject({
      snap: null,
      restoreBounds: null,
      bounds: { x: 10, y: 10, width: 320, height: 240 },
    });
  });

  it('drag-restore: a snapped window moved by the pointer gets its normal size back', () => {
    const manager = setup();
    const a = opened(manager);
    manager.snap(a, 'right');
    const snapped = win(manager, a);
    const pointer = { x: 750, y: 12 };
    const next = dragRestoreBounds(
      pointer,
      snapped.bounds,
      snapped.restoreBounds as NonNullable<typeof snapped.restoreBounds>,
    );
    manager.move(a, { x: next.x, y: next.y });
    expect(win(manager, a)).toMatchObject({
      snap: null,
      bounds: { x: 550, y: 0, width: 400, height: 300 },
    });
  });

  it('fits a snapped window to the new area when the viewport changes', () => {
    const manager = setup();
    const a = opened(manager);
    const b = opened(manager);
    manager.snap(a, 'right');
    manager.snap(b, 'top-left');
    manager.minimize(b);
    manager.setViewport({ width: 800, height: 600 }, { top: 0, right: 0, bottom: 40, left: 0 });
    expect(win(manager, a).bounds).toEqual({ x: 400, y: 0, width: 400, height: 560 });
    expect(win(manager, b).bounds).toEqual({ x: 0, y: 0, width: 400, height: 280 });
    manager.restore(a);
    expect(win(manager, a).bounds).toEqual(start);
  });

  it('emits window:changed and does not notify for the same snap twice', () => {
    const manager = setup();
    const a = opened(manager);
    const changed = vi.fn();
    manager.on('window:changed', changed);
    manager.snap(a, 'left');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0]?.[0].window).toMatchObject({ id: a, snap: 'left' });
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.snap(a, 'left');
    expect(listener).not.toHaveBeenCalled();
  });

  it('throws UNKNOWN_WINDOW for an unknown id', () => {
    const manager = setup();
    expect(codeOf(() => manager.snap('nope', 'left'))).toBe('UNKNOWN_WINDOW');
  });
});

describe('child and modal windows', () => {
  it('opens a child on its parent desktop', () => {
    const manager = createWindowManager({
      apps,
      desktops: [
        { id: 'one', name: 'One' },
        { id: 'two', name: 'Two' },
      ],
    });
    const parent = manager.open({ appId: 'notes', desktopId: 'two' });
    const child = manager.open({ appId: 'notes', parentId: parent, desktopId: 'one' });
    expect(win(manager, child)).toMatchObject({ parentId: parent, desktopId: 'two' });
  });

  it('raises the children with their parent', () => {
    const manager = setup();
    const parent = manager.open({ appId: 'notes' });
    const child = manager.open({ appId: 'notes', parentId: parent });
    const other = manager.open({ appId: 'notes' });
    manager.focus(parent);
    expect(manager.getState().order).toEqual([other, parent, child]);
    expect(manager.getState().focusedId).toBe(parent);
  });

  it('minimizes and restores children with the parent', () => {
    const manager = setup();
    const parent = manager.open({ appId: 'notes' });
    const child = manager.open({ appId: 'notes', parentId: parent });
    manager.minimize(parent);
    expect(win(manager, parent).status).toBe('minimized');
    expect(win(manager, child).status).toBe('minimized');
    expect(manager.getState().focusedId).toBeNull();
    manager.restore(parent);
    expect(win(manager, child).status).toBe('normal');
  });

  it('minimizing a child gives focus back to the parent', () => {
    const manager = setup();
    const parent = manager.open({ appId: 'notes' });
    const child = manager.open({ appId: 'notes', parentId: parent });
    manager.open({ appId: 'notes' });
    manager.focus(child);
    manager.minimize(child);
    expect(manager.getState().focusedId).toBe(parent);
  });

  it('focusing a child under a minimized parent restores the parent', () => {
    const manager = setup();
    const parent = manager.open({ appId: 'notes' });
    const child = manager.open({ appId: 'notes', parentId: parent });
    manager.minimize(parent);
    manager.focus(child);
    expect(win(manager, parent).status).toBe('normal');
    expect(win(manager, child).status).toBe('normal');
  });

  it('a modal child takes focus from its parent, and gives it back when closed', async () => {
    const manager = setup();
    const parent = manager.open({ appId: 'notes' });
    const modal = manager.open({ appId: 'notes', parentId: parent, modal: true });
    expect(win(manager, modal).modal).toBe(true);
    expect(manager.getState().focusedId).toBe(modal);
    manager.focus(parent);
    expect(manager.getState().focusedId).toBe(modal);
    await manager.close(modal);
    expect(manager.getState().focusedId).toBe(parent);
    manager.focus(parent);
    expect(manager.getState().focusedId).toBe(parent);
  });

  it('focuses the topmost modal child, down the chain', () => {
    const manager = setup();
    const parent = manager.open({ appId: 'notes' });
    const first = manager.open({ appId: 'notes', parentId: parent, modal: true });
    const nested = manager.open({ appId: 'notes', parentId: first, modal: true });
    manager.focus(parent);
    expect(manager.getState().focusedId).toBe(nested);
  });

  it('ignores modal without a parent', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes', modal: true });
    expect(win(manager, a).modal).toBe(false);
  });

  it('children follow the always-on-top layer of their parent', () => {
    const manager = setup();
    const parent = manager.open({ appId: 'notes', alwaysOnTop: true });
    const child = manager.open({ appId: 'notes', parentId: parent });
    expect(win(manager, child).alwaysOnTop).toBe(true);
    manager.setAlwaysOnTop(parent, false);
    expect(win(manager, child).alwaysOnTop).toBe(false);
  });

  it('closing a parent closes its children', async () => {
    const manager = setup();
    const parent = manager.open({ appId: 'notes' });
    const child = manager.open({ appId: 'notes', parentId: parent });
    const grandchild = manager.open({ appId: 'notes', parentId: child });
    const keep = manager.open({ appId: 'notes' });
    await manager.close(parent);
    expect(Object.keys(manager.getState().windows)).toEqual([keep]);
    expect(manager.getState().windows[grandchild]).toBeUndefined();
    expect(manager.getState().focusedId).toBe(keep);
  });
});

describe('close and guards', () => {
  it('focuses the top window of the same desktop after closing the focused one', async () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const b = manager.open({ appId: 'notes' });
    const c = manager.open({ appId: 'notes' });
    manager.minimize(b);
    manager.focus(c);
    await manager.close(c);
    expect(manager.getState().focusedId).toBe(a);
    await manager.close(a);
    manager.minimize(b);
    expect(manager.getState().focusedId).toBeNull();
  });

  it('keeps focus when an unfocused window closes', async () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const b = manager.open({ appId: 'notes' });
    expect(await manager.close(a)).toBe(true);
    expect(manager.getState().focusedId).toBe(b);
  });

  it('a guard that returns false refuses the close; true allows it', async () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.setCloseGuard(a, () => false);
    expect(await manager.close(a)).toBe(false);
    expect(manager.getState().windows[a]).toBeDefined();
    manager.setCloseGuard(a, async () => true);
    expect(await manager.close(a)).toBe(true);
    expect(manager.getState().windows[a]).toBeUndefined();
  });

  it('clears a guard with null', async () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.setCloseGuard(a, () => false);
    manager.setCloseGuard(a, null);
    expect(await manager.close(a)).toBe(true);
  });

  it('force skips guards', async () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const guard = vi.fn(() => false);
    manager.setCloseGuard(a, guard);
    expect(await manager.close(a, { force: true })).toBe(true);
    expect(guard).not.toHaveBeenCalled();
  });

  it('runs the window guard first, then its children, and any false cancels', async () => {
    const manager = setup();
    const parent = manager.open({ appId: 'notes' });
    const child = manager.open({ appId: 'notes', parentId: parent });
    const calls: string[] = [];
    manager.setCloseGuard(parent, async () => {
      calls.push('parent');
      return true;
    });
    manager.setCloseGuard(child, () => {
      calls.push('child');
      return false;
    });
    expect(await manager.close(parent)).toBe(false);
    expect(calls).toEqual(['parent', 'child']);
    expect(Object.keys(manager.getState().windows)).toHaveLength(2);

    manager.setCloseGuard(parent, () => {
      calls.push('parent again');
      return false;
    });
    calls.length = 0;
    expect(await manager.close(parent)).toBe(false);
    expect(calls).toEqual(['parent again']);
  });

  it('resolves true when the window was closed while a guard was pending', async () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.setCloseGuard(a, async () => {
      await manager.close(a, { force: true });
      return true;
    });
    expect(await manager.close(a)).toBe(true);
  });
});

describe('update', () => {
  it('changes title, badge, dirty and data', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.update(a, { title: 'New', badge: 3, dirty: true, data: { x: 1 } });
    expect(win(manager, a)).toMatchObject({
      title: 'New',
      badge: 3,
      dirty: true,
      data: { x: 1 },
    });
    manager.update(a, { badge: null, data: undefined });
    expect(win(manager, a)).toMatchObject({ badge: null, data: undefined });
  });

  it('does not notify when nothing changes', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes', title: 'Same' });
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.update(a, { title: 'Same' });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('subscribe and events', () => {
  it('notifies subscribers after each change and stops after unsubscribe', () => {
    const manager = setup();
    const listener = vi.fn();
    const unsubscribe = manager.subscribe(listener);
    const a = manager.open({ appId: 'notes' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(manager.getState());
    unsubscribe();
    manager.focus(a);
    manager.minimize(a);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('replaces the state object on every change and keeps untouched windows', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const b = manager.open({ appId: 'notes' });
    const before = manager.getState();
    manager.update(b, { title: 'Changed' });
    const after = manager.getState();
    expect(after).not.toBe(before);
    expect(after.windows[a]).toBe(before.windows[a]);
    expect(after.windows[b]).not.toBe(before.windows[b]);
  });

  it('emits opened, focused, changed and closed with their payloads', async () => {
    const manager = setup();
    const opened = vi.fn();
    const focused = vi.fn();
    const changed = vi.fn();
    const closed = vi.fn();
    manager.on('window:opened', opened);
    manager.on('window:focused', focused);
    manager.on('window:changed', changed);
    manager.on('window:closed', closed);

    const a = manager.open({ appId: 'notes' });
    expect(opened).toHaveBeenCalledWith({ window: win(manager, a) });
    expect(focused).toHaveBeenLastCalledWith({ windowId: a });
    expect(changed).not.toHaveBeenCalled();

    manager.update(a, { title: 'Renamed' });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0]?.[0].window.title).toBe('Renamed');

    const closedWindow = win(manager, a);
    await manager.close(a);
    expect(closed).toHaveBeenCalledWith({ window: closedWindow });
    expect(focused).toHaveBeenLastCalledWith({ windowId: null });
  });

  it('does not report a z-only change as window:changed', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.open({ appId: 'notes' });
    const changed = vi.fn();
    manager.on('window:changed', changed);
    manager.focus(a);
    expect(changed).not.toHaveBeenCalled();
  });

  it('emits events after the state is updated, and handlers can unsubscribe', () => {
    const manager = setup();
    const seen: (WindowId | null)[] = [];
    const off = manager.on('window:focused', () => {
      seen.push(manager.getState().focusedId);
    });
    const a = manager.open({ appId: 'notes' });
    off();
    manager.open({ appId: 'notes' });
    expect(seen).toEqual([a]);
  });

  it('destroy removes every listener and handler', () => {
    const manager = setup();
    const listener = vi.fn();
    const handler = vi.fn();
    manager.subscribe(listener);
    manager.on('window:opened', handler);
    manager.destroy();
    manager.open({ appId: 'notes' });
    expect(listener).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
});
