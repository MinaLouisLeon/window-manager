import { cn } from '@integr8-media/ui';
import type { CSSProperties, ReactElement, Ref } from 'react';
import { useSnapPreview } from '../react/useSnapPreview';

/** Props of `SnapPreview`. */
export interface SnapPreviewProps {
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

/**
 * A translucent box where the dragged window will land. Renders nothing unless a window is being
 * dragged near an edge or a corner. Put it inside the desktop element (`Desktop` already does).
 */
export function SnapPreview({ className, style, ref }: SnapPreviewProps): ReactElement | null {
  const preview = useSnapPreview();
  if (preview === null) return null;
  const { bounds, zone } = preview;
  return (
    <div
      ref={ref}
      data-wm-snap-preview={zone}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute top-0 left-0 z-[10000]',
        'rounded-[var(--wm-window-radius)] border-2 border-ring bg-primary/15',
        'transition-[width,height,transform] duration-100 ease-out motion-reduce:transition-none',
        className,
      )}
      style={{
        width: bounds.width,
        height: bounds.height,
        transform: `translate(${bounds.x}px, ${bounds.y}px)`,
        ...style,
      }}
    />
  );
}
