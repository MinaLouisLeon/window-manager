import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import { useWindowSwitcher } from './useWindowSwitcher';

function setup(count = 3) {
  const manager = createTestManager();
  const ids = Array.from({ length: count }, () => manager.open({ appId: 'notes' }));
  const { result } = renderHook(() => useWindowSwitcher(), { wrapper: createWrapper(manager) });
  return { manager, ids, result };
}

describe('useWindowSwitcher', () => {
  it('starts closed and empty', () => {
    const { result } = setup();
    expect(result.current).toMatchObject({
      open: false,
      windows: [],
      selectedId: null,
      selectedIndex: 0,
    });
  });

  it('opens on the window used before the current one', () => {
    const { result, ids } = setup();
    act(() => result.current.cycle());
    expect(result.current.open).toBe(true);
    expect(result.current.windows.map((win) => win.id)).toEqual([ids[2], ids[1], ids[0]]);
    expect(result.current.selectedIndex).toBe(1);
    expect(result.current.selectedId).toBe(ids[1]);
  });

  it('opens on the last window when cycling backwards', () => {
    const { result, ids } = setup();
    act(() => result.current.cycle(-1));
    expect(result.current.selectedId).toBe(ids[0]);
  });

  it('moves the selection and wraps around', () => {
    const { result, ids } = setup();
    act(() => result.current.cycle());
    act(() => result.current.cycle());
    expect(result.current.selectedId).toBe(ids[0]);
    act(() => result.current.cycle());
    expect(result.current.selectedId).toBe(ids[2]);
    act(() => result.current.cycle(-1));
    expect(result.current.selectedId).toBe(ids[0]);
  });

  it('selects an entry directly and ignores indexes out of range', () => {
    const { result, ids } = setup();
    act(() => result.current.cycle());
    act(() => result.current.select(2));
    expect(result.current.selectedId).toBe(ids[0]);
    act(() => result.current.select(9));
    expect(result.current.selectedId).toBe(ids[0]);
  });

  it('focuses the selected window on commit and closes', () => {
    const { result, manager, ids } = setup();
    act(() => result.current.cycle());
    act(() => result.current.commit());
    expect(result.current.open).toBe(false);
    expect(manager.getState().focusedId).toBe(ids[1]);
  });

  it('restores a selected minimized window', () => {
    const { result, manager, ids } = setup();
    manager.minimize(ids[1] as string);
    act(() => result.current.cycle());
    expect(result.current.windows.find((win) => win.id === ids[1])?.minimized).toBe(true);
    act(() => result.current.select(1));
    act(() => result.current.commit());
    expect(manager.getState().windows[ids[1] as string]?.status).toBe('normal');
  });

  it('changes nothing on cancel', () => {
    const { result, manager, ids } = setup();
    act(() => result.current.cycle());
    act(() => result.current.cancel());
    expect(result.current.open).toBe(false);
    expect(manager.getState().focusedId).toBe(ids[2]);
  });

  it('does not open with fewer than two windows', () => {
    const { result } = setup(1);
    act(() => result.current.cycle());
    expect(result.current.open).toBe(false);
  });

  it('only lists windows of the active desktop', () => {
    const { result, manager } = setup(2);
    manager.open({ appId: 'notes', desktopId: manager.addDesktop() });
    act(() => result.current.cycle());
    expect(result.current.windows).toHaveLength(2);
  });

  it('describes each window with its app and title', () => {
    const { result, manager } = setup(2);
    const id = manager.open({ appId: 'mac', title: 'Special' });
    act(() => result.current.cycle());
    expect(result.current.windows[0]).toMatchObject({
      id,
      title: 'Special',
      appId: 'mac',
      minimized: false,
    });
  });

  it('skips a window that closed while the switcher was open', async () => {
    const { result, manager, ids } = setup();
    act(() => result.current.cycle());
    await act(async () => {
      await manager.close(ids[1] as string);
    });
    expect(result.current.windows.map((win) => win.id)).not.toContain(ids[1]);
    act(() => result.current.commit());
    expect(manager.getState().windows[ids[1] as string]).toBeUndefined();
  });
});
