import type {
  Room,
  RoomInput,
  Teacher,
  TeacherInput,
  Template,
  TemplateInput,
} from "../src/shared/types";
import { MAX_REPEAT_WEEKS } from "../src/shared/types";
import { isValidTime } from "./time";
import { handleAuth, handleUsers, requireAdmin, requireUser } from "./auth";
import { createSession, deleteSession, listSessions, parseKind, updateSession } from "./sessions";
import { handleSettings } from "./settings";
import { HttpError, json, optString, readBody, reqString, type Env } from "./http";

export type { Env };

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
  if (body.is_virtual !== undefined && typeof body.is_virtual !== "boolean" && body.is_virtual !== 0 && body.is_virtual !== 1) {
    throw new HttpError(400, "Trường is_virtual không hợp lệ");
  }
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
    is_virtual: !!body.is_virtual,
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
  await env.DB.prepare("INSERT INTO rooms (id, name, building, capacity, equipment, is_virtual) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, r.name, r.building, r.capacity, r.equipment, r.is_virtual ? 1 : 0)
    .run();
  return json(await getById<Room>(env, "rooms", id), 201);
}

async function updateRoom(env: Env, request: Request, id: string) {
  await mustExist(env, "rooms", id, "phòng");
  const r = parseRoom(await readBody(request));
  await env.DB.prepare("UPDATE rooms SET name = ?, building = ?, capacity = ?, equipment = ?, is_virtual = ? WHERE id = ?")
    .bind(r.name, r.building, r.capacity, r.equipment, r.is_virtual ? 1 : 0, id)
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
    throw new HttpError(409, `Không thể xoá ${label} đang có ${used.n} lịch. Hãy xoá hoặc chuyển các buổi đó trước.`);
  }
  // Mẫu lịch, người tham dự, tài khoản chỉ tham chiếu phụ → bỏ tham chiếu thay vì chặn xoá
  await env.DB.batch([
    env.DB.prepare(`UPDATE templates SET ${column} = NULL WHERE ${column} = ?`).bind(id),
    ...(table === "teachers"
      ? [
          env.DB.prepare("DELETE FROM session_participants WHERE teacher_id = ?").bind(id),
          env.DB.prepare("UPDATE users SET teacher_id = NULL WHERE teacher_id = ?").bind(id),
        ]
      : []),
    env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id),
  ]);
  return new Response(null, { status: 204 });
}

// ---------- Mẫu lịch ----------

function parseTemplate(body: Record<string, unknown>): Required<TemplateInput> {
  const duration = Number(body.duration_minutes);
  if (!Number.isInteger(duration) || duration < 5 || duration > 24 * 60) {
    throw new HttpError(400, "Thời lượng phải từ 5 đến 1440 phút");
  }
  const start = optString(body.start_time, "start_time", 5);
  if (start !== null && !isValidTime(start)) throw new HttpError(400, "Giờ bắt đầu không hợp lệ (HH:MM)");
  const repeat = body.repeat_weeks === undefined || body.repeat_weeks === null ? 1 : Number(body.repeat_weeks);
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > MAX_REPEAT_WEEKS) {
    throw new HttpError(400, `Số tuần lặp phải từ 1 đến ${MAX_REPEAT_WEEKS}`);
  }
  const sortOrder = body.sort_order === undefined || body.sort_order === null ? 1000 : Number(body.sort_order);
  if (!Number.isInteger(sortOrder)) throw new HttpError(400, "Thứ tự không hợp lệ");
  return {
    name: reqString(body.name, "name"),
    kind: parseKind(body.kind, "meeting"),
    icon: optString(body.icon, "icon", 16),
    title: optString(body.title, "title", 200),
    duration_minutes: duration,
    start_time: start,
    repeat_weeks: repeat,
    teacher_id: optString(body.teacher_id, "teacher_id"),
    room_id: optString(body.room_id, "room_id"),
    note: optString(body.note, "note", 2000),
    sort_order: sortOrder,
  };
}

async function ensureTemplateRefs(env: Env, t: Required<TemplateInput>) {
  if (t.teacher_id && !(await exists(env, "teachers", t.teacher_id))) throw new HttpError(400, "Giảng viên không tồn tại");
  if (t.room_id && !(await exists(env, "rooms", t.room_id))) throw new HttpError(400, "Phòng không tồn tại");
}

async function listTemplates(env: Env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM templates ORDER BY sort_order, name COLLATE NOCASE",
  ).all<Template>();
  return json(results);
}

async function createTemplate(env: Env, request: Request) {
  const t = parseTemplate(await readBody(request));
  await ensureTemplateRefs(env, t);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO templates (id, name, kind, icon, title, duration_minutes, start_time, repeat_weeks, teacher_id, room_id, note, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, t.name, t.kind, t.icon, t.title, t.duration_minutes, t.start_time, t.repeat_weeks, t.teacher_id, t.room_id, t.note, t.sort_order)
    .run();
  return json(await getById<Template>(env, "templates", id), 201);
}

async function updateTemplate(env: Env, request: Request, id: string) {
  const existing = await getById<Template>(env, "templates", id);
  if (!existing) throw new HttpError(404, "Không tìm thấy mẫu lịch");
  const t = parseTemplate({ ...existing, ...(await readBody(request)) });
  await ensureTemplateRefs(env, t);
  await env.DB.prepare(
    `UPDATE templates SET name = ?, kind = ?, icon = ?, title = ?, duration_minutes = ?, start_time = ?,
       repeat_weeks = ?, teacher_id = ?, room_id = ?, note = ?, sort_order = ? WHERE id = ?`,
  )
    .bind(t.name, t.kind, t.icon, t.title, t.duration_minutes, t.start_time, t.repeat_weeks, t.teacher_id, t.room_id, t.note, t.sort_order, id)
    .run();
  return json(await getById<Template>(env, "templates", id));
}

async function deleteTemplate(env: Env, id: string) {
  await mustExist(env, "templates", id, "mẫu lịch");
  await env.DB.prepare("DELETE FROM templates WHERE id = ?").bind(id).run();
  return new Response(null, { status: 204 });
}

// ---------- Tiện ích DB ----------

type Table = "teachers" | "rooms" | "templates";

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

    // Chống CSRF: request thay đổi dữ liệu phải đến từ chính trang này
    const origin = request.headers.get("origin");
    if (method !== "GET" && method !== "HEAD" && origin && new URL(origin).host !== url.host) {
      throw new HttpError(403, "Yêu cầu không hợp lệ");
    }

    if (resource === "health" && !id && method === "GET") return json({ ok: true });
    if (resource === "auth") return await handleAuth(env, request, id);

    // Mọi API còn lại cần đăng nhập; xem: mọi tài khoản, sửa danh mục: chỉ quản trị viên
    const user = await requireUser(env, request);
    if (resource === "users") return await handleUsers(env, request, id, user);
    if (resource === "settings" && !id) return await handleSettings(env, request, user);
    if (method !== "GET" && (resource === "teachers" || resource === "rooms" || resource === "templates")) {
      requireAdmin(user);
    }

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

    if (resource === "templates") {
      if (!id && method === "GET") return await listTemplates(env);
      if (!id && method === "POST") return await createTemplate(env, request);
      if (id && method === "PUT") return await updateTemplate(env, request, id);
      if (id && method === "DELETE") return await deleteTemplate(env, id);
    }

    if (resource === "sessions") {
      if (!id && method === "GET") return await listSessions(env, url);
      if (!id && method === "POST") return await createSession(env, request, user);
      if (id && method === "PUT") return await updateSession(env, request, id, user);
      if (id && method === "DELETE") return await deleteSession(env, url, id, user);
    }

    throw new HttpError(404, "Không tìm thấy đường dẫn");
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message, ...err.extra }, err.status);
    console.error(err);
    return json({ error: "Lỗi máy chủ" }, 500);
  }
}
