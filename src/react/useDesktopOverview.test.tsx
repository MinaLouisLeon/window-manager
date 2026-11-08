import { act, fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import { useDesktopOverview } from './useDesktopOverview';

function setup(shortcuts?: Parameters<typeof createWrapper>[2]) {
  const manager = createTestManager();
  const { result } = renderHook(() => useDesktopOverview(), {
    wrapper: createWrapper(manager, {}, shortcuts),
  });
  return { manager, result };
}

/** A drag event with just what the hook touches. */
function dragEvent(): {
  dataTransfer: { setData: ReturnType<typeof vi.fn>; effectAllowed: string; dropEffect: string };
  defaultPrevented: boolean;
  preventDefault: ReturnType<typeof vi.fn>;
  currentTarget: HTMLElement;
  relatedTarget: null;
} {
  return {
    dataTransfer: { setData: vi.fn(), effectAllowed: '', dropEffect: '' },
    defaultPrevented: false,
    preventDefault: vi.fn(),
    currentTarget: document.createElement('div'),
    relatedTarget: null,
  };
}

describe('useDesktopOverview: state', () => {
  it('starts closed and opens, closes and toggles', () => {
    const { result } = setup();
    expect(result.current.open).toBe(false);
    act(() => result.current.setOpen(true));
    expect(result.current.open).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.open).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    act(() => result.current.setOpen(false));
    expect(result.current.open).toBe(false);
  });

  it('lists every desktop with its windows as fractions of the viewport', () => {
    const { manager, result } = setup();
    let second = '';
    act(() => {
      manager.open({ appId: 'notes', bounds: { x: 100, y: 70 } });
      second = manager.addDesktop('Work');
      manager.open({ appId: 'fixed', desktopId: second });
    });

    const [first, work] = result.current.desktops;
    expect(first).toMatchObject({ id: 'desktop-1', name: 'Desktop 1', active: true });
    expect(first?.windows).toHaveLength(1);
    expect(first?.windows[0]).toMatchObject({
      appId: 'notes',
      title: 'Notes',
      focused: true,
      minimized: false,
      dirty: false,
    });
    expect(first?.windows[0]?.frame).toEqual({
      left: 0.1,
      top: 0.1,
      width: 0.4,
      height: 300 / 700,
    });
    expect(work).toMatchObject({ id: second, name: 'Work', active: false });
    expect(work?.windows.map((win) => win.appId)).toEqual(['fixed']);
  });

  it('lists the windows of a desktop in paint order, with minimized ones marked', () => {
    const { manager, result } = setup();
    let a = '';
    act(() => {
      a = manager.open({ appId: 'notes' });
      manager.open({ appId: 'mac' });
      manager.minimize(a);
    });
    const windows = result.current.desktops[0]?.windows ?? [];
    expect(windows.map((win) => win.appId)).toEqual(['notes', 'mac']);
    expect(windows.map((win) => win.minimized)).toEqual([true, false]);
  });

  it('carries the wallpaper of each desktop', () => {
    const { manager, result } = setup();
    act(() => {
      manager.setWallpaper('desktop-1', { type: 'color', value: 'red' });
    });
    expect(result.current.desktops[0]?.wallpaper).toEqual({ type: 'color', value: 'red' });
  });
});

describe('useDesktopOverview: actions', () => {
  it('switches to a desktop and closes', () => {
    const { manager, result } = setup();
    const second = manager.addDesktop();
    act(() => result.current.setOpen(true));
    act(() => result.current.switchTo(second));
    expect(manager.getState().activeDesktopId).toBe(second);
    expect(result.current.open).toBe(false);
  });

  it('focuses a window on another desktop, switching to it, and closes', () => {
    const { manager, result } = setup();
    let id = '';
    act(() => {
      const second = manager.addDesktop();
      id = manager.open({ appId: 'notes', desktopId: second });
      manager.open({ appId: 'mac' });
      result.current.setOpen(true);
    });
    act(() => result.current.focusWindow(id));
    expect(manager.getState().focusedId).toBe(id);
    expect(manager.getState().activeDesktopId).toBe(manager.getState().windows[id]?.desktopId);
    expect(result.current.open).toBe(false);
  });

  it('restores a minimized window when it is focused', () => {
    const { manager, result } = setup();
    let id = '';
    act(() => {
      id = manager.open({ appId: 'notes' });
      manager.minimize(id);
    });
    act(() => result.current.focusWindow(id));
    expect(manager.getState().windows[id]?.status).toBe('normal');
  });

  it('ignores focusing a window that is gone', () => {
    const { manager, result } = setup();
    act(() => result.current.setOpen(true));
    act(() => result.current.focusWindow('window-99'));
    expect(manager.getState().focusedId).toBeNull();
    expect(result.current.open).toBe(true);
  });

  it('moves a window to another desktop, with its children', () => {
    const { manager, result } = setup();
    let parent = '';
    let child = '';
    let second = '';
    act(() => {
      second = manager.addDesktop();
      parent = manager.open({ appId: 'notes' });
      child = manager.open({ appId: 'mac', parentId: parent });
    });
    act(() => result.current.moveWindow(child, second));
    expect(manager.getState().windows[parent]?.desktopId).toBe(second);
    expect(manager.getState().windows[child]?.desktopId).toBe(second);
  });

  it('ignores a move to an unknown desktop or of an unknown window', () => {
    const { manager, result } = setup();
    let id = '';
    act(() => {
      id = manager.open({ appId: 'notes' });
    });
    act(() => result.current.moveWindow(id, 'nowhere'));
    act(() => result.current.moveWindow('window-99', 'desktop-1'));
    expect(manager.getState().windows[id]?.desktopId).toBe('desktop-1');
  });

  it('adds a desktop and keeps the overview open', () => {
    const { manager, result } = setup();
    act(() => result.current.setOpen(true));
    let id = '';
    act(() => {
      id = result.current.add();
    });
    expect(manager.getState().desktops.map((desktop) => desktop.id)).toContain(id);
    expect(manager.getState().activeDesktopId).toBe('desktop-1');
    expect(result.current.open).toBe(true);
  });
});

describe('useDesktopOverview: drag and drop', () => {
  it('drags a window onto another desktop', () => {
    const { manager, result } = setup();
    let id = '';
    let second = '';
    act(() => {
      id = manager.open({ appId: 'notes' });
      second = manager.addDesktop();
    });

    const start = dragEvent();
    act(() => {
      result.current.getWindowProps(id).onDragStart?.(start as never);
    });
    expect(result.current.draggingId).toBe(id);
    expect(start.dataTransfer.setData).toHaveBeenCalledWith('text/plain', id);
    expect(start.dataTransfer.effectAllowed).toBe('move');
    expect(result.current.getWindowProps(id)['data-dragging']).toBe('');

    const over = dragEvent();
    act(() => {
      result.current.getDesktopProps(second).onDragOver?.(over as never);
    });
    expect(over.preventDefault).toHaveBeenCalled();
    expect(result.current.dropTargetId).toBe(second);
    expect(result.current.getDesktopProps(second)['data-drop-target']).toBe('');

    const drop = dragEvent();
    act(() => {
      result.current.getDesktopProps(second).onDrop?.(drop as never);
    });
    expect(drop.preventDefault).toHaveBeenCalled();
    expect(manager.getState().windows[id]?.desktopId).toBe(second);
    expect(result.current.draggingId).toBeNull();
    expect(result.current.dropTargetId).toBeNull();
  });

  it('ignores a drag over or a drop when no window is being dragged', () => {
    const { manager, result } = setup();
    let second = '';
    act(() => {
      second = manager.addDesktop();
    });
    const over = dragEvent();
    act(() => {
      result.current.getDesktopProps(second).onDragOver?.(over as never);
      result.current.getDesktopProps(second).onDrop?.(dragEvent() as never);
    });
    expect(over.preventDefault).not.toHaveBeenCalled();
    expect(result.current.dropTargetId).toBeNull();
  });

  it('clears the drag when it ends without a drop', () => {
    const { manager, result } = setup();
    let id = '';
    let second = '';
    act(() => {
      id = manager.open({ appId: 'notes' });
      second = manager.addDesktop();
    });
    act(() => {
      result.current.getWindowProps(id).onDragStart?.(dragEvent() as never);
    });
    act(() => {
      result.current.getDesktopProps(second).onDragOver?.(dragEvent() as never);
    });
    act(() => {
      result.current.getWindowProps(id).onDragEnd?.(dragEvent() as never);
    });
    expect(result.current.draggingId).toBeNull();
    expect(result.current.dropTargetId).toBeNull();
    expect(manager.getState().windows[id]?.desktopId).toBe('desktop-1');
  });

  it('clears the drop target when the drag leaves the desktop', () => {
    const { manager, result } = setup();
    let id = '';
    let second = '';
    act(() => {
      id = manager.open({ appId: 'notes' });
      second = manager.addDesktop();
    });
    act(() => {
      result.current.getWindowProps(id).onDragStart?.(dragEvent() as never);
    });
    act(() => {
      result.current.getDesktopProps(second).onDragOver?.(dragEvent() as never);
    });
    expect(result.current.dropTargetId).toBe(second);
    act(() => {
      result.current.getDesktopProps(second).onDragLeave?.(dragEvent() as never);
    });
    expect(result.current.dropTargetId).toBeNull();
  });

  it('keeps the drop target while the pointer moves between children of the desktop', () => {
    const { manager, result } = setup();
    let id = '';
    let second = '';
    act(() => {
      id = manager.open({ appId: 'notes' });
      second = manager.addDesktop();
    });
    act(() => {
      result.current.getWindowProps(id).onDragStart?.(dragEvent() as never);
    });
    act(() => {
      result.current.getDesktopProps(second).onDragOver?.(dragEvent() as never);
    });
    const leave = dragEvent();
    const inside = document.createElement('span');
    leave.currentTarget.append(inside);
    act(() => {
      result.current
        .getDesktopProps(second)
        .onDragLeave?.({ ...leave, relatedTarget: inside } as never);
    });
    expect(result.current.dropTargetId).toBe(second);
  });
});

describe('useDesktopOverview: keyboard', () => {
  function key(shiftKey: boolean, name: string) {
    return { shiftKey, key: name, defaultPrevented: false, preventDefault: vi.fn() };
  }

  it('moves a window to the next and previous desktop with Shift+Arrow', () => {
    const { manager, result } = setup();
    let id = '';
    let second = '';
    act(() => {
      id = manager.open({ appId: 'notes' });
      second = manager.addDesktop();
    });
    const right = key(true, 'ArrowRight');
    act(() => {
      result.current.getWindowProps(id).onKeyDown?.(right as never);
    });
    expect(right.preventDefault).toHaveBeenCalled();
    expect(manager.getState().windows[id]?.desktopId).toBe(second);

    act(() => {
      result.current.getWindowProps(id).onKeyDown?.(key(true, 'ArrowLeft') as never);
    });
    expect(manager.getState().windows[id]?.desktopId).toBe('desktop-1');
  });

  it('stays put at the first and last desktop', () => {
    const { manager, result } = setup();
    let id = '';
    act(() => {
      id = manager.open({ appId: 'notes' });
      manager.addDesktop();
    });
    act(() => {
      result.current.getWindowProps(id).onKeyDown?.(key(true, 'ArrowLeft') as never);
    });
    expect(manager.getState().windows[id]?.desktopId).toBe('desktop-1');
  });

  it('ignores arrows without Shift and other keys', () => {
    const { manager, result } = setup();
    let id = '';
    act(() => {
      id = manager.open({ appId: 'notes' });
      manager.addDesktop();
    });
    const plain = key(false, 'ArrowRight');
    act(() => {
      result.current.getWindowProps(id).onKeyDown?.(plain as never);
      result.current.getWindowProps(id).onKeyDown?.(key(true, 'a') as never);
    });
    expect(plain.preventDefault).not.toHaveBeenCalled();
    expect(manager.getState().windows[id]?.desktopId).toBe('desktop-1');
  });

  it('closes on Escape while open, and only then', () => {
    const { result } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(result.current.open).toBe(false);
    act(() => result.current.setOpen(true));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(result.current.open).toBe(false);
  });

  it('toggles with Ctrl+Alt+O', () => {
    const { result } = setup();
    fireEvent.keyDown(document, { key: 'o', code: 'KeyO', ctrlKey: true, altKey: true });
    expect(result.current.open).toBe(true);
    fireEvent.keyDown(document, { key: 'o', code: 'KeyO', ctrlKey: true, altKey: true });
    expect(result.current.open).toBe(false);
  });

  it('uses another combo, or none, when the shortcut is changed or turned off', () => {
    const moved = setup({ desktopOverview: 'Ctrl+Alt+V' });
    fireEvent.keyDown(document, { key: 'o', code: 'KeyO', ctrlKey: true, altKey: true });
    expect(moved.result.current.open).toBe(false);
    fireEvent.keyDown(document, { key: 'v', code: 'KeyV', ctrlKey: true, altKey: true });
    expect(moved.result.current.open).toBe(true);

    const off = setup({ desktopOverview: false });
    fireEvent.keyDown(document, { key: 'o', code: 'KeyO', ctrlKey: true, altKey: true });
    expect(off.result.current.open).toBe(false);
  });
});

describe('useDesktopOverview: window props', () => {
  it('make the element draggable and name the window', () => {
    const { manager, result } = setup();
    let id = '';
    act(() => {
      id = manager.open({ appId: 'notes' });
    });
    const props = result.current.getWindowProps(id, { 'data-testid': 'frame' });
    expect(props.draggable).toBe(true);
    expect(props['data-wm-overview-window']).toBe(id);
    expect(props['data-testid']).toBe('frame');
    expect(result.current.getDesktopProps('desktop-1')['data-wm-overview-desktop']).toBe(
      'desktop-1',
    );
  });

  it('call the handler of the caller first and respect preventDefault', () => {
    const { manager, result } = setup();
    let id = '';
    act(() => {
      id = manager.open({ appId: 'notes' });
    });
    const onDragStart = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    const props = result.current.getWindowProps(id, { onDragStart: onDragStart as never });
    const event = { ...dragEvent(), defaultPrevented: false };
    event.preventDefault = vi.fn(() => {
      event.defaultPrevented = true;
    });
    act(() => {
      props.onDragStart?.(event as never);
    });
    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(result.current.draggingId).toBeNull();
  });
});
