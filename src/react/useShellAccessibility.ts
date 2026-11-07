import { useEffect, useState } from 'react';
import type { AppId, SnapZone, WindowId, WindowState, WindowStatus } from '../core/types';
import { SNAP_ZONE_LABELS } from './useWindowMenu';
import { useWindowManagerContext } from './windowManagerContext';

/** What `useShellAccessibility` returns. */
export interface UseShellAccessibilityResult {
  /** The latest message for a polite live region ("Notes minimized", "Switched to Desktop 2"). */
  announcement: string;
}

interface Seen {
  status: WindowStatus;
  snap: SnapZone | null;
}

function snapLabel(zone: SnapZone): string {
  return SNAP_ZONE_LABELS.find((entry) => entry.zone === zone)?.label.toLowerCase() ?? zone;
}

function windowElement(id: WindowId | null): HTMLElement | null {
  if (id === null) return null;
  const windows = document.querySelectorAll<HTMLElement>('[data-wm-window]');
  return [...windows].find((element) => element.dataset.windowId === id) ?? null;
}

function taskbarElement(appId: AppId): HTMLElement | null {
  const items = document.querySelectorAll<HTMLElement>('[data-wm-taskbar-item]');
  return (
    [...items].find((element) => element.dataset.wmTaskbarItem === appId) ??
    document.querySelector<HTMLElement>('[data-wm-start-button]')
  );
}

/** True when nothing useful has focus (it was in an element that has just gone away). */
function focusIsLost(): boolean {
  const active = document.activeElement;
  return active === null || active === document.body;
}

/**
 * Accessibility for the shell: announces snap, minimize, maximize, restore, fullscreen, desktop
 * switches and new notifications, and puts keyboard focus back where it belongs. After a window
 * closes, focus goes to the next window (or the app's taskbar button); after a minimize, to the
 * app's taskbar button; after a desktop switch, to the focused window of that desktop. Focus is
 * only moved when it would otherwise be lost. Render `announcement` in a `role="status"` element
 * (`WindowManagerShell` does). It finds windows by `data-window-id` and taskbar buttons by
 * `data-wm-taskbar-item`, which `Window` and `Taskbar` set.
 */
export function useShellAccessibility(): UseShellAccessibilityResult {
  const { manager } = useWindowManagerContext();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const seen = new Map<WindowId, Seen>();
    for (const win of Object.values(manager.getState().windows)) {
      seen.set(win.id, { status: win.status, snap: win.snap });
    }
    const say = (message: string): void => {
      // A trailing space makes a repeated message a new value, so it is announced again.
      setAnnouncement((previous) => (previous === message ? `${message} ` : message));
    };
    const later = (action: () => void): void => {
      requestAnimationFrame(action);
    };
    const focusWindowOf = (appId: AppId | null): void => {
      const state = manager.getState();
      const target = windowElement(state.focusedId);
      if (target !== null) target.focus();
      else if (appId !== null) taskbarElement(appId)?.focus();
    };

    const offs = [
      manager.on('window:opened', ({ window }: { window: WindowState }) => {
        seen.set(window.id, { status: window.status, snap: window.snap });
      }),
      manager.on('window:changed', ({ window }: { window: WindowState }) => {
        const before = seen.get(window.id);
        seen.set(window.id, { status: window.status, snap: window.snap });
        if (before === undefined) return;
        if (before.status !== window.status) {
          if (window.status === 'minimized') {
            say(`${window.title} minimized`);
            later(() => {
              if (focusIsLost()) taskbarElement(window.appId)?.focus();
            });
          } else if (window.status === 'maximized') say(`${window.title} maximized`);
          else if (window.status === 'fullscreen') say(`${window.title} fullscreen`);
          else say(`${window.title} restored`);
        } else if (before.snap !== window.snap && window.snap !== null) {
          say(`${window.title} snapped ${snapLabel(window.snap)}`);
        }
      }),
      manager.on('window:closed', ({ window }: { window: WindowState }) => {
        seen.delete(window.id);
        later(() => {
          if (focusIsLost()) focusWindowOf(window.appId);
        });
      }),
      manager.on('desktop:changed', ({ desktopId }: { desktopId: string }) => {
        const desktop = manager.getState().desktops.find((entry) => entry.id === desktopId);
        say(`Switched to ${desktop?.name ?? 'another desktop'}`);
        later(() => focusWindowOf(null));
      }),
      manager.on('notification', ({ notification }) => {
        say(notification.body ? `${notification.title}. ${notification.body}` : notification.title);
      }),
    ];
    return () => {
      for (const off of offs) off();
    };
  }, [manager]);

  return { announcement };
}
