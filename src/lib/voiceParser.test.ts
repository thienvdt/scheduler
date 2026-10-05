import { describe, expect, it } from "vitest";
import type { Room, Teacher } from "@/shared/types";
import { fold, parseVoiceCommand } from "./voiceParser";

const teacher = (id: string, name: string): Teacher => ({
  id, name, email: null, phone: null, department: null, color: "#60a5fa", created_at: "",
});
const room = (id: string, name: string): Room => ({ id, name, building: null, capacity: null, equipment: null, is_virtual: 0, created_at: "" });

const ctx = {
  teachers: [teacher("an", "ThS. Nguyễn Văn An"), teacher("binh", "TS. Trần Thị Bình"), teacher("cuong", "PGS. Lê Minh Cường")],
  rooms: [room("a101", "A101"), room("a202", "A202"), room("lab1", "Lab 1")],
  today: "2026-10-07", // Thứ 4
};
const parse = (text: string) => parseVoiceCommand(text, ctx);

describe("fold", () => {
  it("strips Vietnamese diacritics and keeps length", () => {
    const s = "Thứ Ba, thầy Đức dạy Lập trình";
    expect(fold(s)).toBe("thu ba, thay duc day lap trinh");
    expect(fold(s)).toHaveLength(s.length);
  });
});

describe("parseVoiceCommand", () => {
  it("parses a full command", () => {
    expect(
      parse("Thứ 3 tuần sau thầy An dạy Lập trình Web lớp K66A phòng A101 từ 7 giờ đến 9 giờ 30, lặp 10 tuần"),
    ).toEqual({
      date: "2026-10-13",
      teacher_id: "an",
      title: "Lập trình Web",
      class_name: "K66A",
      room_id: "a101",
      start_time: "07:00",
      end_time: "09:30",
      repeat_weeks: 10,
    });
  });

  it("understands weekdays in words and afternoon times", () => {
    expect(parse("cô Bình dạy môn Giải tích thứ sáu phòng A 202 từ 1 giờ rưỡi đến 3 giờ chiều")).toMatchObject({
      teacher_id: "binh",
      title: "Giải tích",
      date: "2026-10-09",
      room_id: "a202",
      start_time: "13:30",
      end_time: "15:00",
    });
  });

  it("handles next week, Sunday, tomorrow and explicit dates", () => {
    expect(parse("thứ 6 tuần sau").date).toBe("2026-10-16");
    expect(parse("chủ nhật").date).toBe("2026-10-11");
    expect(parse("ngày mai").date).toBe("2026-10-08");
    expect(parse("ngày 20/10 lúc 8 giờ").date).toBe("2026-10-20");
    expect(parse("ngày 5 tháng 1").date).toBe("2027-01-05");
  });

  it("uses a duration or a 2 hour default when only the start is given", () => {
    expect(parse("lúc 7h30 trong 1 tiếng rưỡi")).toMatchObject({ start_time: "07:30", end_time: "09:00" });
    expect(parse("bắt đầu 14 giờ")).toMatchObject({ start_time: "14:00", end_time: "16:00" });
    expect(parse("7h-9h")).toMatchObject({ start_time: "07:00", end_time: "09:00" });
  });

  it("does not read 'thứ 7' or 'thứ 2 học' as a time", () => {
    const r = parse("thứ 7 học phần Mạng máy tính từ 8 giờ đến 10 giờ");
    expect(r).toMatchObject({ date: "2026-10-10", start_time: "08:00", end_time: "10:00", title: "Mạng máy tính" });
  });

  it("matches teachers by full name and rooms with spaces", () => {
    expect(parse("Lê Minh Cường phòng lab 1").teacher_id).toBe("cuong");
    expect(parse("Lê Minh Cường phòng lab 1").room_id).toBe("lab1");
  });

  it("does not guess when a given name is ambiguous", () => {
    const r = parseVoiceCommand("thầy An dạy Toán", {
      ...ctx,
      teachers: [...ctx.teachers, teacher("an2", "Phạm Văn An")],
    });
    expect(r.teacher_id).toBeUndefined();
    expect(r.title).toBe("Toán");
  });

  it("falls back to the leftover phrase as the title", () => {
    expect(parse("Đặt lịch Cơ sở dữ liệu cho thầy An thứ 5 phòng A202 lúc 9 giờ").title).toBe("Cơ sở dữ liệu");
  });

  it("detects the event kind and keeps it in the title", () => {
    expect(parse("Họp bộ môn thứ 6 lúc 14 giờ phòng A202")).toMatchObject({
      kind: "meeting",
      title: "Họp bộ môn",
      date: "2026-10-09",
      start_time: "14:00",
      room_id: "a202",
    });
    expect(parse("cô Bình coi thi ngày mai 7h30").kind).toBe("exam");
    expect(parse("thầy An dạy Lập trình Web").kind).toBeUndefined();
  });

  it("understands business and office commands", () => {
    const biz = {
      ...ctx,
      teachers: [teacher("lan", "Nguyễn Thị Lan"), teacher("minh", "Trần Văn Minh")],
      rooms: [room("p1", "Phòng họp 1"), room("ht", "Hội trường")],
    };
    expect(parseVoiceCommand("Thứ 5 lúc 10 giờ chị Lan gặp khách hàng Công ty ABC phòng họp 1 trong 1 tiếng", biz)).toMatchObject({
      kind: "client",
      teacher_id: "lan",
      room_id: "p1",
      date: "2026-10-08",
      start_time: "10:00",
      end_time: "11:00",
      title: "Gặp khách hàng Công ty ABC",
    });
    expect(parseVoiceCommand("Sáng thứ 2 lúc 7 giờ 30 giao ban toàn cơ quan tại hội trường trong 1 tiếng, lặp 12 tuần", biz)).toMatchObject({
      kind: "meeting",
      room_id: "ht",
      date: "2026-10-12",
      start_time: "07:30",
      end_time: "08:30",
      repeat_weeks: 12,
      title: "Giao ban toàn cơ quan",
    });
    expect(parseVoiceCommand("anh Minh họp 1:1 với chị Lan chiều mai 3 giờ", biz)).toMatchObject({
      kind: "one_on_one",
      start_time: "15:00",
      date: "2026-10-08",
    });
    expect(parseVoiceCommand("anh Minh đi công tác thứ 6", biz).kind).toBe("business_trip");
    expect(parseVoiceCommand("phỏng vấn ứng viên lúc 9 giờ", biz).kind).toBe("interview");
    expect(parseVoiceCommand("tiếp công dân sáng thứ 3", biz).kind).toBe("reception");
  });

  it("returns an empty draft for unrelated speech", () => {
    expect(parse("")).toEqual({});
  });
});
