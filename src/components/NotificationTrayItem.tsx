import { Badge, Button, cn, Popover, PopoverContent, PopoverTrigger } from '@integr8-media/ui';
import { type CSSProperties, type ReactElement, type ReactNode, type Ref, useState } from 'react';
import type { TrayItem } from '../core/types';
import { AppIcon } from '../react/AppIcon';
import { POPUP_LAYER, POPUP_SIDE, useTaskbarClearance } from '../react/taskbarClearance';
import { useWindowManager } from '../react/useWindowManager';

/** Props of `NotificationTrayItem`. */
export interface NotificationTrayItemProps {
  /** The tray item to draw (see `useTray`). */
  item: TrayItem;
  /**
   * Content of the popover that opens when the button is pressed. Without it the button just
   * calls `onSelect`.
   */
  children?: ReactNode;
  /** Called when the button is pressed and there is no popover content. */
  onSelect?: () => void;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * An icon button for the notification area, with the item's badge. With `children` it opens a
 * popover (away from the taskbar); without them it calls `onSelect`. The accessible name is the
 * item's `label`.
 */
export function NotificationTrayItem({
  item,
  children,
  onSelect,
  className,
  style,
  ref,
}: NotificationTrayItemProps): ReactElement {
  const { state: position } = useWindowManager((state) => state.shell.taskbarPosition);
  const [open, setOpen] = useState(false);
  const clearance = useTaskbarClearance(open);
  const hasBadge = item.badge !== null && item.badge !== undefined && item.badge !== '';

  const button = (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      aria-label={item.label}
      title={item.label}
      data-wm-tray-item={item.id}
      className={cn('relative size-9 shrink-0 [&_svg]:size-4', className)}
      style={style}
      onClick={children === undefined ? onSelect : undefined}
    >
      <AppIcon
        icon={item.icon}
        className="size-4"
        fallback={<span className="text-xs font-medium">{item.label.charAt(0)}</span>}
      />
      {hasBadge ? (
        <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px]">
          {item.badge}
        </Badge>
      ) : null}
    </Button>
  );

  if (children === undefined) return button;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{button}</PopoverTrigger>
      <PopoverContent
        side={POPUP_SIDE[position]}
        align="end"
        collisionPadding={clearance}
        className={cn('w-72 p-2', POPUP_LAYER)}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
