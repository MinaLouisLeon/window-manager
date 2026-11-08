import { cn, HoverCard, HoverCardContent, HoverCardTrigger } from '@integr8-media/ui';
import {
  type CSSProperties,
  type ReactElement,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  useEffect,
  useRef,
  useState,
} from 'react';
import { boundsForZone } from '../core/geometry';
import type { WindowId } from '../core/types';
import { POPUP_LAYER, useTaskbarClearance } from '../react/taskbarClearance';
import { useSnapLayouts } from '../react/useSnapLayouts';
import { SNAP_ZONE_LABELS } from '../react/useWindowMenu';

/** Props of `SnapLayoutsMenu`. */
export interface SnapLayoutsMenuProps {
  /** The window the chosen layout zone is applied to. */
  windowId: WindowId;
  /** The maximize button: the menu opens on hovering it or long-pressing it (touch and pen). */
  children: ReactElement;
  /** Milliseconds a touch must stay down to open the menu. Default 500. */
  longPressMs?: number;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

/** The unit square every layout is drawn in (zones are turned into percentages of it). */
const UNIT = { x: 0, y: 0, width: 100, height: 100 };

/**
 * A menu of snap layouts (halves, quarters, thirds, two thirds and a third) that opens on hovering
 * or long-pressing the maximize button. Pick a zone of a layout to snap the window there. The
 * menu is a pointer shortcut: the window menu's Snap submenu and the shortcuts reach the same
 * zones by keyboard. Windows that cannot snap (fixed size, fullscreen) get just the button.
 */
export function SnapLayoutsMenu({
  windowId,
  children,
  longPressMs = 500,
  className,
  style,
  ref,
}: SnapLayoutsMenuProps): ReactElement {
  const layouts = useSnapLayouts(windowId);
  const [open, setOpen] = useState(false);
  const clearance = useTaskbarClearance(open);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressed = useRef(false);

  const cancelPress = (): void => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
  };
  useEffect(
    () => () => {
      if (timer.current !== undefined) clearTimeout(timer.current);
    },
    [],
  );

  if (!layouts.available) return children;

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>): void => {
    if (event.pointerType === 'mouse') return;
    longPressed.current = false;
    cancelPress();
    timer.current = setTimeout(() => {
      timer.current = undefined;
      longPressed.current = true;
      setOpen(true);
    }, longPressMs);
  };

  // The press that opened the menu must not also toggle maximize when the finger lifts.
  const onClickCapture = (event: ReactMouseEvent<HTMLElement>): void => {
    if (!longPressed.current) return;
    longPressed.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={500} closeDelay={150}>
      <HoverCardTrigger
        asChild
        onPointerDown={onPointerDown}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onPointerLeave={cancelPress}
        onClickCapture={onClickCapture}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        ref={ref}
        side="bottom"
        align="end"
        collisionPadding={clearance}
        data-wm-snap-layouts=""
        className={cn('w-auto p-2', POPUP_LAYER, className)}
        style={style}
      >
        <ul className="grid grid-cols-3 gap-2" aria-label="Snap layouts">
          {layouts.layouts.map((layout) => (
            <li key={layout.id} data-wm-snap-layout={layout.id}>
              <div className="relative h-12 w-20 rounded-sm border border-border bg-background">
                {layout.zones.map((zone) => {
                  const box = boundsForZone(zone, UNIT);
                  const name = SNAP_ZONE_LABELS.find((entry) => entry.zone === zone)?.label ?? zone;
                  return (
                    <button
                      key={zone}
                      type="button"
                      aria-label={`${layout.label}: ${name}`}
                      aria-pressed={layouts.snap === zone}
                      data-zone={zone}
                      className={cn(
                        'absolute rounded-[2px] border border-border bg-muted outline-none',
                        'hover:bg-primary/30 focus-visible:ring-2 focus-visible:ring-ring',
                        'aria-pressed:bg-primary/40',
                      )}
                      style={{
                        left: `calc(${box.x}% + 1px)`,
                        top: `calc(${box.y}% + 1px)`,
                        width: `calc(${box.width}% - 2px)`,
                        height: `calc(${box.height}% - 2px)`,
                      }}
                      onClick={() => {
                        layouts.apply(layout.id, zone);
                        setOpen(false);
                      }}
                    />
                  );
                })}
              </div>
              <p className="mt-1 max-w-20 text-center text-[10px] leading-tight text-muted-foreground">
                {layout.label}
              </p>
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}
