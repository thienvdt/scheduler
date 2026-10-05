// Đăng nhập, phiên làm việc (cookie) và quản lý tài khoản.

import type { AuthState, Role, User } from "../src/shared/types";
import { MIN_PASSWORD_LENGTH } from "../src/shared/types";
import { HttpError, json, optString, readBody, reqString, type Env } from "./http";
import { getSettings, parseProfile, settingsStatements, templateStatements } from "./settings";

const COOKIE = "lg_session";
const SESSION_DAYS = 30;
// Workers giới hạn PBKDF2 tối đa 100.000 vòng lặp
const PBKDF2_ITERATIONS = 100_000;

const MAX_FAILURES = 10;
const LOCK_MINUTES = 15;

const USER_COLUMNS = "id, username, display_name, role, teacher_id, created_at";

// ---------- Mật khẩu & token ----------

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iter || !salt || !hash) return false;
  const derived = await pbkdf2(password, unb64(salt), Number(iter));
  return constantTimeEqual(derived, unb64(hash));
}

// Dùng khi tên đăng nhập không tồn tại để thời gian phản hồi giống trường hợp sai mật khẩu
const DUMMY_HASH = `pbkdf2$${PBKDF2_ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  return b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------- Cookie & phiên ----------

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function sessionCookie(request: Request, value: string, maxAge: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

async function startSession(env: Env, request: Request, userId: string, body: unknown, status = 200): Promise<Response> {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM auth_sessions WHERE expires_at < ?").bind(new Date().toISOString()),
    env.DB.prepare("INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(
      await sha256Hex(token),
      userId,
      expires,
    ),
  ]);
  const res = json(body, status);
  res.headers.append("set-cookie", sessionCookie(request, token, SESSION_DAYS * 86400));
  return res;
}

export async function currentUser(env: Env, request: Request): Promise<User | null> {
  const token = readCookie(request, COOKIE);
  if (!token) return null;
  return env.DB.prepare(
    `SELECT u.id, u.username, u.display_name, u.role, u.teacher_id, u.created_at
     FROM auth_sessions a JOIN users u ON u.id = a.user_id
     WHERE a.token_hash = ? AND a.expires_at > ?`,
  )
    .bind(await sha256Hex(token), new Date().toISOString())
    .first<User>();
}

export async function requireUser(env: Env, request: Request): Promise<User> {
  const user = await currentUser(env, request);
  if (!user) throw new HttpError(401, "Vui lòng đăng nhập");
  return user;
}

export function requireAdmin(user: User) {
  if (user.role !== "admin") throw new HttpError(403, "Chỉ quản trị viên mới có quyền thực hiện thao tác này");
}

async function userCount(env: Env): Promise<number> {
  return (await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>())?.n ?? 0;
}

// ---------- Kiểm tra dữ liệu ----------

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,40}$/;

function parseUsername(value: unknown): string {
  const username = reqString(value, "username", 40);
  if (!USERNAME_RE.test(username)) throw new HttpError(400, "Tên đăng nhập 3–40 ký tự, chỉ gồm chữ không dấu, số, dấu . _ -");
  return username.toLowerCase();
}

function parsePassword(value: unknown, field = "password"): string {
  if (typeof value !== "string" || value.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`);
  }
  if (value.length > 200) throw new HttpError(400, `Trường "${field}" quá dài`);
  return value;
}

function parseRole(value: unknown): Role {
  if (value !== "admin" && value !== "teacher") throw new HttpError(400, "Vai trò không hợp lệ");
  return value;
}

function isUniqueError(err: unknown) {
  return err instanceof Error && /UNIQUE/i.test(err.message);
}

// ---------- /api/auth/* ----------

export async function handleAuth(env: Env, request: Request, action: string | undefined): Promise<Response> {
  const method = request.method;

  if (action === "me" && method === "GET") {
    const user = await currentUser(env, request);
    const state: AuthState = { user, settings: await getSettings(env), needs_setup: !user && (await userCount(env)) === 0 };
    return json(state);
  }

  if (action === "setup" && method === "POST") {
    // Chỉ dùng được khi chưa có tài khoản nào: tạo quản trị viên đầu tiên
    if ((await userCount(env)) > 0) throw new HttpError(409, "Hệ thống đã có tài khoản, hãy đăng nhập");
    const body = await readBody(request);
    const username = parseUsername(body.username);
    const password = parsePassword(body.password);
    const displayName = reqString(body.display_name, "display_name", 100);
    const settings = {
      profile: body.profile === undefined ? "education" as const : parseProfile(body.profile),
      org_name: optString(body.org_name, "org_name", 100) ?? "",
    };
    const id = crypto.randomUUID();
    const result = await env.DB.prepare(
      `INSERT INTO users (id, username, display_name, password_hash, role)
       SELECT ?, ?, ?, ?, 'admin' WHERE NOT EXISTS (SELECT 1 FROM users)`,
    )
      .bind(id, username, displayName, await hashPassword(password))
      .run();
    if (!result.meta.changes) throw new HttpError(409, "Hệ thống đã có tài khoản, hãy đăng nhập");
    // Lưu loại hình và thay mẫu lịch mặc định cho phù hợp
    await env.DB.batch([...settingsStatements(env, settings), ...templateStatements(env, settings.profile, true)]);
    const user = await env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).bind(id).first<User>();
    return startSession(env, request, id, { user, settings, needs_setup: false } satisfies AuthState, 201);
  }

  if (action === "login" && method === "POST") {
    const body = await readBody(request);
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const windowStart = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();
    const attempts = await env.DB.prepare("SELECT failures, window_start FROM login_attempts WHERE username = ?")
      .bind(username)
      .first<{ failures: number; window_start: string }>();
    if (attempts && attempts.window_start > windowStart && attempts.failures >= MAX_FAILURES) {
      throw new HttpError(429, `Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${LOCK_MINUTES} phút.`);
    }

    const row = await env.DB.prepare(`SELECT ${USER_COLUMNS}, password_hash FROM users WHERE username = ?`)
      .bind(username)
      .first<User & { password_hash: string }>();
    const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) {
      // Bắt đầu cửa sổ đếm mới nếu cửa sổ cũ đã hết hạn
      await env.DB.prepare(
        `INSERT INTO login_attempts (username, failures, window_start) VALUES (?, 1, ?)
         ON CONFLICT(username) DO UPDATE SET
           failures = CASE WHEN window_start > ? THEN failures + 1 ELSE 1 END,
           window_start = CASE WHEN window_start > ? THEN window_start ELSE excluded.window_start END`,
      )
        .bind(username, new Date().toISOString(), windowStart, windowStart)
        .run();
      throw new HttpError(401, "Sai tên đăng nhập hoặc mật khẩu");
    }
    await env.DB.prepare("DELETE FROM login_attempts WHERE username = ?").bind(username).run();
    const { password_hash: _hash, ...user } = row;
    void _hash;
    return startSession(env, request, user.id, { user, settings: await getSettings(env), needs_setup: false } satisfies AuthState);
  }

  if (action === "logout" && method === "POST") {
    const token = readCookie(request, COOKIE);
    if (token) await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
    const res = new Response(null, { status: 204 });
    res.headers.append("set-cookie", sessionCookie(request, "", 0));
    return res;
  }

  if (action === "password" && method === "POST") {
    const user = await requireUser(env, request);
    const body = await readBody(request);
    const row = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(user.id).first<{ password_hash: string }>();
    if (!row || !(await verifyPassword(String(body.current_password ?? ""), row.password_hash))) {
      throw new HttpError(400, "Mật khẩu hiện tại không đúng");
    }
    const next = parsePassword(body.new_password, "new_password");
    // Đổi mật khẩu → đăng xuất mọi phiên khác, giữ phiên hiện tại
    const token = readCookie(request, COOKIE) ?? "";
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(await hashPassword(next), user.id),
      env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ? AND token_hash != ?").bind(user.id, await sha256Hex(token)),
    ]);
    return new Response(null, { status: 204 });
  }

  throw new HttpError(404, "Không tìm thấy đường dẫn");
}

// ---------- /api/users (chỉ quản trị viên) ----------

async function adminCount(env: Env): Promise<number> {
  return (await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").first<{ n: number }>())?.n ?? 0;
}

async function ensureTeacher(env: Env, teacherId: string | null) {
  if (teacherId && !(await env.DB.prepare("SELECT 1 AS ok FROM teachers WHERE id = ?").bind(teacherId).first())) {
    throw new HttpError(400, "Giảng viên không tồn tại");
  }
}

export async function handleUsers(env: Env, request: Request, id: string | undefined, me: User): Promise<Response> {
  requireAdmin(me);
  const method = request.method;

  if (!id && method === "GET") {
    const { results } = await env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY role, username`).all<User>();
    return json(results);
  }

  if (!id && method === "POST") {
    const body = await readBody(request);
    const username = parseUsername(body.username);
    const role = parseRole(body.role);
    const teacherId = optString(body.teacher_id, "teacher_id");
    await ensureTeacher(env, teacherId);
    const newId = crypto.randomUUID();
    try {
      await env.DB.prepare(
        "INSERT INTO users (id, username, display_name, password_hash, role, teacher_id) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(
          newId,
          username,
          reqString(body.display_name, "display_name", 100),
          await hashPassword(parsePassword(body.password)),
          role,
          teacherId,
        )
        .run();
    } catch (err) {
      if (isUniqueError(err)) throw new HttpError(409, "Tên đăng nhập đã tồn tại");
      throw err;
    }
    return json(await env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).bind(newId).first<User>(), 201);
  }

  if (!id) throw new HttpError(404, "Không tìm thấy đường dẫn");
  const existing = await env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).bind(id).first<User>();
  if (!existing) throw new HttpError(404, "Không tìm thấy tài khoản");

  if (method === "PUT") {
    const body = await readBody(request);
    const merged = { ...existing, ...body };
    const role = parseRole(merged.role);
    if (existing.role === "admin" && role !== "admin" && (await adminCount(env)) <= 1) {
      throw new HttpError(400, "Phải còn ít nhất một quản trị viên");
    }
    const teacherId = optString(merged.teacher_id, "teacher_id");
    await ensureTeacher(env, teacherId);
    const stmts = [
      env.DB.prepare("UPDATE users SET username = ?, display_name = ?, role = ?, teacher_id = ? WHERE id = ?").bind(
        parseUsername(merged.username),
        reqString(merged.display_name, "display_name", 100),
        role,
        teacherId,
        id,
      ),
    ];
    if (typeof body.password === "string" && body.password !== "") {
      // Đặt lại mật khẩu → buộc đăng nhập lại
      stmts.push(
        env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(await hashPassword(parsePassword(body.password)), id),
        env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(id),
      );
    }
    try {
      await env.DB.batch(stmts);
    } catch (err) {
      if (isUniqueError(err)) throw new HttpError(409, "Tên đăng nhập đã tồn tại");
      throw err;
    }
    return json(await env.DB.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).bind(id).first<User>());
  }

  if (method === "DELETE") {
    if (id === me.id) throw new HttpError(400, "Không thể tự xoá tài khoản của mình");
    if (existing.role === "admin" && (await adminCount(env)) <= 1) throw new HttpError(400, "Phải còn ít nhất một quản trị viên");
    await env.DB.batch([
      env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(id),
      env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id),
    ]);
    return new Response(null, { status: 204 });
  }

  throw new HttpError(404, "Không tìm thấy đường dẫn");
}
