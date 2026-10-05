import { describe, expect, it } from "vitest";
import type { Session, Teacher } from "@/shared/types";
import { PROFILES } from "@/shared/profiles";
import { buildWorkload, workloadCsv } from "./report";

const EDU = PROFILES.education;

const teachers: Teacher[] = [
  { id: "an", name: "Nguyễn Văn An", email: null, phone: null, department: "CNTT, Hệ thống", color: "#60a5fa", created_at: "" },
  { id: "binh", name: "Trần Thị Bình", email: null, phone: null, department: null, color: "#f472b6", created_at: "" },
];

let n = 0;
const s = (
  teacher_id: string,
  kind: Session["kind"],
  start: string,
  end: string,
  status: Session["status"] = "scheduled",
  participant_ids: string[] = [],
): Session => ({
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
  participant_ids,
});

describe("workload report", () => {
  const sessions = [
    s("an", "lecture", "07:00", "09:00"),
    s("an", "practice", "13:00", "16:00"),
    s("an", "meeting", "16:00", "17:30"),
    s("an", "lecture", "09:00", "11:00", "cancelled"),
    s("binh", "exam", "07:30", "09:00"),
    s("cuong", "meeting", "14:00", "15:00", "scheduled", ["binh"]),
  ];

  it("sums teaching and other minutes per teacher, excluding cancelled hours", () => {
    const rows = buildWorkload(sessions, teachers, EDU.primaryKinds);
    const an = rows.find((r) => r.teacher.id === "an")!;
    const binh = rows.find((r) => r.teacher.id === "binh")!;
    expect(an.teacher.name).toBe("Nguyễn Văn An");
    expect(an).toMatchObject({ primarySessions: 2, primaryMinutes: 300, otherSessions: 1, otherMinutes: 90, cancelled: 1 });
    expect(an.minutesByKind.practice).toBe(180);
    // Bình coi thi 90 phút + tham dự cuộc họp 60 phút
    expect(binh).toMatchObject({ primarySessions: 0, otherSessions: 2, otherMinutes: 150 });
    expect(rows.find((r) => r.teacher.id === "cuong")).toMatchObject({ otherSessions: 1, otherMinutes: 60 });
  });

  it("uses the business profile's primary kinds and wording", () => {
    const biz = PROFILES.business;
    const rows = buildWorkload([s("an", "client", "09:00", "10:00"), s("an", "meeting", "10:00", "11:00")], teachers, biz.primaryKinds);
    expect(rows[0]).toMatchObject({ primarySessions: 1, primaryMinutes: 60, otherSessions: 1, otherMinutes: 60 });
    const header = workloadCsv(rows, { from: "a", to: "b" }, biz).split("\r\n")[1];
    expect(header.startsWith("Nhân viên,Phòng ban,")).toBe(true);
    expect(header).toContain("Giờ gặp khách hàng");
    expect(header).not.toContain("Giờ coi thi");
  });

  it("produces Excel-friendly CSV with BOM and quoting", () => {
    const csv = workloadCsv(buildWorkload(sessions, teachers, EDU.primaryKinds), { from: "2026-10-01", to: "2026-10-31" }, EDU);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines.length).toBe(5);
    expect(lines[1].startsWith("Giảng viên,Khoa / Bộ môn,Số buổi giảng,Giờ giảng,")).toBe(true);
    expect(lines[2]).toMatch(/^Nguyễn Văn An,"CNTT, Hệ thống",2,5,1,1\.5,/);
    expect(lines[2].endsWith(",6.5,1")).toBe(true);
  });
});
