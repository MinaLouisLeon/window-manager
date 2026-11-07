import type { AppId, WindowId } from './types';

/** Who a message is for: one window, or every window (and listener) of an app. */
export type MessageTarget = { windowId: WindowId } | { appId: AppId };

/** Receives a message and the id of the window that sent it (null when it came from outside). */
export type MessageHandler = (message: unknown, from: WindowId | null) => void;

/** Keeps the message handlers of windows and apps. */
export interface MessageBus {
  /** Registers a handler; returns a function that removes it. */
  subscribe(target: MessageTarget, handler: MessageHandler): () => void;
  /** The handlers registered for exactly this target, in registration order. */
  handlersFor(target: MessageTarget): MessageHandler[];
  /** Removes every handler registered for a window (it was closed). */
  dropWindow(windowId: WindowId): void;
  /** Removes every handler. */
  clear(): void;
}

function keyOf(target: MessageTarget): string {
  return 'windowId' in target ? `window:${target.windowId}` : `app:${target.appId}`;
}

/** Creates an empty message bus. */
export function createMessageBus(): MessageBus {
  const handlers = new Map<string, Set<MessageHandler>>();
  return {
    subscribe(target, handler) {
      const key = keyOf(target);
      let set = handlers.get(key);
      if (!set) {
        set = new Set();
        handlers.set(key, set);
      }
      // A new wrapper per registration, so the same function can be registered twice.
      const entry: MessageHandler = (message, from) => handler(message, from);
      set.add(entry);
      return () => {
        const current = handlers.get(key);
        current?.delete(entry);
        if (current?.size === 0) handlers.delete(key);
      };
    },
    handlersFor(target) {
      return [...(handlers.get(keyOf(target)) ?? [])];
    },
    dropWindow(windowId) {
      handlers.delete(keyOf({ windowId }));
    },
    clear() {
      handlers.clear();
    },
  };
}
