import { describe, expect, it } from "vitest";
import { NORMALIZED_SKILL_VALUE, getNormalizedSkillValue, getSkillPowerValue } from "./skill";
import type { SkillLevel } from "./types";

describe("skill values", () => {
  it("ranks recreational levels Beginner < Intermediate < Advanced", () => {
    expect(getNormalizedSkillValue("Beginner")).toBeLessThan(getNormalizedSkillValue("Intermediate"));
    expect(getNormalizedSkillValue("Intermediate")).toBeLessThan(getNormalizedSkillValue("Advanced"));
  });

  it("ranks competitive levels from A (strongest) down to K", () => {
    const competitive: SkillLevel[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
    const values = competitive.map(getNormalizedSkillValue);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    expect(new Set(values).size).toBe(competitive.length);
  });

  it("gives every level a positive value", () => {
    for (const level of Object.keys(NORMALIZED_SKILL_VALUE) as SkillLevel[]) {
      expect(getNormalizedSkillValue(level)).toBeGreaterThan(0);
    }
  });

  it("grows team power faster than linearly so strong players weigh more", () => {
    const beginner = getSkillPowerValue("Beginner");
    const advanced = getSkillPowerValue("Advanced");
    expect(advanced / beginner).toBeGreaterThan(
      getNormalizedSkillValue("Advanced") / getNormalizedSkillValue("Beginner"),
    );
  });
});
