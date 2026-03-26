"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StartSessionModal } from "@/components/session/start-session-modal";
import { useDeuceSession } from "@/hooks/use-deuce-session";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function HomeView() {
  const [showStartSessionPrompt, setShowStartSessionPrompt] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOSBrowser, setIsIOSBrowser] = useState(false);
  const [isAndroidBrowser, setIsAndroidBrowser] = useState(false);
  const [isIosHintVisible, setIsIosHintVisible] = useState(false);
  const {
    players,
    waitingPlayers,
    activeCourtsCount,
    courts,
    activePlayersCount,
    playerCompetitionStats,
    livePerformance,
    activeSession,
    startSession,
    endSession,
  } = useDeuceSession();

  const nextUp = waitingPlayers.slice(0, 4);
  const topLeaderboard = players
    .map((player) => ({
      player,
      ...(playerCompetitionStats.get(player.id) ?? { wins: 0, losses: 0, draws: 0, matches: 0, winRate: 0 }),
    }))
    .filter((row) => row.matches > 0)
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || a.player.name.localeCompare(b.player.name))
    .slice(0, 3);

  const handleStartSession = () => {
    if (players.length === 0) {
      void startSession();
      return;
    }
    setShowStartSessionPrompt(true);
  };

  useEffect(() => {
    const evaluateInstallUiState = () => {
      const ua = window.navigator.userAgent.toLowerCase();
      const isIOS = /iphone|ipad|ipod/.test(ua);
      const isAndroid = /android/.test(ua);
      const isIPadOSDesktopUA =
        window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
      const legacyStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      const androidStandalone = window.document.referrer.startsWith("android-app://");
      const displayModeStandalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
        window.matchMedia?.("(display-mode: fullscreen)")?.matches === true ||
        window.matchMedia?.("(display-mode: minimal-ui)")?.matches === true;
      const standalone = legacyStandalone || androidStandalone || displayModeStandalone;
      const iosHintDismissed = localStorage.getItem("deuce-ios-install-hint-dismissed") === "1";

      setIsStandalone(standalone);
      setIsIOSBrowser((isIOS || isIPadOSDesktopUA) && !standalone);
      setIsAndroidBrowser(isAndroid && !standalone);
      setIsIosHintVisible((isIOS || isIPadOSDesktopUA) && !standalone && !iosHintDismissed);
    };

    evaluateInstallUiState();

    window.addEventListener("resize", evaluateInstallUiState);
    window.addEventListener("orientationchange", evaluateInstallUiState);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    return () => {
      window.removeEventListener("resize", evaluateInstallUiState);
      window.removeEventListener("orientationchange", evaluateInstallUiState);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      setDeferredInstallPrompt(null);
      return;
    }

    if (isIOSBrowser) {
      setShowInstallHelp(true);
      return;
    }

    if (isAndroidBrowser) {
      setShowInstallHelp(true);
      return;
    }

    setShowInstallHelp(true);
  };

  const shouldShowInstallButton = !isStandalone;
  const installButtonPositionClass = isIosHintVisible
    ? "top-4 right-4 md:top-5 md:right-5"
    : "bottom-[calc(5.7rem+env(safe-area-inset-bottom))] right-4 md:bottom-[calc(6.6rem+env(safe-area-inset-bottom))] md:right-6";

  return (
    <div className="deuce-canvas relative flex min-h-full flex-1 flex-col">
      <div className="page-shell">
        <header className="page-header">
          <div className="mx-auto max-w-3xl text-center">
            <Image
              src="/branding/deuce-word-logo.png"
              alt="Deuce"
              width={360}
              height={96}
              className="page-logo mx-auto"
              priority
            />
            <p className="page-kicker">
              Session overview
            </p>
            <h1 className="page-title font-display text-4xl font-bold tracking-tight md:text-5xl 2xl:text-4xl">
              Dashboard
            </h1>
            <p className="mt-3 text-base leading-relaxed text-(--text-2) md:text-lg 2xl:text-base">
              Session command center: quick stats, next queue, and fast links into roster and courts.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-(--surface) px-3 py-1 text-xs font-semibold text-(--text-2)">
              {activeSession ? activeSession.name : "No active session"}
            </span>
            {activeSession ? (
              <button type="button" className="btn-court-end px-4 py-2 text-xs" onClick={() => void endSession()}>
                End session
              </button>
            ) : (
              <button type="button" className="btn-court-primary px-4 py-2 text-xs" onClick={handleStartSession}>
                Start session
              </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-4">
          <StatCard label="Roster" value={String(players.length)} hint="total players" />
          <StatCard label="Active" value={String(activePlayersCount)} hint="in rotation" />
          <StatCard label="Waiting" value={String(waitingPlayers.length)} hint="fair queue" />
          <StatCard
            label="Live courts"
            value={`${activeCourtsCount}/${Math.max(courts.length, 1)}`}
            hint="matches running"
          />
        </div>

        <section className="mt-8 2xl:mt-10">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-(--text-muted) 2xl:text-xs 2xl:tracking-[0.2em]">
            Next up
          </h2>
          {nextUp.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-(--border) bg-(--surface) px-4 py-8 text-center text-sm text-(--text-muted)">
              Queue is empty — add players in{" "}
              <Link href="/queue" className="font-semibold text-(--accent-on-light) underline-offset-2 hover:underline">
                The Roster
              </Link>
              .
            </p>
          ) : (
            <ol className="mt-3 space-y-2">
              {nextUp.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-2xl border border-(--border) bg-(--surface) px-4 py-3 shadow-(--shadow-soft)"
                >
                  <span className="text-sm font-semibold text-(--text)">{p.name}</span>
                  <span className="text-xs font-bold tabular-nums text-(--text-muted)">
                    #{i + 1}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-8 2xl:mt-10">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-(--text-muted) 2xl:text-xs 2xl:tracking-[0.2em]">
            Current leaderboard
          </h2>
          {topLeaderboard.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-(--border) bg-(--surface) px-4 py-8 text-center text-sm text-(--text-muted)">
              No completed matches yet.
            </p>
          ) : (
            <ol className="mt-3 space-y-2">
              {topLeaderboard.map((row, i) => (
                <li
                  key={row.player.id}
                  className="flex items-center justify-between rounded-2xl border border-(--border) bg-(--surface) px-4 py-3 shadow-(--shadow-soft)"
                >
                  <span className="text-sm font-semibold text-(--text)">
                    #{i + 1} {row.player.name}
                    {(livePerformance.winStreaks.find((entry) => entry.player.id === row.player.id)?.streak ?? 0) >= 3
                      ? " 🔥"
                      : ""}
                  </span>
                  <span className="text-xs font-bold tabular-nums text-(--text-muted)">{row.winRate}%</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="mt-8 2xl:mt-10">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-(--text-muted) 2xl:text-xs 2xl:tracking-[0.2em]">
            Live performance
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <article className="rounded-2xl border border-(--border) bg-(--surface) p-4 shadow-(--shadow-soft)">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-(--text-muted)">Win streaks</p>
              {livePerformance.winStreaks.length === 0 ? (
                <p className="mt-2 text-sm text-(--text-2)">No 3+ streaks yet.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-(--text)">
                  {livePerformance.winStreaks.slice(0, 3).map((entry) => (
                    <li key={entry.player.id}>
                      🔥 {entry.player.name} ({entry.streak})
                    </li>
                  ))}
                </ul>
              )}
            </article>
            <article className="rounded-2xl border border-(--border) bg-(--surface) p-4 shadow-(--shadow-soft)">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-(--text-muted)">Giant killer</p>
              {livePerformance.giantKiller ? (
                <p className="mt-2 text-sm text-(--text)">
                  {livePerformance.giantKiller.names.join(" / ")} upset higher-skill opponents ({livePerformance.giantKiller.score}).
                </p>
              ) : (
                <p className="mt-2 text-sm text-(--text-2)">No upset detected yet.</p>
              )}
            </article>
            <article className="rounded-2xl border border-(--border) bg-(--surface) p-4 shadow-(--shadow-soft)">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-(--text-muted)">Session MVP</p>
              {livePerformance.mvp ? (
                <p className="mt-2 text-sm text-(--text)">
                  {livePerformance.mvp.player.name} ({livePerformance.mvp.pointSpread >= 0 ? "+" : ""}
                  {livePerformance.mvp.pointSpread} point spread)
                </p>
              ) : (
                <p className="mt-2 text-sm text-(--text-2)">No MVP yet.</p>
              )}
            </article>
          </div>
        </section>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/queue"
            className="btn-court-primary flex flex-1 items-center justify-center py-3.5 text-sm"
          >
            Quick start · Roster
          </Link>
          <Link
            href="/war-room"
            className="flex flex-1 items-center justify-center rounded-xl border border-(--border) bg-(--surface) py-3.5 text-sm font-semibold text-(--accent-on-light) shadow-(--shadow-soft) transition hover:bg-(--surface-2)"
          >
            Quick start · Courts
          </Link>
        </div>
      </div>
      {shouldShowInstallButton ? (
        <button
          type="button"
          onClick={() => void handleInstallClick()}
          className={`fixed z-80 inline-flex h-11 w-11 items-center justify-center rounded-full bg-(--accent-on-light) text-white shadow-[0_10px_32px_rgba(12,35,64,0.38)] ring-2 ring-white/70 transition hover:brightness-110 md:h-12 md:w-12 2xl:hidden ${installButtonPositionClass}`}
          aria-label="Install app"
          title="Install app"
        >
          <svg className="h-5 w-5 md:h-6 md:w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v11m0 0 4-4m-4 4-4-4M4 17v1.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V17" />
          </svg>
        </button>
      ) : null}
      <StartSessionModal
        open={showStartSessionPrompt}
        playerCount={players.length}
        onClose={() => setShowStartSessionPrompt(false)}
        onKeepPlayers={() => {
          setShowStartSessionPrompt(false);
          void startSession({ clearPlayers: false });
        }}
        onClearPlayers={() => {
          setShowStartSessionPrompt(false);
          void startSession({ clearPlayers: true });
        }}
      />
      {showInstallHelp ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-(--border) bg-(--surface) p-5 shadow-(--shadow-lift)">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--text-muted)">
              {isAndroidBrowser ? "Install on Android" : "Install on iPhone/iPad"}
            </p>
            <p className="mt-3 text-sm text-(--text-2)">
              {isAndroidBrowser ? (
                <>
                  Tap your browser menu (<span className="font-semibold text-(--text)">3 dots</span>) and choose{" "}
                  <span className="font-semibold text-(--text)">Install app</span> or{" "}
                  <span className="font-semibold text-(--text)">Add to Home screen</span>.
                </>
              ) : (
                <>
                  Tap <span className="font-semibold text-(--text)">Share</span> in Safari, then choose{" "}
                  <span className="font-semibold text-(--text)">Add to Home Screen</span>.
                </>
              )}
            </p>
            <button
              type="button"
              className="btn-canvas-ghost mt-4 w-full px-4 py-2.5 text-sm"
              onClick={() => setShowInstallHelp(false)}
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card-elevated flex flex-col gap-1 p-4">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-(--text-muted)">
        {label}
      </span>
      <span className="font-display text-2xl font-bold tabular-nums text-(--accent-on-light)">
        {value}
      </span>
      <span className="text-[11px] text-(--text-2)">{hint}</span>
    </div>
  );
}
