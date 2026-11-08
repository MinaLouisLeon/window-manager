import {
  Badge,
  Button,
  cn,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@integr8-media/ui';
import { Check, Layers, LayoutDashboard, Pencil, Plus, X } from 'lucide-react';
import { type CSSProperties, type ReactElement, type Ref, useState } from 'react';
import type { DesktopId, TaskbarPosition } from '../core/types';
import { POPUP_LAYER, useTaskbarClearance } from '../react/taskbarClearance';
import { useDesktopSwitcher } from '../react/useDesktopSwitcher';
import { useWindowManager } from '../react/useWindowManager';
import { useWindowManagerContext } from '../react/windowManagerContext';

/** Props of `DesktopSwitcher`. */
export interface DesktopSwitcherProps {
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLButtonElement>;
}

const SIDE: Record<TaskbarPosition, 'top' | 'bottom' | 'left' | 'right'> = {
  bottom: 'top',
  top: 'bottom',
  left: 'right',
  right: 'left',
};

/**
 * A button that opens a popover with the desktops: switch (click), rename (pencil, then Enter),
 * remove (when a desktop has windows, choose to move them to another desktop or close them) and
 * add. The button shows the number of the active desktop.
 */
export function DesktopSwitcher({ className, style, ref }: DesktopSwitcherProps): ReactElement {
  const switcher = useDesktopSwitcher();
  const { stores } = useWindowManagerContext();
  const { state: position } = useWindowManager((state) => state.shell.taskbarPosition);
  const [open, setOpen] = useState(false);
  const clearance = useTaskbarClearance(open);
  const [removing, setRemoving] = useState<DesktopId | null>(null);
  const activeNumber = switcher.desktops.findIndex((desktop) => desktop.active) + 1;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setRemoving(null);
          switcher.cancelRename();
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          variant="ghost"
          size="icon"
          aria-label="Desktops"
          data-wm-desktop-switcher=""
          className={cn('relative size-9 shrink-0', className)}
          style={style}
        >
          <Layers className="size-5" />
          <span
            aria-hidden="true"
            className="absolute right-0.5 bottom-0.5 text-[10px] leading-none font-medium"
          >
            {activeNumber}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side={SIDE[position]}
        align="end"
        collisionPadding={clearance}
        className={cn('w-72 p-2', POPUP_LAYER)}
      >
        <ul className="flex flex-col gap-1" aria-label="Desktops">
          {switcher.desktops.map((desktop) => {
            const others = switcher.desktops.filter((entry) => entry.id !== desktop.id);
            return (
              <li key={desktop.id} data-wm-desktop-entry={desktop.id} className="flex flex-col">
                {switcher.editingId === desktop.id ? (
                  <form
                    className="flex items-center gap-1"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      switcher.commitRename(String(data.get('name') ?? ''));
                    }}
                  >
                    <Input
                      name="name"
                      aria-label="Desktop name"
                      defaultValue={desktop.name}
                      ref={(node) => {
                        node?.focus();
                        node?.select();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.stopPropagation();
                          switcher.cancelRename();
                        }
                      }}
                    />
                    <Button type="submit" variant="ghost" size="icon-sm" aria-label="Save name">
                      <Check className="size-4" />
                    </Button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-current={desktop.active ? 'true' : undefined}
                      className={cn(
                        'min-w-0 flex-1 justify-start gap-2 font-normal',
                        desktop.active && 'bg-accent text-accent-foreground',
                      )}
                      onClick={() => {
                        switcher.switchTo(desktop.id);
                        setOpen(false);
                      }}
                    >
                      <span className="truncate">{desktop.name}</span>
                      {desktop.windowCount > 0 ? (
                        <Badge variant="secondary" className="ml-auto">
                          {desktop.windowCount}
                        </Badge>
                      ) : null}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Rename ${desktop.name}`}
                      onClick={() => switcher.startRename(desktop.id)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${desktop.name}`}
                      disabled={!switcher.canRemove}
                      onClick={() => {
                        if (desktop.windowCount === 0) void switcher.remove(desktop.id);
                        else setRemoving(desktop.id);
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                )}
                {removing === desktop.id ? (
                  <fieldset className="mt-1 flex min-w-0 flex-col gap-1 rounded-md border border-border p-2 text-xs">
                    <legend className="sr-only">
                      What to do with the windows of {desktop.name}
                    </legend>
                    <p className="text-muted-foreground">This desktop has windows.</p>
                    {others.map((other) => (
                      <Button
                        key={other.id}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRemoving(null);
                          void switcher.remove(desktop.id, { moveWindowsTo: other.id });
                        }}
                      >
                        Move them to {other.name}
                      </Button>
                    ))}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setRemoving(null);
                        void switcher.remove(desktop.id);
                      }}
                    >
                      Close them
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRemoving(null)}>
                      Cancel
                    </Button>
                  </fieldset>
                ) : null}
              </li>
            );
          })}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full justify-start gap-2"
          onClick={() => switcher.add()}
        >
          <Plus className="size-4" />
          New desktop
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => {
            setOpen(false);
            stores.overview.set(true);
          }}
        >
          <LayoutDashboard className="size-4" />
          Desktop overview
        </Button>
      </PopoverContent>
    </Popover>
  );
}
