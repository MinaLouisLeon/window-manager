import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import { taskbarInsets, useDesktopSurface } from './useDesktopSurface';

const sizes = { width: 800, height: 600 };
const original = {
  width: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
  height: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight'),
};

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => sizes.width,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => sizes.height,
  });
});

afterEach(() => {
  for (const [name, descriptor] of [
    ['clientWidth', original.width],
    ['clientHeight', original.height],
  ] as const) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, name);
  }
});

function Surface({ taskbarSize }: { taskbarSize?: number }) {
  const surface = useDesktopSurface(taskbarSize === undefined ? {} : { taskbarSize });
  return (
    <div ref={surface.ref} data-testid="surface" data-wallpaper={surface.wallpaper?.type ?? 'none'}>
      {surface.windows.map((win) => (
        <span key={win.id}>{win.id}</span>
      ))}
    </div>
  );
}

describe('taskbarInsets', () => {
  it('takes the size from the taskbar side', () => {
    expect(taskbarInsets('bottom', false, 40)).toEqual({ top: 0, right: 0, bottom: 40, left: 0 });
    expect(taskbarInsets('top', false, 40)).toEqual({ top: 40, right: 0, bottom: 0, left: 0 });
    expect(taskbarInsets('left', false, 40)).toEqual({ top: 0, right: 0, bottom: 0, left: 40 });
    expect(taskbarInsets('right', false, 40)).toEqual({ top: 0, right: 40, bottom: 0, left: 0 });
  });

  it('takes nothing while the taskbar auto-hides', () => {
    expect(taskbarInsets('bottom', true, 40)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

describe('useDesktopSurface', () => {
  it('reports the measured size and the taskbar insets to the manager', () => {
    const manager = createTestManager();
    render(<Surface taskbarSize={40} />, { wrapper: createWrapper(manager) });
    const state = manager.getState();
    expect(state.viewport).toEqual({ width: 800, height: 600 });
    expect(state.insets).toEqual({ top: 0, right: 0, bottom: 40, left: 0 });
  });

  it('falls back to 3rem when the taskbar size cannot be measured', () => {
    const manager = createTestManager();
    render(<Surface />, { wrapper: createWrapper(manager) });
    expect(manager.getState().insets.bottom).toBe(48);
  });

  it('updates the insets when the taskbar moves or auto-hides', () => {
    const manager = createTestManager();
    render(<Surface taskbarSize={40} />, { wrapper: createWrapper(manager) });

    act(() => manager.setShellSettings({ taskbarPosition: 'left' }));
    expect(manager.getState().insets).toEqual({ top: 0, right: 0, bottom: 0, left: 40 });

    act(() => manager.setShellSettings({ taskbarAutoHide: true }));
    expect(manager.getState().insets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('lists the windows of the active desktop in paint order', () => {
    const manager = createTestManager();
    const first = manager.open({ appId: 'notes' });
    const second = manager.open({ appId: 'notes' });
    const otherDesktop = manager.addDesktop();
    const elsewhere = manager.open({ appId: 'notes', desktopId: otherDesktop });
    render(<Surface />, { wrapper: createWrapper(manager) });

    const ids = screen.getByTestId('surface').textContent;
    expect(ids).toBe(`${first}${second}`);
    expect(ids).not.toContain(elsewhere);

    act(() => manager.focus(first));
    expect(screen.getByTestId('surface').textContent).toBe(`${second}${first}`);

    act(() => manager.switchDesktop(otherDesktop));
    expect(screen.getByTestId('surface').textContent).toBe(elsewhere);
  });

  it('includes minimized windows', () => {
    const manager = createTestManager();
    const id = manager.open({ appId: 'notes' });
    manager.minimize(id);
    render(<Surface />, { wrapper: createWrapper(manager) });
    expect(screen.getByTestId('surface').textContent).toBe(id);
  });

  it('returns the wallpaper of the active desktop', () => {
    const manager = createTestManager();
    render(<Surface />, { wrapper: createWrapper(manager) });
    expect(screen.getByTestId('surface').dataset.wallpaper).toBe('none');
    act(() => manager.setWallpaper('desktop-1', { type: 'color', value: '#000' }));
    expect(screen.getByTestId('surface').dataset.wallpaper).toBe('color');
  });
});
