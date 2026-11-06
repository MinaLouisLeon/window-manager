import { describe, expect, it, vi } from 'vitest';
import { createWindowManager } from './createWindowManager';
import { WindowManagerError } from './errors';
import { createMessageBus } from './messaging';
import type { AppDefinition, WindowManager } from './types';

const apps: AppDefinition[] = [
  { id: 'notes', title: 'Notes' },
  { id: 'terminal', title: 'Terminal' },
];

function setup(): WindowManager {
  const manager = createWindowManager({ apps });
  manager.setViewport({ width: 1000, height: 700 });
  return manager;
}

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof WindowManagerError ? error.code : 'OTHER';
  }
  return undefined;
}

describe('message bus', () => {
  it('registers, lists and removes handlers per target', () => {
    const bus = createMessageBus();
    const a = vi.fn();
    const off = bus.subscribe({ windowId: 'w1' }, a);
    bus.subscribe({ appId: 'notes' }, a);
    expect(bus.handlersFor({ windowId: 'w1' })).toHaveLength(1);
    expect(bus.handlersFor({ appId: 'notes' })).toHaveLength(1);
    expect(bus.handlersFor({ windowId: 'notes' })).toHaveLength(0);
    off();
    off();
    expect(bus.handlersFor({ windowId: 'w1' })).toHaveLength(0);
  });

  it('lets the same function be registered twice and removed separately', () => {
    const bus = createMessageBus();
    const handler = vi.fn();
    const first = bus.subscribe({ appId: 'x' }, handler);
    bus.subscribe({ appId: 'x' }, handler);
    first();
    expect(bus.handlersFor({ appId: 'x' })).toHaveLength(1);
  });

  it('drops a window and clears everything', () => {
    const bus = createMessageBus();
    bus.subscribe({ windowId: 'w1' }, vi.fn());
    bus.subscribe({ appId: 'a' }, vi.fn());
    bus.dropWindow('w1');
    expect(bus.handlersFor({ windowId: 'w1' })).toHaveLength(0);
    expect(bus.handlersFor({ appId: 'a' })).toHaveLength(1);
    bus.clear();
    expect(bus.handlersFor({ appId: 'a' })).toHaveLength(0);
  });
});

describe('send and onMessage', () => {
  it('delivers a message to the listeners of one window only', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const b = manager.open({ appId: 'notes' });
    const forA = vi.fn();
    const forB = vi.fn();
    manager.onMessage({ windowId: a }, forA);
    manager.onMessage({ windowId: b }, forB);
    manager.send({ windowId: a }, { hello: 1 });
    expect(forA).toHaveBeenCalledWith({ hello: 1 }, null);
    expect(forB).not.toHaveBeenCalled();
  });

  it('delivers an app message to app listeners and to every window of that app', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const b = manager.open({ appId: 'notes' });
    const other = manager.open({ appId: 'terminal' });
    const appListener = vi.fn();
    const forA = vi.fn();
    const forB = vi.fn();
    const forOther = vi.fn();
    manager.onMessage({ appId: 'notes' }, appListener);
    manager.onMessage({ windowId: a }, forA);
    manager.onMessage({ windowId: b }, forB);
    manager.onMessage({ windowId: other }, forOther);
    manager.send({ appId: 'notes' }, 'ping');
    expect(appListener).toHaveBeenCalledWith('ping', null);
    expect(forA).toHaveBeenCalledWith('ping', null);
    expect(forB).toHaveBeenCalledWith('ping', null);
    expect(forOther).not.toHaveBeenCalled();
  });

  it('passes the sending window to the listeners and the message event', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const b = manager.open({ appId: 'terminal' });
    const handler = vi.fn();
    const seen = vi.fn();
    manager.onMessage({ windowId: a }, handler);
    manager.on('message', seen);
    manager.send({ windowId: a }, 'hi', { from: b });
    manager.send({ windowId: a }, 'again', {});
    expect(handler).toHaveBeenNthCalledWith(1, 'hi', b);
    expect(handler).toHaveBeenNthCalledWith(2, 'again', null);
    expect(seen).toHaveBeenNthCalledWith(1, {
      target: { windowId: a },
      message: 'hi',
      from: b,
    });
  });

  it('throws for an unknown sender and delivers nothing', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const handler = vi.fn();
    manager.onMessage({ windowId: a }, handler);
    expect(codeOf(() => manager.send({ windowId: a }, 1, { from: 'nope' }))).toBe('UNKNOWN_WINDOW');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not deliver a window message to the listeners of its app', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const appListener = vi.fn();
    manager.onMessage({ appId: 'notes' }, appListener);
    manager.send({ windowId: a }, 1);
    expect(appListener).not.toHaveBeenCalled();
  });

  it('drops messages nobody listens to, and stops after unsubscribe', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    expect(() => manager.send({ windowId: a }, 1)).not.toThrow();
    const handler = vi.fn();
    const off = manager.onMessage({ windowId: a }, handler);
    manager.send({ windowId: a }, 2);
    off();
    manager.send({ windowId: a }, 3);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(2, null);
  });

  it('removes the listeners of a window when it closes', async () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const handler = vi.fn();
    manager.onMessage({ windowId: a }, handler);
    await manager.close(a);
    expect(codeOf(() => manager.send({ windowId: a }, 1))).toBe('UNKNOWN_WINDOW');
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps app listeners when windows close', async () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const handler = vi.fn();
    manager.onMessage({ appId: 'notes' }, handler);
    await manager.close(a);
    manager.send({ appId: 'notes' }, 'still here');
    expect(handler).toHaveBeenCalledWith('still here', null);
  });

  it('emits a message event with the target, message and sender', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const seen = vi.fn();
    manager.on('message', seen);
    manager.send({ windowId: a }, { n: 1 });
    manager.send({ appId: 'terminal' }, 'x');
    expect(seen).toHaveBeenNthCalledWith(1, {
      target: { windowId: a },
      message: { n: 1 },
      from: null,
    });
    expect(seen).toHaveBeenNthCalledWith(2, {
      target: { appId: 'terminal' },
      message: 'x',
      from: null,
    });
  });

  it('delivers to every listener even when one unsubscribes while handling', () => {
    const manager = setup();
    const a = manager.open({ appId: 'notes' });
    const calls: string[] = [];
    const off = manager.onMessage({ windowId: a }, () => {
      calls.push('first');
      off();
    });
    manager.onMessage({ windowId: a }, () => calls.push('second'));
    manager.send({ windowId: a }, 1);
    manager.send({ windowId: a }, 2);
    expect(calls).toEqual(['first', 'second', 'second']);
  });

  it('throws for unknown windows and apps', () => {
    const manager = setup();
    expect(codeOf(() => manager.send({ windowId: 'nope' }, 1))).toBe('UNKNOWN_WINDOW');
    expect(codeOf(() => manager.send({ appId: 'nope' }, 1))).toBe('UNKNOWN_APP');
    expect(codeOf(() => manager.onMessage({ windowId: 'nope' }, vi.fn()))).toBe('UNKNOWN_WINDOW');
    expect(codeOf(() => manager.onMessage({ appId: 'nope' }, vi.fn()))).toBe('UNKNOWN_APP');
  });

  it('destroy removes the listeners', () => {
    const manager = setup();
    const handler = vi.fn();
    manager.onMessage({ appId: 'notes' }, handler);
    manager.destroy();
    manager.send({ appId: 'notes' }, 1);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('deep links', () => {
  const linkApps: AppDefinition[] = [
    { id: 'notes', title: 'Notes' },
    { id: 'files', title: 'Files', defaultData: { folder: '/', view: 'list' } },
    { id: 'once', title: 'Once', instances: { single: true } },
    { id: 'two', title: 'Two', instances: { max: 1 }, defaultData: 'text' },
  ];
  function link(): WindowManager {
    const manager = createWindowManager({ apps: linkApps });
    manager.setViewport({ width: 1000, height: 700 });
    return manager;
  }

  it('opens an app from a query string, a full URL, a URL object or URLSearchParams', () => {
    const manager = link();
    const ids = [
      manager.openFromUrl('?open=notes'),
      manager.openFromUrl('open=notes'),
      manager.openFromUrl('https://example.com/app?open=notes#top'),
      manager.openFromUrl(new URL('https://example.com/?open=notes')),
      manager.openFromUrl(new URLSearchParams({ open: 'notes' })),
    ];
    expect(new Set(ids).size).toBe(5);
    for (const id of ids) expect(manager.getState().windows[id as string]?.appId).toBe('notes');
  });

  it('passes the other parameters as data, merged over an object defaultData', () => {
    const manager = link();
    const id = manager.openFromUrl('?open=files&folder=%2Fdocs&tab=2') as string;
    expect(manager.getState().windows[id]?.data).toEqual({
      folder: '/docs',
      view: 'list',
      tab: '2',
    });
    const plain = manager.openFromUrl('?open=notes&q=hi') as string;
    expect(manager.getState().windows[plain]?.data).toEqual({ q: 'hi' });
    const replaced = manager.openFromUrl('?open=two&q=hi') as string;
    expect(manager.getState().windows[replaced]?.data).toEqual({ q: 'hi' });
  });

  it('uses the defaultData when there are no other parameters, and the first of repeated ones', () => {
    const manager = link();
    const id = manager.openFromUrl('?open=files') as string;
    expect(manager.getState().windows[id]?.data).toEqual({ folder: '/', view: 'list' });
    const repeated = manager.openFromUrl('?open=notes&a=1&a=2') as string;
    expect(manager.getState().windows[repeated]?.data).toEqual({ a: '1' });
  });

  it('returns null without an open parameter or for an unknown app', () => {
    const manager = link();
    expect(manager.openFromUrl('?other=1')).toBeNull();
    expect(manager.openFromUrl('')).toBeNull();
    expect(manager.openFromUrl('?open=')).toBeNull();
    expect(manager.openFromUrl('?open=nope')).toBeNull();
    expect(manager.getState().order).toEqual([]);
  });

  it('focuses the existing window of a single-instance app', () => {
    const manager = link();
    const first = manager.openFromUrl('?open=once');
    manager.openFromUrl('?open=notes');
    expect(manager.openFromUrl('?open=once')).toBe(first);
    expect(manager.getState().focusedId).toBe(first);
  });

  it('returns null when the instance limit is reached', () => {
    const manager = link();
    expect(manager.openFromUrl('?open=two')).not.toBeNull();
    expect(manager.openFromUrl('?open=two')).toBeNull();
  });

  it('builds a link for an app or a window, and it opens the same app again', () => {
    const manager = link();
    expect(manager.toUrl({ appId: 'notes' })).toBe('?open=notes');
    const id = manager.open({ appId: 'files' });
    expect(manager.toUrl({ windowId: id }, { folder: '/a b', tab: '1' })).toBe(
      '?open=files&folder=%2Fa+b&tab=1',
    );
    const again = manager.openFromUrl(manager.toUrl({ appId: 'files' }, { folder: '/a b' }));
    expect(manager.getState().windows[again as string]?.data).toEqual({
      folder: '/a b',
      view: 'list',
    });
  });

  it('ignores an `open` key in the parameters', () => {
    const manager = link();
    expect(manager.toUrl({ appId: 'notes' }, { open: 'files', x: '1' })).toBe('?open=notes&x=1');
  });

  it('throws for unknown targets', () => {
    const manager = link();
    expect(codeOf(() => manager.toUrl({ windowId: 'nope' }))).toBe('UNKNOWN_WINDOW');
    expect(codeOf(() => manager.toUrl({ appId: 'nope' }))).toBe('UNKNOWN_APP');
  });
});
