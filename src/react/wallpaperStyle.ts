import type { CSSProperties } from 'react';
import type { Wallpaper } from '../core/types';

/**
 * The CSS for a wallpaper. A color or gradient paints as the background, an image is drawn with
 * its `fit` (default `cover`) over the theme's background, and `theme` (or none) paints the
 * theme's background tokens.
 */
export function wallpaperStyle(wallpaper: Wallpaper | null): CSSProperties {
  switch (wallpaper?.type) {
    case 'color':
      return { background: wallpaper.value };
    case 'gradient':
      return { background: wallpaper.value };
    case 'image': {
      const fit = wallpaper.fit ?? 'cover';
      return {
        backgroundImage: `url("${wallpaper.url.replace(/"/g, '%22')}")`,
        backgroundSize: fit === 'center' ? 'auto' : fit,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: 'var(--background)',
      };
    }
    default:
      return { background: 'linear-gradient(135deg, var(--background), var(--muted))' };
  }
}
