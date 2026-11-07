import { useCallback, useEffect, useRef, useState } from 'react';
import type { FrameControlProps } from './propHelpers';

/** How long a touch must stay down to count as a right-click, in ms. */
const LONG_PRESS_MS = 500;

/** What `useAnchoredContextMenu` returns. */
export interface UseAnchoredContextMenuResult {
  /** Whether the menu is open. */
  open: boolean;
  setOpen(open: boolean): void;
  /**
   * Handlers for the element the menu belongs to: right-click, the menu key and a long touch
   * open the menu, and the click that ends a long touch is swallowed. Pass them to the
   * `props` argument of a prop getter (they are called before its own handlers).
   */
  triggerProps: Pick<
    FrameControlProps,
    | 'onContextMenu'
    | 'onPointerDown'
    | 'onPointerUp'
    | 'onPointerCancel'
    | 'onPointerLeave'
    | 'onClick'
  >;
}

/**
 * State for a menu that opens on right-click but is placed next to its element (a Radix
 * `DropdownMenu` anchored to the element) instead of at the pointer, which is how a `ContextMenu`
 * behaves. Use it where the menu must open at a fixed side of the element, such as outside the
 * taskbar.
 */
export function useAnchoredContextMenu(): UseAnchoredContextMenuResult {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swallowClick = useRef(false);

  const cancel = useCallback((): void => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  useEffect(() => cancel, [cancel]);

  return {
    open,
    setOpen,
    triggerProps: {
      onContextMenu: (event) => {
        event.preventDefault();
        cancel();
        setOpen(true);
      },
      onPointerDown: (event) => {
        if (event.pointerType !== 'touch') return;
        swallowClick.current = false;
        cancel();
        timer.current = setTimeout(() => {
          timer.current = null;
          swallowClick.current = true;
          setOpen(true);
        }, LONG_PRESS_MS);
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onClick: (event) => {
        if (swallowClick.current) {
          swallowClick.current = false;
          event.preventDefault();
        }
      },
    },
  };
}
