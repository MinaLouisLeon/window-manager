import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import type { AppId, OpenOptions } from '../core/types';
import { useAppWindow } from '../react/useAppWindow';
import { SnapPreview } from './SnapPreview';
import { Window } from './Window';

function Content() {
  const win = useAppWindow();
  return <p data-testid="content">content of {win.id}</p>;
}

const apps = { notes: Content, mac: Content, fixed: Content };

function setup(appId: AppId = 'notes', options: Partial<OpenOptions> = {}) {
  const manager = createTestManager();
  const id = manager.open({ appId, ...options });
  render(<Window windowId={id} />, { wrapper: createWrapper(manager, apps) });
  return { manager, id };
}

function controlOrder(): (string | null)[] {
  const controls = screen.getByRole('dialog').querySelector('[data-wm-window-controls]');
  return [...(controls?.querySelectorAll('[data-control]') ?? [])].map((el) =>
    el.getAttribute('data-control'),
  );
}

describe('Window', () => {
  it('is a dialog labelled by its title, with the state in data attributes', () => {
    const { id } = setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog.hasAttribute('data-wm-window')).toBe(true);
    expect(dialog.dataset.status).toBe('normal');
    expect(dialog.dataset.state).toBe('focused');
    expect(dialog.dataset.controlsStyle).toBe('windows');
    expect(dialog.dataset.taskbarPosition).toBe('bottom');
    expect(dialog.getAttribute('aria-modal')).toBeNull();
    const labelId = dialog.getAttribute('aria-labelledby') as string;
    expect(document.getElementById(labelId)?.textContent).toBe('Notes');
    expect(screen.getByTestId('content').textContent).toBe(`content of ${id}`);
  });

  it('renders nothing once the window is closed', async () => {
    const { manager, id } = setup();
    await act(async () => {
      await manager.close(id);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('has 8 resize handles and unmounts its content while minimized', () => {
    const { manager, id } = setup();
    expect(document.querySelectorAll('[data-wm-resize-handle]')).toHaveLength(8);
    act(() => manager.minimize(id));
    expect(screen.queryByTestId('content')).toBeNull();
    expect(document.querySelector<HTMLElement>('[data-wm-window]')?.dataset.status).toBe(
      'minimized',
    );
  });

  it('shows the title, the dirty dot and the badge', () => {
    const { manager, id } = setup();
    act(() => manager.update(id, { title: 'Draft', dirty: true, badge: 3 }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Draft')).toBeTruthy();
    expect(within(dialog).getByRole('img', { name: 'Unsaved changes' })).toBeTruthy();
    expect(within(dialog).getByText('3')).toBeTruthy();
  });

  it('runs the control buttons', () => {
    const { manager, id } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Maximize' }));
    expect(manager.getState().windows[id]?.status).toBe('maximized');
    expect(screen.getByRole('button', { name: 'Restore' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    expect(manager.getState().windows[id]?.status).toBe('minimized');
  });

  it('closes from the close button', async () => {
    const { manager, id } = setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    });
    expect(manager.getState().windows[id]).toBeUndefined();
  });

  it('draws the windows style by default: minimize, maximize, close on the right', () => {
    setup('notes');
    expect(controlOrder()).toEqual(['minimize', 'maximize', 'close']);
    const bar = screen.getByRole('dialog').querySelector('[data-wm-title-bar]') as HTMLElement;
    expect(bar.lastElementChild?.hasAttribute('data-wm-window-controls')).toBe(true);
  });

  it('draws the mac style on the left, close first, when the app asks for it', () => {
    setup('mac');
    const dialog = screen.getByRole('dialog');
    expect(dialog.dataset.controlsStyle).toBe('mac');
    expect(controlOrder()).toEqual(['close', 'minimize', 'maximize']);
    const bar = dialog.querySelector('[data-wm-title-bar]') as HTMLElement;
    expect(bar.firstElementChild?.hasAttribute('data-wm-window-controls')).toBe(true);
  });

  it('follows the shell setting for apps without their own controls style', () => {
    const manager = createTestManager();
    manager.setShellSettings({ controlsStyle: 'mac' });
    const id = manager.open({ appId: 'notes' });
    render(<Window windowId={id} />, { wrapper: createWrapper(manager, apps) });
    expect(screen.getByRole('dialog').dataset.controlsStyle).toBe('mac');
  });

  it('disables maximize for a fixed-size app and hides its resize handles', () => {
    setup('fixed');
    expect((screen.getByRole('button', { name: 'Maximize' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    const handle = document.querySelector<HTMLElement>('[data-wm-resize-handle="se"]');
    expect(handle?.style.display).toBe('none');
  });

  it('marks the window that does not have focus', () => {
    const { manager, id } = setup();
    act(() => {
      manager.open({ appId: 'notes' });
    });
    expect(screen.getByRole('dialog').dataset.state).toBe('unfocused');
    act(() => manager.focus(id));
    expect(screen.getByRole('dialog').dataset.state).toBe('focused');
  });

  it('blocks a parent with a modal child and sends presses to the child', () => {
    const manager = createTestManager();
    const parent = manager.open({ appId: 'notes' });
    const child = manager.open({ appId: 'notes', parentId: parent, modal: true });
    render(<Window windowId={parent} />, { wrapper: createWrapper(manager, apps) });
    const blocker = document.querySelector('[data-wm-blocker]') as HTMLElement;
    expect(blocker).not.toBeNull();
    expect(screen.getByRole('dialog').hasAttribute('data-blocked')).toBe(true);
    expect(document.querySelector('[data-wm-content]')?.hasAttribute('inert')).toBe(true);
    fireEvent.pointerDown(blocker);
    expect(manager.getState().focusedId).toBe(child);
  });

  it('opens the window menu from the icon button, with Move and Resize', async () => {
    const user = userEvent.setup();
    const { manager, id } = setup();
    await user.click(screen.getByRole('button', { name: 'Window menu' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Move' })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Resize' })).toBeTruthy();
    // Not "Minimize": Radix returns focus to the menu button, and in jsdom a focus event in the
    // hidden window would restore it at once (a browser cannot focus inside display: none).
    await user.click(within(menu).getByRole('menuitemcheckbox', { name: /Always on top/ }));
    expect(manager.getState().windows[id]?.alwaysOnTop).toBe(true);
  });
});

describe('SnapPreview', () => {
  it('renders nothing when no window is being dragged', () => {
    const manager = createTestManager();
    render(<SnapPreview />, { wrapper: createWrapper(manager) });
    expect(document.querySelector('[data-wm-snap-preview]')).toBeNull();
  });
});
