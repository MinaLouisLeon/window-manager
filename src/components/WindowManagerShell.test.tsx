import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestManager, createWrapper, stubSurfaceSize } from '../../test/harness';
import type { TaskbarPosition, WindowManager } from '../core/types';
import { useWindowSwitcher } from '../react/useWindowSwitcher';
import { WindowManagerShell } from './WindowManagerShell';
import { WindowSwitcher } from './WindowSwitcher';

let restoreSize: () => void;
beforeEach(() => {
  restoreSize = stubSurfaceSize(1000, 700);
});
afterEach(() => restoreSize());

function renderShell(manager: WindowManager = createTestManager()) {
  render(<WindowManagerShell />, { wrapper: createWrapper(manager) });
  return manager;
}

describe('WindowManagerShell', () => {
  it('renders the desktop, its icons and the taskbar', () => {
    renderShell();
    expect(document.querySelector('[data-wm-shell]')).not.toBeNull();
    expect(document.querySelector('[data-wm-desktop]')).not.toBeNull();
    expect(screen.getByRole('toolbar', { name: 'Taskbar' })).toBeTruthy();
    const icons = within(screen.getByRole('listbox', { name: 'Desktop icons' })).getAllByRole(
      'option',
    );
    expect(icons.map((icon) => icon.getAttribute('aria-label'))).toEqual(['Notes', 'Fixed', 'Mac']);
  });

  it('reports the surface size and the taskbar space to the manager', () => {
    const manager = renderShell();
    const state = manager.getState();
    expect(state.viewport).toEqual({ width: 1000, height: 700 });
    expect(state.insets.bottom).toBeGreaterThan(0);
  });

  it('opens an app from a desktop icon and shows its window', () => {
    const manager = renderShell();
    fireEvent.doubleClick(screen.getByRole('option', { name: 'Notes' }));
    expect(Object.keys(manager.getState().windows)).toHaveLength(1);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it.each<TaskbarPosition>(['bottom', 'top', 'left', 'right'])(
    'puts the taskbar at the %s edge',
    (position) => {
      const manager = createTestManager();
      manager.setShellSettings({ taskbarPosition: position });
      renderShell(manager);
      const bar = screen.getByRole('toolbar', { name: 'Taskbar' });
      expect(bar.dataset.taskbarPosition).toBe(position);
      expect(bar.getAttribute('aria-orientation')).toBe(
        position === 'left' || position === 'right' ? 'vertical' : 'horizontal',
      );
      expect(document.querySelector<HTMLElement>('[data-wm-shell]')?.dataset.taskbarPosition).toBe(
        position,
      );
    },
  );

  it('lists running windows on the taskbar and focuses or minimizes them on click', () => {
    const manager = createTestManager();
    const id = manager.open({ appId: 'notes' });
    renderShell(manager);
    const button = screen.getByRole('button', { name: 'Notes', pressed: true });
    fireEvent.click(button);
    expect(manager.getState().windows[id]?.status).toBe('minimized');
    fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
    expect(manager.getState().windows[id]?.status).toBe('normal');
  });

  it('shows pinned apps that are not running', () => {
    const manager = createTestManager();
    manager.pinApp('fixed');
    renderShell(manager);
    const button = screen.getByRole('button', { name: 'Fixed' });
    expect(button.hasAttribute('data-running')).toBe(false);
    fireEvent.click(button);
    expect(Object.values(manager.getState().windows).map((win) => win.appId)).toEqual(['fixed']);
  });

  it('hides the taskbar while a window is fullscreen', () => {
    const manager = createTestManager();
    const id = manager.open({ appId: 'notes' });
    renderShell(manager);
    expect(screen.queryByRole('toolbar', { name: 'Taskbar' })).not.toBeNull();
    act(() => manager.setFullscreen(id, true));
    expect(screen.queryByRole('toolbar', { name: 'Taskbar' })).toBeNull();
    act(() => manager.setFullscreen(id, false));
    expect(screen.queryByRole('toolbar', { name: 'Taskbar' })).not.toBeNull();
  });

  it('tucks an auto-hiding taskbar away until the pointer reaches the edge', () => {
    const manager = createTestManager();
    manager.setShellSettings({ taskbarAutoHide: true });
    renderShell(manager);
    const bar = screen.getByRole('toolbar', { name: 'Taskbar' });
    expect(bar.dataset.state).toBe('hidden');
    fireEvent.pointerEnter(document.querySelector('[data-wm-taskbar-hot-zone]') as Element);
    expect(bar.dataset.state).toBe('visible');
  });

  it('opens the start menu, filters by search and launches an app', async () => {
    const user = userEvent.setup();
    const manager = renderShell();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    const search = await screen.findByPlaceholderText('Search apps');
    await user.type(search, 'mac');
    const dialog = document.querySelector('[data-wm-start-menu]') as HTMLElement;
    expect(within(dialog).queryByText('Notes')).toBeNull();
    await user.click(within(dialog).getByText('Mac'));
    expect(Object.values(manager.getState().windows).map((win) => win.appId)).toEqual(['mac']);
    expect(document.querySelector('[data-wm-start-menu]')).toBeNull();
  });

  it('adds and switches desktops from the desktop switcher', async () => {
    const user = userEvent.setup();
    const manager = renderShell();
    await user.click(screen.getByRole('button', { name: 'Desktops' }));
    await user.click(await screen.findByRole('button', { name: 'New desktop' }));
    const state = manager.getState();
    expect(state.desktops).toHaveLength(2);
    expect(state.activeDesktopId).toBe(state.desktops[1]?.id);
  });

  it('asks before closing a window with unsaved changes', async () => {
    const user = userEvent.setup();
    const manager = createTestManager();
    const id = manager.open({ appId: 'notes' });
    renderShell(manager);
    act(() => manager.update(id, { dirty: true }));

    await user.click(screen.getByRole('button', { name: 'Close' }));
    const alert = await screen.findByRole('alertdialog');
    expect(within(alert).getByText('Close "Notes"?')).toBeTruthy();
    await user.click(within(alert).getByRole('button', { name: 'Cancel' }));
    expect(manager.getState().windows[id]).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(await screen.findByRole('button', { name: 'Discard changes' }));
    await act(async () => {});
    expect(manager.getState().windows[id]).toBeUndefined();
  });

  it('closes a clean window without asking', async () => {
    const user = userEvent.setup();
    const manager = createTestManager();
    const id = manager.open({ appId: 'notes' });
    renderShell(manager);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(manager.getState().windows[id]).toBeUndefined();
  });
});

function Cycler() {
  const switcher = useWindowSwitcher();
  return (
    <button type="button" onClick={() => switcher.cycle()}>
      cycle
    </button>
  );
}

describe('WindowSwitcher', () => {
  it('shows the windows while cycling and focuses the selection on commit', async () => {
    const manager = createTestManager();
    const first = manager.open({ appId: 'notes' });
    manager.open({ appId: 'fixed' });
    render(
      <>
        <Cycler />
        <WindowSwitcher />
      </>,
      { wrapper: createWrapper(manager) },
    );
    expect(screen.queryByRole('listbox', { name: 'Switch windows' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'cycle' }));
    const list = screen.getByRole('listbox', { name: 'Switch windows' });
    const options = within(list).getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options.map((option) => option.getAttribute('aria-selected'))).toEqual([
      'false',
      'true',
    ]);
    fireEvent.pointerDown(options[1] as HTMLElement);
    expect(manager.getState().focusedId).toBe(first);
    expect(screen.queryByRole('listbox', { name: 'Switch windows' })).toBeNull();
  });
});
