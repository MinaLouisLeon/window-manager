import { ContextMenuContent, DropdownMenuContent } from '@integr8-media/ui';
import type { ReactElement } from 'react';
import { useDesktopMenu } from '../react/useDesktopMenu';
import { MenuItems, type MenuVariant } from './MenuItems';

/** Props of `DesktopMenu`. */
export interface DesktopMenuProps {
  /** Draw it as the content of a context menu (right-click) or of a dropdown menu. */
  variant?: MenuVariant;
  className?: string;
}

/**
 * The content of the desktop's menu: new desktop, show desktop, arrange icons, taskbar settings,
 * window controls style and any entries apps registered with `useRegisterDesktopMenuItems`. Put
 * it inside a `ContextMenu` (`Desktop` does) or a `DropdownMenu`.
 */
export function DesktopMenu({ variant = 'context', className }: DesktopMenuProps): ReactElement {
  const { items } = useDesktopMenu();
  const classProps = className === undefined ? {} : { className };
  if (variant === 'dropdown') {
    return (
      <DropdownMenuContent {...classProps}>
        <MenuItems items={items} variant="dropdown" />
      </DropdownMenuContent>
    );
  }
  return (
    <ContextMenuContent {...classProps}>
      <MenuItems items={items} variant="context" />
    </ContextMenuContent>
  );
}
