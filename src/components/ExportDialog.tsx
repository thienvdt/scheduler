"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { addDays, formatDayMonth } from "@/lib/date";
import { downloadText } from "@/lib/download";
import { buildIcs } from "@/lib/ics";
import { Alert, Button, cn, Field, Modal, Select } from "./ui";

const RANGES = [
  { weeks: 1, label: "Tuần đang xem" },
  { weeks: 4, label: "4 tuần" },
  { weeks: 20, label: "Cả học kỳ (20 tuần)" },
];

const REMINDERS = [
  { value: 0, label: "Không nhắc" },
  { value: 10, label: "Trước 10 phút" },
  { value: 15, label: "Trước 15 phút" },
  { value: 30, label: "Trước 30 phút" },
  { value: 60, label: "Trước 1 giờ" },
];

export function ExportDialog({
  weekStart,
  filters,
  filterLabel,
  onClose,
}: {
  weekStart: string;
  filters: { teacherId?: string; roomId?: string; kind?: string };
  /** Mô tả bộ lọc đang áp dụng, vd. "TS. Trần Thị Bình" */
  filterLabel: string;
  onClose: () => void;
}) {
  const [weeks, setWeeks] = useState(1);
  const [reminder, setReminder] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const to = addDays(weekStart, weeks * 7 - 1);

  async function exportIcs() {
    setBusy(true);
    setError(null);
    try {
      const sessions = await api.sessions.list({ from: weekStart, to, ...filters });
      const name = `Lịch Giảng${filterLabel ? ` – ${filterLabel}` : ""}`;
      downloadText(
        `lich-giang-${weekStart}-den-${to}.ics`,
        buildIcs(sessions, { calendarName: name, reminderMinutes: reminder || undefined }),
        "text/calendar;charset=utf-8",
      );
      setDone(sessions.length);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="Xuất lịch (.ics)" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-white/70">
          Tải file lịch để thêm vào <b>Google Calendar</b>, <b>Outlook</b> hoặc <b>Lịch</b> trên điện thoại.
          {filterLabel && (
            <>
              {" "}
              Đang lọc: <b>{filterLabel}</b>.
            </>
          )}
        </p>

        <Field label="Khoảng thời gian">
          <div className="grid grid-cols-3 gap-2">
            {RANGES.map((r) => (
              <button
                key={r.weeks}
                type="button"
                onClick={() => setWeeks(r.weeks)}
                className={cn(
                  "rounded-xl border px-2 py-2 text-sm transition",
                  weeks === r.weeks ? "border-cyan-300/60 bg-cyan-400/20" : "border-white/15 bg-white/5 hover:bg-white/15",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-white/50">
            Từ {formatDayMonth(weekStart)}/{weekStart.slice(0, 4)} đến {formatDayMonth(to)}/{to.slice(0, 4)}
          </span>
        </Field>

        <Field label="Nhắc trước">
          <Select value={reminder} onChange={(e) => setReminder(Number(e.target.value))}>
            {REMINDERS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>

        {error && <Alert>{error}</Alert>}
        {done !== null && (
          <Alert tone="info">
            Đã tải file với {done} lịch. Cách nhập:
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
              <li>Google Calendar (máy tính): Cài đặt ⚙ → Nhập và xuất → chọn file .ics.</li>
              <li>Outlook: Tệp → Mở và xuất → Nhập/Xuất, hoặc kéo file vào lịch.</li>
              <li>iPhone/Android: mở file vừa tải và chọn Thêm vào lịch.</li>
            </ul>
          </Alert>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Đóng
          </Button>
          <Button type="button" variant="primary" onClick={exportIcs} disabled={busy}>
            {busy ? "Đang tạo…" : "⬇ Tải file .ics"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
