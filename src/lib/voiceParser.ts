// Phân tích câu lệnh tiếng Việt (từ nhận dạng giọng nói hoặc gõ tay) thành bản nháp buổi giảng.
// Ví dụ: "Thứ 3 tuần sau thầy An dạy Lập trình Web lớp K66A phòng A101 từ 7 giờ đến 9 giờ 30, lặp 10 tuần"

import type { EventKind, Room, Teacher } from "@/shared/types";
import { MAX_REPEAT_WEEKS } from "@/shared/types";
import { addDays, fromISODate, minutesToTime, toISODate } from "./date";

export interface ParsedCommand {
  title?: string;
  class_name?: string;
  teacher_id?: string;
  room_id?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  repeat_weeks?: number;
  kind?: EventKind;
}

/**
 * Bỏ dấu tiếng Việt và viết thường, giữ nguyên độ dài chuỗi
 * để vị trí khớp trên chuỗi đã chuẩn hoá dùng được cho chuỗi gốc.
 */
export function fold(text: string): string {
  let out = "";
  for (const ch of text) {
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    const c = (base.length === 1 ? base : ch).toLowerCase();
    out += c === "đ" ? "d" : c.length === 1 ? c : ch;
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const WEEKDAY_WORDS: Record<string, number> = {
  "2": 1, hai: 1,
  "3": 2, ba: 2,
  "4": 3, tu: 3,
  "5": 4, nam: 4,
  "6": 5, sau: 5,
  "7": 6, bay: 6,
};

// Từ khoá kết thúc một cụm tự do (tên môn, tên lớp)
const STOP_RE =
  /\s(?:phong|lop|tu|luc|vao|thu|chu nhat|ngay|hom nay|tuan|lap|den|tai|o|sang|chieu|toi|thay|co|giang vien|gv|trong|cho|bat dau|ket thuc|ts|ths|pgs|gs)(?=\s|$)|[,.;!?]|\s{2,}|\s\d{1,2}\s*(?:gio|h(?![a-z])|:)/;

class Cursor {
  /** Chuỗi đã chuẩn hoá, các đoạn đã dùng được thay bằng khoảng trắng để không bị khớp lại. */
  folded: string;
  constructor(
    public original: string,
    folded: string,
  ) {
    this.folded = folded;
  }

  mask(start: number, end: number) {
    this.folded = this.folded.slice(0, start) + " ".repeat(end - start) + this.folded.slice(end);
  }

  match(re: RegExp): RegExpExecArray | null {
    return re.exec(this.folded);
  }

  /** Lấy cụm tự do bắt đầu tại `start` cho tới từ khoá dừng tiếp theo. */
  phrase(start: number, maxWords = 8): { text: string; end: number } | null {
    // Vùng đã dùng (bị thay bằng nhiều khoảng trắng) cũng là điểm dừng
    const stop = STOP_RE.exec(this.folded.slice(start));
    let end = stop ? start + stop.index : this.folded.length;
    let text = this.original.slice(start, end).trim();
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > maxWords) {
      text = words.slice(0, maxWords).join(" ");
      end = start + this.original.slice(start).indexOf(text) + text.length;
    }
    return text ? { text, end } : null;
  }
}

function parseMinutePart(part: string | undefined): number {
  if (!part) return 0;
  if (part === "ruoi") return 30;
  return Number(part);
}

function clampTime(min: number): string | undefined {
  if (min < 0 || min >= 24 * 60) return undefined;
  return minutesToTime(min);
}

/** Giờ 1–6 không ghi rõ buổi được hiểu là buổi chiều/tối (không ai dạy lúc 3 giờ sáng). */
function toMinutes(hour: number, minute: number, suffix: string | undefined): number {
  let h = hour;
  if (suffix && /chieu|toi/.test(suffix) && h < 12) h += 12;
  else if (!suffix && h >= 1 && h <= 6) h += 12;
  return h * 60 + Math.min(minute, 59);
}

const TIME_UNIT = String.raw`(?:\s*(?:gio|h(?![a-z])|:)\s*(\d{1,2}|ruoi)?(?:\s*phut)?)`;
const DAY_PART = String.raw`(?:\s*(sang|trua|chieu|toi))?`;

function parseTimes(c: Cursor, out: ParsedCommand) {
  // Khoảng giờ: "từ 7 giờ đến 9 giờ 30", "7h-9h", "từ 1 đến 3 giờ chiều"
  const range = new RegExp(
    String.raw`(tu\s+)?(\d{1,2})(${TIME_UNIT})?${DAY_PART}\s*(?:den|toi|-|–)\s*(\d{1,2})(${TIME_UNIT})?${DAY_PART}`,
  );
  let m = c.match(range);
  // Bắt buộc có "từ" hoặc đơn vị giờ, tránh nhầm với ngày "7-9"
  while (m && !m[1] && !m[3] && !m[7]) {
    const masked = m.index + m[0].length;
    const next = new RegExp(range.source).exec(c.folded.slice(masked));
    m = next ? Object.assign(next, { index: next.index + masked }) : null;
  }
  if (m) {
    const endSuffix = m[9];
    const startSuffix = m[5] ?? (endSuffix && /chieu|toi/.test(endSuffix) ? endSuffix : undefined);
    const start = toMinutes(Number(m[2]), parseMinutePart(m[4]), startSuffix);
    let end = toMinutes(Number(m[6]), parseMinutePart(m[8]), endSuffix);
    if (end <= start && end + 12 * 60 > start) end += 12 * 60;
    out.start_time = clampTime(start);
    out.end_time = clampTime(end);
    c.mask(m.index, m.index + m[0].length);
    return;
  }

  // Một mốc giờ: "lúc 7 giờ 30", "7h"
  const single = new RegExp(String.raw`(\d{1,2})${TIME_UNIT}${DAY_PART}`);
  m = c.match(single);
  if (!m) return;
  const start = toMinutes(Number(m[1]), parseMinutePart(m[2]), m[3]);
  c.mask(m.index, m.index + m[0].length);

  // Thời lượng: "trong 2 tiếng", "1 tiếng rưỡi", "90 phút"
  let duration = 120;
  const d = c.match(/(?:trong\s+)?(\d+(?:[.,]5)?)\s*(?:tieng|gio)(\s*ruoi)?|(\d{2,3})\s*phut/);
  if (d) {
    duration = d[3] ? Number(d[3]) : Math.round((Number(d[1].replace(",", ".")) + (d[2] ? 0.5 : 0)) * 60);
    c.mask(d.index, d.index + d[0].length);
  }
  out.start_time = clampTime(start);
  out.end_time = clampTime(start + duration);
}

/** "hôm nay", "ngày mai", "thứ 3 (tuần sau)", "chủ nhật" — chạy trước khi tách giờ để "thứ 7" không bị hiểu là 7 giờ. */
function parseRelativeDate(c: Cursor, out: ParsedCommand, today: string) {
  const rel: [RegExp, number][] = [
    [/hom nay/, 0],
    [/ngay mai/, 1],
    // "chiều mai", "mai 8 giờ" – "Mai" đứng một mình có thể là tên người
    [/(?<=(?:sang|trua|chieu|toi) )mai(?![\p{L}])|(?<![\p{L}])mai(?= (?:luc |vao )?\d)/u, 1],
    [/ngay (?:kia|mot)/, 2],
  ];
  for (const [re, offset] of rel) {
    const m = c.match(re);
    if (m) {
      out.date = addDays(today, offset);
      c.mask(m.index, m.index + m[0].length);
      return;
    }
  }

  // "thứ 3", "thứ ba", "chủ nhật" (+ "tuần sau"/"tuần tới")
  const wd = c.match(/thu\s+(2|3|4|5|6|7|hai|ba|tu|nam|sau|bay)\b|chu nhat/);
  if (!wd) return;
  const target = wd[1] ? WEEKDAY_WORDS[wd[1]] : 0; // 0 = Chủ nhật, theo Date.getDay()
  c.mask(wd.index, wd.index + wd[0].length);

  const t = fromISODate(today);
  let offset = (target - t.getDay() + 7) % 7;
  const next = c.match(/tuan\s+(?:sau|toi)/);
  if (next) {
    // Tuần sau = tuần (Thứ 2 – CN) kế tiếp
    const mondayOffset = -((t.getDay() + 6) % 7);
    offset = mondayOffset + 7 + ((target + 6) % 7);
    c.mask(next.index, next.index + next[0].length);
  }
  out.date = addDays(today, offset);
}

/** "ngày 15/10", "15-10-2026", "ngày 15 tháng 10" — chạy sau khi tách giờ để "7-9 giờ" không bị hiểu là ngày. */
function parseExplicitDate(c: Cursor, out: ParsedCommand, today: string) {
  if (out.date) return;
  // "ngày 15/10", "15-10-2026", "ngày 15 tháng 10"
  const explicit =
    c.match(/(?:ngay\s+)?(\d{1,2})\s*[/.-]\s*(\d{1,2})(?:\s*[/.-]\s*(\d{4}))?/) ??
    c.match(/(?:ngay\s+)?(\d{1,2})\s+thang\s+(\d{1,2})(?:\s+nam\s+(\d{4}))?/);
  if (explicit) {
    const day = Number(explicit[1]);
    const month = Number(explicit[2]);
    const t = fromISODate(today);
    let year = explicit[3] ? Number(explicit[3]) : t.getFullYear();
    const build = (y: number) => new Date(y, month - 1, day);
    let d = build(year);
    // Không ghi năm và ngày đã qua hơn 1 tháng → hiểu là năm sau
    if (!explicit[3] && t.getTime() - d.getTime() > 31 * 86400000) d = build(++year);
    if (d.getMonth() === month - 1 && d.getDate() === day) {
      out.date = toISODate(d);
      c.mask(explicit.index, explicit.index + explicit[0].length);
    }
  }
}

function parseRepeat(c: Cursor, out: ParsedCommand) {
  const m =
    c.match(/(?:lap(?:\s+lai)?|hang\s+tuan)(?:\s+(?:trong|hang tuan))?\s+(\d{1,2})\s*tuan/) ??
    c.match(/trong\s+(\d{1,2})\s*tuan/);
  if (!m) return;
  out.repeat_weeks = Math.min(Math.max(Number(m[1]), 1), MAX_REPEAT_WEEKS);
  c.mask(m.index, m.index + m[0].length);
}

function parseRoom(c: Cursor, out: ParsedCommand, rooms: Room[]) {
  let best: { room: Room; index: number; length: number } | null = null;
  for (const room of rooms) {
    const key = fold(room.name).replace(/\s+/g, "");
    if (!key) continue;
    // Cho phép khoảng trắng giữa các ký tự: "a 101" khớp "A101"
    const pattern = [...key].map(escapeRe).join(String.raw`\s*`);
    const m = new RegExp(String.raw`(?:phong\s+)?(?<![\p{L}\d])${pattern}(?![\p{L}\d])`, "u").exec(c.folded);
    if (m && (!best || key.length > best.length)) best = { room, index: m.index, length: m[0].length };
  }
  if (best) {
    out.room_id = best.room.id;
    c.mask(best.index, best.index + best.length);
  }
}

const HONORIFICS = /^(?:ths|ts|pgs|gs|tskh|cn|ks|thay|co|gv)\.?\s+/;

// Cách xưng hô đứng trước tên gọi: trường học + doanh nghiệp/văn phòng ("chị Lan", "anh Minh", "sếp Hùng")
// "(?<!thu )" để "thứ ba An…" không bị hiểu là "bà An"
const ADDRESS = String.raw`(?<!thu )(?:thay|co|giang vien|gv|ts|ths|pgs|gs|anh|chi|ong|ba|em|sep|chu|bac|nhan vien|can bo|dong chi|dc)`;

function parseTeacher(c: Cursor, out: ParsedCommand, teachers: Teacher[]) {
  let best: { teacher: Teacher; score: number; index: number; length: number } | null = null;
  let ambiguous = false;

  for (const teacher of teachers) {
    let name = fold(teacher.name).trim();
    while (HONORIFICS.test(name)) name = name.replace(HONORIFICS, "");
    const words = name.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    // Thử từ họ tên đầy đủ → 2 chữ cuối → tên gọi (chữ cuối, cần "thầy/cô/anh/chị…" đứng trước)
    const candidates: [string, number][] = [[words.join(" "), 3]];
    if (words.length > 2) candidates.push([words.slice(-2).join(" "), 2]);
    candidates.push([`${ADDRESS}\\.?\\s+${escapeRe(words[words.length - 1])}`, 1]);

    for (const [pattern, score] of candidates) {
      const re = new RegExp(String.raw`(?:${ADDRESS}\s+)?(?<![\p{L}])${score === 1 ? pattern : escapeRe(pattern)}(?![\p{L}])`, "u");
      const m = re.exec(c.folded);
      if (!m) continue;
      if (!best || score > best.score) {
        best = { teacher, score, index: m.index, length: m[0].length };
        ambiguous = false;
      } else if (score === best.score && best.teacher.id !== teacher.id) {
        ambiguous = true;
      }
      break;
    }
  }

  if (best && !ambiguous) {
    out.teacher_id = best.teacher.id;
    c.mask(best.index, best.index + best.length);
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase("vi") + s.slice(1);
}

function parseClass(c: Cursor, out: ParsedCommand) {
  const m = c.match(/(?<![\p{L}])lop /u);
  if (!m) return;
  const p = c.phrase(m.index + m[0].length, 3);
  if (!p) return;
  out.class_name = p.text.toUpperCase();
  c.mask(m.index, p.end);
}

const FILLER_RE = /^(?:(?:dat|tao|them|xep)\s+lich(?:\s+giang|\s+day|\s+hoc)?|lich|buoi(?:\s+hoc|\s+giang)?|giang|day|cho|va|o|tai)(?:\s+|$)/;
// Không có "cô"/"thầy" ở đây vì "cơ" cũng chuẩn hoá thành "co" (vd. "Cơ sở dữ liệu")
const TRAILING_FILLER_RE = /(?:\s+(?:cho|cua|voi|va|o|tai|vao|luc|thay|co|giang vien|gv))+$/;

function parseTitle(c: Cursor, out: ParsedCommand) {
  const m = c.match(/(?<![\p{L}])(?:day (?:mon|hoc phan) |mon(?: hoc)? |hoc phan |day )/u);
  // Dùng đúng 1 khoảng trắng: chuỗi nhiều khoảng trắng là vùng đã dùng, không được nuốt qua
  if (m) {
    const p = c.phrase(m.index + m[0].length);
    if (p) {
      out.title = capitalize(p.text);
      c.mask(m.index, p.end);
      return;
    }
  }

  // Không có "dạy"/"môn": lấy đoạn chữ dài nhất còn lại sau khi bỏ các từ đệm
  let best = "";
  const segment = /[^,.;!?]+?(?=\s{2,}|[,.;!?]|$)/g;
  for (let s = segment.exec(c.folded); s; s = segment.exec(c.folded)) {
    let start = s.index + (s[0].length - s[0].trimStart().length);
    let rest = c.folded.slice(start, s.index + s[0].length).trimEnd();
    for (let f = FILLER_RE.exec(rest); f && f[0]; f = FILLER_RE.exec(rest)) {
      start += f[0].length;
      rest = rest.slice(f[0].length);
    }
    rest = rest.replace(TRAILING_FILLER_RE, "");
    const text = c.original.slice(start, start + rest.length).trim();
    if (/\p{L}{2,}/u.test(text) && text.length > best.length) best = text;
  }
  if (best) out.title = capitalize(best);
}

const w = (words: string) => new RegExp(String.raw`(?<![\p{L}])(?:${words})(?![\p{L}])`, "u");

// Thứ tự quan trọng: cụm cụ thể trước cụm chung ("họp với khách hàng" → gặp khách hàng, không phải họp)
const KIND_PATTERNS: [RegExp, EventKind][] = [
  [w("coi thi"), "exam"],
  [/(?<![\p{L}])bao ve (?:luan van|luan an|do an|khoa luan)/u, "defense"],
  [w("tiep sinh vien"), "office_hours"],
  [w("tiep khach|tiep dan|tiep cong dan|tiep doan|don doan"), "reception"],
  [w("khach hang|doi tac"), "client"],
  [w("phong van(?! thu)"), "interview"],
  [w("hop 1 1|hop mot mot|one on one|1 kem 1"), "one_on_one"],
  [w("dao tao|tap huan|training"), "training"],
  [w("hoi nghi"), "conference"],
  [w("seminar|hoi thao|workshop"), "seminar"],
  [w("di cong tac|cong tac"), "business_trip"],
  [w("truc co quan|truc ban|lich truc|di truc|truc"), "duty"],
  [w("hop|giao ban"), "meeting"],
  [w("thuc hanh"), "practice"],
];

/** Nhận loại lịch từ từ khoá; không che chữ vì từ khoá thường cũng là một phần tiêu đề ("Họp bộ môn"). */
function parseKind(c: Cursor, out: ParsedCommand) {
  // "1:1" sẽ bị hiểu là giờ 01:01 → đổi thành "1 1" trước khi tìm
  const oneOnOne = /(?<!\d)1\s*[:-]\s*1(?!\d)/.exec(c.folded);
  if (oneOnOne) {
    out.kind = "one_on_one";
    c.mask(oneOnOne.index, oneOnOne.index + oneOnOne[0].length);
    return;
  }
  for (const [re, kind] of KIND_PATTERNS) {
    if (re.test(c.folded)) {
      out.kind = kind;
      return;
    }
  }
}

export function parseVoiceCommand(
  text: string,
  ctx: { teachers: Teacher[]; rooms: Room[]; today: string },
): ParsedCommand {
  const original = " " + text.normalize("NFC").replace(/\s+/g, " ").trim() + " ";
  const c = new Cursor(original, fold(original));
  const out: ParsedCommand = {};

  // Thứ tự quan trọng: tên riêng (phòng, giảng viên) trước để số trong "A101" không bị hiểu là giờ/ngày.
  parseKind(c, out);
  parseRoom(c, out, ctx.rooms);
  parseTeacher(c, out, ctx.teachers);
  parseRepeat(c, out);
  parseRelativeDate(c, out, ctx.today);
  parseTimes(c, out);
  parseExplicitDate(c, out, ctx.today);
  parseClass(c, out);
  parseTitle(c, out);
  return out;
}
