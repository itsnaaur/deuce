"use client";

type EndSessionModalProps = {
  open: boolean;
  sessionName: string;
  liveCourtLabels: string[];
  onClose: () => void;
  onConfirm: () => void;
};

export function EndSessionModal({ open, sessionName, liveCourtLabels, onClose, onConfirm }: EndSessionModalProps) {
  if (!open) {
    return null;
  }

  const liveCount = liveCourtLabels.length;

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="end-session-title"
        className="w-full max-w-md rounded-2xl border border-(--border) bg-(--surface) p-5 shadow-(--shadow-lift)"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--text-muted)">End session</p>
        <h2 id="end-session-title" className="font-display mt-2 text-2xl font-semibold text-(--accent-on-light)">
          End {sessionName}?
        </h2>
        <p className="mt-2 text-sm text-(--text-2)">
          Games played reset to zero and every court is cleared. Finished matches stay in Stats.
        </p>
        {liveCount > 0 ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {liveCourtLabels.join(", ")} {liveCount === 1 ? "has a match" : "have matches"} in progress.{" "}
            {liveCount === 1 ? "It" : "They"} will be discarded without a result. End {liveCount === 1 ? "it" : "them"}{" "}
            on the Courts page first to keep the score.
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button type="button" className="btn-canvas-ghost px-4 py-2.5 text-sm" onClick={onClose} autoFocus>
            Keep playing
          </button>
          <button type="button" className="btn-court-end px-4 py-2.5 text-sm" onClick={onConfirm}>
            End session
          </button>
        </div>
      </div>
    </div>
  );
}
