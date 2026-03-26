import type { Player, SkillLevel } from "./types";
import { getNormalizedSkillValue, getSkillPowerValue } from "./skill";

const levelOrder: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  I: 9,
  J: 10,
  K: 11,
  Beginner: 12,
  Intermediate: 13,
  Advanced: 14,
};
export const getSkillValue = (level: SkillLevel) => getNormalizedSkillValue(level);

export const getWaitMinutes = (waitStartedAt: number) =>
  Math.max(0, Math.floor((Date.now() - waitStartedAt) / 60000));

export const getPriorityScore = (player: Player) => player.gamesPlayed * 100 - getWaitMinutes(player.waitStartedAt);
export const MAX_WAIT_PRIORITY_MINUTES = 30;

export const sortPlayersForQueue = (players: Player[]) =>
  [...players].sort((a, b) => {
    const aWait = getWaitMinutes(a.waitStartedAt);
    const bWait = getWaitMinutes(b.waitStartedAt);
    const aExceededMaxWait = aWait >= MAX_WAIT_PRIORITY_MINUTES;
    const bExceededMaxWait = bWait >= MAX_WAIT_PRIORITY_MINUTES;

    // Anti-stagnation rule: once a player waits past threshold, they get immediate queue priority.
    if (aExceededMaxWait !== bExceededMaxWait) {
      return aExceededMaxWait ? -1 : 1;
    }

    const scoreDiff = getPriorityScore(a) - getPriorityScore(b);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    if (a.gamesPlayed !== b.gamesPlayed) {
      return a.gamesPlayed - b.gamesPlayed;
    }

    if (a.waitStartedAt !== b.waitStartedAt) {
      return a.waitStartedAt - b.waitStartedAt;
    }

    const aLevel = levelOrder[a.skillLevel] ?? 999;
    const bLevel = levelOrder[b.skillLevel] ?? 999;
    if (aLevel !== bLevel) {
      return aLevel - bLevel;
    }

    return a.name.localeCompare(b.name);
  });

export const getBestBalancedTeams = (players: [Player, Player, Player, Player]) => {
  const [p1, p2, p3, p4] = players;
  const pairings: Array<[[Player, Player], [Player, Player]]> = [
    [[p1, p2], [p3, p4]],
    [[p1, p3], [p2, p4]],
    [[p1, p4], [p2, p3]],
  ];

  const scored = pairings.map((pairing) => {
    const [teamA, teamB] = pairing;
    const teamAScore = getSkillPowerValue(teamA[0].skillLevel) + getSkillPowerValue(teamA[1].skillLevel);
    const teamBScore = getSkillPowerValue(teamB[0].skillLevel) + getSkillPowerValue(teamB[1].skillLevel);
    return {
      pairing,
      gap: Math.abs(teamAScore - teamBScore),
      teamAScore,
      teamBScore,
    };
  });

  scored.sort((a, b) => a.gap - b.gap);
  return scored[0];
};

// Strongest possible 2-player team minus weakest possible 2-player team.
export const MAX_TEAM_POWER_GAP =
  getSkillPowerValue("A") + getSkillPowerValue("A") - (getSkillPowerValue("K") + getSkillPowerValue("K"));
