import type {
  Conflict,
  Room,
  RoomInput,
  Session,
  SessionInput,
  SessionStatus,
  Teacher,
  TeacherInput,
} from "../src/shared/types";
import { MAX_REPEAT_WEEKS } from "../src/shared/types";
import { isValidDate, isValidTime, weeklyDates } from "./time";

export interface Env {
  DB: D1Database;
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    // rơi xuống lỗi bên dưới
  }
  throw new HttpError(400, "Dữ liệu gửi lên không phải JSON hợp lệ");
}

function optString(value: unknown, field: string, max = 500): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new HttpError(400, `Trường "${field}" phải là chuỗi`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new HttpError(400, `Trường "${field}" quá dài (tối đa ${max} ký tự)`);
  return trimmed === "" ? null : trimmed;
}

function reqString(value: unknown, field: string, max = 200): string {
  const s = optString(value, field, max);
  if (!s) throw new HttpError(400, `Thiếu trường bắt buộc "${field}"`);
  return s;
}

// ---------- Giảng viên ----------

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function parseTeacher(body: Record<string, unknown>): Required<TeacherInput> {
  const color = optString(body.color, "color", 7) ?? "#60a5fa";
  if (!COLOR_RE.test(color)) throw new HttpError(400, "Màu phải có dạng #RRGGBB");
  return {
    name: reqString(body.name, "name"),
    email: optString(body.email, "email", 200),
    phone: optString(body.phone, "phone", 50),
    department: optString(body.department, "department", 200),
    color,
  };
}

async function listTeachers(env: Env) {
  const { results } = await env.DB.prepare("SELECT * FROM teachers ORDER BY name COLLATE NOCASE").all<Teacher>();
  return json(results);
}

async function createTeacher(env: Env, request: Request) {
  const t = parseTeacher(await readBody(request));
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO teachers (id, name, email, phone, department, color) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, t.name, t.email, t.phone, t.department, t.color)
    .run();
  return json(await getById<Teacher>(env, "teachers", id), 201);
}

async function updateTeacher(env: Env, request: Request, id: string) {
  await mustExist(env, "teachers", id, "giảng viên");
  const t = parseTeacher(await readBody(request));
  await env.DB.prepare(
    "UPDATE teachers SET name = ?, email = ?, phone = ?, department = ?, color = ? WHERE id = ?",
  )
    .bind(t.name, t.email, t.phone, t.department, t.color, id)
    .run();
  return json(await getById<Teacher>(env, "teachers", id));
}

// ---------- Phòng ----------

function parseRoom(body: Record<string, unknown>): Required<RoomInput> {
  let capacity: number | null = null;
  if (body.capacity !== undefined && body.capacity !== null && body.capacity !== "") {
    capacity = Number(body.capacity);
    if (!Number.isInteger(capacity) || capacity < 0 || capacity > 100000) {
      throw new HttpError(400, "Sức chứa phải là số nguyên không âm");
    }
  }
  return {
    name: reqString(body.name, "name"),
    building: optString(body.building, "building", 200),
    capacity,
    equipment: optString(body.equipment, "equipment", 500),
  };
}

async function listRooms(env: Env) {
  const { results } = await env.DB.prepare("SELECT * FROM rooms ORDER BY name COLLATE NOCASE").all<Room>();
  return json(results);
}

async function createRoom(env: Env, request: Request) {
  const r = parseRoom(await readBody(request));
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO rooms (id, name, building, capacity, equipment) VALUES (?, ?, ?, ?, ?)")
    .bind(id, r.name, r.building, r.capacity, r.equipment)
    .run();
  return json(await getById<Room>(env, "rooms", id), 201);
}

async function updateRoom(env: Env, request: Request, id: string) {
  await mustExist(env, "rooms", id, "phòng");
  const r = parseRoom(await readBody(request));
  await env.DB.prepare("UPDATE rooms SET name = ?, building = ?, capacity = ?, equipment = ? WHERE id = ?")
    .bind(r.name, r.building, r.capacity, r.equipment, id)
    .run();
  return json(await getById<Room>(env, "rooms", id));
}

/** Không cho xoá giảng viên/phòng khi còn lịch giảng tham chiếu tới. */
async function deleteReferenced(env: Env, table: "teachers" | "rooms", id: string) {
  const label = table === "teachers" ? "giảng viên" : "phòng";
  await mustExist(env, table, id, label);
  const column = table === "teachers" ? "teacher_id" : "room_id";
  const used = await env.DB.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE ${column} = ?`)
    .bind(id)
    .first<{ n: number }>();
  if (used && used.n > 0) {
    throw new HttpError(409, `Không thể xoá ${label} đang có ${used.n} buổi giảng. Hãy xoá hoặc chuyển các buổi đó trước.`);
  }
  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  return new Response(null, { status: 204 });
}

// ---------- Lịch giảng ----------

const SESSION_SELECT = `
  SELECT s.*, t.name AS teacher_name, t.color AS teacher_color, r.name AS room_name
  FROM sessions s
  JOIN teachers t ON t.id = s.teacher_id
  JOIN rooms r ON r.id = s.room_id`;

type ParsedSession = Required<Omit<SessionInput, "repeat_weeks">> & { repeat_weeks: number };

function parseSession(body: Record<string, unknown>): ParsedSession {
  const date = body.date;
  const start = body.start_time;
  const end = body.end_time;
  if (!isValidDate(date)) throw new HttpError(400, "Ngày không hợp lệ (định dạng YYYY-MM-DD)");
  if (!isValidTime(start) || !isValidTime(end)) throw new HttpError(400, "Giờ không hợp lệ (định dạng HH:MM)");
  if (start >= end) throw new HttpError(400, "Giờ kết thúc phải sau giờ bắt đầu");

  const status = (body.status ?? "scheduled") as SessionStatus;
  if (status !== "scheduled" && status !== "cancelled") throw new HttpError(400, "Trạng thái không hợp lệ");

  const repeat = body.repeat_weeks === undefined ? 1 : Number(body.repeat_weeks);
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > MAX_REPEAT_WEEKS) {
    throw new HttpError(400, `Số tuần lặp phải từ 1 đến ${MAX_REPEAT_WEEKS}`);
  }

  return {
    title: reqString(body.title, "title"),
    class_name: optString(body.class_name, "class_name", 200),
    teacher_id: reqString(body.teacher_id, "teacher_id"),
    room_id: reqString(body.room_id, "room_id"),
    date,
    start_time: start,
    end_time: end,
    note: optString(body.note, "note", 2000),
    status,
    repeat_weeks: repeat,
  };
}

/** Tìm các buổi đã lên lịch trùng giờ với cùng giảng viên hoặc cùng phòng. */
export async function findConflicts(
  env: Env,
  s: { teacher_id: string; room_id: string; date: string; start_time: string; end_time: string },
  excludeId: string | null,
): Promise<Conflict[]> {
  const { results } = await env.DB.prepare(
    `${SESSION_SELECT}
     WHERE s.date = ? AND s.status = 'scheduled'
       AND s.start_time < ? AND s.end_time > ?
       AND (s.teacher_id = ? OR s.room_id = ?)
       AND s.id != ?
     ORDER BY s.start_time`,
  )
    .bind(s.date, s.end_time, s.start_time, s.teacher_id, s.room_id, excludeId ?? "")
    .all<Session>();

  const conflicts: Conflict[] = [];
  for (const other of results) {
    if (other.teacher_id === s.teacher_id) conflicts.push({ date: s.date, kind: "teacher", session: other });
    if (other.room_id === s.room_id) conflicts.push({ date: s.date, kind: "room", session: other });
  }
  return conflicts;
}

async function ensureRefs(env: Env, teacherId: string, roomId: string) {
  if (!(await exists(env, "teachers", teacherId))) throw new HttpError(400, "Giảng viên không tồn tại");
  if (!(await exists(env, "rooms", roomId))) throw new HttpError(400, "Phòng không tồn tại");
}

function conflictError(conflicts: Conflict[]): HttpError {
  return new HttpError(409, "Lịch bị trùng với buổi giảng khác", { conflicts });
}

async function listSessions(env: Env, url: URL) {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!isValidDate(from) || !isValidDate(to)) throw new HttpError(400, "Cần tham số from và to (YYYY-MM-DD)");

  const where = ["s.date >= ?", "s.date <= ?"];
  const params: unknown[] = [from, to];
  const teacherId = url.searchParams.get("teacherId");
  const roomId = url.searchParams.get("roomId");
  if (teacherId) {
    where.push("s.teacher_id = ?");
    params.push(teacherId);
  }
  if (roomId) {
    where.push("s.room_id = ?");
    params.push(roomId);
  }

  const { results } = await env.DB.prepare(`${SESSION_SELECT} WHERE ${where.join(" AND ")} ORDER BY s.date, s.start_time`)
    .bind(...params)
    .all<Session>();
  return json(results);
}

async function createSession(env: Env, request: Request) {
  const s = parseSession(await readBody(request));
  await ensureRefs(env, s.teacher_id, s.room_id);

  const dates = weeklyDates(s.date, s.repeat_weeks);
  if (s.status === "scheduled") {
    const conflicts: Conflict[] = [];
    for (const date of dates) conflicts.push(...(await findConflicts(env, { ...s, date }, null)));
    if (conflicts.length) throw conflictError(conflicts);
  }

  const seriesId = dates.length > 1 ? crypto.randomUUID() : null;
  const ids = dates.map(() => crypto.randomUUID());
  const insert = env.DB.prepare(
    `INSERT INTO sessions (id, series_id, title, class_name, teacher_id, room_id, date, start_time, end_time, note, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  await env.DB.batch(
    dates.map((date, i) =>
      insert.bind(ids[i], seriesId, s.title, s.class_name, s.teacher_id, s.room_id, date, s.start_time, s.end_time, s.note, s.status),
    ),
  );

  const placeholders = ids.map(() => "?").join(",");
  const { results } = await env.DB.prepare(`${SESSION_SELECT} WHERE s.id IN (${placeholders}) ORDER BY s.date`)
    .bind(...ids)
    .all<Session>();
  return json(results, 201);
}

async function updateSession(env: Env, request: Request, id: string) {
  const existing = await getById<Session>(env, "sessions", id);
  if (!existing) throw new HttpError(404, "Không tìm thấy buổi giảng");
  const body = await readBody(request);
  // Cho phép cập nhật một phần (vd. chỉ đổi status), các trường thiếu giữ nguyên giá trị cũ.
  const s = parseSession({ ...existing, ...body, repeat_weeks: 1 });
  await ensureRefs(env, s.teacher_id, s.room_id);

  if (s.status === "scheduled") {
    const conflicts = await findConflicts(env, s, id);
    if (conflicts.length) throw conflictError(conflicts);
  }

  await env.DB.prepare(
    `UPDATE sessions SET title = ?, class_name = ?, teacher_id = ?, room_id = ?, date = ?,
       start_time = ?, end_time = ?, note = ?, status = ? WHERE id = ?`,
  )
    .bind(s.title, s.class_name, s.teacher_id, s.room_id, s.date, s.start_time, s.end_time, s.note, s.status, id)
    .run();

  const updated = await env.DB.prepare(`${SESSION_SELECT} WHERE s.id = ?`).bind(id).first<Session>();
  return json(updated);
}

async function deleteSession(env: Env, url: URL, id: string) {
  const existing = await getById<Session>(env, "sessions", id);
  if (!existing) throw new HttpError(404, "Không tìm thấy buổi giảng");
  // scope=following: xoá buổi này và các buổi sau trong cùng chuỗi lặp.
  if (url.searchParams.get("scope") === "following" && existing.series_id) {
    await env.DB.prepare("DELETE FROM sessions WHERE series_id = ? AND date >= ?")
      .bind(existing.series_id, existing.date)
      .run();
  } else {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
  }
  return new Response(null, { status: 204 });
}

// ---------- Tiện ích DB ----------

type Table = "teachers" | "rooms" | "sessions";

async function getById<T>(env: Env, table: Table, id: string): Promise<T | null> {
  return env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first<T>();
}

async function exists(env: Env, table: Table, id: string): Promise<boolean> {
  return (await env.DB.prepare(`SELECT 1 AS ok FROM ${table} WHERE id = ?`).bind(id).first()) !== null;
}

async function mustExist(env: Env, table: Table, id: string, label: string) {
  if (!(await exists(env, table, id))) throw new HttpError(404, `Không tìm thấy ${label}`);
}

// ---------- Router ----------

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const [resource, id, ...rest] = parts;
  const method = request.method;

  try {
    if (rest.length) throw new HttpError(404, "Không tìm thấy đường dẫn");

    if (resource === "health" && !id && method === "GET") return json({ ok: true });

    if (resource === "teachers") {
      if (!id && method === "GET") return await listTeachers(env);
      if (!id && method === "POST") return await createTeacher(env, request);
      if (id && method === "PUT") return await updateTeacher(env, request, id);
      if (id && method === "DELETE") return await deleteReferenced(env, "teachers", id);
    }

    if (resource === "rooms") {
      if (!id && method === "GET") return await listRooms(env);
      if (!id && method === "POST") return await createRoom(env, request);
      if (id && method === "PUT") return await updateRoom(env, request, id);
      if (id && method === "DELETE") return await deleteReferenced(env, "rooms", id);
    }

    if (resource === "sessions") {
      if (!id && method === "GET") return await listSessions(env, url);
      if (!id && method === "POST") return await createSession(env, request);
      if (id && method === "PUT") return await updateSession(env, request, id);
      if (id && method === "DELETE") return await deleteSession(env, url, id);
    }

    throw new HttpError(404, "Không tìm thấy đường dẫn");
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message, ...err.extra }, err.status);
    console.error(err);
    return json({ error: "Lỗi máy chủ" }, 500);
  }
}
