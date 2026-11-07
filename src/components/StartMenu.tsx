import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  cn,
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@integr8-media/ui';
import type { CSSProperties, ReactElement } from 'react';
import type { TaskbarPosition } from '../core/types';
import { AppIcon } from '../react/AppIcon';
import { useStartMenu } from '../react/useStartMenu';
import { useWindowManager } from '../react/useWindowManager';

/** Props of `StartMenu`. */
export interface StartMenuProps {
  /** Placeholder of the search field. Default "Search apps". */
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
}

const ANCHOR: Record<TaskbarPosition, string> = {
  bottom: 'bottom-[var(--wm-taskbar-size)] left-0',
  top: 'top-[var(--wm-taskbar-size)] left-0',
  left: 'top-0 left-[var(--wm-taskbar-size)]',
  right: 'top-0 right-[var(--wm-taskbar-size)]',
};

const SIDE: Record<TaskbarPosition, 'top' | 'bottom' | 'left' | 'right'> = {
  bottom: 'top',
  top: 'bottom',
  left: 'right',
  right: 'left',
};

/**
 * The start menu: a searchable list of the apps, grouped by category, that opens next to the
 * taskbar's start button (or with the start menu shortcut) and launches an app on selection.
 * Place it inside the same positioned parent as the `Taskbar`.
 */
export function StartMenu({
  placeholder = 'Search apps',
  className,
  style,
}: StartMenuProps): ReactElement {
  const menu = useStartMenu();
  const { state: position } = useWindowManager((state) => state.shell.taskbarPosition);

  return (
    <Popover open={menu.open} onOpenChange={menu.setOpen}>
      <PopoverAnchor asChild>
        <div
          aria-hidden="true"
          className={cn('pointer-events-none absolute size-0', ANCHOR[position])}
        />
      </PopoverAnchor>
      <PopoverContent
        side={SIDE[position]}
        align="start"
        data-wm-start-menu=""
        className={cn('w-80 p-0', className)}
        style={style}
        onInteractOutside={(event) => {
          // Pressing the start button while the menu is open closes it through the button's own
          // click; letting the popover close first would make that click open it again.
          const target = event.target;
          if (target instanceof Element && target.closest('[data-wm-start-button]')) {
            event.preventDefault();
          }
        }}
      >
        <Command label="Start menu" shouldFilter={false}>
          <CommandInput
            value={menu.search}
            onValueChange={menu.setSearch}
            placeholder={placeholder}
          />
          <CommandList className="max-h-96">
            <CommandEmpty>No apps found.</CommandEmpty>
            {menu.categories.map((category) => (
              <CommandGroup key={category.name} heading={category.name}>
                {category.apps.map((app) => (
                  <CommandItem
                    key={app.appId}
                    value={app.appId}
                    onSelect={() => menu.launch(app.appId)}
                  >
                    <AppIcon
                      icon={app.icon}
                      className="size-4"
                      fallback={
                        <span className="w-4 text-center text-xs">{app.title.charAt(0)}</span>
                      }
                    />
                    {app.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
