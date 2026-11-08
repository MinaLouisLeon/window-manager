import { Avatar, AvatarFallback, AvatarImage, cn } from '@integr8-media/ui';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { useWindowManagerContext } from './windowManagerContext';

/** Props of `AppIcon`. */
export interface AppIconProps {
  /** An app's `icon`: a key of the provider's `icons` map, `{ src, alt }`, or a React element. */
  icon: unknown;
  className?: string;
  /** Shown when the icon is missing or cannot be drawn (for example the app's first letter). */
  fallback?: ReactNode;
}

/**
 * Draws an app icon: a string is looked up in the provider's `icons` map, `{ src, alt }` becomes
 * an image (a ui `Avatar`, so `fallback` shows until it loads) and a React element is shown as
 * is. Anything else shows `fallback` (default nothing).
 */
export function AppIcon({ icon, className, fallback = null }: AppIconProps): ReactElement {
  const { icons } = useWindowManagerContext();
  if (typeof icon === 'string') {
    const Icon = icons[icon];
    if (Icon !== undefined) return <Icon {...(className === undefined ? {} : { className })} />;
  } else if (isValidElement(icon)) {
    return icon as ReactElement;
  } else if (typeof icon === 'object' && icon !== null && 'src' in icon) {
    const { src, alt } = icon as { src: string; alt?: string };
    // ui's Avatar loads the image and shows `fallback` until it has (or when it cannot).
    return (
      <Avatar className={cn('rounded-none', className ?? 'size-auto')}>
        <AvatarImage src={src} alt={alt ?? ''} draggable={false} />
        <AvatarFallback className="rounded-none bg-transparent">{fallback}</AvatarFallback>
      </Avatar>
    );
  }
  return <>{fallback}</>;
}
