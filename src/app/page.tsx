"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { Room, Session, Teacher } from "@/shared/types";
import { api } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { addDays, formatDayMonth, minutesToTime, startOfWeek, timeToMinutes, today } from "@/lib/date";
import { Alert, Button, GlassCard, PageHeader, Select } from "@/components/ui";
import { DAY_END, WeekCalendar } from "@/components/WeekCalendar";
import { SessionDialog, type SessionDraft } from "@/components/SessionDialog";
import { VoiceCommand } from "@/components/VoiceCommand";
import type { ParsedCommand } from "@/lib/voiceParser";

type DialogState = { session: Session | null; draft: SessionDraft | null } | null;

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today()));
  const [teacherId, setTeacherId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);

  const weekEnd = addDays(weekStart, 6);

  const teachersRes = useResource(api.teachers.list, [] as Teacher[]);
  const roomsRes = useResource(api.rooms.list, [] as Room[]);
  const fetchSessions = useCallback(
    () => api.sessions.list({ from: weekStart, to: weekEnd, teacherId: teacherId || undefined, roomId: roomId || undefined }),
    [weekStart, weekEnd, teacherId, roomId],
  );
  const { data: sessions, error: sessionsError, reload: reloadSessions } = useResource(fetchSessions, [] as Session[]);
  const teachers = teachersRes.data;
  const rooms = roomsRes.data;
  const error = teachersRes.error ?? roomsRes.error ?? sessionsError;

  const stats = useMemo(() => {
    const active = sessions.filter((s) => s.status === "scheduled");
    const minutes = active.reduce((sum, s) => sum + timeToMinutes(s.end_time) - timeToMinutes(s.start_time), 0);
    return {
      count: active.length,
      hours: Math.round((minutes / 60) * 10) / 10,
      cancelled: sessions.length - active.length,
      teachers: new Set(active.map((s) => s.teacher_id)).size,
    };
  }, [sessions]);

  function openNew(date = today(), start = "07:00") {
    const end = minutesToTime(Math.min(timeToMinutes(start) + 120, DAY_END));
    setDialog({ session: null, draft: { date, start_time: start, end_time: end, teacher_id: teacherId, room_id: roomId } });
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

  const ready = teachers.length > 0 && rooms.length > 0;
  const metaLoading = teachersRes.loading || roomsRes.loading;

  return (
    <>
      <PageHeader
        title="Lịch giảng"
        subtitle={`Tuần ${formatDayMonth(weekStart)} – ${formatDayMonth(weekEnd)}/${weekEnd.slice(0, 4)}`}
        actions={
          <>
            <Button onClick={() => setVoiceOpen(true)} disabled={!ready} title="Đặt lịch bằng giọng nói">
              🎤 Giọng nói
            </Button>
            <Button variant="primary" onClick={() => openNew()} disabled={!ready}>
              + Đặt lịch giảng
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Buổi giảng", value: stats.count },
          { label: "Tổng giờ", value: stats.hours },
          { label: "Giảng viên", value: stats.teachers },
          { label: "Đã huỷ", value: stats.cancelled },
        ].map((s) => (
          <GlassCard key={s.label} className="px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-white/60">{s.label}</div>
            <div className="mt-1 text-2xl font-bold">{s.value}</div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="flex gap-1">
          <Button onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Tuần trước">
            ‹
          </Button>
          <Button onClick={() => setWeekStart(startOfWeek(today()))}>Hôm nay</Button>
          <Button onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Tuần sau">
            ›
          </Button>
        </div>
        <div className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto">
          <Select className="sm:w-56" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} aria-label="Lọc theo giảng viên">
            <option value="">Tất cả giảng viên</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select className="sm:w-44" value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-label="Lọc theo phòng">
            <option value="">Tất cả phòng</option>
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

      {!ready && !metaLoading && !error && (
        <div className="mb-4">
          <Alert tone="info">
            Hãy thêm ít nhất một <Link className="underline" href="/teachers/">giảng viên</Link> và một{" "}
            <Link className="underline" href="/rooms/">phòng học</Link> trước khi đặt lịch.
          </Alert>
        </div>
      )}

      <WeekCalendar
        weekStart={weekStart}
        sessions={sessions}
        onSlotClick={(date, start) => ready && openNew(date, start)}
        onSessionClick={(s) => setDialog({ session: s, draft: null })}
      />

      {voiceOpen && (
        <VoiceCommand teachers={teachers} rooms={rooms} onClose={() => setVoiceOpen(false)} onSubmit={openFromVoice} />
      )}

      {dialog && (
        <SessionDialog
          key={dialog.session?.id ?? "new"}
          session={dialog.session}
          draft={dialog.draft}
          teachers={teachers}
          rooms={rooms}
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
