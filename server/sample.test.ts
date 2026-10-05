import { describe, expect, it } from "vitest";
import { mondayVN, sampleFor } from "./sample";
import { PROFILES } from "../src/shared/profiles";
import type { ProfileId } from "../src/shared/types";

describe("mondayVN", () => {
  it("lấy Thứ 2 theo giờ Việt Nam", () => {
    expect(mondayVN(new Date("2026-10-05T03:00:00Z"))).toBe("2026-10-05"); // Thứ 2
    expect(mondayVN(new Date("2026-10-11T16:59:00Z"))).toBe("2026-10-05"); // CN 23:59 giờ VN
    expect(mondayVN(new Date("2026-10-11T17:00:00Z"))).toBe("2026-10-12"); // Thứ 2 00:00 giờ VN
  });
});

describe("dữ liệu mẫu", () => {
  for (const id of Object.keys(PROFILES) as ProfileId[]) {
    it(`${id}: tham chiếu hợp lệ và đúng loại lịch của loại hình`, () => {
      const s = sampleFor(id);
      const people = new Set(s.people.map((p) => p.id));
      const rooms = new Set([...s.rooms.map((r) => r.id), "r-online", "r-outside"]);
      for (const x of [...s.people, ...s.rooms]) expect(x.id.startsWith("mau-")).toBe(true);
      for (const ss of s.sessions) {
        expect(people.has(ss.host)).toBe(true);
        expect(rooms.has(ss.room)).toBe(true);
        expect(PROFILES[id].kinds).toContain(ss.kind);
        for (const p of ss.participants ?? []) expect(people.has(p)).toBe(true);
        expect(ss.start < ss.end).toBe(true);
      }
    });
  }
});
