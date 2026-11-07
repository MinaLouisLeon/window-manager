import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import type { WindowId } from '../core/types';
import { useSnapPreview } from './useSnapPreview';
import { useWindowFrame } from './useWindowFrame';

const pointer = { pointerId: 1, isPrimary: true, button: 0 };

function Probe({ id }: { id: WindowId }) {
  const frame = useWindowFrame(id);
  const preview = useSnapPreview();
  return (
    <div {...frame.getRootProps()}>
      <div {...frame.getTitleBarProps({ 'data-testid': 'title' })}>title</div>
      <output data-testid="preview">{JSON.stringify(preview)}</output>
      <output data-testid="frame-preview">{JSON.stringify(frame.snapPreview)}</output>
    </div>
  );
}

function setup(appId = 'notes') {
  const manager = createTestManager();
  const id = manager.open({ appId });
  render(<Probe id={id} />, { wrapper: createWrapper(manager) });
  return { manager, id };
}

const title = (): HTMLElement => screen.getByTestId('title');
const preview = (): unknown => JSON.parse(screen.getByTestId('preview').textContent ?? 'null');

function dragTo(x: number, y: number): void {
  fireEvent.pointerDown(title(), { ...pointer, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(title(), { ...pointer, clientX: x, clientY: y });
}

describe('snap preview while dragging', () => {
  it('is null when nothing is dragged', () => {
    setup();
    expect(preview()).toBeNull();
  });

  it('shows the half under the left edge, and snaps there on release', () => {
    const { manager, id } = setup();
    dragTo(5, 300);
    expect(preview()).toEqual({ zone: 'left', bounds: { x: 0, y: 0, width: 500, height: 700 } });
    expect(JSON.parse(screen.getByTestId('frame-preview').textContent ?? 'null')).toEqual(
      preview(),
    );

    fireEvent.pointerUp(title(), { ...pointer, clientX: 5, clientY: 300 });
    expect(manager.getState().windows[id]).toMatchObject({
      snap: 'left',
      bounds: { x: 0, y: 0, width: 500, height: 700 },
    });
    expect(preview()).toBeNull();
  });

  it('shows the right half under the right edge', () => {
    const { manager, id } = setup();
    dragTo(995, 300);
    expect(preview()).toMatchObject({ zone: 'right', bounds: { x: 500, width: 500 } });
    fireEvent.pointerUp(title(), pointer);
    expect(manager.getState().windows[id]?.snap).toBe('right');
  });

  it('shows a quarter in a corner', () => {
    const { manager, id } = setup();
    dragTo(5, 5);
    expect(preview()).toMatchObject({
      zone: 'top-left',
      bounds: { x: 0, y: 0, width: 500, height: 350 },
    });
    fireEvent.pointerUp(title(), pointer);
    expect(manager.getState().windows[id]?.snap).toBe('top-left');
  });

  it('maximizes when dropped on the top edge', () => {
    const { manager, id } = setup();
    dragTo(500, 5);
    expect(preview()).toEqual({
      zone: 'maximize',
      bounds: { x: 0, y: 0, width: 1000, height: 700 },
    });
    fireEvent.pointerUp(title(), pointer);
    expect(manager.getState().windows[id]?.status).toBe('maximized');
  });

  it('follows the pointer away from an edge and snaps nothing', () => {
    const { manager, id } = setup();
    dragTo(5, 300);
    fireEvent.pointerMove(title(), { ...pointer, clientX: 400, clientY: 300 });
    expect(preview()).toBeNull();
    fireEvent.pointerUp(title(), pointer);
    expect(manager.getState().windows[id]?.snap).toBeNull();
  });

  it('shows nothing at the bottom edge alone', () => {
    setup();
    dragTo(500, 695);
    expect(preview()).toBeNull();
  });

  it('clears the preview and does not snap when the drag is cancelled', () => {
    const { manager, id } = setup();
    dragTo(5, 300);
    fireEvent.pointerCancel(title(), pointer);
    expect(preview()).toBeNull();
    expect(manager.getState().windows[id]?.snap).toBeNull();
  });

  it('does not snap fixed-size apps', () => {
    const { manager, id } = setup('fixed');
    dragTo(5, 300);
    expect(preview()).toBeNull();
    fireEvent.pointerUp(title(), pointer);
    expect(manager.getState().windows[id]?.snap).toBeNull();
  });

  it('keeps the size to go back to when a moved window is snapped', () => {
    const { manager, id } = setup();
    dragTo(5, 300);
    fireEvent.pointerUp(title(), pointer);
    const win = manager.getState().windows[id];
    expect(win?.restoreBounds).toMatchObject({ width: 400, height: 300 });
  });
});
