"use client";

import Image from "next/image";
import { useState } from "react";
import { QueuePanel } from "@/components/queue/queue-panel";
import {
  DEUCE_GENDERS,
  MAX_COURTS,
  MAX_PLAYER_NAME_LENGTH,
  getPlayerStatus,
  useDeuceSession,
  type PlayerStatus,
} from "@/hooks/use-deuce-session";
import type { Gender, Player, SkillLevel } from "@/lib/types";

const STATUS_OPTIONS: { value: PlayerStatus; label: string }[] = [
  { value: "playing", label: "Playing" },
  { value: "break", label: "Break" },
  { value: "left", label: "Left" },
];

export function QueueView() {
  const [courtCountInput, setCourtCountInput] = useState("2");
  const [visibleRosterCount, setVisibleRosterCount] = useState(10);
  const [addError, setAddError] = useState<string>();
  const [courtCountMessage, setCourtCountMessage] = useState<string>();
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
    sortedPlayers,
    playersOnCourt,
    activeSession,
    waitingPlayers,
    updateSettings,
    syncCourtsCount,
    randomizeStartOrder,
    has10OrMore,
    addPlayer,
    updatePlayer,
    removePlayer,
    setPlayerStatus,
  } = useDeuceSession();

  const submitAdd = async () => {
    setAddError(undefined);
    const error = await addPlayer();
    if (error) {
      setAddError(error);
    }
  };

  // Keep the court field in step with saved settings, and collapse the roster when its size changes.
  // Both adjust state during render instead of in an effect.
  const savedCourtCount = settings?.courtCount ?? 2;
  const [courtCountShownFor, setCourtCountShownFor] = useState(savedCourtCount);
  if (courtCountShownFor !== savedCourtCount) {
    setCourtCountShownFor(savedCourtCount);
    setCourtCountInput(String(savedCourtCount));
  }
  const [rosterShownFor, setRosterShownFor] = useState(players.length);
  if (rosterShownFor !== players.length) {
    setRosterShownFor(players.length);
    setVisibleRosterCount(10);
  }

  const commitCourtCount = () => {
    const parsed = Number.parseInt(courtCountInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setCourtCountInput(String(settings?.courtCount ?? 2));
      return;
    }
    const normalized = Math.min(parsed, MAX_COURTS);
    setCourtCountInput(String(normalized));
    setCourtCountMessage(
      parsed > MAX_COURTS ? `Deuce supports up to ${MAX_COURTS} courts.` : undefined,
    );
    void syncCourtsCount(normalized).then((result) => {
      setCourtCountInput(String(result.count));
      if (result.error) {
        setCourtCountMessage(result.error);
      }
    });
  };

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
              unoptimized
              className="page-logo mx-auto"
              priority
            />
            <p className="page-kicker">
              The Roster
            </p>
            <h1 className="page-title font-display text-4xl font-bold tracking-tight md:text-5xl 2xl:text-4xl">
              Manage players
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-center text-base leading-relaxed text-(--text-2) md:text-lg 2xl:max-w-none 2xl:text-base">
              Add players, toggle availability, and watch the fair queue reorder live.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="canvas-label">Skill mode</span>
              <select
                value={skillMode}
                className="canvas-input app-select min-w-36"
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
                className="canvas-input number-input-clean w-24 text-center tabular-nums md:w-28"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={courtCountInput}
                onChange={(e) => {
                  const next = e.target.value;
                  if (/^\d*$/.test(next)) {
                    setCourtCountInput(next);
                  }
                }}
                onBlur={commitCourtCount}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitCourtCount();
                  }
                }}
              />
            </label>
          </div>
          {courtCountMessage && (
            <p role="alert" className="mt-2 text-sm font-medium text-amber-800">
              {courtCountMessage}
            </p>
          )}
          <button
            type="button"
            disabled={!has10OrMore || Boolean(settings?.randomStartUsed)}
            onClick={() => void randomizeStartOrder()}
            className="btn-canvas-ghost mt-5 w-full px-5 py-3 text-sm"
          >
            Shuffle first round
          </button>
          {!has10OrMore && !settings?.randomStartUsed && (
            <p className="mt-2 text-center text-xs text-(--text-muted)">
              Shuffle unlocks once 10 or more players are available.
            </p>
          )}
        </header>

        <section className="border-b border-(--border) py-8 md:py-10">
          <h2 className="font-display text-lg font-semibold text-(--accent-on-light) md:text-xl">
            Add players
          </h2>
          <p className="mt-2 text-sm text-(--text-muted) md:text-base">Quick add — defaults to active and in the queue.</p>
          <div className="mt-4 grid gap-3">
            <input
              placeholder="Player name"
              aria-label="Player name"
              className="canvas-input w-full"
              value={name}
              maxLength={MAX_PLAYER_NAME_LENGTH}
              aria-invalid={Boolean(addError)}
              aria-describedby={addError ? "add-player-error" : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setAddError(undefined);
              }}
              onKeyDown={(e) => e.key === "Enter" && void submitAdd()}
            />
            {addError && (
              <p id="add-player-error" role="alert" className="text-sm font-medium text-red-700">
                {addError}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <select
                className="canvas-input app-select w-full"
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
                className="canvas-input app-select w-full"
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
            <button
              type="button"
              className="btn-canvas-primary px-5 py-3 text-sm"
              onClick={() => void submitAdd()}
            >
              {/* Gender and level carry over between adds, so show them on the button. */}
              Add player · {gender} · {selectedSkillLevel}
            </button>
          </div>
        </section>

        <section className="border-b border-(--border) py-8 md:py-10">
          <h2 className="font-display text-lg font-semibold text-(--accent-on-light) md:text-xl">Roster</h2>
          <p className="mt-2 text-sm text-(--text-muted) md:text-base">
            Everyone checked in for tonight, A–Z. Set each player to Playing, Break, or Left.
          </p>
          <div className="mt-4 space-y-2">
            {sortedPlayers.length === 0 ? (
              <p className="py-8 text-center text-sm text-(--text-muted)">No players yet.</p>
            ) : (
              sortedPlayers.slice(0, visibleRosterCount).map((player) => (
                <RosterRow
                  key={player.id}
                  player={player}
                  isOnCourt={playersOnCourt.has(player.id)}
                  availableLevels={availableLevels}
                  onStatusChange={(status) => void setPlayerStatus(player, status)}
                  onSave={(changes) => updatePlayer(player, changes)}
                  onRemove={() => removePlayer(player)}
                />
              ))
            )}
            {sortedPlayers.length > visibleRosterCount && (
              <button
                type="button"
                className="btn-canvas-ghost mt-2 w-full px-4 py-2.5 text-sm"
                onClick={() => setVisibleRosterCount((current) => current + 10)}
              >
                View more roster ({sortedPlayers.length - visibleRosterCount} remaining)
              </button>
            )}
          </div>
        </section>

        <section className="py-8 md:py-10">
          {!activeSession && players.length > 0 && (
            <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              The queue starts once you start a session on the Dashboard.
            </p>
          )}
          <QueuePanel waitingPlayers={waitingPlayers} title="Waiting" initialVisibleCount={10} visibleStep={10} />
        </section>
      </div>
    </div>
  );
}

function RosterRow({
  player,
  isOnCourt,
  availableLevels,
  onStatusChange,
  onSave,
  onRemove,
}: {
  player: Player;
  isOnCourt: boolean;
  availableLevels: SkillLevel[];
  onStatusChange: (status: PlayerStatus) => void;
  onSave: (changes: { name: string; gender: Gender; skillLevel: SkillLevel }) => Promise<string | undefined>;
  onRemove: () => Promise<string | undefined>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [draftName, setDraftName] = useState(player.name);
  const [draftGender, setDraftGender] = useState<Gender>(player.gender);
  const [draftLevel, setDraftLevel] = useState<SkillLevel>(player.skillLevel);
  const [error, setError] = useState<string>();
  const status = getPlayerStatus(player);
  const levelOptions = availableLevels.includes(player.skillLevel)
    ? availableLevels
    : [player.skillLevel, ...availableLevels];

  const startEditing = () => {
    setDraftName(player.name);
    setDraftGender(player.gender);
    setDraftLevel(player.skillLevel);
    setError(undefined);
    setConfirmingRemove(false);
    setIsEditing(true);
  };

  const save = async () => {
    const result = await onSave({ name: draftName, gender: draftGender, skillLevel: draftLevel });
    setError(result);
    if (!result) {
      setIsEditing(false);
    }
  };

  const remove = async () => {
    const result = await onRemove();
    setError(result);
    setConfirmingRemove(false);
  };

  return (
    <div className="rounded-2xl border border-(--border) bg-(--surface) p-3 shadow-(--shadow-soft)">
      {isEditing ? (
        <div className="grid gap-2">
          <input
            aria-label={`Name for ${player.name}`}
            className="canvas-input w-full"
            value={draftName}
            maxLength={MAX_PLAYER_NAME_LENGTH}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void save()}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Gender"
              className="canvas-input app-select w-full"
              value={draftGender}
              onChange={(e) => setDraftGender(e.target.value as Gender)}
            >
              {DEUCE_GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <select
              aria-label="Skill level"
              className="canvas-input app-select w-full"
              value={draftLevel}
              onChange={(e) => setDraftLevel(e.target.value as SkillLevel)}
            >
              {levelOptions.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-canvas-ghost px-4 py-2 text-sm" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
            <button type="button" className="btn-canvas-primary px-4 py-2 text-sm" onClick={() => void save()}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-(--text)">{player.name}</p>
            <p className="text-xs text-(--text-2)">
              {player.skillLevel} · {player.gender} · {player.gamesPlayed}{" "}
              {player.gamesPlayed === 1 ? "game" : "games"}
              {isOnCourt ? " · on court" : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label={`Status for ${player.name}`} className="flex gap-1">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={status === option.value}
                  className={`pill-toggle ${
                    status !== option.value
                      ? "pill-toggle-off"
                      : option.value === "break"
                        ? "bg-amber-100 text-amber-900 ring-1 ring-amber-200/80"
                        : option.value === "left"
                          ? "bg-slate-200 text-slate-700 ring-1 ring-slate-300"
                          : "pill-toggle-on"
                  }`}
                  onClick={() => onStatusChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button type="button" className="pill-toggle pill-toggle-off" onClick={startEditing}>
              Edit
            </button>
            {confirmingRemove ? (
              <>
                <button
                  type="button"
                  className="pill-toggle bg-red-600 text-white"
                  onClick={() => void remove()}
                >
                  Confirm remove
                </button>
                <button
                  type="button"
                  className="pill-toggle pill-toggle-off"
                  onClick={() => setConfirmingRemove(false)}
                >
                  Keep
                </button>
              </>
            ) : (
              <button
                type="button"
                className="pill-toggle bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                onClick={() => {
                  setError(undefined);
                  setConfirmingRemove(true);
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
