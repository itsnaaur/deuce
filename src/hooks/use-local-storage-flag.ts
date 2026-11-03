"use client";

import { useCallback, useSyncExternalStore } from "react";

// Same-tab listeners; the browser's "storage" event only fires in other tabs.
const listeners = new Set<() => void>();

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
};

/** Tell every mounted flag to re-read localStorage, e.g. after keys were removed directly. */
export const notifyLocalStorageFlags = () => {
  for (const listener of listeners) {
    listener();
  }
};

const readFlag = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

/**
 * A boolean stored in localStorage as "1"/"0". Reads `false` during server rendering and
 * hydration, then the stored value, without setting state inside an effect.
 */
export function useLocalStorageFlag(key: string): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readFlag(key),
    () => false,
  );

  const setValue = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // Storage can be unavailable (private mode, blocked site data); keep working without it.
      }
      notifyLocalStorageFlags();
    },
    [key],
  );

  return [value, setValue];
}

const subscribeNever = () => () => {};

/** `false` while server rendering and hydrating, `true` once running in the browser. */
export function useIsClient() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
