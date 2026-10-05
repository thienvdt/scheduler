// Đọc dữ liệu thời khoá biểu từ app khác (localStorage, file JSON / CSV) và chuyển thành ImportItem.
// Không biết trước cấu trúc dữ liệu nên: tìm mọi mảng object, đoán cột theo tên, người dùng chỉnh lại nếu cần.

import type { EventKind, ImportItem } from "@/shared/types";

export type Row = Record<string, unknown>;

export interface Dataset {
  /** Nhận diện duy nhất: khoá localStorage / tên file + đường dẫn bên trong */
  id: string;
  label: string;
  rows: Row[];
  columns: string[];
}

export const FIELDS = ["teacher", "title", "class_name", "room", "day", "period", "session", "start_time", "end_time", "department", "note"] as const;
export type Field = (typeof FIELDS)[number];
export type Mapping = Partial<Record<Field, string>>;

export const FIELD_LABELS: Record<Field, string> = {
  teacher: "Giáo viên",
  title: "Môn / tiêu đề",
  class_name: "Lớp",
  room: "Phòng",
  day: "Thứ / ngày",
  period: "Tiết",
  session: "Buổi (sáng/chiều)",
  start_time: "Giờ bắt đầu",
  end_time: "Giờ kết thúc",
  department: "Tổ bộ môn",
  note: "Ghi chú",
};

/** Bỏ dấu, chữ thường, chỉ giữ chữ và số: "Giáo viên" → "giaovien" */
export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const SYNONYMS: Record<Field, string[]> = {
  teacher: ["giaovien", "tengiaovien", "gv", "tengv", "gvbm", "gvcn", "giaovienbomon", "giaovienchunhiem", "teacher", "teachername", "nguoiday", "giangvien"],
  title: ["mon", "monhoc", "tenmon", "tenmonhoc", "subject", "subjectname", "tieude", "title", "noidung", "hoatdong"],
  class_name: ["lop", "tenlop", "lophoc", "malop", "class", "classname", "classid", "khoi"],
  room: ["phong", "phonghoc", "tenphong", "room", "roomname", "diadiem", "location"],
  day: ["thu", "ngay", "ngayhoc", "ngayday", "day", "weekday", "dayofweek", "date", "thutrongtuan"],
  period: ["tiet", "tietso", "tiethoc", "sotiet", "period", "lesson", "slot", "tietthu"],
  session: ["buoi", "ca", "buoihoc", "session", "shift"],
  start_time: ["giobatdau", "batdau", "tu", "tugio", "start", "starttime", "begin", "from", "gio", "time", "thoigian"],
  end_time: ["gioketthuc", "ketthuc", "den", "dengio", "end", "endtime", "to", "until"],
  department: ["to", "tobomon", "bomon", "tochuyenmon", "department", "khoa"],
  note: ["ghichu", "note", "notes", "mota", "description", "nhanxet"],
};

// ---------- Tìm dữ liệu dạng bảng ----------

const isPlainObject = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);
const isPrimitive = (v: unknown) => v === null || ["string", "number", "boolean"].includes(typeof v);

/** Cột cấp lồng nhau, vd. {"10A1": {"Thứ 2": [...]}} → cột "[cấp 1]" = 10A1, "[cấp 2]" = Thứ 2 */
const levelColumn = (i: number) => `[cấp ${i + 1}]`;

/**
 * Tìm các mảng object trong một giá trị JSON. Các mảng nằm cùng "hình dạng" đường dẫn
 * (khác nhau ở tên khoá như tên lớp, tên thứ) được gộp làm một bảng, tên khoá thành cột.
 */
export function findTables(value: unknown, source: string): Dataset[] {
  // Gộp theo hình dạng đường dẫn + bộ trường của object, để {classes:[…], timetable:[…]} vẫn tách riêng
  const groups = new Map<string, { label: string; rows: Row[]; distinct: Set<string> }>();
  const walk = (v: unknown, keys: string[], shape: string[], names: string[], depth: number) => {
    if (depth > 6) return;
    if (Array.isArray(v)) {
      const objects = v.filter(isPlainObject);
      if (!objects.length || objects.length < v.length / 2) return;
      const fields = Object.keys(objects[0]).sort().join(",");
      const sig = shape.join("/") + "|" + fields;
      // Tên hiển thị: bỏ các cấp là dữ liệu (tên lớp, thứ…), chỉ giữ tên trường như "thoiKhoaBieu"
      const label = names.filter((_, i) => shape[i] !== "*").join(" › ");
      const g = groups.get(sig) ?? { label, rows: [], distinct: new Set<string>() };
      g.distinct.add(names.join("/"));
      for (const o of objects) {
        const row: Row = {};
        keys.forEach((k, i) => (row[levelColumn(i)] = k));
        for (const [k, val] of Object.entries(o)) {
          if (isPrimitive(val)) row[k] = val;
          else if (isPlainObject(val)) {
            // Object lồng một cấp: {teacher: {name: "..."}} → "teacher.name"
            for (const [k2, v2] of Object.entries(val)) if (isPrimitive(v2)) row[`${k}.${k2}`] = v2;
          }
        }
        g.rows.push(row);
      }
      groups.set(sig, g);
      // Phần tử có mảng con (vd. lớp → danh sách tiết) cũng được duyệt tiếp
      for (const o of objects) {
        for (const [k, child] of Object.entries(o)) {
          if (Array.isArray(child)) walk(child, keys, [...shape, `[]${k}`], [...names, k], depth + 1);
        }
      }
      return;
    }
    if (isPlainObject(v)) {
      const entries = Object.entries(v).filter(([, c]) => typeof c === "object" && c !== null);
      // Mọi khoá đều chứa object/mảng và có nhiều khoá, hoặc khoá trông như dữ liệu ("10A2", "Thứ 3")
      // → coi khoá là dữ liệu, thành cột "[cấp n]"
      const looksLikeData = entries.every(([k]) => /[\d\s]|[^\x00-\x7f]/.test(k));
      const dataKeys = entries.length === Object.keys(v).length && entries.length > 0 && (entries.length >= 2 || looksLikeData);
      for (const [k, child] of entries) {
        if (dataKeys) walk(child, [...keys, k], [...shape, "*"], [...names, k], depth + 1);
        else walk(child, keys, [...shape, k], [...names, k], depth + 1);
      }
    }
  };
  walk(value, [], [], [], 0);

  return [...groups.entries()].map(([sig, g]) => {
    const columns: string[] = [];
    for (const r of g.rows.slice(0, 200)) for (const c of Object.keys(r)) if (!columns.includes(c)) columns.push(c);
    const label = [source, g.label].filter(Boolean).join(" › ") + (g.distinct.size > 1 ? ` (${g.distinct.size} nhóm)` : "");
    return { id: `${source}#${sig}`, label, rows: g.rows, columns };
  });
}

/** Khoá localStorage của chính app lịch – không đem đi nhập */
const OWN_KEYS = /^(tour-|import-|lich-giang)/;

/** Quét các cặp khoá/giá trị (localStorage hoặc dữ liệu được gửi sang) tìm bảng dữ liệu. */
export function scanStorage(entries: Record<string, string>): Dataset[] {
  const out: Dataset[] = [];
  for (const [k, raw] of Object.entries(entries)) {
    if (OWN_KEYS.test(k) || typeof raw !== "string" || raw.length < 2) continue;
    const first = raw.trimStart()[0];
    if (first !== "{" && first !== "[") continue;
    try {
      out.push(...findTables(JSON.parse(raw), k));
    } catch {
      // không phải JSON
    }
  }
  return out;
}

export function readLocalStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) out[k] = localStorage.getItem(k) ?? "";
    }
  } catch {
    // trình duyệt chặn localStorage
  }
  return out;
}

// ---------- CSV ----------

/** CSV đơn giản: tự nhận dấu phân cách , ; hoặc tab, hỗ trợ ngoặc kép. Dòng đầu là tiêu đề. */
export function parseCsv(text: string, source = "CSV"): Dataset | null {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = ["\t", ";", ","].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delim) {
      record.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      record.push(field);
      if (record.some((f) => f.trim())) records.push(record);
      record = [];
      field = "";
    } else field += c;
  }
  record.push(field);
  if (record.some((f) => f.trim())) records.push(record);
  if (records.length < 2) return null;
  const header = records[0].map((h, i) => h.trim() || `Cột ${i + 1}`);
  const rows = records.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { id: `${source}#csv`, label: source, rows, columns: header };
}

/** Đọc nội dung file JSON hoặc CSV. */
export function parseFileText(name: string, text: string): Dataset[] {
  const t = text.trimStart();
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const value = JSON.parse(t);
      // File sao lưu localStorage dạng {khoá: "chuỗi JSON"} → quét như localStorage
      if (isPlainObject(value) && Object.values(value).some((v) => typeof v === "string" && /^\s*[[{]/.test(v))) {
        const fromStrings = scanStorage(value as Record<string, string>);
        if (fromStrings.length) return fromStrings;
      }
      return findTables(value, name);
    } catch {
      return [];
    }
  }
  const csv = parseCsv(text, name);
  return csv ? [csv] : [];
}

// ---------- Đoán cột ----------

export function guessMapping(columns: string[]): Mapping {
  const mapping: Mapping = {};
  const used = new Set<string>();
  // Ưu tiên khớp chính xác, sau đó khớp tiền tố/hậu tố ("tenGiaoVien", "subject.name")
  for (const pass of ["exact", "partial"] as const) {
    for (const field of FIELDS) {
      if (mapping[field]) continue;
      const hit = columns.find((c) => {
        if (used.has(c)) return false;
        const n = norm(c.replace(/^\[cấp \d+\]$/, ""));
        if (!n) return false;
        return SYNONYMS[field].some((s) =>
          pass === "exact" ? n === s : s.length >= 3 && (n.startsWith(s) || n.endsWith(s) || n.split(/\d/)[0] === s),
        );
      });
      if (hit) {
        mapping[field] = hit;
        used.add(hit);
      }
    }
  }
  return mapping;
}

/** Cột cấp lồng nhau (tên khoá) thường là lớp hoặc thứ – đoán theo giá trị */
export function guessLevelColumns(rows: Row[], columns: string[], mapping: Mapping): Mapping {
  const next = { ...mapping };
  for (const c of columns.filter((c) => /^\[cấp \d+\]$/.test(c))) {
    const values = rows.slice(0, 50).map((r) => String(r[c] ?? ""));
    if (!next.day && values.every((v) => parseDay(v, "auto") !== null)) next.day = c;
    else if (!next.class_name && values.every((v) => /^\d{1,2}\s*[a-zA-Z]/.test(v.trim()))) next.class_name = c;
  }
  return next;
}

// ---------- Thứ, ngày, giờ, tiết ----------

export type DayValue = { weekday: number } | { date: string };
/** Cách hiểu thứ dạng số: "thu" 2..8 (Thứ 2..Chủ nhật), "mon1" 1..7 (Thứ 2 = 1), "js" 0..6 (0 = Chủ nhật) */
export type DayBase = "thu" | "mon1" | "js" | "auto";

const VN_DAYS: Record<string, number> = { hai: 1, ba: 2, tu: 3, nam: 4, sau: 5, bay: 6 };
const EN_DAYS: Record<string, number> = {
  monday: 1, mon: 1, tuesday: 2, tue: 2, wednesday: 3, wed: 3, thursday: 4, friday: 5, fri: 5, saturday: 6, sat: 6, sunday: 7, sun: 7,
};

const pad = (n: number) => String(n).padStart(2, "0");

export function parseDay(value: unknown, base: DayBase): DayValue | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return dayFromNumber(value, base === "auto" ? "thu" : base);
  const raw = String(value).trim();
  // Ngày cụ thể
  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { date: `${m[1]}-${pad(+m[2])}-${pad(+m[3])}` };
  m = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return { date: `${m[3]}-${pad(+m[2])}-${pad(+m[1])}` };
  const n = norm(raw);
  if (/^\d+$/.test(n)) return dayFromNumber(Number(n), base === "auto" ? "thu" : base);
  if (n === "cn" || n === "chunhat" || n === "thu8" || n === "t8") return { weekday: 7 };
  m = n.match(/^(?:thu|t)(\d)$/);
  if (m) return dayFromNumber(Number(m[1]), "thu");
  m = n.match(/^thu(hai|ba|tu|nam|sau|bay)$/);
  if (m) return { weekday: VN_DAYS[m[1]] };
  return EN_DAYS[n] ? { weekday: EN_DAYS[n] } : null;
}

function dayFromNumber(n: number, base: Exclude<DayBase, "auto">): DayValue | null {
  if (!Number.isInteger(n)) return null;
  if (base === "thu") return n >= 2 && n <= 8 ? { weekday: n - 1 } : null;
  if (base === "mon1") return n >= 1 && n <= 7 ? { weekday: n } : null;
  return n >= 0 && n <= 6 ? { weekday: n === 0 ? 7 : n } : null;
}

/** Chọn cách hiểu thứ dạng số cho cả cột dựa trên các giá trị có trong cột. */
export function detectDayBase(values: unknown[]): DayBase {
  const nums = values
    .map((v) => (typeof v === "number" ? v : typeof v === "string" && /^\s*\d+\s*$/.test(v) ? Number(v) : null))
    .filter((v): v is number => v !== null);
  if (!nums.length) return "thu";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min >= 2 && max <= 8) return "thu";
  if (min === 0) return "js";
  return "mon1";
}

/** "7:00", "07h00", "7h", "07:00:00", "7.30" → "07:00" */
export function parseTime(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const m = String(value).trim().toLowerCase().match(/^(\d{1,2})\s*(?:[:h.]\s*(\d{1,2})?)?(?:\s*:\s*\d{1,2})?\s*(?:p|ph|phut)?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null;
}

/** "7:00 - 7:45", "07h00–07h45" → ["07:00", "07:45"] */
export function parseTimeRange(value: unknown): [string, string] | null {
  if (value === null || value === undefined) return null;
  const parts = String(value).split(/\s*(?:-|–|—|→|đến|den|to)\s*/i);
  if (parts.length !== 2) return null;
  const a = parseTime(parts[0]);
  const b = parseTime(parts[1]);
  return a && b && a < b ? [a, b] : null;
}

/** Giờ các tiết, mỗi dòng "số tiết  HH:MM-HH:MM" */
export const DEFAULT_BELLS = `1  07:00-07:45
2  07:50-08:35
3  08:50-09:35
4  09:40-10:25
5  10:30-11:15
6  13:00-13:45
7  13:50-14:35
8  14:50-15:35
9  15:40-16:25
10 16:30-17:15`;

export type Bells = Map<number, [string, string]>;

export function parseBells(text: string): Bells {
  const bells: Bells = new Map();
  for (const line of text.split(/\n/)) {
    const m = line.trim().match(/^(\d{1,2})\s*[:.)]?\s+(.+)$/);
    const range = m && parseTimeRange(m[2]);
    if (m && range) bells.set(Number(m[1]), range);
  }
  return bells;
}

/** Số tiết buổi sáng: tiết 1–5 buổi chiều = tiết 6–10 */
const MORNING_PERIODS = 5;

/** "3", "Tiết 3", "1-2", "1,2,3" → [đầu, cuối] */
export function parsePeriods(value: unknown): [number, number] | null {
  if (value === null || value === undefined || value === "") return null;
  const nums = (String(value).match(/\d+/g) ?? []).map(Number);
  if (!nums.length) return null;
  return [Math.min(...nums), Math.max(...nums)];
}

const isAfternoon = (v: unknown) => /^(chieu|c|pm|afternoon|toi|evening)/.test(norm(String(v ?? "")));

// ---------- Chuyển thành ImportItem ----------

export interface BuildOptions {
  bells: Bells;
  /** Giáo viên dùng khi dữ liệu không có cột giáo viên (thời khoá biểu cá nhân của GVBM) */
  defaultTeacher: string;
  /** Không có cột phòng: dùng tên lớp làm phòng (mỗi lớp một phòng) */
  roomFromClass: boolean;
  defaultRoom: string;
}

export interface BuildResult {
  items: ImportItem[];
  errors: { row: number; reason: string }[];
}

export function guessKind(title: string): EventKind {
  const n = norm(title);
  if (/hop|giaoban/.test(n)) return "meeting";
  if (/truc/.test(n)) return "duty";
  if (/kiemtra|coithi|^thi(hk|hoc|giua|cuoi|$)/.test(n)) return "exam";
  if (/thuchanh|thinghiem/.test(n)) return "practice";
  if (/taphuan|boiduong/.test(n)) return "training";
  return "lecture";
}

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

export function buildItems(rows: Row[], mapping: Mapping, opts: BuildOptions): BuildResult {
  const items: (ImportItem & { _p?: [number, number] })[] = [];
  const errors: BuildResult["errors"] = [];
  const base = mapping.day ? detectDayBase(rows.map((r) => r[mapping.day!])) : "thu";
  const get = (r: Row, f: Field) => (mapping[f] ? r[mapping[f]!] : undefined);

  rows.forEach((r, i) => {
    const fail = (reason: string) => errors.push({ row: i + 1, reason });
    // Không có cột môn thì lấy tên lớp làm tiêu đề; có cột môn mà ô trống = tiết trống
    const title = mapping.title ? text(get(r, "title")) : text(get(r, "class_name"));
    // Ô trống trong thời khoá biểu (tiết không có môn) – bỏ qua im lặng
    if (!title) return;
    const teacher = text(get(r, "teacher")) || opts.defaultTeacher.trim();
    if (!teacher) return fail("thiếu giáo viên");
    const className = text(get(r, "class_name")) || null;
    const room = text(get(r, "room")) || (opts.roomFromClass && className) || opts.defaultRoom.trim();
    if (!room) return fail("thiếu phòng / lớp");

    const day = parseDay(get(r, "day"), base);
    if (!day) return fail(`không hiểu thứ/ngày “${text(get(r, "day"))}”`);

    let start = parseTime(get(r, "start_time"));
    let end = parseTime(get(r, "end_time"));
    const range = parseTimeRange(get(r, "start_time"));
    if (range) [start, end] = range;
    let periods: [number, number] | undefined;
    if (!start || !end) {
      const p = parsePeriods(get(r, "period"));
      if (!p) return fail("thiếu giờ hoặc tiết");
      const shift = isAfternoon(get(r, "session")) && p[1] <= MORNING_PERIODS ? MORNING_PERIODS : 0;
      periods = [p[0] + shift, p[1] + shift];
      const a = opts.bells.get(periods[0]);
      const b = opts.bells.get(periods[1]);
      if (!a || !b) return fail(`chưa có giờ của tiết ${periods[0] === periods[1] ? periods[0] : periods.join("–")}`);
      start = a[0];
      end = b[1];
    }
    if (start >= end) return fail("giờ kết thúc phải sau giờ bắt đầu");

    items.push({
      teacher,
      department: text(get(r, "department")) || null,
      room,
      title,
      class_name: className,
      kind: guessKind(title),
      ...("date" in day ? { date: day.date, weekday: null } : { weekday: day.weekday, date: null }),
      start_time: start,
      end_time: end,
      note: text(get(r, "note")) || null,
      _p: periods,
    });
  });

  return { items: mergeConsecutive(items), errors };
}

/** Gộp các tiết liền nhau cùng giáo viên, lớp, môn (vd. tiết 1 + tiết 2 Toán → 07:00–08:35). */
function mergeConsecutive(items: (ImportItem & { _p?: [number, number] })[]): ImportItem[] {
  const sameSlot = (a: ImportItem, b: ImportItem) =>
    a.teacher === b.teacher && a.title === b.title && a.class_name === b.class_name && a.room === b.room && a.weekday === b.weekday && a.date === b.date;
  const sorted = [...items].sort((a, b) =>
    `${a.teacher}|${a.weekday ?? a.date}|${a.start_time}`.localeCompare(`${b.teacher}|${b.weekday ?? b.date}|${b.start_time}`),
  );
  const out: (ImportItem & { _p?: [number, number] })[] = [];
  for (const it of sorted) {
    const prev = out[out.length - 1];
    if (prev && sameSlot(prev, it) && prev._p && it._p && it._p[0] === prev._p[1] + 1) {
      prev.end_time = it.end_time;
      prev._p = [prev._p[0], it._p[1]];
    } else out.push({ ...it });
  }
  return out.map(({ _p, ...rest }) => {
    void _p;
    return rest;
  });
}

// ---------- Nhận diện tự động ----------

/** Bảng trông giống thời khoá biểu: có thứ/ngày, có giờ hoặc tiết, có môn hoặc lớp. */
export function timetableScore(d: Dataset): { mapping: Mapping; ok: boolean } {
  const mapping = guessLevelColumns(d.rows, d.columns, guessMapping(d.columns));
  const ok = !!mapping.day && !!(mapping.period || mapping.start_time) && !!(mapping.title || mapping.class_name);
  return { mapping, ok };
}

/** Dấu vân tay ngắn để nhớ người dùng đã trả lời "Không" cho bộ dữ liệu này */
export function fingerprint(d: Dataset): string {
  let h = 0;
  const s = d.id + "|" + d.rows.length + "|" + JSON.stringify(d.rows.slice(0, 3));
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Khoá localStorage ghi nhớ bộ dữ liệu không cần hỏi import nữa (người dùng từ chối hoặc đã nhập xong) */
export const dismissKey = (fp: string) => `import-dismissed-${fp}`;

export function markImported(d: Dataset) {
  try {
    localStorage.setItem(dismissKey(fingerprint(d)), "1");
  } catch {
    // trình duyệt chặn localStorage
  }
}
