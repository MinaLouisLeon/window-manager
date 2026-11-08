import { Button, Toaster } from '@integr8-media/ui';
import type { Story } from '@ladle/react';
import type { ReactElement, ReactNode } from 'react';
import type { Notification } from '../src/core/types';
import {
  Clock,
  NotificationArea,
  NotificationCenter,
  NotificationTrayItem,
  QuickSettings,
  useNotifications,
  WindowManagerShell,
} from '../src/index';
import { DemoProvider, Frame } from './demo';

type NewNotification = Omit<Notification, 'id' | 'createdAt' | 'read'>;

const SAMPLES: { label: string; notification: NewNotification }[] = [
  { label: 'Info', notification: { title: 'Just so you know' } },
  {
    label: 'Success',
    notification: { title: 'Saved', body: 'Everything is up to date.', level: 'success' },
  },
  { label: 'Warning', notification: { title: 'Battery low', level: 'warning' } },
  {
    label: 'Error with action',
    notification: {
      title: 'Upload failed',
      level: 'error',
      action: { label: 'Open Files', open: { appId: 'files' } },
    },
  },
];

function Note({ children }: { children: ReactNode }): ReactElement {
  return <p className="mb-3 text-sm text-muted-foreground">{children}</p>;
}

/** A strip that stands in for the end of a taskbar. */
function Strip({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      data-story-strip=""
      className="flex h-12 items-center justify-end rounded-md border border-border bg-card p-1 text-card-foreground"
    >
      {children}
    </div>
  );
}

/** Buttons that add one notification of each kind. */
function NotifyButtons({
  className = 'mt-3 flex flex-wrap gap-2',
}: {
  className?: string;
}): ReactElement {
  const center = useNotifications();
  return (
    <div className={className}>
      {SAMPLES.map((sample) => (
        <Button
          key={sample.label}
          size="sm"
          variant="outline"
          onClick={() => center.notify(sample.notification)}
        >
          {sample.label}
        </Button>
      ))}
    </div>
  );
}

export const NotificationAreaDefault: Story = () => (
  <DemoProvider options={{ windows: 0, tray: true, notifications: true }}>
    <Note>
      Tray items, the clock, the notification bell and the quick settings. Press a button below to
      add a notification: it also shows as a toast.
    </Note>
    <Strip>
      <NotificationArea />
    </Strip>
    <NotifyButtons />
    <Toaster />
  </DemoProvider>
);

export const NotificationAreaNoClock: Story = () => (
  <DemoProvider options={{ windows: 0, tray: true }}>
    <Strip>
      <NotificationArea clock={false} />
    </Strip>
  </DemoProvider>
);

export const NotificationCenterPopover: Story = () => (
  <DemoProvider options={{ windows: 0, notifications: true }}>
    <Note>Open the bell. Closing the list marks everything as read.</Note>
    <Strip>
      <NotificationCenter />
    </Strip>
    <NotifyButtons />
    <Toaster />
  </DemoProvider>
);

export const NotificationCenterManyNotifications: Story = () => (
  <DemoProvider options={{ windows: 0, notifications: 30 }}>
    <Note>Thirty notifications: the list scrolls inside the popover.</Note>
    <Strip>
      <NotificationCenter />
    </Strip>
    <Toaster />
  </DemoProvider>
);

export const NotificationCenterWithoutToasts: Story = () => (
  <DemoProvider options={{ windows: 0 }}>
    <Note>With toasts turned off, new notifications only appear in the list.</Note>
    <Strip>
      <NotificationCenter toasts={false} />
    </Strip>
    <NotifyButtons />
    <Toaster />
  </DemoProvider>
);

export const ClockPopover: Story = () => (
  <DemoProvider options={{ windows: 0 }}>
    <Note>The time and date; the popover shows the full date and a calendar.</Note>
    <Strip>
      <Clock />
      <Clock compact showSeconds />
    </Strip>
  </DemoProvider>
);

export const QuickSettingsPopover: Story = () => (
  <DemoProvider options={{ windows: 0 }}>
    <Note>Theme, taskbar position, auto-hide and window controls style.</Note>
    <Strip>
      <QuickSettings />
    </Strip>
  </DemoProvider>
);

export const NotificationTrayItemPopover: Story = () => (
  <DemoProvider options={{ windows: 0 }}>
    <Note>A tray item with content opens a popover; one without calls onSelect.</Note>
    <Strip>
      <NotificationTrayItem
        item={{ id: 'plain', label: 'Plain item', badge: 5 }}
        onSelect={() => undefined}
      />
      <NotificationTrayItem item={{ id: 'details', label: 'Details' }}>
        <p className="p-2 text-sm">Anything can go in here.</p>
      </NotificationTrayItem>
    </Strip>
  </DemoProvider>
);

export const ShellWithNotifications: Story = () => (
  <DemoProvider options={{ windows: 2, desktops: 2, tray: true, notifications: true }}>
    <Note>
      The shell with its default notification area at the end of the taskbar. The buttons in the top
      right of the desktop add notifications. Try Ctrl+Alt+O for the desktop overview, and
      right-click the desktop for the wallpaper picker.
    </Note>
    <Frame>
      {/* A transform makes this box the containing block of the Toaster, which is `position:
          fixed`: toasts then appear inside the shell instead of in the corner of the page. */}
      <div className="relative size-full" style={{ transform: 'translateZ(0)' }}>
        <WindowManagerShell className="h-full">
          <NotifyButtons className="absolute top-2 right-2 z-9400 flex flex-wrap justify-end gap-2" />
        </WindowManagerShell>
        <Toaster offset={{ bottom: 60, right: 16 }} />
      </div>
    </Frame>
  </DemoProvider>
);
