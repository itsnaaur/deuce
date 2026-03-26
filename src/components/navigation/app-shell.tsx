"use client";

import { useEffect, useState } from "react";
import { AppSidebarNav, AppTabBar } from "@/components/navigation/main-nav";

const STORAGE_KEY = "deuce-sidebar-collapsed";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

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
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, mounted]);

  const toggle = () => setCollapsed((c) => !c);

  /* Sidebar only at `2xl+`; inset padding applies only when the rail is visible */
  const mainInset = collapsed ? "2xl:pl-[4.5rem]" : "2xl:pl-60";

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden">
      <AppSidebarNav collapsed={collapsed} onToggle={toggle} />
      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-[var(--canvas)] pb-[calc(5.25rem+env(safe-area-inset-bottom))] transition-[padding] duration-200 ease-out 2xl:pb-0 ${mainInset}`}
      >
        {children}
      </div>
      <AppTabBar />
    </div>
  );
}
