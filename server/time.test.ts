import { describe, expect, it } from "vitest";
import { addDays, isValidDate, isValidTime, overlaps, weeklyDates } from "./time";

describe("time helpers", () => {
  it("validates dates", () => {
    expect(isValidDate("2026-10-05")).toBe(true);
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-1-5")).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });

  it("validates times", () => {
    expect(isValidTime("07:30")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("7:30")).toBe(false);
  });

  it("detects overlapping ranges, treating touching ranges as free", () => {
    expect(overlaps("07:00", "09:00", "08:00", "10:00")).toBe(true);
    expect(overlaps("07:00", "09:00", "07:30", "08:00")).toBe(true);
    expect(overlaps("07:00", "09:00", "09:00", "11:00")).toBe(false);
    expect(overlaps("09:00", "11:00", "07:00", "09:00")).toBe(false);
  });

  it("adds days across month/year boundaries", () => {
    expect(addDays("2026-12-29", 7)).toBe("2027-01-05");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("builds weekly series", () => {
    expect(weeklyDates("2026-10-05", 3)).toEqual(["2026-10-05", "2026-10-12", "2026-10-19"]);
  });
});
