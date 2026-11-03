import { describe, expect, it } from "vitest";
import {
  MAX_WAIT_PRIORITY_MINUTES,
  getBestBalancedTeams,
  getPartnerKey,
  getPriorityScore,
  getRecentPairKeys,
  pickAutoFillGroup,
  sortPlayersForQueue,
} from "./queue";
import { ids, makePlayer } from "@/test/factories";
import type { Player } from "./types";

const teamIds = (pairing: [[Player, Player], [Player, Player]]) =>
  pairing.map((team) => ids(team).sort().join("+")).sort();

describe("sortPlayersForQueue", () => {
  it("puts players with fewer games first", () => {
    const queue = sortPlayersForQueue([
      makePlayer("two", { gamesPlayed: 2, waitedMinutes: 10 }),
      makePlayer("zero", { gamesPlayed: 0 }),
      makePlayer("one", { gamesPlayed: 1, waitedMinutes: 5 }),
    ]);
    expect(ids(queue)).toEqual(["zero", "one", "two"]);
  });

  it("puts the longest wait first among players with the same games", () => {
    const queue = sortPlayersForQueue([
      makePlayer("short", { gamesPlayed: 1, waitedMinutes: 2 }),
      makePlayer("long", { gamesPlayed: 1, waitedMinutes: 9 }),
      makePlayer("mid", { gamesPlayed: 1, waitedMinutes: 5 }),
    ]);
    expect(ids(queue)).toEqual(["long", "mid", "short"]);
  });

  it(`moves anyone waiting ${MAX_WAIT_PRIORITY_MINUTES}+ minutes ahead of players with fewer games`, () => {
    const queue = sortPlayersForQueue([
      makePlayer("fresh", { gamesPlayed: 0 }),
      makePlayer("stuck", { gamesPlayed: 3, waitedMinutes: MAX_WAIT_PRIORITY_MINUTES }),
    ]);
    expect(ids(queue)).toEqual(["stuck", "fresh"]);
  });

  it("breaks full ties by skill order, then name", () => {
    const now = Date.now();
    const queue = sortPlayersForQueue([
      makePlayer("Zed", { skillLevel: "Advanced", waitStartedAt: now }),
      makePlayer("Bo", { skillLevel: "Beginner", waitStartedAt: now }),
      makePlayer("Al", { skillLevel: "Beginner", waitStartedAt: now }),
    ]);
    expect(ids(queue)).toEqual(["Al", "Bo", "Zed"]);
  });

  it("does not change the input array", () => {
    const players = [makePlayer("b", { gamesPlayed: 1 }), makePlayer("a")];
    sortPlayersForQueue(players);
    expect(ids(players)).toEqual(["b", "a"]);
  });
});

describe("getPriorityScore", () => {
  it("weights each game played as 100 minutes of waiting", () => {
    expect(getPriorityScore(makePlayer("p", { gamesPlayed: 2, waitedMinutes: 15 }))).toBe(185);
  });
});

describe("getBestBalancedTeams", () => {
  it("pairs strong with weak so the two teams are even", () => {
    const result = getBestBalancedTeams([
      makePlayer("adv1", { skillLevel: "Advanced" }),
      makePlayer("adv2", { skillLevel: "Advanced" }),
      makePlayer("beg1", { skillLevel: "Beginner" }),
      makePlayer("beg2", { skillLevel: "Beginner" }),
    ]);
    expect(result.gap).toBe(0);
    expect(teamIds(result.pairing)).toEqual(["adv1+beg1", "adv2+beg2"].sort());
  });

  it("avoids repeating last game's partners when teams stay balanced", () => {
    const players = ["a", "b", "c", "d"].map((id) => makePlayer(id)) as [Player, Player, Player, Player];
    expect(teamIds(getBestBalancedTeams(players).pairing)).toEqual(["a+b", "c+d"]);

    const recent = new Set([getPartnerKey("a", "b")]);
    const result = getBestBalancedTeams(players, recent);
    expect(result.repeatedPartners).toBe(0);
    expect(teamIds(result.pairing)).not.toContain("a+b");
  });

  it("keeps teams balanced rather than forcing a lopsided split to avoid a repeat", () => {
    const players = [
      makePlayer("adv1", { skillLevel: "Advanced" }),
      makePlayer("beg1", { skillLevel: "Beginner" }),
      makePlayer("adv2", { skillLevel: "Advanced" }),
      makePlayer("beg2", { skillLevel: "Beginner" }),
    ] as [Player, Player, Player, Player];
    const result = getBestBalancedTeams(players, new Set([getPartnerKey("adv1", "beg1")]));
    expect(result.gap).toBe(0);
  });
});

describe("getRecentPairKeys", () => {
  it("only uses each player's most recent game", () => {
    const { partnerKeys, matchmateKeys } = getRecentPairKeys([
      { teamAPlayerIds: ["a", "b"], teamBPlayerIds: ["c", "d"] },
      // Older game: everyone here has a newer one above, so it is ignored.
      { teamAPlayerIds: ["a", "c"], teamBPlayerIds: ["b", "d"] },
    ]);
    expect(partnerKeys.has(getPartnerKey("a", "b"))).toBe(true);
    expect(partnerKeys.has(getPartnerKey("a", "c"))).toBe(false);
    expect(matchmateKeys.size).toBe(6);
  });

  it("uses an older game for players who haven't played since", () => {
    const { partnerKeys } = getRecentPairKeys([
      { teamAPlayerIds: ["a", "b"], teamBPlayerIds: ["c", "d"] },
      { teamAPlayerIds: ["e", "f"], teamBPlayerIds: ["g", "h"] },
    ]);
    expect(partnerKeys.has(getPartnerKey("e", "f"))).toBe(true);
  });
});

describe("pickAutoFillGroup", () => {
  it("returns null with fewer than four waiting", () => {
    expect(pickAutoFillGroup([makePlayer("a"), makePlayer("b"), makePlayer("c")])).toBeNull();
  });

  it("takes the next four when they already make even teams", () => {
    const queue = ["a", "b", "c", "d", "e", "f"].map((id) => makePlayer(id));
    const group = pickAutoFillGroup(queue)!;
    expect(ids(group.players).sort()).toEqual(["a", "b", "c", "d"]);
    expect(group.skipped).toEqual([]);
  });

  it("swaps in a player just behind when the next four can't be balanced", () => {
    const queue = [
      makePlayer("Cy", { skillLevel: "Advanced" }),
      makePlayer("Lou"),
      makePlayer("Kit"),
      makePlayer("Eve", { skillLevel: "Intermediate" }),
      makePlayer("Ana", { skillLevel: "Advanced" }),
      makePlayer("Gia"),
    ];
    const group = pickAutoFillGroup(queue)!;
    expect(ids(group.players)).toContain("Ana");
    expect(ids(group.skipped)).toEqual(["Eve"]);
    expect(group.gap).toBe(0);
  });

  it("never swaps in someone who has played more games", () => {
    const queue = [
      makePlayer("Cy", { skillLevel: "Advanced", gamesPlayed: 1 }),
      makePlayer("Lou", { gamesPlayed: 1 }),
      makePlayer("Kit", { gamesPlayed: 1 }),
      makePlayer("Eve", { skillLevel: "Intermediate", gamesPlayed: 1 }),
      makePlayer("Ana", { skillLevel: "Advanced", gamesPlayed: 2 }),
      makePlayer("Gia", { gamesPlayed: 2 }),
    ];
    const group = pickAutoFillGroup(queue)!;
    expect(ids(group.players).sort()).toEqual(["Cy", "Eve", "Kit", "Lou"]);
  });

  it("never passes over the first two in line", () => {
    // Dropping "second" (Intermediate) for "fifth" (Advanced) would give perfectly even teams,
    // but the first two in line must always play.
    const queue = [
      makePlayer("first", { skillLevel: "Advanced" }),
      makePlayer("second", { skillLevel: "Intermediate" }),
      makePlayer("third"),
      makePlayer("fourth"),
      makePlayer("fifth", { skillLevel: "Advanced" }),
      makePlayer("sixth"),
    ];
    const group = pickAutoFillGroup(queue)!;
    expect(ids(group.players)).toEqual(expect.arrayContaining(["first", "second"]));
  });

  it(`never passes over someone who has waited ${MAX_WAIT_PRIORITY_MINUTES}+ minutes`, () => {
    const queue = [
      makePlayer("Cy", { skillLevel: "Advanced" }),
      makePlayer("Lou"),
      makePlayer("Kit"),
      makePlayer("Eve", { skillLevel: "Intermediate", waitedMinutes: 35 }),
      makePlayer("Ana", { skillLevel: "Advanced" }),
      makePlayer("Gia"),
    ];
    const group = pickAutoFillGroup(queue)!;
    expect(ids(group.players)).toContain("Eve");
  });

  it("mixes in a new player when the same four played together last game", () => {
    const queue = ["a", "b", "c", "d", "e", "f"].map((id) => makePlayer(id));
    const recent = getRecentPairKeys([{ teamAPlayerIds: ["a", "b"], teamBPlayerIds: ["c", "d"] }]);
    const group = pickAutoFillGroup(queue, recent)!;
    expect(group.skipped).toHaveLength(1);
    expect(ids(group.players)).toEqual(expect.arrayContaining(["a", "b"]));
  });

  it("returns four distinct players ordered as Team A then Team B", () => {
    const queue = ["a", "b", "c", "d", "e", "f"].map((id) => makePlayer(id));
    const group = pickAutoFillGroup(queue)!;
    expect(new Set(ids(group.players)).size).toBe(4);
  });
});
