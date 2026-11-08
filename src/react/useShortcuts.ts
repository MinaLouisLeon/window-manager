import { useEffect, useRef } from 'react';
import type { WindowManager } from '../core/types';
import {
  digitOf,
  matchesCombo,
  modifierKeys,
  modifiersMatch,
  type ParsedCombo,
  parseCombo,
  resolveShortcuts,
  type ShortcutAction,
  type ShortcutOptions,
} from './shortcutCombos';
import { SWITCHER_CLOSED, type UiStores } from './uiStores';
import { commitSwitcher, cycleSwitcher } from './useWindowSwitcher';
import { useWindowManagerContext } from './windowManagerContext';

interface Binding {
  action: ShortcutAction;
  combo: ParsedCombo;
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

function buildBindings(options: ShortcutOptions | undefined): Binding[] {
  return Object.entries(resolveShortcuts(options)).map(([action, combo]) => ({
    action: action as ShortcutAction,
    combo: parseCombo(combo),
  }));
}

/** Runs a shortcut's action. Returns false when it had nothing to act on. */
function run(action: ShortcutAction, manager: WindowManager, stores: UiStores): boolean {
  const state = manager.getState();
  const focused = state.focusedId !== null ? state.windows[state.focusedId] : undefined;
  switch (action) {
    case 'cycleWindows':
      cycleSwitcher(manager, stores.switcher, 1);
      return true;
    case 'cycleWindowsBack':
      cycleSwitcher(manager, stores.switcher, -1);
      return true;
    case 'showDesktop':
      manager.showDesktop();
      return true;
    case 'startMenu':
      stores.startMenu.set((previous) => ({ open: !previous.open, search: '' }));
      return true;
    case 'desktopOverview':
      stores.overview.set((previous) => !previous);
      return true;
    default:
      break;
  }
  if (focused === undefined) return false;
  switch (action) {
    case 'closeWindow':
      void manager.close(focused.id);
      return true;
    case 'minimizeWindow':
      manager.minimize(focused.id);
      return true;
    case 'toggleMaximize':
      manager.toggleMaximize(focused.id);
      return true;
    case 'snapLeft':
      manager.snap(focused.id, 'left');
      return true;
    case 'snapRight':
      manager.snap(focused.id, 'right');
      return true;
    case 'toggleFullscreen':
      manager.setFullscreen(focused.id, focused.status !== 'fullscreen');
      return true;
    case 'toggleAlwaysOnTop':
      manager.setAlwaysOnTop(focused.id, !focused.alwaysOnTop);
      return true;
    case 'leaveFullscreen':
      if (focused.status !== 'fullscreen') return false;
      manager.setFullscreen(focused.id, false);
      return true;
    default:
      return false;
  }
}

/**
 * Registers the keyboard shortcuts (the defaults, with per-shortcut overrides, or `false` to turn
 * one off). `WindowManagerProvider` already does this; call the hook yourself only when the
 * provider has `shortcuts={false}`. Shortcuts are ignored while focus is in an input, textarea
 * or select unless they use Ctrl+Alt.
 *
 * Cycling windows opens the window switcher and keeps it open until the cycle shortcut's modifier
 * is released (which focuses the selection) or Esc is pressed (which cancels).
 */
export function useShortcuts(options?: ShortcutOptions | false): void {
  const { manager, stores } = useWindowManagerContext();
  const bindings = useRef<Binding[]>([]);
  const holdKeys = useRef<string[]>([]);
  const digitCombo = useRef<ParsedCombo | null>(null);

  const next = options === false ? [] : buildBindings(options);
  const nextDigit = next.find((binding) => binding.action === 'switchDesktop')?.combo ?? null;
  const nextHold = next.find((binding) => binding.action === 'cycleWindows')?.combo;
  useEffect(() => {
    bindings.current = next.filter((binding) => binding.action !== 'switchDesktop');
    digitCombo.current = nextDigit;
    holdKeys.current = nextHold ? modifierKeys(nextHold) : [];
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return;
      const switcher = stores.switcher.get();
      if (switcher.open && event.key === 'Escape') {
        stores.switcher.set(SWITCHER_CLOSED);
        event.preventDefault();
        return;
      }
      const editable = isEditable(event.target);
      const allowed = (combo: ParsedCombo): boolean => !editable || (combo.ctrl && combo.alt);

      for (const { action, combo } of bindings.current) {
        if (!matchesCombo(combo, event) || !allowed(combo)) continue;
        if (run(action, manager, stores)) event.preventDefault();
        return;
      }

      const digits = digitCombo.current;
      if (digits !== null && modifiersMatch(digits, event) && allowed(digits)) {
        const number = digitOf(event);
        const target = number === null ? undefined : manager.getState().desktops[number - 1];
        if (target !== undefined) {
          manager.switchDesktop(target.id);
          event.preventDefault();
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      if (stores.switcher.get().open && holdKeys.current.includes(event.key)) {
        commitSwitcher(manager, stores.switcher);
      }
    };

    const onBlur = (): void => {
      stores.switcher.set(SWITCHER_CLOSED);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    globalThis.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      globalThis.removeEventListener('blur', onBlur);
    };
  }, [manager, stores]);
}
