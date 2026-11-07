import { cn } from '@integr8-media/ui';
import type { CSSProperties, ReactElement, Ref } from 'react';
import { AppIcon } from '../react/AppIcon';
import { useWindowSwitcher } from '../react/useWindowSwitcher';

/** Props of `WindowSwitcher`. */
export interface WindowSwitcherProps {
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

/**
 * The overlay shown while cycling windows with the keyboard (Ctrl+` by default): the windows of
 * the active desktop, most recently used first, with the selection highlighted. Releasing the
 * modifier focuses the selected window and Esc cancels. Renders nothing while closed.
 */
export function WindowSwitcher({
  className,
  style,
  ref,
}: WindowSwitcherProps): ReactElement | null {
  const switcher = useWindowSwitcher();
  if (!switcher.open) return null;

  return (
    <div
      ref={ref}
      data-wm-window-switcher=""
      className={cn(
        'pointer-events-none absolute inset-0 z-[20000] flex items-center justify-center p-4',
        className,
      )}
      style={style}
    >
      <div
        role="listbox"
        tabIndex={-1}
        aria-label="Switch windows"
        aria-activedescendant={
          switcher.selectedId === null ? undefined : `wm-switcher-${switcher.selectedId}`
        }
        className="pointer-events-auto flex max-w-full gap-2 overflow-x-auto rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-lg"
      >
        {switcher.windows.map((win, index) => (
          <div
            key={win.id}
            id={`wm-switcher-${win.id}`}
            role="option"
            tabIndex={-1}
            aria-selected={index === switcher.selectedIndex}
            data-minimized={win.minimized ? '' : undefined}
            className={cn(
              'flex w-28 shrink-0 flex-col items-center gap-2 rounded-md p-3 text-center text-xs',
              'aria-selected:bg-accent aria-selected:text-accent-foreground',
              'aria-selected:ring-2 aria-selected:ring-ring',
              win.minimized && 'opacity-70',
            )}
            onPointerEnter={() => switcher.select(index)}
            onPointerDown={(event) => {
              event.preventDefault();
              switcher.select(index);
              switcher.commit();
            }}
          >
            <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-card [&_svg]:size-5">
              <AppIcon
                icon={win.icon}
                fallback={<span className="text-base font-medium">{win.title.charAt(0)}</span>}
              />
            </span>
            <span className="line-clamp-2 w-full leading-tight break-words">{win.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
