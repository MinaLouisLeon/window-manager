import { describe, expect, it } from 'vitest';
import { cascade, clampBounds, workArea } from './geometry';

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
