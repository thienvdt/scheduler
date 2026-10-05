"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Room, Session, Teacher, Template } from "@/shared/types";
import { KIND_META } from "@/shared/types";
import { endAfter } from "@/lib/templates";
import { TemplatePicker } from "@/components/TemplatePicker";
import { AgendaList } from "@/components/AgendaList";
import { ExportDialog } from "@/components/ExportDialog";
import { useAuth } from "@/components/AuthProvider";
import { FreeSlotFinder, type FinderPrefill, type PickedSlot } from "@/components/FreeSlotFinder";
import { api, ApiRequestError } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { addDays, formatDayMonth, formatFull, minutesToTime, startOfWeek, timeToMinutes, today } from "@/lib/date";
import { Alert, Button, GlassCard, PageHeader, Select, Toast } from "@/components/ui";
import { DAY_END, WeekCalendar, type SessionChange } from "@/components/WeekCalendar";
import { SessionDialog, type SessionDraft } from "@/components/SessionDialog";
import { VoiceCommand } from "@/components/VoiceCommand";
import type { ParsedCommand } from "@/lib/voiceParser";
import { DATA_CHANGED_EVENT, Tour } from "@/components/Tour";

type View = "week" | "list";

const SMALL_QUERY = "(max-width: 639px)";
function subscribeSmall(cb: () => void) {
  const m = window.matchMedia(SMALL_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

type DialogState = { session: Session | null; draft: SessionDraft | null } | null;

export default function CalendarPage() {
  const { canBook, canEdit, isAdmin, user, terms } = useAuth();
  const [finder, setFinder] = useState<{ prefill?: FinderPrefill } | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "error" | "info" } | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today()));
  const [teacherId, setTeacherId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [kind, setKind] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  // Mặc định: điện thoại xem dạng danh sách, máy tính xem lưới tuần; người dùng có thể đổi
  const small = useSyncExternalStore(subscribeSmall, () => window.matchMedia(SMALL_QUERY).matches, () => false);
  const [viewOverride, setViewOverride] = useState<View | null>(null);
  const view: View = viewOverride ?? (small ? "list" : "week");

  const weekEnd = addDays(weekStart, 6);

  const teachersRes = useResource(api.teachers.list, [] as Teacher[]);
  const roomsRes = useResource(api.rooms.list, [] as Room[]);
  const { data: templates, reload: reloadTemplates } = useResource(api.templates.list, [] as Template[]);
  const fetchSessions = useCallback(
    () =>
      api.sessions.list({
        from: weekStart,
        to: weekEnd,
        teacherId: teacherId || undefined,
        roomId: roomId || undefined,
        kind: kind || undefined,
      }),
    [weekStart, weekEnd, teacherId, roomId, kind],
  );
  const {
    data: sessions,
    error: sessionsError,
    reload: reloadSessions,
    mutate: mutateSessions,
  } = useResource(fetchSessions, [] as Session[]);
  const teachers = teachersRes.data;
  const { reload: reloadTeachers } = teachersRes;
  const { reload: reloadRooms } = roomsRes;

  // Sau khi nạp dữ liệu mẫu (từ tour hoặc nút bên dưới) thì tải lại mọi thứ
  useEffect(() => {
    const reloadAll = () => {
      reloadTeachers();
      reloadRooms();
      reloadTemplates();
      reloadSessions();
    };
    window.addEventListener(DATA_CHANGED_EVENT, reloadAll);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, reloadAll);
  }, [reloadTeachers, reloadRooms, reloadTemplates, reloadSessions]);
  const rooms = roomsRes.data;
  const error = teachersRes.error ?? roomsRes.error ?? sessionsError;

  const stats = useMemo(() => {
    const active = sessions.filter((s) => s.status === "scheduled");
    const minutes = active.reduce((sum, s) => sum + timeToMinutes(s.end_time) - timeToMinutes(s.start_time), 0);
    const teaching = active.filter((s) => terms.primaryKinds.includes(s.kind)).length;
    return {
      teaching,
      events: active.length - teaching,
      hours: Math.round((minutes / 60) * 10) / 10,
      cancelled: sessions.length - active.length,
    };
  }, [sessions, terms]);

  function openNew(date = today(), start = "07:00") {
    const end = minutesToTime(Math.min(timeToMinutes(start) + 120, DAY_END));
    setDialog({ session: null, draft: { date, start_time: start, end_time: end, teacher_id: teacherId, room_id: roomId } });
  }

  /** Ngày mặc định khi đặt lịch từ nút: hôm nay nếu đang xem tuần này, ngược lại là Thứ 2 của tuần đang xem. */
  function defaultDate() {
    const t = today();
    return t >= weekStart && t <= weekEnd ? t : weekStart;
  }

  function openFromTemplate(t: Template) {
    const start = t.start_time ?? "08:00";
    setPickerOpen(false);
    setDialog({
      session: null,
      draft: {
        date: defaultDate(),
        start_time: start,
        end_time: endAfter(start, t.duration_minutes),
        kind: t.kind,
        title: t.title ?? undefined,
        note: t.note ?? undefined,
        repeat_weeks: t.repeat_weeks,
        teacher_id: t.teacher_id ?? teacherId,
        room_id: t.room_id ?? roomId,
        template_id: t.id,
      },
    });
  }

  function openFromSlot(slot: PickedSlot) {
    // Giảng viên luôn là người chủ trì lịch mình đặt; quản trị viên: người đầu tiên được chọn
    const host = !isAdmin && user.teacher_id ? user.teacher_id : slot.teacher_ids[0];
    const others = slot.teacher_ids.filter((id) => id !== host);
    setFinder(null);
    setWeekStart(startOfWeek(slot.date));
    setDialog({
      session: null,
      draft: {
        date: slot.date,
        start_time: slot.start_time,
        end_time: slot.end_time,
        teacher_id: host,
        room_id: slot.room_id,
        participant_ids: others,
        kind: others.length ? "meeting" : terms.defaultKind,
      },
    });
  }

  /** Lưu sau khi kéo thả; lỗi (vd. trùng lịch) → thông báo và để lịch trở về chỗ cũ */
  async function moveSession(s: Session, change: SessionChange) {
    try {
      const updated = await api.sessions.update(s.id, change);
      mutateSessions((list) => list.map((x) => (x.id === s.id ? updated : x)));
      setToast({ message: `Đã cập nhật “${s.title}”: ${formatFull(change.date)}, ${change.start_time}–${change.end_time}`, tone: "info" });
    } catch (err) {
      let message = (err as Error).message;
      if (err instanceof ApiRequestError && err.conflicts.length) {
        message += ":\n" + err.conflicts
          .slice(0, 3)
          .map((c) =>
            c.kind === "teacher"
              ? `• ${c.teacher_name ?? c.session.teacher_name} đã có “${c.session.title}” ${c.session.start_time}–${c.session.end_time}`
              : `• Phòng ${c.session.room_name} đã có “${c.session.title}” ${c.session.start_time}–${c.session.end_time}`,
          )
          .join("\n");
      }
      setToast({ message, tone: "error" });
      throw err;
    }
  }

  function openFromVoice(parsed: ParsedCommand, transcript: string) {
    const date = parsed.date ?? today();
    const start = parsed.start_time ?? "07:00";
    const end = parsed.end_time ?? minutesToTime(Math.min(timeToMinutes(start) + 120, DAY_END));
    setVoiceOpen(false);
    setWeekStart(startOfWeek(date));
    setDialog({
      session: null,
      draft: {
        ...parsed,
        date,
        start_time: start,
        end_time: end,
        teacher_id: parsed.teacher_id ?? teacherId,
        room_id: parsed.room_id ?? roomId,
        transcript,
      },
    });
  }

  const [sampleBusy, setSampleBusy] = useState(false);
  async function loadSample() {
    setSampleBusy(true);
    try {
      await api.settings.sample("load");
      setWeekStart(startOfWeek(today()));
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
      setToast({ message: "Đã nạp dữ liệu mẫu. Xoá được trong Cài đặt.", tone: "info" });
    } catch (err) {
      setToast({ message: (err as Error).message, tone: "error" });
    } finally {
      setSampleBusy(false);
    }
  }

  const hasData = teachers.length > 0 && rooms.length > 0;
  const ready = hasData && canBook;
  const metaLoading = teachersRes.loading || roomsRes.loading;

  return (
    <>
      <PageHeader
        title={terms.calendarTitle}
        subtitle={`Tuần ${formatDayMonth(weekStart)} – ${formatDayMonth(weekEnd)}/${weekEnd.slice(0, 4)}`}
        actions={
          <>
            <Button onClick={() => setVoiceOpen(true)} disabled={!ready} title="Đặt lịch bằng giọng nói" data-tour="voice">
              🎤 Giọng nói
            </Button>
            <Button onClick={() => setFinder({})} disabled={!ready} data-tour="finder">
              🔎 Tìm giờ trống
            </Button>
            <Button onClick={() => setPickerOpen(true)} disabled={!ready || templates.length === 0} data-tour="template">
              📋 Từ mẫu
            </Button>
            <Button variant="primary" onClick={() => openNew(defaultDate(), "07:00")} disabled={!ready} data-tour="new">
              + Đặt lịch
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4" data-tour="stats">
        {[
          { label: terms.primaryLabel, value: stats.teaching },
          { label: terms.otherLabel, value: stats.events },
          { label: "Tổng giờ", value: stats.hours },
          { label: "Đã huỷ", value: stats.cancelled },
        ].map((s) => (
          <GlassCard key={s.label} className="px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-white/60">{s.label}</div>
            <div className="mt-1 text-2xl font-bold">{s.value}</div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="mb-4 flex flex-wrap items-center gap-2 p-3" data-tour="toolbar">
        <div className="flex rounded-xl border border-white/15 bg-white/5 p-0.5" role="group" aria-label="Chế độ xem">
          {(["week", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setViewOverride(v)}
              aria-pressed={view === v}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${view === v ? "bg-white/20 text-white" : "text-white/60 hover:text-white"}`}
            >
              {v === "week" ? "▦ Tuần" : "☰ Danh sách"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <Button onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Tuần trước">
            ‹
          </Button>
          <Button onClick={() => setWeekStart(startOfWeek(today()))}>Hôm nay</Button>
          <Button onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Tuần sau">
            ›
          </Button>
          <Button onClick={() => setExportOpen(true)} title="Xuất lịch sang Google Calendar / Outlook / điện thoại">
            📅 Xuất .ics
          </Button>
        </div>
        <div className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto">
          <Select className="sm:w-56" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} aria-label={`Lọc theo ${terms.person.toLowerCase()}`}>
            <option value="">Tất cả {terms.people.toLowerCase()}</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select className="sm:w-44" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Lọc theo loại lịch">
            <option value="">Tất cả loại lịch</option>
            {terms.kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_META[k].icon} {KIND_META[k].label}
              </option>
            ))}
          </Select>
          <Select className="sm:w-44" value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-label="Lọc theo phòng">
            <option value="">Tất cả {terms.room.toLowerCase()}</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
      </GlassCard>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {hasData && !canBook && (
        <div className="mb-4">
          <Alert tone="info">Tài khoản của bạn chưa được liên kết với hồ sơ {terms.person.toLowerCase()} nên chỉ xem được lịch. Hãy liên hệ quản trị viên.</Alert>
        </div>
      )}

      {!hasData && !metaLoading && !error && (
        <div className="mb-4">
          <Alert tone="info">
            Hãy thêm ít nhất một{" "}
            <Link className="underline" href="/teachers/">
              {terms.person.toLowerCase()}
            </Link>{" "}
            và một{" "}
            <Link className="underline" href="/rooms/">
              {terms.room.toLowerCase()}
            </Link>{" "}
            trước khi đặt lịch.
            {isAdmin && (
              <>
                {" "}Hoặc{" "}
                <button type="button" className="font-semibold underline" onClick={loadSample} disabled={sampleBusy} id="empty-load-sample">
                  {sampleBusy ? "đang nạp dữ liệu mẫu…" : "nạp dữ liệu mẫu"}
                </button>{" "}
                để thử ngay.
              </>
            )}
          </Alert>
        </div>
      )}

      <div data-tour="calendar" className="sm:scroll-mt-28">
      {view === "week" ? (
        <WeekCalendar
          weekStart={weekStart}
          sessions={sessions}
          onSlotClick={(date, start) => ready && openNew(date, start)}
          onSessionClick={(s) => setDialog({ session: s, draft: null })}
          canDrag={canEdit}
          onMove={moveSession}
        />
      ) : (
        <AgendaList
          weekStart={weekStart}
          sessions={sessions}
          onSessionClick={(s) => setDialog({ session: s, draft: null })}
          onAdd={ready ? (date) => openNew(date, "07:00") : undefined}
        />
      )}
      </div>

      {!metaLoading && <Tour hasData={hasData} />}

      {exportOpen && (
        <ExportDialog
          weekStart={weekStart}
          filters={{ teacherId: teacherId || undefined, roomId: roomId || undefined, kind: kind || undefined }}
          filterLabel={[
            teachers.find((t) => t.id === teacherId)?.name,
            rooms.find((r) => r.id === roomId) && `Phòng ${rooms.find((r) => r.id === roomId)?.name}`,
            kind && KIND_META[kind as keyof typeof KIND_META]?.label,
          ]
            .filter(Boolean)
            .join(", ")}
          teachers={teachers}
          onClose={() => setExportOpen(false)}
        />
      )}

      {voiceOpen && (
        <VoiceCommand teachers={teachers} rooms={rooms} onClose={() => setVoiceOpen(false)} onSubmit={openFromVoice} />
      )}

      {finder && (
        <FreeSlotFinder
          teachers={teachers}
          rooms={rooms}
          weekStart={weekStart}
          prefill={finder.prefill}
          onClose={() => setFinder(null)}
          onPick={openFromSlot}
        />
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={closeToast} />}

      {pickerOpen && <TemplatePicker templates={templates} onClose={() => setPickerOpen(false)} onPick={openFromTemplate} />}

      {dialog && (
        <SessionDialog
          key={dialog.session?.id ?? `new-${dialog.draft?.template_id ?? ""}-${dialog.draft?.date}-${dialog.draft?.start_time}`}
          session={dialog.session}
          draft={dialog.draft}
          teachers={teachers}
          rooms={rooms}
          templates={templates}
          onFindSlot={(prefill) => {
            setDialog(null);
            setFinder({ prefill });
          }}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reloadSessions();
          }}
        />
      )}
    </>
  );
}
