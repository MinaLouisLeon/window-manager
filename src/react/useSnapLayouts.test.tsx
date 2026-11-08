import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import { useSnapLayouts } from './useSnapLayouts';

function setup(appId = 'notes') {
  const manager = createTestManager();
  const id = manager.open({ appId });
  const { result } = renderHook(() => useSnapLayouts(id), { wrapper: createWrapper(manager) });
  return { manager, id, result };
}

describe('useSnapLayouts', () => {
  it('lists every layout with a label and its zones', () => {
    const { result } = setup();
    const ids = result.current.layouts.map((layout) => layout.id);
    expect(ids).toEqual(['halves', 'quarters', 'thirds', 'two-thirds-left', 'two-thirds-right']);
    expect(result.current.layouts[0]).toEqual({
      id: 'halves',
      label: 'Halves',
      zones: ['left', 'right'],
    });
    expect(result.current.layouts.every((layout) => layout.label !== '')).toBe(true);
  });

  it('applies a zone of a layout', () => {
    const { manager, id, result } = setup();
    act(() => result.current.apply('quarters', 'bottom-right'));
    expect(manager.getState().windows[id]?.snap).toBe('bottom-right');
    expect(result.current.snap).toBe('bottom-right');
  });

  it('applies a zone of a two-thirds layout', () => {
    const { manager, id, result } = setup();
    act(() => result.current.apply('two-thirds-left', 'left-two-thirds'));
    expect(manager.getState().windows[id]?.snap).toBe('left-two-thirds');
  });

  it('ignores a zone the layout does not have and an unknown layout', () => {
    const { manager, id, result } = setup();
    act(() => result.current.apply('halves', 'top-left'));
    act(() => result.current.apply('missing', 'left'));
    expect(manager.getState().windows[id]?.snap).toBeNull();
  });

  it('is available for a resizable window', () => {
    const { result } = setup();
    expect(result.current.available).toBe(true);
    expect(result.current.snap).toBeNull();
  });

  it('is not available for a fixed-size window, and applies nothing', () => {
    const { manager, id, result } = setup('fixed');
    expect(result.current.available).toBe(false);
    act(() => result.current.apply('halves', 'left'));
    expect(manager.getState().windows[id]?.snap).toBeNull();
  });

  it('is not available for a fullscreen window', () => {
    const { manager, id, result } = setup();
    act(() => manager.setFullscreen(id, true));
    expect(result.current.available).toBe(false);
  });

  it('is not available once the window is closed', async () => {
    const { manager, id, result } = setup();
    await act(async () => {
      await manager.close(id);
    });
    expect(result.current.available).toBe(false);
    expect(result.current.snap).toBeNull();
  });
});
