"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePerformanceMode } from "@/hooks/use-performance-mode";
import { QueuePanel } from "@/components/queue/queue-panel";
import type { Player } from "@/lib/types";

type QueueDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  waitingPlayers: Player[];
};

/**
 * Umpire queue sheet — phones and tablets (War room). Wider / taller typography on `md+`.
 * Open from the floating button; close via backdrop, Done, or the handle bar.
 */
export function QueueDrawer({ open, onOpenChange, waitingPlayers }: QueueDrawerProps) {
  const { reducedMotion } = usePerformanceMode();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <AnimatePresence mode={reducedMotion ? "sync" : "wait"}>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close queue"
            className="fixed inset-0 z-60 bg-(--glass-overlay) backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? { duration: 0.12 } : undefined}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="queue-drawer-title"
            className="fixed inset-x-0 bottom-0 z-70 flex max-h-[85dvh] flex-col rounded-t-3xl border border-(--glass-border) bg-(--glass-surface) shadow-(--shadow-lift) backdrop-blur-xl md:mx-auto md:max-w-2xl md:rounded-t-4xl lg:max-w-3xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={reducedMotion ? { duration: 0.14, ease: "easeOut" } : { type: "spring", damping: 34, stiffness: 400 }}
          >
            <div className="flex items-center justify-between border-b border-(--border) px-5 py-3 md:px-8 md:py-5">
              <div className="flex flex-col gap-1">
                <span className="mx-auto flex h-1.5 w-12 rounded-full bg-(--border)" aria-hidden />
                <h2
                  id="queue-drawer-title"
                  className="font-display pt-1 text-lg font-bold text-(--accent-on-light) md:text-2xl"
                >
                  Queue
                </h2>
                <p className="text-xs text-(--text-2) md:text-sm">
                  Who&apos;s next — same order as the Queue tab
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl bg-(--surface-2) px-4 py-2 text-sm font-semibold text-(--accent-on-light) md:px-6 md:py-2.5 md:text-base"
                onClick={() => onOpenChange(false)}
              >
                Done
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 md:px-8">
              <QueuePanel waitingPlayers={waitingPlayers} title="Fair wait order" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
