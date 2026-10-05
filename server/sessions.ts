// Lịch (buổi giảng, cuộc họp, …): đọc/ghi, người tham dự, kiểm tra trùng lịch.

import type { Conflict, EventKind, Session, SessionInput, SessionStatus, User } from "../src/shared/types";
import { EVENT_KINDS, MAX_REPEAT_WEEKS } from "../src/shared/types";
import { HttpError, json, optString, readBody, reqString, type Env } from "./http";
import { isValidDate, isValidTime, weeklyDates } from "./time";

/** Số người tham dự tối đa của một lịch (giữ truy vấn gọn) */
export const MAX_PARTICIPANTS = 50;

type SessionRow = Omit<Session, "participant_ids">;

const SESSION_SELECT = `
  SELECT s.*, t.name AS teacher_name, t.color AS teacher_color, r.name AS room_name
  FROM sessions s
  JOIN teachers t ON t.id = s.teacher_id
  JOIN rooms r ON r.id = s.room_id`;

/** D1 giới hạn 100 tham số mỗi truy vấn → danh sách id được truyền thành 1 tham số JSON. */
const IN_JSON = "(SELECT value FROM json_each(?))";

export function parseKind(value: unknown, fallback: EventKind): EventKind {
  if (value === undefined || value === null || value === "") return fallback;
  if (!EVENT_KINDS.includes(value as EventKind)) throw new HttpError(400, "Loại lịch không hợp lệ");
  return value as EventKind;
}

type ParsedSession = Required<Omit<SessionInput, "repeat_weeks">> & { repeat_weeks: number };

function parseParticipants(value: unknown, hostId: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !v)) {
    throw new HttpError(400, "Danh sách người tham dự không hợp lệ");
  }
  const ids = [...new Set(value as string[])].filter((id) => id !== hostId);
  if (ids.length > MAX_PARTICIPANTS) throw new HttpError(400, `Tối đa ${MAX_PARTICIPANTS} người tham dự`);
  return ids;
}

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

  const teacherId = reqString(body.teacher_id, "teacher_id");
  return {
    title: reqString(body.title, "title"),
    class_name: optString(body.class_name, "class_name", 200),
    teacher_id: teacherId,
    room_id: reqString(body.room_id, "room_id"),
    date,
    start_time: start,
    end_time: end,
    note: optString(body.note, "note", 2000),
    status,
    kind: parseKind(body.kind, "lecture"),
    participant_ids: parseParticipants(body.participant_ids, teacherId),
    repeat_weeks: repeat,
  };
}

/** Gắn participant_ids vào các dòng sessions. */
async function withParticipants(env: Env, rows: SessionRow[]): Promise<Session[]> {
  if (!rows.length) return [];
  const { results } = await env.DB.prepare(
    `SELECT session_id, teacher_id FROM session_participants WHERE session_id IN ${IN_JSON}`,
  )
    .bind(JSON.stringify(rows.map((r) => r.id)))
    .all<{ session_id: string; teacher_id: string }>();
  const map = new Map<string, string[]>();
  for (const p of results) map.set(p.session_id, [...(map.get(p.session_id) ?? []), p.teacher_id]);
  return rows.map((r) => ({ ...r, participant_ids: map.get(r.id) ?? [] }));
}

async function getSession(env: Env, id: string): Promise<Session | null> {
  const row = await env.DB.prepare(`${SESSION_SELECT} WHERE s.id = ?`).bind(id).first<SessionRow>();
  return row ? (await withParticipants(env, [row]))[0] : null;
}

/**
 * Tìm các lịch đã lên trùng giờ có dùng cùng phòng, hoặc có chung người
 * (chủ trì hay người tham dự của lịch này là chủ trì/người tham dự của lịch kia).
 */
export async function findConflicts(
  env: Env,
  s: { teacher_id: string; room_id: string; participant_ids: string[]; date: string; start_time: string; end_time: string },
  excludeId: string | null,
): Promise<Conflict[]> {
  const people = [s.teacher_id, ...s.participant_ids];
  const peopleJson = JSON.stringify(people);
  const { results } = await env.DB.prepare(
    `${SESSION_SELECT}
     WHERE s.date = ? AND s.status = 'scheduled'
       AND s.start_time < ? AND s.end_time > ?
       AND s.id != ?
       AND (
         s.room_id = ?
         OR s.teacher_id IN ${IN_JSON}
         OR EXISTS (SELECT 1 FROM session_participants sp WHERE sp.session_id = s.id AND sp.teacher_id IN ${IN_JSON})
       )
     ORDER BY s.start_time`,
  )
    .bind(s.date, s.end_time, s.start_time, excludeId ?? "", s.room_id, peopleJson, peopleJson)
    .all<SessionRow>();
  if (!results.length) return [];

  const others = await withParticipants(env, results);
  const { results: names } = await env.DB.prepare(`SELECT id, name FROM teachers WHERE id IN ${IN_JSON}`)
    .bind(peopleJson)
    .all<{ id: string; name: string }>();
  const nameOf = new Map(names.map((n) => [n.id, n.name]));

  const conflicts: Conflict[] = [];
  for (const other of others) {
    const busy = new Set([other.teacher_id, ...other.participant_ids]);
    for (const person of people) {
      if (busy.has(person)) {
        conflicts.push({ date: s.date, kind: "teacher", session: other, teacher_id: person, teacher_name: nameOf.get(person) });
      }
    }
    if (other.room_id === s.room_id) conflicts.push({ date: s.date, kind: "room", session: other });
  }
  return conflicts;
}

async function ensureRefs(env: Env, s: ParsedSession) {
  const people = [s.teacher_id, ...s.participant_ids];
  const found = await env.DB.prepare(`SELECT COUNT(*) AS n FROM teachers WHERE id IN ${IN_JSON}`)
    .bind(JSON.stringify(people))
    .first<{ n: number }>();
  if (!found || found.n !== people.length) throw new HttpError(400, "Giảng viên / người tham dự không tồn tại");
  const room = await env.DB.prepare("SELECT 1 AS ok FROM rooms WHERE id = ?").bind(s.room_id).first();
  if (!room) throw new HttpError(400, "Phòng không tồn tại");
}

function conflictError(conflicts: Conflict[]): HttpError {
  return new HttpError(409, "Lịch bị trùng với lịch khác", { conflicts });
}

// ---------- Phân quyền ----------

/** Quản trị viên sửa được mọi lịch; giảng viên chỉ sửa lịch do chính mình chủ trì. */
function assertCanEdit(user: User, teacherIds: string[]) {
  if (user.role === "admin") return;
  if (!user.teacher_id) throw new HttpError(403, "Tài khoản chưa được liên kết với giảng viên nên không thể đặt lịch");
  if (teacherIds.some((id) => id !== user.teacher_id)) {
    throw new HttpError(403, "Bạn chỉ có thể tạo và sửa lịch do chính mình chủ trì");
  }
}

// ---------- Handlers ----------

export async function listSessions(env: Env, url: URL) {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!isValidDate(from) || !isValidDate(to)) throw new HttpError(400, "Cần tham số from và to (YYYY-MM-DD)");

  const where = ["s.date >= ?", "s.date <= ?"];
  const params: unknown[] = [from, to];
  const teacherId = url.searchParams.get("teacherId");
  if (teacherId) {
    // Gồm cả lịch người đó tham dự
    where.push("(s.teacher_id = ? OR EXISTS (SELECT 1 FROM session_participants sp WHERE sp.session_id = s.id AND sp.teacher_id = ?))");
    params.push(teacherId, teacherId);
  }
  const roomId = url.searchParams.get("roomId");
  if (roomId) {
    where.push("s.room_id = ?");
    params.push(roomId);
  }
  const kind = url.searchParams.get("kind");
  if (kind) {
    where.push("s.kind = ?");
    params.push(parseKind(kind, "lecture"));
  }

  const { results } = await env.DB.prepare(`${SESSION_SELECT} WHERE ${where.join(" AND ")} ORDER BY s.date, s.start_time`)
    .bind(...params)
    .all<SessionRow>();
  return json(await withParticipants(env, results));
}

function participantInserts(env: Env, sessionId: string, ids: string[]) {
  const stmt = env.DB.prepare("INSERT INTO session_participants (session_id, teacher_id) VALUES (?, ?)");
  return ids.map((t) => stmt.bind(sessionId, t));
}

export async function createSession(env: Env, request: Request, user: User) {
  const s = parseSession(await readBody(request));
  assertCanEdit(user, [s.teacher_id]);
  await ensureRefs(env, s);

  const dates = weeklyDates(s.date, s.repeat_weeks);
  if (s.status === "scheduled") {
    const conflicts: Conflict[] = [];
    for (const date of dates) conflicts.push(...(await findConflicts(env, { ...s, date }, null)));
    if (conflicts.length) throw conflictError(conflicts);
  }

  const seriesId = dates.length > 1 ? crypto.randomUUID() : null;
  const ids = dates.map(() => crypto.randomUUID());
  const insert = env.DB.prepare(
    `INSERT INTO sessions (id, series_id, title, class_name, teacher_id, room_id, date, start_time, end_time, note, status, kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  await env.DB.batch(
    dates.flatMap((date, i) => [
      insert.bind(ids[i], seriesId, s.title, s.class_name, s.teacher_id, s.room_id, date, s.start_time, s.end_time, s.note, s.status, s.kind),
      ...participantInserts(env, ids[i], s.participant_ids),
    ]),
  );

  const { results } = await env.DB.prepare(`${SESSION_SELECT} WHERE s.id IN ${IN_JSON} ORDER BY s.date`)
    .bind(JSON.stringify(ids))
    .all<SessionRow>();
  return json(await withParticipants(env, results), 201);
}

export async function updateSession(env: Env, request: Request, id: string, user: User) {
  const existing = await getSession(env, id);
  if (!existing) throw new HttpError(404, "Không tìm thấy lịch");
  const body = await readBody(request);
  // Cho phép cập nhật một phần (vd. chỉ đổi status hay giờ), các trường thiếu giữ nguyên giá trị cũ.
  const s = parseSession({ ...existing, ...body, repeat_weeks: 1 });
  assertCanEdit(user, [existing.teacher_id, s.teacher_id]);
  await ensureRefs(env, s);

  if (s.status === "scheduled") {
    const conflicts = await findConflicts(env, s, id);
    if (conflicts.length) throw conflictError(conflicts);
  }

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE sessions SET title = ?, class_name = ?, teacher_id = ?, room_id = ?, date = ?,
         start_time = ?, end_time = ?, note = ?, status = ?, kind = ? WHERE id = ?`,
    ).bind(s.title, s.class_name, s.teacher_id, s.room_id, s.date, s.start_time, s.end_time, s.note, s.status, s.kind, id),
    env.DB.prepare("DELETE FROM session_participants WHERE session_id = ?").bind(id),
    ...participantInserts(env, id, s.participant_ids),
  ]);

  return json(await getSession(env, id));
}

export async function deleteSession(env: Env, url: URL, id: string, user: User) {
  const existing = await getSession(env, id);
  if (!existing) throw new HttpError(404, "Không tìm thấy lịch");
  assertCanEdit(user, [existing.teacher_id]);
  // scope=following: xoá lịch này và các lịch sau trong cùng chuỗi lặp (của cùng người chủ trì).
  // Xoá người tham dự trước, không phụ thuộc vào việc bật ràng buộc khoá ngoại
  if (url.searchParams.get("scope") === "following" && existing.series_id) {
    const scope = "SELECT id FROM sessions WHERE series_id = ? AND date >= ? AND teacher_id = ?";
    const args = [existing.series_id, existing.date, existing.teacher_id];
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM session_participants WHERE session_id IN (${scope})`).bind(...args),
      env.DB.prepare(`DELETE FROM sessions WHERE id IN (${scope})`).bind(...args),
    ]);
  } else {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM session_participants WHERE session_id = ?").bind(id),
      env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(id),
    ]);
  }
  return new Response(null, { status: 204 });
}
