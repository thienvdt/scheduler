// Tạo file iCalendar (.ics) để nhập vào Google Calendar, Outlook, Lịch iPhone/Android.

import type { Session } from "@/shared/types";
import { KIND_META } from "@/shared/types";

const TZID = "Asia/Ho_Chi_Minh";

// Việt Nam không có giờ mùa hè → múi giờ cố định UTC+7
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:+0700",
  "TZOFFSETTO:+0700",
  "TZNAME:ICT",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Gập dòng dài hơn 75 byte UTF-8 theo RFC 5545 (không cắt giữa ký tự nhiều byte). */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // dòng tiếp theo bắt đầu bằng 1 khoảng trắng
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const localStamp = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildIcs(
  sessions: Session[],
  opts: { calendarName: string; now?: Date; reminderMinutes?: number; teacherName?: (id: string) => string | undefined },
): string {
  const stamp = utcStamp(opts.now ?? new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lich Giang//Scheduler//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.calendarName)}`,
    `X-WR-TIMEZONE:${TZID}`,
    ...VTIMEZONE,
  ];

  for (const s of sessions) {
    const meta = KIND_META[s.kind] ?? KIND_META.other;
    const summary = `${meta.icon} ${s.title}${s.class_name ? ` – ${s.class_name}` : ""}`;
    const description = [
      `Loại: ${meta.label}`,
      s.teacher_name && `Phụ trách: ${s.teacher_name}`,
      s.class_name && `Lớp: ${s.class_name}`,
      s.participant_ids?.length &&
        `Tham dự: ${s.participant_ids.map((id) => opts.teacherName?.(id) ?? id).join(", ")}`,
      s.note,
    ]
      .filter(Boolean)
      .join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${s.id}@lich-giang`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${TZID}:${localStamp(s.date, s.start_time)}`,
      `DTEND;TZID=${TZID}:${localStamp(s.date, s.end_time)}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(description)}`,
    );
    if (s.room_name) lines.push(`LOCATION:${escapeText(`Phòng ${s.room_name}`)}`);
    lines.push(`CATEGORIES:${escapeText(meta.label)}`);
    if (s.status === "cancelled") {
      lines.push("STATUS:CANCELLED");
    } else {
      lines.push("STATUS:CONFIRMED");
      if (opts.reminderMinutes) {
        lines.push(
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          `DESCRIPTION:${escapeText(summary)}`,
          `TRIGGER:-PT${opts.reminderMinutes}M`,
          "END:VALARM",
        );
      }
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
