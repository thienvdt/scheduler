"use client";

import type { Session } from "@/shared/types";
import { KIND_META } from "@/shared/types";
import { addDays, formatFull, today } from "@/lib/date";
import { cn, GlassCard } from "./ui";

/** Danh sách lịch theo ngày – dễ đọc trên điện thoại hơn lưới tuần. */
export function AgendaList({
  weekStart,
  sessions,
  onSessionClick,
  onAdd,
}: {
  weekStart: string;
  sessions: Session[];
  onSessionClick: (s: Session) => void;
  onAdd?: (date: string) => void;
}) {
  const todayStr = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex flex-col gap-3">
      {days.map((d) => {
        const items = sessions.filter((s) => s.date === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
        const isToday = d === todayStr;
        return (
          <GlassCard key={d} className={cn("p-3 sm:p-4", isToday && "ring-1 ring-cyan-300/50")}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold">
                {formatFull(d)}
                {isToday && (
                  <span className="rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400 px-2 py-0.5 text-xs text-slate-900">
                    Hôm nay
                  </span>
                )}
              </div>
              {onAdd && (
                <button
                  type="button"
                  onClick={() => onAdd(d)}
                  className="rounded-lg px-2 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white"
                  aria-label={`Thêm lịch ngày ${formatFull(d)}`}
                >
                  +
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-white/40">Không có lịch</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((s) => {
                  const color = s.teacher_color ?? "#60a5fa";
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => onSessionClick(s)}
                        className={cn(
                          "flex w-full items-stretch gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5 text-left transition hover:bg-white/10",
                          s.status === "cancelled" && "opacity-50",
                        )}
                      >
                        <span className="w-1 shrink-0 rounded-full" style={{ background: color }} />
                        <span className="w-14 shrink-0 text-sm tabular-nums">
                          <span className="block font-semibold">{s.start_time}</span>
                          <span className="block text-white/50">{s.end_time}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate font-medium", s.status === "cancelled" && "line-through")}>
                            {KIND_META[s.kind]?.icon} {s.title}
                            {s.class_name && <span className="text-white/60"> · {s.class_name}</span>}
                          </span>
                          <span className="block truncate text-sm text-white/60">
                            📍 {s.room_name} · 👤 {s.teacher_name}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}
