"use client";

import { memo, useId, useMemo } from "react";
import { motion } from "framer-motion";
import { usePerformanceMode } from "@/hooks/use-performance-mode";
import type { Player } from "@/lib/types";

type BadmintonCourtProps = {
  label: string;
  isActive: boolean;
  slots: { position: 1 | 2 | 3 | 4; playerId?: string }[];
  playerById: Map<string, Player>;
  waitingPlayers: Player[];
  disabled: boolean;
  onAssign: (playerId: string, position: number) => void;
  onClear: (position: number) => void;
  onStart: () => void;
  onEnd: () => void;
  onAutoFill?: () => void;
  startPending?: boolean;
  /** Large vertical cards for mobile umpire view */
  variant?: "default" | "umpire";
};

/**
 * Bird's-eye doubles court — net vertical; 1–2 left half, 3–4 right half.
 */
export const BadmintonCourtView = memo(function BadmintonCourtView({
  label,
  isActive,
  slots,
  playerById,
  waitingPlayers,
  disabled,
  onAssign,
  onClear,
  onStart,
  onEnd,
  onAutoFill,
  startPending = false,
  variant = "default",
}: BadmintonCourtProps) {
  const gid = useId().replace(/:/g, "");
  const isUmpire = variant === "umpire";
  const { reducedMotion } = usePerformanceMode();

  const slotPlayers = useMemo(() => {
    const next = new Map<number, Player | undefined>();
    for (const slot of slots) {
      next.set(slot.position, slot.playerId ? playerById.get(slot.playerId) : undefined);
    }
    return next;
  }, [playerById, slots]);

  const getPlayer = (position: number) => slotPlayers.get(position);
  const isCourtEmpty = slots.every((slot) => !slot.playerId);

  return (
    <article
      className={`card-elevated flex flex-col overflow-hidden shadow-(--shadow-lift) ${
        isUmpire ? "rounded-3xl ring-1 ring-black/6" : ""
      }`}
    >
      <header
        className={`flex items-start justify-between gap-4 border-b border-(--border) px-6 ${isUmpire ? "py-6 md:py-8" : "py-5"}`}
      >
        <div>
          <h3
            className={`font-display font-semibold tracking-tight text-(--accent-on-light) ${isUmpire ? "text-2xl md:text-3xl lg:text-4xl" : "text-xl"}`}
          >
            {label}
          </h3>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.15em] text-(--text-muted)">
            {isActive ? "Match in progress" : "Build Team A vs Team B"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold md:px-4 md:py-2 md:text-xs ${
            isActive
              ? "bg-(--accent-on-light) text-white"
              : "bg-(--surface-2) text-(--text-2)"
          }`}
        >
          {isActive ? "Live" : "Ready"}
        </span>
      </header>

      <div className={`relative px-5 pb-2 pt-5 sm:px-6 ${isUmpire ? "px-4 sm:px-5" : ""}`}>
        <div
          className={`court-surface relative mx-auto w-full overflow-hidden rounded-2xl ring-1 ring-black/10 ${
            isUmpire
              ? "aspect-88/132 max-w-[24rem] min-h-105 sm:aspect-100/130 sm:max-w-md sm:min-h-115 md:aspect-134/78 md:max-w-none md:min-h-85 lg:min-h-100"
              : "aspect-134/76 max-w-xl"
          }`}
        >
          <svg
            className="pointer-events-none absolute inset-0 z-0 h-full w-full md:hidden"
            viewBox="0 0 76 134"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
            <defs>
              <linearGradient id={`${gid}-grass-mobile`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--court-b)" />
                <stop offset="100%" stopColor="var(--court-a)" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="76" height="134" fill="#0d3d28" rx="1.2" />
            <rect
              x="1.2"
              y="1.2"
              width="73.6"
              height="131.6"
              rx="0.6"
              fill={`url(#${gid}-grass-mobile)`}
              stroke="var(--court-line)"
              strokeWidth="0.85"
            />
            <image
              href="/branding/deuce-icon-logo.png"
              x="20"
              y="49"
              width="36"
              height="36"
              preserveAspectRatio="xMidYMid meet"
              opacity="0.34"
            />
            {/* Net (portrait/mobile) */}
            <line x1="1.2" y1="67" x2="74.8" y2="67" stroke="var(--court-line)" strokeWidth="0.9" opacity="1" />
            <line x1="0.4" y1="67" x2="3" y2="67" stroke="var(--court-line)" strokeWidth="1.4" />
            <line x1="73" y1="67" x2="75.6" y2="67" stroke="var(--court-line)" strokeWidth="1.4" />
            {/* Badminton doubles markings (portrait/mobile) */}
            <line x1="6.75" y1="1.2" x2="6.75" y2="132.8" stroke="var(--court-line)" strokeWidth="0.35" opacity="0.8" />
            <line x1="69.25" y1="1.2" x2="69.25" y2="132.8" stroke="var(--court-line)" strokeWidth="0.35" opacity="0.8" />
            <line x1="1.2" y1="47.55" x2="74.8" y2="47.55" stroke="var(--court-line)" strokeWidth="0.38" opacity="0.88" />
            <line x1="1.2" y1="86.45" x2="74.8" y2="86.45" stroke="var(--court-line)" strokeWidth="0.38" opacity="0.88" />
            <line x1="1.2" y1="8.65" x2="74.8" y2="8.65" stroke="var(--court-line)" strokeWidth="0.3" opacity="0.72" />
            <line x1="1.2" y1="125.35" x2="74.8" y2="125.35" stroke="var(--court-line)" strokeWidth="0.3" opacity="0.72" />
            <line x1="38" y1="8.65" x2="38" y2="47.55" stroke="var(--court-line)" strokeWidth="0.3" opacity="0.65" />
            <line x1="38" y1="86.45" x2="38" y2="125.35" stroke="var(--court-line)" strokeWidth="0.3" opacity="0.65" />
          </svg>
          <svg
            className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full md:block"
            viewBox="0 0 134 76"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
            <defs>
              <linearGradient id={`${gid}-grass`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--court-b)" />
                <stop offset="100%" stopColor="var(--court-a)" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="134" height="76" fill="#0d3d28" rx="1.2" />
            <rect
              x="1.2"
              y="1.2"
              width="131.6"
              height="73.6"
              rx="0.6"
              fill={`url(#${gid}-grass)`}
              stroke="var(--court-line)"
              strokeWidth="0.85"
            />
            <image
              href="/branding/deuce-icon-logo.png"
              x="52"
              y="22"
              width="30"
              height="30"
              preserveAspectRatio="xMidYMid meet"
              opacity="0.34"
            />
            {/* Net */}
            <line x1="67" y1="1.2" x2="67" y2="74.8" stroke="var(--court-line)" strokeWidth="0.9" opacity="1" />
            <line x1="67" y1="0.4" x2="67" y2="3" stroke="var(--court-line)" strokeWidth="1.4" />
            <line x1="67" y1="73" x2="67" y2="75.6" stroke="var(--court-line)" strokeWidth="1.4" />
            {/* Badminton doubles markings (scaled from regulation dimensions) */}
            {/* Singles side lines (inner side boundaries) */}
            <line x1="1.2" y1="6.75" x2="132.8" y2="6.75" stroke="var(--court-line)" strokeWidth="0.35" opacity="0.8" />
            <line x1="1.2" y1="69.25" x2="132.8" y2="69.25" stroke="var(--court-line)" strokeWidth="0.35" opacity="0.8" />
            {/* Short service lines */}
            <line x1="47.55" y1="1.2" x2="47.55" y2="74.8" stroke="var(--court-line)" strokeWidth="0.38" opacity="0.88" />
            <line x1="86.45" y1="1.2" x2="86.45" y2="74.8" stroke="var(--court-line)" strokeWidth="0.38" opacity="0.88" />
            {/* Doubles long service lines (0.76m from each back boundary) */}
            <line x1="8.65" y1="1.2" x2="8.65" y2="74.8" stroke="var(--court-line)" strokeWidth="0.3" opacity="0.72" />
            <line x1="125.35" y1="1.2" x2="125.35" y2="74.8" stroke="var(--court-line)" strokeWidth="0.3" opacity="0.72" />
            {/* Center service line (left and right courts) */}
            <line x1="8.65" y1="38" x2="47.55" y2="38" stroke="var(--court-line)" strokeWidth="0.3" opacity="0.65" />
            <line x1="86.45" y1="38" x2="125.35" y2="38" stroke="var(--court-line)" strokeWidth="0.3" opacity="0.65" />
          </svg>

          <div className="absolute inset-[5.5%] z-10 md:hidden">
            <div className="mx-auto grid h-full w-full max-w-[86%] content-between py-[12%]">
              <TeamPod
                teamLabel="Team A"
                positions={[1, 2]}
                getPlayer={getPlayer}
                disabled={disabled}
                waitingPlayers={waitingPlayers}
                onAssign={onAssign}
                onClear={onClear}
                large={isUmpire}
                reducedMotion={reducedMotion}
              />
              <TeamPod
                teamLabel="Team B"
                positions={[3, 4]}
                getPlayer={getPlayer}
                disabled={disabled}
                waitingPlayers={waitingPlayers}
                onAssign={onAssign}
                onClear={onClear}
                large={isUmpire}
                reducedMotion={reducedMotion}
              />
            </div>
          </div>
          <div className="absolute inset-[5.5%] z-10 hidden md:block">
            <div className="mx-auto grid h-full w-full max-w-[98%] content-center gap-[4%] md:grid-cols-2 lg:max-w-[94%]">
              <TeamPod
                teamLabel="Team A"
                positions={[1, 2]}
                getPlayer={getPlayer}
                disabled={disabled}
                waitingPlayers={waitingPlayers}
                onAssign={onAssign}
                onClear={onClear}
                large={isUmpire}
                reducedMotion={reducedMotion}
              />
              <TeamPod
                teamLabel="Team B"
                positions={[3, 4]}
                getPlayer={getPlayer}
                disabled={disabled}
                waitingPlayers={waitingPlayers}
                onAssign={onAssign}
                onClear={onClear}
                large={isUmpire}
                reducedMotion={reducedMotion}
              />
            </div>
          </div>
        </div>
      </div>

      <footer
        className={`mt-auto border-t border-(--border) px-5 sm:px-6 ${
          isUmpire ? "py-4 md:py-5" : "py-4"
        }`}
      >
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 md:gap-3">
          <button
            type="button"
            disabled={disabled || !isCourtEmpty || waitingPlayers.length < 4}
            onClick={onAutoFill}
            className={`btn-canvas-ghost w-full ${
              isUmpire ? "py-2.5 text-sm sm:py-3 sm:text-base md:py-3.5 md:text-base lg:py-4 lg:text-lg" : "py-3 text-sm"
            }`}
          >
            Auto-fill
          </button>
          <button
            type="button"
            disabled={disabled || isActive || startPending}
            onClick={onStart}
            className={`btn-court-primary w-full ${
              isUmpire ? "py-2.5 text-sm sm:py-3 sm:text-base md:py-3.5 md:text-base lg:py-4 lg:text-lg" : "py-3 text-sm"
            }`}
          >
            {startPending ? "Starting..." : "Start match"}
          </button>
          <button
            type="button"
            disabled={!isActive}
            onClick={onEnd}
            className={`btn-court-end w-full ${
              isUmpire ? "py-2.5 text-sm sm:py-3 sm:text-base md:py-3.5 md:text-base lg:py-4 lg:text-lg" : "py-3 text-sm"
            }`}
          >
            End match
          </button>
        </div>
      </footer>
    </article>
  );
});

function TeamPod({
  teamLabel,
  positions,
  getPlayer,
  disabled,
  waitingPlayers,
  onAssign,
  onClear,
  large,
  reducedMotion,
}: {
  teamLabel: string;
  positions: [1 | 2 | 3 | 4, 1 | 2 | 3 | 4];
  getPlayer: (position: number) => Player | undefined;
  disabled: boolean;
  waitingPlayers: Player[];
  onAssign: (playerId: string, position: number) => void;
  onClear: (position: number) => void;
  large: boolean;
  reducedMotion: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-white/25 bg-black/10 p-1.5 md:gap-2 md:p-3">
      <span
        className={`font-bold uppercase tracking-[0.12em] text-white/85 ${large ? "text-[9px] md:text-xs" : "text-[9px]"}`}
      >
        {teamLabel}
      </span>
      <div className="grid grid-cols-1 gap-1.5 rounded-lg border border-white/20 bg-black/15 p-1.5 md:gap-2 md:p-2">
        <TeamMemberSlot
          position={positions[0]}
          player={getPlayer(positions[0])}
          disabled={disabled}
          waitingPlayers={waitingPlayers}
          onAssign={onAssign}
          onClear={onClear}
          large={large}
          reducedMotion={reducedMotion}
        />
        <TeamMemberSlot
          position={positions[1]}
          player={getPlayer(positions[1])}
          disabled={disabled}
          waitingPlayers={waitingPlayers}
          onAssign={onAssign}
          onClear={onClear}
          large={large}
          reducedMotion={reducedMotion}
        />
      </div>
    </div>
  );
}

function TeamMemberSlot({
  position,
  player,
  disabled,
  waitingPlayers,
  onAssign,
  onClear,
  large,
  reducedMotion,
}: {
  position: number;
  player: Player | undefined;
  disabled: boolean;
  waitingPlayers: Player[];
  onAssign: (playerId: string, position: number) => void;
  onClear: (position: number) => void;
  large: boolean;
  reducedMotion: boolean;
}) {
  if (player) {
    if (reducedMotion) {
      return (
        <div className="min-w-0 rounded-md bg-white/10 px-1.5 py-1 md:px-2 md:py-1.5">
          <p
            className={`truncate font-semibold leading-tight text-white ${large ? "text-[11px] sm:text-sm md:text-base" : "text-xs"}`}
            title={player.name}
          >
            {player.name}
          </p>
          <p
            className={`truncate text-white/75 ${large ? "text-[10px] sm:text-xs md:text-sm" : "text-[10px]"}`}
            title={`${player.skillLevel} · ${player.gender}`}
          >
            {player.skillLevel} · {player.gender}
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onClear(position)}
            className="mt-1 rounded-md bg-black/25 px-1.5 py-0.5 text-[9px] font-medium text-white transition hover:bg-black/35 disabled:cursor-not-allowed disabled:opacity-50 md:px-2 md:text-[10px]"
          >
            Remove
          </button>
        </div>
      );
    }

    return (
      <motion.div
        layoutId={`queue-player-${player.id}`}
        className="min-w-0 rounded-md bg-white/10 px-1.5 py-1 md:px-2 md:py-1.5"
      >
        <p
          className={`truncate font-semibold leading-tight text-white ${large ? "text-[11px] sm:text-sm md:text-base" : "text-xs"}`}
          title={player.name}
        >
          {player.name}
        </p>
        <p
          className={`truncate text-white/75 ${large ? "text-[10px] sm:text-xs md:text-sm" : "text-[10px]"}`}
          title={`${player.skillLevel} · ${player.gender}`}
        >
          {player.skillLevel} · {player.gender}
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onClear(position)}
          className="mt-1 rounded-md bg-black/25 px-1.5 py-0.5 text-[9px] font-medium text-white transition hover:bg-black/35 disabled:cursor-not-allowed disabled:opacity-50 md:px-2 md:text-[10px]"
        >
          Remove
        </button>
      </motion.div>
    );
  }

  return (
    <select
      disabled={disabled}
      className={`court-select w-full rounded-md border border-white/30 bg-white px-1.5 py-1.5 font-medium text-(--text) outline-none ring-offset-2 focus:ring-2 focus:ring-(--accent-on-light) disabled:cursor-not-allowed disabled:opacity-50 md:px-2 ${large ? "text-[10px] sm:text-xs md:text-sm" : "text-xs"}`}
      value=""
      onChange={(e) => {
        if (e.target.value) onAssign(e.target.value, position);
      }}
    >
      <option value="">Player…</option>
      {waitingPlayers.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

