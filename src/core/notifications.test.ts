import { describe, expect, it, vi } from 'vitest';
import { createWindowManager } from './createWindowManager';
import type { AppDefinition, WindowManager } from './types';

const apps: AppDefinition[] = [
  { id: 'notes', title: 'Notes' },
  { id: 'terminal', title: 'Terminal' },
];

function setup(now?: () => number): WindowManager {
  const manager = createWindowManager({ apps, ...(now ? { now } : {}) });
  manager.setViewport({ width: 1000, height: 700 });
  return manager;
}

describe('tray items', () => {
  it('registers an item and removes it with the returned function', () => {
    const manager = setup();
    const unregister = manager.registerTrayItem({ id: 'sync', label: 'Sync' });
    expect(manager.getState().tray).toEqual([{ id: 'sync', label: 'Sync' }]);
    unregister();
    expect(manager.getState().tray).toEqual([]);
  });

  it('keeps registration order', () => {
    const manager = setup();
    manager.registerTrayItem({ id: 'a', label: 'A' });
    manager.registerTrayItem({ id: 'b', label: 'B' });
    expect(manager.getState().tray.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('replaces an item with the same id, moving it to the end', () => {
    const manager = setup();
    manager.registerTrayItem({ id: 'a', label: 'A' });
    manager.registerTrayItem({ id: 'b', label: 'B' });
    manager.registerTrayItem({ id: 'a', label: 'A2' });
    expect(manager.getState().tray.map((item) => item.label)).toEqual(['B', 'A2']);
  });

  it('ignores an old unregister function once the item was registered again', () => {
    const manager = setup();
    const first = manager.registerTrayItem({ id: 'a', label: 'First' });
    manager.registerTrayItem({ id: 'a', label: 'Second' });
    first();
    expect(manager.getState().tray.map((item) => item.label)).toEqual(['Second']);
  });

  it('does nothing when unregistering twice', () => {
    const manager = setup();
    const unregister = manager.registerTrayItem({ id: 'a', label: 'A' });
    unregister();
    const listener = vi.fn();
    manager.subscribe(listener);
    unregister();
    expect(listener).not.toHaveBeenCalled();
  });

  it('updates an item but never its id', () => {
    const manager = setup();
    manager.registerTrayItem({ id: 'sync', label: 'Sync' });
    manager.updateTrayItem('sync', { badge: 3, label: 'Syncing', id: 'other' });
    expect(manager.getState().tray).toEqual([{ id: 'sync', label: 'Syncing', badge: 3 }]);
  });

  it('ignores an update to an unknown item or one that changes nothing', () => {
    const manager = setup();
    manager.registerTrayItem({ id: 'sync', label: 'Sync' });
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.updateTrayItem('missing', { label: 'x' });
    manager.updateTrayItem('sync', { label: 'Sync' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies subscribers and replaces the state object on a change', () => {
    const manager = setup();
    const before = manager.getState();
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.registerTrayItem({ id: 'a', label: 'A' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(manager.getState()).not.toBe(before);
  });

  it('is not part of the saved layout', () => {
    const manager = setup();
    manager.registerTrayItem({ id: 'a', label: 'A' });
    expect(JSON.stringify(manager.serialize())).not.toContain('"tray"');
  });
});

describe('notifications', () => {
  it('adds an unread notification, newest first, with the clock time', () => {
    let time = 1000;
    const manager = setup(() => time);
    const first = manager.notify({ title: 'First' });
    time = 2000;
    const second = manager.notify({ title: 'Second', body: 'Details', level: 'warning' });
    expect(first).not.toBe(second);
    expect(manager.getState().notifications).toEqual([
      {
        id: second,
        title: 'Second',
        body: 'Details',
        level: 'warning',
        createdAt: 2000,
        read: false,
      },
      { id: first, title: 'First', createdAt: 1000, read: false },
    ]);
  });

  it('defaults the clock to Date.now', () => {
    const manager = setup();
    const before = Date.now();
    manager.notify({ title: 'Now' });
    const createdAt = manager.getState().notifications[0]?.createdAt ?? 0;
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(Date.now());
  });

  it('keeps the app and the action', () => {
    const manager = setup();
    manager.notify({
      appId: 'notes',
      title: 'Saved',
      action: { label: 'Open', open: { appId: 'notes' } },
    });
    const [entry] = manager.getState().notifications;
    expect(entry?.appId).toBe('notes');
    expect(entry?.action).toEqual({ label: 'Open', open: { appId: 'notes' } });
  });

  it('emits the notification event after the state changed', () => {
    const manager = setup();
    const seen: number[] = [];
    manager.on('notification', ({ notification }) => {
      seen.push(manager.getState().notifications.length);
      expect(notification.title).toBe('Hello');
    });
    const id = manager.notify({ title: 'Hello' });
    expect(seen).toEqual([1]);
    expect(manager.getState().notifications[0]?.id).toBe(id);
  });

  it('marks one notification as read', () => {
    const manager = setup();
    const a = manager.notify({ title: 'A' });
    const b = manager.notify({ title: 'B' });
    manager.markRead(a);
    const byId = Object.fromEntries(manager.getState().notifications.map((n) => [n.id, n.read]));
    expect(byId).toEqual({ [a]: true, [b]: false });
  });

  it('marks every notification as read', () => {
    const manager = setup();
    manager.notify({ title: 'A' });
    manager.notify({ title: 'B' });
    manager.markRead('all');
    expect(manager.getState().notifications.every((n) => n.read)).toBe(true);
  });

  it('does not notify subscribers when there is nothing to mark', () => {
    const manager = setup();
    const id = manager.notify({ title: 'A' });
    manager.markRead(id);
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.markRead(id);
    manager.markRead('all');
    manager.markRead('missing');
    expect(listener).not.toHaveBeenCalled();
  });

  it('dismisses one notification and ignores an unknown id', () => {
    const manager = setup();
    const a = manager.notify({ title: 'A' });
    const b = manager.notify({ title: 'B' });
    manager.dismiss(a);
    manager.dismiss('missing');
    expect(manager.getState().notifications.map((n) => n.id)).toEqual([b]);
  });

  it('clears every notification, and does nothing when there are none', () => {
    const manager = setup();
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.clearNotifications();
    expect(listener).not.toHaveBeenCalled();
    manager.notify({ title: 'A' });
    manager.notify({ title: 'B' });
    listener.mockClear();
    manager.clearNotifications();
    expect(manager.getState().notifications).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('is not part of the saved layout and does not trigger a save', async () => {
    vi.useFakeTimers();
    try {
      const save = vi.fn();
      const manager = createWindowManager({
        apps,
        storage: { load: () => null, save },
        saveDebounceMs: 10,
      });
      manager.notify({ title: 'A' });
      manager.registerTrayItem({ id: 'a', label: 'A' });
      await vi.advanceTimersByTimeAsync(50);
      expect(save).not.toHaveBeenCalled();
      expect(JSON.stringify(manager.serialize())).not.toContain('notifications');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('wallpapers', () => {
  it('sets and clears the wallpaper of a desktop', () => {
    const manager = createWindowManager({ apps, desktops: [{ id: 'main', name: 'Main' }] });
    manager.setWallpaper('main', { type: 'gradient', value: 'linear-gradient(red, blue)' });
    expect(manager.getState().desktops[0]?.wallpaper).toEqual({
      type: 'gradient',
      value: 'linear-gradient(red, blue)',
    });
    manager.setWallpaper('main', null);
    expect(manager.getState().desktops[0]?.wallpaper).toBeNull();
  });

  it('keeps a wallpaper through serialize and restoreLayout', () => {
    const manager = createWindowManager({ apps, desktops: [{ id: 'main', name: 'Main' }] });
    manager.setWallpaper('main', {
      type: 'image',
      url: 'https://example.com/a.png',
      fit: 'contain',
    });
    const snapshot = manager.serialize();
    manager.setWallpaper('main', null);
    manager.restoreLayout(snapshot);
    expect(manager.getState().desktops[0]?.wallpaper).toEqual({
      type: 'image',
      url: 'https://example.com/a.png',
      fit: 'contain',
    });
  });
});
