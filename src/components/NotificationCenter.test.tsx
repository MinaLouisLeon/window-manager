import { toast } from '@integr8-media/ui';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import { NotificationCenter, type NotificationCenterProps } from './NotificationCenter';

vi.mock('@integr8-media/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@integr8-media/ui')>();
  const toast = Object.assign(vi.fn(), {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  });
  return { ...actual, toast };
});

beforeEach(() => {
  vi.clearAllMocks();
});

function setup(props: NotificationCenterProps = {}) {
  const manager = createTestManager();
  render(<NotificationCenter {...props} />, { wrapper: createWrapper(manager) });
  return { manager, user: userEvent.setup() };
}

const bell = (): HTMLElement =>
  document.querySelector('[data-wm-notification-bell]') as HTMLElement;

describe('NotificationCenter: bell', () => {
  it('is named "Notifications" while nothing is unread', () => {
    setup();
    expect(bell().getAttribute('aria-label')).toBe('Notifications');
    expect(bell().textContent).toBe('');
  });

  it('shows the unread count in its name and badge', () => {
    const { manager } = setup();
    act(() => {
      manager.notify({ title: 'One' });
      manager.notify({ title: 'Two' });
    });
    expect(bell().getAttribute('aria-label')).toBe('Notifications, 2 unread');
    expect(bell().textContent).toBe('2');
  });

  it('caps the badge at 99+', () => {
    const { manager } = setup();
    act(() => {
      for (let i = 0; i < 100; i += 1) manager.notify({ title: `n${i}` });
    });
    expect(bell().textContent).toBe('99+');
  });
});

describe('NotificationCenter: list', () => {
  it('says so when there is nothing', async () => {
    const { user } = setup();
    await user.click(bell());
    expect(await screen.findByText('No notifications')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark all read' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByRole('button', { name: 'Clear all' }).hasAttribute('disabled')).toBe(true);
  });

  it('lists notifications newest first with body, level and time', async () => {
    const { manager, user } = setup();
    act(() => {
      manager.notify({ title: 'Old', level: 'info' });
      manager.notify({ title: 'New', body: 'More text', level: 'error' });
    });
    await user.click(bell());
    const list = await screen.findByRole('list', { name: 'Notifications' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.dataset.level)).toEqual(['error', 'info']);
    expect(within(items[0] as HTMLElement).getByText('New')).toBeTruthy();
    expect(within(items[0] as HTMLElement).getByText('More text')).toBeTruthy();
    expect(items[0]?.querySelector('time')?.getAttribute('datetime')).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  it('treats a notification without a level as info', async () => {
    const { manager, user } = setup();
    act(() => {
      manager.notify({ title: 'Plain' });
    });
    await user.click(bell());
    const item = (await screen.findAllByRole('listitem'))[0];
    expect(item?.dataset.level).toBe('info');
  });

  it('marks everything read when it is closed', async () => {
    const { manager, user } = setup();
    act(() => {
      manager.notify({ title: 'One' });
    });
    await user.click(bell());
    const item = (await screen.findAllByRole('listitem'))[0];
    expect(item?.hasAttribute('data-read')).toBe(false);
    await user.keyboard('{Escape}');
    expect(manager.getState().notifications.every((entry) => entry.read)).toBe(true);
    expect(bell().getAttribute('aria-label')).toBe('Notifications');
  });

  it('marks everything read with "Mark all read" and keeps the list', async () => {
    const { manager, user } = setup();
    act(() => {
      manager.notify({ title: 'One' });
    });
    await user.click(bell());
    await user.click(await screen.findByRole('button', { name: 'Mark all read' }));
    expect(manager.getState().notifications[0]?.read).toBe(true);
    expect(screen.getAllByRole('listitem')[0]?.hasAttribute('data-read')).toBe(true);
  });

  it('dismisses one notification', async () => {
    const { manager, user } = setup();
    act(() => {
      manager.notify({ title: 'Keep' });
      manager.notify({ title: 'Drop' });
    });
    await user.click(bell());
    await user.click(await screen.findByRole('button', { name: 'Dismiss Drop' }));
    expect(manager.getState().notifications.map((entry) => entry.title)).toEqual(['Keep']);
  });

  it('clears all notifications', async () => {
    const { manager, user } = setup();
    act(() => {
      manager.notify({ title: 'One' });
      manager.notify({ title: 'Two' });
    });
    await user.click(bell());
    await user.click(await screen.findByRole('button', { name: 'Clear all' }));
    expect(manager.getState().notifications).toEqual([]);
    expect(await screen.findByText('No notifications')).toBeTruthy();
  });

  it('runs the action of a notification: opens the window, marks it read and closes', async () => {
    const { manager, user } = setup();
    act(() => {
      manager.notify({
        title: 'Export done',
        action: { label: 'Show file', open: { appId: 'notes', title: 'Export' } },
      });
    });
    await user.click(bell());
    await user.click(await screen.findByRole('button', { name: 'Show file' }));
    const windows = Object.values(manager.getState().windows);
    expect(windows.map((win) => win.title)).toEqual(['Export']);
    expect(manager.getState().notifications[0]?.read).toBe(true);
    expect(screen.queryByRole('list', { name: 'Notifications' })).toBeNull();
  });

  it('shows an action without a window to open, and only marks it read', async () => {
    const { manager, user } = setup();
    act(() => {
      manager.notify({ title: 'Heads up', action: { label: 'Got it' } });
    });
    await user.click(bell());
    await user.click(await screen.findByRole('button', { name: 'Got it' }));
    expect(Object.keys(manager.getState().windows)).toHaveLength(0);
    expect(manager.getState().notifications[0]?.read).toBe(true);
  });
});

describe('NotificationCenter: toasts', () => {
  it.each([
    ['success', toast.success],
    ['warning', toast.warning],
    ['error', toast.error],
    ['info', toast.info],
  ] as const)('shows a %s notification with the matching toast', (level, expected) => {
    const { manager } = setup();
    act(() => {
      manager.notify({ title: 'Hello', level });
    });
    expect(expected).toHaveBeenCalledWith('Hello', {});
  });

  it('shows a notification without a level as an info toast', () => {
    const { manager } = setup();
    act(() => {
      manager.notify({ title: 'Plain' });
    });
    expect(toast.info).toHaveBeenCalledWith('Plain', {});
  });

  it('passes the body as the description', () => {
    const { manager } = setup();
    act(() => {
      manager.notify({ title: 'Saved', body: 'All changes are safe.', level: 'success' });
    });
    expect(toast.success).toHaveBeenCalledWith('Saved', { description: 'All changes are safe.' });
  });

  it('gives the toast an action button that opens the window and marks it read', () => {
    const { manager } = setup();
    let id = '';
    act(() => {
      id = manager.notify({
        title: 'Done',
        level: 'success',
        action: { label: 'Open', open: { appId: 'notes' } },
      });
    });
    const options = vi.mocked(toast.success).mock.calls[0]?.[1] as {
      action: { label: string; onClick: () => void };
    };
    expect(options.action.label).toBe('Open');
    act(() => options.action.onClick());
    expect(Object.keys(manager.getState().windows)).toHaveLength(1);
    expect(manager.getState().notifications.find((entry) => entry.id === id)?.read).toBe(true);
  });

  it('shows no toast when toasts is false', () => {
    const { manager } = setup({ toasts: false });
    act(() => {
      manager.notify({ title: 'Quiet', level: 'error' });
    });
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('stops showing toasts when it unmounts', () => {
    const manager = createTestManager();
    const view = render(<NotificationCenter />, { wrapper: createWrapper(manager) });
    view.unmount();
    act(() => {
      manager.notify({ title: 'Late' });
    });
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('does not toast notifications that were added before it mounted', () => {
    const manager = createTestManager();
    manager.notify({ title: 'Earlier' });
    render(<NotificationCenter />, { wrapper: createWrapper(manager) });
    expect(toast.info).not.toHaveBeenCalled();
  });
});
