import {
  Button,
  cn,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  ThemeSwitcher,
  ToggleGroup,
  ToggleGroupItem,
  useOptionalTheme,
} from '@integr8-media/ui';
import { SlidersHorizontal } from 'lucide-react';
import { type CSSProperties, type ReactElement, type Ref, useId, useState } from 'react';
import type { ControlsStyle, TaskbarPosition } from '../core/types';
import { POPUP_SIDE, useTaskbarClearance } from '../react/taskbarClearance';
import { useQuickSettings } from '../react/useQuickSettings';

/** Props of `QuickSettings`. */
export interface QuickSettingsProps {
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLButtonElement>;
}

const POSITIONS: readonly { value: TaskbarPosition; label: string }[] = [
  { value: 'bottom', label: 'Bottom' },
  { value: 'top', label: 'Top' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

const CONTROL_STYLES: readonly { value: ControlsStyle; label: string }[] = [
  { value: 'windows', label: 'Windows' },
  { value: 'mac', label: 'Mac' },
];

/**
 * A button that opens the quick settings: the theme (ui's `ThemeSwitcher`, shown when the app has
 * a `ThemeProvider`), the taskbar position, taskbar auto-hide and the window controls style. The
 * popover keeps ui's default layer so the theme menu that opens from it is drawn above it; it is
 * kept clear of the taskbar by its collision padding instead.
 */
export function QuickSettings({ className, style, ref }: QuickSettingsProps): ReactElement {
  const settings = useQuickSettings();
  const theme = useOptionalTheme();
  const [open, setOpen] = useState(false);
  const clearance = useTaskbarClearance(open);
  const autoHideId = useId();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          variant="ghost"
          size="icon"
          aria-label="Quick settings"
          data-wm-quick-settings=""
          className={cn('size-9 shrink-0', className)}
          style={style}
        >
          <SlidersHorizontal className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side={POPUP_SIDE[settings.settings.taskbarPosition]}
        align="end"
        collisionPadding={clearance}
        className="flex w-72 flex-col gap-3 p-3"
      >
        {theme === null ? null : (
          <div className="flex items-center justify-between gap-2">
            <Label asChild>
              <span>Theme</span>
            </Label>
            <ThemeSwitcher showLabel variant="outline" size="sm" />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label id={`${autoHideId}-position`} asChild>
            <span>Taskbar position</span>
          </Label>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            aria-labelledby={`${autoHideId}-position`}
            value={settings.settings.taskbarPosition}
            onValueChange={(value) => {
              if (value !== '') settings.setTaskbarPosition(value as TaskbarPosition);
            }}
          >
            {POSITIONS.map((entry) => (
              <ToggleGroupItem key={entry.value} value={entry.value} className="px-3">
                {entry.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={autoHideId} className="text-sm font-normal">
            Auto-hide the taskbar
          </Label>
          <Switch
            id={autoHideId}
            checked={settings.settings.taskbarAutoHide}
            onCheckedChange={settings.setTaskbarAutoHide}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label id={`${autoHideId}-controls`} asChild>
            <span>Window controls</span>
          </Label>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            aria-labelledby={`${autoHideId}-controls`}
            value={settings.settings.controlsStyle}
            onValueChange={(value) => {
              if (value !== '') settings.setControlsStyle(value as ControlsStyle);
            }}
          >
            {CONTROL_STYLES.map((entry) => (
              <ToggleGroupItem key={entry.value} value={entry.value} className="px-3">
                {entry.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </PopoverContent>
    </Popover>
  );
}
