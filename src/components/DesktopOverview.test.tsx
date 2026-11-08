import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import type { WindowManager } from '../core/types';
import { DesktopOverview } from './DesktopOverview';

function setup() {
  const manager: WindowManager = createTestManager();
  const second = manager.addDesktop('Work');
  const notes = manager.open({ appId: 'notes' });
  const mac = manager.open({ appId: 'mac', desktopId: second });
  render(<DesktopOverview />, { wrapper: createWrapper(manager) });
  return { manager, second, notes, mac };
}

const overviewDialog = (): HTMLElement | null =>
  screen.queryByRole('dialog', { name: 'Desktop overview' });

const openOverview = (): void => {
  fireEvent.keyDown(document, { key: 'o', code: 'KeyO', ctrlKey: true, altKey: true });
};

describe('DesktopOverview', () => {
  it('renders nothing while closed', () => {
    setup();
    expect(screen.queryByRole('dialog', { name: 'Desktop overview' })).toBeNull();
  });

  it('opens with Ctrl+Alt+O as a dialog and moves focus into it', async () => {
    setup();
    openOverview();
    const overview = await screen.findByRole('dialog', { name: 'Desktop overview' });
    await waitFor(() => expect(overview.contains(document.activeElement)).toBe(true));
  });

  it('shows every desktop with a frame for each window', () => {
    setup();
    openOverview();
    const desktops = screen.getAllByRole('region');
    expect(desktops.map((desktop) => desktop.getAttribute('aria-label'))).toEqual([
      'Desktop 1',
      'Work',
    ]);
    expect(within(desktops[0] as HTMLElement).getByRole('button', { name: 'Notes' })).toBeTruthy();
    expect(within(desktops[1] as HTMLElement).getByRole('button', { name: 'Mac' })).toBeTruthy();
    expect(desktops[0]?.hasAttribute('data-active')).toBe(true);
    expect(desktops[1]?.hasAttribute('data-active')).toBe(false);
  });

  it('places a frame by the window position and size', () => {
    setup();
    openOverview();
    const frame = screen.getByRole('button', { name: 'Notes' });
    expect(frame.style.left).toBe('0%');
    expect(frame.style.width).toBe('40%');
  });

  it('marks minimized windows', () => {
    const { manager, notes } = setup();
    act(() => manager.minimize(notes));
    openOverview();
    expect(screen.getByRole('button', { name: 'Notes' }).hasAttribute('data-minimized')).toBe(true);
  });

  it('switches to a desktop from its name and closes', () => {
    const { manager, second } = setup();
    openOverview();
    fireEvent.click(within(screen.getByRole('region', { name: 'Work' })).getByText('Work'));
    expect(manager.getState().activeDesktopId).toBe(second);
    expect(screen.queryByRole('dialog', { name: 'Desktop overview' })).toBeNull();
  });

  it('switches to a desktop from its preview and closes', () => {
    const { manager, second } = setup();
    openOverview();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Work' }));
    expect(manager.getState().activeDesktopId).toBe(second);
    expect(screen.queryByRole('dialog', { name: 'Desktop overview' })).toBeNull();
  });

  it('focuses a window on another desktop and closes', () => {
    const { manager, mac } = setup();
    openOverview();
    fireEvent.click(screen.getByRole('button', { name: 'Mac' }));
    expect(manager.getState().focusedId).toBe(mac);
    expect(manager.getState().activeDesktopId).toBe(manager.getState().windows[mac]?.desktopId);
    expect(screen.queryByRole('dialog', { name: 'Desktop overview' })).toBeNull();
  });

  it('moves a window to another desktop by dragging it', () => {
    const { manager, second, notes } = setup();
    openOverview();
    const frame = screen.getByRole('button', { name: 'Notes' });
    expect(frame.getAttribute('draggable')).toBe('true');
    const target = screen.getByRole('region', { name: 'Work' });
    fireEvent.dragStart(frame);
    fireEvent.dragOver(target);
    expect(target.hasAttribute('data-drop-target')).toBe(true);
    fireEvent.drop(target);
    expect(manager.getState().windows[notes]?.desktopId).toBe(second);
    // Dropping does not close the overview or change the active desktop.
    expect(screen.getByRole('dialog', { name: 'Desktop overview' })).toBeTruthy();
    expect(manager.getState().activeDesktopId).toBe('desktop-1');
    const work = screen.getByRole('region', { name: 'Work' });
    expect(within(work).getByRole('button', { name: 'Notes' })).toBeTruthy();
  });

  it('moves a window with Shift+ArrowRight', () => {
    const { manager, second, notes } = setup();
    openOverview();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Notes' }), {
      key: 'ArrowRight',
      shiftKey: true,
    });
    expect(manager.getState().windows[notes]?.desktopId).toBe(second);
  });

  it('adds a desktop and stays open', () => {
    const { manager } = setup();
    openOverview();
    fireEvent.click(screen.getByRole('button', { name: 'New desktop' }));
    expect(manager.getState().desktops).toHaveLength(3);
    expect(screen.getAllByRole('region')).toHaveLength(3);
  });

  // Closing by a press outside the dialog is Radix's own behavior; jsdom does not run it (not even
  // for a bare ui Dialog), so it is not tested here.
  it('closes on Escape and on Ctrl+Alt+O, and stays open for a press inside', async () => {
    setup();
    openOverview();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(overviewDialog()).toBeNull());

    openOverview();
    openOverview();
    await waitFor(() => expect(overviewDialog()).toBeNull());

    openOverview();
    const overview = await screen.findByRole('dialog', { name: 'Desktop overview' });
    fireEvent.pointerDown(within(overview).getByRole('region', { name: 'Work' }));
    expect(overviewDialog()).not.toBeNull();
  });

  it('draws the wallpaper of a desktop in its preview', () => {
    const { manager } = setup();
    act(() => manager.setWallpaper('desktop-1', { type: 'color', value: 'rgb(1, 2, 3)' }));
    openOverview();
    const preview = document.querySelector<HTMLElement>('[data-wm-overview-preview]');
    expect(preview?.style.background).toBe('rgb(1, 2, 3)');
  });

  it('accepts className, style and a ref', () => {
    const manager = createTestManager();
    let node: HTMLDivElement | null = null;
    render(
      <DesktopOverview
        className="custom"
        style={{ opacity: 0.9 }}
        ref={(element) => {
          node = element;
        }}
      />,
      { wrapper: createWrapper(manager) },
    );
    openOverview();
    expect(node).not.toBeNull();
    const overview = screen.getByRole('dialog', { name: 'Desktop overview' });
    expect(overview).toBe(node);
    expect(overview.classList.contains('custom')).toBe(true);
    expect(overview.style.opacity).toBe('0.9');
  });
});
