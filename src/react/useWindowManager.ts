import type { ManagerState, WindowManager } from '../core/types';
import { useManagerSelector } from './useManagerSelector';
import { useWindowManagerContext } from './windowManagerContext';

/** What `useWindowManager` returns. */
export interface UseWindowManagerResult<TSelected> {
  /** The manager: every action (`open`, `close`, `snap`, ...). The reference never changes. */
  manager: WindowManager;
  /** The selected part of the state. */
  state: TSelected;
}

const wholeState = (state: ManagerState): ManagerState => state;

/**
 * The manager's actions and a slice of its state. With a `selector` the component re-renders only
 * when the selected value changes (compared with `Object.is`, so select primitives or items of
 * the state, not freshly built objects); without one it re-renders on every change.
 */
export function useWindowManager(): UseWindowManagerResult<ManagerState>;
export function useWindowManager<TSelected>(
  selector: (state: ManagerState) => TSelected,
): UseWindowManagerResult<TSelected>;
export function useWindowManager<TSelected>(
  selector?: (state: ManagerState) => TSelected,
): UseWindowManagerResult<TSelected | ManagerState> {
  const { manager } = useWindowManagerContext();
  const state = useManagerSelector<TSelected | ManagerState>(selector ?? wholeState);
  return { manager, state };
}
