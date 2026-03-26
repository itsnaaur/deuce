import type { SkillLevel } from "./types";

// Hidden normalization scale used across queue balancing and analytics.
// This keeps skill comparisons consistent even if UI skill mode changes mid-session.
export const NORMALIZED_SKILL_VALUE: Record<SkillLevel, number> = {
  Beginner: 1,
  Intermediate: 5,
  Advanced: 10,
  A: 11,
  B: 10,
  C: 9,
  D: 8,
  E: 7,
  F: 6,
  G: 5,
  H: 4,
  I: 3,
  J: 2,
  K: 1,
};

export const getNormalizedSkillValue = (level: SkillLevel) => NORMALIZED_SKILL_VALUE[level] ?? 0;

// Non-linear curve used by team balancing to emphasize high-end skill gaps.
// Keep this tunable: 1 = linear, >1 increasingly punishes top-heavy teams.
export const TEAM_POWER_EXPONENT = 1.35;

export const getSkillPowerValue = (level: SkillLevel) =>
  Math.pow(getNormalizedSkillValue(level), TEAM_POWER_EXPONENT);
