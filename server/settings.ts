// Cài đặt đơn vị: loại hình sử dụng (trường học / doanh nghiệp / văn phòng) và tên đơn vị.

import type { ProfileId, Settings, User } from "../src/shared/types";
import { PROFILE_IDS } from "../src/shared/types";
import { getProfile } from "../src/shared/profiles";
import { HttpError, json, optString, readBody, type Env } from "./http";
import { requireAdmin } from "./auth";

export async function getSettings(env: Env): Promise<Settings> {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
  const map = new Map(results.map((r) => [r.key, r.value]));
  return { profile: getProfile(map.get("profile")).id, org_name: map.get("org_name") ?? "" };
}

export function parseProfile(value: unknown): ProfileId {
  if (!PROFILE_IDS.includes(value as ProfileId)) throw new HttpError(400, "Loại hình không hợp lệ");
  return value as ProfileId;
}

export function settingsStatements(env: Env, s: Settings) {
  const stmt = env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  return [stmt.bind("profile", s.profile), stmt.bind("org_name", s.org_name)];
}

/**
 * Câu lệnh thêm mẫu lịch mặc định của loại hình (bỏ qua mẫu đã có).
 * replaceDefaults: xoá trước các mẫu mặc định của loại hình khác (dùng khi thiết lập lần đầu).
 */
export function templateStatements(env: Env, profile: ProfileId, replaceDefaults: boolean) {
  const keep = getProfile(profile).templates;
  const insert = env.DB.prepare(
    `INSERT OR IGNORE INTO templates (id, name, kind, icon, title, duration_minutes, start_time, repeat_weeks, note, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  return [
    ...(replaceDefaults
      ? [
          env.DB.prepare("DELETE FROM templates WHERE id LIKE 'tpl-%' AND id NOT IN (SELECT value FROM json_each(?))").bind(
            JSON.stringify(keep.map((t) => t.id)),
          ),
        ]
      : []),
    ...keep.map((t) =>
      insert.bind(t.id, t.name, t.kind, t.icon, t.title, t.duration_minutes, t.start_time, t.repeat_weeks, t.note, t.sort_order),
    ),
  ];
}

export async function handleSettings(env: Env, request: Request, user: User): Promise<Response> {
  if (request.method === "GET") return json(await getSettings(env));
  if (request.method !== "PUT") throw new HttpError(404, "Không tìm thấy đường dẫn");
  requireAdmin(user);
  const body = await readBody(request);
  const current = await getSettings(env);
  const next: Settings = {
    profile: body.profile === undefined ? current.profile : parseProfile(body.profile),
    org_name: body.org_name === undefined ? current.org_name : (optString(body.org_name, "org_name", 100) ?? ""),
  };
  await env.DB.batch([
    ...settingsStatements(env, next),
    ...(body.add_templates === true ? templateStatements(env, next.profile, false) : []),
  ]);
  return json(next);
}
