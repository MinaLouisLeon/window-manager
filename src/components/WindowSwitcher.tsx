import { Command, CommandItem, CommandList, cn } from '@integr8-media/ui';
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
 * modifier focuses the selected window and Esc cancels. Renders nothing while closed. It is a ui
 * `Command` list whose selection the switcher controls; focus stays where it was, so the keyboard
 * keeps working while it is open.
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
      <Command
        shouldFilter={false}
        value={switcher.selectedId ?? ''}
        onValueChange={(id) => {
          const index = switcher.windows.findIndex((win) => win.id === id);
          if (index !== -1) switcher.select(index);
        }}
        className="pointer-events-auto h-auto w-auto max-w-full border border-border p-2 shadow-lg"
      >
        <CommandList
          label="Switch windows"
          className={cn(
            'max-h-none overflow-x-auto overflow-y-hidden',
            '[&_[cmdk-list-sizer]]:flex [&_[cmdk-list-sizer]]:gap-2',
          )}
        >
          {switcher.windows.map((win, index) => (
            <CommandItem
              key={win.id}
              value={win.id}
              data-minimized={win.minimized ? '' : undefined}
              className={cn(
                'w-28 shrink-0 flex-col gap-2 p-3 text-center text-xs',
                'data-[selected=true]:ring-2 data-[selected=true]:ring-ring',
                win.minimized && 'opacity-70',
              )}
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
            </CommandItem>
          ))}
        </CommandList>
      </Command>
    </div>
  );
}
