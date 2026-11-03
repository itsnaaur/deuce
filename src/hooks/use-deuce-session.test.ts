// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import type { Gender, SkillLevel } from "@/lib/types";
import { MAX_COURTS, MAX_PLAYER_NAME_LENGTH, useDeuceSession } from "./use-deuce-session";

type Hook = ReturnType<typeof renderSession>;

const renderSession = () => renderHook(() => useDeuceSession());

const resetDatabase = async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
};

/** Render the hook and wait for first-run setup (default settings and two courts). */
const setup = async () => {
  const hook = renderSession();
  await waitFor(() => expect(hook.result.current.courts).toHaveLength(2));
  await waitFor(() => expect(hook.result.current.settings).toBeDefined());
  return hook;
};

/** Type a name (and optionally pick gender/level) the way the Roster form does. */
const typeName = (hook: Hook, name: string, gender?: Gender, level?: SkillLevel) => {
  act(() => {
    hook.result.current.setName(name);
    if (gender) hook.result.current.setGender(gender);
    if (level) hook.result.current.setSkillLevel(level);
  });
};

/** Type a name, then tap Add and wait for the save. Returns the error message, if any. */
const typeAndAdd = async (hook: Hook, name: string, gender?: Gender, level?: SkillLevel) => {
  typeName(hook, name, gender, level);
  let error: string | undefined;
  await act(async () => {
    error = await hook.result.current.addPlayer();
  });
  return error;
};

const addPlayers = async (hook: Hook, names: string[]) => {
  for (const name of names) {
    expect(await typeAndAdd(hook, name)).toBeUndefined();
  }
  await waitFor(() => expect(hook.result.current.players).toHaveLength(names.length));
};

const playerId = (hook: Hook, name: string) => {
  const player = hook.result.current.players.find((p) => p.name === name);
  if (!player) throw new Error(`No player named ${name}`);
  return player.id;
};

const startSession = async (hook: Hook, clearPlayers = false) => {
  await act(async () => {
    await hook.result.current.startSession({ clearPlayers });
  });
  await waitFor(() => expect(hook.result.current.activeSession).toBeDefined());
};

/** Place four named players on a court (positions 1-2 are Team A, 3-4 Team B). */
const fillCourt = async (hook: Hook, courtId: string, names: [string, string, string, string]) => {
  for (const [index, name] of names.entries()) {
    await act(async () => {
      await hook.result.current.assignToCourt(playerId(hook, name), courtId, index + 1);
    });
  }
  await waitFor(() =>
    expect(hook.result.current.courts.find((c) => c.id === courtId)?.slots.every((s) => s.playerId)).toBe(true),
  );
};

const courtLabels = async () =>
  (await db.courts.toArray())
    .map((court) => court.label)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

beforeEach(async () => {
  await resetDatabase();
});

afterEach(() => {
  cleanup();
});

describe("first run", () => {
  it("creates default settings and two empty courts", async () => {
    const hook = await setup();
    expect(hook.result.current.settings?.skillMode).toBe("recreational");
    expect(await courtLabels()).toEqual(["Court 1", "Court 2"]);
    expect(hook.result.current.activeSession).toBeUndefined();
  });
});

describe("adding players", () => {
  it("saves the name, gender and level that were selected", async () => {
    const hook = await setup();
    await typeAndAdd(hook, "  Ana   Cruz ", "Female", "Advanced");
    const [ana] = await db.players.toArray();
    expect(ana).toMatchObject({ name: "Ana Cruz", gender: "Female", skillLevel: "Advanced", isActive: true });
    expect(hook.result.current.name).toBe("");
  });

  it("keeps every player when Add is tapped quickly several times", async () => {
    const hook = await setup();
    const names = ["Ana", "Ben", "Cy", "Dee", "Eve", "Flo", "Gia"];
    const pending: Promise<string | undefined>[] = [];
    for (const name of names) {
      // No awaiting between taps: each add is still in flight when the next starts.
      typeName(hook, name);
      pending.push(hook.result.current.addPlayer());
    }
    await act(async () => {
      await Promise.all(pending);
    });
    const saved = (await db.players.toArray()).map((p) => p.name).sort();
    expect(saved).toEqual([...names].sort());
  });

  it("saves a player once when Add is double-tapped", async () => {
    const hook = await setup();
    typeName(hook, "Ana");
    const first = hook.result.current.addPlayer();
    const second = hook.result.current.addPlayer();
    let results: (string | undefined)[] = [];
    await act(async () => {
      results = await Promise.all([first, second]);
    });
    expect(await db.players.count()).toBe(1);
    expect(results).toEqual([undefined, "Ana is already on the roster."]);
  });

  it("rejects an empty name", async () => {
    const hook = await setup();
    const error = await typeAndAdd(hook, "   ");
    expect(error).toBe("Enter a player name.");
    expect(await db.players.count()).toBe(0);
  });

  it(`rejects names longer than ${MAX_PLAYER_NAME_LENGTH} characters`, async () => {
    const hook = await setup();
    const error = await typeAndAdd(hook, "x".repeat(MAX_PLAYER_NAME_LENGTH + 1));
    expect(error).toMatch(/characters or fewer/);
    expect(await db.players.count()).toBe(0);
  });

  it("rejects a duplicate name regardless of case and keeps the typed text", async () => {
    const hook = await setup();
    await addPlayers(hook, ["Bea"]);
    const error = await typeAndAdd(hook, "BEA");
    expect(error).toBe("BEA is already on the roster.");
    expect(await db.players.count()).toBe(1);
    await waitFor(() => expect(hook.result.current.name).toBe("BEA"));
  });

  it("sorts the roster A to Z", async () => {
    const hook = await setup();
    await addPlayers(hook, ["cy", "Ana", "ben"]);
    expect(hook.result.current.sortedPlayers.map((p) => p.name)).toEqual(["Ana", "ben", "cy"]);
  });
});

describe("editing and removing players", () => {
  it("updates name, gender and level, but not to an existing name", async () => {
    const hook = await setup();
    await addPlayers(hook, ["Ana", "Ben"]);
    const ben = hook.result.current.players.find((p) => p.name === "Ben")!;

    let error: string | undefined;
    await act(async () => {
      error = await hook.result.current.updatePlayer(ben, { name: "ana", gender: "Male", skillLevel: "Beginner" });
    });
    expect(error).toBe("ana is already on the roster.");

    await act(async () => {
      error = await hook.result.current.updatePlayer(ben, {
        name: "Benji",
        gender: "Female",
        skillLevel: "Intermediate",
      });
    });
    expect(error).toBeUndefined();
    expect(await db.players.get(ben.id)).toMatchObject({
      name: "Benji",
      gender: "Female",
      skillLevel: "Intermediate",
    });
  });

  it("won't remove a player who is on a court", async () => {
    const hook = await setup();
    await addPlayers(hook, ["Ana", "Ben"]);
    await startSession(hook);
    await act(async () => {
      await hook.result.current.assignToCourt(playerId(hook, "Ana"), "court-1", 1);
    });

    const ana = hook.result.current.players.find((p) => p.name === "Ana")!;
    let error: string | undefined;
    await act(async () => {
      error = await hook.result.current.removePlayer(ana);
    });
    expect(error).toMatch(/is on a court/);
    expect(await db.players.get(ana.id)).toBeDefined();

    const ben = hook.result.current.players.find((p) => p.name === "Ben")!;
    await act(async () => {
      error = await hook.result.current.removePlayer(ben);
    });
    expect(error).toBeUndefined();
    expect(await db.players.get(ben.id)).toBeUndefined();
  });
});

describe("player status and the queue", () => {
  it("keeps the queue empty until a session starts", async () => {
    const hook = await setup();
    await addPlayers(hook, ["Ana", "Ben", "Cy", "Dee"]);
    expect(hook.result.current.waitingPlayers).toHaveLength(0);

    await startSession(hook);
    await waitFor(() => expect(hook.result.current.waitingPlayers).toHaveLength(4));
  });

  it("leaves out players on a break, players who left, and players on court", async () => {
    const hook = await setup();
    await addPlayers(hook, ["Ana", "Ben", "Cy", "Dee"]);
    await startSession(hook);
    const byName = (name: string) => hook.result.current.players.find((p) => p.name === name)!;

    await act(async () => {
      await hook.result.current.setPlayerStatus(byName("Ana"), "break");
      await hook.result.current.setPlayerStatus(byName("Ben"), "left");
      await hook.result.current.assignToCourt(playerId(hook, "Cy"), "court-1", 1);
    });

    await waitFor(() => expect(hook.result.current.waitingPlayers.map((p) => p.name)).toEqual(["Dee"]));
    expect(byName("Ana")).toMatchObject({ isActive: true, isOnBreak: true });
    expect(byName("Ben")).toMatchObject({ isActive: false, isOnBreak: false });
    // "Active" on the dashboard counts only players available to play.
    expect(hook.result.current.activePlayersCount).toBe(2);
  });

  it("puts a player back in the queue when they return from a break", async () => {
    const hook = await setup();
    await addPlayers(hook, ["Ana"]);
    await startSession(hook);
    const ana = () => hook.result.current.players.find((p) => p.name === "Ana")!;

    await act(async () => {
      await hook.result.current.setPlayerStatus(ana(), "break");
    });
    await waitFor(() => expect(hook.result.current.waitingPlayers).toHaveLength(0));
    await act(async () => {
      await hook.result.current.setPlayerStatus(ana(), "playing");
    });
    await waitFor(() => expect(hook.result.current.waitingPlayers).toHaveLength(1));
  });
});

describe("courts and matches", () => {
  const four = ["Ana", "Ben", "Cy", "Dee"] as const;

  it("won't put the same player on two courts", async () => {
    const hook = await setup();
    await addPlayers(hook, [...four]);
    await startSession(hook);
    await act(async () => {
      await hook.result.current.assignToCourt(playerId(hook, "Ana"), "court-1", 1);
      await hook.result.current.assignToCourt(playerId(hook, "Ana"), "court-2", 1);
    });
    const court2 = await db.courts.get("court-2");
    expect(court2?.slots.every((slot) => !slot.playerId)).toBe(true);
  });

  it("only starts a match with an active session and four players", async () => {
    const hook = await setup();
    await addPlayers(hook, [...four]);

    let started = true;
    await act(async () => {
      started = await hook.result.current.startMatch("court-1");
    });
    expect(started).toBe(false);

    await startSession(hook);
    await act(async () => {
      await hook.result.current.assignToCourt(playerId(hook, "Ana"), "court-1", 1);
      started = await hook.result.current.startMatch("court-1");
    });
    expect(started).toBe(false);

    await fillCourt(hook, "court-1", [...four]);
    await act(async () => {
      started = await hook.result.current.startMatch("court-1");
    });
    expect(started).toBe(true);
    expect((await db.courts.get("court-1"))?.isActive).toBe(true);
  });

  it("records the result, counts the game, and frees the court", async () => {
    const hook = await setup();
    await addPlayers(hook, [...four]);
    await startSession(hook);
    await fillCourt(hook, "court-1", [...four]);
    await act(async () => {
      await hook.result.current.startMatch("court-1");
    });

    let ended = false;
    await act(async () => {
      ended = await hook.result.current.endMatch("court-1", 21, 17);
    });
    expect(ended).toBe(true);

    const [match] = await db.sessionMatches.toArray();
    expect(match).toMatchObject({
      courtLabel: "Court 1",
      scoreA: 21,
      scoreB: 17,
      winner: "A",
      sessionId: hook.result.current.activeSession?.id,
    });
    expect(match.teamAPlayerIds).toEqual([playerId(hook, "Ana"), playerId(hook, "Ben")]);

    const court = await db.courts.get("court-1");
    expect(court?.isActive).toBe(false);
    expect(court?.slots.every((slot) => !slot.playerId)).toBe(true);
    for (const player of await db.players.toArray()) {
      expect(player.gamesPlayed).toBe(1);
    }
  });

  it("records a level score as a draw", async () => {
    const hook = await setup();
    await addPlayers(hook, [...four]);
    await startSession(hook);
    await fillCourt(hook, "court-1", [...four]);
    await act(async () => {
      await hook.result.current.startMatch("court-1");
      await hook.result.current.endMatch("court-1", 15, 15);
    });
    expect((await db.sessionMatches.toArray())[0].winner).toBe("Draw");
  });

  it("won't end a match that isn't running", async () => {
    const hook = await setup();
    let ended = true;
    await act(async () => {
      ended = await hook.result.current.endMatch("court-1", 21, 10);
    });
    expect(ended).toBe(false);
    expect(await db.sessionMatches.count()).toBe(0);
  });

  it("auto-fill keeps players placed by hand and only fills the open spots", async () => {
    const hook = await setup();
    await addPlayers(hook, ["Ana", "Ben", "Cy", "Dee", "Eve"]);
    await startSession(hook);
    await act(async () => {
      await hook.result.current.assignToCourt(playerId(hook, "Eve"), "court-1", 2);
    });

    const keepsEve = [playerId(hook, "Ana"), playerId(hook, "Eve"), playerId(hook, "Ben"), playerId(hook, "Cy")] as [
      string,
      string,
      string,
      string,
    ];
    const movesEve = [playerId(hook, "Eve"), playerId(hook, "Ana"), playerId(hook, "Ben"), playerId(hook, "Cy")] as [
      string,
      string,
      string,
      string,
    ];

    let started = true;
    await act(async () => {
      started = await hook.result.current.startSuggestedMatch("court-1", movesEve);
    });
    expect(started).toBe(false);

    await act(async () => {
      started = await hook.result.current.startSuggestedMatch("court-1", keepsEve);
    });
    expect(started).toBe(true);
    expect((await db.courts.get("court-1"))?.slots.map((slot) => slot.playerId)).toEqual(keepsEve);
  });

  it("won't auto-fill a player who has gone on a break", async () => {
    const hook = await setup();
    await addPlayers(hook, [...four]);
    await startSession(hook);
    await act(async () => {
      await hook.result.current.setPlayerStatus(hook.result.current.players.find((p) => p.name === "Ana")!, "break");
    });

    let started = true;
    await act(async () => {
      started = await hook.result.current.startSuggestedMatch(
        "court-1",
        four.map((name) => playerId(hook, name)) as [string, string, string, string],
      );
    });
    expect(started).toBe(false);
  });
});

describe("court count", () => {
  const setCourts = async (hook: Hook, count: number) => {
    let result: { count: number; error?: string } = { count: 0 };
    await act(async () => {
      result = await hook.result.current.syncCourtsCount(count);
    });
    return result;
  };

  it("adds and removes courts by number, past 9 courts", async () => {
    const hook = await setup();
    await setCourts(hook, 10);
    expect(await courtLabels()).toHaveLength(10);
    await setCourts(hook, 9);
    expect(await courtLabels()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `Court ${n}`));
    await setCourts(hook, 2);
    expect(await courtLabels()).toEqual(["Court 1", "Court 2"]);
    expect((await db.settings.get("default"))?.courtCount).toBe(2);
  });

  it("removes the highest-numbered court, not one with players waiting on it", async () => {
    const hook = await setup();
    await addPlayers(hook, ["Ana"]);
    await startSession(hook);
    await setCourts(hook, 10);
    await act(async () => {
      await hook.result.current.assignToCourt(playerId(hook, "Ana"), "court-9", 1);
    });

    await setCourts(hook, 9);
    expect(await db.courts.get("court-10")).toBeUndefined();
    expect((await db.courts.get("court-9"))?.slots[0].playerId).toBe(playerId(hook, "Ana"));
  });

  it(`caps the number of courts at ${MAX_COURTS}`, async () => {
    const hook = await setup();
    const result = await setCourts(hook, 50);
    expect(result.count).toBe(MAX_COURTS);
    expect(await db.courts.count()).toBe(MAX_COURTS);
  });

  it("never removes a court with a match in progress", async () => {
    const hook = await setup();
    await addPlayers(hook, ["Ana", "Ben", "Cy", "Dee"]);
    await startSession(hook);
    await setCourts(hook, 3);
    await fillCourt(hook, "court-3", ["Ana", "Ben", "Cy", "Dee"]);
    await act(async () => {
      await hook.result.current.startMatch("court-3");
    });

    const toTwo = await setCourts(hook, 2);
    expect(toTwo.error).toBeUndefined();
    expect(await courtLabels()).toEqual(["Court 1", "Court 3"]);

    // Courts 1 and 3 can't both go, and Court 3 is live.
    const tooFew = await setCourts(hook, 1);
    expect(await courtLabels()).toEqual(["Court 3"]);
    expect(tooFew).toEqual({ count: 1 });
  });

  it("explains when live matches stop the count going lower", async () => {
    const hook = await setup();
    await addPlayers(hook, ["Ana", "Ben", "Cy", "Dee", "Eve", "Flo", "Gia", "Hal"]);
    await startSession(hook);
    await fillCourt(hook, "court-1", ["Ana", "Ben", "Cy", "Dee"]);
    await fillCourt(hook, "court-2", ["Eve", "Flo", "Gia", "Hal"]);
    await act(async () => {
      await hook.result.current.startMatch("court-1");
      await hook.result.current.startMatch("court-2");
    });

    const result = await setCourts(hook, 1);
    expect(result.count).toBe(2);
    expect(result.error).toMatch(/in progress/);
    expect(await db.courts.count()).toBe(2);
  });

  it("repairs gaps left by older versions, keeping placed players", async () => {
    const hook = await setup();
    await addPlayers(hook, ["Ana"]);
    // Simulate the old bug's leftovers: Court 1 and Court 10, with a player waiting on Court 10.
    await db.courts.delete("court-2");
    await db.courts.put({
      id: "court-10",
      label: "Court 10",
      isActive: false,
      slots: [{ position: 1, playerId: playerId(hook, "Ana") }, { position: 2 }, { position: 3 }, { position: 4 }],
      updatedAt: Date.now(),
    });

    await setCourts(hook, 2);
    expect(await courtLabels()).toEqual(["Court 1", "Court 2"]);
    expect((await db.courts.get("court-2"))?.slots[0].playerId).toBe(playerId(hook, "Ana"));
  });
});

describe("sessions", () => {
  it("ending a session resets games, breaks and courts but keeps match history", async () => {
    const hook = await setup();
    await addPlayers(hook, ["Ana", "Ben", "Cy", "Dee", "Eve"]);
    await startSession(hook);
    await fillCourt(hook, "court-1", ["Ana", "Ben", "Cy", "Dee"]);
    await act(async () => {
      await hook.result.current.startMatch("court-1");
      await hook.result.current.endMatch("court-1", 21, 12);
      await hook.result.current.setPlayerStatus(hook.result.current.players.find((p) => p.name === "Eve")!, "break");
    });
    await fillCourt(hook, "court-2", ["Ana", "Ben", "Cy", "Dee"]);

    await act(async () => {
      await hook.result.current.endSession();
    });
    await waitFor(() => expect(hook.result.current.activeSession).toBeUndefined());

    for (const player of await db.players.toArray()) {
      expect(player.gamesPlayed).toBe(0);
      expect(player.isOnBreak).toBe(false);
    }
    for (const court of await db.courts.toArray()) {
      expect(court.isActive).toBe(false);
      expect(court.slots.every((slot) => !slot.playerId)).toBe(true);
    }
    expect(await db.sessionMatches.count()).toBe(1);
    expect((await db.sessions.toArray())[0].status).toBe("ended");
  });

  it("numbers sessions and can start fresh with an empty roster and empty courts", async () => {
    const hook = await setup();
    await addPlayers(hook, ["Ana", "Ben"]);
    await startSession(hook);
    await act(async () => {
      await hook.result.current.endSession();
    });
    await waitFor(() => expect(hook.result.current.activeSession).toBeUndefined());

    await startSession(hook, true);
    expect(hook.result.current.activeSession?.name).toBe("Session 2");
    expect(await db.players.count()).toBe(0);
    for (const court of await db.courts.toArray()) {
      expect(court.slots.every((slot) => !slot.playerId)).toBe(true);
    }
  });

  it("won't start a second session while one is active", async () => {
    const hook = await setup();
    await startSession(hook);
    await act(async () => {
      await hook.result.current.startSession();
    });
    expect(await db.sessions.count()).toBe(1);
  });
});

describe("stats", () => {
  it("counts wins, losses and draws per player and leaves draws out of the win rate", async () => {
    const hook = await setup();
    const four = ["Ana", "Ben", "Cy", "Dee"] as const;
    await addPlayers(hook, [...four]);
    await startSession(hook);

    for (const [a, b] of [
      [21, 10],
      [15, 15],
    ]) {
      await fillCourt(hook, "court-1", [...four]);
      await act(async () => {
        await hook.result.current.startMatch("court-1");
        await hook.result.current.endMatch("court-1", a, b);
      });
    }

    await waitFor(() => expect(hook.result.current.scopedSessionMatches).toHaveLength(2));
    const stats = hook.result.current.playerCompetitionStats;
    expect(stats.get(playerId(hook, "Ana"))).toEqual({ wins: 1, losses: 0, draws: 1, matches: 2, winRate: 100 });
    expect(stats.get(playerId(hook, "Cy"))).toEqual({ wins: 0, losses: 1, draws: 1, matches: 2, winRate: 0 });
  });

  it("reset memory erases everything and restores defaults", async () => {
    const hook = await setup();
    await addPlayers(hook, ["Ana"]);
    await startSession(hook);
    await act(async () => {
      await hook.result.current.syncCourtsCount(5);
      await hook.result.current.resetMemory();
    });
    expect(await db.players.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
    expect(await courtLabels()).toEqual(["Court 1", "Court 2"]);
    expect((await db.settings.get("default"))?.courtCount).toBe(2);
  });
});
