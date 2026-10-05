import type { EventKind, Session, Teacher } from "@/shared/types";
import { EVENT_KINDS, KIND_META } from "@/shared/types";
import { timeToMinutes } from "./date";
import { isTeachingKind } from "./templates";

export interface TeacherWorkload {
  teacher: Pick<Teacher, "id" | "name" | "department" | "color">;
  teachingSessions: number;
  teachingMinutes: number;
  otherSessions: number;
  otherMinutes: number;
  cancelled: number;
  minutesByKind: Record<EventKind, number>;
}

const emptyKinds = () => Object.fromEntries(EVENT_KINDS.map((k) => [k, 0])) as Record<EventKind, number>;

/**
 * Tổng hợp số buổi và số phút theo giảng viên – tính cho cả người chủ trì và người tham dự;
 * buổi đã huỷ chỉ được đếm, không tính giờ.
 */
export function buildWorkload(sessions: Session[], teachers: Teacher[]): TeacherWorkload[] {
  const rows = new Map<string, TeacherWorkload>();
  const rowFor = (s: Session, teacherId: string) => {
    let row = rows.get(teacherId);
    if (!row) {
      const t = teachers.find((x) => x.id === teacherId);
      const isHost = teacherId === s.teacher_id;
      row = {
        teacher: {
          id: teacherId,
          name: t?.name ?? (isHost ? s.teacher_name : undefined) ?? "?",
          department: t?.department ?? null,
          color: t?.color ?? (isHost ? s.teacher_color : undefined) ?? "#60a5fa",
        },
        teachingSessions: 0,
        teachingMinutes: 0,
        otherSessions: 0,
        otherMinutes: 0,
        cancelled: 0,
        minutesByKind: emptyKinds(),
      };
      rows.set(teacherId, row);
    }
    return row;
  };

  for (const s of sessions) {
    const minutes = timeToMinutes(s.end_time) - timeToMinutes(s.start_time);
    for (const teacherId of new Set([s.teacher_id, ...(s.participant_ids ?? [])])) {
      const row = rowFor(s, teacherId);
      if (s.status === "cancelled") {
        row.cancelled++;
        continue;
      }
      row.minutesByKind[s.kind] = (row.minutesByKind[s.kind] ?? 0) + minutes;
      if (isTeachingKind(s.kind)) {
        row.teachingSessions++;
        row.teachingMinutes += minutes;
      } else {
        row.otherSessions++;
        row.otherMinutes += minutes;
      }
    }
  }

  return [...rows.values()].sort(
    (a, b) => b.teachingMinutes + b.otherMinutes - (a.teachingMinutes + a.otherMinutes) || a.teacher.name.localeCompare(b.teacher.name, "vi"),
  );
}

export const hours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

function csvCell(value: string | number | null): string {
  const s = value === null ? "" : String(value);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV có BOM UTF-8 để Excel hiển thị đúng tiếng Việt. */
export function workloadCsv(rows: TeacherWorkload[], range: { from: string; to: string }): string {
  const header = [
    "Giảng viên",
    "Khoa / Bộ môn",
    "Số buổi giảng",
    "Giờ giảng",
    "Số buổi họp & sự kiện",
    "Giờ họp & sự kiện",
    ...EVENT_KINDS.map((k) => `Giờ ${KIND_META[k].label.toLowerCase()}`),
    "Tổng giờ",
    "Số buổi đã huỷ",
  ];
  const lines = [
    [`Báo cáo khối lượng từ ${range.from} đến ${range.to}`],
    header,
    ...rows.map((r) => [
      r.teacher.name,
      r.teacher.department,
      r.teachingSessions,
      hours(r.teachingMinutes),
      r.otherSessions,
      hours(r.otherMinutes),
      ...EVENT_KINDS.map((k) => hours(r.minutesByKind[k])),
      hours(r.teachingMinutes + r.otherMinutes),
      r.cancelled,
    ]),
  ];
  return "﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
