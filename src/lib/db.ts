"use client";

import Dexie, { type Table } from "dexie";
import type { Court, Player, Session, SessionMatch, SessionSettings } from "./types";

export class DeuceDb extends Dexie {
  players!: Table<Player, string>;
  courts!: Table<Court, string>;
  settings!: Table<SessionSettings, string>;
  sessionMatches!: Table<SessionMatch, string>;
  sessions!: Table<Session, string>;

  constructor() {
    super("deuce-db");

    this.version(1).stores({
      players: "id, name, isActive, isOnBreak, gamesPlayed, waitStartedAt, updatedAt",
      courts: "id, isActive, updatedAt",
      settings: "id, updatedAt",
    });

    this.version(2).stores({
      players: "id, name, isActive, isOnBreak, gamesPlayed, waitStartedAt, updatedAt",
      courts: "id, isActive, updatedAt",
      settings: "id, updatedAt",
      sessionMatches: "id, courtId, winner, endedAt, durationMs, createdAt",
    });

    this.version(3).stores({
      players: "id, name, isActive, isOnBreak, gamesPlayed, waitStartedAt, updatedAt",
      courts: "id, isActive, updatedAt",
      settings: "id, updatedAt",
      sessionMatches: "id, sessionId, courtId, winner, endedAt, durationMs, createdAt",
      sessions: "id, status, sequence, startedAt, endedAt, updatedAt",
    });
  }
}

export const db = new DeuceDb();

export const DEFAULT_SETTINGS: SessionSettings = {
  id: "default",
  skillMode: "recreational",
  courtCount: 2,
  randomStartUsed: false,
  updatedAt: Date.now(),
};

export const createEmptyCourt = (courtNumber: number): Court => ({
  id: `court-${courtNumber}`,
  label: `Court ${courtNumber}`,
  isActive: false,
  slots: [
    { position: 1 },
    { position: 2 },
    { position: 3 },
    { position: 4 },
  ],
  updatedAt: Date.now(),
});
