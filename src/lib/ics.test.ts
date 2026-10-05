import { describe, expect, it } from "vitest";
import type { Session } from "@/shared/types";
import { buildIcs, escapeText, foldLine } from "./ics";

const session = (over: Partial<Session> = {}): Session => ({
  id: "s1",
  series_id: null,
  title: "Họp bộ môn",
  class_name: null,
  teacher_id: "t",
  room_id: "r",
  date: "2026-10-06",
  start_time: "14:00",
  end_time: "15:30",
  note: "Nội dung:\n1. Báo cáo, tổng kết; kế hoạch",
  status: "scheduled",
  kind: "meeting",
  created_at: "",
  participant_ids: ["c"],
  teacher_name: "TS. Trần Thị Bình",
  room_name: "A202",
  ...over,
});

describe("ics", () => {
  it("escapes special characters", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("folds long lines at 75 bytes without splitting multi-byte characters", () => {
    const line = "DESCRIPTION:" + "Lịch giảng ".repeat(20);
    const folded = foldLine(line);
    const enc = new TextEncoder();
    for (const part of folded.split("\r\n")) expect(enc.encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("builds events in Vietnam time with reminders, cancelled events have no alarm", () => {
    const ics = buildIcs([session(), session({ id: "s2", status: "cancelled" })], {
      calendarName: "Lịch",
      now: new Date("2026-10-04T00:00:00Z"),
      reminderMinutes: 15,
      teacherName: (id) => ({ c: "PGS. Lê Minh Cường" })[id],
    });
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("DTSTART;TZID=Asia/Ho_Chi_Minh:20261006T140000");
    expect(unfolded).toContain("DTEND;TZID=Asia/Ho_Chi_Minh:20261006T153000");
    expect(unfolded).toContain("SUMMARY:👥 Họp bộ môn");
    expect(unfolded).toContain("LOCATION:Phòng A202");
    expect(unfolded).toContain("Tham dự: PGS. Lê Minh Cường");
    expect(unfolded).toContain("1. Báo cáo\\, tổng kết\\; kế hoạch");
    expect(unfolded).toContain("DTSTAMP:20261004T000000Z");
    expect(unfolded.match(/BEGIN:VALARM/g)).toHaveLength(1);
    expect(unfolded).toContain("STATUS:CANCELLED");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
