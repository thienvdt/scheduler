// Sơ đồ trực quan: xếp phòng thành mặt bằng và tính mỗi người đang ở đâu tại một thời điểm.
// Hàm thuần (không React) để dễ kiểm thử.

import type { Room, Session, Teacher } from "@/shared/types";

export const TILE_W = 230;
export const TILE_H = 180;
const GAP = 22;
const PAD = 20;
const BOTTOM_H = 200;
const AVATAR = 32;

export interface Tile {
  kind: "room" | "lounge" | "online";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  room?: Room;
  /** Các phòng ảo gộp trong khu trực tuyến */
  virtualRooms?: Room[];
}

export interface Plan {
  width: number;
  height: number;
  tiles: Tile[];
}

export const LOUNGE_ID = "__lounge";
export const ONLINE_ID = "__online";

/** Xếp phòng thật thành lưới (theo toà nhà rồi tên), hàng cuối là phòng chờ + khu trực tuyến. */
export function layoutPlan(rooms: Room[], width = 1100): Plan {
  const physical = rooms
    .filter((r) => !r.is_virtual)
    .sort((a, b) => (a.building ?? "").localeCompare(b.building ?? "", "vi") || a.name.localeCompare(b.name, "vi", { numeric: true }));
  const virtual = rooms.filter((r) => r.is_virtual);
  const cols = Math.max(1, Math.floor((width - 2 * PAD + GAP) / (TILE_W + GAP)));
  const tiles: Tile[] = physical.map((room, i) => ({
    kind: "room",
    id: room.id,
    room,
    x: PAD + (i % cols) * (TILE_W + GAP),
    y: PAD + Math.floor(i / cols) * (TILE_H + GAP),
    w: TILE_W,
    h: TILE_H,
  }));
  const usedCols = Math.min(cols, Math.max(physical.length, 2));
  const inner = usedCols * TILE_W + (usedCols - 1) * GAP;
  const y = PAD + Math.ceil(physical.length / cols) * (TILE_H + GAP);
  if (virtual.length) {
    const half = Math.floor((inner - GAP) / 2);
    tiles.push({ kind: "lounge", id: LOUNGE_ID, x: PAD, y, w: half, h: BOTTOM_H });
    tiles.push({ kind: "online", id: ONLINE_ID, x: PAD + half + GAP, y, w: inner - half - GAP, h: BOTTOM_H, virtualRooms: virtual });
  } else {
    tiles.push({ kind: "lounge", id: LOUNGE_ID, x: PAD, y, w: inner, h: BOTTOM_H });
  }
  return { width: inner + 2 * PAD, height: y + BOTTOM_H + PAD, tiles };
}

export const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const fromMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Các lịch đang diễn ra tại phút `t` (không tính lịch đã huỷ). */
export function activeAt(sessions: Session[], t: number): Session[] {
  return sessions.filter((s) => s.status === "scheduled" && toMinutes(s.start_time) <= t && t < toMinutes(s.end_time));
}

export interface Whereabouts {
  /** Phòng thật, ONLINE_ID hoặc LOUNGE_ID */
  tileId: string;
  role: "host" | "guest" | "idle";
  session?: Session;
}

/** Mỗi người đang ở đâu: chủ trì / tham dự lịch nào, hay đang rảnh ở phòng chờ. */
export function locatePeople(people: Teacher[], sessions: Session[], t: number, rooms: Room[]): Map<string, Whereabouts> {
  const virtual = new Set(rooms.filter((r) => r.is_virtual).map((r) => r.id));
  const out = new Map<string, Whereabouts>();
  for (const s of activeAt(sessions, t).sort((a, b) => a.start_time.localeCompare(b.start_time))) {
    const tileId = virtual.has(s.room_id) ? ONLINE_ID : s.room_id;
    if (!out.has(s.teacher_id)) out.set(s.teacher_id, { tileId, role: "host", session: s });
    for (const p of s.participant_ids) if (!out.has(p)) out.set(p, { tileId, role: "guest", session: s });
  }
  for (const p of people) if (!out.has(p.id)) out.set(p.id, { tileId: LOUNGE_ID, role: "idle" });
  return out;
}

export interface Seat {
  x: number;
  y: number;
}

/** Vị trí từng người trong ô: người chủ trì ở bục giảng, người khác ngồi theo hàng. */
export function seatPeople(plan: Plan, where: Map<string, Whereabouts>): Map<string, Seat> {
  const byTile = new Map<string, string[]>();
  for (const [id, w] of where) byTile.set(w.tileId, [...(byTile.get(w.tileId) ?? []), id]);
  const seats = new Map<string, Seat>();
  for (const tile of plan.tiles) {
    const ids = byTile.get(tile.id) ?? [];
    // Chủ trì lên trước để đứng bục (chỉ phòng thật mới có bục)
    const ordered = tile.kind === "room" ? [...ids].sort((a, b) => Number(where.get(b)!.role === "host") - Number(where.get(a)!.role === "host")) : ids;
    let rest = ordered;
    if (tile.kind === "room" && ordered.length && where.get(ordered[0])!.role === "host") {
      seats.set(ordered[0], { x: tile.x + tile.w / 2, y: tile.y + 50 });
      rest = ordered.slice(1);
    }
    const top = tile.kind === "room" ? tile.y + 92 : tile.y + 62;
    const perRow = Math.max(1, Math.floor((tile.w - 24) / (AVATAR + 6)));
    const rows = Math.max(1, Math.floor((tile.y + tile.h - 18 - top) / (AVATAR + 6)) + 1);
    rest.forEach((id, i) => {
      // Quá chỗ thì xếp chồng ở ô cuối (vẫn đếm đúng số người ở bảng tình trạng)
      const k = Math.min(i, perRow * rows - 1);
      const row = Math.floor(k / perRow);
      const inRow = Math.min(perRow, rest.length - row * perRow);
      const col = k % perRow;
      const startX = tile.x + tile.w / 2 - ((inRow - 1) * (AVATAR + 6)) / 2;
      seats.set(id, { x: startX + col * (AVATAR + 6), y: top + row * (AVATAR + 6) });
    });
  }
  return seats;
}

/** Tên ngắn trên hình đại diện: tên gọi (từ cuối) – "Nguyễn Thu Hà" → "Hà". */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  return last.length > 5 ? last.slice(0, 5) : last;
}
