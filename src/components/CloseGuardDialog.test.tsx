import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement, useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import type { WindowManager } from '../core/types';
import { useAppWindow } from '../react/useAppWindow';
import { AppWindowContent } from '../react/WindowManagerProvider';
import type { AppWindowProps } from '../react/windowManagerContext';
import { CloseGuardDialog, type CloseGuardDialogProps } from './CloseGuardDialog';

/** An app that sets the save handler it was given through the window's `data`. */
function Editor({ data }: AppWindowProps): ReactElement {
  const { setSaveHandler } = useAppWindow();
  const { handler } = data as { handler: (() => unknown) | null };
  useEffect(() => {
    setSaveHandler(handler);
    return () => setSaveHandler(null);
  }, [setSaveHandler, handler]);
  return <p>Editor</p>;
}

function setup(
  handler: (() => unknown) | null,
  props: CloseGuardDialogProps = {},
  manager: WindowManager = createTestManager(),
) {
  const id = manager.open({ appId: 'notes', data: { handler } });
  manager.update(id, { dirty: true });
  render(
    <>
      <AppWindowContent windowId={id} />
      <CloseGuardDialog {...props} />
    </>,
    { wrapper: createWrapper(manager, { notes: Editor }) },
  );
  return { manager, id, user: userEvent.setup() };
}

/** Starts closing the window, like the close button does, and waits for the dialog. */
async function askToClose(
  manager: WindowManager,
  id: string,
): Promise<{ closed: Promise<boolean> }> {
  let closed: Promise<boolean> = Promise.resolve(false);
  act(() => {
    closed = manager.close(id);
  });
  await screen.findByRole('alertdialog');
  // Wrapped in an object: returning the promise itself would make this function wait for it.
  return { closed };
}

describe('CloseGuardDialog: save', () => {
  it('offers only Discard and Cancel when the window has no save handler', async () => {
    const { manager, id } = setup(null);
    await askToClose(manager, id);
    expect(screen.getByRole('button', { name: 'Discard changes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('offers Save when the window has a handler, and saves then closes', async () => {
    const save = vi.fn();
    const { manager, id, user } = setup(save);
    const { closed } = await askToClose(manager, id);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(await closed).toBe(true);
    expect(manager.getState().windows[id]).toBeUndefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('waits for an async handler and disables the buttons meanwhile', async () => {
    let finish: (value: unknown) => void = () => {};
    const save = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    const { manager, id, user } = setup(save);
    const { closed } = await askToClose(manager, id);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Discard changes' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(manager.getState().windows[id]).toBeDefined();
    await act(async () => finish(undefined));
    expect(await closed).toBe(true);
  });

  it('keeps the window open when the handler returns false', async () => {
    const { manager, id, user } = setup(() => false);
    await askToClose(manager, id);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(manager.getState().windows[id]).toBeDefined();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(false);
  });

  it('keeps the window open when an async handler resolves to false', async () => {
    const { manager, id, user } = setup(async () => false);
    await askToClose(manager, id);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(manager.getState().windows[id]).toBeDefined();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('keeps the window open when the handler throws', async () => {
    const { manager, id, user } = setup(() => {
      throw new Error('disk full');
    });
    await askToClose(manager, id);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(manager.getState().windows[id]).toBeDefined();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('lets the user cancel after a failed save', async () => {
    const { manager, id, user } = setup(() => false);
    const { closed } = await askToClose(manager, id);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await closed).toBe(false);
    expect(manager.getState().windows[id]).toBeDefined();
  });

  it('closes a window that has a handler without saving when discarded', async () => {
    const save = vi.fn();
    const { manager, id, user } = setup(save);
    const { closed } = await askToClose(manager, id);
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(await closed).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it('uses saveLabel for the button', async () => {
    const { manager, id } = setup(() => undefined, { saveLabel: 'Save and close' });
    await askToClose(manager, id);
    expect(screen.getByRole('button', { name: 'Save and close' })).toBeTruthy();
  });

  it('forgets the handler when the app clears it', async () => {
    const { manager, id } = setup(() => undefined);
    // Unmounting the editor (window minimized) clears its handler.
    act(() => manager.minimize(id));
    await askToClose(manager, id);
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });
});
