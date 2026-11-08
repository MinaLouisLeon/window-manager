import { act, render, renderHook, screen } from '@testing-library/react';
import { useMemo } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import type { MenuItemModel } from './menuModel';
import { useDesktopMenu, useRegisterDesktopMenuItems } from './useDesktopMenu';
import { SNAP_ZONE_LABELS, useRegisterWindowMenuItems, useWindowMenu } from './useWindowMenu';
import { AppWindowContent } from './WindowManagerProvider';

type Model = MenuItemModel;

function find(items: Model[], id: string): Model {
  const found = items.find((item) => item.id === id);
  if (!found) throw new Error(`No menu entry "${id}" in ${items.map((i) => i.id).join(', ')}`);
  return found;
}

function select(entry: Model): void {
  if (entry.type !== 'item') throw new Error('Not an item');
  act(() => entry.onSelect());
}

function children(entry: Model): Model[] {
  if (entry.type !== 'submenu') throw new Error('Not a submenu');
  return entry.items;
}

describe('useWindowMenu', () => {
  function setup(appId = 'notes', options = {}) {
    const manager = createTestManager();
    const id = manager.open({ appId });
    const { result } = renderHook(() => useWindowMenu(id, options), {
      wrapper: createWrapper(manager),
    });
    return { manager, id, result };
  }

  it('lists the default entries in order', () => {
    const { result } = setup();
    expect(result.current.items.map((item) => item.id)).toEqual([
      'minimize',
      'maximize',
      'snap',
      'separator-state',
      'always-on-top',
      'fullscreen',
      'separator-close',
      'close',
    ]);
  });

  it('is empty once the window is closed', async () => {
    const { result, manager, id } = setup();
    await act(async () => {
      await manager.close(id);
    });
    expect(result.current.items).toEqual([]);
  });

  it('minimizes', () => {
    const { result, manager, id } = setup();
    select(find(result.current.items, 'minimize'));
    expect(manager.getState().windows[id]?.status).toBe('minimized');
    expect(find(result.current.items, 'minimize')).toMatchObject({ disabled: true });
  });

  it('switches between maximize and restore', () => {
    const { result, manager, id } = setup();
    select(find(result.current.items, 'maximize'));
    expect(manager.getState().windows[id]?.status).toBe('maximized');
    expect(find(result.current.items, 'restore')).toMatchObject({ label: 'Restore' });
    select(find(result.current.items, 'restore'));
    expect(manager.getState().windows[id]?.status).toBe('normal');
    expect(find(result.current.items, 'maximize')).toMatchObject({ label: 'Maximize' });
  });

  it('offers restore for a snapped window', () => {
    const { result, manager, id } = setup();
    act(() => manager.snap(id, 'left'));
    select(find(result.current.items, 'restore'));
    expect(manager.getState().windows[id]?.snap).toBeNull();
  });

  it('lists every snap zone as a radio entry', () => {
    const { result, manager, id } = setup();
    const zones = children(find(result.current.items, 'snap'));
    expect(zones).toHaveLength(SNAP_ZONE_LABELS.length);
    expect(zones).toHaveLength(11);
    expect(zones.every((zone) => zone.type === 'item' && zone.kind === 'radio')).toBe(true);

    select(find(zones, 'snap-top-right'));
    expect(manager.getState().windows[id]?.snap).toBe('top-right');
    const after = children(find(result.current.items, 'snap'));
    expect(find(after, 'snap-top-right')).toMatchObject({ checked: true });
    expect(find(after, 'snap-left')).toMatchObject({ checked: false });
  });

  it('toggles always on top and fullscreen as checkbox entries', () => {
    const { result, manager, id } = setup();
    expect(find(result.current.items, 'always-on-top')).toMatchObject({
      kind: 'checkbox',
      checked: false,
    });
    select(find(result.current.items, 'always-on-top'));
    expect(manager.getState().windows[id]?.alwaysOnTop).toBe(true);
    expect(find(result.current.items, 'always-on-top')).toMatchObject({ checked: true });

    select(find(result.current.items, 'fullscreen'));
    expect(manager.getState().windows[id]?.status).toBe('fullscreen');
    expect(find(result.current.items, 'fullscreen')).toMatchObject({ checked: true });
    select(find(result.current.items, 'fullscreen'));
    expect(manager.getState().windows[id]?.status).not.toBe('fullscreen');
  });

  it('shows the configured shortcuts', () => {
    const { result } = setup();
    expect(find(result.current.items, 'minimize')).toMatchObject({ shortcut: 'Ctrl+Alt+M' });
    expect(find(result.current.items, 'close')).toMatchObject({
      shortcut: 'Ctrl+Alt+W',
      destructive: true,
    });
    const snap = children(find(result.current.items, 'snap'));
    expect(find(snap, 'snap-left')).toMatchObject({ shortcut: 'Ctrl+Alt+ArrowLeft' });
  });

  it('closes the window', async () => {
    const { result, manager, id } = setup();
    select(find(result.current.items, 'close'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(manager.getState().windows[id]).toBeUndefined();
  });

  it('disables maximize and snap for a fixed-size app', () => {
    const { result } = setup('fixed');
    expect(find(result.current.items, 'maximize')).toMatchObject({ disabled: true });
    expect(find(result.current.items, 'snap')).toMatchObject({ disabled: true });
  });

  it('offers move to desktop only with several desktops, for top-level windows', () => {
    const manager = createTestManager();
    const id = manager.open({ appId: 'notes' });
    const child = manager.open({ appId: 'notes', parentId: id });
    const wrapper = createWrapper(manager);
    const top = renderHook(() => useWindowMenu(id), { wrapper });
    expect(top.result.current.items.map((item) => item.id)).not.toContain('move-to-desktop');

    let second = '';
    act(() => {
      second = manager.addDesktop('Work');
    });
    const entry = find(top.result.current.items, 'move-to-desktop');
    expect(children(entry).map((item) => item.type === 'item' && item.label)).toEqual([
      'Desktop 1',
      'Work',
    ]);
    expect(find(children(entry), 'desktop-desktop-1')).toMatchObject({ checked: true });
    select(find(children(entry), `desktop-${second}`));
    expect(manager.getState().windows[id]?.desktopId).toBe(second);
    expect(manager.getState().windows[child]?.desktopId).toBe(second);

    const childMenu = renderHook(() => useWindowMenu(child), { wrapper });
    expect(childMenu.result.current.items.map((item) => item.id)).not.toContain('move-to-desktop');
  });

  it('adds Move and Resize only when their callbacks are given', () => {
    const onMove = vi.fn();
    const onResize = vi.fn();
    const { result } = setup('notes', { onMove, onResize });
    select(find(result.current.items, 'move'));
    select(find(result.current.items, 'resize'));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onResize).toHaveBeenCalledTimes(1);

    const bare = setup();
    expect(bare.result.current.items.map((item) => item.id)).not.toContain('move');
  });

  it('disables Move and Resize unless the window is normal (and resizable for Resize)', () => {
    const { result, manager, id } = setup('notes', { onMove: vi.fn(), onResize: vi.fn() });
    expect(find(result.current.items, 'move')).toMatchObject({ disabled: false });
    act(() => manager.maximize(id));
    expect(find(result.current.items, 'move')).toMatchObject({ disabled: true });
    expect(find(result.current.items, 'resize')).toMatchObject({ disabled: true });

    const fixed = setup('fixed', { onMove: vi.fn(), onResize: vi.fn() });
    expect(find(fixed.result.current.items, 'move')).toMatchObject({ disabled: false });
    expect(find(fixed.result.current.items, 'resize')).toMatchObject({ disabled: true });
  });
});

describe('useRegisterWindowMenuItems', () => {
  const entry: Model = { type: 'item', id: 'app-action', label: 'Export', onSelect: () => {} };

  it('adds app entries before Close and removes them when the app unmounts', () => {
    const manager = createTestManager();
    const id = manager.open({ appId: 'notes' });
    // biome-ignore lint/correctness/noComponentHookFactories: test component that closes over per-test state
    function Notes() {
      const items = useMemo(() => [entry], []);
      useRegisterWindowMenuItems(items);
      return null;
    }
    // biome-ignore lint/correctness/noComponentHookFactories: test component that closes over per-test state
    function Menu() {
      const { items } = useWindowMenu(id);
      return <output data-testid="ids">{items.map((item) => item.id).join(',')}</output>;
    }
    const wrapper = createWrapper(manager, { notes: Notes });
    render(
      <>
        <AppWindowContent windowId={id} />
        <Menu />
      </>,
      { wrapper },
    );
    const ids = (): string[] => (screen.getByTestId('ids').textContent ?? '').split(',');
    expect(ids().slice(-4)).toEqual(['separator-app', 'app-action', 'separator-close', 'close']);

    act(() => manager.minimize(id));
    expect(ids()).not.toContain('app-action');
    act(() => manager.focus(id));
    expect(ids()).toContain('app-action');
  });

  it('only adds entries to its own window', () => {
    const manager = createTestManager();
    const first = manager.open({ appId: 'notes' });
    const second = manager.open({ appId: 'mac' });
    // biome-ignore lint/correctness/noComponentHookFactories: test component that closes over per-test state
    function Notes() {
      const items = useMemo(() => [entry], []);
      useRegisterWindowMenuItems(items);
      return null;
    }
    const wrapper = createWrapper(manager, { notes: Notes });
    const { result } = renderHook(
      () => ({ a: useWindowMenu(first).items, b: useWindowMenu(second).items }),
      {
        wrapper: ({ children: tree }) => {
          const Wrapper = wrapper;
          return (
            <Wrapper>
              <AppWindowContent windowId={first} />
              {tree}
            </Wrapper>
          );
        },
      },
    );
    expect(result.current.a.map((item) => item.id)).toContain('app-action');
    expect(result.current.b.map((item) => item.id)).not.toContain('app-action');
  });

  it('throws outside an app window', () => {
    const manager = createTestManager();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      renderHook(() => useRegisterWindowMenuItems([]), { wrapper: createWrapper(manager) }),
    ).toThrow(/app window/);
    spy.mockRestore();
  });
});

describe('useDesktopMenu', () => {
  function setup() {
    const manager = createTestManager();
    const { result } = renderHook(() => useDesktopMenu(), { wrapper: createWrapper(manager) });
    return { manager, result };
  }

  it('lists the default entries', () => {
    const { result } = setup();
    expect(result.current.items.map((item) => item.id)).toEqual([
      'new-desktop',
      'show-desktop',
      'desktop-overview',
      'separator-icons',
      'arrange-icons',
      'wallpaper',
      'taskbar',
      'controls-style',
    ]);
  });

  it('adds a desktop and switches to it', () => {
    const { result, manager } = setup();
    select(find(result.current.items, 'new-desktop'));
    expect(manager.getState().desktops).toHaveLength(2);
    expect(manager.getState().activeDesktopId).toBe('desktop-2');
  });

  it('shows the desktop', () => {
    const { result, manager } = setup();
    const id = manager.open({ appId: 'notes' });
    expect(find(result.current.items, 'show-desktop')).toMatchObject({ shortcut: 'Ctrl+Alt+D' });
    select(find(result.current.items, 'show-desktop'));
    expect(manager.getState().windows[id]?.status).toBe('minimized');
  });

  it('arranges icons by name', () => {
    const { result, manager } = setup();
    act(() => manager.setIconOrder(['notes', 'mac', 'fixed']));
    select(find(children(find(result.current.items, 'arrange-icons')), 'arrange-by-name'));
    expect(manager.getState().iconOrder).toEqual(['fixed', 'mac', 'notes']);
  });

  it('changes the taskbar position and auto-hide', () => {
    const { result, manager } = setup();
    const taskbar = (): Model[] => children(find(result.current.items, 'taskbar'));
    expect(find(taskbar(), 'taskbar-bottom')).toMatchObject({ kind: 'radio', checked: true });

    select(find(taskbar(), 'taskbar-left'));
    expect(manager.getState().shell.taskbarPosition).toBe('left');
    expect(find(taskbar(), 'taskbar-left')).toMatchObject({ checked: true });
    expect(find(taskbar(), 'taskbar-bottom')).toMatchObject({ checked: false });

    select(find(taskbar(), 'taskbar-auto-hide'));
    expect(manager.getState().shell.taskbarAutoHide).toBe(true);
    expect(find(taskbar(), 'taskbar-auto-hide')).toMatchObject({ kind: 'checkbox', checked: true });
  });

  it('changes the controls style', () => {
    const { result, manager } = setup();
    select(find(children(find(result.current.items, 'controls-style')), 'controls-mac'));
    expect(manager.getState().shell.controlsStyle).toBe('mac');
  });

  it('adds registered entries and removes them on unmount', () => {
    const manager = createTestManager();
    const extra: Model = { type: 'item', id: 'extra', label: 'Extra', onSelect: () => {} };
    const items = [extra];
    // biome-ignore lint/correctness/noComponentHookFactories: test component that closes over per-test state
    function Registrar() {
      useRegisterDesktopMenuItems(items);
      return null;
    }
    // biome-ignore lint/correctness/noComponentHookFactories: test component that closes over per-test state
    function Menu() {
      const menu = useDesktopMenu();
      return <output data-testid="ids">{menu.items.map((item) => item.id).join(',')}</output>;
    }
    // biome-ignore lint/correctness/noComponentHookFactories: test component that closes over per-test state
    function App({ show }: { show: boolean }) {
      return (
        <>
          {show ? <Registrar /> : null}
          <Menu />
        </>
      );
    }
    const wrapper = createWrapper(manager);
    const { rerender } = render(<App show />, { wrapper });
    const ids = (): string[] => (screen.getByTestId('ids').textContent ?? '').split(',');
    expect(ids().slice(-2)).toEqual(['separator-app', 'extra']);

    rerender(<App show={false} />);
    expect(ids()).not.toContain('extra');
  });
});
