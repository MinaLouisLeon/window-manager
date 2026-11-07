import { cn } from '@integr8-media/ui';
import type { CSSProperties, ReactElement, ReactNode, Ref } from 'react';
import { useShellAccessibility } from '../react/useShellAccessibility';
import { useWindowManager } from '../react/useWindowManager';
import { CloseGuardDialog, type CloseGuardDialogProps } from './CloseGuardDialog';
import { Desktop, type DesktopProps } from './Desktop';
import { StartMenu, type StartMenuProps } from './StartMenu';
import { Taskbar, type TaskbarProps } from './Taskbar';
import { WindowSwitcher } from './WindowSwitcher';

/** Props of `WindowManagerShell`. */
export interface WindowManagerShellProps {
  /** Props for the `Desktop` (icons, windowProps, taskbarSize). */
  desktop?: Omit<DesktopProps, 'children'>;
  /** Props for the `Taskbar`. */
  taskbar?: Omit<TaskbarProps, 'notificationArea'>;
  /** Props for the `StartMenu`. */
  startMenu?: StartMenuProps;
  /** Props for the `CloseGuardDialog`. */
  closeGuard?: CloseGuardDialogProps;
  /** Content for the end of the taskbar (the notification area from 1.1.0). */
  notificationArea?: ReactNode;
  /** Extra content on top of the desktop (inside the shell's positioned box). */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

/**
 * The default composition of the whole desktop: `Desktop` (wallpaper, icons, windows, snap
 * preview, menu), `Taskbar`, `StartMenu`, `WindowSwitcher` and `CloseGuardDialog`. The taskbar
 * hides while a window is fullscreen. A polite live region announces snap, minimize, maximize and
 * desktop switches, and focus returns to the right place after a close or minimize. It fills the viewport by default (`h-dvh`); pass
 * `className="h-full"` to fill a sized parent instead. Must be used inside a
 * `WindowManagerProvider`.
 */
export function WindowManagerShell({
  desktop,
  taskbar,
  startMenu,
  closeGuard,
  notificationArea,
  children,
  className,
  style,
  ref,
}: WindowManagerShellProps): ReactElement {
  const { state: fullscreen } = useWindowManager((state) =>
    Object.values(state.windows).some(
      (win) => win.status === 'fullscreen' && win.desktopId === state.activeDesktopId,
    ),
  );
  const { state: position } = useWindowManager((state) => state.shell.taskbarPosition);
  const { announcement } = useShellAccessibility();

  return (
    <div
      ref={ref}
      data-wm-shell=""
      data-taskbar-position={position}
      className={cn('relative h-dvh w-full overflow-hidden', className)}
      style={style}
    >
      <Desktop {...desktop} />
      {fullscreen ? null : (
        <Taskbar {...taskbar} {...(notificationArea === undefined ? {} : { notificationArea })} />
      )}
      <StartMenu {...startMenu} />
      <WindowSwitcher />
      <CloseGuardDialog {...closeGuard} />
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-wm-live-region=""
        className="sr-only"
      >
        {announcement}
      </div>
      {children}
    </div>
  );
}
