"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { Session } from "@/shared/types";
import { KIND_META } from "@/shared/types";
import { addDays, formatDayMonth, minutesToTime, timeToMinutes, today, WEEKDAYS } from "@/lib/date";
import { cn } from "./ui";

export const DAY_START = 7 * 60;
export const DAY_END = 22 * 60;
const HOUR_PX = 56;
const PX_PER_MIN = HOUR_PX / 60;
const SNAP_MIN = 30;
/** Bước khi kéo thả */
const DRAG_SNAP_MIN = 15;
const TIME_COL_PX = 56;

export interface SessionChange {
  date: string;
  start_time: string;
  end_time: string;
}

interface DragState {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  origDay: number;
  origStart: number;
  origEnd: number;
  day: number;
  start: number;
  end: number;
  moved: boolean;
}

interface Placed {
  session: Session;
  col: number;
  cols: number;
}

/** Xếp các buổi chồng giờ trong cùng một ngày thành các cột song song. */
function layoutDay(sessions: Session[]): Placed[] {
  const sorted = [...sessions].sort((a, b) => a.start_time.localeCompare(b.start_time) || a.end_time.localeCompare(b.end_time));
  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = "";
  let colEnds: string[] = [];

  const flush = () => {
    const cols = colEnds.length;
    cluster.forEach((p) => (p.cols = cols));
    placed.push(...cluster);
    cluster = [];
    colEnds = [];
    clusterEnd = "";
  };

  for (const s of sorted) {
    if (cluster.length && s.start_time >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= s.start_time);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(s.end_time);
    } else {
      colEnds[col] = s.end_time;
    }
    cluster.push({ session: s, col, cols: 1 });
    if (s.end_time > clusterEnd) clusterEnd = s.end_time;
  }
  if (cluster.length) flush();
  return placed;
}

export function WeekCalendar({
  weekStart,
  sessions,
  onSlotClick,
  onSessionClick,
  canDrag,
  onMove,
}: {
  weekStart: string;
  sessions: Session[];
  onSlotClick: (date: string, startTime: string) => void;
  onSessionClick: (s: Session) => void;
  /** Lịch nào được kéo thả (theo quyền sửa) */
  canDrag?: (s: Session) => boolean;
  /** Lưu thay đổi sau khi kéo thả; promise bị từ chối → lịch trở về chỗ cũ */
  onMove?: (s: Session, change: SessionChange) => Promise<void>;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START / 60 + i);
  const todayStr = today();
  const height = (DAY_END - DAY_START) * PX_PER_MIN;

  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  // Giữ vị trí mới trong lúc chờ lưu để lịch không nhảy về chỗ cũ
  const [pending, setPending] = useState<{ id: string } & SessionChange | null>(null);
  const suppressClick = useRef(false);
  // Bản sao của `drag` cho các listener trên window (cập nhật cùng lúc với state)
  const dragRef = useRef<DragState | null>(null);
  const updateDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  function handleColumnClick(e: MouseEvent<HTMLDivElement>, date: string) {
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = DAY_START + Math.floor((e.clientY - rect.top) / PX_PER_MIN / SNAP_MIN) * SNAP_MIN;
    onSlotClick(date, minutesToTime(Math.min(Math.max(minutes, DAY_START), DAY_END - SNAP_MIN)));
  }

  function beginDrag(e: ReactPointerEvent, s: Session, mode: DragState["mode"]) {
    // Chỉ chuột/bút; trên màn hình cảm ứng giữ thao tác cuộn và chạm để mở chi tiết
    if (!onMove || e.pointerType === "touch" || e.button !== 0 || !canDrag?.(s)) return;
    e.stopPropagation();
    const start = timeToMinutes(s.start_time);
    const end = timeToMinutes(s.end_time);
    const day = days.indexOf(s.date);
    updateDrag({ id: s.id, mode, startX: e.clientX, startY: e.clientY, origDay: day, origStart: start, origEnd: end, day, start, end, moved: false });
  }

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;

    const onMovePointer = (e: PointerEvent) => {
      const d = dragRef.current;
      const grid = gridRef.current;
      if (!d || !grid) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      const delta = Math.round(dy / PX_PER_MIN / DRAG_SNAP_MIN) * DRAG_SNAP_MIN;
      const next = { ...d, moved: true };
      if (d.mode === "move") {
        const duration = d.origEnd - d.origStart;
        const rect = grid.getBoundingClientRect();
        const colWidth = (rect.width - TIME_COL_PX) / 7;
        next.day = Math.min(6, Math.max(0, Math.floor((e.clientX - rect.left - TIME_COL_PX) / colWidth)));
        next.start = Math.min(Math.max(d.origStart + delta, DAY_START), DAY_END - duration);
        next.end = next.start + duration;
      } else {
        next.end = Math.min(Math.max(d.origEnd + delta, d.origStart + DRAG_SNAP_MIN), DAY_END);
      }
      updateDrag(next);
    };

    const finish = (commit: boolean) => {
      const d = dragRef.current;
      updateDrag(null);
      if (!d?.moved) return;
      suppressClick.current = true; // bỏ qua sự kiện click ngay sau khi thả
      const changed = d.day !== d.origDay || d.start !== d.origStart || d.end !== d.origEnd;
      const session = sessions.find((x) => x.id === d.id);
      if (!commit || !changed || !session || !onMove) return;
      const change = { date: days[d.day], start_time: minutesToTime(d.start), end_time: minutesToTime(d.end) };
      setPending({ id: d.id, ...change });
      onMove(session, change)
        .catch(() => {})
        .finally(() => setPending(null));
    };

    const onUp = () => finish(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish(false);
    window.addEventListener("pointermove", onMovePointer);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMovePointer);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
    };
    // days/sessions đổi khi đang kéo là hiếm; dùng giá trị lúc bắt đầu kéo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  // Lịch hiển thị: áp vị trí đang kéo / đang chờ lưu
  const shown = sessions.map((s) => {
    if (drag?.moved && drag.id === s.id) {
      return { ...s, date: days[drag.day], start_time: minutesToTime(drag.start), end_time: minutesToTime(drag.end) };
    }
    if (pending?.id === s.id) return { ...s, date: pending.date, start_time: pending.start_time, end_time: pending.end_time };
    return s;
  });
  const activeId = drag?.moved ? drag.id : pending?.id;

  return (
    <div className="glass overflow-x-auto rounded-2xl">
      <div className={cn("min-w-[760px]", drag?.moved && "cursor-grabbing select-none")}>
        {/* Tiêu đề ngày */}
        <div className="sticky top-0 z-10 grid grid-cols-[56px_repeat(7,1fr)] border-b border-white/10 bg-white/5 backdrop-blur-xl">
          <div />
          {days.map((d, i) => (
            <div key={d} className="px-2 py-3 text-center">
              <div className="text-xs uppercase tracking-wide text-white/60">{WEEKDAYS[i]}</div>
              <div
                className={cn(
                  "mx-auto mt-1 w-fit rounded-full px-2.5 py-0.5 text-sm font-semibold",
                  d === todayStr && "bg-gradient-to-r from-indigo-400 to-cyan-400 text-slate-900",
                )}
              >
                {formatDayMonth(d)}
              </div>
            </div>
          ))}
        </div>

        <div ref={gridRef} className="grid grid-cols-[56px_repeat(7,1fr)]">
          {/* Cột giờ */}
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-white/50"
                style={{ top: (h * 60 - DAY_START) * PX_PER_MIN }}
              >
                {h > DAY_START / 60 && `${String(h).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          {days.map((d) => {
            const placed = layoutDay(shown.filter((s) => s.date === d));
            return (
              <div
                key={d}
                className={cn(
                  "relative cursor-pointer border-l border-white/10 transition-colors hover:bg-white/[0.03]",
                  d === todayStr && "bg-cyan-300/[0.04]",
                )}
                style={{ height }}
                onClick={(e) => handleColumnClick(e, d)}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute inset-x-0 border-t border-white/[0.07]"
                    style={{ top: (h * 60 - DAY_START) * PX_PER_MIN }}
                  />
                ))}

                {placed.map(({ session: s, col, cols }) => {
                  const start = Math.max(timeToMinutes(s.start_time), DAY_START);
                  const end = Math.min(timeToMinutes(s.end_time), DAY_END);
                  if (end <= start) return null;
                  const color = s.teacher_color ?? "#60a5fa";
                  const cancelled = s.status === "cancelled";
                  const draggable = !!onMove && !!canDrag?.(s);
                  const active = activeId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onPointerDown={(e) => beginDrag(e, s, "move")}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (suppressClick.current) {
                          suppressClick.current = false;
                          return;
                        }
                        onSessionClick(s);
                      }}
                      className={cn(
                        "group absolute overflow-hidden rounded-xl border px-2 py-1 text-left text-xs shadow-lg backdrop-blur-md transition",
                        active ? "z-30 opacity-90 ring-2 ring-cyan-300/80" : "hover:z-20 hover:scale-[1.02]",
                        draggable && !active && "cursor-grab",
                        cancelled && "opacity-50 line-through",
                      )}
                      style={{
                        top: (start - DAY_START) * PX_PER_MIN + 1,
                        height: (end - start) * PX_PER_MIN - 2,
                        left: `calc(${(col / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                        background: `linear-gradient(135deg, ${color}55, ${color}25)`,
                        borderColor: `${color}90`,
                        // Bỏ hiệu ứng chuyển động khi đang kéo để khối bám theo con trỏ
                        transition: active ? "none" : undefined,
                      }}
                      title={`${KIND_META[s.kind]?.label ?? ""}: ${s.title} • ${s.start_time}–${s.end_time} • ${s.teacher_name} • ${s.room_name}${
                        draggable ? "\nKéo để đổi giờ/ngày, kéo mép dưới để đổi thời lượng" : ""
                      }`}
                    >
                      <div className="truncate font-semibold">
                        {s.kind !== "lecture" && <span className="mr-1">{KIND_META[s.kind]?.icon}</span>}
                        {s.title}
                      </div>
                      <div className="truncate text-white/80">
                        {s.start_time}–{s.end_time}
                      </div>
                      <div className="truncate text-white/70">📍 {s.room_name}</div>
                      <div className="truncate text-white/70">
                        👤 {s.teacher_name}
                        {s.participant_ids?.length ? ` +${s.participant_ids.length}` : ""}
                      </div>
                      {draggable && (
                        <div
                          onPointerDown={(e) => beginDrag(e, s, "resize")}
                          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize opacity-0 transition group-hover:opacity-100"
                          aria-hidden
                        >
                          <div className="mx-auto mt-0.5 h-1 w-8 rounded-full bg-white/60" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
