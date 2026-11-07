import { afterEach, describe, expect, it } from 'vitest';
import { readTaskbarClearance } from './taskbarClearance';

const SCREEN = { width: 1000, height: 800 };

/** Puts a taskbar with the given rectangle in the document. */
function addTaskbar(position: string, rect: Partial<DOMRect>): void {
  const taskbar = document.createElement('nav');
  taskbar.setAttribute('data-wm-taskbar', '');
  taskbar.setAttribute('data-taskbar-position', position);
  taskbar.getBoundingClientRect = () =>
    ({ top: 0, right: 0, bottom: 0, left: 0, ...rect }) as DOMRect;
  document.body.appendChild(taskbar);
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: SCREEN.width,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: SCREEN.height,
  });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('readTaskbarClearance', () => {
  it('keeps only a margin from every edge without a taskbar', () => {
    expect(readTaskbarClearance()).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
  });

  it('keeps the taskbar thickness plus a gap on the bottom edge', () => {
    addTaskbar('bottom', { top: 752, bottom: 800 });
    expect(readTaskbarClearance()).toEqual({ top: 8, right: 8, bottom: 52, left: 8 });
  });

  it('keeps it on the top edge', () => {
    addTaskbar('top', { top: 0, bottom: 48 });
    expect(readTaskbarClearance()).toEqual({ top: 52, right: 8, bottom: 8, left: 8 });
  });

  it('keeps it on the left edge', () => {
    addTaskbar('left', { left: 0, right: 48 });
    expect(readTaskbarClearance()).toEqual({ top: 8, right: 8, bottom: 8, left: 52 });
  });

  it('keeps it on the right edge', () => {
    addTaskbar('right', { left: 952, right: 1000 });
    expect(readTaskbarClearance()).toEqual({ top: 8, right: 52, bottom: 8, left: 8 });
  });

  it('takes no space from a taskbar that is tucked away off screen', () => {
    addTaskbar('bottom', { top: 800, bottom: 848 });
    expect(readTaskbarClearance().bottom).toBe(8);
  });
});
