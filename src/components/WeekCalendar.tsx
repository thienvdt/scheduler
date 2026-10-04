"use client";

import type { MouseEvent } from "react";
import type { Session } from "@/shared/types";
import { addDays, formatDayMonth, minutesToTime, timeToMinutes, today, WEEKDAYS } from "@/lib/date";
import { cn } from "./ui";

export const DAY_START = 7 * 60;
export const DAY_END = 22 * 60;
const HOUR_PX = 56;
const PX_PER_MIN = HOUR_PX / 60;
const SNAP_MIN = 30;

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
}: {
  weekStart: string;
  sessions: Session[];
  onSlotClick: (date: string, startTime: string) => void;
  onSessionClick: (s: Session) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START / 60 + i);
  const todayStr = today();
  const height = (DAY_END - DAY_START) * PX_PER_MIN;

  function handleColumnClick(e: MouseEvent<HTMLDivElement>, date: string) {
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = DAY_START + Math.floor((e.clientY - rect.top) / PX_PER_MIN / SNAP_MIN) * SNAP_MIN;
    onSlotClick(date, minutesToTime(Math.min(Math.max(minutes, DAY_START), DAY_END - SNAP_MIN)));
  }

  return (
    <div className="glass overflow-x-auto rounded-2xl">
      <div className="min-w-[760px]">
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

        <div className="grid grid-cols-[56px_repeat(7,1fr)]">
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
            const placed = layoutDay(sessions.filter((s) => s.date === d));
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
                  <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-white/[0.07]" style={{ top: (h * 60 - DAY_START) * PX_PER_MIN }} />
                ))}

                {placed.map(({ session: s, col, cols }) => {
                  const start = Math.max(timeToMinutes(s.start_time), DAY_START);
                  const end = Math.min(timeToMinutes(s.end_time), DAY_END);
                  if (end <= start) return null;
                  const color = s.teacher_color ?? "#60a5fa";
                  const cancelled = s.status === "cancelled";
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSessionClick(s);
                      }}
                      className={cn(
                        "absolute overflow-hidden rounded-xl border px-2 py-1 text-left text-xs shadow-lg backdrop-blur-md transition hover:z-20 hover:scale-[1.02]",
                        cancelled && "opacity-50 line-through",
                      )}
                      style={{
                        top: (start - DAY_START) * PX_PER_MIN + 1,
                        height: (end - start) * PX_PER_MIN - 2,
                        left: `calc(${(col / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                        background: `linear-gradient(135deg, ${color}55, ${color}25)`,
                        borderColor: `${color}90`,
                      }}
                      title={`${s.title} • ${s.start_time}–${s.end_time} • ${s.teacher_name} • ${s.room_name}`}
                    >
                      <div className="truncate font-semibold">{s.title}</div>
                      <div className="truncate text-white/80">
                        {s.start_time}–{s.end_time}
                      </div>
                      <div className="truncate text-white/70">📍 {s.room_name}</div>
                      <div className="truncate text-white/70">👤 {s.teacher_name}</div>
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
