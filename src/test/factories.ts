import type { Player, SkillLevel } from "@/lib/types";

const MINUTE = 60_000;

/** A waiting player with sensible defaults; `waitedMinutes` is measured back from now. */
export const makePlayer = (
  id: string,
  overrides: Partial<Omit<Player, "id">> & { waitedMinutes?: number } = {},
): Player => {
  const { waitedMinutes = 0, ...rest } = overrides;
  const now = Date.now();
  return {
    id,
    name: id,
    gender: "Male",
    skillLevel: "Beginner" as SkillLevel,
    isActive: true,
    isOnBreak: false,
    gamesPlayed: 0,
    waitStartedAt: now - waitedMinutes * MINUTE,
    createdAt: now,
    updatedAt: now,
    ...rest,
  };
};

export const ids = (players: { id: string }[]) => players.map((player) => player.id);
