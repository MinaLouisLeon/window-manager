import { Button, cn } from '@integr8-media/ui';
import { Copy, Minus, Square, X } from 'lucide-react';
import type { CSSProperties, ReactElement, Ref } from 'react';
import type { UseWindowFrameResult, WindowControl } from '../react/useWindowFrame';
import { SnapLayoutsMenu } from './SnapLayoutsMenu';

/** Props of `WindowControls`. */
export interface WindowControlsProps {
  /** The frame of the window these buttons control (from `useWindowFrame`). */
  frame: UseWindowFrameResult;
  /** Draw only these buttons. Default: all three. */
  controls?: readonly WindowControl[];
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

const ALL: readonly WindowControl[] = ['minimize', 'maximize', 'close'];
const MAC_ORDER: readonly WindowControl[] = ['close', 'minimize', 'maximize'];

const MAC_COLORS: Record<WindowControl, string> = {
  close: 'bg-destructive',
  minimize: 'bg-warning',
  maximize: 'bg-success',
};

const MAC_GLYPH = 'text-foreground opacity-0 group-hover/mac:opacity-80';

/**
 * The minimize, maximize (restore) and close buttons. `controlsStyle="windows"` draws icon
 * buttons for the right of the title bar; `"mac"` draws round buttons for the left, in the
 * destructive, warning and success colors. The style comes from the frame (the app's
 * `controlsStyle`, or the shell's). Hovering or long-pressing the maximize button opens the snap
 * layouts menu (`SnapLayoutsMenu`).
 */
export function WindowControls({
  frame,
  controls = ALL,
  className,
  style,
  ref,
}: WindowControlsProps): ReactElement {
  const mac = frame.controlsStyle === 'mac';
  const maximized = frame.window?.status === 'maximized';
  const shown = (mac ? MAC_ORDER : ALL).filter((control) => controls.includes(control));

  return (
    <div
      ref={ref}
      data-wm-window-controls=""
      data-controls-style={frame.controlsStyle}
      data-wm-no-drag=""
      className={cn('flex shrink-0 items-center', mac ? 'gap-2 px-3' : 'h-full', className)}
      style={style}
    >
      {shown.map((control) => {
        const props = frame.getControlProps(control);
        const withLayouts = (button: ReactElement): ReactElement =>
          control === 'maximize' && frame.window !== null ? (
            <SnapLayoutsMenu key={control} windowId={frame.window.id}>
              {button}
            </SnapLayoutsMenu>
          ) : (
            button
          );
        if (mac) {
          return withLayouts(
            <button
              key={control}
              {...props}
              data-control={control}
              data-state={frame.focused ? 'focused' : 'unfocused'}
              className={cn(
                'group/mac flex size-3 items-center justify-center rounded-full outline-none',
                'focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40',
                'data-[state=unfocused]:opacity-60',
                MAC_COLORS[control],
              )}
            >
              {control === 'close' ? (
                <X className={cn('size-2', MAC_GLYPH)} strokeWidth={3} />
              ) : control === 'minimize' ? (
                <Minus className={cn('size-2', MAC_GLYPH)} strokeWidth={3} />
              ) : (
                <Square className={cn('size-1.5', MAC_GLYPH)} strokeWidth={3} />
              )}
            </button>,
          );
        }
        return withLayouts(
          <Button
            key={control}
            {...props}
            variant="ghost"
            size="icon-sm"
            data-control={control}
            className={cn(
              'h-full w-10 rounded-none text-muted-foreground',
              control === 'close' && 'hover:bg-destructive hover:text-destructive-foreground',
            )}
          >
            {control === 'minimize' ? (
              <Minus className="size-4" />
            ) : control === 'close' ? (
              <X className="size-4" />
            ) : maximized ? (
              <Copy className="size-3.5" />
            ) : (
              <Square className="size-3.5" />
            )}
          </Button>,
        );
      })}
    </div>
  );
}
