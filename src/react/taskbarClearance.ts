import { useLayoutEffect, useState } from 'react';
import type { TaskbarPosition } from '../core/types';

/** The side a popup opens on, by taskbar position: away from the taskbar. */
export const POPUP_SIDE: Readonly<Record<TaskbarPosition, 'top' | 'bottom' | 'left' | 'right'>> = {
  bottom: 'top',
  top: 'bottom',
  left: 'right',
  right: 'left',
};

/** Free space to keep between a popup and the edges of the screen, in px. */
const EDGE = 8;
/** Gap between a popup and the taskbar, in px. */
const GAP = 4;

/**
 * z-index class for the menus and popups that open from the taskbar or the desktop. The ui
 * components use `z-50`, which is below the taskbar (`z-[9500]`): without this class a menu is
 * drawn under the taskbar it was opened from.
 */
export const POPUP_LAYER = 'z-[9600]';

/** Space to keep free on each side of the screen, in px (Radix `collisionPadding`). */
export interface TaskbarClearance {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const FREE: TaskbarClearance = { top: EDGE, right: EDGE, bottom: EDGE, left: EDGE };

/**
 * Measures the taskbar and returns the padding a popup must keep from each screen edge so it
 * never covers the taskbar or leaves the screen: the thickness of the visible taskbar on its
 * side, and a small margin on the others. A taskbar that is hidden (auto-hide) takes no space.
 * Reads the DOM, so it returns the margin only when there is no document.
 */
export function readTaskbarClearance(doc?: Document): TaskbarClearance {
  const root = doc ?? (typeof document === 'undefined' ? undefined : document);
  const taskbar = root?.querySelector('[data-wm-taskbar]');
  if (!root || !taskbar) return FREE;
  const rect = taskbar.getBoundingClientRect();
  const width = root.documentElement.clientWidth;
  const height = root.documentElement.clientHeight;
  const keep = (distance: number): number => Math.max(EDGE, Math.ceil(distance) + GAP);
  switch (taskbar.getAttribute('data-taskbar-position')) {
    case 'top':
      return { ...FREE, top: keep(rect.bottom) };
    case 'left':
      return { ...FREE, left: keep(rect.right) };
    case 'right':
      return { ...FREE, right: keep(width - rect.left) };
    default:
      return { ...FREE, bottom: keep(height - rect.top) };
  }
}

/**
 * The `collisionPadding` for a popup that must stay clear of the taskbar and on screen. Measured
 * again each time `open` becomes true, so a moved or resized taskbar is taken into account.
 * Pass it to the `collisionPadding` prop of a menu, popover or hover card content.
 */
export function useTaskbarClearance(open: boolean): TaskbarClearance {
  const [clearance, setClearance] = useState<TaskbarClearance>(() => readTaskbarClearance());
  useLayoutEffect(() => {
    if (!open) return;
    const next = readTaskbarClearance();
    setClearance((current) =>
      current.top === next.top &&
      current.right === next.right &&
      current.bottom === next.bottom &&
      current.left === next.left
        ? current
        : next,
    );
  }, [open]);
  return clearance;
}
