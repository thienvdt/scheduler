import { describe, expect, it } from "vitest";
import {
  DEFAULT_BELLS, buildItems, findTables, guessMapping, parseBells, parseCsv, parseDay, parseFileText, parseTime,
  scanStorage, timetableScore, type BuildOptions,
} from "./importer";

const opts: BuildOptions = { bells: parseBells(DEFAULT_BELLS), defaultTeacher: "", roomFromClass: true, defaultRoom: "" };

describe("parseDay / parseTime", () => {
  it("hiểu nhiều cách viết thứ", () => {
    expect(parseDay("Thứ 2", "auto")).toEqual({ weekday: 1 });
    expect(parseDay("Thứ Năm", "auto")).toEqual({ weekday: 4 });
    expect(parseDay("T7", "auto")).toEqual({ weekday: 6 });
    expect(parseDay("CN", "auto")).toEqual({ weekday: 7 });
    expect(parseDay("Monday", "auto")).toEqual({ weekday: 1 });
    expect(parseDay(3, "thu")).toEqual({ weekday: 2 });
    expect(parseDay(0, "js")).toEqual({ weekday: 7 });
    expect(parseDay("12/10/2026", "auto")).toEqual({ date: "2026-10-12" });
    expect(parseDay("2026-10-12T07:00:00Z", "auto")).toEqual({ date: "2026-10-12" });
    expect(parseDay("abc", "auto")).toBeNull();
  });
  it("hiểu nhiều cách viết giờ", () => {
    expect(parseTime("7:00")).toBe("07:00");
    expect(parseTime("07h30")).toBe("07:30");
    expect(parseTime("13h")).toBe("13:00");
    expect(parseTime("07:45:00")).toBe("07:45");
    expect(parseTime("25:00")).toBeNull();
  });
});

describe("đoán cột", () => {
  it("tên cột tiếng Việt có dấu / camelCase / tiếng Anh", () => {
    expect(guessMapping(["Thứ", "Tiết", "Môn học", "Lớp", "Giáo viên"])).toMatchObject({
      day: "Thứ", period: "Tiết", title: "Môn học", class_name: "Lớp", teacher: "Giáo viên",
    });
    expect(guessMapping(["tenGiaoVien", "monHoc", "tenLop", "thu", "tiet"])).toMatchObject({
      teacher: "tenGiaoVien", title: "monHoc", class_name: "tenLop", day: "thu", period: "tiet",
    });
    expect(guessMapping(["teacher", "subject", "class", "dayOfWeek", "startTime", "endTime", "room"])).toMatchObject({
      teacher: "teacher", title: "subject", class_name: "class", day: "dayOfWeek", start_time: "startTime", end_time: "endTime", room: "room",
    });
  });
});

describe("GVBM: mảng phẳng trong localStorage", () => {
  const storage = {
    "tour-done-1": "1",
    gvbm_tkb: JSON.stringify([
      { thu: "Thứ 2", tiet: 1, mon: "Toán", lop: "10A1", giaoVien: "Nguyễn Thu Hà" },
      { thu: "Thứ 2", tiet: 2, mon: "Toán", lop: "10A1", giaoVien: "Nguyễn Thu Hà" },
      { thu: "Thứ 3", tiet: 3, mon: "Toán", lop: "10A2", giaoVien: "Nguyễn Thu Hà" },
      { thu: "Thứ 4", tiet: 2, buoi: "Chiều", mon: "Họp tổ", lop: "", giaoVien: "Nguyễn Thu Hà", phong: "P. Giáo viên" },
    ]),
    theme: "dark",
  };
  it("tìm thấy và nhận là thời khoá biểu", () => {
    const ds = scanStorage(storage);
    expect(ds).toHaveLength(1);
    expect(timetableScore(ds[0]).ok).toBe(true);
  });
  it("chuyển tiết → giờ, gộp tiết liền nhau, buổi chiều, đoán loại lịch", () => {
    const d = scanStorage(storage)[0];
    const { items, errors } = buildItems(d.rows, timetableScore(d).mapping, opts);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ weekday: 1, start_time: "07:00", end_time: "08:35", room: "10A1", title: "Toán", kind: "lecture" });
    expect(items.find((i) => i.title === "Họp tổ")).toMatchObject({ weekday: 3, start_time: "13:50", end_time: "14:35", room: "P. Giáo viên", kind: "meeting" });
  });
});

describe("GVCN: thời khoá biểu lồng theo lớp → thứ", () => {
  const data = {
    "10A1": {
      "Thứ 2": [{ tiet: 1, mon: "Chào cờ", gv: "Lê Văn An" }, { tiet: 2, mon: "Văn", gv: "Trần Bình" }],
      "Thứ 7": [{ tiet: 5, mon: "Sinh hoạt lớp", gv: "Lê Văn An" }, { tiet: 4, mon: "", gv: "" }],
    },
    "10A2": { "Thứ 3": [{ tiet: 1, mon: "Toán", gv: "Lê Văn An" }] },
  };
  it("gộp các nhóm cùng dạng, tên lớp và thứ thành cột", () => {
    const ds = findTables(data, "gvcn");
    expect(ds).toHaveLength(1);
    const { mapping, ok } = timetableScore(ds[0]);
    expect(ok).toBe(true);
    expect(mapping).toMatchObject({ class_name: "[cấp 1]", day: "[cấp 2]", teacher: "gv", title: "mon", period: "tiet" });
    const { items, errors } = buildItems(ds[0].rows, mapping, opts);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(4); // ô trống bị bỏ qua
    expect(items.find((i) => i.title === "Sinh hoạt lớp")).toMatchObject({ weekday: 6, room: "10A1", class_name: "10A1", start_time: "10:30" });
  });
  it("trạng thái app nhiều bảng: tách riêng từng bảng", () => {
    const ds = findTables({ students: [{ hoTen: "A", ngaySinh: "2010-01-01" }], tkb: [{ thu: 2, tiet: 1, mon: "Toán", lop: "10A1" }] }, "app");
    expect(ds).toHaveLength(2);
    expect(ds.filter((d) => timetableScore(d).ok)).toHaveLength(1);
    expect(ds.map((d) => d.label)).toEqual(["app › students", "app › tkb"]);
  });
});

describe("thiếu cột giáo viên (TKB cá nhân)", () => {
  it("dùng giáo viên mặc định, báo lỗi khi không có", () => {
    const rows = [{ day: 1, start: "7:00", end: "8:30", subject: "Physics", class: "11B" }];
    const mapping = guessMapping(Object.keys(rows[0]));
    expect(buildItems(rows, mapping, opts).errors[0].reason).toMatch(/giáo viên/);
    const { items } = buildItems(rows, mapping, { ...opts, defaultTeacher: "Bùi Hương" });
    expect(items[0]).toMatchObject({ teacher: "Bùi Hương", weekday: 1, start_time: "07:00", end_time: "08:30", room: "11B" });
  });
});

describe("CSV / file", () => {
  it("đọc CSV dấu ; có ngoặc kép", () => {
    const d = parseCsv('﻿Thứ;Tiết;Môn;Lớp;Giáo viên\n2;1-2;"Toán; nâng cao";10A1;Hà\n3;3;Lý;10A2;Đức\n')!;
    expect(d.rows).toHaveLength(2);
    const { items } = buildItems(d.rows, guessMapping(d.columns), opts);
    expect(items.find((i) => i.teacher === "Hà")).toMatchObject({ title: "Toán; nâng cao", weekday: 1, start_time: "07:00", end_time: "08:35" });
  });
  it("file sao lưu localStorage (giá trị là chuỗi JSON)", () => {
    const backup = JSON.stringify({ tkb: JSON.stringify([{ thu: 2, tiet: 1, mon: "Toán", lop: "10A1" }]) });
    expect(parseFileText("backup.json", backup)).toHaveLength(1);
  });
});
