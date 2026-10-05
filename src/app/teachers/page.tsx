"use client";

import { useState, type FormEvent } from "react";
import type { Teacher, TeacherInput } from "@/shared/types";
import { api } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Button, Field, GlassCard, Input, Modal, PageHeader } from "@/components/ui";

const PALETTE = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#f87171", "#22d3ee", "#fb923c"];

const empty: TeacherInput = { name: "", email: "", phone: "", department: "", color: PALETTE[0] };

export default function TeachersPage() {
  const { isAdmin, terms } = useAuth();
  const person = terms.person.toLowerCase();
  const { data: items, loading, error: loadError, reload } = useResource(api.teachers.list, [] as Teacher[]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState<TeacherInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  function openCreate() {
    setEditing(null);
    setError(null);
    setForm({ ...empty, color: PALETTE[items.length % PALETTE.length] });
  }

  function openEdit(t: Teacher) {
    setEditing(t);
    setError(null);
    setForm({ name: t.name, email: t.email ?? "", phone: t.phone ?? "", department: t.department ?? "", color: t.color });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      if (editing) await api.teachers.update(editing.id, form);
      else await api.teachers.create(form);
      setForm(null);
      reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: Teacher) {
    if (!confirm(`Xoá ${person} "${t.name}"?`)) return;
    setError(null);
    try {
      await api.teachers.remove(t.id);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((t) => [t.name, t.email, t.department].some((v) => v?.toLowerCase().includes(q))) : items;

  return (
    <>
      <PageHeader
        title={terms.people}
        subtitle={`${items.length} ${terms.people.toLowerCase()}`}
        actions={
          isAdmin && (
            <Button variant="primary" onClick={openCreate}>
              + Thêm {person}
            </Button>
          )
        }
      />

      <div className="mb-4 max-w-sm">
        <Input placeholder={`Tìm theo tên, email, ${terms.department.toLowerCase()}…`} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {(error ?? loadError) && !form && (
        <div className="mb-4">
          <Alert>{error ?? loadError}</Alert>
        </div>
      )}

      {loading ? (
        <p className="text-white/60">Đang tải…</p>
      ) : filtered.length === 0 ? (
        <GlassCard className="p-8 text-center text-white/60">Chưa có {person} nào.</GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <GlassCard key={t.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg font-bold text-slate-900 shadow-lg"
                  style={{ background: t.color }}
                >
                  {t.name.split(" ").pop()?.[0] ?? "?"}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{t.name}</div>
                  <div className="truncate text-sm text-white/60">{t.department ?? "—"}</div>
                </div>
              </div>
              <div className="space-y-1 text-sm text-white/70">
                {t.email && <div className="truncate">✉ {t.email}</div>}
                {t.phone && <div>☎ {t.phone}</div>}
              </div>
              {isAdmin && (
                <div className="mt-auto flex gap-2">
                  <Button className="flex-1" onClick={() => openEdit(t)}>
                    Sửa
                  </Button>
                  <Button variant="danger" onClick={() => remove(t)}>
                    Xoá
                  </Button>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={form !== null} title={editing ? `Sửa ${person}` : `Thêm ${person}`} onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error && <Alert>{error}</Alert>}
            <Field label="Họ tên *">
              <Input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email">
                <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Điện thoại">
                <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
            </div>
            <Field label={terms.department}>
              <Input value={form.department ?? ""} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </Field>
            <Field label="Màu hiển thị trên lịch">
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`h-8 w-8 rounded-full border-2 transition ${form.color === c ? "scale-110 border-white" : "border-transparent"}`}
                    style={{ background: c }}
                    aria-label={`Chọn màu ${c}`}
                  />
                ))}
              </div>
            </Field>
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
