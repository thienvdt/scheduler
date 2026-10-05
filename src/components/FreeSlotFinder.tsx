"use client";

import { useCallback, useMemo, useState } from "react";
import type { Room, Session, Teacher } from "@/shared/types";
import { api } from "@/lib/api";
import { findFreeSlots, type Slot } from "@/lib/availability";
import { addDays, formatFull, fromISODate, startOfWeek, timeToMinutes, toISODate } from "@/lib/date";
import { formatDuration } from "@/lib/templates";
import { useResource } from "@/lib/useResource";
import { ParticipantPicker } from "./ParticipantPicker";
import { Alert, Button, cn, Field, Input, Modal, Select } from "./ui";

export interface FinderPrefill {
  teacher_ids: string[];
  room_id: string;
  duration: number;
  date: string;
}

export interface PickedSlot {
  date: string;
  start_time: string;
  end_time: string;
  room_id: string;
  teacher_ids: string[];
}

const DURATIONS = [30, 60, 90, 120, 180];
const RANGES = [
  { id: "this", label: "Tuần này", offset: 0, weeks: 1 },
  { id: "next", label: "Tuần sau", offset: 1, weeks: 1 },
  { id: "two", label: "2 tuần tới", offset: 0, weeks: 2 },
] as const;
const WINDOWS = [
  { id: "all", label: "Cả ngày", start: "07:00", end: "21:00" },
  { id: "am", label: "Sáng", start: "07:00", end: "12:00" },
  { id: "pm", label: "Chiều", start: "13:00", end: "17:30" },
  { id: "eve", label: "Tối", start: "17:30", end: "21:00" },
] as const;

const chip = (on: boolean) =>
  cn(
    "rounded-xl border px-3 py-1.5 text-sm transition",
    on ? "border-cyan-300/60 bg-cyan-400/20" : "border-white/15 bg-white/5 hover:bg-white/15",
  );

export function FreeSlotFinder({
  teachers,
  rooms,
  weekStart,
  prefill,
  onClose,
  onPick,
}: {
  teachers: Teacher[];
  rooms: Room[];
  weekStart: string;
  prefill?: FinderPrefill;
  onClose: () => void;
  onPick: (slot: PickedSlot) => void;
}) {
  const [people, setPeople] = useState<string[]>(prefill?.teacher_ids ?? []);
  const [duration, setDuration] = useState(prefill?.duration ?? 60);
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("this");
  const [windowId, setWindowId] = useState<(typeof WINDOWS)[number]["id"]>("all");
  const [roomId, setRoomId] = useState(prefill?.room_id ?? "");
  const [minCapacity, setMinCapacity] = useState("");
  const [skipSunday, setSkipSunday] = useState(true);

  // Tìm từ tuần chứa ngày được gợi ý (nếu có), ngược lại tuần đang xem
  const baseWeek = prefill?.date ? startOfWeek(prefill.date) : weekStart;
  const r = RANGES.find((x) => x.id === range)!;
  const from = addDays(baseWeek, r.offset * 7);
  const to = addDays(from, r.weeks * 7 - 1);

  const fetcher = useCallback(() => api.sessions.list({ from, to }), [from, to]);
  const { data: sessions, loading, error } = useResource(fetcher, [] as Session[]);

  const candidateRooms = useMemo(() => {
    const min = Number(minCapacity) || 0;
    const list = roomId ? rooms.filter((x) => x.id === roomId) : rooms.filter((x) => (x.capacity ?? Infinity) >= min);
    // Ưu tiên phòng vừa đủ chỗ
    return [...list].sort((a, b) => (a.capacity ?? 1e9) - (b.capacity ?? 1e9));
  }, [rooms, roomId, minCapacity]);

  const slots = useMemo(() => {
    const w = WINDOWS.find((x) => x.id === windowId)!;
    const dates = Array.from({ length: r.weeks * 7 }, (_, i) => addDays(from, i)).filter(
      (d) => !skipSunday || fromISODate(d).getDay() !== 0,
    );
    const now = new Date();
    return findFreeSlots(sessions, {
      dates,
      dayStart: timeToMinutes(w.start),
      dayEnd: timeToMinutes(w.end),
      duration,
      step: 30,
      teacherIds: people,
      roomIds: candidateRooms.map((x) => x.id),
      now: { date: toISODate(now), minutes: now.getHours() * 60 + now.getMinutes() },
    });
  }, [sessions, windowId, from, r.weeks, skipSunday, duration, people, candidateRooms]);

  const byDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) map.set(s.date, [...(map.get(s.date) ?? []), s]);
    return [...map.entries()];
  }, [slots]);

  const roomName = (id: string) => rooms.find((x) => x.id === id)?.name ?? "";

  return (
    <Modal open title="🔎 Tìm giờ trống" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label={`Người cần có mặt${people.length ? ` (${people.length})` : ""}`}>
          <ParticipantPicker teachers={teachers} hostId="" value={people} onChange={setPeople} />
        </Field>

        <Field label="Thời lượng">
          <div className="flex flex-wrap gap-2">
            {[...new Set([...DURATIONS, duration])]
              .sort((a, b) => a - b)
              .map((d) => (
                <button key={d} type="button" className={chip(duration === d)} onClick={() => setDuration(d)}>
                  {formatDuration(d)}
                </button>
              ))}
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Trong khoảng">
            <div className="flex flex-wrap gap-2">
              {RANGES.map((x) => (
                <button key={x.id} type="button" className={chip(range === x.id)} onClick={() => setRange(x.id)}>
                  {x.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Buổi">
            <div className="flex flex-wrap gap-2">
              {WINDOWS.map((x) => (
                <button key={x.id} type="button" className={chip(windowId === x.id)} onClick={() => setWindowId(x.id)}>
                  {x.label}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Phòng">
            <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Bất kỳ phòng nào</option>
              {rooms.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                  {x.capacity !== null ? ` (${x.capacity} chỗ)` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sức chứa tối thiểu">
            <Input
              type="number"
              min={0}
              disabled={!!roomId}
              placeholder="Không yêu cầu"
              value={minCapacity}
              onChange={(e) => setMinCapacity(e.target.value)}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input type="checkbox" checked={skipSunday} onChange={(e) => setSkipSunday(e.target.checked)} className="accent-cyan-400" />
          Bỏ qua Chủ nhật
        </label>

        {error && <Alert>{error}</Alert>}
        {people.length === 0 && <Alert tone="info">Chọn ít nhất một người để tìm giờ cả nhóm cùng rảnh.</Alert>}

        {people.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="text-xs uppercase tracking-wide text-white/60">
              {loading ? "Đang tìm…" : slots.length ? `Khung giờ phù hợp (${slots.length})` : "Không tìm thấy khung giờ phù hợp"}
            </div>
            <div className="flex max-h-72 flex-col gap-3 overflow-y-auto pr-1">
              {byDate.map(([date, list]) => (
                <div key={date}>
                  <div className="mb-1.5 text-sm font-semibold">{formatFull(date)}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((s) => (
                      <button
                        key={s.start_time}
                        type="button"
                        onClick={() => onPick({ date, start_time: s.start_time, end_time: s.end_time, room_id: s.freeRoomIds[0], teacher_ids: people })}
                        title={`Phòng trống: ${s.freeRoomIds.map(roomName).join(", ")}`}
                        className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-xs tabular-nums transition hover:bg-emerald-400/25"
                      >
                        {s.start_time}–{s.end_time}
                        <span className="ml-1 text-white/50">· {roomName(s.freeRoomIds[0])}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!slots.length && !loading && people.length > 0 && (
          <p className="text-sm text-white/60">Thử giảm thời lượng, mở rộng khoảng thời gian, hoặc chọn bất kỳ phòng nào.</p>
        )}

        <div className="flex justify-end">
          <Button onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </Modal>
  );
}
