import { act, renderHook } from '@testing-library/react';
import type { MouseEvent, PointerEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnchoredContextMenu } from './useAnchoredContextMenu';

const contextMenuEvent = (): MouseEvent<HTMLButtonElement> =>
  ({ preventDefault: vi.fn() }) as unknown as MouseEvent<HTMLButtonElement>;
const touchEvent = (): PointerEvent<HTMLButtonElement> =>
  ({ pointerType: 'touch' }) as unknown as PointerEvent<HTMLButtonElement>;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useAnchoredContextMenu', () => {
  it('opens on right-click and stops the browser menu', () => {
    const { result } = renderHook(() => useAnchoredContextMenu());
    const event = contextMenuEvent();
    act(() => result.current.triggerProps.onContextMenu?.(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.open).toBe(true);
  });

  it('opens after a long touch and swallows the click that follows', () => {
    const { result } = renderHook(() => useAnchoredContextMenu());
    act(() => result.current.triggerProps.onPointerDown?.(touchEvent()));
    expect(result.current.open).toBe(false);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.open).toBe(true);
    const click = { preventDefault: vi.fn() } as unknown as MouseEvent<HTMLButtonElement>;
    act(() => result.current.triggerProps.onClick?.(click));
    expect(click.preventDefault).toHaveBeenCalled();
  });

  it('does not open when the touch ends early', () => {
    const { result } = renderHook(() => useAnchoredContextMenu());
    act(() => result.current.triggerProps.onPointerDown?.(touchEvent()));
    act(() => result.current.triggerProps.onPointerUp?.({} as PointerEvent<HTMLButtonElement>));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.open).toBe(false);
  });

  it('ignores a mouse press', () => {
    const { result } = renderHook(() => useAnchoredContextMenu());
    act(() =>
      result.current.triggerProps.onPointerDown?.({
        pointerType: 'mouse',
      } as PointerEvent<HTMLButtonElement>),
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.open).toBe(false);
  });
});
