"use client";

import { useState, type FormEvent } from "react";
import type { Conflict, Room, Session, Teacher } from "@/shared/types";
import { MAX_REPEAT_WEEKS } from "@/shared/types";
import { api, ApiRequestError } from "@/lib/api";
import { formatFull } from "@/lib/date";
import { Alert, Button, Field, Input, Modal, Select, Textarea } from "./ui";

export interface SessionDraft {
  date: string;
  start_time: string;
  end_time: string;
  teacher_id?: string;
  room_id?: string;
}

interface FormState {
  title: string;
  class_name: string;
  teacher_id: string;
  room_id: string;
  date: string;
  start_time: string;
  end_time: string;
  note: string;
  repeat_weeks: number;
}

function initialForm(session: Session | null, draft: SessionDraft | null): FormState {
  if (session) {
    return {
      title: session.title,
      class_name: session.class_name ?? "",
      teacher_id: session.teacher_id,
      room_id: session.room_id,
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      note: session.note ?? "",
      repeat_weeks: 1,
    };
  }
  return {
    title: "",
    class_name: "",
    teacher_id: draft?.teacher_id ?? "",
    room_id: draft?.room_id ?? "",
    date: draft?.date ?? "",
    start_time: draft?.start_time ?? "07:00",
    end_time: draft?.end_time ?? "09:00",
    note: "",
    repeat_weeks: 1,
  };
}

export function SessionDialog({
  session,
  draft,
  teachers,
  rooms,
  onClose,
  onSaved,
}: {
  session: Session | null;
  draft: SessionDraft | null;
  teachers: Teacher[];
  rooms: Room[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialForm(session, draft));
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [busy, setBusy] = useState(false);

  const isEdit = session !== null;
  const cancelled = session?.status === "cancelled";

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    setConflicts([]);
    try {
      await action();
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      if (err instanceof ApiRequestError) setConflicts(err.conflicts);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const payload = { ...form, class_name: form.class_name || null, note: form.note || null };
    run(() =>
      isEdit
        ? api.sessions.update(session.id, { ...payload, repeat_weeks: undefined })
        : api.sessions.create(payload),
    );
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Modal open title={isEdit ? "Chi tiết buổi giảng" : "Đặt lịch giảng"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {cancelled && <Alert tone="info">Buổi giảng này đã bị huỷ.</Alert>}
        {error && (
          <Alert>
            <div className="font-medium">{error}</div>
            {conflicts.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {conflicts.map((c, i) => (
                  <li key={i}>
                    • {formatFull(c.date)} {c.session.start_time}–{c.session.end_time}:{" "}
                    {c.kind === "teacher" ? `GV ${c.session.teacher_name} đã có lịch` : `phòng ${c.session.room_name} đã được dùng`}{" "}
                    ({c.session.title})
                  </li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        <Field label="Môn học / Nội dung *">
          <Input required autoFocus={!isEdit} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="VD: Lập trình Web" />
        </Field>
        <Field label="Lớp">
          <Input value={form.class_name} onChange={(e) => set("class_name", e.target.value)} placeholder="VD: CNTT-K66A" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Giảng viên *">
            <Select required value={form.teacher_id} onChange={(e) => set("teacher_id", e.target.value)}>
              <option value="">— Chọn giảng viên —</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Phòng *">
            <Select required value={form.room_id} onChange={(e) => set("room_id", e.target.value)}>
              <option value="">— Chọn phòng —</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.capacity !== null ? ` (${r.capacity} chỗ)` : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Ngày *" className="col-span-2 sm:col-span-1">
            <Input type="date" required value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Bắt đầu *">
            <Input type="time" required step={300} value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
          </Field>
          <Field label="Kết thúc *">
            <Input type="time" required step={300} value={form.end_time} onChange={(e) => set("end_time", e.target.value)} />
          </Field>
        </div>

        {!isEdit && (
          <Field label="Lặp lại hằng tuần">
            <Select value={form.repeat_weeks} onChange={(e) => set("repeat_weeks", Number(e.target.value))}>
              {Array.from({ length: MAX_REPEAT_WEEKS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "Không lặp" : `${n} tuần`}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Ghi chú">
          <Textarea value={form.note} onChange={(e) => set("note", e.target.value)} />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex flex-wrap gap-2">
            {isEdit && (
              <>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => api.sessions.update(session.id, { status: cancelled ? "scheduled" : "cancelled" }))}
                >
                  {cancelled ? "Khôi phục" : "Huỷ buổi"}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy}
                  onClick={() => confirm("Xoá buổi giảng này?") && run(() => api.sessions.remove(session.id))}
                >
                  Xoá
                </Button>
                {session.series_id && (
                  <Button
                    type="button"
                    variant="danger"
                    disabled={busy}
                    onClick={() =>
                      confirm("Xoá buổi này và tất cả các buổi sau trong chuỗi lặp?") &&
                      run(() => api.sessions.remove(session.id, "following"))
                    }
                  >
                    Xoá các buổi tiếp theo
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="ml-auto flex gap-2">
            <Button type="button" onClick={onClose}>
              Đóng
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Đang lưu…" : isEdit ? "Lưu" : "Đặt lịch"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
