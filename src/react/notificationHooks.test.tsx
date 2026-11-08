import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import { msToNextTick, useClock } from './useClock';
import { useNotifications } from './useNotifications';
import { useQuickSettings } from './useQuickSettings';
import { useTray } from './useTray';

describe('useTray', () => {
  it('lists the registered items and removes them again', () => {
    const manager = createTestManager();
    const { result } = renderHook(() => useTray(), { wrapper: createWrapper(manager) });
    expect(result.current.items).toEqual([]);

    let unregister = () => {};
    act(() => {
      unregister = result.current.register({ id: 'sync', label: 'Sync' });
    });
    expect(result.current.items.map((item) => item.id)).toEqual(['sync']);
    act(() => unregister());
    expect(result.current.items).toEqual([]);
  });

  it('sorts by order, with unordered items last in registration order', () => {
    const manager = createTestManager();
    const { result } = renderHook(() => useTray(), { wrapper: createWrapper(manager) });
    act(() => {
      manager.registerTrayItem({ id: 'plain-1', label: 'A' });
      manager.registerTrayItem({ id: 'second', label: 'B', order: 2 });
      manager.registerTrayItem({ id: 'plain-2', label: 'C' });
      manager.registerTrayItem({ id: 'first', label: 'D', order: 1 });
    });
    expect(result.current.items.map((item) => item.id)).toEqual([
      'first',
      'second',
      'plain-1',
      'plain-2',
    ]);
  });

  it('updates an item', () => {
    const manager = createTestManager();
    const { result } = renderHook(() => useTray(), { wrapper: createWrapper(manager) });
    act(() => {
      result.current.register({ id: 'sync', label: 'Sync' });
    });
    act(() => result.current.update('sync', { badge: 4 }));
    expect(result.current.items[0]?.badge).toBe(4);
  });

  it('keeps the same items array while the tray does not change', () => {
    const manager = createTestManager();
    const { result, rerender } = renderHook(() => useTray(), { wrapper: createWrapper(manager) });
    act(() => {
      manager.registerTrayItem({ id: 'a', label: 'A' });
    });
    const before = result.current.items;
    act(() => {
      manager.open({ appId: 'notes' });
    });
    rerender();
    expect(result.current.items).toBe(before);
  });
});

describe('useNotifications', () => {
  function setup() {
    const manager = createTestManager();
    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper(manager) });
    return { manager, result };
  }

  it('lists notifications newest first with the unread count', () => {
    const { result } = setup();
    act(() => {
      result.current.notify({ title: 'First' });
      result.current.notify({ title: 'Second' });
    });
    expect(result.current.notifications.map((n) => n.title)).toEqual(['Second', 'First']);
    expect(result.current.unreadCount).toBe(2);
  });

  it('marks one and all as read', () => {
    const { result } = setup();
    let first = '';
    act(() => {
      first = result.current.notify({ title: 'First' });
      result.current.notify({ title: 'Second' });
    });
    act(() => result.current.markRead(first));
    expect(result.current.unreadCount).toBe(1);
    act(() => result.current.markRead('all'));
    expect(result.current.unreadCount).toBe(0);
  });

  it('dismisses one and clears all', () => {
    const { result } = setup();
    let first = '';
    act(() => {
      first = result.current.notify({ title: 'First' });
      result.current.notify({ title: 'Second' });
    });
    act(() => result.current.dismiss(first));
    expect(result.current.notifications.map((n) => n.title)).toEqual(['Second']);
    act(() => result.current.clear());
    expect(result.current.notifications).toEqual([]);
  });

  it('activates a notification: marks it read and opens the window of its action', () => {
    const { manager, result } = setup();
    let id = '';
    act(() => {
      id = result.current.notify({
        title: 'Saved',
        action: { label: 'Open', open: { appId: 'notes', title: 'From notification' } },
      });
    });
    let opened: string | null = null;
    act(() => {
      opened = result.current.activate(id);
    });
    expect(opened).not.toBeNull();
    expect(manager.getState().windows[opened as unknown as string]?.title).toBe(
      'From notification',
    );
    expect(result.current.unreadCount).toBe(0);
  });

  it('activates a notification without an action: only marks it read', () => {
    const { manager, result } = setup();
    let id = '';
    act(() => {
      id = result.current.notify({ title: 'Plain' });
    });
    let opened: string | null = 'unset';
    act(() => {
      opened = result.current.activate(id);
    });
    expect(opened).toBeNull();
    expect(Object.keys(manager.getState().windows)).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);
  });

  it('activates nothing for an unknown id', () => {
    const { result } = setup();
    expect(result.current.activate('missing')).toBeNull();
  });

  it('does not re-render for window changes', () => {
    const { manager, result } = setup();
    const before = result.current.notifications;
    act(() => {
      manager.open({ appId: 'notes' });
    });
    expect(result.current.notifications).toBe(before);
  });
});

describe('useQuickSettings', () => {
  it('returns the shell settings and changes them', () => {
    const manager = createTestManager();
    const { result } = renderHook(() => useQuickSettings(), { wrapper: createWrapper(manager) });
    expect(result.current.settings).toEqual({
      taskbarPosition: 'bottom',
      taskbarAutoHide: false,
      controlsStyle: 'windows',
    });

    act(() => result.current.setTaskbarPosition('left'));
    act(() => result.current.setTaskbarAutoHide(true));
    act(() => result.current.setControlsStyle('mac'));
    expect(result.current.settings).toEqual({
      taskbarPosition: 'left',
      taskbarAutoHide: true,
      controlsStyle: 'mac',
    });
    expect(manager.getState().shell).toEqual(result.current.settings);
  });
});

describe('msToNextTick', () => {
  it('counts to the next minute', () => {
    expect(msToNextTick(new Date(2026, 10, 6, 14, 5, 30, 250), false)).toBe(29_750);
    expect(msToNextTick(new Date(2026, 10, 6, 14, 5, 59, 999), false)).toBe(1);
  });

  it('counts a full minute at the start of a minute', () => {
    expect(msToNextTick(new Date(2026, 10, 6, 14, 5, 0, 0), false)).toBe(60_000);
  });

  it('counts to the next second with showSeconds', () => {
    expect(msToNextTick(new Date(2026, 10, 6, 14, 5, 30, 250), true)).toBe(750);
    expect(msToNextTick(new Date(2026, 10, 6, 14, 5, 30, 0), true)).toBe(1000);
  });
});

describe('useClock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats the time and dates for a locale', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 6, 14, 5, 30));
    const { result } = renderHook(() => useClock({ locale: 'en-US', hour12: false }));
    expect(result.current.time).toBe('14:05');
    expect(result.current.date).toBe('Fri, Nov 6');
    expect(result.current.fullDate).toBe('Friday, November 6, 2026');
  });

  it('can use a 12 hour clock and show seconds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 6, 14, 5, 30));
    const { result } = renderHook(() =>
      useClock({ locale: 'en-US', hour12: true, showSeconds: true }),
    );
    // Newer ICU versions put a narrow no-break space before "PM".
    expect(result.current.time.replace(/\s/g, ' ')).toBe('2:05:30 PM');
  });

  it('updates when the minute changes, not before', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 6, 14, 5, 30));
    const { result } = renderHook(() => useClock({ locale: 'en-US', hour12: false }));
    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    expect(result.current.time).toBe('14:05');
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.time).toBe('14:06');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.time).toBe('14:07');
  });

  it('ticks every second with showSeconds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 6, 14, 5, 30));
    const { result } = renderHook(() =>
      useClock({ locale: 'en-US', hour12: false, showSeconds: true }),
    );
    expect(result.current.time).toBe('14:05:30');
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.time).toBe('14:05:31');
  });

  it('stops ticking when unmounted', () => {
    vi.useFakeTimers();
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    const { unmount } = renderHook(() => useClock());
    clear.mockClear();
    unmount();
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });
});
