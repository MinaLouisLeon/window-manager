import { cn } from '@integr8-media/ui';
import { type CSSProperties, Fragment, type ReactElement, type ReactNode, type Ref } from 'react';
import type { TrayItem } from '../core/types';
import { launchApp } from '../react/launchApp';
import { useTray } from '../react/useTray';
import { useWindowManager } from '../react/useWindowManager';
import { Clock, type ClockProps } from './Clock';
import { NotificationCenter, type NotificationCenterProps } from './NotificationCenter';
import { NotificationTrayItem } from './NotificationTrayItem';
import { QuickSettings } from './QuickSettings';

/** Props of `NotificationArea`. */
export interface NotificationAreaProps {
  /** Options of the clock, or `false` to leave it out. */
  clock?: Omit<ClockProps, 'compact' | 'className' | 'style' | 'ref'> | false;
  /** Options of the notification center (for example `toasts: false`). */
  notifications?: Pick<NotificationCenterProps, 'toasts'>;
  /**
   * Draws one tray item. Default: a `NotificationTrayItem` button that opens (or focuses) the
   * item's app when it has an `appId`. Return a `NotificationTrayItem` with `children` to give an
   * item a popover.
   */
  renderTrayItem?: (item: TrayItem) => ReactNode;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

/**
 * The end of the taskbar: the tray items apps registered, the clock, the notification bell and the
 * quick settings. It lines up along the taskbar, also when the taskbar is on the left or right.
 * `WindowManagerShell` puts it in the taskbar by default.
 */
export function NotificationArea({
  clock,
  notifications,
  renderTrayItem,
  className,
  style,
  ref,
}: NotificationAreaProps): ReactElement {
  const tray = useTray();
  const { manager, state: position } = useWindowManager((state) => state.shell.taskbarPosition);
  const vertical = position === 'left' || position === 'right';

  return (
    <div
      ref={ref}
      data-wm-notification-area=""
      className={cn('flex shrink-0 items-center gap-0.5', vertical && 'flex-col', className)}
      style={style}
    >
      {tray.items.map((item) =>
        renderTrayItem ? (
          <Fragment key={item.id}>{renderTrayItem(item)}</Fragment>
        ) : (
          <NotificationTrayItem
            key={item.id}
            item={item}
            onSelect={() => {
              if (item.appId !== undefined) launchApp(manager, item.appId);
            }}
          />
        ),
      )}
      {clock === false ? null : <Clock {...clock} compact={vertical} />}
      <NotificationCenter {...notifications} />
      <QuickSettings />
    </div>
  );
}
