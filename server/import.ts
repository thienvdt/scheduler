// Nhập thời khoá biểu từ app khác: tạo giáo viên / phòng còn thiếu theo tên, đặt lịch lặp hằng tuần,
// bỏ qua (và báo lại) các buổi trùng với lịch đã có hoặc trùng nhau trong chính dữ liệu nhập.

import type { EventKind, ImportResult, ImportSkip, User } from "../src/shared/types";
import { EVENT_KINDS, MAX_IMPORT_ITEMS, MAX_IMPORT_SESSIONS, MAX_REPEAT_WEEKS } from "../src/shared/types";
import { HttpError, json, readBody, type Env } from "./http";
import { addDays, isValidDate, isValidTime, overlaps, weeklyDates } from "./time";

const PALETTE = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#f87171", "#22d3ee", "#fb923c", "#a3e635", "#e879f9"];

interface Item {
  teacher: string;
  department: string | null;
  room: string;
  title: string;
  class_name: string | null;
  kind: EventKind;
  dates: string[];
  start_time: string;
  end_time: string;
  note: string | null;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const key = (name: string) => name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

function parseItems(body: Record<string, unknown>): Item[] {
  const { items, start_date, weeks } = body;
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, "Không có dòng nào để nhập");
  if (items.length > MAX_IMPORT_ITEMS) throw new HttpError(400, `Tối đa ${MAX_IMPORT_ITEMS} dòng mỗi lần nhập`);
  if (!isValidDate(start_date)) throw new HttpError(400, "Ngày bắt đầu không hợp lệ");
  const n = Number(weeks);
  if (!Number.isInteger(n) || n < 1 || n > MAX_REPEAT_WEEKS) throw new HttpError(400, `Số tuần phải từ 1 đến ${MAX_REPEAT_WEEKS}`);

  let total = 0;
  const parsed = items.map((raw, i): Item => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const row = `Dòng ${i + 1}: `;
    const teacher = str(r.teacher, 100);
    const title = str(r.title, 200);
    const room = str(r.room, 100);
    if (!teacher) throw new HttpError(400, row + "thiếu giáo viên");
    if (!title) throw new HttpError(400, row + "thiếu tiêu đề / môn học");
    if (!room) throw new HttpError(400, row + "thiếu phòng / lớp");
    if (!isValidTime(r.start_time) || !isValidTime(r.end_time) || r.start_time >= r.end_time) {
      throw new HttpError(400, row + "giờ không hợp lệ");
    }
    let dates: string[];
    if (r.date !== undefined && r.date !== null && r.date !== "") {
      if (!isValidDate(r.date)) throw new HttpError(400, row + "ngày không hợp lệ");
      dates = [r.date];
    } else {
      const wd = Number(r.weekday);
      if (!Number.isInteger(wd) || wd < 1 || wd > 7) throw new HttpError(400, row + "thiếu thứ trong tuần");
      dates = weeklyDates(addDays(start_date, wd - 1), n);
    }
    total += dates.length;
    const kind = EVENT_KINDS.includes(r.kind as EventKind) ? (r.kind as EventKind) : "lecture";
    return {
      teacher,
      department: str(r.department, 100) || null,
      room,
      title,
      class_name: str(r.class_name, 200) || null,
      kind,
      dates,
      start_time: r.start_time,
      end_time: r.end_time,
      note: str(r.note, 2000) || null,
    };
  });
  if (total > MAX_IMPORT_SESSIONS) {
    throw new HttpError(400, `Quá nhiều buổi (${total}); tối đa ${MAX_IMPORT_SESSIONS} – hãy giảm số tuần hoặc nhập từng phần`);
  }
  return parsed;
}

interface Busy {
  date: string;
  start: string;
  end: string;
  title: string;
}

export async function handleImport(env: Env, request: Request, user: User): Promise<Response> {
  if (request.method !== "POST") throw new HttpError(404, "Không tìm thấy đường dẫn");
  const isAdmin = user.role === "admin";
  if (!isAdmin && !user.teacher_id) {
    throw new HttpError(403, "Tài khoản chưa được liên kết với giáo viên nên không thể nhập lịch");
  }
  const body = await readBody(request);
  const dryRun = body.dry_run === true;
  const items = parseItems(body);

  // ---- Giáo viên, phòng: khớp theo tên (không phân biệt hoa thường), thiếu thì tạo (chỉ quản trị viên) ----
  const { results: teacherRows } = await env.DB.prepare("SELECT id, name FROM teachers").all<{ id: string; name: string }>();
  const { results: roomRows } = await env.DB.prepare("SELECT id, name, is_virtual FROM rooms").all<{ id: string; name: string; is_virtual: number }>();
  const teacherIds = new Map(teacherRows.map((t) => [key(t.name), t.id]));
  const roomIds = new Map(roomRows.map((r) => [key(r.name), r.id]));
  const virtualRooms = new Set(roomRows.filter((r) => r.is_virtual).map((r) => r.id));

  const newTeachers: { id: string; name: string; department: string | null }[] = [];
  const newRooms: { id: string; name: string }[] = [];
  let ownName = "";
  if (!isAdmin) {
    ownName = teacherRows.find((t) => t.id === user.teacher_id)?.name ?? user.display_name;
  }

  const teacherOf = (item: Item): string => {
    if (!isAdmin) return user.teacher_id!;
    const k = key(item.teacher);
    let id = teacherIds.get(k);
    if (!id) {
      id = crypto.randomUUID();
      teacherIds.set(k, id);
      newTeachers.push({ id, name: item.teacher, department: item.department });
    }
    return id;
  };
  const roomOf = (item: Item): string | null => {
    const k = key(item.room);
    let id = roomIds.get(k);
    if (!id && isAdmin) {
      id = crypto.randomUUID();
      roomIds.set(k, id);
      newRooms.push({ id, name: item.room });
    }
    return id ?? null;
  };

  // ---- Lịch đã có trong khoảng ngày nhập: tải một lần, kiểm tra trùng trong bộ nhớ ----
  const allDates = items.flatMap((i) => i.dates).sort();
  const from = allDates[0];
  const to = allDates[allDates.length - 1];
  const { results: existing } = await env.DB.prepare(
    "SELECT id, title, teacher_id, room_id, date, start_time, end_time FROM sessions WHERE status = 'scheduled' AND date BETWEEN ? AND ?",
  )
    .bind(from, to)
    .all<{ id: string; title: string; teacher_id: string; room_id: string; date: string; start_time: string; end_time: string }>();
  const { results: parts } = await env.DB.prepare(
    `SELECT sp.session_id, sp.teacher_id FROM session_participants sp JOIN sessions s ON s.id = sp.session_id
     WHERE s.status = 'scheduled' AND s.date BETWEEN ? AND ?`,
  )
    .bind(from, to)
    .all<{ session_id: string; teacher_id: string }>();

  const byPerson = new Map<string, Busy[]>();
  const byRoom = new Map<string, Busy[]>();
  const push = (map: Map<string, Busy[]>, id: string, b: Busy) => map.set(id, [...(map.get(id) ?? []), b]);
  const sessionById = new Map(existing.map((s) => [s.id, s]));
  for (const s of existing) {
    const b = { date: s.date, start: s.start_time, end: s.end_time, title: s.title };
    push(byPerson, s.teacher_id, b);
    push(byRoom, s.room_id, b);
  }
  for (const p of parts) {
    const s = sessionById.get(p.session_id);
    if (s) push(byPerson, p.teacher_id, { date: s.date, start: s.start_time, end: s.end_time, title: s.title });
  }
  const clash = (list: Busy[] | undefined, date: string, start: string, end: string) =>
    list?.find((b) => b.date === date && overlaps(b.start, b.end, start, end));

  // ---- Lên danh sách buổi sẽ tạo ----
  const skipped: ImportSkip[] = [];
  const rows: { id: string; series: string | null; item: Item; teacherId: string; roomId: string; date: string }[] = [];
  for (const item of items) {
    const teacherId = teacherOf(item);
    const teacherName = isAdmin ? item.teacher : ownName;
    const roomId = roomOf(item);
    const series = item.dates.length > 1 ? crypto.randomUUID() : null;
    let created = 0;
    for (const date of item.dates) {
      const skip = (reason: string) =>
        skipped.push({ title: item.title, teacher: teacherName, date, start_time: item.start_time, end_time: item.end_time, reason });
      if (!roomId) {
        skip(`Chưa có phòng “${item.room}” – nhờ quản trị viên thêm phòng`);
        continue;
      }
      const busyT = clash(byPerson.get(teacherId), date, item.start_time, item.end_time);
      if (busyT) {
        skip(`${teacherName} đã có “${busyT.title}” ${busyT.start}–${busyT.end}`);
        continue;
      }
      const busyR = virtualRooms.has(roomId) ? undefined : clash(byRoom.get(roomId), date, item.start_time, item.end_time);
      if (busyR) {
        skip(`Phòng ${item.room} đã có “${busyR.title}” ${busyR.start}–${busyR.end}`);
        continue;
      }
      const b = { date, start: item.start_time, end: item.end_time, title: item.title };
      push(byPerson, teacherId, b);
      push(byRoom, roomId, b);
      rows.push({ id: crypto.randomUUID(), series, item, teacherId, roomId, date });
      created++;
    }
    // Chuỗi chỉ còn 1 buổi thì không cần series_id
    if (created === 1 && series) rows[rows.length - 1].series = null;
  }

  const usedTeachers = new Set(rows.map((r) => r.teacherId));
  const usedRooms = new Set(rows.map((r) => r.roomId));
  const teachersToCreate = newTeachers.filter((t) => usedTeachers.has(t.id));
  const roomsToCreate = newRooms.filter((r) => usedRooms.has(r.id));

  if (!dryRun && rows.length) {
    const offset = teacherRows.length;
    const insTeacher = env.DB.prepare("INSERT INTO teachers (id, name, email, phone, department, color) VALUES (?, ?, NULL, NULL, ?, ?)");
    const insRoom = env.DB.prepare("INSERT INTO rooms (id, name, building, capacity, equipment, is_virtual) VALUES (?, ?, NULL, NULL, NULL, 0)");
    const insSession = env.DB.prepare(
      `INSERT INTO sessions (id, series_id, title, class_name, teacher_id, room_id, date, start_time, end_time, note, status, kind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
    );
    const stmts = [
      ...teachersToCreate.map((t, i) => insTeacher.bind(t.id, t.name, t.department, PALETTE[(offset + i) % PALETTE.length])),
      ...roomsToCreate.map((r) => insRoom.bind(r.id, r.name)),
      ...rows.map((r) =>
        insSession.bind(r.id, r.series, r.item.title, r.item.class_name, r.teacherId, r.roomId, r.date, r.item.start_time, r.item.end_time, r.item.note, r.item.kind),
      ),
    ];
    // Giáo viên / phòng nằm ở lô đầu nên lịch ở các lô sau luôn tham chiếu được
    for (let i = 0; i < stmts.length; i += 500) await env.DB.batch(stmts.slice(i, i + 500));
  }

  const result: ImportResult = {
    dry_run: dryRun,
    teachers_created: teachersToCreate.map((t) => t.name),
    rooms_created: roomsToCreate.map((r) => r.name),
    sessions_created: rows.length,
    skipped_count: skipped.length,
    skipped: skipped.slice(0, 100),
  };
  return json(result, dryRun ? 200 : 201);
}
