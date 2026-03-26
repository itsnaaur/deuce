"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebarNav, AppTabBar } from "@/components/navigation/main-nav";
import { usePerformanceMode } from "@/hooks/use-performance-mode";
import { isIOSLikeDevice, isStandaloneAppDisplay } from "@/lib/platform";

const STORAGE_KEY = "deuce-sidebar-collapsed";
const IOS_INSTALL_HINT_DISMISSED_KEY = "deuce-ios-install-hint-dismissed";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const { reducedMotion } = usePerformanceMode();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showIosInstallHint, setShowIosInstallHint] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const isIOSLike = isIOSLikeDevice();
      const isStandalone = isStandaloneAppDisplay();
      const dismissed = localStorage.getItem(IOS_INSTALL_HINT_DISMISSED_KEY) === "1";
      setShowIosInstallHint(isIOSLike && !isStandalone && !dismissed);
    } catch {
      // ignore platform detection failures
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, mounted]);

  useEffect(() => {
    if (!mounted) return;
    // Warm key routes while online so iOS offline navigation works after first load.
    router.prefetch("/");
    router.prefetch("/queue");
    router.prefetch("/war-room");
    router.prefetch("/analytics");
  }, [mounted, router]);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.setAttribute("data-mobile-performance", reducedMotion ? "1" : "0");
    return () => {
      root.removeAttribute("data-mobile-performance");
    };
  }, [mounted, reducedMotion]);

  const toggle = () => setCollapsed((c) => !c);

  /* Sidebar only at `2xl+`; inset padding applies only when the rail is visible */
  const mainInset = collapsed ? "2xl:pl-[4.5rem]" : "2xl:pl-60";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
      <AppSidebarNav collapsed={collapsed} onToggle={toggle} />
      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-(--canvas) pb-[calc(5.25rem+env(safe-area-inset-bottom))] ${reducedMotion ? "" : "transition-[padding] duration-200 ease-out"} 2xl:pb-0 ${mainInset}`}
      >
        {children}
      </div>
      <AppTabBar />
      {showIosInstallHint ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-60 flex justify-center px-4 2xl:bottom-4">
          <div className="pointer-events-auto w-full max-w-md rounded-xl border border-(--border) bg-(--surface) px-3 py-2 shadow-(--shadow-soft)">
            <p className="text-center text-xs text-(--text-2)">
              iPhone/iPad install: tap Share, then{" "}
              <span className="font-semibold text-(--accent-on-light)">Add to Home Screen</span>.
            </p>
            <button
              type="button"
              className="mx-auto mt-1 block text-[11px] font-semibold text-(--text-muted) hover:text-(--text)"
              onClick={() => {
                setShowIosInstallHint(false);
                try {
                  localStorage.setItem(IOS_INSTALL_HINT_DISMISSED_KEY, "1");
                } catch {
                  // ignore localStorage failures
                }
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
