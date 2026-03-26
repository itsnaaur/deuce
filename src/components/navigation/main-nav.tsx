"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/",
    label: "Dashboard",
    shortLabel: "Dash",
    icon: HomeIcon,
  },
  {
    href: "/queue",
    label: "The Roster",
    shortLabel: "Roster",
    icon: QueueIcon,
  },
  {
    href: "/war-room",
    label: "Courts",
    shortLabel: "Courts",
    icon: WarRoomIcon,
  },
  {
    href: "/analytics",
    label: "Analytics",
    shortLabel: "Stats",
    icon: AnalyticsIcon,
  },
] as const;

function isRouteActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/" || pathname === "";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-6 w-6 md:h-7 md:w-7"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={active ? 2.25 : 1.75}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}

function QueueIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-6 w-6 md:h-7 md:w-7"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={active ? 2.25 : 1.75}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
      />
    </svg>
  );
}

function WarRoomIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-6 w-6 md:h-7 md:w-7"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={active ? 2.25 : 1.75}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 0 1 6 3.75h3.75a2.25 2.25 0 0 1 2.25 2.25v3.75a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 9.75V6ZM3.75 15A2.25 2.25 0 0 1 6 12.75h3.75a2.25 2.25 0 0 1 2.25 2.25v3.75a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V15ZM12.75 6a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25v3.75A2.25 2.25 0 0 1 18 9.75h-3.75A2.25 2.25 0 0 1 12 7.5V6ZM12.75 15a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25v3.75a2.25 2.25 0 0 1-2.25 2.25h-3.75a2.25 2.25 0 0 1-2.25-2.25V15Z"
      />
    </svg>
  );
}

function AnalyticsIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-6 w-6 md:h-7 md:w-7"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={active ? 2.25 : 1.75}
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5h15M7.5 16.5V10.5M12 16.5V6.75M16.5 16.5V12.75" />
    </svg>
  );
}

/** Bottom bar — phones, tablets, iPad (hidden on wide desktop where the sidebar shows) */
export function AppTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-(--border) bg-(--surface)/95 backdrop-blur-md pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_32px_rgba(5,11,20,0.08)] 2xl:hidden"
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around px-3 sm:px-6">
        {tabs.map((tab) => {
          const active = isRouteActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex flex-1 justify-center">
              <Link
                href={tab.href}
                className={`flex min-h-13 min-w-18 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors sm:px-5 ${
                  active
                    ? "text-(--accent-on-light)"
                    : "text-(--text-muted) hover:text-(--text-2)"
                }`}
              >
                <span className={active ? "text-(--accent-on-light)" : "text-current"}>
                  <Icon active={active} />
                </span>
                <span className="max-w-20 truncate text-center sm:max-w-none">{tab.shortLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Left rail — tablets, iPad, and desktop (collapsible on md+) */
export function AppSidebarNav({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 hidden h-full flex-col border-r border-(--shell-line) bg-linear-to-b from-(--shell-mid) to-(--shell) pt-[max(1rem,env(safe-area-inset-top))] shadow-[4px_0_32px_rgba(5,11,20,0.15)] transition-[width] duration-200 ease-out 2xl:flex ${
        collapsed ? "w-18" : "w-52 lg:w-60"
      }`}
      aria-label="Main"
    >
      <div className={`shrink-0 pb-4 ${collapsed ? "flex justify-center px-1 pt-1" : "flex flex-col items-center px-4 pb-2 pt-1"}`}>
        {collapsed ? (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 shadow-[0_4px_14px_rgba(5,11,20,0.25)] ring-1 ring-white/70">
            <Image
              src="/branding/deuce-icon-logo.png"
              alt="Deuce icon logo"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              priority
            />
          </span>
        ) : (
          <>
            <span className="mt-1 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1 shadow-[0_4px_14px_rgba(5,11,20,0.25)] ring-1 ring-white/70">
              <Image
                src="/branding/deuce-icon-logo.png"
                alt="Deuce icon logo"
                width={34}
                height={34}
                className="h-8 w-8 object-contain"
                priority
              />
            </span>
          </>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-2">
        {tabs.map((tab) => {
          const active = isRouteActive(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              title={tab.label}
              className={`flex items-center rounded-xl py-3.5 text-sm font-semibold transition-colors lg:py-4 ${
                collapsed ? "justify-center px-2" : "gap-3 px-3 lg:px-4"
              } ${
                active
                  ? "bg-white/12 text-white shadow-inner"
                  : "text-white/65 hover:bg-white/6 hover:text-white"
              }`}
            >
              <span className={`shrink-0 ${active ? "text-white" : "text-white/80"}`}>
                <Icon active={active} />
              </span>
              {!collapsed && <span>{tab.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-white/10 p-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold text-white/70 transition hover:bg-white/8 hover:text-white"
          title={collapsed ? "Expand menu" : "Collapse menu"}
          aria-expanded={!collapsed}
        >
          <span className="sr-only">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
          <svg
            className={`h-5 w-5 transition-transform ${collapsed ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          {!collapsed && <span className="hidden lg:inline">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
