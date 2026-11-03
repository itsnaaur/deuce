// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyLocalStorageFlags, useIsClient, useLocalStorageFlag } from "./use-local-storage-flag";

const KEY = "deuce-test-flag";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("useLocalStorageFlag", () => {
  it("reads the stored value", () => {
    localStorage.setItem(KEY, "1");
    const { result } = renderHook(() => useLocalStorageFlag(KEY));
    expect(result.current[0]).toBe(true);
  });

  it("defaults to false when nothing is stored", () => {
    const { result } = renderHook(() => useLocalStorageFlag(KEY));
    expect(result.current[0]).toBe(false);
  });

  it("saves changes and updates every component using the same key", () => {
    const first = renderHook(() => useLocalStorageFlag(KEY));
    const second = renderHook(() => useLocalStorageFlag(KEY));

    act(() => first.result.current[1](true));

    expect(localStorage.getItem(KEY)).toBe("1");
    expect(first.result.current[0]).toBe(true);
    expect(second.result.current[0]).toBe(true);
  });

  it("picks up keys removed directly once notified", () => {
    localStorage.setItem(KEY, "1");
    const { result } = renderHook(() => useLocalStorageFlag(KEY));
    localStorage.removeItem(KEY);
    act(() => notifyLocalStorageFlags());
    expect(result.current[0]).toBe(false);
  });

  it("keeps working when storage is unavailable", () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useLocalStorageFlag(KEY));
    expect(result.current[0]).toBe(false);
    expect(() => act(() => result.current[1](true))).not.toThrow();
  });
});

describe("useIsClient", () => {
  it("is true once rendered in the browser", () => {
    const { result } = renderHook(() => useIsClient());
    expect(result.current).toBe(true);
  });
});
