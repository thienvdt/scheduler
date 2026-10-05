"use client";

import { useState, type FormEvent } from "react";
import type { Room } from "@/shared/types";
import { api } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Button, Field, GlassCard, Input, Modal, PageHeader, Textarea } from "@/components/ui";

interface RoomForm {
  name: string;
  building: string;
  capacity: string;
  equipment: string;
  is_virtual: boolean;
}

const empty: RoomForm = { name: "", building: "", capacity: "", equipment: "", is_virtual: false };

export default function RoomsPage() {
  const { isAdmin, terms } = useAuth();
  const { data: items, loading, error: loadError, reload } = useResource(api.rooms.list, [] as Room[]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState<RoomForm | null>(null);
  const [saving, setSaving] = useState(false);

  function openEdit(r: Room) {
    setEditing(r);
    setError(null);
    setForm({
      name: r.name,
      building: r.building ?? "",
      capacity: r.capacity?.toString() ?? "",
      equipment: r.equipment ?? "",
      is_virtual: !!r.is_virtual,
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    const input = { ...form, capacity: form.capacity === "" ? null : Number(form.capacity) };
    try {
      if (editing) await api.rooms.update(editing.id, input);
      else await api.rooms.create(input);
      setForm(null);
      reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: Room) {
    if (!confirm(`Xoá phòng "${r.name}"?`)) return;
    setError(null);
    try {
      await api.rooms.remove(r.id);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title={terms.room}
        subtitle={`${items.length} ${terms.room.toLowerCase()} · Phòng ảo (Online, bên ngoài) không bị kiểm tra trùng phòng`}
        actions={
          isAdmin && (
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setError(null);
                setForm(empty);
              }}
            >
              + Thêm phòng
            </Button>
          )
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
        <GlassCard className="p-8 text-center text-white/60">Chưa có phòng nào.</GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((r) => (
            <GlassCard key={r.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-xl font-bold">{r.name}</div>
                  <div className="text-sm text-white/60">{r.building ?? "—"}</div>
                </div>
                {r.capacity !== null && (
                  <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs">
                    👥 {r.capacity} chỗ
                  </span>
                )}
              </div>
              {!!r.is_virtual && (
                <span className="w-fit rounded-full border border-violet-300/40 bg-violet-400/15 px-2.5 py-1 text-xs">
                  🌐 Phòng ảo – không kiểm tra trùng phòng
                </span>
              )}
              {r.equipment && <p className="text-sm text-white/70">🛠 {r.equipment}</p>}
              {isAdmin && (
                <div className="mt-auto flex gap-2">
                  <Button className="flex-1" onClick={() => openEdit(r)}>
                    Sửa
                  </Button>
                  <Button variant="danger" onClick={() => remove(r)}>
                    Xoá
                  </Button>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={form !== null} title={editing ? "Sửa phòng" : "Thêm phòng"} onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error && <Alert>{error}</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên phòng *">
                <Input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Toà nhà">
                <Input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} />
              </Field>
            </div>
            <Field label="Sức chứa">
              <Input
                type="number"
                min={0}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 accent-cyan-400"
                checked={form.is_virtual}
                onChange={(e) => setForm({ ...form, is_virtual: e.target.checked })}
              />
              <span>
                Phòng ảo (Online, bên ngoài, đi công tác)
                <span className="block text-xs text-white/50">Nhiều lịch cùng giờ vẫn đặt được; chỉ kiểm tra trùng người.</span>
              </span>
            </label>
            <Field label="Thiết bị">
              <Textarea
                placeholder="Máy chiếu, loa, bảng thông minh…"
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
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
