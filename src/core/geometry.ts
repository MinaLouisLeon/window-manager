import type { Bounds, Insets, Point, Size, SnapZone } from './types';

/** Smallest size of a window whose app sets no `size.min`. */
export const DEFAULT_MIN_SIZE: Size = { width: 240, height: 160 };
/** Pixels of a title bar that stay in the work area when `minVisibleTitleBar` is not set. */
export const DEFAULT_MIN_VISIBLE_TITLE_BAR = 48;

/** Pixels from an edge of the work area that start a snap preview while dragging. */
export const DEFAULT_SNAP_THRESHOLD = 16;

/** Which edge or corner of a window is being dragged to resize it. */
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Column and row span of each zone, as fractions of the area: [startX, endX, startY, endY]. */
const ZONE_SPANS: Record<SnapZone, readonly [number, number, number, number]> = {
  left: [0, 1 / 2, 0, 1],
  right: [1 / 2, 1, 0, 1],
  'top-left': [0, 1 / 2, 0, 1 / 2],
  'top-right': [1 / 2, 1, 0, 1 / 2],
  'bottom-left': [0, 1 / 2, 1 / 2, 1],
  'bottom-right': [1 / 2, 1, 1 / 2, 1],
  'left-third': [0, 1 / 3, 0, 1],
  'center-third': [1 / 3, 2 / 3, 0, 1],
  'right-third': [2 / 3, 1, 0, 1],
  'left-two-thirds': [0, 2 / 3, 0, 1],
  'right-two-thirds': [1 / 3, 1, 0, 1],
};

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
 * Bounds of a window whose `edge` was dragged by (`dx`, `dy`) from `start`. The opposite edges stay
 * put; the size stays within `min` and `max` (min wins), and the top edge never goes above `area`.
 */
export function resizeBounds(
  start: Bounds,
  edge: ResizeEdge,
  dx: number,
  dy: number,
  rules: { min: Size; max?: Size },
  area: Bounds,
): Bounds {
  const maxWidth = rules.max?.width ?? Number.POSITIVE_INFINITY;
  const maxHeight = rules.max?.height ?? Number.POSITIVE_INFINITY;
  const fitWidth = (value: number): number => Math.max(rules.min.width, Math.min(maxWidth, value));
  const fitHeight = (value: number): number =>
    Math.max(rules.min.height, Math.min(maxHeight, value));

  let { x, y, width, height } = start;
  if (edge.includes('e')) {
    width = fitWidth(start.width + dx);
  }
  if (edge.includes('w')) {
    width = fitWidth(start.width - dx);
    x = start.x + start.width - width;
  }
  if (edge.includes('s')) {
    height = fitHeight(start.height + dy);
  }
  if (edge.includes('n')) {
    const top = Math.max(area.y, start.y + dy);
    height = fitHeight(start.y + start.height - top);
    y = start.y + start.height - height;
  }
  return { x, y, width, height };
}

/**
 * The rectangle a snap zone covers inside `area`. Edges are rounded to whole pixels, and
 * neighbouring zones share their edge, so zones tile the area without gaps or overlaps.
 */
export function boundsForZone(zone: SnapZone, area: Bounds): Bounds {
  const [startX, endX, startY, endY] = ZONE_SPANS[zone];
  const x0 = Math.round(area.x + area.width * startX);
  const x1 = Math.round(area.x + area.width * endX);
  const y0 = Math.round(area.y + area.height * startY);
  const y1 = Math.round(area.y + area.height * endY);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * The zone a pointer at `point` would snap to while a window is dragged: a corner gives a quarter,
 * the left or right edge a half, the top edge `'maximize'`. "At an edge" means within `threshold`
 * px of it, or beyond it. The bottom edge alone gives nothing (it is usually the taskbar).
 */
export function zoneAtPoint(
  point: Point,
  area: Bounds,
  threshold: number,
): SnapZone | 'maximize' | null {
  const nearLeft = point.x <= area.x + threshold;
  const nearRight = point.x >= area.x + area.width - threshold;
  const nearTop = point.y <= area.y + threshold;
  const nearBottom = point.y >= area.y + area.height - threshold;

  if (nearTop && nearLeft) return 'top-left';
  if (nearTop && nearRight) return 'top-right';
  if (nearBottom && nearLeft) return 'bottom-left';
  if (nearBottom && nearRight) return 'bottom-right';
  if (nearLeft) return 'left';
  if (nearRight) return 'right';
  if (nearTop) return 'maximize';
  return null;
}

/**
 * Bounds for a maximized or snapped window that is being dragged back to its normal size: the
 * normal size (`restore`), placed so the pointer keeps its relative horizontal spot on the title
 * bar (halfway across the maximized bar stays halfway across the restored one) and its vertical
 * distance from the top of the window (never more than the restored height).
 */
export function dragRestoreBounds(pointer: Point, current: Bounds, restore: Bounds): Bounds {
  const ratio =
    current.width > 0 ? Math.min(1, Math.max(0, (pointer.x - current.x) / current.width)) : 0.5;
  const offsetY = Math.min(Math.max(0, pointer.y - current.y), restore.height);
  return {
    x: Math.round(pointer.x - ratio * restore.width),
    y: Math.round(pointer.y - offsetY),
    width: restore.width,
    height: restore.height,
  };
}

/** Distance in px at which window edges start to stick while dragging (`magnetize`). */
export const DEFAULT_EDGE_MAGNET = 8;

/**
 * The snap layouts offered by the snap layouts menu: each is a set of zones that tile the work
 * area, so a window picked into one zone leaves room for the others.
 */
export const SNAP_LAYOUTS: { id: string; zones: SnapZone[] }[] = [
  { id: 'halves', zones: ['left', 'right'] },
  { id: 'quarters', zones: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] },
  { id: 'thirds', zones: ['left-third', 'center-third', 'right-third'] },
  { id: 'two-thirds-left', zones: ['left-two-thirds', 'right-third'] },
  { id: 'two-thirds-right', zones: ['left-third', 'right-two-thirds'] },
];

/** The smallest move (within `distance`) that puts a span's start or end on one of `targets`. */
function nearestShift(start: number, end: number, targets: number[], distance: number): number {
  let best = 0;
  let bestSize = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    for (const shift of [target - start, target - end]) {
      const size = Math.abs(shift);
      if (size <= distance && size < bestSize) {
        best = shift;
        bestSize = size;
      }
    }
  }
  return best;
}

/**
 * Makes window edges stick: moves `bounds` (never resizes it) by up to `distance` px so that an
 * edge lands on an edge of the work area `area` or of one of `others` (a neighbour's edge, to sit
 * flush against it or line up with it). Each axis is handled on its own and the closest edge wins.
 * A `distance` of 0 or less returns `bounds` unchanged.
 */
export function magnetize(
  bounds: Bounds,
  area: Bounds,
  others: Bounds[],
  distance: number,
): Bounds {
  if (!(distance > 0)) return bounds;
  const xs = [area.x, area.x + area.width];
  const ys = [area.y, area.y + area.height];
  for (const other of others) {
    xs.push(other.x, other.x + other.width);
    ys.push(other.y, other.y + other.height);
  }
  const dx = nearestShift(bounds.x, bounds.x + bounds.width, xs, distance);
  const dy = nearestShift(bounds.y, bounds.y + bounds.height, ys, distance);
  return dx === 0 && dy === 0 ? bounds : { ...bounds, x: bounds.x + dx, y: bounds.y + dy };
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
