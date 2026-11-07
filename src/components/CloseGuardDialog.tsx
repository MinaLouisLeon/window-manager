import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@integr8-media/ui';
import { type ReactElement, useEffect } from 'react';
import type { WindowId } from '../core/types';
import { useExternalStore } from '../react/externalStore';
import { shallowEqualArray, useManagerSelector } from '../react/useManagerSelector';
import { useWindowManagerContext } from '../react/windowManagerContext';

/** Props of `CloseGuardDialog`. */
export interface CloseGuardDialogProps {
  /** Dialog title. Default: `Close "<window title>"?`. */
  title?: (windowTitle: string) => string;
  /** Text under the title. */
  description?: string;
  /** Label of the button that closes the window anyway. Default "Discard changes". */
  discardLabel?: string;
  /** Label of the button that keeps the window open. Default "Cancel". */
  cancelLabel?: string;
}

/**
 * Asks before a window with unsaved changes (`dirty`) closes: "Discard changes" closes it, "Cancel"
 * keeps it open. Mount it once (the shell does). While a window is dirty this component owns its
 * close guard; an app that needs its own logic can keep `dirty` false and set the guard itself.
 */
export function CloseGuardDialog({
  title = (windowTitle) => `Close "${windowTitle}"?`,
  description = 'This window has unsaved changes. If you close it they will be lost.',
  discardLabel = 'Discard changes',
  cancelLabel = 'Cancel',
}: CloseGuardDialogProps): ReactElement {
  const { manager, stores } = useWindowManagerContext();
  const request = useExternalStore(stores.closeRequest);
  const dirtyIds = useManagerSelector(
    (state) =>
      Object.values(state.windows)
        .filter((win) => win.dirty)
        .map((win) => win.id),
    shallowEqualArray,
  );
  const windowTitle = useManagerSelector((state) =>
    request === null ? '' : (state.windows[request.windowId]?.title ?? ''),
  );

  // Guard every dirty window; release the guards of windows that are clean again.
  useEffect(() => {
    const guarded = new Set<WindowId>();
    for (const id of dirtyIds) {
      guarded.add(id);
      manager.setCloseGuard(
        id,
        () =>
          new Promise<boolean>((resolve) => {
            stores.closeRequest.get()?.resolve(false); // a newer question replaces the old one
            stores.closeRequest.set({ windowId: id, resolve });
          }),
      );
    }
    return () => {
      for (const id of guarded) {
        if (manager.getState().windows[id] !== undefined) manager.setCloseGuard(id, null);
      }
    };
  }, [dirtyIds, manager, stores]);

  const answer = (allow: boolean): void => {
    const current = stores.closeRequest.get();
    stores.closeRequest.set(null);
    current?.resolve(allow);
  };

  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => (open ? undefined : answer(false))}
    >
      <AlertDialogContent data-wm-close-guard="">
        <AlertDialogHeader>
          <AlertDialogTitle>{title(windowTitle)}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => answer(false)}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => answer(true)}>
            {discardLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
