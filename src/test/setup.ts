// In-memory IndexedDB so Dexie works in tests exactly as it does in the browser.
import "fake-indexeddb/auto";

// Newer Node versions define their own `localStorage` global, which is `undefined` unless Node is
// started with a storage file, and it hides jsdom's. Provide an in-memory one when it's missing.
class MemoryStorage implements Storage {
  private items = new Map<string, string>();

  get length() {
    return this.items.size;
  }

  clear() {
    this.items.clear();
  }

  getItem(key: string) {
    return this.items.get(key) ?? null;
  }

  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.items.delete(key);
  }

  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
}

if (typeof window !== "undefined" && typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}
