import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '@integr8-media/ui';
import { type ReactElement, useEffect, useState } from 'react';
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
  /** Label of the button that saves, then closes (shown when the window has a save handler). */
  saveLabel?: string;
  /** Label of the button that keeps the window open. Default "Cancel". */
  cancelLabel?: string;
}

/**
 * Asks before a window with unsaved changes (`dirty`) closes: "Discard changes" closes it, "Cancel"
 * keeps it open, and "Save" (only when the window's app set a handler with
 * `useAppWindow().setSaveHandler`) saves and then closes it; if saving fails the window stays
 * open. Mount it once (the shell does). While a window is dirty this component owns its close
 * guard; an app that needs its own logic can keep `dirty` false and set the guard itself.
 */
export function CloseGuardDialog({
  title = (windowTitle) => `Close "${windowTitle}"?`,
  description = 'This window has unsaved changes. If you close it they will be lost.',
  discardLabel = 'Discard changes',
  cancelLabel = 'Cancel',
  saveLabel = 'Save',
}: CloseGuardDialogProps): ReactElement {
  const { manager, stores } = useWindowManagerContext();
  const request = useExternalStore(stores.closeRequest);
  const [saving, setSaving] = useState(false);
  const saveHandler = request === null ? undefined : stores.saveHandlers.get(request.windowId);
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
    if (allow && current !== null) stores.saveHandlers.delete(current.windowId);
    current?.resolve(allow);
  };

  const save = async (): Promise<void> => {
    const asked = stores.closeRequest.get();
    if (saveHandler === undefined || asked === null) return;
    setSaving(true);
    let saved = true;
    try {
      saved = (await saveHandler()) !== false;
    } catch {
      saved = false;
    }
    setSaving(false);
    // Only act if this question is still the one on screen (a newer one replaces it).
    if (saved && stores.closeRequest.get() === asked) answer(true);
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
          <AlertDialogCancel disabled={saving} onClick={() => answer(false)}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={saving} onClick={() => answer(true)}>
            {discardLabel}
          </AlertDialogAction>
          {saveHandler === undefined ? null : (
            <Button disabled={saving} data-wm-close-guard-save="" onClick={() => void save()}>
              {saveLabel}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
