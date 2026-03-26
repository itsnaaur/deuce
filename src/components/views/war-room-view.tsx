"use client";

import Image from "next/image";
import { LayoutGroup } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { BadmintonCourtView } from "@/components/badminton-court";
import { QueueDrawer } from "@/components/queue/queue-drawer";
import { LiveSidePanel } from "@/components/session/live-side-panel";
import { StartSessionModal } from "@/components/session/start-session-modal";
import { useDeuceSession } from "@/hooks/use-deuce-session";
import { MAX_TEAM_POWER_GAP, getBestBalancedTeams, getPriorityScore, getWaitMinutes } from "@/lib/queue";
import type { Court, Player } from "@/lib/types";

type SuggestionBadge = "Longest Wait" | "Fresh";
type MatchSuggestion = {
  courtId: string;
  courtLabel: string;
  players: [Player, Player, Player, Player];
  badgesByPlayerId: Record<string, SuggestionBadge[]>;
  fairnessScore: number;
  prioritizesWaitTime: boolean;
  reason: string;
};

function CourtSelectorTabs({
  courts,
  selectedIndex,
  onSelect,
}: {
  courts: Court[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  if (courts.length === 0) return null;
  return (
    <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Select court">
      {courts.map((c, i) => {
        const selected = i === selectedIndex;
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
              selected
                ? "border-(--accent-on-light) bg-(--accent-on-light) text-white"
                : "border-(--border) bg-(--surface) text-(--text-2) hover:border-(--accent-on-light)/40"
            }`}
            onClick={() => onSelect(i)}
          >
            {c.label}
            {c.isActive ? (
              <span className="ml-2 inline-block h-2 w-2 rounded-full bg-emerald-400" title="Live" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function CourtList({
  sortedCourts,
  playerById,
  waitingPlayers,
  assignToCourt,
  clearSlot,
  startMatch,
  onAutoFill,
  onOpenEndMatch,
  sessionReady,
  variant,
  startingCourtId,
}: {
  sortedCourts: Court[];
  playerById: Map<string, Player>;
  waitingPlayers: Player[];
  assignToCourt: (playerId: string, courtId: string, position: number) => void;
  clearSlot: (courtId: string, position: number) => void;
  startMatch: (courtId: string) => Promise<void>;
  onAutoFill: (court: Court) => void;
  onOpenEndMatch: (court: Court) => void;
  sessionReady: boolean;
  variant: "default" | "umpire";
  startingCourtId: string | null;
}) {
  return (
    <>
      {sortedCourts.map((court) => (
        <BadmintonCourtView
          key={court.id}
          label={court.label}
          isActive={court.isActive}
          slots={court.slots}
          playerById={playerById}
          waitingPlayers={waitingPlayers}
          disabled={court.isActive || !sessionReady}
          variant={variant}
          onAssign={(playerId, position) => void assignToCourt(playerId, court.id, position)}
          onClear={(position) => void clearSlot(court.id, position)}
          onAutoFill={() => onAutoFill(court)}
          onStart={() => void startMatch(court.id)}
          onEnd={() => onOpenEndMatch(court)}
          startPending={startingCourtId === court.id}
        />
      ))}
    </>
  );
}

export function WarRoomView() {
  const [queueOpen, setQueueOpen] = useState(false);
  const [courtIndex, setCourtIndex] = useState(0);
  const [suggestion, setSuggestion] = useState<MatchSuggestion | null>(null);
  const [endMatchTarget, setEndMatchTarget] = useState<{ courtId: string; courtLabel: string } | null>(null);
  const [scoreA, setScoreA] = useState("21");
  const [scoreB, setScoreB] = useState("18");
  const [endMatchError, setEndMatchError] = useState<string | null>(null);
  const [isEndingMatch, setIsEndingMatch] = useState(false);
  const [autoFillError, setAutoFillError] = useState<string | null>(null);
  const [showStartSessionPrompt, setShowStartSessionPrompt] = useState(false);
  const [startingCourtId, setStartingCourtId] = useState<string | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const slotPlayerCacheRef = useRef<Map<string, Player>>(new Map());

  const {
    sortedCourts,
    playerById,
    waitingPlayers,
    players,
    assignToCourt,
    clearSlot,
    startMatch,
    startSuggestedMatch,
    endMatch,
    activeCourtsCount,
    activePlayersCount,
    courts,
    activeSession,
    startSession,
  } = useDeuceSession();

  const courtTotal = Math.max(courts.length, 1);

  const safeCourtIndex = Math.min(courtIndex, Math.max(0, sortedCourts.length - 1));
  const stablePlayerById = useMemo(() => {
    const slotPlayerIds = new Set<string>();
    for (const court of sortedCourts) {
      for (const slot of court.slots) {
        if (slot.playerId) {
          slotPlayerIds.add(slot.playerId);
        }
      }
    }

    // Keep last-known player details for active slot assignments.
    for (const [id, player] of playerById) {
      if (slotPlayerIds.has(id)) {
        slotPlayerCacheRef.current.set(id, player);
      }
    }

    // Drop cached players no longer assigned to any slot.
    for (const id of [...slotPlayerCacheRef.current.keys()]) {
      if (!slotPlayerIds.has(id)) {
        slotPlayerCacheRef.current.delete(id);
      }
    }

    const merged = new Map(playerById);
    for (const [id, player] of slotPlayerCacheRef.current) {
      if (!merged.has(id)) {
        merged.set(id, player);
      }
    }
    return merged;
  }, [playerById, sortedCourts]);

  const shared = {
    sortedCourts,
    playerById: stablePlayerById,
    waitingPlayers,
    assignToCourt,
    clearSlot,
    startMatch: async (courtId: string) => {
      if (startingCourtId) {
        return;
      }
      setStartingCourtId(courtId);
      try {
        await startMatch(courtId);
      } finally {
        setStartingCourtId(null);
      }
    },
    onAutoFill: (court: Court) => {
      const isEmpty = court.slots.every((slot) => !slot.playerId);
      if (!isEmpty || court.isActive || waitingPlayers.length < 4) {
        return;
      }

      const topPriority = waitingPlayers.slice(0, 4) as [Player, Player, Player, Player];
      const balanced = getBestBalancedTeams(topPriority);
      const teamA = balanced.pairing[0];
      const teamB = balanced.pairing[1];
      const picks = [teamA[0], teamA[1], teamB[0], teamB[1]] as [Player, Player, Player, Player];
      const minGames = Math.min(...topPriority.map((p) => p.gamesPlayed));
      const longWaiters = topPriority.filter((p) => getWaitMinutes(p.waitStartedAt) >= 20);
      const badgesByPlayerId: Record<string, SuggestionBadge[]> = {};
      for (const player of topPriority) {
        const badges: SuggestionBadge[] = [];
        if (longWaiters.some((p) => p.id === player.id)) {
          badges.push("Longest Wait");
        }
        if (player.gamesPlayed === minGames) {
          badges.push("Fresh");
        }
        badgesByPlayerId[player.id] = badges;
      }

      const fairnessScore = Math.max(
        0,
        Math.min(100, Math.round((1 - balanced.gap / MAX_TEAM_POWER_GAP) * 100)),
      );
      const prioritizesWaitTime = balanced.gap >= 8;

      const longestWaiters = [...topPriority]
        .sort((a, b) => a.waitStartedAt - b.waitStartedAt)
        .slice(0, 2);
      const waitMins = longestWaiters.map((player) => getWaitMinutes(player.waitStartedAt));
      const reason = `${longestWaiters[0].name} and ${longestWaiters[1].name} waited ${waitMins[0]} and ${waitMins[1]} min; teams balanced by skill gap ${balanced.gap}.`;

      setSuggestion({
        courtId: court.id,
        courtLabel: court.label,
        players: picks,
        badgesByPlayerId,
        fairnessScore,
        prioritizesWaitTime,
        reason,
      });
      setAutoFillError(null);
    },
    onOpenEndMatch: (court: Court) => setEndMatchTarget({ courtId: court.id, courtLabel: court.label }),
    sessionReady: Boolean(activeSession),
    startingCourtId,
  };

  const activeCourt = sortedCourts[safeCourtIndex];
  const handleStartSession = () => {
    if (players.length === 0) {
      void startSession();
      return;
    }
    setShowStartSessionPrompt(true);
  };

  useEffect(() => {
    let cancelled = false;

    const releaseWakeLock = async () => {
      if (!wakeLockRef.current) {
        return;
      }
      try {
        await wakeLockRef.current.release();
      } catch {
        // ignore browser wake lock release failures
      } finally {
        wakeLockRef.current = null;
      }
    };

    const requestWakeLock = async () => {
      if (!activeSession) {
        await releaseWakeLock();
        return;
      }
      if (typeof window === "undefined" || !("wakeLock" in navigator)) {
        return;
      }
      try {
        const lock = await (navigator as Navigator & { wakeLock: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen");
        if (cancelled) {
          await lock.release();
          return;
        }
        wakeLockRef.current = lock;
      } catch {
        // Wake lock may be denied by OS/browser policy. App still works without it.
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && activeSession && !wakeLockRef.current) {
        void requestWakeLock();
      }
    };

    void requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      void releaseWakeLock();
    };
  }, [activeSession]);

  useEffect(() => {
    if (!endMatchTarget) {
      setIsEndingMatch(false);
      setEndMatchError(null);
    }
  }, [endMatchTarget]);

  return (
    <LayoutGroup id="war-room-player-flow">
      <div className="deuce-canvas relative flex min-h-full flex-1 flex-col">
      {/* ——— Phone + iPad / tablet (< 2xl): same as mobile — stacked courts, queue drawer — md+ scales up ——— */}
      <div className="2xl:hidden">
        <div className="page-shell pb-28 md:pb-16 lg:pb-20">
          <header className="mx-auto mb-6 md:mb-10 md:max-w-2xl lg:mb-12">
            <div className="mx-auto max-w-3xl text-center">
              <Image
                src="/branding/deuce-word-logo.png"
                alt="Deuce"
                width={320}
                height={86}
                unoptimized
                className="page-logo mx-auto"
                priority
              />
              <p className="page-kicker">
                Courts
              </p>
              <h1 className="page-title font-display text-4xl font-bold tracking-tight md:text-5xl 2xl:text-4xl">
                Courts
              </h1>
              <p className="mt-2 text-sm leading-snug text-(--text-2) md:mt-3 md:text-base md:leading-relaxed lg:text-lg">
                Full-width courts. Open the queue sheet to see who&apos;s next without leaving this screen.
              </p>
            </div>
            {!activeSession ? (
              <div className="mt-3 rounded-xl border border-dashed border-(--border) bg-(--surface) px-3 py-2 text-center text-xs text-(--text-2)">
                Start a session from Dashboard before starting matches.
              </div>
            ) : null}
          </header>

          <div className="flex flex-col gap-8 md:gap-12 lg:gap-14">
            <CourtList {...shared} variant="umpire" />
          </div>
        </div>

        <button
          type="button"
          className="fixed left-1/2 z-40 -translate-x-1/2 rounded-full bg-(--accent-on-light) px-7 py-3.5 text-sm font-bold text-white shadow-[0_8px_32px_rgba(12,35,64,0.35)] ring-2 ring-white/20 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] 2xl:bottom-[max(1.5rem,env(safe-area-inset-bottom))] md:px-10 md:py-4 md:text-base lg:px-12 lg:py-4 lg:text-lg"
          onClick={() => setQueueOpen(true)}
        >
          Queue · {waitingPlayers.length} waiting
        </button>
        {!activeSession ? (
          <button
            type="button"
            className="fixed right-4 top-4 z-40 rounded-full bg-(--accent-on-light) px-4 py-2 text-xs font-bold text-white shadow-[0_8px_24px_rgba(12,35,64,0.28)] md:right-8 md:top-8"
            onClick={handleStartSession}
          >
            Start Session
          </button>
        ) : null}

        <QueueDrawer open={queueOpen} onOpenChange={setQueueOpen} waitingPlayers={waitingPlayers} />
      </div>

      {/* ——— Wide desktop only: one full court + live board — 2xl+ ——— */}
      <div className="page-shell hidden 2xl:flex 2xl:min-h-0 2xl:flex-1 2xl:gap-10 2xl:pb-12">
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="mx-auto mb-6 w-full max-w-3xl">
            <div className="mx-auto max-w-3xl text-center">
              <Image
                src="/branding/deuce-word-logo.png"
                alt="Deuce"
                width={360}
                height={96}
                unoptimized
                className="page-logo mx-auto"
                priority
              />
              <p className="page-kicker">
                Courts · Live board
              </p>
              <h1 className="page-title font-display text-4xl font-bold tracking-tight md:text-5xl 2xl:text-4xl">
                Courts
              </h1>
              <p className="mt-2 text-base text-(--text-2)">
                One court at a time for maximum clarity. Switch courts with the tabs below; live stats stay
                on the right.
              </p>
            </div>
          </header>

          <CourtSelectorTabs courts={sortedCourts} selectedIndex={safeCourtIndex} onSelect={setCourtIndex} />

          <div className="mx-auto w-full max-w-5xl">
            {activeCourt ? (
              <BadmintonCourtView
                key={activeCourt.id}
                label={activeCourt.label}
                isActive={activeCourt.isActive}
                slots={activeCourt.slots}
                playerById={stablePlayerById}
                waitingPlayers={waitingPlayers}
                disabled={activeCourt.isActive || !activeSession}
                variant="umpire"
                onAssign={(playerId, position) => void assignToCourt(playerId, activeCourt.id, position)}
                onClear={(position) => void clearSlot(activeCourt.id, position)}
                onAutoFill={() => shared.onAutoFill(activeCourt)}
                onStart={() => void shared.startMatch(activeCourt.id)}
                onEnd={() => setEndMatchTarget({ courtId: activeCourt.id, courtLabel: activeCourt.label })}
                startPending={startingCourtId === activeCourt.id}
              />
            ) : (
              <p className="text-center text-(--text-muted)">No courts configured.</p>
            )}
          </div>
        </div>

        <div className="w-80 shrink-0 min-[1800px]:w-96">
          <div className="sticky top-6">
            <LiveSidePanel
              players={players}
              waitingPlayers={waitingPlayers}
              activeCourtsCount={activeCourtsCount}
              courtTotal={courtTotal}
              activePlayersCount={activePlayersCount}
            />
          </div>
        </div>
      </div>

      {suggestion ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-(--border) bg-(--surface) p-5 shadow-(--shadow-lift)">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--text-muted)">
              Auto-fill suggestion
            </p>
            <h2 className="font-display mt-2 text-2xl font-semibold text-(--accent-on-light)">
              {suggestion.courtLabel}
            </h2>
            <p className="mt-4 text-sm text-(--text)">
              Team A ({suggestion.players[0].name}/{suggestion.players[1].name}) vs Team B (
              {suggestion.players[2].name}/{suggestion.players[3].name})
            </p>
            <div className="mt-2 space-y-1">
              {suggestion.players.map((player) => {
                const badges = suggestion.badgesByPlayerId[player.id] ?? [];
                return (
                  <p key={player.id} className="text-xs text-(--text-2)">
                    {player.name}
                    {badges.length > 0 ? (
                      <span className="ml-1">
                        {badges.map((badge) => (
                          <span
                            key={`${player.id}-${badge}`}
                            className="mr-1 inline-flex rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700"
                          >
                            {badge}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </p>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-(--text-2)">{suggestion.reason}</p>
            <p className="mt-1 text-[11px] text-(--text-muted)">
              Priority:{" "}
              {suggestion.players
                .map((p) => `${p.name} (${getPriorityScore(p)})`)
                .join(", ")}
            </p>
            <div
              className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                suggestion.prioritizesWaitTime
                  ? "bg-amber-100 text-amber-900"
                  : "bg-emerald-100 text-emerald-900"
              }`}
            >
              Fairness {suggestion.fairnessScore}%
            </div>
            {suggestion.prioritizesWaitTime ? (
              <p className="mt-1 text-[11px] text-amber-800">
                Priority given to wait time over skill balance.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-(--text-muted)">
                Teams optimized for closest skill balance.
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="btn-canvas-ghost flex-1 px-4 py-2.5 text-sm"
                onClick={() => setSuggestion(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-court-primary flex-1 px-4 py-2.5 text-sm"
                onClick={async () => {
                  const didStart = await startSuggestedMatch(suggestion.courtId, [
                    suggestion.players[0].id,
                    suggestion.players[1].id,
                    suggestion.players[2].id,
                    suggestion.players[3].id,
                  ]);
                  if (didStart) {
                    setSuggestion(null);
                    setAutoFillError(null);
                    return;
                  }
                  setAutoFillError(
                    "Lineup changed before start (break status / assignment updated). Please auto-fill again.",
                  );
                }}
              >
                Confirm & start
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {autoFillError ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-65 w-full max-w-xl -translate-x-1/2 px-4">
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-900 shadow-md">
            {autoFillError}
          </div>
        </div>
      ) : null}
      {endMatchTarget ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-(--border) bg-(--surface) p-5 shadow-(--shadow-lift)">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--text-muted)">
              End match
            </p>
            <h2 className="font-display mt-2 text-2xl font-semibold text-(--accent-on-light)">
              {endMatchTarget.courtLabel}
            </h2>
            <p className="mt-2 text-sm text-(--text-2)">Enter the final score.</p>
            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-(--text-muted)">Score A</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value)}
                  className="canvas-input w-full text-center tabular-nums"
                />
              </label>
              <span className="pb-2 text-sm font-semibold text-(--text-muted)">vs</span>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-(--text-muted)">Score B</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value)}
                  className="canvas-input w-full text-center tabular-nums"
                />
              </label>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="btn-canvas-ghost flex-1 px-4 py-2.5 text-sm"
                onClick={() => {
                  setEndMatchError(null);
                  setEndMatchTarget(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-court-end flex-1 px-4 py-2.5 text-sm"
                disabled={isEndingMatch}
                onClick={async () => {
                  if (isEndingMatch) {
                    return;
                  }
                  setIsEndingMatch(true);
                  const parsedA = Math.max(0, Number(scoreA) || 0);
                  const parsedB = Math.max(0, Number(scoreB) || 0);
                  const saved = await endMatch(endMatchTarget.courtId, parsedA, parsedB);
                  if (!saved) {
                    setEndMatchError("Unable to end this match right now. Please retry.");
                    setIsEndingMatch(false);
                    return;
                  }
                  setEndMatchError(null);
                  setIsEndingMatch(false);
                  setEndMatchTarget(null);
                }}
              >
                {isEndingMatch ? "Saving..." : "Save result"}
              </button>
            </div>
            {endMatchError ? (
              <p className="mt-3 text-center text-xs font-medium text-amber-700">{endMatchError}</p>
            ) : null}
          </div>
        </div>
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
      </div>
    </LayoutGroup>
  );
}
