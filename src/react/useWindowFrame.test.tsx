import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import type { Bounds, WindowId, WindowManager } from '../core/types';
import { type ResizeEdge, useWindowFrame } from './useWindowFrame';

const EDGES: ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const pointer = { pointerId: 1, isPrimary: true, button: 0 };

function Frame({ id }: { id: WindowId }) {
  const frame = useWindowFrame(id);
  return (
    <div {...frame.getRootProps({ 'data-testid': 'root' })}>
      <div {...frame.getTitleBarProps({ 'data-testid': 'title' })}>
        <span id={frame.titleId} data-testid="title-text">
          {frame.window?.title}
        </span>
        <button {...frame.getControlProps('minimize', { 'data-testid': 'minimize' })} />
        <button {...frame.getControlProps('maximize', { 'data-testid': 'maximize' })} />
        <button {...frame.getControlProps('close', { 'data-testid': 'close' })} />
        <span data-wm-no-drag="" data-testid="no-drag">
          tab
        </span>
      </div>
      {EDGES.map((edge) => (
        <div
          key={edge}
          {...frame.getResizeHandleProps(edge, { 'data-testid': `handle-${edge}` })}
        />
      ))}
      <button type="button" data-testid="kbd-move" onClick={frame.startKeyboardMove} />
      <button type="button" data-testid="kbd-resize" onClick={frame.startKeyboardResize} />
      <output data-testid="flags">
        {`${frame.dragging}|${frame.resizing}|${frame.keyboardMode}`}
      </output>
    </div>
  );
}

function setup(appId = 'notes', open: { status?: 'maximized' } = {}) {
  const manager = createTestManager();
  const id = manager.open({ appId, ...open });
  render(<Frame id={id} />, { wrapper: createWrapper(manager) });
  return { manager, id };
}

function boundsOf(manager: WindowManager, id: WindowId): Bounds {
  return (manager.getState().windows[id] as { bounds: Bounds }).bounds;
}

const root = (): HTMLElement => screen.getByTestId('root');
const title = (): HTMLElement => screen.getByTestId('title');
const flags = (): string | null => screen.getByTestId('flags').textContent;

function drag(from: [number, number], to: [number, number], target: HTMLElement = title()): void {
  fireEvent.pointerDown(target, { ...pointer, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(target, { ...pointer, clientX: to[0], clientY: to[1] });
}

describe('useWindowFrame: root', () => {
  it('sets role, labelling, position and data attributes', () => {
    const { id } = setup();
    expect(root().getAttribute('role')).toBe('dialog');
    expect(root().getAttribute('aria-labelledby')).toBe(screen.getByTestId('title-text').id);
    expect(root().getAttribute('aria-modal')).toBeNull();
    expect(root().hasAttribute('data-wm-window')).toBe(true);
    expect(root().dataset.state).toBe('focused');
    expect(root().dataset.status).toBe('normal');
    expect(root().dataset.controlsStyle).toBe('windows');
    expect(root().dataset.taskbarPosition).toBe('bottom');
    expect(root().hasAttribute('data-dragging')).toBe(false);
    expect(root().style.transform).toBe('translate(0px, 0px)');
    expect(root().style.width).toBe('400px');
    expect(root().style.height).toBe('300px');
    expect(id).toBeTruthy();
  });

  it('follows focus, status, snap, always-on-top and shell settings', () => {
    const { manager, id } = setup();
    act(() => {
      manager.open({ appId: 'notes' });
    });
    expect(root().dataset.state).toBe('unfocused');

    act(() => manager.focus(id));
    expect(root().dataset.state).toBe('focused');

    act(() => manager.snap(id, 'left'));
    expect(root().dataset.snap).toBe('left');
    act(() => manager.setAlwaysOnTop(id, true));
    expect(root().hasAttribute('data-always-on-top')).toBe(true);
    act(() => manager.setShellSettings({ controlsStyle: 'mac', taskbarPosition: 'top' }));
    expect(root().dataset.controlsStyle).toBe('mac');
    expect(root().dataset.taskbarPosition).toBe('top');
  });

  it('uses the controls style of the app over the shell setting', () => {
    setup('mac');
    expect(root().dataset.controlsStyle).toBe('mac');
  });

  it('hides a minimized window', () => {
    const { manager, id } = setup();
    act(() => manager.minimize(id));
    expect(root().style.display).toBe('none');
    expect(root().dataset.status).toBe('minimized');
  });

  it('marks a modal child and blocks its parent', () => {
    const manager = createTestManager();
    const parent = manager.open({ appId: 'notes' });
    const child = manager.open({ appId: 'notes', parentId: parent, modal: true });
    render(
      <>
        <Frame id={parent} />
        <Frame id={child} />
      </>,
      { wrapper: createWrapper(manager) },
    );
    const [parentRoot, childRoot] = screen.getAllByTestId('root');
    expect(parentRoot?.hasAttribute('data-blocked')).toBe(true);
    expect(parentRoot?.getAttribute('aria-modal')).toBeNull();
    expect(childRoot?.hasAttribute('data-blocked')).toBe(false);
    expect(childRoot?.getAttribute('aria-modal')).toBe('true');

    // Pressing the blocked parent focuses the modal child instead.
    fireEvent.pointerDown(parentRoot as HTMLElement, pointer);
    expect(manager.getState().focusedId).toBe(child);
  });

  it('focuses and raises the window when it is pressed', () => {
    const manager = createTestManager();
    const first = manager.open({ appId: 'notes' });
    manager.open({ appId: 'notes' });
    render(<Frame id={first} />, { wrapper: createWrapper(manager) });
    expect(manager.getState().focusedId).not.toBe(first);

    fireEvent.pointerDown(root(), pointer);
    expect(manager.getState().focusedId).toBe(first);
  });

  it('focuses the window when focus moves inside it', () => {
    const manager = createTestManager();
    const first = manager.open({ appId: 'notes' });
    manager.open({ appId: 'notes' });
    render(<Frame id={first} />, { wrapper: createWrapper(manager) });

    fireEvent.focus(screen.getByTestId('kbd-move'));
    expect(manager.getState().focusedId).toBe(first);
  });

  it('merges the callers props and refs', () => {
    const manager = createTestManager();
    const id = manager.open({ appId: 'notes' });
    const onPointerDownCapture = vi.fn();
    const ref = vi.fn();
    // biome-ignore lint/correctness/noComponentHookFactories: test component that closes over per-test state
    function Merged() {
      const frame = useWindowFrame(id);
      return (
        <div
          {...frame.getRootProps({
            'data-testid': 'merged',
            onPointerDownCapture,
            ref,
            style: { opacity: 0.5 },
          })}
        />
      );
    }
    render(<Merged />, { wrapper: createWrapper(manager) });
    const element = screen.getByTestId('merged');
    expect(ref).toHaveBeenCalledWith(element);
    expect(element.style.opacity).toBe('0.5');
    expect(element.style.transform).toBe('translate(0px, 0px)');
    fireEvent.pointerDown(element, pointer);
    expect(onPointerDownCapture).toHaveBeenCalledTimes(1);
  });

  it('renders without a window once it is closed', async () => {
    const { manager, id } = setup();
    await act(async () => {
      await manager.close(id);
    });
    expect(root().style.transform).toBe('');
    expect(root().hasAttribute('data-status')).toBe(false);
  });
});

describe('useWindowFrame: title bar', () => {
  it('drags without a render per move and commits on release', () => {
    const { manager, id } = setup();
    drag([100, 10], [160, 50]);
    expect(flags()).toBe('true|false|null');
    expect(root().hasAttribute('data-dragging')).toBe(true);
    expect(root().style.transform).toBe('translate(60px, 40px)');
    expect(boundsOf(manager, id)).toMatchObject({ x: 0, y: 0 });

    fireEvent.pointerUp(title(), { ...pointer, clientX: 160, clientY: 50 });
    expect(boundsOf(manager, id)).toMatchObject({ x: 60, y: 40, width: 400, height: 300 });
    expect(flags()).toBe('false|false|null');
    expect(root().style.transform).toBe('translate(60px, 40px)');
  });

  it('keeps the title bar inside the work area while dragging', () => {
    const { manager, id } = setup();
    drag([100, 10], [100, 5000]);
    expect(root().style.transform).toBe('translate(0px, 652px)');
    fireEvent.pointerUp(title(), pointer);
    expect(boundsOf(manager, id).y).toBe(652);
  });

  it('does not start a drag for a press that barely moves', () => {
    const { manager, id } = setup();
    drag([100, 10], [101, 11]);
    fireEvent.pointerUp(title(), pointer);
    expect(flags()).toBe('false|false|null');
    expect(boundsOf(manager, id)).toMatchObject({ x: 0, y: 0 });
  });

  it('puts the window back where it was when the drag is cancelled', () => {
    const { manager, id } = setup();
    drag([100, 10], [200, 90]);
    fireEvent.pointerCancel(title(), pointer);
    expect(boundsOf(manager, id)).toMatchObject({ x: 0, y: 0 });
    expect(root().style.transform).toBe('translate(0px, 0px)');
    expect(flags()).toBe('false|false|null');
  });

  it('ignores presses from other buttons and other pointers', () => {
    const { manager, id } = setup();
    fireEvent.pointerDown(title(), { ...pointer, button: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(title(), { ...pointer, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(title(), pointer);
    fireEvent.pointerDown(title(), { ...pointer, isPrimary: false, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(title(), { ...pointer, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(title(), pointer);
    expect(boundsOf(manager, id)).toMatchObject({ x: 0, y: 0 });
  });

  it('does not drag from a data-wm-no-drag area', () => {
    const { manager, id } = setup();
    drag([100, 10], [200, 90], screen.getByTestId('no-drag'));
    fireEvent.pointerUp(screen.getByTestId('no-drag'), pointer);
    expect(boundsOf(manager, id)).toMatchObject({ x: 0, y: 0 });
    expect(flags()).toBe('false|false|null');
  });

  it('does not drag a blocked window', () => {
    const manager = createTestManager();
    const parent = manager.open({ appId: 'notes' });
    manager.open({ appId: 'notes', parentId: parent, modal: true });
    render(<Frame id={parent} />, { wrapper: createWrapper(manager) });
    drag([100, 10], [200, 90]);
    fireEvent.pointerUp(title(), pointer);
    expect(boundsOf(manager, parent)).toMatchObject({ x: 0, y: 0 });
  });

  it('does not drag a fullscreen window', () => {
    const { manager, id } = setup();
    act(() => manager.setFullscreen(id, true));
    drag([100, 10], [200, 90]);
    fireEvent.pointerUp(title(), pointer);
    expect(manager.getState().windows[id]?.status).toBe('fullscreen');
  });

  it('restores a maximized window under the pointer when it is dragged', () => {
    const { manager, id } = setup('notes', { status: 'maximized' });
    expect(boundsOf(manager, id)).toMatchObject({ width: 1000, height: 700 });

    drag([500, 10], [510, 20]);
    fireEvent.pointerUp(title(), { ...pointer, clientX: 510, clientY: 20 });

    const win = manager.getState().windows[id];
    expect(win?.status).toBe('normal');
    expect(win?.restoreBounds).toBeNull();
    // The pointer sat at 51% of the maximized title bar, so it stays at 51% of the 400px one.
    expect(win?.bounds).toEqual({ x: 306, y: 0, width: 400, height: 300 });
  });

  it('unsnaps a snapped window under the pointer when it is dragged', () => {
    const { manager, id } = setup();
    act(() => manager.snap(id, 'left'));
    expect(boundsOf(manager, id)).toMatchObject({ width: 500, height: 700 });

    drag([100, 10], [150, 60]);
    fireEvent.pointerUp(title(), { ...pointer, clientX: 150, clientY: 60 });

    const win = manager.getState().windows[id];
    expect(win?.snap).toBeNull();
    expect(win?.bounds).toEqual({ x: 30, y: 0, width: 400, height: 300 });
  });

  it('toggles maximize on double-click', () => {
    const { manager, id } = setup();
    fireEvent.doubleClick(title());
    expect(manager.getState().windows[id]?.status).toBe('maximized');
    fireEvent.doubleClick(title());
    expect(manager.getState().windows[id]?.status).toBe('normal');
  });

  it('does not maximize on a double-click in a no-drag area', () => {
    const { manager, id } = setup();
    fireEvent.doubleClick(screen.getByTestId('no-drag'));
    expect(manager.getState().windows[id]?.status).toBe('normal');
  });

  it('does not maximize a fixed-size app on double-click', () => {
    const { manager, id } = setup('fixed');
    fireEvent.doubleClick(title());
    expect(manager.getState().windows[id]?.status).toBe('normal');
  });
});

describe('useWindowFrame: controls', () => {
  it('minimizes, maximizes, restores and closes', async () => {
    const { manager, id } = setup();
    expect(screen.getByTestId('maximize').getAttribute('aria-label')).toBe('Maximize');

    fireEvent.click(screen.getByTestId('maximize'));
    expect(manager.getState().windows[id]?.status).toBe('maximized');
    expect(screen.getByTestId('maximize').getAttribute('aria-label')).toBe('Restore');

    fireEvent.click(screen.getByTestId('maximize'));
    expect(manager.getState().windows[id]?.status).toBe('normal');

    fireEvent.click(screen.getByTestId('minimize'));
    expect(manager.getState().windows[id]?.status).toBe('minimized');

    fireEvent.click(screen.getByTestId('close'));
    await waitFor(() => expect(manager.getState().windows[id]).toBeUndefined());
  });

  it('marks controls as buttons that do not start a drag', () => {
    setup();
    for (const name of ['minimize', 'maximize', 'close']) {
      const button = screen.getByTestId(name);
      expect(button.getAttribute('type')).toBe('button');
      expect(button.hasAttribute('data-wm-no-drag')).toBe(true);
    }
    expect(screen.getByTestId('close').getAttribute('aria-label')).toBe('Close');
    expect(screen.getByTestId('minimize').getAttribute('aria-label')).toBe('Minimize');
  });

  it('disables maximize for a fixed-size app', () => {
    setup('fixed');
    expect((screen.getByTestId('maximize') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('minimize') as HTMLButtonElement).disabled).toBe(false);
  });

  it('does nothing while a modal child blocks the window', () => {
    const manager = createTestManager();
    const parent = manager.open({ appId: 'notes' });
    manager.open({ appId: 'notes', parentId: parent, modal: true });
    render(<Frame id={parent} />, { wrapper: createWrapper(manager) });
    fireEvent.click(screen.getByTestId('minimize'));
    expect(manager.getState().windows[parent]?.status).toBe('normal');
  });

  it('keeps a window open when its close guard refuses', async () => {
    const { manager, id } = setup();
    manager.setCloseGuard(id, () => false);
    fireEvent.click(screen.getByTestId('close'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(manager.getState().windows[id]).toBeDefined();
  });
});

describe('useWindowFrame: resize handles', () => {
  it('resizes from the bottom right corner and commits on release', () => {
    const { manager, id } = setup();
    const handle = screen.getByTestId('handle-se');
    fireEvent.pointerDown(handle, { ...pointer, clientX: 400, clientY: 300 });
    fireEvent.pointerMove(handle, { ...pointer, clientX: 450, clientY: 340 });
    expect(flags()).toBe('false|true|null');
    expect(root().hasAttribute('data-resizing')).toBe(true);
    expect(root().style.width).toBe('450px');
    expect(root().style.height).toBe('340px');
    expect(boundsOf(manager, id)).toMatchObject({ width: 400, height: 300 });

    fireEvent.pointerUp(handle, pointer);
    expect(boundsOf(manager, id)).toEqual({ x: 0, y: 0, width: 450, height: 340 });
    expect(flags()).toBe('false|false|null');
  });

  it('keeps the opposite edge fixed when resizing from the west and north', () => {
    const { manager, id } = setup();
    act(() => manager.move(id, { x: 200, y: 200 }));
    const handle = screen.getByTestId('handle-nw');
    fireEvent.pointerDown(handle, { ...pointer, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(handle, { ...pointer, clientX: 150, clientY: 170 });
    fireEvent.pointerUp(handle, pointer);
    expect(boundsOf(manager, id)).toEqual({ x: 150, y: 170, width: 450, height: 330 });
  });

  it('stops at the minimum size', () => {
    const { manager, id } = setup();
    const handle = screen.getByTestId('handle-se');
    fireEvent.pointerDown(handle, { ...pointer, clientX: 400, clientY: 300 });
    fireEvent.pointerMove(handle, { ...pointer, clientX: -9000, clientY: -9000 });
    fireEvent.pointerUp(handle, pointer);
    expect(boundsOf(manager, id)).toMatchObject({ width: 240, height: 160 });
  });

  it('works for every edge', () => {
    for (const edge of EDGES) {
      const { manager, id } = setup();
      const handle = screen.getByTestId(`handle-${edge}`);
      fireEvent.pointerDown(handle, { ...pointer, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(handle, { ...pointer, clientX: 120, clientY: 130 });
      fireEvent.pointerUp(handle, pointer);
      const after = boundsOf(manager, id);
      const changed = after.width !== 400 || after.height !== 300;
      expect(changed).toBe(true);
      cleanup();
    }
  });

  it('is hidden from screen readers', () => {
    setup();
    expect(screen.getByTestId('handle-e').getAttribute('aria-hidden')).toBe('true');
  });

  it('is hidden when the window cannot be resized', () => {
    const { manager, id } = setup();
    expect(screen.getByTestId('handle-e').style.display).not.toBe('none');
    act(() => manager.maximize(id));
    expect(screen.getByTestId('handle-e').style.display).toBe('none');
  });

  it('is hidden for a fixed-size app', () => {
    setup('fixed');
    expect(screen.getByTestId('handle-se').style.display).toBe('none');
  });

  it('does not resize a maximized window', () => {
    const { manager, id } = setup();
    act(() => manager.maximize(id));
    const handle = screen.getByTestId('handle-se');
    fireEvent.pointerDown(handle, { ...pointer, clientX: 1000, clientY: 700 });
    fireEvent.pointerMove(handle, { ...pointer, clientX: 900, clientY: 600 });
    fireEvent.pointerUp(handle, pointer);
    expect(boundsOf(manager, id)).toMatchObject({ width: 1000, height: 700 });
  });
});

describe('useWindowFrame: keyboard move and resize', () => {
  const press = (key: string, init: KeyboardEventInit = {}): void => {
    fireEvent.keyDown(document.body, { key, ...init });
  };

  it('moves with the arrows, 10 times as far with Shift, and commits with Enter', () => {
    const { manager, id } = setup();
    fireEvent.click(screen.getByTestId('kbd-move'));
    expect(flags()).toBe('false|false|move');

    press('ArrowRight');
    expect(root().style.transform).toBe('translate(8px, 0px)');
    press('ArrowDown', { shiftKey: true });
    expect(root().style.transform).toBe('translate(8px, 80px)');
    expect(boundsOf(manager, id)).toMatchObject({ x: 0, y: 0 });

    press('Enter');
    expect(boundsOf(manager, id)).toMatchObject({ x: 8, y: 80 });
    expect(flags()).toBe('false|false|null');
  });

  it('cancels with Escape', () => {
    const { manager, id } = setup();
    fireEvent.click(screen.getByTestId('kbd-move'));
    press('ArrowRight', { shiftKey: true });
    press('Escape');
    expect(boundsOf(manager, id)).toMatchObject({ x: 0, y: 0 });
    expect(root().style.transform).toBe('translate(0px, 0px)');
    expect(flags()).toBe('false|false|null');
  });

  it('resizes from the bottom right with the arrows', () => {
    const { manager, id } = setup();
    fireEvent.click(screen.getByTestId('kbd-resize'));
    expect(flags()).toBe('false|false|resize');
    press('ArrowRight');
    press('ArrowDown');
    expect(root().style.width).toBe('408px');
    expect(root().style.height).toBe('308px');
    press('ArrowLeft', { shiftKey: true });
    expect(root().style.width).toBe('328px');
    press('Enter');
    expect(boundsOf(manager, id)).toMatchObject({ width: 328, height: 308 });
  });

  it('stops listening once it ends and ignores other keys', () => {
    const { manager, id } = setup();
    fireEvent.click(screen.getByTestId('kbd-move'));
    press('a');
    press('Enter');
    press('ArrowRight');
    expect(boundsOf(manager, id)).toMatchObject({ x: 0, y: 0 });
  });

  it('does not start for a maximized window, or resize for a fixed-size one', () => {
    const maximized = setup('notes', { status: 'maximized' });
    fireEvent.click(screen.getByTestId('kbd-move'));
    expect(flags()).toBe('false|false|null');
    expect(maximized.id).toBeTruthy();
    cleanup();

    setup('fixed');
    fireEvent.click(screen.getByTestId('kbd-resize'));
    expect(flags()).toBe('false|false|null');
    fireEvent.click(screen.getByTestId('kbd-move'));
    expect(flags()).toBe('false|false|move');
  });

  it('ends when the window is maximized meanwhile', () => {
    const { manager, id } = setup();
    fireEvent.click(screen.getByTestId('kbd-move'));
    act(() => manager.maximize(id));
    expect(flags()).toBe('false|false|null');
  });
});
