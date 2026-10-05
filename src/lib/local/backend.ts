// "Máy chủ" chạy ngay trong trình duyệt: SQLite (sql.js) + toàn bộ mã trong server/, dữ liệu lưu ở localStorage.
// Không cần Cloudflare, không cần mạng: mỗi trình duyệt là một bản dữ liệu riêng.

import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { handleApi } from "../../../server/api";
import { LocalD1 } from "./d1";
import { MIGRATIONS } from "./migrations.generated";

export const DB_KEY = "lich-giang-db";
const TOKEN_KEY = "lich-giang-session";
const SESSION_HEADER = "x-lich-session";
/** Giới hạn localStorage của đa số trình duyệt: khoảng 5 triệu ký tự cho mỗi trang web */
export const STORAGE_LIMIT = 5_000_000;

let sql: Promise<SqlJsStatic> | null = null;
let ready: Promise<LocalD1> | null = null;

const loadSql = () =>
  (sql ??= initSqlJs({ locateFile: () => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/sql-wasm.wasm` }));

// ---------- base64 ⇄ bytes (localStorage chỉ lưu được chuỗi) ----------

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

// ---------- Mở / tạo / nâng cấp cơ sở dữ liệu ----------

function prepare(raw: Database) {
  // D1 bật khoá ngoại sẵn; sql.js thì không (và export() đặt lại pragma nên phải bật lại sau mỗi lần lưu)
  raw.exec("PRAGMA foreign_keys = ON");
}

function migrate(raw: Database): boolean {
  raw.exec("CREATE TABLE IF NOT EXISTS _local_migrations (name TEXT PRIMARY KEY)");
  const done = new Set((raw.exec("SELECT name FROM _local_migrations")[0]?.values ?? []).map((r) => String(r[0])));
  let changed = false;
  for (const m of MIGRATIONS) {
    if (done.has(m.name)) continue;
    raw.exec("BEGIN");
    try {
      raw.exec(m.sql);
      raw.run("INSERT INTO _local_migrations (name) VALUES (?)", [m.name]);
      raw.exec("COMMIT");
      changed = true;
    } catch (err) {
      raw.exec("ROLLBACK");
      throw err;
    }
  }
  return changed;
}

function open(SQL: SqlJsStatic, bytes: Uint8Array | null): Database {
  const raw = bytes ? new SQL.Database(bytes) : new SQL.Database();
  prepare(raw);
  return raw;
}

function load(): Promise<LocalD1> {
  ready ??= (async () => {
    const SQL = await loadSql();
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(DB_KEY);
    } catch {
      throw new Error("Trình duyệt đang chặn bộ nhớ (localStorage) – hãy tắt chế độ ẩn danh hoặc cho phép lưu dữ liệu trang web.");
    }
    let raw: Database;
    try {
      raw = open(SQL, saved ? fromBase64(saved) : null);
      raw.exec("SELECT count(*) FROM sqlite_master");
    } catch {
      // Dữ liệu hỏng: giữ lại bản cũ để cứu, rồi bắt đầu cơ sở dữ liệu mới
      try {
        if (saved) localStorage.setItem(`${DB_KEY}-hong-${Date.now()}`, saved);
      } catch {}
      raw = open(SQL, null);
    }
    const db = new LocalD1(raw);
    if (migrate(raw) || !saved) persist(db);
    // Xin trình duyệt giữ dữ liệu lâu dài (không tự xoá khi máy thiếu dung lượng)
    navigator.storage?.persist?.().catch(() => {});
    return db;
  })();
  ready.catch(() => (ready = null));
  return ready;
}

export class StorageFullError extends Error {}

function persist(db: LocalD1) {
  const data = toBase64(db.raw.export());
  prepare(db.raw);
  try {
    localStorage.setItem(DB_KEY, data);
  } catch {
    throw new StorageFullError(
      "Bộ nhớ trình duyệt đã đầy (khoảng 5 MB) nên thay đổi vừa rồi chưa được lưu. Hãy tải bản sao lưu ở Cài đặt rồi xoá bớt lịch cũ.",
    );
  }
}

// ---------- Gọi API ----------

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

const jsonError = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json; charset=utf-8" } });

/** Thay cho fetch("/api…"): chạy server/api.ts ngay trong trang và lưu lại cơ sở dữ liệu sau mỗi thay đổi. */
export async function localFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let db: LocalD1;
  try {
    db = await load();
  } catch (err) {
    return jsonError(500, (err as Error).message || "Không mở được dữ liệu trên trình duyệt");
  }
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set(SESSION_HEADER, token);
  const request = new Request(new URL(`/api${path}`, location.origin), { method: init.method ?? "GET", headers, body: init.body });
  const res = await handleApi(request, { DB: db, LOCAL: true });
  const nextToken = res.headers.get(SESSION_HEADER);
  if (nextToken !== null) setToken(nextToken);
  if (request.method !== "GET") {
    try {
      persist(db);
    } catch (err) {
      // Bản trong bộ nhớ đã khác bản đã lưu: lần gọi sau đọc lại bản đã lưu cho khớp
      ready = null;
      return jsonError(507, (err as Error).message);
    }
  }
  return res;
}

// ---------- Sao lưu / khôi phục ----------

export interface StorageInfo {
  /** Số ký tự đang dùng trong localStorage cho cơ sở dữ liệu */
  used: number;
  limit: number;
}

export function storageInfo(): StorageInfo {
  let used = 0;
  try {
    used = localStorage.getItem(DB_KEY)?.length ?? 0;
  } catch {}
  return { used, limit: STORAGE_LIMIT };
}

/** File sao lưu: chính là file SQLite, mở được bằng mọi công cụ SQLite. */
export async function exportBackup(): Promise<Uint8Array> {
  const db = await load();
  const bytes = db.raw.export();
  prepare(db.raw);
  return bytes;
}

/** Thay toàn bộ dữ liệu bằng file sao lưu (kiểm tra đúng là dữ liệu của app trước khi thay). */
export async function restoreBackup(bytes: Uint8Array): Promise<void> {
  const SQL = await loadSql();
  let raw: Database;
  try {
    raw = open(SQL, bytes);
    const tables = new Set((raw.exec("SELECT name FROM sqlite_master WHERE type = 'table'")[0]?.values ?? []).map((r) => String(r[0])));
    if (!["users", "teachers", "rooms", "sessions"].every((t) => tables.has(t))) throw new Error();
  } catch {
    throw new Error("File này không phải bản sao lưu của app Lịch.");
  }
  migrate(raw);
  const db = new LocalD1(raw);
  persist(db);
  ready = Promise.resolve(db);
  setToken("");
}

/** Xoá toàn bộ dữ liệu trên trình duyệt này (bắt đầu lại từ đầu). */
export function wipeLocalData() {
  try {
    // Chỉ xoá khoá của app Lịch; dữ liệu của app khác cùng tên miền (vd. app GVCN) giữ nguyên
    const ours = /^(lich-giang|tour-done-|import-dismissed-|import-)/;
    for (const k of Object.keys(localStorage)) if (ours.test(k) && !k.startsWith(`${DB_KEY}-hong-`)) localStorage.removeItem(k);
  } catch {}
  ready = null;
}
