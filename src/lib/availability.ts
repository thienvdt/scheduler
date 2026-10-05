// Tìm khung giờ mà tất cả người cần có mặt đều rảnh và còn ít nhất một phòng trống.

import type { Session } from "@/shared/types";
import { minutesToTime, timeToMinutes } from "./date";

export interface SlotQuery {
  dates: string[];
  /** Khung giờ trong ngày, tính bằng phút từ 00:00 */
  dayStart: number;
  dayEnd: number;
  duration: number;
  /** Bước dò giờ bắt đầu (phút) */
  step: number;
  teacherIds: string[];
  /** Các phòng có thể dùng (đã lọc theo sức chứa…) */
  roomIds: string[];
  /** Phòng ảo (Online, bên ngoài) – luôn trống */
  alwaysFreeRoomIds?: string[];
  /** Bỏ qua các giờ đã qua */
  now?: { date: string; minutes: number };
}

export interface Slot {
  date: string;
  start_time: string;
  end_time: string;
  freeRoomIds: string[];
}

type Interval = [number, number];

function busyMap(sessions: Session[]) {
  const people = new Map<string, Interval[]>();
  const rooms = new Map<string, Interval[]>();
  const add = (map: Map<string, Interval[]>, key: string, iv: Interval) => map.set(key, [...(map.get(key) ?? []), iv]);
  for (const s of sessions) {
    if (s.status !== "scheduled") continue;
    const iv: Interval = [timeToMinutes(s.start_time), timeToMinutes(s.end_time)];
    for (const p of new Set([s.teacher_id, ...(s.participant_ids ?? [])])) add(people, `${s.date}|${p}`, iv);
    add(rooms, `${s.date}|${s.room_id}`, iv);
  }
  return { people, rooms };
}

const isFree = (list: Interval[] | undefined, start: number, end: number) =>
  !list?.some(([a, b]) => a < end && start < b);

export function findFreeSlots(sessions: Session[], q: SlotQuery, limit = 200): Slot[] {
  const { people, rooms } = busyMap(sessions);
  const slots: Slot[] = [];
  for (const date of q.dates) {
    if (q.now && date < q.now.date) continue;
    for (let start = q.dayStart; start + q.duration <= q.dayEnd; start += q.step) {
      if (q.now && date === q.now.date && start < q.now.minutes) continue;
      const end = start + q.duration;
      if (!q.teacherIds.every((t) => isFree(people.get(`${date}|${t}`), start, end))) continue;
      const freeRoomIds = q.roomIds.filter((r) => q.alwaysFreeRoomIds?.includes(r) || isFree(rooms.get(`${date}|${r}`), start, end));
      if (!freeRoomIds.length) continue;
      slots.push({ date, start_time: minutesToTime(start), end_time: minutesToTime(end), freeRoomIds });
      if (slots.length >= limit) return slots;
    }
  }
  return slots;
}
