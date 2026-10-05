// Tiện ích HTTP dùng chung cho API.

export interface Env {
  DB: D1Database;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
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

export function optString(value: unknown, field: string, max = 500): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new HttpError(400, `Trường "${field}" phải là chuỗi`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new HttpError(400, `Trường "${field}" quá dài (tối đa ${max} ký tự)`);
  return trimmed === "" ? null : trimmed;
}

export function reqString(value: unknown, field: string, max = 200): string {
  const s = optString(value, field, max);
  if (!s) throw new HttpError(400, `Thiếu trường bắt buộc "${field}"`);
  return s;
}
