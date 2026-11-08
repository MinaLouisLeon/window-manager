import type { Notification, WindowManager } from '../core/types';
import { useManagerSelector } from './useManagerSelector';
import { useWindowManagerContext } from './windowManagerContext';

/** What `useNotifications` returns. */
export interface UseNotificationsResult {
  /** Newest first. */
  notifications: Notification[];
  /** How many notifications are not read yet. */
  unreadCount: number;
  /** Adds a notification and returns its id. */
  notify: WindowManager['notify'];
  /** Marks one notification (or `'all'`) as read. */
  markRead(id: string | 'all'): void;
  dismiss(id: string): void;
  /** Removes every notification. */
  clear(): void;
  /**
   * Runs a notification's action (opens the window it names, when it has one), marks the
   * notification as read and returns the new window's id (null when there was nothing to open).
   */
  activate(id: string): string | null;
}

/** The notifications, the unread count, and the actions to add, read, dismiss and clear them. */
export function useNotifications(): UseNotificationsResult {
  const { manager } = useWindowManagerContext();
  const notifications = useManagerSelector((state) => state.notifications);
  const unreadCount = useManagerSelector(
    (state) => state.notifications.filter((entry) => !entry.read).length,
  );
  return {
    notifications,
    unreadCount,
    notify: (notification) => manager.notify(notification),
    markRead: (id) => manager.markRead(id),
    dismiss: (id) => manager.dismiss(id),
    clear: () => manager.clearNotifications(),
    activate(id) {
      const found = manager.getState().notifications.find((entry) => entry.id === id);
      if (found === undefined) return null;
      manager.markRead(id);
      const open = found.action?.open;
      return open === undefined ? null : manager.open(open);
    },
  };
}
