import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import { useDesktops, useWindow } from './useWindow';

describe('useWindow', () => {
  it('returns the window state and whether it has focus', () => {
    const manager = createTestManager();
    const first = manager.open({ appId: 'notes' });
    const second = manager.open({ appId: 'notes' });
    const wrapper = createWrapper(manager);
    const a = renderHook(() => useWindow(first), { wrapper });
    const b = renderHook(() => useWindow(second), { wrapper });

    expect(a.result.current.window?.appId).toBe('notes');
    expect(a.result.current.focused).toBe(false);
    expect(b.result.current.focused).toBe(true);

    act(() => a.result.current.focus());
    expect(a.result.current.focused).toBe(true);
    expect(b.result.current.focused).toBe(false);
  });

  it('has actions bound to its window', () => {
    const manager = createTestManager();
    const id = manager.open({ appId: 'notes' });
    const { result } = renderHook(() => useWindow(id), { wrapper: createWrapper(manager) });

    act(() => result.current.maximize());
    expect(result.current.window?.status).toBe('maximized');
    act(() => result.current.restore());
    expect(result.current.window?.status).toBe('normal');
    act(() => result.current.snap('left'));
    expect(result.current.window?.snap).toBe('left');
    act(() => result.current.update({ title: 'Renamed', dirty: true }));
    expect(result.current.window).toMatchObject({ title: 'Renamed', dirty: true });
    act(() => result.current.setAlwaysOnTop(true));
    expect(result.current.window?.alwaysOnTop).toBe(true);
  });

  it('keeps the same actions between renders', () => {
    const manager = createTestManager();
    const id = manager.open({ appId: 'notes' });
    const { result, rerender } = renderHook(() => useWindow(id), {
      wrapper: createWrapper(manager),
    });
    const before = result.current.minimize;
    rerender();
    expect(result.current.minimize).toBe(before);
  });

  it('gives null once the window is closed', async () => {
    const manager = createTestManager();
    const id = manager.open({ appId: 'notes' });
    const { result } = renderHook(() => useWindow(id), { wrapper: createWrapper(manager) });
    await act(async () => {
      await result.current.close();
    });
    expect(result.current.window).toBeNull();
    expect(result.current.focused).toBe(false);
  });

  it('gives null for an unknown id', () => {
    const manager = createTestManager();
    const { result } = renderHook(() => useWindow('nope'), { wrapper: createWrapper(manager) });
    expect(result.current.window).toBeNull();
  });
});

describe('useDesktops', () => {
  it('lists the desktops and the active one', () => {
    const manager = createTestManager();
    const { result } = renderHook(() => useDesktops(), { wrapper: createWrapper(manager) });
    expect(result.current.desktops.map((desktop) => desktop.name)).toEqual(['Desktop 1']);
    expect(result.current.activeDesktopId).toBe('desktop-1');
    expect(result.current.activeDesktop.id).toBe('desktop-1');
  });

  it('adds, renames and switches desktops', () => {
    const manager = createTestManager();
    const { result } = renderHook(() => useDesktops(), { wrapper: createWrapper(manager) });

    let added = '';
    act(() => {
      added = result.current.add('Work');
    });
    expect(result.current.desktops.map((desktop) => desktop.name)).toEqual(['Desktop 1', 'Work']);

    act(() => result.current.switchTo(added));
    expect(result.current.activeDesktop.name).toBe('Work');

    act(() => result.current.rename(added, 'Play'));
    expect(result.current.activeDesktop.name).toBe('Play');
  });

  it('removes a desktop and moves its windows', async () => {
    const manager = createTestManager();
    const second = manager.addDesktop();
    const id = manager.open({ appId: 'notes', desktopId: second });
    const { result } = renderHook(() => useDesktops(), { wrapper: createWrapper(manager) });

    let removed = false;
    await act(async () => {
      removed = await result.current.remove(second, { moveWindowsTo: 'desktop-1' });
    });
    expect(removed).toBe(true);
    expect(result.current.desktops).toHaveLength(1);
    expect(manager.getState().windows[id]?.desktopId).toBe('desktop-1');
  });

  it('moves a window and sets a wallpaper', () => {
    const manager = createTestManager();
    const second = manager.addDesktop();
    const id = manager.open({ appId: 'notes' });
    const { result } = renderHook(() => useDesktops(), { wrapper: createWrapper(manager) });

    act(() => result.current.moveWindow(id, second));
    expect(manager.getState().windows[id]?.desktopId).toBe(second);

    act(() => result.current.setWallpaper(second, { type: 'color', value: '#123456' }));
    expect(result.current.desktops[1]?.wallpaper).toEqual({ type: 'color', value: '#123456' });
  });
});
