"use client";

type StartSessionModalProps = {
  open: boolean;
  playerCount: number;
  onClose: () => void;
  onKeepPlayers: () => void;
  onClearPlayers: () => void;
};

export function StartSessionModal({
  open,
  playerCount,
  onClose,
  onKeepPlayers,
  onClearPlayers,
}: StartSessionModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-(--border) bg-(--surface) p-5 shadow-(--shadow-lift)">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--text-muted)">
          Start session
        </p>
        <h2 className="font-display mt-2 text-2xl font-semibold text-(--accent-on-light)">
          Clear current players?
        </h2>
        <p className="mt-2 text-sm text-(--text-2)">
          You currently have {playerCount} player{playerCount === 1 ? "" : "s"} in the roster.
        </p>
        <p className="mt-1 text-sm text-(--text-2)">
          Keep them if this is the same group, or clear the list to start fresh for a new session.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <button type="button" className="btn-canvas-ghost px-4 py-2.5 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-canvas-ghost px-4 py-2.5 text-sm" onClick={onKeepPlayers}>
            Keep players
          </button>
          <button type="button" className="btn-court-primary px-4 py-2.5 text-sm" onClick={onClearPlayers}>
            Clear players
          </button>
        </div>
      </div>
    </div>
  );
}
