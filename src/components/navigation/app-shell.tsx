"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppSidebarNav, AppTabBar } from "@/components/navigation/main-nav";
import { useIsClient, useLocalStorageFlag } from "@/hooks/use-local-storage-flag";
import { usePerformanceMode } from "@/hooks/use-performance-mode";
import { isIOSLikeDevice, isStandaloneAppDisplay } from "@/lib/platform";

const STORAGE_KEY = "deuce-sidebar-collapsed";
const IOS_INSTALL_HINT_DISMISSED_KEY = "deuce-ios-install-hint-dismissed";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const { reducedMotion } = usePerformanceMode();
  const isClient = useIsClient();
  const [collapsed, setCollapsed] = useLocalStorageFlag(STORAGE_KEY);
  const [iosHintDismissed, setIosHintDismissed] = useLocalStorageFlag(IOS_INSTALL_HINT_DISMISSED_KEY);
  const showIosInstallHint = isClient && !iosHintDismissed && isIOSLikeDevice() && !isStandaloneAppDisplay();

  useEffect(() => {
    // Warm key routes while online so iOS offline navigation works after first load.
    router.prefetch("/");
    router.prefetch("/queue");
    router.prefetch("/war-room");
    router.prefetch("/analytics");
  }, [router]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-mobile-performance", reducedMotion ? "1" : "0");
    return () => {
      root.removeAttribute("data-mobile-performance");
    };
  }, [reducedMotion]);

  const toggle = () => setCollapsed(!collapsed);

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
              onClick={() => setIosHintDismissed(true)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
