import { Card, cn } from '@integr8-media/ui';
import type { CSSProperties, ReactElement, ReactNode, Ref } from 'react';
import type { WindowId } from '../core/types';
import { mergeRefs } from '../react/propHelpers';
import { type ResizeEdge, useWindowFrame } from '../react/useWindowFrame';
import { AppWindowContent } from '../react/WindowManagerProvider';
import { useWindowManagerContext } from '../react/windowManagerContext';
import { WindowTitleBar, type WindowTitleBarProps } from './WindowTitleBar';

/** Props of `Window`. */
export interface WindowProps {
  windowId: WindowId;
  /** App content for the title bar's slots (tabs, toolbar, search). */
  titleBarSlots?: Pick<WindowTitleBarProps, 'start' | 'center' | 'end'>;
  /** Replaces the app component as the window's content. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLElement>;
}

const EDGES: readonly ResizeEdge[] = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];

/**
 * One window: the frame (border, shadow, position from the manager), the title bar, the content
 * (the app component for this window, unmounted while it is minimized or on another desktop), the
 * 8 resize handles and, while a modal child is open, a blocker that sends clicks to the child.
 * `Desktop` renders one for every window of the active desktop.
 */
export function Window({
  windowId,
  titleBarSlots,
  children,
  className,
  style,
  ref,
}: WindowProps): ReactElement | null {
  const { manager } = useWindowManagerContext();
  const frame = useWindowFrame(windowId);
  if (frame.window === null) return null;

  const rootProps = frame.getRootProps({
    ...(ref === undefined ? {} : { ref: mergeRefs<HTMLElement>(ref) }),
    ...(style === undefined ? {} : { style }),
  });

  return (
    <Card
      {...rootProps}
      data-window-id={windowId}
      className={cn(
        // ui's Card has padding, a gap and a large radius of its own: the frame needs none of them.
        'gap-0 overflow-hidden py-0',
        'rounded-[var(--wm-window-radius)] outline-none',
        'transition-[width,height,transform] duration-150 ease-out',
        'animate-[wm-window-open_150ms_ease-out]',
        'motion-reduce:animate-none motion-reduce:transition-none',
        'data-[dragging]:transition-none data-[resizing]:transition-none',
        'data-[state=focused]:shadow-[var(--wm-shadow-focused)]',
        'data-[state=unfocused]:shadow-[var(--wm-shadow-unfocused)]',
        'data-[state=focused]:ring-1 data-[state=focused]:ring-ring/40',
        'data-[status=maximized]:rounded-none data-[status=fullscreen]:rounded-none',
        'data-[status=fullscreen]:border-0',
        className,
      )}
    >
      <WindowTitleBar frame={frame} {...titleBarSlots} />
      <div
        data-wm-content=""
        inert={frame.blocked}
        className="relative min-h-0 flex-1 overflow-auto"
      >
        {children ?? <AppWindowContent windowId={windowId} />}
      </div>
      {EDGES.map((edge) => (
        <div key={edge} data-wm-resize-handle={edge} {...frame.getResizeHandleProps(edge)} />
      ))}
      {frame.blocked ? (
        <div
          data-wm-blocker=""
          aria-hidden="true"
          className="absolute inset-0 z-10"
          onPointerDown={() => manager.focus(windowId)}
        />
      ) : null}
    </Card>
  );
}
