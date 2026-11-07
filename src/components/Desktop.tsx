import { ContextMenu, ContextMenuTrigger, cn } from '@integr8-media/ui';
import { type CSSProperties, type ReactElement, type ReactNode, type Ref, useMemo } from 'react';
import type { Wallpaper } from '../core/types';
import { mergeRefs } from '../react/propHelpers';
import { useDesktopSurface } from '../react/useDesktopSurface';
import { DesktopIcons } from './DesktopIcons';
import { DesktopMenu } from './DesktopMenu';
import { SnapPreview } from './SnapPreview';
import { Window, type WindowProps } from './Window';

/** Props of `Desktop`. */
export interface DesktopProps {
  /** Show the desktop icons. Default true. */
  icons?: boolean;
  /** Taskbar thickness in px, when it cannot be measured from `--wm-taskbar-size`. */
  taskbarSize?: number;
  /** Props for every window (for example `titleBarSlots`). */
  windowProps?: Omit<WindowProps, 'windowId'>;
  /** Extra content above the windows (overlays, a taskbar). */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

/** The CSS for a wallpaper. `theme` (or none) paints the theme's background tokens. */
export function wallpaperStyle(wallpaper: Wallpaper | null): CSSProperties {
  switch (wallpaper?.type) {
    case 'color':
      return { background: wallpaper.value };
    case 'gradient':
      return { background: wallpaper.value };
    case 'image': {
      const fit = wallpaper.fit ?? 'cover';
      return {
        backgroundImage: `url("${wallpaper.url.replace(/"/g, '%22')}")`,
        backgroundSize: fit === 'center' ? 'auto' : fit,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: 'var(--background)',
      };
    }
    default:
      return { background: 'linear-gradient(135deg, var(--background), var(--muted))' };
  }
}

/**
 * The desktop surface: the wallpaper, the desktop icons, every window of the active desktop, the
 * snap preview and the desktop's right-click menu. It fills its parent (give the parent the size
 * of the viewport), measures itself and reports the size and the taskbar space to the manager.
 */
export function Desktop({
  icons = true,
  taskbarSize,
  windowProps,
  children,
  className,
  style,
  ref,
}: DesktopProps): ReactElement {
  const surface = useDesktopSurface(taskbarSize === undefined ? {} : { taskbarSize });
  // Memoized: a new ref callback each render would detach and re-attach the surface every time.
  const mergedRef = useMemo(() => mergeRefs<HTMLDivElement>(ref, surface.ref), [ref, surface.ref]);

  return (
    <div
      ref={mergedRef}
      data-wm-desktop=""
      data-desktop-id={surface.activeDesktopId}
      className={cn('relative h-full w-full overflow-hidden bg-background', className)}
      style={style}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            data-wm-wallpaper=""
            className="absolute inset-0"
            style={wallpaperStyle(surface.wallpaper)}
          />
        </ContextMenuTrigger>
        <DesktopMenu />
      </ContextMenu>
      {icons ? <DesktopIcons /> : null}
      {surface.windows.map((win) => (
        <Window key={win.id} {...windowProps} windowId={win.id} />
      ))}
      <SnapPreview />
      {children}
    </div>
  );
}
