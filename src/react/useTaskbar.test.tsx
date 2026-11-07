import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import { useStartMenu } from './useStartMenu';
import { useTaskbar } from './useTaskbar';

function Bar() {
  const taskbar = useTaskbar();
  return (
    <div {...taskbar.getRootProps({ 'data-testid': 'bar' })}>
      <button {...taskbar.getStartButtonProps({ 'data-testid': 'start' })} />
      {taskbar.items.map((item) => (
        <button
          key={item.appId}
          {...taskbar.getItemProps(item.appId, { 'data-testid': item.appId })}
        />
      ))}
      <output data-testid="hidden">{String(taskbar.hidden)}</output>
    </div>
  );
}

describe('useTaskbar: items', () => {
  it('lists pinned apps first, then running apps that are not pinned', () => {
    const manager = createTestManager();
    manager.pinApp('mac');
    manager.open({ appId: 'notes' });
    const { result } = renderHook(() => useTaskbar(), { wrapper: createWrapper(manager) });

    expect(result.current.items.map((item) => item.appId)).toEqual(['mac', 'notes']);
    expect(result.current.items[0]).toMatchObject({ pinned: true, running: false, title: 'Mac' });
    expect(result.current.items[1]).toMatchObject({ pinned: false, running: true });
  });

  it('groups windows by app in creation order with their state', () => {
    const manager = createTestManager();
    const first = manager.open({ appId: 'notes', title: 'One' });
    const second = manager.open({ appId: 'notes', title: 'Two' });
    manager.update(second, { badge: 3, dirty: true });
    manager.minimize(first);
    const { result } = renderHook(() => useTaskbar(), { wrapper: createWrapper(manager) });

    const [notes] = result.current.items;
    expect(notes?.windows).toEqual([
      { id: first, title: 'One', minimized: true, focused: false, badge: null, dirty: false },
      { id: second, title: 'Two', minimized: false, focused: true, badge: 3, dirty: true },
    ]);
    expect(notes).toMatchObject({ focused: true, minimized: false });
  });

  it('marks an app minimized when all its windows are', () => {
    const manager = createTestManager();
    const id = manager.open({ appId: 'notes' });
    manager.minimize(id);
    const { result } = renderHook(() => useTaskbar(), { wrapper: createWrapper(manager) });
    expect(result.current.items[0]).toMatchObject({ minimized: true, focused: false });
  });

  it('shows only windows of the active desktop and no child windows', () => {
    const manager = createTestManager();
    const parent = manager.open({ appId: 'notes' });
    manager.open({ appId: 'notes', parentId: parent });
    const other = manager.addDesktop();
    manager.open({ appId: 'fixed', desktopId: other });
    const { result } = renderHook(() => useTaskbar(), { wrapper: createWrapper(manager) });

    expect(result.current.items.map((item) => item.appId)).toEqual(['notes']);
    expect(result.current.items[0]?.windows).toHaveLength(1);

    act(() => manager.switchDesktop(other));
    expect(result.current.items.map((item) => item.appId)).toEqual(['fixed']);
  });

  it('counts a focused child window for its parent', () => {
    const manager = createTestManager();
    const parent = manager.open({ appId: 'notes' });
    manager.open({ appId: 'notes', parentId: parent, modal: true });
    const { result } = renderHook(() => useTaskbar(), { wrapper: createWrapper(manager) });
    expect(result.current.items[0]?.windows[0]?.focused).toBe(true);
  });

  it('pins, unpins and reorders', () => {
    const manager = createTestManager();
    const { result } = renderHook(() => useTaskbar(), { wrapper: createWrapper(manager) });
    act(() => result.current.pin('notes'));
    act(() => result.current.pin('mac', 0));
    expect(result.current.items.map((item) => item.appId)).toEqual(['mac', 'notes']);
    act(() => result.current.setPinnedOrder(['notes', 'mac']));
    expect(result.current.items.map((item) => item.appId)).toEqual(['notes', 'mac']);
    act(() => result.current.unpin('notes'));
    expect(result.current.items.map((item) => item.appId)).toEqual(['mac']);
  });

  it('reports position and auto-hide', () => {
    const manager = createTestManager();
    const { result } = renderHook(() => useTaskbar(), { wrapper: createWrapper(manager) });
    expect(result.current).toMatchObject({ position: 'bottom', autoHide: false, hidden: false });
    act(() => manager.setShellSettings({ taskbarPosition: 'left', taskbarAutoHide: true }));
    expect(result.current).toMatchObject({ position: 'left', autoHide: true, hidden: true });
  });
});

describe('useTaskbar: activate', () => {
  it('opens an app that has no window', () => {
    const manager = createTestManager();
    manager.pinApp('notes');
    const { result } = renderHook(() => useTaskbar(), { wrapper: createWrapper(manager) });
    act(() => result.current.activate('notes'));
    expect(Object.values(manager.getState().windows).map((win) => win.appId)).toEqual(['notes']);
  });

  it('minimizes a single focused window and brings it back on the next click', () => {
    const manager = createTestManager();
    const id = manager.open({ appId: 'notes' });
    const { result } = renderHook(() => useTaskbar(), { wrapper: createWrapper(manager) });

    act(() => result.current.activate('notes'));
    expect(manager.getState().windows[id]?.status).toBe('minimized');
    act(() => result.current.activate('notes'));
    expect(manager.getState().windows[id]?.status).toBe('normal');
    expect(manager.getState().focusedId).toBe(id);
  });

  it('focuses a single window that is behind another', () => {
    const manager = createTestManager();
    const notes = manager.open({ appId: 'notes' });
    manager.open({ appId: 'mac' });
    const { result } = renderHook(() => useTaskbar(), { wrapper: createWrapper(manager) });
    act(() => result.current.activate('notes'));
    expect(manager.getState().focusedId).toBe(notes);
  });

  it('cycles through the instances of an app', () => {
    const manager = createTestManager();
    const first = manager.open({ appId: 'notes' });
    const second = manager.open({ appId: 'notes' });
    const other = manager.open({ appId: 'mac' });
    const { result } = renderHook(() => useTaskbar(), { wrapper: createWrapper(manager) });

    // No instance has focus: the most recent one comes forward.
    act(() => result.current.activate('notes'));
    expect(manager.getState().focusedId).toBe(second);
    act(() => result.current.activate('notes'));
    expect(manager.getState().focusedId).toBe(first);
    act(() => result.current.activate('notes'));
    expect(manager.getState().focusedId).toBe(second);
    expect(other).toBeTruthy();
  });

  it('focuses and closes a given window', async () => {
    const manager = createTestManager();
    const first = manager.open({ appId: 'notes' });
    const second = manager.open({ appId: 'notes' });
    const { result } = renderHook(() => useTaskbar(), { wrapper: createWrapper(manager) });
    act(() => result.current.focusWindow(first));
    expect(manager.getState().focusedId).toBe(first);
    await act(async () => {
      result.current.closeWindow(second);
      await Promise.resolve();
    });
    expect(manager.getState().windows[second]).toBeUndefined();
  });
});

describe('useTaskbar: props', () => {
  it('is a toolbar with an orientation that follows the position', () => {
    const manager = createTestManager();
    render(<Bar />, { wrapper: createWrapper(manager) });
    const bar = screen.getByTestId('bar');
    expect(bar.getAttribute('role')).toBe('toolbar');
    expect(bar.getAttribute('aria-orientation')).toBe('horizontal');
    expect(bar.dataset.taskbarPosition).toBe('bottom');
    act(() => manager.setShellSettings({ taskbarPosition: 'right' }));
    expect(bar.getAttribute('aria-orientation')).toBe('vertical');
    expect(bar.dataset.taskbarPosition).toBe('right');
  });

  it('marks the focused app as pressed and clicks activate it', () => {
    const manager = createTestManager();
    manager.pinApp('notes');
    render(<Bar />, { wrapper: createWrapper(manager) });
    expect(screen.getByTestId('notes').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByTestId('notes'));
    expect(screen.getByTestId('notes').getAttribute('aria-pressed')).toBe('true');
  });

  it('moves focus between the start button and the items with the arrow keys', () => {
    const manager = createTestManager();
    manager.pinApp('notes');
    manager.pinApp('mac');
    render(<Bar />, { wrapper: createWrapper(manager) });
    expect(screen.getByTestId('start').getAttribute('tabindex')).toBe('0');
    expect(screen.getByTestId('notes').getAttribute('tabindex')).toBe('-1');

    fireEvent.keyDown(screen.getByTestId('start'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByTestId('notes'));
    expect(screen.getByTestId('notes').getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(screen.getByTestId('notes'), { key: 'End' });
    expect(document.activeElement).toBe(screen.getByTestId('mac'));
    fireEvent.keyDown(screen.getByTestId('mac'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByTestId('start'));
    fireEvent.keyDown(screen.getByTestId('start'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByTestId('mac'));
    fireEvent.keyDown(screen.getByTestId('mac'), { key: 'Home' });
    expect(document.activeElement).toBe(screen.getByTestId('start'));
  });

  it('uses the up and down arrows when the taskbar is on a side', () => {
    const manager = createTestManager();
    manager.pinApp('notes');
    manager.setShellSettings({ taskbarPosition: 'left' });
    render(<Bar />, { wrapper: createWrapper(manager) });
    fireEvent.keyDown(screen.getByTestId('start'), { key: 'ArrowRight' });
    expect(document.activeElement).not.toBe(screen.getByTestId('notes'));
    fireEvent.keyDown(screen.getByTestId('start'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByTestId('notes'));
  });

  it('toggles the start menu from the start button', () => {
    const manager = createTestManager();
    const wrapper = createWrapper(manager);
    // biome-ignore lint/correctness/noComponentHookFactories: test component that closes over per-test state
    function Both() {
      const menu = useStartMenu();
      return (
        <>
          <Bar />
          <output data-testid="open">{String(menu.open)}</output>
        </>
      );
    }
    render(<Both />, { wrapper });
    const start = screen.getByTestId('start');
    expect(start.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(start);
    expect(screen.getByTestId('open').textContent).toBe('true');
    expect(start.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(start);
    expect(screen.getByTestId('open').textContent).toBe('false');
  });

  it('reveals an auto-hiding taskbar on pointer or focus and hides it again', () => {
    const manager = createTestManager();
    manager.setShellSettings({ taskbarAutoHide: true });
    render(<Bar />, { wrapper: createWrapper(manager) });
    const bar = screen.getByTestId('bar');
    const hidden = (): string | null => screen.getByTestId('hidden').textContent;
    expect(hidden()).toBe('true');
    expect(bar.dataset.state).toBe('hidden');

    fireEvent.pointerEnter(bar);
    expect(hidden()).toBe('false');
    fireEvent.pointerLeave(bar);
    expect(hidden()).toBe('true');

    fireEvent.focus(screen.getByTestId('start'));
    expect(hidden()).toBe('false');
    fireEvent.blur(screen.getByTestId('start'), { relatedTarget: document.body });
    expect(hidden()).toBe('true');
  });

  it('stays revealed while the start menu is open, and can be revealed by hand', () => {
    const manager = createTestManager();
    manager.setShellSettings({ taskbarAutoHide: true });
    const { result } = renderHook(() => ({ bar: useTaskbar(), menu: useStartMenu() }), {
      wrapper: createWrapper(manager),
    });
    act(() => result.current.menu.setOpen(true));
    expect(result.current.bar.hidden).toBe(false);
    act(() => result.current.menu.setOpen(false));
    expect(result.current.bar.hidden).toBe(true);
    act(() => result.current.bar.reveal());
    expect(result.current.bar.hidden).toBe(false);
    act(() => result.current.bar.conceal());
    expect(result.current.bar.hidden).toBe(true);
  });
});
