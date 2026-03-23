import { useSyncExternalStore } from "react";

type Listener = () => void;

export interface ReadableStore<T> {
  getSnapshot: () => T;
  subscribe: (listener: Listener) => () => void;
}

export interface WritableStore<T> extends ReadableStore<T> {
  setState: (next: T | ((prev: T) => T)) => void;
}

export function createStore<T>(initialState: T): WritableStore<T> {
  let state = initialState;
  const listeners = new Set<Listener>();

  const getSnapshot = () => state;

  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const setState = (next: T | ((prev: T) => T)) => {
    state = typeof next === "function" ? (next as (prev: T) => T)(state) : next;
    listeners.forEach((listener) => listener());
  };

  return { getSnapshot, subscribe, setState };
}

export function useStoreSnapshot<T>(store: ReadableStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
