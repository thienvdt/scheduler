import { describe, expect, it } from "vitest";
import type { Session } from "@/shared/types";
import { findFreeSlots, type SlotQuery } from "./availability";

let n = 0;
const s = (over: Partial<Session>): Session => ({
  id: `s${n++}`,
  series_id: null,
  title: "x",
  class_name: null,
  teacher_id: "an",
  room_id: "a101",
  date: "2026-10-06",
  start_time: "07:00",
  end_time: "09:00",
  note: null,
  status: "scheduled",
  kind: "lecture",
  created_at: "",
  participant_ids: [],
  ...over,
});

const base: SlotQuery = {
  dates: ["2026-10-06"],
  dayStart: 7 * 60,
  dayEnd: 12 * 60,
  duration: 60,
  step: 30,
  teacherIds: ["an", "binh"],
  roomIds: ["a101", "a202"],
};

const starts = (q: SlotQuery, sessions: Session[]) => findFreeSlots(sessions, q).map((x) => x.start_time);

describe("findFreeSlots", () => {
  it("excludes times when any required person is busy, including as a participant", () => {
    const sessions = [
      s({ teacher_id: "an", start_time: "07:00", end_time: "09:00" }),
      s({ teacher_id: "cuong", participant_ids: ["binh"], room_id: "a202", start_time: "10:00", end_time: "11:00" }),
    ];
    expect(starts(base, sessions)).toEqual(["09:00", "11:00"]);
  });

  it("requires at least one free room and reports which rooms are free", () => {
    const sessions = [
      s({ teacher_id: "x", room_id: "a101", start_time: "07:00", end_time: "12:00" }),
      s({ teacher_id: "y", room_id: "a202", start_time: "07:00", end_time: "08:00" }),
    ];
    const slots = findFreeSlots(sessions, { ...base, teacherIds: ["an"] });
    expect(slots[0]).toEqual({ date: "2026-10-06", start_time: "08:00", end_time: "09:00", freeRoomIds: ["a202"] });
    expect(findFreeSlots(sessions, { ...base, teacherIds: ["an"], roomIds: ["a101"] })).toEqual([]);
  });

  it("ignores cancelled sessions, past times and respects the time window", () => {
    const sessions = [s({ status: "cancelled", start_time: "07:00", end_time: "12:00" })];
    expect(starts({ ...base, now: { date: "2026-10-06", minutes: 10 * 60 + 10 } }, sessions)).toEqual(["10:30", "11:00"]);
    expect(starts({ ...base, duration: 300 }, sessions)).toEqual(["07:00"]);
    expect(starts({ ...base, now: { date: "2026-10-07", minutes: 0 } }, sessions)).toEqual([]);
  });
});
