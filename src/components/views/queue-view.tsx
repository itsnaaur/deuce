"use client";

import Image from "next/image";
import { QueuePanel } from "@/components/queue/queue-panel";
import { DEUCE_GENDERS, useDeuceSession } from "@/hooks/use-deuce-session";
import type { Gender, SkillLevel } from "@/lib/types";

export function QueueView() {
  const {
    name,
    setName,
    gender,
    setGender,
    setSkillLevel,
    skillMode,
    availableLevels,
    selectedSkillLevel,
    settings,
    players,
    waitingPlayers,
    updateSettings,
    syncCourtsCount,
    randomizeStartOrder,
    has10OrMore,
    addPlayer,
    toggleActive,
    toggleBreak,
  } = useDeuceSession();

  return (
    <div className="deuce-canvas relative flex min-h-full flex-1 flex-col">
      <div className="page-shell">
        <header className="mb-10 border-b border-(--border) pb-10 md:mb-12 md:pb-12 2xl:mb-6 2xl:pb-8">
          <div className="mx-auto max-w-3xl text-center">
            <Image
              src="/branding/deuce-word-logo.png"
              alt="Deuce"
              width={320}
              height={86}
              className="page-logo mx-auto"
              priority
            />
            <p className="page-kicker">
              The Roster
            </p>
            <h1 className="page-title font-display text-4xl font-bold tracking-tight md:text-5xl 2xl:text-4xl">
              Manage players
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-(--text-2) md:text-lg 2xl:max-w-none 2xl:text-base">
              Add players, toggle availability, and watch the fair queue reorder live.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="canvas-label">Skill mode</span>
              <select
                value={skillMode}
                className="canvas-input min-w-36"
                onChange={(e) =>
                  void updateSettings({ skillMode: e.target.value as "recreational" | "competitive" })
                }
              >
                <option value="recreational">Recreational</option>
                <option value="competitive">Competitive</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="canvas-label">Courts</span>
              <input
                className="canvas-input w-20 text-center tabular-nums"
                type="number"
                min={1}
                max={10}
                value={settings?.courtCount ?? 2}
                onChange={(e) => {
                  const count = Math.max(1, Math.min(10, Number(e.target.value) || 1));
                  void updateSettings({ courtCount: count });
                  void syncCourtsCount(count);
                }}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={!has10OrMore || Boolean(settings?.randomStartUsed)}
            onClick={() => void randomizeStartOrder()}
            className="btn-canvas-ghost mt-5 w-full px-5 py-3 text-sm"
          >
            Shuffle first round
          </button>
        </header>

        <section className="border-b border-(--border) py-8 md:py-10">
          <h2 className="font-display text-lg font-semibold text-(--accent-on-light) md:text-xl">
            Add players
          </h2>
          <p className="mt-2 text-sm text-(--text-muted) md:text-base">Quick add — defaults to active and in the queue.</p>
          <div className="mt-4 grid gap-3">
            <input
              placeholder="Player name"
              className="canvas-input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addPlayer()}
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                className="canvas-input w-full"
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
              >
                {DEUCE_GENDERS.map((g) => (
                  <option key={g} value={g} className="bg-(--surface) text-(--text)">
                    {g}
                  </option>
                ))}
              </select>
              <select
                className="canvas-input w-full"
                value={selectedSkillLevel}
                onChange={(e) => setSkillLevel(e.target.value as SkillLevel)}
              >
                {availableLevels.map((level) => (
                  <option key={level} value={level} className="bg-(--surface) text-(--text)">
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn-canvas-primary px-5 py-3 text-sm" onClick={() => void addPlayer()}>
              Add player
            </button>
          </div>
        </section>

        <section className="border-b border-(--border) py-8 md:py-10">
          <h2 className="font-display text-lg font-semibold text-(--accent-on-light) md:text-xl">Roster</h2>
          <p className="mt-2 text-sm text-(--text-muted) md:text-base">Everyone checked in for tonight.</p>
          <div className="mt-4 space-y-2">
            {players.length === 0 ? (
              <p className="py-8 text-center text-sm text-(--text-muted)">No players yet.</p>
            ) : (
              players.map((player) => (
                <div
                  key={player.id}
                  className="flex flex-col gap-3 rounded-2xl border border-(--border) bg-(--surface) p-3 shadow-(--shadow-soft) sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-(--text)">{player.name}</p>
                    <p className="text-xs text-(--text-2)">
                      {player.skillLevel} · {player.gender} · {player.gamesPlayed} games
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className={`pill-toggle ${player.isActive ? "pill-toggle-on" : "pill-toggle-off"}`}
                      onClick={() => void toggleActive(player)}
                    >
                      {player.isActive ? "Active" : "Off"}
                    </button>
                    <button
                      type="button"
                      className={`pill-toggle ${
                        player.isOnBreak
                          ? "bg-amber-100 text-amber-900 ring-1 ring-amber-200/80"
                          : "pill-toggle-off"
                      }`}
                      onClick={() => void toggleBreak(player)}
                    >
                      {player.isOnBreak ? "Break" : "Here"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="py-8 md:py-10">
          <QueuePanel waitingPlayers={waitingPlayers} title="Waiting" />
        </section>
      </div>
    </div>
  );
}
