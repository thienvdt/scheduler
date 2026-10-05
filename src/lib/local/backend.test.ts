// Chạy toàn bộ máy chủ (server/api.ts) trên SQLite trong bộ nhớ, như trong trình duyệt.
import { beforeAll, describe, expect, it } from "vitest";
import { join } from "node:path";

const store = new Map<string, string>();
beforeAll(() => {
  process.env.NEXT_PUBLIC_BASE_PATH = join(process.cwd(), "node_modules/sql.js/dist");
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
    },
    location: { origin: "http://localhost:3000" },
  });
});

async function call(path: string, method = "GET", body?: unknown) {
  const { localFetch } = await import("./backend");
  const res = await localFetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { "content-type": "application/json" } });
  return { status: res.status, data: res.status === 204 ? null : await res.json() };
}

describe("chế độ lưu trên trình duyệt", () => {
  it("tạo bảng, tạo quản trị viên, đăng nhập bằng phiên lưu ở localStorage", async () => {
    expect((await call("/auth/me")).data.needs_setup).toBe(true);
    const setup = await call("/auth/setup", "POST", { username: "admin", display_name: "Admin", password: "matkhau123", profile: "education", org_name: "THPT A" });
    expect(setup.status).toBe(201);
    expect(store.get("lich-giang-session")).toBeTruthy();
    expect((await call("/auth/me")).data.user.username).toBe("admin");
    expect(store.get("lich-giang-db")!.length).toBeGreaterThan(1000);
  });

  it("đặt lịch, chặn trùng (json_each, khoá ngoại), lặp tuần", async () => {
    const t = await call("/teachers", "POST", { name: "Lê Văn An" });
    const r = await call("/rooms", "POST", { name: "A101" });
    expect(t.status).toBe(201);
    const s = { title: "Toán", teacher_id: t.data.id, room_id: r.data.id, date: "2026-10-05", start_time: "07:00", end_time: "08:30", repeat_weeks: 3 };
    expect((await call("/sessions", "POST", s)).data).toHaveLength(3);
    const dup = await call("/sessions", "POST", { ...s, repeat_weeks: 1, start_time: "08:00", end_time: "09:00" });
    expect(dup.status).toBe(409);
    expect(dup.data.conflicts.length).toBeGreaterThan(0);
    expect((await call("/sessions", "POST", { ...s, teacher_id: "khong-co" })).status).toBe(400);
    expect((await call(`/teachers/${t.data.id}`, "DELETE")).status).toBe(409);
  });

  it("dữ liệu còn nguyên sau khi tải lại trang (đọc lại từ localStorage)", async () => {
    const mod = await import("./backend");
    mod.wipeLocalData.toString(); // giữ import
    // Giả lập tải lại: bỏ cơ sở dữ liệu trong bộ nhớ, giữ localStorage
    const saved = new Map(store);
    mod.wipeLocalData();
    for (const [k, v] of saved) store.set(k, v);
    const list = await call("/sessions?from=2026-10-01&to=2026-10-31");
    expect(list.data).toHaveLength(3);
  });

  it("import thời khoá biểu và nạp dữ liệu mẫu", async () => {
    const imp = await call("/import", "POST", {
      start_date: "2026-10-05", weeks: 2,
      items: [{ teacher: "Trần Bình", room: "10A1", title: "Văn", weekday: 2, start_time: "07:00", end_time: "07:45" }],
    });
    expect(imp.data.sessions_created).toBe(2);
    const sample = await call("/settings/sample", "POST", { action: "load" });
    expect(sample.data.sessions).toBeGreaterThan(10);
  });

  it("sao lưu và khôi phục", async () => {
    const { exportBackup, restoreBackup } = await import("./backend");
    const bytes = await exportBackup();
    await call("/teachers", "POST", { name: "Người sẽ mất" });
    await restoreBackup(bytes);
    // Khôi phục xong phải đăng nhập lại
    expect((await call("/auth/me")).data.user).toBeNull();
    await call("/auth/login", "POST", { username: "admin", password: "matkhau123" });
    const names = (await call("/teachers")).data.map((t: { name: string }) => t.name);
    expect(names).not.toContain("Người sẽ mất");
    await expect(restoreBackup(new Uint8Array([1, 2, 3]))).rejects.toThrow(/không phải bản sao lưu/);
  });
});
