import {
  Badge,
  Button,
  ContextMenu,
  ContextMenuTrigger,
  cn,
  DropdownMenu,
  DropdownMenuTrigger,
} from '@integr8-media/ui';
import type { CSSProperties, ReactElement, ReactNode, Ref } from 'react';
import { AppIcon } from '../react/AppIcon';
import { mergeRefs } from '../react/propHelpers';
import type { UseWindowFrameResult } from '../react/useWindowFrame';
import { useWindowManagerContext } from '../react/windowManagerContext';
import { WindowControls } from './WindowControls';
import { WindowMenu } from './WindowMenu';

/** Props of `WindowTitleBar`. */
export interface WindowTitleBarProps {
  /** The frame of the window (from `useWindowFrame`). */
  frame: UseWindowFrameResult;
  /** App content before the title (for example tabs). */
  start?: ReactNode;
  /** App content in the middle (for example a search field). */
  center?: ReactNode;
  /** App content after the title, before the controls (for example a toolbar). */
  end?: ReactNode;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLElement>;
}

/**
 * The title bar: the app icon (a button that opens the window menu), the title, a dot while the
 * window has unsaved changes, a badge, three slots for app content and the window controls.
 * Dragging it moves the window and double-clicking it maximizes; the slots and buttons do
 * neither (they are marked `data-wm-no-drag`). Right-clicking it opens the window menu too. The
 * `mac` controls style puts the controls on the left.
 */
export function WindowTitleBar({
  frame,
  start,
  center,
  end,
  className,
  style,
  ref,
}: WindowTitleBarProps): ReactElement | null {
  const { manager } = useWindowManagerContext();
  const win = frame.window;
  if (win === null) return null;
  const mac = frame.controlsStyle === 'mac';
  const controls = <WindowControls frame={frame} />;
  const barProps = frame.getTitleBarProps({
    ...(ref === undefined ? {} : { ref: mergeRefs<HTMLElement>(ref) }),
    ...(style === undefined ? {} : { style }),
  });
  const menuProps = {
    windowId: win.id,
    onMove: frame.startKeyboardMove,
    onResize: frame.startKeyboardResize,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          {...barProps}
          data-wm-title-bar=""
          data-state={frame.focused ? 'focused' : 'unfocused'}
          className={cn(
            'flex h-[var(--wm-titlebar-height)] shrink-0 items-center gap-2',
            'overflow-hidden border-b border-border text-sm',
            'data-[state=focused]:bg-muted data-[state=focused]:text-foreground',
            'data-[state=unfocused]:bg-card data-[state=unfocused]:text-muted-foreground',
            className,
          )}
        >
          {mac ? controls : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                data-wm-no-drag=""
                aria-label="Window menu"
                className={cn('size-6 shrink-0 rounded-sm', mac ? '' : 'ml-2')}
              >
                <AppIcon icon={manager.getApp(win.appId).icon} className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <WindowMenu variant="dropdown" {...menuProps} />
          </DropdownMenu>
          {start === undefined ? null : (
            <div
              data-wm-slot="start"
              data-wm-no-drag=""
              className="flex shrink-0 items-center gap-1"
            >
              {start}
            </div>
          )}
          <span id={frame.titleId} className="min-w-0 truncate font-medium">
            {win.title}
          </span>
          {win.dirty ? (
            <Badge
              role="img"
              aria-label="Unsaved changes"
              data-wm-dirty=""
              className="size-2 min-w-0 shrink-0 rounded-full border-0 p-0"
            />
          ) : null}
          {win.badge === null ? null : (
            <Badge variant="secondary" data-wm-badge="" className="shrink-0">
              {win.badge}
            </Badge>
          )}
          <div data-wm-slot="center" className="flex min-w-0 flex-1 justify-center">
            {center === undefined ? null : (
              <div data-wm-no-drag="" className="flex min-w-0 items-center">
                {center}
              </div>
            )}
          </div>
          {end === undefined ? null : (
            <div data-wm-slot="end" data-wm-no-drag="" className="flex shrink-0 items-center gap-1">
              {end}
            </div>
          )}
          {mac ? null : controls}
        </div>
      </ContextMenuTrigger>
      <WindowMenu variant="context" {...menuProps} />
    </ContextMenu>
  );
}
