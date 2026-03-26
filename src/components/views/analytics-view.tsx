"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useDeuceSession } from "@/hooks/use-deuce-session";
import type { SessionMatch } from "@/lib/types";

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
};

export function AnalyticsView() {
  const { players, sessions, activeSession, sessionMatches, playerById } = useDeuceSession();
  const [selectedSessionId, setSelectedSessionId] = useState<string>("active");
  const [visibleLeaderboardCount, setVisibleLeaderboardCount] = useState(3);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(10);
  const resolvedSessionId =
    selectedSessionId === "active" ? (activeSession?.id ?? "all") : selectedSessionId;

  const filteredMatches = useMemo(() => {
    if (resolvedSessionId === "all") return sessionMatches;
    return sessionMatches.filter((match) => match.sessionId === resolvedSessionId);
  }, [resolvedSessionId, sessionMatches]);

  const leaderboardStats = useMemo(() => {
    const stats = new Map<string, { wins: number; losses: number; draws: number; matches: number; winRate: number }>();
    for (const player of players) {
      stats.set(player.id, { wins: 0, losses: 0, draws: 0, matches: 0, winRate: 0 });
    }
    for (const match of filteredMatches) {
      const teamA = new Set(match.teamAPlayerIds);
      const teamB = new Set(match.teamBPlayerIds);
      for (const id of [...teamA, ...teamB]) {
        const current = stats.get(id) ?? { wins: 0, losses: 0, draws: 0, matches: 0, winRate: 0 };
        current.matches += 1;
        if (match.winner === "Draw") current.draws += 1;
        else if ((match.winner === "A" && teamA.has(id)) || (match.winner === "B" && teamB.has(id))) current.wins += 1;
        else current.losses += 1;
        const decided = current.wins + current.losses;
        current.winRate = decided === 0 ? 0 : Math.round((current.wins / decided) * 100);
        stats.set(id, current);
      }
    }
    return stats;
  }, [filteredMatches, players]);

  const leaderboard = [...players]
    .map((player) => {
      const stats = leaderboardStats.get(player.id) ?? {
        wins: 0,
        losses: 0,
        draws: 0,
        matches: 0,
        winRate: 0,
      };
      return { player, ...stats };
    })
    .filter((row) => row.matches > 0)
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || a.player.name.localeCompare(b.player.name));

  const selectedSessionName =
    resolvedSessionId === "all"
      ? "All sessions"
      : sessions.find((session) => session.id === resolvedSessionId)?.name ?? "Selected session";

  useEffect(() => {
    setVisibleLeaderboardCount(3);
    setVisibleHistoryCount(10);
  }, [resolvedSessionId]);

  return (
    <div className="deuce-canvas relative flex min-h-full flex-1 flex-col">
      <div className="page-shell pb-24 2xl:pb-12">
        <header className="mb-8 border-b border-(--border) pb-8">
          <div className="mx-auto max-w-3xl text-center">
            <Image
              src="/branding/deuce-word-logo.png"
              alt="Deuce"
              width={320}
              height={86}
              className="page-logo mx-auto"
              priority
            />
            <p className="page-kicker">Analytics</p>
            <h1 className="page-title font-display text-4xl font-bold tracking-tight md:text-5xl 2xl:text-4xl">
              Match History & Leaderboard
            </h1>
            <p className="mt-3 text-base text-(--text-2)">
              Full session history with results, durations, and player win-rate rankings.
            </p>
          </div>
          <div className="mt-4 flex max-w-sm flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">Session</label>
            <select
              className="canvas-input app-select"
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
            >
              <option value="active">{activeSession ? `${activeSession.name} (active)` : "Active session (none)"}</option>
              <option value="all">All sessions</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name} ({session.status})
                </option>
              ))}
            </select>
          </div>
        </header>

        <section className="mb-10">
          <h2 className="font-display text-lg font-semibold text-(--accent-on-light) md:text-xl">Leaderboard</h2>
          <div className="mt-4 space-y-2">
            {leaderboard.length === 0 ? (
              <p className="rounded-xl border border-dashed border-(--border) bg-(--surface) px-4 py-6 text-sm text-(--text-muted)">
                No ranked players yet for {selectedSessionName.toLowerCase()}.
              </p>
            ) : (
              leaderboard.slice(0, visibleLeaderboardCount).map((row, index) => {
                const rank = index + 1;
                const podiumClass =
                  rank === 1
                    ? "border-amber-300/70 bg-amber-50/60"
                    : rank === 2
                      ? "border-slate-300/80 bg-slate-50/80"
                      : rank === 3
                        ? "border-orange-300/70 bg-orange-50/60"
                        : "border-(--border) bg-(--surface)";
                const rankLabel = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
                return (
                  <div
                    key={row.player.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-(--shadow-soft) ${podiumClass}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-(--text)">
                        {rankLabel} {row.player.name}
                      </p>
                      <p className="text-xs text-(--text-2)">
                        {row.wins}W / {row.losses}L / {row.draws}D ({row.matches} matches)
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-(--accent-on-light)">
                      {row.winRate}%
                    </span>
                  </div>
                );
              })
            )}
            {leaderboard.length > visibleLeaderboardCount && (
              <button
                type="button"
                className="btn-canvas-ghost mt-2 w-full px-4 py-2.5 text-sm"
                onClick={() => setVisibleLeaderboardCount((current) => current + 10)}
              >
                View more leaderboard ({leaderboard.length - visibleLeaderboardCount} remaining)
              </button>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-(--accent-on-light) md:text-xl">Session history</h2>
          <div className="mt-4 space-y-2">
            {filteredMatches.length === 0 ? (
              <p className="rounded-xl border border-dashed border-(--border) bg-(--surface) px-4 py-6 text-sm text-(--text-muted)">
                No match records yet.
              </p>
            ) : (
              filteredMatches.slice(0, visibleHistoryCount).map((match: SessionMatch) => {
                const teamA = match.teamAPlayerIds.map((id) => playerById.get(id)?.name ?? "Unknown").join(" / ");
                const teamB = match.teamBPlayerIds.map((id) => playerById.get(id)?.name ?? "Unknown").join(" / ");
                return (
                  <div
                    key={match.id}
                    className="rounded-xl border border-(--border) bg-(--surface) px-4 py-3 shadow-(--shadow-soft)"
                  >
                    <p className="text-sm font-semibold text-(--text)">
                      {match.courtLabel}: {teamA} vs {teamB}
                    </p>
                    <p className="mt-1 text-xs text-(--text-2)">
                      Score {match.scoreA}-{match.scoreB} · {match.winner === "Draw" ? "Draw" : `Winner Team ${match.winner}`} ·{" "}
                      {formatDuration(match.durationMs)}
                    </p>
                  </div>
                );
              })
            )}
            {filteredMatches.length > visibleHistoryCount && (
              <button
                type="button"
                className="btn-canvas-ghost mt-2 w-full px-4 py-2.5 text-sm"
                onClick={() => setVisibleHistoryCount((current) => current + 10)}
              >
                View more history ({filteredMatches.length - visibleHistoryCount} remaining)
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
