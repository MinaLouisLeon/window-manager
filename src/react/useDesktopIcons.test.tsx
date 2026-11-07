import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import { useDesktopIcons } from './useDesktopIcons';

const pointer = { pointerId: 1, isPrimary: true, button: 0 };

function Icons() {
  const { icons, getListProps } = useDesktopIcons();
  return (
    <div {...getListProps({ 'data-testid': 'list' })}>
      {icons.map((icon) => (
        <div key={icon.appId} {...icon.getItemProps({ 'data-testid': icon.appId })}>
          {icon.title}
        </div>
      ))}
    </div>
  );
}

function setup() {
  const manager = createTestManager();
  render(<Icons />, { wrapper: createWrapper(manager) });
  return { manager };
}

const item = (appId: string): HTMLElement => screen.getByTestId(appId);

function giveBoxes(): void {
  const boxes: Record<string, [number, number]> = {
    notes: [0, 50],
    fixed: [60, 110],
    mac: [120, 170],
  };
  for (const [appId, [left, right]] of Object.entries(boxes)) {
    item(appId).getBoundingClientRect = () =>
      ({ left, right, top: 0, bottom: 50, width: 50, height: 50, x: left, y: 0 }) as DOMRect;
  }
}

describe('useDesktopIcons: structure', () => {
  it('lists the icons in iconOrder as a listbox of options', () => {
    setup();
    expect(screen.getByTestId('list').getAttribute('role')).toBe('listbox');
    expect(screen.getByTestId('list').getAttribute('aria-label')).toBe('Desktop icons');
    expect(screen.getAllByRole('option').map((node) => node.textContent)).toEqual([
      'Notes',
      'Fixed',
      'Mac',
    ]);
  });

  it('gives the roving tab stop to the first icon', () => {
    setup();
    expect(item('notes').getAttribute('tabindex')).toBe('0');
    expect(item('fixed').getAttribute('tabindex')).toBe('-1');
    expect(item('notes').getAttribute('aria-selected')).toBe('true');
    expect(item('fixed').getAttribute('aria-selected')).toBe('false');
  });

  it('follows iconOrder changes', () => {
    const { manager } = setup();
    act(() => manager.setIconOrder(['mac']));
    expect(screen.getAllByRole('option').map((node) => node.textContent)).toEqual([
      'Mac',
      'Notes',
      'Fixed',
    ]);
  });

  it('leaves out apps that are not on the desktop', () => {
    const manager = createTestManager();
    expect(manager.getState().iconOrder).toEqual(['notes', 'fixed', 'mac']);
  });
});

describe('useDesktopIcons: keyboard', () => {
  it('moves focus with the arrow keys, Home and End', () => {
    setup();
    fireEvent.keyDown(item('notes'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(item('fixed'));
    expect(item('fixed').getAttribute('tabindex')).toBe('0');
    expect(item('notes').getAttribute('tabindex')).toBe('-1');

    fireEvent.keyDown(item('fixed'), { key: 'End' });
    expect(document.activeElement).toBe(item('mac'));
    fireEvent.keyDown(item('mac'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(item('fixed'));
    fireEvent.keyDown(item('fixed'), { key: 'Home' });
    expect(document.activeElement).toBe(item('notes'));
  });

  it('stays put at the ends', () => {
    setup();
    fireEvent.keyDown(item('notes'), { key: 'ArrowLeft' });
    expect(item('notes').getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(item('notes'), { key: 'End' });
    fireEvent.keyDown(item('mac'), { key: 'ArrowRight' });
    expect(item('mac').getAttribute('tabindex')).toBe('0');
  });

  it('opens the focused icon with Enter or Space', () => {
    const { manager } = setup();
    fireEvent.keyDown(item('notes'), { key: 'Enter' });
    expect(Object.values(manager.getState().windows).map((win) => win.appId)).toEqual(['notes']);
    fireEvent.keyDown(item('notes'), { key: ' ' });
    expect(Object.keys(manager.getState().windows)).toHaveLength(2);
  });

  it('follows focus that arrives by other means', () => {
    setup();
    fireEvent.focus(item('mac'));
    expect(item('mac').getAttribute('tabindex')).toBe('0');
  });
});

describe('useDesktopIcons: opening', () => {
  it('opens an app on double-click', () => {
    const { manager } = setup();
    fireEvent.doubleClick(item('fixed'));
    expect(Object.values(manager.getState().windows)[0]?.appId).toBe('fixed');
  });

  it('only selects on a single click', () => {
    const { manager } = setup();
    fireEvent.click(item('mac'));
    expect(item('mac').getAttribute('aria-selected')).toBe('true');
    expect(Object.keys(manager.getState().windows)).toHaveLength(0);
  });
});

describe('useDesktopIcons: drag to reorder', () => {
  it('moves an icon to the place of the icon it is dropped on', () => {
    const { manager } = setup();
    giveBoxes();
    fireEvent.pointerDown(item('notes'), { ...pointer, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(item('notes'), { ...pointer, clientX: 130, clientY: 10 });
    expect(item('notes').hasAttribute('data-dragging')).toBe(true);
    expect(item('mac').hasAttribute('data-drop-target')).toBe(true);

    fireEvent.pointerUp(item('notes'), pointer);
    expect(manager.getState().iconOrder).toEqual(['fixed', 'mac', 'notes']);
    expect(item('notes').hasAttribute('data-dragging')).toBe(false);
  });

  it('moves an icon backwards', () => {
    const { manager } = setup();
    giveBoxes();
    fireEvent.pointerDown(item('mac'), { ...pointer, clientX: 130, clientY: 10 });
    fireEvent.pointerMove(item('mac'), { ...pointer, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(item('mac'), pointer);
    expect(manager.getState().iconOrder).toEqual(['mac', 'notes', 'fixed']);
  });

  it('does nothing when dropped on empty space', () => {
    const { manager } = setup();
    giveBoxes();
    fireEvent.pointerDown(item('notes'), { ...pointer, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(item('notes'), { ...pointer, clientX: 500, clientY: 500 });
    fireEvent.pointerUp(item('notes'), pointer);
    expect(manager.getState().iconOrder).toEqual(['notes', 'fixed', 'mac']);
  });

  it('does nothing when the pointer barely moves or the drag is cancelled', () => {
    const { manager } = setup();
    giveBoxes();
    fireEvent.pointerDown(item('notes'), { ...pointer, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(item('notes'), { ...pointer, clientX: 11, clientY: 10 });
    fireEvent.pointerUp(item('notes'), pointer);
    expect(manager.getState().iconOrder).toEqual(['notes', 'fixed', 'mac']);

    fireEvent.pointerDown(item('notes'), { ...pointer, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(item('notes'), { ...pointer, clientX: 130, clientY: 10 });
    fireEvent.pointerCancel(item('notes'), pointer);
    expect(manager.getState().iconOrder).toEqual(['notes', 'fixed', 'mac']);
    expect(item('notes').hasAttribute('data-dragging')).toBe(false);
  });
});
