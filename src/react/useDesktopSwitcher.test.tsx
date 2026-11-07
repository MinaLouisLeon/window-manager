import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import { useDesktopSwitcher } from './useDesktopSwitcher';

function setup() {
  const manager = createTestManager();
  const { result } = renderHook(() => useDesktopSwitcher(), { wrapper: createWrapper(manager) });
  return { manager, result };
}

describe('useDesktopSwitcher', () => {
  it('lists desktops with their window counts and the active one', () => {
    const { manager, result } = setup();
    let second = '';
    act(() => {
      second = manager.addDesktop('Work');
      const parent = manager.open({ appId: 'notes' });
      manager.open({ appId: 'notes', parentId: parent });
      manager.open({ appId: 'notes', desktopId: second });
    });

    expect(result.current.desktops).toMatchObject([
      { id: 'desktop-1', name: 'Desktop 1', active: true, windowCount: 2 },
      { id: second, name: 'Work', active: false, windowCount: 1 },
    ]);
    expect(result.current.activeDesktopId).toBe('desktop-1');
  });

  it('adds a desktop and switches to it', () => {
    const { result } = setup();
    let id = '';
    act(() => {
      id = result.current.add({ name: 'Play' });
    });
    expect(result.current.activeDesktopId).toBe(id);
    expect(result.current.desktops.map((desktop) => desktop.name)).toEqual(['Desktop 1', 'Play']);
  });

  it('adds without switching when asked', () => {
    const { result } = setup();
    act(() => {
      result.current.add({ switchTo: false });
    });
    expect(result.current.activeDesktopId).toBe('desktop-1');
    expect(result.current.desktops).toHaveLength(2);
  });

  it('switches desktops', () => {
    const { manager, result } = setup();
    const second = manager.addDesktop();
    act(() => result.current.switchTo(second));
    expect(result.current.desktops[1]?.active).toBe(true);
  });

  it('renames through start, commit and cancel', () => {
    const { result } = setup();
    act(() => result.current.startRename('desktop-1'));
    expect(result.current.editingId).toBe('desktop-1');
    act(() => result.current.commitRename('  Home  '));
    expect(result.current.editingId).toBeNull();
    expect(result.current.desktops[0]?.name).toBe('Home');

    act(() => result.current.startRename('desktop-1'));
    act(() => result.current.cancelRename());
    expect(result.current.editingId).toBeNull();
    expect(result.current.desktops[0]?.name).toBe('Home');
  });

  it('keeps the old name when the new one is empty', () => {
    const { result } = setup();
    act(() => result.current.startRename('desktop-1'));
    act(() => result.current.commitRename('   '));
    expect(result.current.desktops[0]?.name).toBe('Desktop 1');
    expect(result.current.editingId).toBeNull();
  });

  it('ignores a commit when nothing is being renamed', () => {
    const { result } = setup();
    act(() => result.current.commitRename('Nope'));
    expect(result.current.desktops[0]?.name).toBe('Desktop 1');
  });

  it('removes a desktop, moving its windows or closing them', async () => {
    const { manager, result } = setup();
    let second = '';
    let third = '';
    let kept = '';
    let lost = '';
    act(() => {
      second = manager.addDesktop();
      third = manager.addDesktop();
      kept = manager.open({ appId: 'notes', desktopId: second });
      lost = manager.open({ appId: 'notes', desktopId: third });
    });
    expect(result.current.canRemove).toBe(true);

    await act(async () => {
      await result.current.remove(second, { moveWindowsTo: 'desktop-1' });
    });
    expect(manager.getState().windows[kept]?.desktopId).toBe('desktop-1');

    await act(async () => {
      await result.current.remove(third);
    });
    expect(manager.getState().windows[lost]).toBeUndefined();
    expect(result.current.desktops).toHaveLength(1);
    expect(result.current.canRemove).toBe(false);
  });

  it('resolves false when a close guard refuses the removal', async () => {
    const { manager, result } = setup();
    const second = manager.addDesktop();
    const id = manager.open({ appId: 'notes', desktopId: second });
    manager.setCloseGuard(id, () => false);
    let removed = true;
    await act(async () => {
      removed = await result.current.remove(second);
    });
    expect(removed).toBe(false);
    expect(result.current.desktops).toHaveLength(2);
  });
});
