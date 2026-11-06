import { describe, expect, it, vi } from 'vitest';
import { createWindowManager } from './createWindowManager';
import { WindowManagerError } from './errors';
import type { AppDefinition, WindowId, WindowManager, WindowState } from './types';

const apps: AppDefinition[] = [
  { id: 'notes', title: 'Notes', placement: { pinned: true } },
  { id: 'terminal', title: 'Terminal' },
  { id: 'hidden', title: 'Hidden', placement: { desktop: false } },
];

function setup(desktops: { id?: string; name: string }[] = [{ name: 'One' }, { name: 'Two' }]) {
  const manager = createWindowManager({ apps, desktops });
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

async function rejectionCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof WindowManagerError ? error.code : 'OTHER';
  }
  return undefined;
}

describe('desktops: add, rename, wallpaper', () => {
  it('starts with the configured desktops and the first one active', () => {
    const manager = setup();
    const state = manager.getState();
    expect(state.desktops.map((d) => d.name)).toEqual(['One', 'Two']);
    expect(state.desktops.map((d) => d.id)).toEqual(['desktop-1', 'desktop-2']);
    expect(state.activeDesktopId).toBe('desktop-1');
  });

  it('adds a desktop with a default or given name, without switching to it', () => {
    const manager = setup();
    const a = manager.addDesktop();
    const b = manager.addDesktop('Work');
    const state = manager.getState();
    expect(state.desktops.map((d) => d.name)).toEqual(['One', 'Two', 'Desktop 3', 'Work']);
    expect(new Set([a, b, 'desktop-1', 'desktop-2']).size).toBe(4);
    expect(state.activeDesktopId).toBe('desktop-1');
    expect(state.desktops[2]?.wallpaper).toBeNull();
  });

  it('never reuses an id that a custom desktop already has', () => {
    const manager = setup([{ id: 'desktop-2', name: 'Custom' }]);
    const id = manager.addDesktop();
    expect(id).not.toBe('desktop-2');
    expect(manager.getState().desktops).toHaveLength(2);
  });

  it('renames a desktop and throws for an unknown one', () => {
    const manager = setup();
    manager.renameDesktop('desktop-2', 'Chat');
    expect(manager.getState().desktops[1]?.name).toBe('Chat');
    expect(codeOf(() => manager.renameDesktop('nope', 'x'))).toBe('UNKNOWN_DESKTOP');
  });

  it('does not notify when the name does not change', () => {
    const manager = setup();
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.renameDesktop('desktop-1', 'One');
    expect(listener).not.toHaveBeenCalled();
  });

  it('sets and clears a wallpaper', () => {
    const manager = setup();
    manager.setWallpaper('desktop-2', { type: 'color', value: '#123456' });
    expect(manager.getState().desktops[1]?.wallpaper).toEqual({ type: 'color', value: '#123456' });
    expect(manager.getState().desktops[0]?.wallpaper).toBeNull();
    manager.setWallpaper('desktop-2', null);
    expect(manager.getState().desktops[1]?.wallpaper).toBeNull();
    expect(codeOf(() => manager.setWallpaper('nope', null))).toBe('UNKNOWN_DESKTOP');
  });
});

describe('desktops: switch and move', () => {
  it('switches and focuses the topmost visible window of that desktop', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.switchDesktop('desktop-2');
    expect(manager.getState().activeDesktopId).toBe('desktop-2');
    expect(manager.getState().focusedId).toBeNull();
    const b = manager.open({ appId: 'notes' });
    const c = manager.open({ appId: 'terminal' });
    manager.minimize(c);
    manager.switchDesktop('desktop-1');
    expect(manager.getState().focusedId).toBe(a);
    manager.switchDesktop('desktop-2');
    expect(manager.getState().focusedId).toBe(b);
  });

  it('opens new windows on the active desktop', () => {
    const manager = setup();
    manager.switchDesktop('desktop-2');
    const a = manager.open({ appId: 'notes' });
    expect(win(manager, a).desktopId).toBe('desktop-2');
  });

  it('emits desktop:changed once per switch and ignores a switch to the active desktop', () => {
    const manager = setup();
    const changed = vi.fn();
    manager.on('desktop:changed', changed);
    manager.switchDesktop('desktop-1');
    expect(changed).not.toHaveBeenCalled();
    manager.switchDesktop('desktop-2');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith({ desktopId: 'desktop-2' });
    expect(codeOf(() => manager.switchDesktop('nope'))).toBe('UNKNOWN_DESKTOP');
  });

  it('focusing a window on another desktop switches to it', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.switchDesktop('desktop-2');
    manager.focus(a);
    expect(manager.getState().activeDesktopId).toBe('desktop-1');
  });

  it('moves a window to another desktop and focuses the next one here', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const b = manager.open({ appId: 'notes' });
    manager.moveToDesktop(b, 'desktop-2');
    expect(win(manager, b).desktopId).toBe('desktop-2');
    expect(manager.getState().activeDesktopId).toBe('desktop-1');
    expect(manager.getState().focusedId).toBe(a);
  });

  it('keeps the focus when an unfocused window moves, and ignores a move to its own desktop', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const b = manager.open({ appId: 'notes' });
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.moveToDesktop(b, 'desktop-1');
    expect(listener).not.toHaveBeenCalled();
    manager.moveToDesktop(a, 'desktop-2');
    expect(manager.getState().focusedId).toBe(b);
  });

  it('moves the whole tree when a child is moved', () => {
    const manager = setup();
    const parent = manager.open({ appId: 'notes' });
    const child = manager.open({ appId: 'terminal', parentId: parent });
    manager.moveToDesktop(child, 'desktop-2');
    expect(win(manager, parent).desktopId).toBe('desktop-2');
    expect(win(manager, child).desktopId).toBe('desktop-2');
    expect(manager.getState().focusedId).toBeNull();
  });

  it('throws for unknown windows and desktops', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    expect(codeOf(() => manager.moveToDesktop('nope', 'desktop-2'))).toBe('UNKNOWN_WINDOW');
    expect(codeOf(() => manager.moveToDesktop(a, 'nope'))).toBe('UNKNOWN_DESKTOP');
  });
});

describe('desktops: remove', () => {
  it('throws LAST_DESKTOP for the only desktop and UNKNOWN_DESKTOP for a missing one', async () => {
    const single = setup([{ name: 'Only' }]);
    expect(await rejectionCode(single.removeDesktop('desktop-1'))).toBe('LAST_DESKTOP');
    const manager = setup();
    expect(await rejectionCode(manager.removeDesktop('nope'))).toBe('UNKNOWN_DESKTOP');
    expect(await rejectionCode(manager.removeDesktop('desktop-1', { moveWindowsTo: 'nope' }))).toBe(
      'UNKNOWN_DESKTOP',
    );
  });

  it('ignores moveWindowsTo when it is the desktop being removed', async () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    expect(await manager.removeDesktop('desktop-1', { moveWindowsTo: 'desktop-1' })).toBe(true);
    expect(manager.getState().windows[a]).toBeUndefined();
    expect(manager.getState().desktops.map((d) => d.id)).toEqual(['desktop-2']);
  });

  it('closes the windows of the removed desktop when they are not moved', async () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.switchDesktop('desktop-2');
    const b = manager.open({ appId: 'notes' });
    const closed = vi.fn();
    manager.on('window:closed', closed);
    expect(await manager.removeDesktop('desktop-1')).toBe(true);
    expect(manager.getState().desktops.map((d) => d.id)).toEqual(['desktop-2']);
    expect(manager.getState().windows[a]).toBeUndefined();
    expect(win(manager, b)).toBeDefined();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(manager.getState().order).toEqual([b]);
  });

  it('moves the windows to another desktop when asked', async () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.switchDesktop('desktop-2');
    const b = manager.open({ appId: 'notes' });
    manager.switchDesktop('desktop-1');
    expect(await manager.removeDesktop('desktop-1', { moveWindowsTo: 'desktop-2' })).toBe(true);
    expect(win(manager, a).desktopId).toBe('desktop-2');
    expect(win(manager, b).desktopId).toBe('desktop-2');
    expect(manager.getState().activeDesktopId).toBe('desktop-2');
    expect(manager.getState().focusedId).not.toBeNull();
  });

  it('falls back to the previous desktop (or the next) when the active one is removed', async () => {
    const manager = setup([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
    manager.switchDesktop('desktop-2');
    await manager.removeDesktop('desktop-2');
    expect(manager.getState().activeDesktopId).toBe('desktop-1');
    await manager.removeDesktop('desktop-1');
    expect(manager.getState().activeDesktopId).toBe('desktop-3');
  });

  it('keeps the active desktop and focus when another desktop is removed', async () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    await manager.removeDesktop('desktop-2');
    expect(manager.getState().activeDesktopId).toBe('desktop-1');
    expect(manager.getState().focusedId).toBe(a);
  });

  it('runs close guards of its windows and stops when one refuses', async () => {
    const manager = setup();
    manager.switchDesktop('desktop-2');
    const a = manager.open({ appId: 'notes' });
    manager.setCloseGuard(a, () => false);
    manager.switchDesktop('desktop-1');
    expect(await manager.removeDesktop('desktop-2')).toBe(false);
    expect(manager.getState().desktops).toHaveLength(2);
    expect(win(manager, a)).toBeDefined();
  });

  it('does not run guards when the windows are moved', async () => {
    const manager = setup();
    manager.switchDesktop('desktop-2');
    const a = manager.open({ appId: 'notes' });
    const guard = vi.fn(() => false);
    manager.setCloseGuard(a, guard);
    manager.switchDesktop('desktop-1');
    expect(await manager.removeDesktop('desktop-2', { moveWindowsTo: 'desktop-1' })).toBe(true);
    expect(guard).not.toHaveBeenCalled();
    expect(win(manager, a).desktopId).toBe('desktop-1');
  });
});

describe('show desktop', () => {
  it('minimizes the windows of the active desktop only and restores exactly those', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const b = manager.open({ appId: 'notes' });
    const c = manager.open({ appId: 'terminal' });
    manager.minimize(a); // already minimized before: must stay minimized
    manager.maximize(b);
    manager.switchDesktop('desktop-2');
    const other = manager.open({ appId: 'notes' });
    manager.switchDesktop('desktop-1');

    manager.showDesktop(true);
    expect(manager.getState().showingDesktop).toBe(true);
    expect(win(manager, b).status).toBe('minimized');
    expect(win(manager, c).status).toBe('minimized');
    expect(win(manager, other).status).toBe('normal');
    expect(manager.getState().focusedId).toBeNull();

    manager.showDesktop(false);
    expect(manager.getState().showingDesktop).toBe(false);
    expect(win(manager, a).status).toBe('minimized');
    expect(win(manager, b).status).toBe('maximized');
    expect(win(manager, c).status).toBe('normal');
    expect(manager.getState().focusedId).toBe(b);
  });

  it('toggles when called without an argument and ignores repeated calls', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.showDesktop();
    expect(win(manager, a).status).toBe('minimized');
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.showDesktop(true);
    expect(listener).not.toHaveBeenCalled();
    manager.showDesktop();
    expect(win(manager, a).status).toBe('normal');
    manager.showDesktop(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the window that had it', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.open({ appId: 'notes' });
    manager.focus(a);
    manager.showDesktop(true);
    manager.showDesktop(false);
    expect(manager.getState().focusedId).toBe(a);
  });

  it('ends when a window is focused or opened, leaving the others minimized', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const b = manager.open({ appId: 'notes' });
    manager.showDesktop(true);
    manager.focus(a);
    expect(manager.getState().showingDesktop).toBe(false);
    expect(win(manager, a).status).toBe('normal');
    expect(win(manager, b).status).toBe('minimized');
    manager.showDesktop(false); // nothing is remembered any more
    expect(win(manager, b).status).toBe('minimized');

    manager.showDesktop(true);
    manager.open({ appId: 'terminal' });
    expect(manager.getState().showingDesktop).toBe(false);
  });

  it('skips remembered windows that were closed or moved away', async () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const b = manager.open({ appId: 'notes' });
    const c = manager.open({ appId: 'notes' });
    manager.showDesktop(true);
    await manager.close(a);
    manager.moveToDesktop(b, 'desktop-2');
    manager.showDesktop(false);
    expect(win(manager, c).status).toBe('normal');
    expect(win(manager, b).status).toBe('minimized');
  });

  it('is remembered per desktop', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    manager.showDesktop(true);
    manager.switchDesktop('desktop-2');
    expect(manager.getState().showingDesktop).toBe(false);
    manager.switchDesktop('desktop-1');
    expect(manager.getState().showingDesktop).toBe(true);
    manager.showDesktop(false);
    expect(win(manager, a).status).toBe('normal');
  });

  it('is forgotten when its desktop is removed', async () => {
    const manager = setup();
    manager.switchDesktop('desktop-2');
    manager.open({ appId: 'notes' });
    manager.showDesktop(true);
    await manager.removeDesktop('desktop-2');
    expect(manager.getState().showingDesktop).toBe(false);
  });
});

describe('icons and pinned apps', () => {
  it('starts with desktop icons and pinned apps from the app placement', () => {
    const manager = setup();
    expect(manager.getState().iconOrder).toEqual(['notes', 'terminal']);
    expect(manager.getState().pinnedApps).toEqual(['notes']);
  });

  it('sets the icon order, dropping duplicates', () => {
    const manager = setup();
    manager.setIconOrder(['terminal', 'notes', 'terminal']);
    expect(manager.getState().iconOrder).toEqual(['terminal', 'notes']);
    expect(codeOf(() => manager.setIconOrder(['nope']))).toBe('UNKNOWN_APP');
    expect(manager.getState().iconOrder).toEqual(['terminal', 'notes']);
  });

  it('keeps icons that are not listed, after the listed ones', () => {
    const manager = setup();
    manager.setIconOrder(['terminal']);
    expect(manager.getState().iconOrder).toEqual(['terminal', 'notes']);
    manager.setIconOrder([]);
    expect(manager.getState().iconOrder).toEqual(['terminal', 'notes']);
    manager.setIconOrder(['hidden']);
    expect(manager.getState().iconOrder).toEqual(['hidden', 'terminal', 'notes']);
  });

  it('keeps pins that are not listed, after the listed ones', () => {
    const manager = setup();
    manager.pinApp('terminal');
    manager.pinApp('hidden');
    manager.setPinnedOrder(['hidden']);
    expect(manager.getState().pinnedApps).toEqual(['hidden', 'notes', 'terminal']);
  });

  it('does not notify for an unchanged icon order', () => {
    const manager = setup();
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.setIconOrder(['notes', 'terminal']);
    expect(listener).not.toHaveBeenCalled();
  });

  it('pins at the end or at an index, and moves an already pinned app', () => {
    const manager = setup();
    manager.pinApp('terminal');
    expect(manager.getState().pinnedApps).toEqual(['notes', 'terminal']);
    manager.pinApp('hidden', 0);
    expect(manager.getState().pinnedApps).toEqual(['hidden', 'notes', 'terminal']);
    manager.pinApp('terminal', 1);
    expect(manager.getState().pinnedApps).toEqual(['hidden', 'terminal', 'notes']);
    manager.pinApp('hidden', 99);
    expect(manager.getState().pinnedApps).toEqual(['terminal', 'notes', 'hidden']);
    manager.pinApp('notes', -5);
    expect(manager.getState().pinnedApps).toEqual(['notes', 'terminal', 'hidden']);
    manager.pinApp('terminal', Number.NaN);
    expect(manager.getState().pinnedApps).toEqual(['notes', 'hidden', 'terminal']);
  });

  it('ignores pinning an app that is already pinned without an index', () => {
    const manager = setup();
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.pinApp('notes');
    manager.pinApp('notes', 0);
    expect(listener).not.toHaveBeenCalled();
    expect(codeOf(() => manager.pinApp('nope'))).toBe('UNKNOWN_APP');
  });

  it('unpins, ignoring apps that are not pinned', () => {
    const manager = setup();
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.unpinApp('terminal');
    expect(listener).not.toHaveBeenCalled();
    manager.unpinApp('notes');
    expect(manager.getState().pinnedApps).toEqual([]);
  });

  it('sets the pinned order', () => {
    const manager = setup();
    manager.setPinnedOrder(['terminal', 'notes', 'notes']);
    expect(manager.getState().pinnedApps).toEqual(['terminal', 'notes']);
    expect(codeOf(() => manager.setPinnedOrder(['nope']))).toBe('UNKNOWN_APP');
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.setPinnedOrder(['terminal', 'notes']);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('shell settings', () => {
  it('has the defaults and merges a patch, emitting shell:changed', () => {
    const manager = setup();
    expect(manager.getState().shell).toEqual({
      taskbarPosition: 'bottom',
      taskbarAutoHide: false,
      controlsStyle: 'windows',
    });
    const changed = vi.fn();
    manager.on('shell:changed', changed);
    manager.setShellSettings({ taskbarPosition: 'left', controlsStyle: 'mac' });
    expect(manager.getState().shell).toEqual({
      taskbarPosition: 'left',
      taskbarAutoHide: false,
      controlsStyle: 'mac',
    });
    expect(changed).toHaveBeenCalledTimes(1);
    manager.setShellSettings({ taskbarAutoHide: true });
    expect(manager.getState().shell.taskbarAutoHide).toBe(true);
    expect(manager.getState().shell.taskbarPosition).toBe('left');
  });

  it('ignores empty and unchanged patches', () => {
    const manager = setup();
    const changed = vi.fn();
    manager.on('shell:changed', changed);
    manager.setShellSettings({});
    manager.setShellSettings({ taskbarPosition: 'bottom' });
    expect(changed).not.toHaveBeenCalled();
  });

  it('uses the shell option as the starting settings', () => {
    const manager = createWindowManager({ apps, shell: { controlsStyle: 'mac' } });
    expect(manager.getState().shell.controlsStyle).toBe('mac');
  });
});
