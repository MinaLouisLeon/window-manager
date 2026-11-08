import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestManager, createWrapper, stubSurfaceSize } from '../../test/harness';
import { SnapLayoutsMenu } from './SnapLayoutsMenu';
import { WindowManagerShell } from './WindowManagerShell';

function setup(appId = 'notes', onClick = vi.fn()) {
  const manager = createTestManager();
  const id = manager.open({ appId });
  render(
    <SnapLayoutsMenu windowId={id}>
      <button type="button" onClick={onClick}>
        Maximize
      </button>
    </SnapLayoutsMenu>,
    { wrapper: createWrapper(manager) },
  );
  return { manager, id, onClick };
}

describe('SnapLayoutsMenu', () => {
  it('opens when the button is hovered and lists every layout', async () => {
    const user = userEvent.setup();
    setup();
    await user.hover(screen.getByRole('button', { name: 'Maximize' }));
    expect(await screen.findByRole('list', { name: 'Snap layouts' })).toBeTruthy();
    for (const layout of [
      'Halves',
      'Quarters',
      'Thirds',
      'Two thirds and a third',
      'A third and two thirds',
    ]) {
      expect(screen.getAllByLabelText(new RegExp(`^${layout}:`)).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByLabelText(/^Quarters:/)).toHaveLength(4);
  });

  it('snaps the window to the zone that is picked and closes', async () => {
    const user = userEvent.setup();
    const { manager, id } = setup();
    await user.hover(screen.getByRole('button', { name: 'Maximize' }));
    await user.click(await screen.findByLabelText('Thirds: Center third'));
    expect(manager.getState().windows[id]?.snap).toBe('center-third');
    expect(screen.queryByRole('list', { name: 'Snap layouts' })).toBeNull();
  });

  it('marks the zone the window is in', async () => {
    const user = userEvent.setup();
    const { manager, id } = setup();
    act(() => manager.snap(id, 'right'));
    await user.hover(screen.getByRole('button', { name: 'Maximize' }));
    expect((await screen.findByLabelText('Halves: Right half')).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByLabelText('Halves: Left half').getAttribute('aria-pressed')).toBe('false');
  });

  it('gives a window that cannot snap just the button', async () => {
    const user = userEvent.setup();
    setup('fixed');
    await user.hover(screen.getByRole('button', { name: 'Maximize' }));
    await new Promise((resolve) => setTimeout(resolve, 650));
    expect(screen.queryByRole('list', { name: 'Snap layouts' })).toBeNull();
  });

  describe('long press', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('opens after a touch is held, and the release does not press the button', () => {
      const { onClick } = setup();
      const button = screen.getByRole('button', { name: 'Maximize' });
      fireEvent.pointerDown(button, { pointerType: 'touch', pointerId: 2 });
      act(() => {
        vi.advanceTimersByTime(499);
      });
      expect(screen.queryByRole('list', { name: 'Snap layouts' })).toBeNull();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.getByRole('list', { name: 'Snap layouts' })).toBeTruthy();

      fireEvent.pointerUp(button, { pointerType: 'touch', pointerId: 2 });
      fireEvent.click(button);
      expect(onClick).not.toHaveBeenCalled();
      // The next tap is a normal press again.
      fireEvent.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not open when the touch is released early', () => {
      const { onClick } = setup();
      const button = screen.getByRole('button', { name: 'Maximize' });
      fireEvent.pointerDown(button, { pointerType: 'touch', pointerId: 2 });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      fireEvent.pointerUp(button, { pointerType: 'touch', pointerId: 2 });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.queryByRole('list', { name: 'Snap layouts' })).toBeNull();
      fireEvent.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does not start a long press for a mouse', () => {
      setup();
      const button = screen.getByRole('button', { name: 'Maximize' });
      fireEvent.pointerDown(button, { pointerType: 'mouse', pointerId: 1 });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.queryByRole('list', { name: 'Snap layouts' })).toBeNull();
    });

    it('waits as long as longPressMs says', () => {
      const manager = createTestManager();
      const id = manager.open({ appId: 'notes' });
      render(
        <SnapLayoutsMenu windowId={id} longPressMs={100}>
          <button type="button">Maximize</button>
        </SnapLayoutsMenu>,
        { wrapper: createWrapper(manager) },
      );
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Maximize' }), {
        pointerType: 'pen',
        pointerId: 3,
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(screen.getByRole('list', { name: 'Snap layouts' })).toBeTruthy();
    });
  });
});

describe('SnapLayoutsMenu on the window controls', () => {
  let restoreSize: () => void;
  beforeEach(() => {
    restoreSize = stubSurfaceSize(1000, 700);
  });
  afterEach(() => restoreSize());

  it.each([
    ['windows', 'Maximize'],
    ['mac', 'Maximize'],
  ] as const)('opens from the maximize button in the %s style', async (style, name) => {
    const user = userEvent.setup();
    const manager = createTestManager();
    manager.setShellSettings({ controlsStyle: style });
    const id = manager.open({ appId: 'notes' });
    render(<WindowManagerShell />, { wrapper: createWrapper(manager) });
    await user.hover(screen.getByRole('button', { name }));
    await user.click(await screen.findByLabelText('Quarters: Top left'));
    expect(manager.getState().windows[id]?.snap).toBe('top-left');
  });
});
