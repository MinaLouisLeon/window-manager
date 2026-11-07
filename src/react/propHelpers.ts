import type { ButtonHTMLAttributes, HTMLAttributes, RefCallback } from 'react';

type DataAttributes = { [name: `data-${string}`]: string | boolean | undefined };

/** Props returned by the prop getters for a plain element: spread them onto it. */
export type FrameProps = HTMLAttributes<HTMLElement> &
  DataAttributes & {
    /** A callback ref; it is called together with the hook's own ref. */
    ref?: RefCallback<HTMLElement>;
  };
/** Props returned by the prop getters for a button: spread them onto it. */
export type FrameControlProps = ButtonHTMLAttributes<HTMLButtonElement> &
  DataAttributes & { ref?: RefCallback<HTMLElement> };

/** Runs the caller's handler first, then ours unless the caller called `preventDefault`. */
export function chain<E extends { defaultPrevented: boolean }>(
  user: ((event: E) => void) | undefined,
  own: (event: E) => void,
): (event: E) => void {
  return (event) => {
    user?.(event);
    if (!event.defaultPrevented) own(event);
  };
}

/** One callback ref that calls `own` and the caller's ref. */
export function composeRefs(
  own: RefCallback<HTMLElement>,
  user: RefCallback<HTMLElement> | undefined,
): RefCallback<HTMLElement> {
  if (user === undefined) return own;
  return (node) => {
    const ownCleanup = own(node);
    const userCleanup = user(node);
    return () => {
      if (typeof ownCleanup === 'function') ownCleanup();
      else own(null);
      if (typeof userCleanup === 'function') userCleanup();
      else user(null);
    };
  };
}
