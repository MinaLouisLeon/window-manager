import { ContextMenuContent, DropdownMenuContent } from '@integr8-media/ui';
import type { PointerEvent, ReactElement } from 'react';
import type { WindowId } from '../core/types';
import { useWindowMenu } from '../react/useWindowMenu';
import { MenuItems, type MenuVariant } from './MenuItems';

/** Props of `WindowMenu`. */
export interface WindowMenuProps {
  windowId: WindowId;
  /** Draw it as the content of a context menu (right-click) or of a dropdown menu. */
  variant?: MenuVariant;
  /** Called by the "Move" entry (the frame's `startKeyboardMove`). Without it, no entry. */
  onMove?: () => void;
  /** Called by the "Resize" entry (the frame's `startKeyboardResize`). Without it, no entry. */
  onResize?: () => void;
  className?: string;
}

/**
 * The menu is portaled, but React still bubbles its events to the title bar it belongs to. Stop
 * the pointer events there, or a press on a menu entry would start a title bar drag.
 */
const stop = (event: PointerEvent<HTMLElement>): void => event.stopPropagation();
const NO_BUBBLE = {
  onPointerDown: stop,
  onPointerMove: stop,
  onPointerUp: stop,
  onPointerCancel: stop,
  onDoubleClick: (event: { stopPropagation(): void }): void => event.stopPropagation(),
};

/**
 * The content of a window's menu: minimize, maximize or restore, snap (every zone), always on top,
 * fullscreen, move to desktop, move, resize, the entries the app registered and close. Put it
 * inside a `ContextMenu` or `DropdownMenu` (the title bar does both).
 */
export function WindowMenu({
  windowId,
  variant = 'context',
  onMove,
  onResize,
  className,
}: WindowMenuProps): ReactElement {
  const { items } = useWindowMenu(windowId, {
    ...(onMove === undefined ? {} : { onMove }),
    ...(onResize === undefined ? {} : { onResize }),
  });
  if (variant === 'dropdown') {
    return (
      <DropdownMenuContent
        align="start"
        {...NO_BUBBLE}
        {...(className === undefined ? {} : { className })}
      >
        <MenuItems items={items} variant="dropdown" />
      </DropdownMenuContent>
    );
  }
  return (
    <ContextMenuContent {...NO_BUBBLE} {...(className === undefined ? {} : { className })}>
      <MenuItems items={items} variant="context" />
    </ContextMenuContent>
  );
}
