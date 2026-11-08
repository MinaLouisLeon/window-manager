import { Button, Calendar, cn, Popover, PopoverContent, PopoverTrigger } from '@integr8-media/ui';
import { type CSSProperties, type ReactElement, type Ref, useState } from 'react';
import { POPUP_LAYER, POPUP_SIDE, useTaskbarClearance } from '../react/taskbarClearance';
import { type UseClockOptions, useClock } from '../react/useClock';
import { useWindowManager } from '../react/useWindowManager';

/** Props of `Clock`. */
export interface ClockProps extends UseClockOptions {
  /** Show the time only (for a vertical taskbar). Default false: time and date. */
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * The time and date as a button that opens a popover with the full date and a month calendar
 * (ui's `Calendar`, display only). It updates on the minute (or the second, with `showSeconds`).
 */
export function Clock({
  compact = false,
  locale,
  hour12,
  showSeconds,
  className,
  style,
  ref,
}: ClockProps): ReactElement {
  const clock = useClock({
    ...(locale === undefined ? {} : { locale }),
    ...(hour12 === undefined ? {} : { hour12 }),
    ...(showSeconds === undefined ? {} : { showSeconds }),
  });
  const { state: position } = useWindowManager((state) => state.shell.taskbarPosition);
  const [open, setOpen] = useState(false);
  const clearance = useTaskbarClearance(open);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          variant="ghost"
          title={clock.fullDate}
          data-wm-clock=""
          className={cn(
            'h-9 shrink-0 flex-col gap-0 px-2 text-xs leading-tight font-normal',
            compact && 'w-full px-0 text-[10px]',
            className,
          )}
          style={style}
        >
          <time dateTime={clock.now.toISOString()}>{clock.time}</time>
          {compact ? null : <span className="text-muted-foreground">{clock.date}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side={POPUP_SIDE[position]}
        align="end"
        collisionPadding={clearance}
        className={cn('w-auto p-2', POPUP_LAYER)}
      >
        <p className="px-2 pb-1 text-sm font-medium">{clock.fullDate}</p>
        <Calendar />
      </PopoverContent>
    </Popover>
  );
}
