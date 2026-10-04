import { describe, expect, it } from "vitest";
import type { Session, Teacher } from "@/shared/types";
import { buildWorkload, workloadCsv } from "./report";

const teachers: Teacher[] = [
  { id: "an", name: "Nguyễn Văn An", email: null, phone: null, department: "CNTT, Hệ thống", color: "#60a5fa", created_at: "" },
  { id: "binh", name: "Trần Thị Bình", email: null, phone: null, department: null, color: "#f472b6", created_at: "" },
];

let n = 0;
const s = (teacher_id: string, kind: Session["kind"], start: string, end: string, status: Session["status"] = "scheduled"): Session => ({
  id: `s${n++}`,
  series_id: null,
  title: "x",
  class_name: null,
  teacher_id,
  room_id: "r",
  date: "2026-10-06",
  start_time: start,
  end_time: end,
  note: null,
  status,
  kind,
  created_at: "",
});

describe("workload report", () => {
  const sessions = [
    s("an", "lecture", "07:00", "09:00"),
    s("an", "practice", "13:00", "16:00"),
    s("an", "meeting", "16:00", "17:30"),
    s("an", "lecture", "09:00", "11:00", "cancelled"),
    s("binh", "exam", "07:30", "09:00"),
  ];

  it("sums teaching and other minutes per teacher, excluding cancelled hours", () => {
    const [an, binh] = buildWorkload(sessions, teachers);
    expect(an.teacher.name).toBe("Nguyễn Văn An");
    expect(an).toMatchObject({ teachingSessions: 2, teachingMinutes: 300, otherSessions: 1, otherMinutes: 90, cancelled: 1 });
    expect(an.minutesByKind.practice).toBe(180);
    expect(binh).toMatchObject({ teachingSessions: 0, otherSessions: 1, otherMinutes: 90 });
  });

  it("produces Excel-friendly CSV with BOM and quoting", () => {
    const csv = workloadCsv(buildWorkload(sessions, teachers), { from: "2026-10-01", to: "2026-10-31" });
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines[2]).toMatch(/^Nguyễn Văn An,"CNTT, Hệ thống",2,5,1,1\.5,/);
    expect(lines[2].endsWith(",6.5,1")).toBe(true);
  });
});
