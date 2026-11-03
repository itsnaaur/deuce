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

export const getPartnerKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// Roughly one skill step in team power; enough to prefer new partners when teams are similarly balanced,
// without forcing a lopsided match just to avoid a repeat.
export const REPEAT_PARTNER_PENALTY = 4;

export const getBestBalancedTeams = (
  players: [Player, Player, Player, Player],
  recentPartnerKeys: ReadonlySet<string> = new Set(),
) => {
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
    const gap = Math.abs(teamAScore - teamBScore);
    const repeatedPartners = [teamA, teamB].filter((team) =>
      recentPartnerKeys.has(getPartnerKey(team[0].id, team[1].id)),
    ).length;
    return {
      pairing,
      gap,
      teamAScore,
      teamBScore,
      repeatedPartners,
      cost: gap + repeatedPartners * REPEAT_PARTNER_PENALTY,
    };
  });

  scored.sort((a, b) => a.cost - b.cost || a.gap - b.gap);
  return scored[0];
};

// Strongest possible 2-player team minus weakest possible 2-player team.
export const MAX_TEAM_POWER_GAP =
  getSkillPowerValue("A") + getSkillPowerValue("A") - (getSkillPowerValue("K") + getSkillPowerValue("K"));

type MatchLike = { teamAPlayerIds: [string, string]; teamBPlayerIds: [string, string] };

// Partner and matchmate pairs from each player's most recent game. Matches must be newest first.
export const getRecentPairKeys = (matchesNewestFirst: MatchLike[]) => {
  const seen = new Set<string>();
  const partnerKeys = new Set<string>();
  const matchmateKeys = new Set<string>();
  for (const match of matchesNewestFirst) {
    const ids = [...match.teamAPlayerIds, ...match.teamBPlayerIds];
    const isLatestForSomeone = ids.some((id) => !seen.has(id));
    if (isLatestForSomeone) {
      for (const team of [match.teamAPlayerIds, match.teamBPlayerIds]) {
        partnerKeys.add(getPartnerKey(team[0], team[1]));
      }
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          matchmateKeys.add(getPartnerKey(ids[i], ids[j]));
        }
      }
    }
    ids.forEach((id) => seen.add(id));
  }
  return { partnerKeys, matchmateKeys };
};

// How far down the queue auto-fill may look for a better-balanced or more mixed group.
export const AUTO_FILL_POOL_SIZE = 6;
// Cost of passing over one of the next four in line; roughly one skill step of imbalance.
export const SKIP_PENALTY = 5;
// Cost per pair of players who were in the same game last time, so groups mix between rounds.
export const REPEAT_MATCHMATE_PENALTY = 2;

const combinations = <T,>(items: T[], size: number): T[][] => {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  return [...combinations(rest, size - 1).map((combo) => [first, ...combo]), ...combinations(rest, size)];
};

/**
 * Picks four players for an empty court. Normally the next four in the queue, but it may pass over
 * someone in the next four for a player just behind them when that gives clearly better-balanced
 * teams or avoids the same group replaying. It never passes over the first two in line, anyone who
 * has waited past the anti-stagnation threshold, or anyone with fewer games than a replacement.
 */
export const pickAutoFillGroup = (
  waitingInQueueOrder: Player[],
  recent: { partnerKeys: ReadonlySet<string>; matchmateKeys: ReadonlySet<string> } = {
    partnerKeys: new Set(),
    matchmateKeys: new Set(),
  },
) => {
  if (waitingInQueueOrder.length < 4) {
    return null;
  }
  const nextFour = waitingInQueueOrder.slice(0, 4);
  const mostGamesInNextFour = Math.max(...nextFour.map((p) => p.gamesPlayed));
  const pool = waitingInQueueOrder
    .slice(0, AUTO_FILL_POOL_SIZE)
    .filter((player, index) => index < 4 || player.gamesPlayed <= mostGamesInNextFour);
  const mustPlay = new Set(
    nextFour
      .filter(
        (player, index) =>
          index < 2 ||
          getWaitMinutes(player.waitStartedAt) >= MAX_WAIT_PRIORITY_MINUTES ||
          pool.slice(4).some((replacement) => player.gamesPlayed < replacement.gamesPlayed),
      )
      .map((player) => player.id),
  );

  const candidates = combinations(pool, 4).filter((group) =>
    [...mustPlay].every((id) => group.some((player) => player.id === id)),
  );

  const scored = candidates.map((group) => {
    const balanced = getBestBalancedTeams(group as [Player, Player, Player, Player], recent.partnerKeys);
    const skipped = nextFour.filter((player) => !group.includes(player));
    let repeatMatchmates = 0;
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        if (recent.matchmateKeys.has(getPartnerKey(group[i].id, group[j].id))) {
          repeatMatchmates += 1;
        }
      }
    }
    return {
      balanced,
      skipped,
      repeatMatchmates,
      cost: balanced.cost + skipped.length * SKIP_PENALTY + repeatMatchmates * REPEAT_MATCHMATE_PENALTY,
    };
  });

  scored.sort((a, b) => a.cost - b.cost || a.skipped.length - b.skipped.length);
  const best = scored[0];
  const [teamA, teamB] = best.balanced.pairing;
  return {
    players: [teamA[0], teamA[1], teamB[0], teamB[1]] as [Player, Player, Player, Player],
    gap: best.balanced.gap,
    repeatedPartners: best.balanced.repeatedPartners,
    repeatMatchmates: best.repeatMatchmates,
    skipped: best.skipped,
  };
};
