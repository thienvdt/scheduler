"use client";

import { useState, type FormEvent } from "react";
import type { Conflict, EventKind, Room, Session, Teacher, Template } from "@/shared/types";
import { KIND_META, MAX_REPEAT_WEEKS } from "@/shared/types";
import { kindOptions } from "@/shared/profiles";
import { api, ApiRequestError } from "@/lib/api";
import { formatFull, timeToMinutes } from "@/lib/date";
import { endAfter, templateIcon } from "@/lib/templates";
import { Alert, Button, cn, Field, Input, Modal, Select, Textarea } from "./ui";
import { useAuth } from "./AuthProvider";
import { ParticipantPicker } from "./ParticipantPicker";

export interface SessionDraft {
  date: string;
  start_time: string;
  end_time: string;
  teacher_id?: string;
  room_id?: string;
  title?: string;
  class_name?: string;
  repeat_weeks?: number;
  kind?: EventKind;
  note?: string;
  participant_ids?: string[];
  /** Mẫu lịch đã dùng để điền form (nếu có). */
  template_id?: string;
  /** Câu lệnh giọng nói đã dùng để điền form (nếu có). */
  transcript?: string;
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
  kind: EventKind;
  participant_ids: string[];
}

// Loại lịch thường chỉ có một người (không hiện ô người tham dự trừ khi đã có)
const SOLO_KINDS: EventKind[] = ["lecture", "practice", "office_hours", "duty"];

function initialForm(session: Session | null, draft: SessionDraft | null, defaultKind: EventKind): FormState {
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
      kind: session.kind,
      participant_ids: session.participant_ids ?? [],
    };
  }
  return {
    title: draft?.title ?? "",
    class_name: draft?.class_name ?? "",
    teacher_id: draft?.teacher_id ?? "",
    room_id: draft?.room_id ?? "",
    date: draft?.date ?? "",
    start_time: draft?.start_time ?? "07:00",
    end_time: draft?.end_time ?? "09:00",
    note: draft?.note ?? "",
    repeat_weeks: draft?.repeat_weeks ?? 1,
    kind: draft?.kind ?? defaultKind,
    participant_ids: draft?.participant_ids ?? [],
  };
}

export function SessionDialog({
  session,
  draft,
  teachers,
  rooms,
  templates = [],
  onClose,
  onSaved,
  onFindSlot,
}: {
  session: Session | null;
  draft: SessionDraft | null;
  teachers: Teacher[];
  rooms: Room[];
  templates?: Template[];
  onClose: () => void;
  onSaved: () => void;
  /** Mở công cụ tìm giờ trống với người/phòng/thời lượng của form */
  onFindSlot?: (prefill: { teacher_ids: string[]; room_id: string; duration: number; date: string }) => void;
}) {
  const { isAdmin, canEdit, user, terms } = useAuth();
  const [form, setForm] = useState<FormState>(() => {
    const f = initialForm(session, draft, terms.defaultKind);
    return !session && !isAdmin && user.teacher_id ? { ...f, teacher_id: user.teacher_id } : f;
  });
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [busy, setBusy] = useState(false);
  const [templateId, setTemplateId] = useState(draft?.template_id ?? "");

  const isEdit = session !== null;
  const cancelled = session?.status === "cancelled";
  const readOnly = isEdit && !canEdit(session);
  // Người dùng không phải quản trị chỉ đặt lịch do chính mình chủ trì
  const hostLocked = !isAdmin;

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
    const payload = {
      ...form,
      class_name: form.class_name || null,
      note: form.note || null,
      participant_ids: form.participant_ids.filter((id) => id !== form.teacher_id),
    };
    run(() => (isEdit ? api.sessions.update(session.id, { ...payload, repeat_weeks: undefined }) : api.sessions.create(payload)));
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  /** Áp dụng mẫu nhưng giữ ngày/giờ bắt đầu người dùng đã chọn. */
  function applyTemplate(t: Template) {
    const previous = templates.find((x) => x.id === templateId);
    setTemplateId(t.id);
    setForm((f) => ({
      ...f,
      kind: t.kind,
      title: t.title ?? (previous && f.title === (previous.title ?? "") ? "" : f.title),
      end_time: endAfter(f.start_time, t.duration_minutes),
      repeat_weeks: t.repeat_weeks,
      teacher_id: hostLocked ? f.teacher_id : (t.teacher_id ?? f.teacher_id),
      room_id: t.room_id ?? f.room_id,
      note: !f.note || f.note === previous?.note ? (t.note ?? "") : f.note,
    }));
  }

  // Đổi giờ bắt đầu thì giữ nguyên thời lượng
  function changeStart(start: string) {
    setForm((f) => {
      const duration = timeToMinutes(f.end_time) - timeToMinutes(f.start_time);
      return { ...f, start_time: start, end_time: start && duration > 0 ? endAfter(start, duration) : f.end_time };
    });
  }

  const primary = terms.primaryKinds.includes(form.kind);
  const showGroup = terms.groupKinds.includes(form.kind) || !!form.class_name;
  const showParticipants = !SOLO_KINDS.includes(form.kind) || form.participant_ids.length > 0;

  return (
    <Modal
      open
      title={isEdit ? `${KIND_META[form.kind].icon} Chi tiết lịch${readOnly ? " (chỉ xem)" : ""}` : "Đặt lịch"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {readOnly && <Alert tone="info">Bạn chỉ có thể sửa lịch do chính mình chủ trì.</Alert>}
        {!isEdit && templates.length > 0 && (
          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-white/60">Chọn mẫu</div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className={cn(
                    "shrink-0 rounded-xl border px-3 py-1.5 text-sm backdrop-blur-md transition",
                    templateId === t.id
                      ? "border-cyan-300/60 bg-cyan-400/20 text-white"
                      : "border-white/15 bg-white/5 text-white/80 hover:bg-white/15",
                  )}
                >
                  {templateIcon(t)} {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {cancelled && <Alert tone="info">Lịch này đã bị huỷ.</Alert>}
        {draft?.transcript && <Alert tone="info">🎤 Đã điền từ câu: “{draft.transcript}”. Hãy kiểm tra lại trước khi lưu.</Alert>}
        {error && (
          <Alert>
            <div className="font-medium">{error}</div>
            {conflicts.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {conflicts.map((c, i) => (
                  <li key={i}>
                    • {formatFull(c.date)} {c.session.start_time}–{c.session.end_time}:{" "}
                    {c.kind === "teacher"
                      ? `${c.teacher_name ?? c.session.teacher_name} đã có lịch`
                      : `phòng ${c.session.room_name} đã được dùng`}{" "}
                    ({c.session.title})
                  </li>
                ))}
              </ul>
            )}
            {conflicts.length > 0 && onFindSlot && (
              <Button
                type="button"
                className="mt-2 px-3 py-1 text-xs"
                onClick={() =>
                  onFindSlot({
                    teacher_ids: [form.teacher_id, ...form.participant_ids].filter(Boolean),
                    room_id: form.room_id,
                    duration: Math.max(15, timeToMinutes(form.end_time) - timeToMinutes(form.start_time)),
                    date: form.date,
                  })
                }
              >
                🔎 Tìm giờ trống phù hợp
              </Button>
            )}
          </Alert>
        )}

        <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
            <Field label={primary ? `${terms.primaryTitleLabel} *` : "Tiêu đề *"}>
              <Input
                required
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder={primary ? terms.primaryTitlePlaceholder : terms.titlePlaceholder}
              />
            </Field>
            <Field label="Loại lịch">
              <Select value={form.kind} onChange={(e) => set("kind", e.target.value as EventKind)}>
                {kindOptions(terms, session?.kind).map((k) => (
                  <option key={k} value={k}>
                    {KIND_META[k].icon} {KIND_META[k].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {showGroup && (
            <Field label={terms.group}>
              <Input value={form.class_name} onChange={(e) => set("class_name", e.target.value)} placeholder={terms.groupPlaceholder} />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={primary && terms.id === "education" ? `${terms.person} *` : "Chủ trì / Phụ trách *"}>
              <Select required disabled={hostLocked} value={form.teacher_id} onChange={(e) => set("teacher_id", e.target.value)}>
                <option value="">— Chọn {terms.person.toLowerCase()} —</option>
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
              <Input type="time" required step={300} value={form.start_time} onChange={(e) => changeStart(e.target.value)} />
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

          {showParticipants && (
            <Field label={`Người tham dự${form.participant_ids.length ? ` (${form.participant_ids.length})` : ""}`}>
              <ParticipantPicker
                teachers={teachers}
                hostId={form.teacher_id}
                value={form.participant_ids}
                onChange={(ids) => set("participant_ids", ids)}
                disabled={readOnly}
              />
            </Field>
          )}

          <Field label={primary && terms.id === "education" ? "Ghi chú" : "Nội dung / Ghi chú"}>
            <Textarea
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              className={form.note.includes("\n") ? "min-h-32" : undefined}
            />
          </Field>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex flex-wrap gap-2">
            {isEdit && !readOnly && (
              <>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => api.sessions.update(session.id, { status: cancelled ? "scheduled" : "cancelled" }))}
                >
                  {cancelled ? "Khôi phục" : "Huỷ lịch"}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy}
                  onClick={() => confirm("Xoá lịch này?") && run(() => api.sessions.remove(session.id))}
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
            {!readOnly && (
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? "Đang lưu…" : isEdit ? "Lưu" : "Đặt lịch"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}
