import { cn } from '@integr8-media/ui';
import type { CSSProperties, ReactElement, Ref } from 'react';
import { AppIcon } from '../react/AppIcon';
import { mergeRefs } from '../react/propHelpers';
import { useDesktopIcons } from '../react/useDesktopIcons';
import { useWindowManager } from '../react/useWindowManager';

/** Props of `DesktopIcons`. */
export interface DesktopIconsProps {
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLElement>;
}

/**
 * The desktop's icons in an auto grid. Arrow keys move between them, Enter or a double-click
 * opens the app, and dragging one onto another reorders them. The grid keeps clear of the taskbar
 * and lets pointer events through between icons (so the desktop menu still opens there).
 */
export function DesktopIcons({ className, style, ref }: DesktopIconsProps): ReactElement {
  const { icons, getListProps } = useDesktopIcons();
  const { state: insets } = useWindowManager((state) => state.insets);
  const listProps = getListProps(ref === undefined ? {} : { ref: mergeRefs<HTMLElement>(ref) });
  const gap = 8;

  return (
    <div
      {...listProps}
      data-wm-desktop-icons=""
      className={cn(
        'pointer-events-none absolute inset-0 grid content-start justify-start gap-1',
        'grid-cols-[repeat(auto-fill,5.5rem)] auto-rows-[6.5rem]',
        className,
      )}
      style={{
        paddingTop: insets.top + gap,
        paddingRight: insets.right + gap,
        paddingBottom: insets.bottom + gap,
        paddingLeft: insets.left + gap,
        ...style,
      }}
    >
      {icons.map((icon) => (
        <div
          key={icon.appId}
          {...icon.getItemProps()}
          data-wm-desktop-icon={icon.appId}
          className={cn(
            'pointer-events-auto flex flex-col items-center gap-1 rounded-md p-2 text-center',
            'text-xs text-foreground outline-none select-none',
            'hover:bg-accent/60 aria-selected:bg-accent/40',
            'focus-visible:ring-2 focus-visible:ring-ring',
            'data-[dragging]:opacity-50 data-[drop-target]:ring-2 data-[drop-target]:ring-ring',
          )}
        >
          <span
            className={cn(
              'flex size-[var(--wm-icon-size)] items-center justify-center rounded-lg',
              'border border-border bg-card text-card-foreground shadow-sm [&_svg]:size-1/2',
            )}
          >
            <AppIcon
              icon={icon.icon}
              className="size-1/2"
              fallback={<span className="text-lg font-medium">{icon.title.charAt(0)}</span>}
            />
          </span>
          <span className="line-clamp-2 w-full rounded bg-background/60 px-1 leading-tight break-words">
            {icon.title}
          </span>
        </div>
      ))}
    </div>
  );
}
