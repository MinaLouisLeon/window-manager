import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import { useStartMenu } from './useStartMenu';
import { useWindowSwitcher } from './useWindowSwitcher';

function press(
  key: string,
  code: string,
  init: KeyboardEventInit = {},
  target: Element = document.body,
): void {
  fireEvent.keyDown(target, { key, code, ...init });
}

const ctrlAlt = { ctrlKey: true, altKey: true };

function setup(shortcuts?: Parameters<typeof createWrapper>[2]) {
  const manager = createTestManager();
  const wrapper = createWrapper(manager, {}, shortcuts);
  return { manager, wrapper };
}

describe('default shortcuts', () => {
  it('minimizes the focused window with Ctrl+Alt+M', () => {
    const { manager, wrapper } = setup();
    const id = manager.open({ appId: 'notes' });
    render(<span />, { wrapper });
    press('m', 'KeyM', ctrlAlt);
    expect(manager.getState().windows[id]?.status).toBe('minimized');
  });

  it('toggles maximize, snaps, fullscreen and always on top', () => {
    const { manager, wrapper } = setup();
    const id = manager.open({ appId: 'notes' });
    render(<span />, { wrapper });
    const status = (): string | undefined => manager.getState().windows[id]?.status;

    press('ArrowUp', 'ArrowUp', ctrlAlt);
    expect(status()).toBe('maximized');
    press('ArrowUp', 'ArrowUp', ctrlAlt);
    expect(status()).toBe('normal');

    press('ArrowLeft', 'ArrowLeft', ctrlAlt);
    expect(manager.getState().windows[id]?.snap).toBe('left');
    press('ArrowRight', 'ArrowRight', ctrlAlt);
    expect(manager.getState().windows[id]?.snap).toBe('right');

    press('f', 'KeyF', ctrlAlt);
    expect(status()).toBe('fullscreen');
    press('Escape', 'Escape');
    expect(status()).not.toBe('fullscreen');
    press('f', 'KeyF', ctrlAlt);
    press('f', 'KeyF', ctrlAlt);
    expect(status()).not.toBe('fullscreen');

    press('t', 'KeyT', ctrlAlt);
    expect(manager.getState().windows[id]?.alwaysOnTop).toBe(true);
    press('t', 'KeyT', ctrlAlt);
    expect(manager.getState().windows[id]?.alwaysOnTop).toBe(false);
  });

  it('closes the focused window with Ctrl+Alt+W', async () => {
    const { manager, wrapper } = setup();
    const id = manager.open({ appId: 'notes' });
    render(<span />, { wrapper });
    press('w', 'KeyW', ctrlAlt);
    await waitFor(() => expect(manager.getState().windows[id]).toBeUndefined());
  });

  it('shows the desktop with Ctrl+Alt+D', () => {
    const { manager, wrapper } = setup();
    const id = manager.open({ appId: 'notes' });
    render(<span />, { wrapper });
    press('d', 'KeyD', ctrlAlt);
    expect(manager.getState().windows[id]?.status).toBe('minimized');
    press('d', 'KeyD', ctrlAlt);
    expect(manager.getState().windows[id]?.status).toBe('normal');
  });

  it('switches to desktop 1 to 9 with Ctrl+Alt+digit', () => {
    const { manager, wrapper } = setup();
    manager.addDesktop();
    render(<span />, { wrapper });
    press('2', 'Digit2', ctrlAlt);
    expect(manager.getState().activeDesktopId).toBe('desktop-2');
    press('1', 'Digit1', ctrlAlt);
    expect(manager.getState().activeDesktopId).toBe('desktop-1');
    press('5', 'Digit5', ctrlAlt);
    expect(manager.getState().activeDesktopId).toBe('desktop-1');
  });

  it('opens and closes the start menu with Ctrl+Alt+Space', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useStartMenu(), { wrapper });
    press(' ', 'Space', ctrlAlt);
    expect(result.current.open).toBe(true);
    press(' ', 'Space', ctrlAlt);
    expect(result.current.open).toBe(false);
  });

  it('does nothing for window shortcuts when no window has focus', () => {
    const { manager, wrapper } = setup();
    render(<span />, { wrapper });
    expect(() => press('m', 'KeyM', ctrlAlt)).not.toThrow();
    expect(manager.getState().order).toHaveLength(0);
  });
});

describe('configuring shortcuts', () => {
  it('uses an override', () => {
    const { manager, wrapper } = setup({ minimizeWindow: 'Ctrl+Alt+J' });
    const id = manager.open({ appId: 'notes' });
    render(<span />, { wrapper });
    press('m', 'KeyM', ctrlAlt);
    expect(manager.getState().windows[id]?.status).toBe('normal');
    press('j', 'KeyJ', ctrlAlt);
    expect(manager.getState().windows[id]?.status).toBe('minimized');
  });

  it('turns one shortcut off', () => {
    const { manager, wrapper } = setup({ minimizeWindow: false });
    const id = manager.open({ appId: 'notes' });
    render(<span />, { wrapper });
    press('m', 'KeyM', ctrlAlt);
    expect(manager.getState().windows[id]?.status).toBe('normal');
    press('ArrowUp', 'ArrowUp', ctrlAlt);
    expect(manager.getState().windows[id]?.status).toBe('maximized');
  });

  it('turns all shortcuts off with false', () => {
    const { manager, wrapper } = setup(false);
    const id = manager.open({ appId: 'notes' });
    render(<span />, { wrapper });
    press('m', 'KeyM', ctrlAlt);
    expect(manager.getState().windows[id]?.status).toBe('normal');
  });
});

describe('shortcuts and inputs', () => {
  it('ignores shortcuts without Ctrl+Alt while focus is in an input', () => {
    const { manager, wrapper } = setup({ minimizeWindow: 'Ctrl+M' });
    const id = manager.open({ appId: 'notes' });
    const { container } = render(<input />, { wrapper });
    const input = container.querySelector('input') as HTMLInputElement;

    press('m', 'KeyM', { ctrlKey: true }, input);
    expect(manager.getState().windows[id]?.status).toBe('normal');

    press('m', 'KeyM', { ctrlKey: true }, document.body);
    expect(manager.getState().windows[id]?.status).toBe('minimized');
  });

  it('still runs Ctrl+Alt shortcuts inside an input', () => {
    const { manager, wrapper } = setup();
    const id = manager.open({ appId: 'notes' });
    const { container } = render(<input />, { wrapper });
    press('m', 'KeyM', ctrlAlt, container.querySelector('input') as HTMLInputElement);
    expect(manager.getState().windows[id]?.status).toBe('minimized');
  });
});

describe('cycling windows', () => {
  const ctrl = { ctrlKey: true };

  it('opens the switcher with Ctrl+` and focuses the selection when Ctrl is released', () => {
    const { manager, wrapper } = setup();
    const first = manager.open({ appId: 'notes' });
    manager.open({ appId: 'notes' });
    const { result } = renderHook(() => useWindowSwitcher(), { wrapper });

    press('`', 'Backquote', ctrl);
    expect(result.current.open).toBe(true);
    expect(result.current.selectedId).toBe(first);

    fireEvent.keyUp(document.body, { key: 'Control', ctrlKey: false });
    expect(result.current.open).toBe(false);
    expect(manager.getState().focusedId).toBe(first);
  });

  it('moves the selection with more presses, backwards with Shift', () => {
    const { manager, wrapper } = setup();
    const ids = [
      manager.open({ appId: 'notes' }),
      manager.open({ appId: 'notes' }),
      manager.open({ appId: 'notes' }),
    ];
    const { result } = renderHook(() => useWindowSwitcher(), { wrapper });

    press('`', 'Backquote', ctrl);
    expect(result.current.selectedIndex).toBe(1);
    press('`', 'Backquote', ctrl);
    expect(result.current.selectedIndex).toBe(2);
    press('~', 'Backquote', { ctrlKey: true, shiftKey: true });
    expect(result.current.selectedIndex).toBe(1);
    expect(result.current.selectedId).toBe(ids[1]);
  });

  it('cancels with Escape and leaves focus alone', () => {
    const { manager, wrapper } = setup();
    manager.open({ appId: 'notes' });
    const top = manager.open({ appId: 'notes' });
    const { result } = renderHook(() => useWindowSwitcher(), { wrapper });
    press('`', 'Backquote', ctrl);
    press('Escape', 'Escape');
    expect(result.current.open).toBe(false);
    expect(manager.getState().focusedId).toBe(top);
  });

  it('does not open with fewer than two windows', () => {
    const { manager, wrapper } = setup();
    manager.open({ appId: 'notes' });
    const { result } = renderHook(() => useWindowSwitcher(), { wrapper });
    press('`', 'Backquote', ctrl);
    expect(result.current.open).toBe(false);
  });

  it('cancels when the browser window loses focus', () => {
    const { manager, wrapper } = setup();
    manager.open({ appId: 'notes' });
    manager.open({ appId: 'notes' });
    const { result } = renderHook(() => useWindowSwitcher(), { wrapper });
    press('`', 'Backquote', ctrl);
    expect(result.current.open).toBe(true);
    act(() => {
      globalThis.dispatchEvent(new Event('blur'));
    });
    expect(result.current.open).toBe(false);
  });
});
