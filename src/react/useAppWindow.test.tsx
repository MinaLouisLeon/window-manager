import { act, render, renderHook, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import { type UseAppWindowResult, useAppWindow } from './useAppWindow';
import { AppWindowContent } from './WindowManagerProvider';

interface NoteData {
  text: string;
}

/** Renders one window's content and exposes what `useAppWindow` returned. */
function setup(data?: NoteData) {
  const manager = createTestManager();
  const captured: { current: UseAppWindowResult<NoteData> | null } = { current: null };
  let mounts = 0;
  // biome-ignore lint/correctness/noComponentHookFactories: test component that closes over per-test state
  function Notes({ data: windowData }: { data: unknown }) {
    captured.current = useAppWindow<NoteData>();
    useEffect(() => {
      mounts += 1;
    }, []);
    return <p>notes: {(windowData as NoteData | undefined)?.text ?? 'empty'}</p>;
  }
  const id = manager.open({ appId: 'notes', ...(data ? { data } : {}) });
  const wrapper = createWrapper(manager, { notes: Notes });
  render(<AppWindowContent windowId={id} />, { wrapper });
  const win = (): UseAppWindowResult<NoteData> => captured.current as UseAppWindowResult<NoteData>;
  return { manager, id, win, mounts: () => mounts };
}

describe('AppWindowContent', () => {
  it('renders the app component with the window data', () => {
    setup({ text: 'hello' });
    expect(screen.getByText('notes: hello')).toBeTruthy();
  });

  it('unmounts the content while the window is minimized and mounts it again after', () => {
    const { manager, id, mounts } = setup();
    expect(screen.getByText('notes: empty')).toBeTruthy();

    act(() => manager.minimize(id));
    expect(screen.queryByText('notes: empty')).toBeNull();

    act(() => manager.focus(id));
    expect(screen.getByText('notes: empty')).toBeTruthy();
    expect(mounts()).toBe(2);
  });

  it('unmounts the content on another desktop', () => {
    const { manager } = setup();
    act(() => {
      manager.switchDesktop(manager.addDesktop());
    });
    expect(screen.queryByText('notes: empty')).toBeNull();
    act(() => manager.switchDesktop('desktop-1'));
    expect(screen.getByText('notes: empty')).toBeTruthy();
  });

  it('renders nothing once the window is closed', async () => {
    const { manager, id } = setup();
    await act(async () => {
      await manager.close(id);
    });
    expect(screen.queryByText('notes: empty')).toBeNull();
  });
});

describe('useAppWindow', () => {
  it('throws NO_PROVIDER outside an app window', () => {
    const manager = createTestManager();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAppWindow(), { wrapper: createWrapper(manager) })).toThrow(
      /app window/,
    );
    spy.mockRestore();
  });

  it('knows its window', () => {
    const { win, id } = setup();
    expect(win().id).toBe(id);
    expect(win().window?.appId).toBe('notes');
  });

  it('sets title, badge and dirty flag', () => {
    const { win, manager, id } = setup();
    act(() => win().setTitle('Draft'));
    act(() => win().setBadge(3));
    act(() => win().setDirty(true));
    expect(manager.getState().windows[id]).toMatchObject({ title: 'Draft', badge: 3, dirty: true });
    expect(win().window?.title).toBe('Draft');
  });

  it('sets data with a value or an updater and re-renders the content', () => {
    const { win } = setup({ text: 'a' });
    act(() => win().setData({ text: 'b' }));
    expect(screen.getByText('notes: b')).toBeTruthy();
    act(() => win().setData((previous) => ({ text: `${previous.text}c` })));
    expect(screen.getByText('notes: bc')).toBeTruthy();
  });

  it('sets a close guard that can refuse', async () => {
    const { win, manager, id } = setup();
    act(() => win().setCloseGuard(() => false));
    let closed = true;
    await act(async () => {
      closed = await win().close();
    });
    expect(closed).toBe(false);
    expect(manager.getState().windows[id]).toBeDefined();

    await act(async () => {
      closed = await win().close({ force: true });
    });
    expect(closed).toBe(true);
    expect(manager.getState().windows[id]).toBeUndefined();
  });

  it('ignores setters after the window is gone, so effect cleanups are safe', async () => {
    const manager = createTestManager();
    let latest: UseAppWindowResult | null = null;
    // biome-ignore lint/correctness/noComponentHookFactories: test component that closes over per-test state
    function Guarded() {
      const win = useAppWindow();
      latest = win;
      useEffect(() => {
        win.setCloseGuard(() => true);
        return () => win.setCloseGuard(null);
      }, [win.setCloseGuard]);
      return null;
    }
    const id = manager.open({ appId: 'notes' });
    render(<AppWindowContent windowId={id} />, {
      wrapper: createWrapper(manager, { notes: Guarded }),
    });
    await act(async () => {
      await manager.close(id);
    });
    const win = latest as unknown as UseAppWindowResult;
    expect(() => {
      win.setTitle('late');
      win.setBadge(1);
      win.setDirty(true);
      win.setData({});
      win.setCloseGuard(null);
    }).not.toThrow();
    await expect(win.close()).resolves.toBe(true);
  });

  it('opens a child window', () => {
    const { win, manager, id } = setup();
    let childId = '';
    act(() => {
      childId = win().open({ appId: 'notes', parentId: id, modal: true });
    });
    expect(manager.getState().windows[childId]).toMatchObject({ parentId: id, modal: true });
  });

  it('sends messages with its own id as the sender', () => {
    const { win, manager, id } = setup();
    const other = manager.open({ appId: 'fixed' });
    const handler = vi.fn();
    const stop = manager.onMessage({ windowId: other }, handler);

    act(() => win().send({ windowId: other }, 'ping'));
    expect(handler).toHaveBeenCalledWith('ping', id);
    stop();
  });

  it('receives messages sent to its window and to its app', () => {
    const { win, manager, id } = setup();
    const handler = vi.fn();
    const stop = win().onMessage(handler);

    manager.send({ windowId: id }, 'direct');
    expect(handler).toHaveBeenCalledWith('direct', null);

    const appHandler = vi.fn();
    const stopApp = win().onMessage(appHandler, { appId: 'fixed' });
    manager.send({ appId: 'fixed' }, 'app wide');
    expect(appHandler).toHaveBeenCalledWith('app wide', null);

    stop();
    stopApp();
    manager.send({ windowId: id }, 'after');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
