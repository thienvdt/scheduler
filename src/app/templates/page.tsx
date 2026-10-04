"use client";

import { useState, type FormEvent } from "react";
import type { EventKind, Room, Teacher, Template } from "@/shared/types";
import { EVENT_KINDS, KIND_META, MAX_REPEAT_WEEKS } from "@/shared/types";
import { api } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { formatDuration, templateIcon } from "@/lib/templates";
import { Alert, Button, Field, GlassCard, Input, Modal, PageHeader, Select, Textarea } from "@/components/ui";

interface TemplateForm {
  name: string;
  kind: EventKind;
  icon: string;
  title: string;
  duration_minutes: string;
  start_time: string;
  repeat_weeks: number;
  teacher_id: string;
  room_id: string;
  note: string;
}

const empty: TemplateForm = {
  name: "",
  kind: "meeting",
  icon: "",
  title: "",
  duration_minutes: "60",
  start_time: "",
  repeat_weeks: 1,
  teacher_id: "",
  room_id: "",
  note: "",
};

const ICONS = ["👥", "🏛️", "🎤", "📝", "🎓", "💬", "📚", "🧪", "📌", "🗓️", "☕", "🧑‍🏫"];

export default function TemplatesPage() {
  const { data: items, loading, error: loadError, reload } = useResource(api.templates.list, [] as Template[]);
  const { data: teachers } = useResource(api.teachers.list, [] as Teacher[]);
  const { data: rooms } = useResource(api.rooms.list, [] as Room[]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<TemplateForm | null>(null);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setError(null);
    setForm(empty);
  }

  function openEdit(t: Template) {
    setEditing(t);
    setError(null);
    setForm({
      name: t.name,
      kind: t.kind,
      icon: t.icon ?? "",
      title: t.title ?? "",
      duration_minutes: String(t.duration_minutes),
      start_time: t.start_time ?? "",
      repeat_weeks: t.repeat_weeks,
      teacher_id: t.teacher_id ?? "",
      room_id: t.room_id ?? "",
      note: t.note ?? "",
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const input = {
      ...form,
      icon: form.icon || null,
      title: form.title || null,
      duration_minutes: Number(form.duration_minutes),
      start_time: form.start_time || null,
      teacher_id: form.teacher_id || null,
      room_id: form.room_id || null,
      note: form.note || null,
    };
    try {
      if (editing) await api.templates.update(editing.id, input);
      else await api.templates.create(input);
      setForm(null);
      reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function duplicate(t: Template) {
    setError(null);
    try {
      await api.templates.create({
        name: `${t.name} (bản sao)`,
        kind: t.kind,
        icon: t.icon,
        title: t.title,
        duration_minutes: t.duration_minutes,
        start_time: t.start_time,
        repeat_weeks: t.repeat_weeks,
        teacher_id: t.teacher_id,
        room_id: t.room_id,
        note: t.note,
        sort_order: t.sort_order + 1,
      });
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(t: Template) {
    if (!confirm(`Xoá mẫu "${t.name}"? Các lịch đã tạo từ mẫu này không bị ảnh hưởng.`)) return;
    setError(null);
    try {
      await api.templates.remove(t.id);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const set = <K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));

  return (
    <>
      <PageHeader
        title="Mẫu lịch"
        subtitle="Mẫu có sẵn cho họp, seminar, coi thi… Chọn mẫu khi đặt lịch để điền nhanh."
        actions={
          <Button variant="primary" onClick={openCreate}>
            + Tạo mẫu
          </Button>
        }
      />

      {(error ?? loadError) && !form && (
        <div className="mb-4">
          <Alert>{error ?? loadError}</Alert>
        </div>
      )}

      {loading ? (
        <p className="text-white/60">Đang tải…</p>
      ) : items.length === 0 ? (
        <GlassCard className="p-8 text-center text-white/60">Chưa có mẫu nào.</GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <GlassCard key={t.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 text-2xl">
                  {templateIcon(t)}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{t.name}</div>
                  <div className="text-sm text-white/60">{KIND_META[t.kind].label}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1">⏱ {formatDuration(t.duration_minutes)}</span>
                {t.start_time && <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1">🕗 {t.start_time}</span>}
                {t.repeat_weeks > 1 && (
                  <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1">🔁 {t.repeat_weeks} tuần</span>
                )}
                {t.room_id && (
                  <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1">
                    📍 {rooms.find((r) => r.id === t.room_id)?.name ?? "…"}
                  </span>
                )}
              </div>
              {t.note && <p className="line-clamp-3 whitespace-pre-line text-sm text-white/60">{t.note}</p>}
              <div className="mt-auto flex gap-2">
                <Button className="flex-1" onClick={() => openEdit(t)}>
                  Sửa
                </Button>
                <Button onClick={() => duplicate(t)} title="Nhân bản">
                  ⧉
                </Button>
                <Button variant="danger" onClick={() => remove(t)}>
                  Xoá
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={form !== null} title={editing ? "Sửa mẫu lịch" : "Tạo mẫu lịch"} onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error && <Alert>{error}</Alert>}
            <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
              <Field label="Tên mẫu *">
                <Input required autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="VD: Họp giao ban tuần" />
              </Field>
              <Field label="Loại lịch">
                <Select value={form.kind} onChange={(e) => set("kind", e.target.value as EventKind)}>
                  {EVENT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_META[k].icon} {KIND_META[k].label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Biểu tượng">
              <div className="flex flex-wrap gap-1.5">
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => set("icon", form.icon === icon ? "" : icon)}
                    className={`grid h-9 w-9 place-items-center rounded-xl border text-lg transition ${
                      form.icon === icon ? "border-cyan-300/70 bg-cyan-400/20" : "border-white/15 bg-white/5 hover:bg-white/15"
                    }`}
                    aria-label={`Biểu tượng ${icon}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Tiêu đề mặc định">
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Để trống nếu mỗi lần một khác" />
            </Field>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Thời lượng (phút) *">
                <Input
                  type="number"
                  required
                  min={5}
                  max={1440}
                  step={5}
                  value={form.duration_minutes}
                  onChange={(e) => set("duration_minutes", e.target.value)}
                />
              </Field>
              <Field label="Giờ bắt đầu">
                <Input type="time" step={300} value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
              </Field>
              <Field label="Lặp lại" className="col-span-2 sm:col-span-1">
                <Select value={form.repeat_weeks} onChange={(e) => set("repeat_weeks", Number(e.target.value))}>
                  {Array.from({ length: MAX_REPEAT_WEEKS }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "Không lặp" : `${n} tuần`}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Chủ trì mặc định">
                <Select value={form.teacher_id} onChange={(e) => set("teacher_id", e.target.value)}>
                  <option value="">— Không —</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Phòng mặc định">
                <Select value={form.room_id} onChange={(e) => set("room_id", e.target.value)}>
                  <option value="">— Không —</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Nội dung / chương trình mẫu">
              <Textarea
                className="min-h-32"
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
                placeholder={"Nội dung:\n1. …\n2. …"}
              />
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
