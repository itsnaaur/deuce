export type SkillMode = "recreational" | "competitive";
export type LegacySkillMode = "basic" | "advanced";

export type BasicSkill = "Beginner" | "Intermediate" | "Advanced";

export type AdvancedSkill =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K";

export type Gender = "Male" | "Female";

export type SkillLevel = BasicSkill | AdvancedSkill;

export type CourtSlot = {
  position: 1 | 2 | 3 | 4;
  playerId?: string;
};

export type Player = {
  id: string;
  name: string;
  gender: Gender;
  skillLevel: SkillLevel;
  isActive: boolean;
  isOnBreak: boolean;
  gamesPlayed: number;
  waitStartedAt: number;
  createdAt: number;
  updatedAt: number;
};

export type Court = {
  id: string;
  label: string;
  slots: CourtSlot[];
  matchStartedAt?: number;
  isActive: boolean;
  updatedAt: number;
};

export type SessionSettings = {
  id: string;
  skillMode: SkillMode;
  courtCount: number;
  randomStartUsed: boolean;
  updatedAt: number;
};

export type MatchWinner = "A" | "B" | "Draw";
export type SessionStatus = "active" | "ended";

export type Session = {
  id: string;
  name: string;
  sequence: number;
  status: SessionStatus;
  startedAt: number;
  endedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type SessionMatch = {
  id: string;
  sessionId?: string;
  courtId: string;
  courtLabel: string;
  teamAPlayerIds: [string, string];
  teamBPlayerIds: [string, string];
  scoreA: number;
  scoreB: number;
  winner: MatchWinner;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  createdAt: number;
};
