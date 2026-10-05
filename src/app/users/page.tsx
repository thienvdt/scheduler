"use client";

import { useState, type FormEvent } from "react";
import type { Role, Teacher, User } from "@/shared/types";
import { MIN_PASSWORD_LENGTH } from "@/shared/types";
import { api } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Button, Field, GlassCard, Input, Modal, PageHeader, Select } from "@/components/ui";

interface UserForm {
  username: string;
  display_name: string;
  role: Role;
  teacher_id: string;
  password: string;
}

const empty: UserForm = { username: "", display_name: "", role: "teacher", teacher_id: "", password: "" };

/** Gợi ý tên đăng nhập từ họ tên: "TS. Trần Thị Bình" → "binh" */
function suggestUsername(name: string): string {
  const last = name.trim().split(/\s+/).pop() ?? "";
  return last
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export default function UsersPage() {
  const { isAdmin, user: me, terms } = useAuth();
  const { data: users, loading, error: loadError, reload } = useResource(api.users.list, [] as User[]);
  const { data: teachers } = useResource(api.teachers.list, [] as Teacher[]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isAdmin) {
    return <Alert>Chỉ quản trị viên mới xem được trang này.</Alert>;
  }

  const linked = new Set(users.map((u) => u.teacher_id).filter(Boolean));
  const withoutAccount = teachers.filter((t) => !linked.has(t.id));

  function openCreate(teacher?: Teacher) {
    setEditing(null);
    setError(null);
    setForm(
      teacher
        ? { ...empty, display_name: teacher.name, teacher_id: teacher.id, username: suggestUsername(teacher.name) }
        : empty,
    );
  }

  function openEdit(u: User) {
    setEditing(u);
    setError(null);
    setForm({ username: u.username, display_name: u.display_name, role: u.role, teacher_id: u.teacher_id ?? "", password: "" });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const input = { ...form, teacher_id: form.teacher_id || null, password: form.password || undefined };
    try {
      if (editing) await api.users.update(editing.id, input);
      else await api.users.create(input);
      setForm(null);
      reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(u: User) {
    if (!confirm(`Xoá tài khoản "${u.username}"?`)) return;
    setError(null);
    try {
      await api.users.remove(u.id);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const set = <K extends keyof UserForm>(key: K, value: UserForm[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const teacherName = (id: string | null) => teachers.find((t) => t.id === id)?.name;

  return (
    <>
      <PageHeader
        title="Tài khoản"
        subtitle={`Quản trị viên sửa được mọi thứ. ${terms.person} xem toàn bộ lịch nhưng chỉ tạo/sửa lịch do mình chủ trì.`}
        actions={
          <Button variant="primary" onClick={() => openCreate()}>
            + Tạo tài khoản
          </Button>
        }
      />

      {(error ?? loadError) && !form && (
        <div className="mb-4">
          <Alert>{error ?? loadError}</Alert>
        </div>
      )}

      {withoutAccount.length > 0 && (
        <GlassCard className="mb-4 p-4">
          <div className="mb-2 text-sm text-white/70">{terms.people} chưa có tài khoản – bấm để tạo nhanh:</div>
          <div className="flex flex-wrap gap-2">
            {withoutAccount.map((t) => (
              <Button key={t.id} className="px-3 py-1 text-xs" onClick={() => openCreate(t)}>
                <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                {t.name}
              </Button>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/60">
              <th className="px-4 py-3 font-medium">Tài khoản</th>
              <th className="px-3 py-3 font-medium">Vai trò</th>
              <th className="px-3 py-3 font-medium">{terms.person} liên kết</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-white/50">
                  Đang tải…
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {u.display_name}
                    {u.id === me.id && <span className="ml-2 text-xs text-cyan-200">(bạn)</span>}
                  </div>
                  <div className="text-xs text-white/50">@{u.username}</div>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      u.role === "admin" ? "border-fuchsia-300/40 bg-fuchsia-400/15" : "border-white/15 bg-white/10"
                    }`}
                  >
                    {u.role === "admin" ? "Quản trị viên" : terms.person}
                  </span>
                </td>
                <td className="px-3 py-3 text-white/80">
                  {teacherName(u.teacher_id) ?? <span className="text-white/40">—</span>}
                  {u.role === "teacher" && !u.teacher_id && (
                    <div className="text-xs text-amber-200">Chưa liên kết – không đặt lịch được</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button className="px-3 py-1" onClick={() => openEdit(u)}>
                      Sửa
                    </Button>
                    {u.id !== me.id && (
                      <Button variant="danger" className="px-3 py-1" onClick={() => remove(u)}>
                        Xoá
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <Modal open={form !== null} title={editing ? "Sửa tài khoản" : "Tạo tài khoản"} onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error && <Alert>{error}</Alert>}
            <Field label="Họ tên hiển thị *">
              <Input required value={form.display_name} onChange={(e) => set("display_name", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên đăng nhập *">
                <Input
                  required
                  autoComplete="off"
                  pattern="[A-Za-z0-9._\-]{3,40}"
                  title="3–40 ký tự: chữ không dấu, số, . _ -"
                  value={form.username}
                  onChange={(e) => set("username", e.target.value)}
                />
              </Field>
              <Field label="Vai trò">
                <Select value={form.role} onChange={(e) => set("role", e.target.value as Role)}>
                  <option value="teacher">{terms.person}</option>
                  <option value="admin">Quản trị viên</option>
                </Select>
              </Field>
            </div>
            <Field label={form.role === "teacher" ? `${terms.person} liên kết *` : `${terms.person} liên kết (nếu có)`}>
              <Select required={form.role === "teacher"} value={form.teacher_id} onChange={(e) => set("teacher_id", e.target.value)}>
                <option value="">— Không —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={editing ? "Đặt lại mật khẩu (bỏ trống nếu không đổi)" : `Mật khẩu * (tối thiểu ${MIN_PASSWORD_LENGTH} ký tự)`}>
              <Input
                type="password"
                autoComplete="new-password"
                required={!editing}
                minLength={MIN_PASSWORD_LENGTH}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
              />
            </Field>
            {editing && form.password && (
              <p className="-mt-2 text-xs text-white/50">Người dùng sẽ bị đăng xuất khỏi mọi thiết bị.</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" onClick={() => setForm(null)}>
                Huỷ
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Đang lưu…" : "Lưu"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
