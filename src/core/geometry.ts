import type { Bounds, Insets, Point, Size } from './types';

/** The area windows can use: the viewport minus the insets (for example the taskbar). */
export function workArea(viewport: Size, insets: Insets): Bounds {
  return {
    x: insets.left,
    y: insets.top,
    width: Math.max(0, viewport.width - insets.left - insets.right),
    height: Math.max(0, viewport.height - insets.top - insets.bottom),
  };
}

function limit(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), Math.max(low, high));
}

/**
 * Applies the size rules (min wins over max) and keeps at least `minVisibleTitleBar` px of the
 * title bar inside the area, horizontally and vertically. The title bar never goes above the area.
 */
export function clampBounds(
  bounds: Bounds,
  area: Bounds,
  rules: { min: Size; max?: Size; minVisibleTitleBar: number },
): Bounds {
  const maxWidth = rules.max?.width ?? Number.POSITIVE_INFINITY;
  const maxHeight = rules.max?.height ?? Number.POSITIVE_INFINITY;
  const width = Math.max(rules.min.width, Math.min(maxWidth, bounds.width));
  const height = Math.max(rules.min.height, Math.min(maxHeight, bounds.height));
  const visibleX = Math.min(rules.minVisibleTitleBar, width);
  const visibleY = Math.min(rules.minVisibleTitleBar, height);
  return {
    x: limit(bounds.x, area.x - width + visibleX, area.x + area.width - visibleX),
    y: limit(bounds.y, area.y, area.y + area.height - visibleY),
    width,
    height,
  };
}

/**
 * Top-left corner for the `index`-th cascaded window. The offset repeats down and right until the
 * window would leave the area, then starts again at the corner.
 */
export function cascade(index: number, area: Bounds, size: Size, offset: number): Point {
  const room = Math.min(area.width - size.width, area.height - size.height);
  const steps = offset > 0 && room > 0 ? Math.floor(room / offset) + 1 : 1;
  const step = (Math.max(0, index) % steps) * offset;
  return { x: area.x + step, y: area.y + step };
}
