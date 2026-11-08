import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  toast,
} from '@integr8-media/ui';
import { Bell, CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import {
  type CSSProperties,
  type ReactElement,
  type Ref,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Notification } from '../core/types';
import { POPUP_LAYER, POPUP_SIDE, useTaskbarClearance } from '../react/taskbarClearance';
import { useNotifications } from '../react/useNotifications';
import { useWindowManager } from '../react/useWindowManager';

/** Props of `NotificationCenter`. */
export interface NotificationCenterProps {
  /**
   * Also show each new notification as a toast (ui's `toast()`, so a `Toaster` must be mounted).
   * Default true.
   */
  toasts?: boolean;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLButtonElement>;
}

const LEVEL_ICONS = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
} as const;

/** The ui `Alert` variant of each notification level. */
const LEVEL_VARIANTS = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'destructive',
} as const;

function levelOf(notification: Notification): keyof typeof LEVEL_ICONS {
  return notification.level ?? 'info';
}

/**
 * The notification bell with an unread badge. It opens a popover listing the notifications
 * (newest first, with their action, dismiss, "Mark all read" and "Clear all"); closing it marks
 * everything as read. With `toasts` (the default) every new notification also appears as a toast.
 */
export function NotificationCenter({
  toasts = true,
  className,
  style,
  ref,
}: NotificationCenterProps): ReactElement {
  const { manager, state: position } = useWindowManager((state) => state.shell.taskbarPosition);
  const center = useNotifications();
  const [open, setOpen] = useState(false);
  const clearance = useTaskbarClearance(open);
  const time = useMemo(
    () => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }),
    [],
  );

  // New notifications also show as toasts. `manager` never changes, so this runs once.
  useEffect(() => {
    if (!toasts) return;
    return manager.on('notification', ({ notification }) => {
      const target = notification.action?.open;
      const options = {
        ...(notification.body === undefined ? {} : { description: notification.body }),
        ...(notification.action === undefined
          ? {}
          : {
              action: {
                label: notification.action.label,
                onClick: () => {
                  manager.markRead(notification.id);
                  if (target !== undefined) manager.open(target);
                },
              },
            }),
      };
      const show =
        notification.level === 'success'
          ? toast.success
          : notification.level === 'warning'
            ? toast.warning
            : notification.level === 'error'
              ? toast.error
              : toast.info;
      show(notification.title, options);
    });
  }, [manager, toasts]);

  const { unreadCount, notifications } = center;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) center.markRead('all');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          variant="ghost"
          size="icon"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          data-wm-notification-bell=""
          className={cn('relative size-9 shrink-0', className)}
          style={style}
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side={POPUP_SIDE[position]}
        align="end"
        collisionPadding={clearance}
        data-wm-notification-center=""
        className={cn('w-80 p-0', POPUP_LAYER)}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border p-2">
          <p className="px-1 text-sm font-medium">Notifications</p>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={unreadCount === 0}
              onClick={() => center.markRead('all')}
            >
              Mark all read
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={notifications.length === 0}
              onClick={() => center.clear()}
            >
              Clear all
            </Button>
          </div>
        </div>
        {notifications.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No notifications</p>
        ) : (
          <ScrollArea className="[&_[data-slot=scroll-area-viewport]]:max-h-80">
            <ul aria-label="Notifications" className="flex flex-col gap-1 p-1">
              {notifications.map((notification) => {
                const level = levelOf(notification);
                const Icon = LEVEL_ICONS[level];
                return (
                  <li
                    key={notification.id}
                    data-wm-notification={notification.id}
                    data-level={level}
                    data-read={notification.read ? '' : undefined}
                    className="data-read:opacity-70"
                  >
                    {/* ui's Alert is a live region by default; a row in a list is not. */}
                    <Alert variant={LEVEL_VARIANTS[level]} role="group" className="px-3 py-2 pr-10">
                      <Icon aria-hidden="true" />
                      <AlertTitle className="line-clamp-none wrap-break-word">
                        {notification.title}
                      </AlertTitle>
                      <AlertDescription>
                        {notification.body === undefined ? null : (
                          <p className="wrap-break-word">{notification.body}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <time
                            dateTime={new Date(notification.createdAt).toISOString()}
                            className="text-[10px]"
                          >
                            {time.format(notification.createdAt)}
                          </time>
                          {notification.action === undefined ? null : (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-xs"
                              onClick={() => {
                                center.activate(notification.id);
                                setOpen(false);
                              }}
                            >
                              {notification.action.label}
                            </Button>
                          )}
                        </div>
                      </AlertDescription>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-1 right-1"
                        aria-label={`Dismiss ${notification.title}`}
                        onClick={() => center.dismiss(notification.id)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </Alert>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
