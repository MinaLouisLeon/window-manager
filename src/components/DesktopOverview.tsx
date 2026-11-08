import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@integr8-media/ui';
import { Plus } from 'lucide-react';
import type { CSSProperties, ReactElement, Ref } from 'react';
import { AppIcon } from '../react/AppIcon';
import { useDesktopOverview } from '../react/useDesktopOverview';
import { wallpaperStyle } from '../react/wallpaperStyle';

/** Props of `DesktopOverview`. */
export interface DesktopOverviewProps {
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Every desktop at a glance, with a frame (icon and title) for each of its windows, in a ui
 * `Dialog`. Click a desktop to switch to it, click a window to focus it, drag a window onto
 * another desktop to move it (Shift+ArrowLeft / Shift+ArrowRight does the same from the keyboard).
 * Esc, a click outside and Ctrl+Alt+O close it. Renders nothing while closed. The frames show
 * titles and icons, never live thumbnails. Like every ui dialog it is drawn over the whole page.
 */
export function DesktopOverview({ className, style, ref }: DesktopOverviewProps): ReactElement {
  const overview = useDesktopOverview();

  return (
    <Dialog open={overview.open} onOpenChange={(next) => overview.setOpen(next)}>
      <DialogContent
        ref={ref}
        data-wm-desktop-overview=""
        className={cn(
          'h-[min(90dvh,60rem)] w-[min(96vw,84rem)] max-w-none content-start overflow-auto',
          'sm:max-w-none',
          className,
        )}
        style={style}
      >
        <DialogTitle className="sr-only">Desktop overview</DialogTitle>
        <DialogDescription className="sr-only">
          Choose a desktop or a window, or drag a window onto another desktop to move it.
        </DialogDescription>
        <div className="flex flex-wrap items-start justify-center gap-4">
          {overview.desktops.map((desktop) => (
            <section
              key={desktop.id}
              aria-label={desktop.name}
              {...overview.getDesktopProps(desktop.id)}
              data-active={desktop.active ? '' : undefined}
              className={cn(
                'flex w-72 flex-col gap-2 rounded-lg border border-border bg-card p-2 text-card-foreground',
                'data-active:border-ring data-active:ring-2 data-active:ring-ring/40',
                'data-drop-target:bg-accent',
              )}
            >
              <Button
                variant="ghost"
                size="sm"
                aria-current={desktop.active ? 'true' : undefined}
                className="justify-start font-medium"
                onClick={() => overview.switchTo(desktop.id)}
              >
                <span className="truncate">{desktop.name}</span>
              </Button>
              <div
                data-wm-overview-preview=""
                className="relative aspect-video overflow-hidden rounded-md border border-border bg-background"
                style={wallpaperStyle(desktop.wallpaper)}
              >
                <button
                  type="button"
                  aria-label={`Switch to ${desktop.name}`}
                  className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => overview.switchTo(desktop.id)}
                />
                {desktop.windows.map((win) => (
                  <button
                    key={win.id}
                    type="button"
                    {...overview.getWindowProps(win.id)}
                    aria-label={win.title}
                    data-focused={win.focused ? '' : undefined}
                    data-minimized={win.minimized ? '' : undefined}
                    title={win.title}
                    className={cn(
                      'absolute flex min-h-4 min-w-6 flex-col items-start gap-0.5 overflow-hidden',
                      'rounded-sm border border-border bg-card p-1 text-left text-[10px] leading-none',
                      'text-card-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      'data-focused:border-ring data-dragging:opacity-50',
                      'data-minimized:border-dashed data-minimized:opacity-60',
                    )}
                    style={{
                      left: `${win.frame.left * 100}%`,
                      top: `${win.frame.top * 100}%`,
                      width: `${win.frame.width * 100}%`,
                      height: `${win.frame.height * 100}%`,
                    }}
                    onClick={() => overview.focusWindow(win.id)}
                  >
                    <span className="flex w-full items-center gap-1 [&_svg]:size-3 [&_svg]:shrink-0">
                      <AppIcon icon={win.icon} />
                      <span className="truncate">{win.title}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          <Button
            variant="outline"
            className="h-auto min-h-24 w-72 flex-col gap-1 border-dashed py-8"
            onClick={() => overview.add()}
          >
            <Plus className="size-5" />
            New desktop
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
