import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import { useShellAccessibility } from './useShellAccessibility';

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
    callback(0);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function setup() {
  const manager = createTestManager();
  const hook = renderHook(() => useShellAccessibility(), { wrapper: createWrapper(manager) });
  return { manager, hook };
}

describe('useShellAccessibility: announcements', () => {
  it('starts silent', () => {
    expect(setup().hook.result.current.announcement).toBe('');
  });

  it('announces minimize, maximize, fullscreen and restore', () => {
    const { manager, hook } = setup();
    const id = manager.open({ appId: 'notes' });
    act(() => manager.minimize(id));
    expect(hook.result.current.announcement).toBe('Notes minimized');
    act(() => manager.restore(id));
    expect(hook.result.current.announcement).toBe('Notes restored');
    act(() => manager.maximize(id));
    expect(hook.result.current.announcement).toBe('Notes maximized');
    act(() => manager.setFullscreen(id, true));
    expect(hook.result.current.announcement).toBe('Notes fullscreen');
  });

  it('announces a snap with the zone', () => {
    const { manager, hook } = setup();
    const id = manager.open({ appId: 'notes' });
    act(() => manager.snap(id, 'left'));
    expect(hook.result.current.announcement).toBe('Notes snapped left half');
  });

  it('announces a desktop switch by name', () => {
    const { manager, hook } = setup();
    const second = manager.addDesktop('Work');
    act(() => manager.switchDesktop(second));
    expect(hook.result.current.announcement).toBe('Switched to Work');
  });

  it('stops listening on unmount', () => {
    const { manager, hook } = setup();
    const id = manager.open({ appId: 'notes' });
    hook.unmount();
    expect(() => manager.minimize(id)).not.toThrow();
  });
});

describe('useShellAccessibility: focus return', () => {
  function addButton(attributes: Record<string, string>): HTMLButtonElement {
    const button = document.createElement('button');
    for (const [name, value] of Object.entries(attributes)) button.setAttribute(name, value);
    document.body.append(button);
    return button;
  }

  it('moves focus to the app taskbar button after a minimize', () => {
    const { manager } = setup();
    const id = manager.open({ appId: 'notes' });
    const button = addButton({ 'data-wm-taskbar-item': 'notes' });
    act(() => manager.minimize(id));
    expect(document.activeElement).toBe(button);
  });

  it('falls back to the start button when the app has no taskbar button', () => {
    const { manager } = setup();
    const id = manager.open({ appId: 'notes' });
    const start = addButton({ 'data-wm-start-button': '' });
    act(() => manager.minimize(id));
    expect(document.activeElement).toBe(start);
  });

  it('moves focus to the next window after a close', async () => {
    const { manager } = setup();
    const first = manager.open({ appId: 'notes' });
    const second = manager.open({ appId: 'notes' });
    const target = addButton({ 'data-wm-window': '', 'data-window-id': first });
    target.tabIndex = -1;
    await act(async () => {
      await manager.close(second);
    });
    expect(document.activeElement).toBe(target);
  });

  it('does not steal focus that is somewhere useful', () => {
    const { manager } = setup();
    const id = manager.open({ appId: 'notes' });
    addButton({ 'data-wm-taskbar-item': 'notes' });
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    act(() => manager.minimize(id));
    expect(document.activeElement).toBe(input);
  });

  it('moves focus to the focused window after a desktop switch', () => {
    const { manager } = setup();
    const id = manager.open({ appId: 'notes' });
    const target = addButton({ 'data-wm-window': '', 'data-window-id': id });
    const second = manager.addDesktop();
    act(() => manager.switchDesktop(second));
    act(() => manager.switchDesktop(manager.getState().desktops[0]?.id as string));
    expect(document.activeElement).toBe(target);
  });
});
