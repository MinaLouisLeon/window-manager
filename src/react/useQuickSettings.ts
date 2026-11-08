import type { ControlsStyle, ShellSettings, TaskbarPosition } from '../core/types';
import { useManagerSelector } from './useManagerSelector';
import { useWindowManagerContext } from './windowManagerContext';

/** What `useQuickSettings` returns. */
export interface UseQuickSettingsResult {
  /** The shell settings: taskbar position, auto-hide and window controls style. */
  settings: ShellSettings;
  setTaskbarPosition(position: TaskbarPosition): void;
  setTaskbarAutoHide(autoHide: boolean): void;
  setControlsStyle(style: ControlsStyle): void;
}

/**
 * The shell settings a quick settings panel changes. The theme is not part of it: it belongs to
 * `@integr8-media/ui` (use its `ThemeSwitcher`).
 */
export function useQuickSettings(): UseQuickSettingsResult {
  const { manager } = useWindowManagerContext();
  const settings = useManagerSelector((state) => state.shell);
  return {
    settings,
    setTaskbarPosition: (taskbarPosition) => manager.setShellSettings({ taskbarPosition }),
    setTaskbarAutoHide: (taskbarAutoHide) => manager.setShellSettings({ taskbarAutoHide }),
    setControlsStyle: (controlsStyle) => manager.setShellSettings({ controlsStyle }),
  };
}
