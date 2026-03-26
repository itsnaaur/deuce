"use client";

import type { Player } from "@/lib/types";

type LiveSidePanelProps = {
  players: Player[];
  waitingPlayers: Player[];
  activeCourtsCount: number;
  courtTotal: number;
  activePlayersCount: number;
};

/**
 * Desktop "Live Board" right column — session stats + games leaderboard.
 */
export function LiveSidePanel({
  players,
  waitingPlayers,
  activeCourtsCount,
  courtTotal,
  activePlayersCount,
}: LiveSidePanelProps) {
  const leaderboard = [...players]
    .filter((p) => p.gamesPlayed > 0)
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed || a.name.localeCompare(b.name))
    .slice(0, 8);

  return (
    <aside className="flex h-full min-h-0 flex-col gap-6">
      <section className="rounded-2xl border border-(--border) bg-(--surface) p-4 shadow-(--shadow-soft)">
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-(--text-muted)">
          Session
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-(--text-2)">Active players</dt>
            <dd className="font-semibold tabular-nums text-(--accent-on-light)">{activePlayersCount}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-(--text-2)">In queue</dt>
            <dd className="font-semibold tabular-nums text-(--accent-on-light)">{waitingPlayers.length}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-(--text-2)">Courts live</dt>
            <dd className="font-semibold tabular-nums text-(--accent-on-light)">
              {activeCourtsCount} / {courtTotal}
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-(--border) bg-(--surface) p-4 shadow-(--shadow-soft)">
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-(--text-muted)">
          Leaderboard
        </h2>
        <p className="mt-1 text-[11px] text-(--text-2)">Top of the night (by games finished).</p>
        <ol className="mt-3 max-h-[min(40vh,360px)] space-y-2 overflow-y-auto pr-1">
          {leaderboard.length === 0 ? (
            <li className="py-4 text-center text-sm text-(--text-muted)">No completed games yet.</li>
          ) : (
            leaderboard.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-(--surface-2) px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-(--text-muted)">
                    {i + 1}
                  </span>
                  <span className="truncate font-medium text-(--text)">{p.name}</span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-(--accent-on-light)">
                  {p.gamesPlayed}
                </span>
              </li>
            ))
          )}
        </ol>
      </section>
    </aside>
  );
}
