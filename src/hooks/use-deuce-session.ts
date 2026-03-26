"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, DEFAULT_SETTINGS, createEmptyCourt } from "@/lib/db";
import { sortPlayersForQueue } from "@/lib/queue";
import { getNormalizedSkillValue } from "@/lib/skill";
import { getNow } from "@/lib/time";
import type {
  Gender,
  LegacySkillMode,
  MatchWinner,
  Player,
  Session,
  SessionMatch,
  SessionSettings,
  SkillLevel,
  SkillMode,
} from "@/lib/types";

const RECREATIONAL_LEVELS: SkillLevel[] = ["Beginner", "Intermediate", "Advanced"];
const COMPETITIVE_LEVELS: SkillLevel[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];

const uid = () => crypto.randomUUID();
const normalizeSkillMode = (mode: SkillMode | LegacySkillMode | undefined): SkillMode => {
  if (mode === "basic") return "recreational";
  if (mode === "advanced") return "competitive";
  return mode ?? "recreational";
};

export function useDeuceSession() {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("Male");

  const settings = useLiveQuery(() => db.settings.get("default"), [], undefined);
  const players = useLiveQuery(() => db.players.toArray(), [], []);
  const courts = useLiveQuery(() => db.courts.toArray(), [], []);
  const sessions = useLiveQuery(() => db.sessions.orderBy("sequence").reverse().toArray(), [], []);
  const sessionMatches = useLiveQuery(
    () => db.sessionMatches.orderBy("endedAt").reverse().toArray(),
    [],
    [],
  );
  const activeSession = useMemo(
    () => sessions.find((session) => session.status === "active"),
    [sessions],
  );
  const scopedSessionMatches = useMemo(
    () =>
      activeSession ? sessionMatches.filter((match) => match.sessionId === activeSession.id) : [],
    [activeSession, sessionMatches],
  );

  const skillMode = normalizeSkillMode(settings?.skillMode as SkillMode | LegacySkillMode | undefined);
  const availableLevels = skillMode === "competitive" ? COMPETITIVE_LEVELS : RECREATIONAL_LEVELS;
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("Beginner");
  const selectedSkillLevel = availableLevels.includes(skillLevel)
    ? skillLevel
    : availableLevels[0];

  useEffect(() => {
    const initialize = async () => {
      // Ask for persistent storage when supported to reduce iOS/browser data eviction risk.
      if (typeof navigator !== "undefined" && navigator.storage?.persist) {
        try {
          await navigator.storage.persist();
        } catch {
          // Storage persistence is best-effort; continue even if denied/unsupported.
        }
      }

      const currentSettings = await db.settings.get("default");
      if (!currentSettings) {
        await db.settings.put(DEFAULT_SETTINGS);
      } else {
        const normalizedMode = normalizeSkillMode(
          currentSettings.skillMode as SkillMode | LegacySkillMode | undefined,
        );
        if (currentSettings.skillMode !== normalizedMode) {
          await db.settings.put({
            ...currentSettings,
            skillMode: normalizedMode,
            updatedAt: getNow(),
          });
        }
      }

      // Backfill older installs where player gender may still be stored as "Mixed".
      const legacyMixedPlayers = await db.players
        .filter((p) => (p.gender as string) === "Mixed")
        .toArray();
      if (legacyMixedPlayers.length > 0) {
        const now = getNow();
        await db.transaction("rw", db.players, async () => {
          for (const player of legacyMixedPlayers) {
            await db.players.update(player.id, {
              gender: "Male",
              updatedAt: now,
            });
          }
        });
      }

      const currentCourts = await db.courts.toArray();
      if (currentCourts.length === 0) {
        await db.courts.bulkPut([createEmptyCourt(1), createEmptyCourt(2)]);
      }
    };

    void initialize();
  }, []);

  const playersOnCourt = useMemo(() => {
    const ids = new Set<string>();
    for (const court of courts) {
      for (const slot of court.slots) {
        if (slot.playerId) {
          ids.add(slot.playerId);
        }
      }
    }
    return ids;
  }, [courts]);

  const waitingPlayers = useMemo(() => {
    if (!activeSession) {
      return [];
    }
    return sortPlayersForQueue(
      players.filter((p) => p.isActive && !p.isOnBreak && !playersOnCourt.has(p.id)),
    );
  }, [activeSession, players, playersOnCourt]);

  const playerById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  const sortedCourts = useMemo(
    () => [...courts].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    [courts],
  );

  const addPlayer = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    const now = getNow();
    const newPlayer: Player = {
      id: uid(),
      name: trimmed,
      gender,
      skillLevel: selectedSkillLevel,
      isActive: true,
      isOnBreak: false,
      gamesPlayed: 0,
      waitStartedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await db.players.add(newPlayer);
    setName("");
  };

  const toggleActive = async (player: Player) => {
    await db.players.update(player.id, {
      isActive: !player.isActive,
      updatedAt: getNow(),
    });
  };

  const toggleBreak = async (player: Player) => {
    await db.players.update(player.id, {
      isOnBreak: !player.isOnBreak,
      waitStartedAt: getNow(),
      updatedAt: getNow(),
    });
  };

  const assignToCourt = async (playerId: string, courtId: string, position: number) => {
    const court = courts.find((c) => c.id === courtId);
    if (!court || court.isActive) {
      return;
    }

    const updatedSlots = court.slots.map((slot) =>
      slot.position === position ? { ...slot, playerId } : slot,
    );
    await db.courts.update(courtId, { slots: updatedSlots, updatedAt: getNow() });
  };

  const clearSlot = async (courtId: string, position: number) => {
    const court = courts.find((c) => c.id === courtId);
    if (!court || court.isActive) {
      return;
    }

    const updatedSlots = court.slots.map((slot) =>
      slot.position === position ? { ...slot, playerId: undefined } : slot,
    );
    await db.courts.update(courtId, { slots: updatedSlots, updatedAt: getNow() });
  };

  const startMatch = async (courtId: string) => {
    if (!activeSession) {
      return;
    }
    await db.courts.update(courtId, {
      isActive: true,
      matchStartedAt: getNow(),
      updatedAt: getNow(),
    });
  };

  const startSuggestedMatch = async (
    courtId: string,
    playerIds: [string, string, string, string],
  ): Promise<boolean> => {
    if (!activeSession) {
      return false;
    }
    let started = false;
    await db.transaction("rw", db.players, db.courts, async () => {
      const court = await db.courts.get(courtId);
      if (!court || court.isActive) {
        return;
      }
      const isCourtEmpty = court.slots.every((slot) => !slot.playerId);
      if (!isCourtEmpty) {
        return;
      }

      const suggestedPlayers = await db.players.bulkGet(playerIds);
      const allEligible = suggestedPlayers.every(
        (player) => player?.isActive === true && player.isOnBreak === false,
      );
      if (!allEligible) {
        return;
      }

      const allCourts = await db.courts.toArray();
      const assignedPlayerIds = new Set(
        allCourts
          .filter((c) => c.id !== courtId)
          .flatMap((c) => c.slots.map((slot) => slot.playerId).filter((id): id is string => Boolean(id))),
      );
      const hasConflict = playerIds.some((id) => assignedPlayerIds.has(id));
      if (hasConflict) {
        return;
      }

      const now = getNow();
      await db.courts.update(courtId, {
        slots: [
          { position: 1, playerId: playerIds[0] },
          { position: 2, playerId: playerIds[1] },
          { position: 3, playerId: playerIds[2] },
          { position: 4, playerId: playerIds[3] },
        ],
        isActive: true,
        matchStartedAt: now,
        updatedAt: now,
      });
      started = true;
    });
    return started;
  };

  const endMatch = async (courtId: string, scoreA: number, scoreB: number) => {
    if (!activeSession) {
      return;
    }
    const court = courts.find((c) => c.id === courtId);
    if (!court) {
      return;
    }

    const finishedPlayerIds = court.slots
      .map((slot) => slot.playerId)
      .filter((id): id is string => Boolean(id));
    if (finishedPlayerIds.length !== 4) {
      return;
    }

    await db.transaction("rw", db.players, db.courts, db.sessionMatches, async () => {
      const now = getNow();
      const startedAt = court.matchStartedAt ?? now;
      const durationMs = Math.max(0, now - startedAt);
      const winner: MatchWinner = scoreA === scoreB ? "Draw" : scoreA > scoreB ? "A" : "B";
      const teamAPlayerIds: [string, string] = [finishedPlayerIds[0], finishedPlayerIds[1]];
      const teamBPlayerIds: [string, string] = [finishedPlayerIds[2], finishedPlayerIds[3]];

      for (const id of finishedPlayerIds) {
        const player = await db.players.get(id);
        if (player) {
          await db.players.update(id, {
            gamesPlayed: player.gamesPlayed + 1,
            waitStartedAt: now,
            updatedAt: now,
          });
        }
      }

      const matchRecord: SessionMatch = {
        id: uid(),
        sessionId: activeSession.id,
        courtId: court.id,
        courtLabel: court.label,
        teamAPlayerIds,
        teamBPlayerIds,
        scoreA,
        scoreB,
        winner,
        startedAt,
        endedAt: now,
        durationMs,
        createdAt: now,
      };
      await db.sessionMatches.add(matchRecord);

      await db.courts.update(court.id, {
        isActive: false,
        matchStartedAt: undefined,
        slots: [
          { position: 1 },
          { position: 2 },
          { position: 3 },
          { position: 4 },
        ],
        updatedAt: now,
      });
    });
  };

  const updateSettings = async (next: Partial<SessionSettings>) => {
    const current = settings ?? DEFAULT_SETTINGS;
    await db.settings.put({
      ...current,
      ...next,
      id: "default",
      updatedAt: getNow(),
    });
  };

  const syncCourtsCount = async (count: number) => {
    const existing = await db.courts.toArray();
    const currentCount = existing.length;
    if (count === currentCount) {
      return;
    }

    if (count > currentCount) {
      const toAdd = Array.from({ length: count - currentCount }, (_, idx) =>
        createEmptyCourt(currentCount + idx + 1),
      );
      await db.courts.bulkPut(toAdd);
    } else {
      const removable = existing
        .sort((a, b) => b.label.localeCompare(a.label))
        .slice(0, currentCount - count)
        .map((court) => court.id);
      await db.courts.bulkDelete(removable);
    }
  };

  const randomizeStartOrder = async () => {
    if (settings?.randomStartUsed) {
      return;
    }
    const activeWaiting = players
      .filter((p) => p.isActive && !p.isOnBreak && !playersOnCourt.has(p.id))
      .slice(0, 20);

    const shuffled = [...activeWaiting].sort(() => Math.random() - 0.5);
    const now = getNow();
    await db.transaction("rw", db.players, db.settings, async () => {
      for (let i = 0; i < shuffled.length; i += 1) {
        const player = shuffled[i];
        await db.players.update(player.id, {
          waitStartedAt: now + i * 5000,
          updatedAt: now,
        });
      }
      await updateSettings({ randomStartUsed: true });
    });
  };

  const has10OrMore = players.filter((p) => p.isActive).length >= 10;
  const activeCourtsCount = courts.filter((c) => c.isActive).length;
  const activePlayersCount = players.filter((p) => p.isActive).length;
  const startSession = async ({ clearPlayers = false }: { clearPlayers?: boolean } = {}) => {
    if (activeSession) {
      return;
    }
    const now = getNow();
    const latest = sessions[0];
    const sequence = latest ? latest.sequence + 1 : 1;
    const newSession: Session = {
      id: uid(),
      name: `Session ${sequence}`,
      sequence,
      status: "active",
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await db.transaction("rw", db.sessions, db.players, async () => {
      if (clearPlayers) {
        await db.players.clear();
      }
      await db.sessions.add(newSession);
    });
  };
  const endSession = async () => {
    if (!activeSession) {
      return;
    }
    const now = getNow();
    await db.transaction("rw", db.sessions, db.players, db.courts, db.settings, async () => {
      await db.sessions.update(activeSession.id, {
        status: "ended",
        endedAt: now,
        updatedAt: now,
      });
      const allPlayers = await db.players.toArray();
      for (const player of allPlayers) {
        await db.players.update(player.id, {
          gamesPlayed: 0,
          waitStartedAt: now,
          isOnBreak: false,
          updatedAt: now,
        });
      }
      const allCourts = await db.courts.toArray();
      for (const court of allCourts) {
        await db.courts.update(court.id, {
          isActive: false,
          matchStartedAt: undefined,
          slots: [{ position: 1 }, { position: 2 }, { position: 3 }, { position: 4 }],
          updatedAt: now,
        });
      }
      await db.settings.update("default", { randomStartUsed: false, updatedAt: now });
    });
  };
  const playerCompetitionStats = useMemo(() => {
    const stats = new Map<string, { wins: number; losses: number; draws: number; matches: number; winRate: number }>();
    for (const player of players) {
      stats.set(player.id, { wins: 0, losses: 0, draws: 0, matches: 0, winRate: 0 });
    }

    for (const match of scopedSessionMatches) {
      const teamA = new Set(match.teamAPlayerIds);
      const teamB = new Set(match.teamBPlayerIds);
      for (const id of [...teamA, ...teamB]) {
        const current = stats.get(id) ?? { wins: 0, losses: 0, draws: 0, matches: 0, winRate: 0 };
        current.matches += 1;
        if (match.winner === "Draw") {
          current.draws += 1;
        } else if ((match.winner === "A" && teamA.has(id)) || (match.winner === "B" && teamB.has(id))) {
          current.wins += 1;
        } else {
          current.losses += 1;
        }
        const decidedMatches = current.wins + current.losses;
        current.winRate = decidedMatches === 0 ? 0 : Math.round((current.wins / decidedMatches) * 100);
        stats.set(id, current);
      }
    }

    return stats;
  }, [players, scopedSessionMatches]);
  const livePerformance = useMemo(() => {
    const ordered = [...scopedSessionMatches].sort((a, b) => a.endedAt - b.endedAt);
    const streakByPlayer = new Map<string, number>();
    const pointSpreadByPlayer = new Map<string, number>();

    for (const player of players) {
      streakByPlayer.set(player.id, 0);
      pointSpreadByPlayer.set(player.id, 0);
    }

    let bestGiantKiller:
      | {
          matchId: string;
          team: "A" | "B";
          names: string[];
          underdogStrength: number;
          favoriteStrength: number;
          score: string;
        }
      | undefined;

    for (const match of ordered) {
      const teamAPlayers = match.teamAPlayerIds
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is Player => Boolean(p));
      const teamBPlayers = match.teamBPlayerIds
        .map((id) => players.find((p) => p.id === id))
        .filter((p): p is Player => Boolean(p));

      const teamAStrength =
        teamAPlayers.length === 0
          ? 0
          : teamAPlayers.reduce((sum, p) => sum + getNormalizedSkillValue(p.skillLevel), 0) /
            teamAPlayers.length;
      const teamBStrength =
        teamBPlayers.length === 0
          ? 0
          : teamBPlayers.reduce((sum, p) => sum + getNormalizedSkillValue(p.skillLevel), 0) /
            teamBPlayers.length;

      for (const id of match.teamAPlayerIds) {
        pointSpreadByPlayer.set(id, (pointSpreadByPlayer.get(id) ?? 0) + (match.scoreA - match.scoreB));
      }
      for (const id of match.teamBPlayerIds) {
        pointSpreadByPlayer.set(id, (pointSpreadByPlayer.get(id) ?? 0) + (match.scoreB - match.scoreA));
      }

      if (match.winner === "A") {
        for (const id of match.teamAPlayerIds) {
          streakByPlayer.set(id, (streakByPlayer.get(id) ?? 0) + 1);
        }
        for (const id of match.teamBPlayerIds) {
          streakByPlayer.set(id, 0);
        }
        if (teamAStrength < teamBStrength) {
          const gap = teamBStrength - teamAStrength;
          const currentGap = bestGiantKiller
            ? bestGiantKiller.favoriteStrength - bestGiantKiller.underdogStrength
            : -1;
          if (gap > currentGap) {
            bestGiantKiller = {
              matchId: match.id,
              team: "A",
              names: teamAPlayers.map((p) => p.name),
              underdogStrength: teamAStrength,
              favoriteStrength: teamBStrength,
              score: `${match.scoreA}-${match.scoreB}`,
            };
          }
        }
      } else if (match.winner === "B") {
        for (const id of match.teamBPlayerIds) {
          streakByPlayer.set(id, (streakByPlayer.get(id) ?? 0) + 1);
        }
        for (const id of match.teamAPlayerIds) {
          streakByPlayer.set(id, 0);
        }
        if (teamBStrength < teamAStrength) {
          const gap = teamAStrength - teamBStrength;
          const currentGap = bestGiantKiller
            ? bestGiantKiller.favoriteStrength - bestGiantKiller.underdogStrength
            : -1;
          if (gap > currentGap) {
            bestGiantKiller = {
              matchId: match.id,
              team: "B",
              names: teamBPlayers.map((p) => p.name),
              underdogStrength: teamBStrength,
              favoriteStrength: teamAStrength,
              score: `${match.scoreA}-${match.scoreB}`,
            };
          }
        }
      } else {
        for (const id of [...match.teamAPlayerIds, ...match.teamBPlayerIds]) {
          streakByPlayer.set(id, 0);
        }
      }
    }

    const winStreaks = players
      .map((player) => ({
        player,
        streak: streakByPlayer.get(player.id) ?? 0,
      }))
      .filter((row) => row.streak >= 3)
      .sort((a, b) => b.streak - a.streak || a.player.name.localeCompare(b.player.name));

    const mvp = players
      .map((player) => ({
        player,
        pointSpread: pointSpreadByPlayer.get(player.id) ?? 0,
        matches: playerCompetitionStats.get(player.id)?.matches ?? 0,
      }))
      .filter((row) => row.matches > 0)
      .sort((a, b) => b.pointSpread - a.pointSpread || a.player.name.localeCompare(b.player.name))[0];

    return {
      winStreaks,
      giantKiller: bestGiantKiller,
      mvp,
    };
  }, [playerCompetitionStats, players, scopedSessionMatches]);

  return {
    name,
    setName,
    gender,
    setGender,
    skillLevel,
    setSkillLevel,
    skillMode,
    availableLevels,
    selectedSkillLevel,
    settings,
    sessions,
    activeSession,
    players,
    courts,
    sessionMatches,
    scopedSessionMatches,
    playerCompetitionStats,
    livePerformance,
    waitingPlayers,
    playerById,
    sortedCourts,
    playersOnCourt,
    addPlayer,
    toggleActive,
    toggleBreak,
    assignToCourt,
    clearSlot,
    startMatch,
    startSuggestedMatch,
    endMatch,
    startSession,
    endSession,
    updateSettings,
    syncCourtsCount,
    randomizeStartOrder,
    has10OrMore,
    activeCourtsCount,
    activePlayersCount,
  };
}

export const DEUCE_GENDERS: Gender[] = ["Male", "Female"];
