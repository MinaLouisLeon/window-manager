import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { ManagerState } from '../core/types';
import { useWindowManagerContext } from './windowManagerContext';

/** True when both arrays have the same length and the same items (compared with `Object.is`). */
export function shallowEqualArray<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
}

interface Memo<T> {
  state: ManagerState;
  selector: (state: ManagerState) => T;
  value: T;
}

/**
 * Subscribes to the manager and returns `selector(state)`. The component re-renders only when the
 * selected value changes: it is compared with `isEqual` (default `Object.is`), and the previous
 * value is kept when they are equal, so inline selectors that build arrays are safe with
 * `shallowEqualArray`.
 */
export function useManagerSelector<T>(
  selector: (state: ManagerState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const { manager } = useWindowManagerContext();
  const memo = useRef<Memo<T> | null>(null);

  const getSnapshot = useCallback((): T => {
    const state = manager.getState();
    const previous = memo.current;
    if (previous !== null && previous.state === state && previous.selector === selector) {
      return previous.value;
    }
    const next = selector(state);
    const value = previous !== null && isEqual(previous.value, next) ? previous.value : next;
    memo.current = { state, selector, value };
    return value;
  }, [manager, selector, isEqual]);

  const subscribe = useCallback(
    (onChange: () => void): (() => void) => manager.subscribe(onChange),
    [manager],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
