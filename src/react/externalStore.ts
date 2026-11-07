import { useSyncExternalStore } from 'react';

/** A tiny observable value, used for UI state that several components share. */
export interface ExternalStore<T> {
  get(): T;
  /** Replaces the value (or computes it from the old one); listeners run only on a change. */
  set(next: T | ((previous: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

/** Creates a store holding `initial`. */
export function createExternalStore<T>(initial: T): ExternalStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      const resolved = typeof next === 'function' ? (next as (previous: T) => T)(value) : next;
      if (Object.is(resolved, value)) return;
      value = resolved;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Reads a store and re-renders when it changes. */
export function useExternalStore<T>(store: ExternalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
