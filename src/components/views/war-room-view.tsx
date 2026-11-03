"use client";

import Image from "next/image";
import { LayoutGroup } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { BadmintonCourtView } from "@/components/badminton-court";
import { QueueDrawer } from "@/components/queue/queue-drawer";
import { LiveSidePanel } from "@/components/session/live-side-panel";
import { StartSessionModal } from "@/components/session/start-session-modal";
import { useDeuceSession } from "@/hooks/use-deuce-session";
import {
  MAX_TEAM_POWER_GAP,
  getBestBalancedTeams,
  getRecentPairKeys,
  getWaitMinutes,
  pickAutoFillGroup,
} from "@/lib/queue";
import { getSkillPowerValue } from "@/lib/skill";
import type { Court, Player } from "@/lib/types";

const MAX_SCORE = 99;

const listNames = (players: Player[]) => {
  const names = players.map((player) => player.name);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

const parseScore = (value: string) => {
  if (!/^\d{1,2}$/.test(value.trim())) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return parsed <= MAX_SCORE ? parsed : undefined;
};

type SuggestionBadge = "Longest Wait" | "Fresh";
type MatchSuggestion = {
  courtId: string;
  courtLabel: string;
  players: [Player, Player, Player, Player];
  badgesByPlayerId: Record<string, SuggestionBadge[]>;
  fairnessScore: number;
  prioritizesWaitTime: boolean;
  keepsPlacedPlayers: boolean;
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
  const [endMatchTarget, setEndMatchTarget] = useState<{
    courtId: string;
    courtLabel: string;
    teamALabel: string;
    teamBLabel: string;
  } | null>(null);
  // Start blank so a quick tap on Save can never record a result that didn't happen.
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [confirmDraw, setConfirmDraw] = useState(false);
  const [endMatchError, setEndMatchError] = useState<string | null>(null);
  const [isEndingMatch, setIsEndingMatch] = useState(false);
  const [autoFillError, setAutoFillError] = useState<string | null>(null);
  const [showStartSessionPrompt, setShowStartSessionPrompt] = useState(false);
  const [startingCourtId, setStartingCourtId] = useState<string | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

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
    scopedSessionMatches,
  } = useDeuceSession();

  const courtTotal = Math.max(courts.length, 1);

  // Partners and matchmates from each player's most recent game, so auto-fill can mix things up.
  const recentPairs = useMemo(() => getRecentPairKeys(scopedSessionMatches), [scopedSessionMatches]);

  const openEndMatch = (court: Court) => {
    const nameAt = (position: number) => {
      const id = court.slots.find((slot) => slot.position === position)?.playerId;
      return (id && stablePlayerById.get(id)?.name) || "?";
    };
    setScoreA("");
    setScoreB("");
    setConfirmDraw(false);
    setIsEndingMatch(false);
    setEndMatchError(null);
    setEndMatchTarget({
      courtId: court.id,
      courtLabel: court.label,
      teamALabel: `${nameAt(1)} / ${nameAt(2)}`,
      teamBLabel: `${nameAt(3)} / ${nameAt(4)}`,
    });
  };

  const safeCourtIndex = Math.min(courtIndex, Math.max(0, sortedCourts.length - 1));
  // Players can't be removed while on a court, and clearing the roster also clears the courts,
  // so every placed player is always in playerById.
  const stablePlayerById = playerById;

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
      const openPositions = court.slots.filter((slot) => !slot.playerId).map((slot) => slot.position);
      if (openPositions.length === 0 || court.isActive || waitingPlayers.length < openPositions.length) {
        return;
      }

      const isFullFill = openPositions.length === court.slots.length;
      let fills: Player[];
      let picks: [Player, Player, Player, Player];
      let gap: number;
      const reasonParts: string[] = [];

      if (isFullFill) {
        const group = pickAutoFillGroup(waitingPlayers, recentPairs);
        if (!group) {
          return;
        }
        fills = group.players;
        picks = group.players;
        gap = group.gap;
        const nextFour = waitingPlayers.slice(0, 4);
        const plain = getBestBalancedTeams(nextFour as [Player, Player, Player, Player]);
        if (group.skipped.length > 0) {
          const joined = group.players.filter((player) => !nextFour.includes(player));
          reasonParts.push(
            `${listNames(joined)} ${joined.length === 1 ? "joins" : "join"} instead of ${listNames(group.skipped)} for ${
              group.gap < plain.gap ? "better-balanced teams" : "a fresh mix of players"
            }. ${listNames(group.skipped)} ${group.skipped.length === 1 ? "is" : "are"} first in line next.`,
          );
        } else {
          reasonParts.push("The next four in the queue.");
        }
        if (group.repeatedPartners === 0 && plain.repeatedPartners > 0 && group.skipped.length === 0) {
          reasonParts.push("Partners were mixed up so nobody repeats their last partner.");
        }
      } else {
        // Keep the host's hand-placed players where they are and fill the open spots in queue order.
        fills = waitingPlayers.slice(0, openPositions.length);
        const queue = [...fills];
        const byPosition = court.slots.map((slot) =>
          slot.playerId ? stablePlayerById.get(slot.playerId) : queue.shift(),
        );
        if (byPosition.some((player) => !player)) {
          setAutoFillError("A placed player is missing from the roster. Remove them and try again.");
          return;
        }
        picks = byPosition as [Player, Player, Player, Player];
        const teamPower = (a: Player, b: Player) =>
          getSkillPowerValue(a.skillLevel) + getSkillPowerValue(b.skillLevel);
        gap = Math.abs(teamPower(picks[0], picks[1]) - teamPower(picks[2], picks[3]));
        reasonParts.push(
          `Fills ${openPositions.length} open ${openPositions.length === 1 ? "spot" : "spots"} from the front of the queue.`,
        );
      }

      // Badges only mean something when they set a player apart from the rest of the queue.
      const fewestGames = Math.min(...waitingPlayers.map((p) => p.gamesPlayed));
      const mostGames = Math.max(...waitingPlayers.map((p) => p.gamesPlayed));
      const badgesByPlayerId: Record<string, SuggestionBadge[]> = {};
      for (const player of fills) {
        const badges: SuggestionBadge[] = [];
        if (getWaitMinutes(player.waitStartedAt) >= 20) {
          badges.push("Longest Wait");
        }
        if (fewestGames < mostGames && player.gamesPlayed === fewestGames) {
          badges.push("Fresh");
        }
        badgesByPlayerId[player.id] = badges;
      }

      const fairnessScore = Math.max(0, Math.min(100, Math.round((1 - gap / MAX_TEAM_POWER_GAP) * 100)));
      const prioritizesWaitTime = gap >= 8;

      const waitedAMinute = [...fills]
        .filter((player) => getWaitMinutes(player.waitStartedAt) >= 1)
        .sort((a, b) => a.waitStartedAt - b.waitStartedAt)
        .slice(0, 2);
      if (waitedAMinute.length > 0) {
        reasonParts.push(
          `Longest waiting: ${waitedAMinute
            .map((player) => `${player.name} (${getWaitMinutes(player.waitStartedAt)} min)`)
            .join(" and ")}.`,
        );
      }

      setSuggestion({
        courtId: court.id,
        courtLabel: court.label,
        players: picks,
        badgesByPlayerId,
        fairnessScore,
        prioritizesWaitTime,
        keepsPlacedPlayers: !isFullFill,
        reason: reasonParts.join(" "),
      });
      setAutoFillError(null);
    },
    onOpenEndMatch: openEndMatch,
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
          {/* Room to scroll the last court's buttons above the floating Queue button and tab bar. */}
          <div aria-hidden="true" className="h-36 md:h-32" />
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
                onEnd={() => openEndMatch(activeCourt)}
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
            <div
              className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${
                suggestion.prioritizesWaitTime
                  ? "bg-amber-100 text-amber-900"
                  : "bg-emerald-100 text-emerald-900"
              }`}
            >
              Fairness {suggestion.fairnessScore}%
            </div>
            {suggestion.keepsPlacedPlayers ? (
              <p className="mt-1 text-[11px] text-(--text-muted)">
                Players you already placed stay on their teams.
              </p>
            ) : suggestion.prioritizesWaitTime ? (
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
          <form
            className="w-full max-w-md rounded-2xl border border-(--border) bg-(--surface) p-5 shadow-(--shadow-lift)"
            onSubmit={async (event) => {
              // A form so pressing Enter in either score box saves.
              event.preventDefault();
              if (isEndingMatch) {
                return;
              }
              const parsedA = parseScore(scoreA);
              const parsedB = parseScore(scoreB);
              if (parsedA === undefined || parsedB === undefined) {
                setEndMatchError(`Enter a score from 0 to ${MAX_SCORE} for both teams.`);
                return;
              }
              if (parsedA === parsedB && !confirmDraw) {
                setConfirmDraw(true);
                return;
              }
              setIsEndingMatch(true);
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--text-muted)">
              End match
            </p>
            <h2 className="font-display mt-2 text-2xl font-semibold text-(--accent-on-light)">
              {endMatchTarget.courtLabel}
            </h2>
            <p className="mt-2 text-sm text-(--text-2)">Enter the final score.</p>
            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <label className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-xs font-semibold text-(--text-muted)" title={endMatchTarget.teamALabel}>
                  Team A · {endMatchTarget.teamALabel}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  placeholder="–"
                  autoFocus
                  value={scoreA}
                  onChange={(e) => {
                    setScoreA(e.target.value.replace(/\D/g, ""));
                    setConfirmDraw(false);
                    setEndMatchError(null);
                  }}
                  className="canvas-input w-full text-center tabular-nums"
                />
              </label>
              <span className="pb-2 text-sm font-semibold text-(--text-muted)">vs</span>
              <label className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-xs font-semibold text-(--text-muted)" title={endMatchTarget.teamBLabel}>
                  Team B · {endMatchTarget.teamBLabel}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  placeholder="–"
                  value={scoreB}
                  onChange={(e) => {
                    setScoreB(e.target.value.replace(/\D/g, ""));
                    setConfirmDraw(false);
                    setEndMatchError(null);
                  }}
                  className="canvas-input w-full text-center tabular-nums"
                />
              </label>
            </div>
            {confirmDraw ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Both teams have {scoreA}. Badminton games don&apos;t usually end level — check the score, or tap
                &ldquo;Save as draw&rdquo; if the game was stopped early.
              </p>
            ) : null}
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
                type="submit"
                className="btn-court-end flex-1 px-4 py-2.5 text-sm"
                disabled={isEndingMatch}
              >
                {isEndingMatch ? "Saving..." : confirmDraw ? "Save as draw" : "Save result"}
              </button>
            </div>
            {endMatchError ? (
              <p className="mt-3 text-center text-xs font-medium text-amber-700">{endMatchError}</p>
            ) : null}
          </form>
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
