import { describe, expect, it } from 'vitest';
import {
  boundsForZone,
  cascade,
  clampBounds,
  dragRestoreBounds,
  workArea,
  zoneAtPoint,
} from './geometry';
import type { SnapZone } from './types';

const area = { x: 0, y: 0, width: 1000, height: 700 };
const rules = { min: { width: 200, height: 100 }, minVisibleTitleBar: 48 };

describe('workArea', () => {
  it('is the viewport minus the insets', () => {
    expect(
      workArea({ width: 1000, height: 800 }, { top: 0, right: 0, bottom: 48, left: 10 }),
    ).toEqual({ x: 10, y: 0, width: 990, height: 752 });
  });

  it('never has a negative size', () => {
    const result = workArea({ width: 10, height: 10 }, { top: 0, right: 0, bottom: 50, left: 50 });
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });
});

describe('clampBounds', () => {
  it('keeps bounds that already fit', () => {
    const bounds = { x: 100, y: 100, width: 400, height: 300 };
    expect(clampBounds(bounds, area, rules)).toEqual(bounds);
  });

  it('applies min and max size, min winning over max', () => {
    expect(clampBounds({ x: 0, y: 0, width: 50, height: 50 }, area, rules)).toMatchObject({
      width: 200,
      height: 100,
    });
    expect(
      clampBounds({ x: 0, y: 0, width: 900, height: 600 }, area, {
        ...rules,
        max: { width: 500, height: 400 },
      }),
    ).toMatchObject({ width: 500, height: 400 });
    expect(
      clampBounds({ x: 0, y: 0, width: 300, height: 300 }, area, {
        ...rules,
        max: { width: 100, height: 50 },
      }),
    ).toMatchObject({ width: 200, height: 100 });
  });

  it('keeps the title bar inside the area on every side', () => {
    const size = { width: 400, height: 300 };
    expect(clampBounds({ x: -1000, y: 100, ...size }, area, rules).x).toBe(-352);
    expect(clampBounds({ x: 5000, y: 100, ...size }, area, rules).x).toBe(952);
    expect(clampBounds({ x: 100, y: -50, ...size }, area, rules).y).toBe(0);
    expect(clampBounds({ x: 100, y: 5000, ...size }, area, rules).y).toBe(652);
  });

  it('respects an area that does not start at the origin', () => {
    const offsetArea = { x: 0, y: 40, width: 1000, height: 660 };
    expect(clampBounds({ x: 100, y: 0, width: 400, height: 300 }, offsetArea, rules).y).toBe(40);
  });
});

describe('cascade', () => {
  const size = { width: 400, height: 300 };

  it('steps down and right by the offset', () => {
    expect(cascade(0, area, size, 24)).toEqual({ x: 0, y: 0 });
    expect(cascade(2, area, size, 24)).toEqual({ x: 48, y: 48 });
  });

  it('starts again at the corner when the window would leave the area', () => {
    // room = min(600, 400) = 400 → 17 steps (0..16)
    expect(cascade(16, area, size, 24)).toEqual({ x: 384, y: 384 });
    expect(cascade(17, area, size, 24)).toEqual({ x: 0, y: 0 });
  });

  it('stays at the corner when there is no room or no offset', () => {
    expect(cascade(5, area, { width: 1000, height: 700 }, 24)).toEqual({ x: 0, y: 0 });
    expect(cascade(5, area, size, 0)).toEqual({ x: 0, y: 0 });
  });

  it('adds the area origin', () => {
    expect(cascade(1, { x: 10, y: 20, width: 1000, height: 700 }, size, 24)).toEqual({
      x: 34,
      y: 44,
    });
  });
});

describe('boundsForZone', () => {
  const wide = { x: 0, y: 0, width: 1200, height: 800 };

  it('gives halves', () => {
    expect(boundsForZone('left', wide)).toEqual({ x: 0, y: 0, width: 600, height: 800 });
    expect(boundsForZone('right', wide)).toEqual({ x: 600, y: 0, width: 600, height: 800 });
  });

  it('gives quarters', () => {
    expect(boundsForZone('top-left', wide)).toEqual({ x: 0, y: 0, width: 600, height: 400 });
    expect(boundsForZone('top-right', wide)).toEqual({ x: 600, y: 0, width: 600, height: 400 });
    expect(boundsForZone('bottom-left', wide)).toEqual({ x: 0, y: 400, width: 600, height: 400 });
    expect(boundsForZone('bottom-right', wide)).toEqual({
      x: 600,
      y: 400,
      width: 600,
      height: 400,
    });
  });

  it('gives thirds and two-thirds', () => {
    expect(boundsForZone('left-third', wide)).toEqual({ x: 0, y: 0, width: 400, height: 800 });
    expect(boundsForZone('center-third', wide)).toEqual({ x: 400, y: 0, width: 400, height: 800 });
    expect(boundsForZone('right-third', wide)).toEqual({ x: 800, y: 0, width: 400, height: 800 });
    expect(boundsForZone('left-two-thirds', wide)).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 800,
    });
    expect(boundsForZone('right-two-thirds', wide)).toEqual({
      x: 400,
      y: 0,
      width: 800,
      height: 800,
    });
  });

  it('adds the area origin', () => {
    expect(boundsForZone('bottom-right', { x: 10, y: 40, width: 1000, height: 600 })).toEqual({
      x: 510,
      y: 340,
      width: 500,
      height: 300,
    });
  });

  it('tiles an area whose size does not divide evenly, with whole pixels', () => {
    const odd = { x: 3, y: 5, width: 1001, height: 701 };
    const third = (zone: SnapZone) => boundsForZone(zone, odd);
    const left = third('left-third');
    const center = third('center-third');
    const right = third('right-third');
    expect(left.x).toBe(odd.x);
    expect(left.x + left.width).toBe(center.x);
    expect(center.x + center.width).toBe(right.x);
    expect(right.x + right.width).toBe(odd.x + odd.width);

    const topLeft = third('top-left');
    const bottomRight = third('bottom-right');
    expect(topLeft.y + topLeft.height).toBe(bottomRight.y);
    expect(bottomRight.y + bottomRight.height).toBe(odd.y + odd.height);
    for (const value of [left.x, left.width, center.width, right.width, topLeft.height]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('a half and a two-thirds + third pair cover the area', () => {
    const twoThirds = boundsForZone('left-two-thirds', wide);
    const third = boundsForZone('right-third', wide);
    expect(twoThirds.x + twoThirds.width).toBe(third.x);
  });
});

describe('zoneAtPoint', () => {
  const t = 16;

  it('returns null away from the edges', () => {
    expect(zoneAtPoint({ x: 500, y: 350 }, area, t)).toBeNull();
    expect(zoneAtPoint({ x: 17, y: 350 }, area, t)).toBeNull();
  });

  it('gives a half at the left and right edge', () => {
    expect(zoneAtPoint({ x: 0, y: 350 }, area, t)).toBe('left');
    expect(zoneAtPoint({ x: 16, y: 350 }, area, t)).toBe('left');
    expect(zoneAtPoint({ x: 1000, y: 350 }, area, t)).toBe('right');
    expect(zoneAtPoint({ x: 984, y: 350 }, area, t)).toBe('right');
  });

  it('gives maximize at the top edge', () => {
    expect(zoneAtPoint({ x: 500, y: 0 }, area, t)).toBe('maximize');
    expect(zoneAtPoint({ x: 500, y: 16 }, area, t)).toBe('maximize');
  });

  it('gives nothing at the bottom edge alone', () => {
    expect(zoneAtPoint({ x: 500, y: 700 }, area, t)).toBeNull();
  });

  it('gives a quarter in each corner', () => {
    expect(zoneAtPoint({ x: 2, y: 2 }, area, t)).toBe('top-left');
    expect(zoneAtPoint({ x: 998, y: 2 }, area, t)).toBe('top-right');
    expect(zoneAtPoint({ x: 2, y: 698 }, area, t)).toBe('bottom-left');
    expect(zoneAtPoint({ x: 998, y: 698 }, area, t)).toBe('bottom-right');
  });

  it('treats a pointer beyond the area as at the edge', () => {
    expect(zoneAtPoint({ x: -50, y: 350 }, area, t)).toBe('left');
    expect(zoneAtPoint({ x: 500, y: -50 }, area, t)).toBe('maximize');
    expect(zoneAtPoint({ x: 2000, y: 2000 }, area, t)).toBe('bottom-right');
  });

  it('measures from the area, not the viewport origin', () => {
    const offset = { x: 0, y: 48, width: 1000, height: 652 };
    expect(zoneAtPoint({ x: 500, y: 60 }, offset, t)).toBe('maximize');
    expect(zoneAtPoint({ x: 500, y: 100 }, offset, t)).toBeNull();
    expect(zoneAtPoint({ x: 5, y: 60 }, offset, t)).toBe('top-left');
  });

  it('uses the threshold given', () => {
    expect(zoneAtPoint({ x: 30, y: 350 }, area, 16)).toBeNull();
    expect(zoneAtPoint({ x: 30, y: 350 }, area, 40)).toBe('left');
    expect(zoneAtPoint({ x: 0, y: 350 }, area, 0)).toBe('left');
    expect(zoneAtPoint({ x: 1, y: 350 }, area, 0)).toBeNull();
  });
});

describe('dragRestoreBounds', () => {
  const maximized = { x: 0, y: 0, width: 1000, height: 700 };
  const normal = { x: 100, y: 100, width: 400, height: 300 };

  it('keeps the pointer at the same relative spot on the title bar', () => {
    expect(dragRestoreBounds({ x: 500, y: 10 }, maximized, normal)).toEqual({
      x: 300,
      y: 0,
      width: 400,
      height: 300,
    });
    expect(dragRestoreBounds({ x: 250, y: 10 }, maximized, normal).x).toBe(150);
  });

  it('puts the window at the pointer edge when the pointer is at an edge', () => {
    expect(dragRestoreBounds({ x: 0, y: 5 }, maximized, normal).x).toBe(0);
    expect(dragRestoreBounds({ x: 1000, y: 5 }, maximized, normal).x).toBe(600);
  });

  it('keeps the vertical distance from the top of the window, up to the restored height', () => {
    expect(dragRestoreBounds({ x: 500, y: 20 }, maximized, normal).y).toBe(0);
    expect(dragRestoreBounds({ x: 500, y: 520 }, maximized, normal).y).toBe(220);
  });

  it('works for a snapped window that does not start at the origin', () => {
    const snapped = { x: 500, y: 0, width: 500, height: 700 };
    expect(dragRestoreBounds({ x: 750, y: 12 }, snapped, normal)).toEqual({
      x: 550,
      y: 0,
      width: 400,
      height: 300,
    });
  });

  it('clamps the ratio when the pointer is outside the old bounds', () => {
    expect(dragRestoreBounds({ x: -40, y: 5 }, maximized, normal).x).toBe(-40);
    expect(dragRestoreBounds({ x: 1400, y: 5 }, maximized, normal).x).toBe(1000);
  });

  it('copes with a zero-width current rectangle', () => {
    expect(dragRestoreBounds({ x: 100, y: 5 }, { x: 0, y: 0, width: 0, height: 0 }, normal).x).toBe(
      -100,
    );
  });

  it('returns whole pixels', () => {
    const result = dragRestoreBounds({ x: 333, y: 7 }, maximized, { ...normal, width: 401 });
    expect(Number.isInteger(result.x)).toBe(true);
  });
});
