import { ThemeProvider } from '@integr8-media/ui';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestManager, createWrapper, stubSurfaceSize } from '../../test/harness';
import type { TaskbarPosition, WindowManager } from '../core/types';
import { Clock } from './Clock';
import { NotificationArea, type NotificationAreaProps } from './NotificationArea';
import { NotificationTrayItem } from './NotificationTrayItem';
import { QuickSettings } from './QuickSettings';
import { WindowManagerShell } from './WindowManagerShell';

function setup(props: NotificationAreaProps = {}, manager: WindowManager = createTestManager()) {
  render(<NotificationArea {...props} />, { wrapper: createWrapper(manager) });
  return { manager, user: userEvent.setup() };
}

const area = (): HTMLElement =>
  document.querySelector('[data-wm-notification-area]') as HTMLElement;

describe('NotificationArea', () => {
  it('has the clock, the notification bell and the quick settings', () => {
    setup();
    expect(document.querySelector('[data-wm-clock]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quick settings' })).toBeTruthy();
  });

  it('leaves the clock out with clock={false}', () => {
    setup({ clock: false });
    expect(document.querySelector('[data-wm-clock]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy();
  });

  it('passes options to the clock', () => {
    setup({ clock: { locale: 'en-US', hour12: false, showSeconds: true } });
    const time = document.querySelector('[data-wm-clock] time');
    expect(time?.textContent).toMatch(/^\d\d:\d\d:\d\d$/);
  });

  it('draws a button for each tray item, in order', () => {
    const manager = createTestManager();
    manager.registerTrayItem({ id: 'b', label: 'Beta', order: 2 });
    manager.registerTrayItem({ id: 'a', label: 'Alpha', order: 1 });
    setup({}, manager);
    const labels = [...document.querySelectorAll('[data-wm-tray-item]')].map((element) =>
      element.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['Alpha', 'Beta']);
  });

  it('shows tray items that are registered later and drops them when removed', () => {
    const { manager } = setup();
    let unregister = () => {};
    act(() => {
      unregister = manager.registerTrayItem({ id: 'sync', label: 'Sync' });
    });
    expect(screen.getByRole('button', { name: 'Sync' })).toBeTruthy();
    act(() => unregister());
    expect(screen.queryByRole('button', { name: 'Sync' })).toBeNull();
  });

  it('opens the app of a tray item when it is pressed', async () => {
    const manager = createTestManager();
    manager.registerTrayItem({ id: 'notes-tray', label: 'Notes tray', appId: 'notes' });
    const { user } = setup({}, manager);
    await user.click(screen.getByRole('button', { name: 'Notes tray' }));
    expect(Object.values(manager.getState().windows).map((win) => win.appId)).toEqual(['notes']);
  });

  it('does nothing for a tray item without an app', async () => {
    const manager = createTestManager();
    manager.registerTrayItem({ id: 'plain', label: 'Plain' });
    const { user } = setup({}, manager);
    await user.click(screen.getByRole('button', { name: 'Plain' }));
    expect(Object.keys(manager.getState().windows)).toHaveLength(0);
  });

  it('shows the badge of a tray item and follows updates', () => {
    const manager = createTestManager();
    manager.registerTrayItem({ id: 'sync', label: 'Sync', badge: 3 });
    setup({}, manager);
    // The button holds the letter fallback for the missing icon, then the badge.
    expect(screen.getByRole('button', { name: 'Sync' }).textContent).toBe('S3');
    act(() => manager.updateTrayItem('sync', { badge: null }));
    expect(screen.getByRole('button', { name: 'Sync' }).textContent).toBe('S');
  });

  it('lets renderTrayItem draw the items', () => {
    const manager = createTestManager();
    manager.registerTrayItem({ id: 'sync', label: 'Sync' });
    setup({ renderTrayItem: (item) => <span data-testid="custom">{item.label}!</span> }, manager);
    expect(screen.getByTestId('custom').textContent).toBe('Sync!');
    expect(screen.queryByRole('button', { name: 'Sync' })).toBeNull();
  });

  it.each<[TaskbarPosition, boolean]>([
    ['bottom', false],
    ['top', false],
    ['left', true],
    ['right', true],
  ])('lines up for a taskbar at the %s edge (vertical: %s)', (position, vertical) => {
    const manager = createTestManager();
    manager.setShellSettings({ taskbarPosition: position });
    setup({}, manager);
    expect(area().classList.contains('flex-col')).toBe(vertical);
    // A vertical taskbar has no room for the date: the clock shows the time only.
    expect(document.querySelector('[data-wm-clock]')?.children).toHaveLength(vertical ? 1 : 2);
  });

  it('accepts className, style and a ref', () => {
    let node: HTMLDivElement | null = null;
    setup({
      className: 'custom',
      style: { opacity: 0.7 },
      ref: (element) => {
        node = element;
      },
    });
    expect(area()).toBe(node);
    expect(area().classList.contains('custom')).toBe(true);
    expect(area().style.opacity).toBe('0.7');
  });
});

describe('NotificationTrayItem', () => {
  const item = { id: 'sync', label: 'Sync', badge: 2 };

  it('calls onSelect when pressed and there is no popover', async () => {
    const manager = createTestManager();
    let selected = 0;
    render(<NotificationTrayItem item={item} onSelect={() => (selected += 1)} />, {
      wrapper: createWrapper(manager),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Sync' }));
    expect(selected).toBe(1);
  });

  it('opens a popover with its children', async () => {
    const manager = createTestManager();
    render(
      <NotificationTrayItem item={item}>
        <p>Last sync: now</p>
      </NotificationTrayItem>,
      { wrapper: createWrapper(manager) },
    );
    expect(screen.queryByText('Last sync: now')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Sync' }));
    expect(await screen.findByText('Last sync: now')).toBeTruthy();
  });

  it('falls back to the first letter of the label when it has no icon', () => {
    const manager = createTestManager();
    render(<NotificationTrayItem item={{ id: 'sync', label: 'Sync' }} />, {
      wrapper: createWrapper(manager),
    });
    expect(screen.getByRole('button', { name: 'Sync' }).textContent).toBe('S');
  });

  it('draws an image icon', () => {
    const manager = createTestManager();
    const withIcon = { id: 'sync', label: 'Sync', icon: { src: '/sync.svg', alt: '' } };
    render(<NotificationTrayItem item={withIcon} />, { wrapper: createWrapper(manager) });
    // ui's Avatar only renders the <img> once the browser has loaded it, which jsdom never does.
    const avatar = screen
      .getByRole('button', { name: 'Sync' })
      .querySelector('[data-slot="avatar"]');
    expect(avatar).not.toBeNull();
  });

  it('shows no badge for an empty one', () => {
    const manager = createTestManager();
    render(<NotificationTrayItem item={{ id: 'sync', label: 'Sync', badge: '' }} />, {
      wrapper: createWrapper(manager),
    });
    expect(screen.getByRole('button', { name: 'Sync' }).textContent).toBe('S');
  });
});

describe('Clock', () => {
  it('shows the time and the date', () => {
    const manager = createTestManager();
    render(<Clock locale="en-US" hour12={false} />, { wrapper: createWrapper(manager) });
    const button = document.querySelector('[data-wm-clock]') as HTMLElement;
    expect(button.querySelector('time')?.textContent).toMatch(/^\d\d:\d\d$/);
    expect(button.textContent).toMatch(/[A-Z][a-z]{2}, [A-Z][a-z]{2} \d+$/);
  });

  it('shows only the time when compact', () => {
    const manager = createTestManager();
    render(<Clock compact locale="en-US" hour12={false} />, { wrapper: createWrapper(manager) });
    expect(document.querySelector('[data-wm-clock]')?.textContent).toMatch(/^\d\d:\d\d$/);
  });

  it('opens a popover with the full date and a calendar', async () => {
    const manager = createTestManager();
    render(<Clock locale="en-US" />, { wrapper: createWrapper(manager) });
    await userEvent.click(document.querySelector('[data-wm-clock]') as HTMLElement);
    expect(await screen.findByRole('grid')).toBeTruthy();
    const title = document.querySelector('[data-wm-clock]')?.getAttribute('title') ?? '';
    expect(screen.getAllByText(title).length).toBeGreaterThan(0);
  });
});

describe('QuickSettings', () => {
  async function open(manager: WindowManager = createTestManager(), withTheme = false) {
    const user = userEvent.setup();
    const wrapper = createWrapper(manager);
    render(
      withTheme ? (
        <ThemeProvider>
          <QuickSettings />
        </ThemeProvider>
      ) : (
        <QuickSettings />
      ),
      { wrapper },
    );
    await user.click(screen.getByRole('button', { name: 'Quick settings' }));
    return { manager, user };
  }

  it('shows the current settings', async () => {
    await open();
    const bottom = await screen.findByRole('radio', { name: 'Bottom' });
    const windows = screen.getByRole('radio', { name: 'Windows' });
    const autoHide = screen.getByRole('switch', { name: 'Auto-hide the taskbar' });
    expect(bottom.getAttribute('aria-checked')).toBe('true');
    expect(windows.getAttribute('aria-checked')).toBe('true');
    expect(autoHide.getAttribute('aria-checked')).toBe('false');
  });

  it('changes the taskbar position', async () => {
    const { manager, user } = await open();
    await user.click(await screen.findByRole('radio', { name: 'Left' }));
    expect(manager.getState().shell.taskbarPosition).toBe('left');
  });

  it('turns auto-hide on and off', async () => {
    const { manager, user } = await open();
    const toggle = await screen.findByRole('switch', { name: 'Auto-hide the taskbar' });
    await user.click(toggle);
    expect(manager.getState().shell.taskbarAutoHide).toBe(true);
    await user.click(toggle);
    expect(manager.getState().shell.taskbarAutoHide).toBe(false);
  });

  it('changes the window controls style', async () => {
    const { manager, user } = await open();
    await user.click(await screen.findByRole('radio', { name: 'Mac' }));
    expect(manager.getState().shell.controlsStyle).toBe('mac');
  });

  it('keeps the current choice when the selected option is pressed again', async () => {
    const { manager, user } = await open();
    await user.click(await screen.findByRole('radio', { name: 'Bottom' }));
    expect(manager.getState().shell.taskbarPosition).toBe('bottom');
  });

  it('has no theme switcher without a ThemeProvider', async () => {
    await open();
    await screen.findByRole('radio', { name: 'Bottom' });
    expect(document.querySelector('[data-slot="theme-switcher"]')).toBeNull();
  });

  it('has a theme switcher inside a ThemeProvider', async () => {
    await open(createTestManager(), true);
    await screen.findByRole('radio', { name: 'Bottom' });
    // ui's ThemeSwitcher button has no accessible name when it shows the theme name.
    expect(document.querySelector('[data-slot="theme-switcher"]')).not.toBeNull();
  });
});

describe('WindowManagerShell with the notification area', () => {
  let restoreSize: () => void;
  beforeEach(() => {
    restoreSize = stubSurfaceSize(1000, 700);
  });
  afterEach(() => restoreSize());

  it('puts the notification area at the end of the taskbar by default', () => {
    const manager = createTestManager();
    render(<WindowManagerShell />, { wrapper: createWrapper(manager) });
    const bar = screen.getByRole('toolbar', { name: 'Taskbar' });
    expect(bar.querySelector('[data-wm-notification-area]')).not.toBeNull();
    expect(bar.lastElementChild).toBe(bar.querySelector('[data-wm-notification-area]'));
  });

  it('uses the notification area the app passes, or none with null', () => {
    const manager = createTestManager();
    const first = render(<WindowManagerShell notificationArea={<span data-testid="mine" />} />, {
      wrapper: createWrapper(manager),
    });
    expect(screen.getByTestId('mine')).toBeTruthy();
    expect(document.querySelector('[data-wm-notification-area]')).toBeNull();
    first.unmount();

    render(<WindowManagerShell notificationArea={null} />, { wrapper: createWrapper(manager) });
    expect(document.querySelector('[data-wm-notification-area]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quick settings' })).toBeNull();
  });

  it('opens the desktop overview with Ctrl+Alt+O', async () => {
    const manager = createTestManager();
    render(<WindowManagerShell />, { wrapper: createWrapper(manager) });
    const user = userEvent.setup();
    await user.keyboard('{Control>}{Alt>}o{/Alt}{/Control}');
    expect(screen.getByRole('dialog', { name: 'Desktop overview' })).toBeTruthy();
  });

  it('opens the desktop overview from the desktop switcher', async () => {
    const manager = createTestManager();
    render(<WindowManagerShell />, { wrapper: createWrapper(manager) });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Desktops' }));
    await user.click(await screen.findByRole('button', { name: 'Desktop overview' }));
    expect(await screen.findByRole('dialog', { name: 'Desktop overview' })).toBeTruthy();
  });
});
