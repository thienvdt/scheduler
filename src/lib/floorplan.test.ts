import { describe, expect, it } from "vitest";
import type { Room, Session, Teacher } from "@/shared/types";
import { LOUNGE_ID, ONLINE_ID, activeAt, layoutPlan, locatePeople, seatPeople, shortName } from "./floorplan";

const room = (id: string, extra: Partial<Room> = {}): Room => ({ id, name: id, building: null, capacity: 30, equipment: null, is_virtual: 0, created_at: "", ...extra });
const person = (id: string, name = id): Teacher => ({ id, name, email: null, phone: null, department: null, color: "#fff", created_at: "" });
const session = (id: string, teacher: string, roomId: string, start: string, end: string, extra: Partial<Session> = {}): Session => ({
  id, series_id: null, title: id, class_name: null, teacher_id: teacher, room_id: roomId, date: "2026-10-05", start_time: start, end_time: end,
  note: null, status: "scheduled", kind: "lecture", created_at: "", participant_ids: [], ...extra,
});

const rooms = [room("A2"), room("A10"), room("A1"), room("online", { is_virtual: 1 })];
const people = [person("an", "Lê Văn An"), person("binh", "Trần Thị Bình"), person("chi")];
const sessions = [
  session("toan", "an", "A1", "07:00", "08:30"),
  session("hop", "binh", "A2", "08:00", "09:00", { participant_ids: ["an", "chi"] }),
  session("huy", "chi", "A10", "07:00", "09:00", { status: "cancelled" }),
  session("zoom", "chi", "online", "07:00", "07:45"),
];

describe("sơ đồ", () => {
  it("xếp phòng thật theo tên (số tự nhiên), phòng ảo vào khu trực tuyến", () => {
    const plan = layoutPlan(rooms, 1100);
    expect(plan.tiles.filter((t) => t.kind === "room").map((t) => t.id)).toEqual(["A1", "A2", "A10"]);
    expect(plan.tiles.find((t) => t.kind === "online")?.virtualRooms?.map((r) => r.id)).toEqual(["online"]);
    expect(plan.tiles.some((t) => t.id === LOUNGE_ID)).toBe(true);
  });

  it("lịch đang diễn ra: tính đầu, không tính cuối, bỏ lịch huỷ", () => {
    expect(activeAt(sessions, 7 * 60).map((s) => s.id)).toEqual(["toan", "zoom"]);
    expect(activeAt(sessions, 8 * 60 + 30).map((s) => s.id)).toEqual(["hop"]);
  });

  it("định vị người: chủ trì, tham dự, trực tuyến, rảnh", () => {
    const at7 = locatePeople(people, sessions, 7 * 60, rooms);
    expect(at7.get("an")).toMatchObject({ tileId: "A1", role: "host" });
    expect(at7.get("chi")).toMatchObject({ tileId: ONLINE_ID, role: "host" });
    expect(at7.get("binh")).toMatchObject({ tileId: LOUNGE_ID, role: "idle" });
    // 08:15: An vẫn đang dạy Toán (bắt đầu trước) nên không bị kéo sang cuộc họp
    const at815 = locatePeople(people, sessions, 8 * 60 + 15, rooms);
    expect(at815.get("an")).toMatchObject({ tileId: "A1" });
    expect(at815.get("chi")).toMatchObject({ tileId: "A2", role: "guest" });
  });

  it("chỗ ngồi: chủ trì ở bục, mỗi người một chỗ trong ô của mình", () => {
    const plan = layoutPlan(rooms, 1100);
    const where = locatePeople(people, sessions, 8 * 60 + 40, rooms);
    const seats = seatPeople(plan, where);
    const a2 = plan.tiles.find((t) => t.id === "A2")!;
    expect(seats.get("binh")).toEqual({ x: a2.x + a2.w / 2, y: a2.y + 50 });
    for (const id of ["an", "chi"]) {
      const s = seats.get(id)!;
      expect(s.x).toBeGreaterThan(a2.x);
      expect(s.x).toBeLessThan(a2.x + a2.w);
      expect(s.y).toBeLessThan(a2.y + a2.h);
    }
    expect(seats.get("an")).not.toEqual(seats.get("chi"));
  });

  it("tên ngắn", () => {
    expect(shortName("Nguyễn Thu Hà")).toBe("Hà");
    expect(shortName("TS. Trần Thị Bình")).toBe("Bình");
  });
});
