"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Player } from "@/lib/types";
import { getWaitMinutes } from "@/lib/queue";

type QueuePanelProps = {
  waitingPlayers: Player[];
  className?: string;
  title?: string;
  subtitle?: string;
};

export function QueuePanel({
  waitingPlayers,
  className = "",
  title = "Next up",
  subtitle = "Fair queue — fewest games, then longest wait.",
}: QueuePanelProps) {
  return (
    <div className={className}>
      <h2 className="font-display text-lg font-semibold text-(--accent-on-light) md:text-xl">{title}</h2>
      <p className="mt-2 text-sm text-(--text-2) md:text-base">{subtitle}</p>
      <div className="mt-4 space-y-2">
        <AnimatePresence mode="popLayout">
          {waitingPlayers.map((player) => {
            const waitMinutes = getWaitMinutes(player.waitStartedAt);
            const isLongWait = waitMinutes > 20;
            return (
            <motion.div
              key={player.id}
              layoutId={`queue-player-${player.id}`}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 shadow-(--shadow-soft) ${
                isLongWait
                  ? "border-amber-300/70 bg-amber-50/70"
                  : "border-(--border) bg-(--surface)"
              }`}
            >
              <div className="min-w-0">
                <p className={`truncate font-medium ${isLongWait ? "text-amber-900" : "text-(--text)"}`}>
                  {player.name}
                </p>
                <p className={`text-[11px] ${isLongWait ? "text-amber-800" : "text-(--text-2)"}`}>
                  {player.gamesPlayed} games · {waitMinutes} min
                </p>
              </div>
              <span
                className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ${
                  isLongWait
                    ? "bg-amber-200/70 text-amber-900"
                    : "bg-(--accent-on-light)/10 text-(--accent-on-light)"
                }`}
              >
                {player.skillLevel}
              </span>
            </motion.div>
            );
          })}
        </AnimatePresence>
        {waitingPlayers.length === 0 && (
          <p className="py-6 text-center text-sm text-(--text-muted)">Nobody waiting.</p>
        )}
      </div>
    </div>
  );
}
