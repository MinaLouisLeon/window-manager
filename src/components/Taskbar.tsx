import {
  Badge,
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  cn,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Separator,
} from '@integr8-media/ui';
import { LayoutGrid, X } from 'lucide-react';
import type { CSSProperties, ReactElement, ReactNode, Ref } from 'react';
import type { TaskbarPosition } from '../core/types';
import { AppIcon } from '../react/AppIcon';
import { mergeRefs } from '../react/propHelpers';
import { type TaskbarItem, useTaskbar } from '../react/useTaskbar';
import { DesktopSwitcher } from './DesktopSwitcher';

/** Props of `Taskbar`. */
export interface TaskbarProps {
  /** Show the desktop switcher button. Default true. */
  desktopSwitcher?: boolean;
  /** Content for the end of the taskbar (the notification area from 1.1.0). */
  notificationArea?: ReactNode;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLElement>;
}

const SIDE: Record<TaskbarPosition, 'top' | 'bottom' | 'left' | 'right'> = {
  bottom: 'top',
  top: 'bottom',
  left: 'right',
  right: 'left',
};

function TaskbarButton({
  item,
  position,
  tb,
}: {
  item: TaskbarItem;
  position: TaskbarPosition;
  tb: ReturnType<typeof useTaskbar>;
}): ReactElement {
  const badge = item.windows.find((win) => win.badge !== null)?.badge ?? null;
  const dirty = item.windows.some((win) => win.dirty);
  return (
    <ContextMenu>
      <HoverCard openDelay={300} closeDelay={100}>
        <ContextMenuTrigger asChild>
          <HoverCardTrigger asChild>
            <Button
              {...tb.getItemProps(item.appId)}
              variant="ghost"
              size="icon"
              data-wm-taskbar-item={item.appId}
              data-running={item.running ? '' : undefined}
              data-minimized={item.minimized ? '' : undefined}
              data-active={item.focused ? '' : undefined}
              className={cn(
                'relative size-9 shrink-0',
                'data-[active]:bg-accent data-[active]:text-accent-foreground',
                '[&_svg]:size-5',
              )}
            >
              <AppIcon
                icon={item.icon}
                className="size-5"
                fallback={<span className="text-sm font-medium">{item.title.charAt(0)}</span>}
              />
              {item.running ? (
                <span
                  aria-hidden="true"
                  data-wm-running-indicator=""
                  className={cn(
                    'absolute rounded-full bg-primary transition-[width] motion-reduce:transition-none',
                    position === 'bottom' && 'bottom-0.5 left-1/2 h-0.5 -translate-x-1/2',
                    position === 'top' && 'top-0.5 left-1/2 h-0.5 -translate-x-1/2',
                    position === 'left' && 'top-1/2 left-0.5 w-0.5 -translate-y-1/2',
                    position === 'right' && 'top-1/2 right-0.5 w-0.5 -translate-y-1/2',
                    item.focused
                      ? position === 'left' || position === 'right'
                        ? 'h-4'
                        : 'w-4'
                      : position === 'left' || position === 'right'
                        ? 'h-1'
                        : 'w-1',
                  )}
                />
              ) : null}
              {badge === null ? null : (
                <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]">
                  {badge}
                </Badge>
              )}
              {dirty && badge === null ? (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 size-1.5 rounded-full bg-primary"
                />
              ) : null}
            </Button>
          </HoverCardTrigger>
        </ContextMenuTrigger>
        <HoverCardContent side={SIDE[position]} className="w-60 p-1" data-wm-taskbar-preview="">
          <p className="truncate px-2 py-1 text-xs font-medium text-muted-foreground">
            {item.title}
          </p>
          {item.windows.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">Not running</p>
          ) : (
            <ul className="flex flex-col">
              {item.windows.map((win) => (
                <li key={win.id} className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'min-w-0 flex-1 justify-start gap-2 font-normal',
                      win.focused && 'bg-accent text-accent-foreground',
                    )}
                    onClick={() => tb.focusWindow(win.id)}
                  >
                    <AppIcon icon={item.icon} className="size-4 shrink-0" />
                    <span className={cn('truncate', win.minimized && 'italic opacity-70')}>
                      {win.title}
                    </span>
                    {win.dirty ? (
                      <span
                        role="img"
                        aria-label="Unsaved changes"
                        className="size-1.5 shrink-0 rounded-full bg-primary"
                      />
                    ) : null}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Close ${win.title}`}
                    onClick={() => tb.closeWindow(win.id)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </HoverCardContent>
      </HoverCard>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => tb.activate(item.appId)}>
          {item.running ? 'Show' : 'Open'}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => (item.pinned ? tb.unpin(item.appId) : tb.pin(item.appId))}>
          {item.pinned ? 'Unpin from taskbar' : 'Pin to taskbar'}
        </ContextMenuItem>
        {item.running ? (
          <ContextMenuItem
            variant="destructive"
            onSelect={() => {
              for (const win of item.windows) tb.closeWindow(win.id);
            }}
          >
            {item.windows.length > 1 ? 'Close all windows' : 'Close window'}
          </ContextMenuItem>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}

const PLACEMENT: Record<TaskbarPosition, string> = {
  bottom: 'inset-x-0 bottom-0 h-[var(--wm-taskbar-size)] flex-row border-t',
  top: 'inset-x-0 top-0 h-[var(--wm-taskbar-size)] flex-row border-b',
  left: 'inset-y-0 left-0 w-[var(--wm-taskbar-size)] flex-col border-r',
  right: 'inset-y-0 right-0 w-[var(--wm-taskbar-size)] flex-col border-l',
};

const TUCKED: Record<TaskbarPosition, string> = {
  bottom: 'translate-y-full',
  top: '-translate-y-full',
  left: '-translate-x-full',
  right: 'translate-x-full',
};

const HOT_ZONE: Record<TaskbarPosition, string> = {
  bottom: 'inset-x-0 bottom-0 h-1',
  top: 'inset-x-0 top-0 h-1',
  left: 'inset-y-0 left-0 w-1',
  right: 'inset-y-0 right-0 w-1',
};

/**
 * The taskbar: the start button, pinned apps and running windows (grouped by app, with a
 * preview list of window titles on hover), the desktop switcher and a slot for the notification
 * area. It sits at any edge of its positioned parent, hides itself when auto-hide is on (a thin
 * strip at the edge brings it back), and is a toolbar with arrow key navigation. Click behavior:
 * open the app, focus its window, minimize it when focused, or cycle through its windows.
 */
export function Taskbar({
  desktopSwitcher = true,
  notificationArea,
  className,
  style,
  ref,
}: TaskbarProps): ReactElement {
  const tb = useTaskbar();
  const vertical = tb.position === 'left' || tb.position === 'right';
  const rootProps = tb.getRootProps(ref === undefined ? {} : { ref: mergeRefs<HTMLElement>(ref) });

  return (
    <>
      {tb.hidden ? (
        <div
          aria-hidden="true"
          data-wm-taskbar-hot-zone=""
          className={cn('absolute z-[9000]', HOT_ZONE[tb.position])}
          onPointerEnter={tb.reveal}
        />
      ) : null}
      <nav
        {...rootProps}
        data-wm-taskbar=""
        className={cn(
          'absolute z-[9500] flex items-center gap-1 bg-card p-1 text-card-foreground',
          'border-border transition-transform duration-150 ease-out motion-reduce:transition-none',
          PLACEMENT[tb.position],
          tb.hidden && TUCKED[tb.position],
          className,
        )}
        style={style}
      >
        <Button
          {...tb.getStartButtonProps()}
          variant="ghost"
          size="icon"
          data-wm-start-button=""
          className="size-9 shrink-0"
        >
          <LayoutGrid className="size-5" />
        </Button>
        <Separator
          orientation={vertical ? 'horizontal' : 'vertical'}
          className={vertical ? 'my-1 w-6' : 'mx-1 h-6'}
        />
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 items-center gap-1 overflow-hidden',
            vertical && 'flex-col',
          )}
        >
          {tb.items.map((item) => (
            <TaskbarButton key={item.appId} item={item} position={tb.position} tb={tb} />
          ))}
        </div>
        {desktopSwitcher ? <DesktopSwitcher /> : null}
        {notificationArea}
      </nav>
    </>
  );
}
