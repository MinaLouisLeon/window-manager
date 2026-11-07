import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import { useWindowManager } from './useWindowManager';

describe('useWindowManager', () => {
  it('throws NO_PROVIDER outside a WindowManagerProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useWindowManager())).toThrow(/WindowManagerProvider/);
    spy.mockRestore();
  });

  it('returns the manager and the whole state without a selector', () => {
    const manager = createTestManager();
    const { result } = renderHook(() => useWindowManager(), { wrapper: createWrapper(manager) });
    expect(result.current.manager).toBe(manager);
    expect(result.current.state).toBe(manager.getState());

    act(() => {
      manager.open({ appId: 'notes' });
    });
    expect(Object.keys(result.current.state.windows)).toHaveLength(1);
  });

  it('re-renders only when the selected slice changes', () => {
    const manager = createTestManager();
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders += 1;
        return useWindowManager((state) => state.activeDesktopId);
      },
      { wrapper: createWrapper(manager) },
    );
    const initial = renders;
    expect(result.current.state).toBe('desktop-1');

    act(() => {
      manager.open({ appId: 'notes' });
      manager.setShellSettings({ taskbarPosition: 'left' });
    });
    expect(renders).toBe(initial);

    act(() => {
      const id = manager.addDesktop();
      manager.switchDesktop(id);
    });
    expect(result.current.state).toBe('desktop-2');
    expect(renders).toBeGreaterThan(initial);
  });

  it('keeps the previous value when a new selection equals it', () => {
    const manager = createTestManager();
    const { result } = renderHook(() => useWindowManager((state) => state.order.length > 0), {
      wrapper: createWrapper(manager),
    });
    expect(result.current.state).toBe(false);
    act(() => {
      manager.open({ appId: 'notes' });
    });
    expect(result.current.state).toBe(true);
  });
});
