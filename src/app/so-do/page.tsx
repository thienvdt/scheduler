"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Room, Session, Teacher } from "@/shared/types";
import { KIND_META } from "@/shared/types";
import { api } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { addDays, formatFull, today } from "@/lib/date";
import {
  activeAt, fromMinutes, layoutPlan, locatePeople, seatPeople, shortName, toMinutes,
  type Tile,
} from "@/lib/floorplan";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Button, GlassCard, Input, PageHeader } from "@/components/ui";

const DAY_START = 6 * 60;
const DAY_END = 21 * 60;
const STEP = 5;

const nowMinutes = () => {
  const d = new Date();
  return Math.min(DAY_END, Math.max(DAY_START, d.getHours() * 60 + d.getMinutes()));
};

export default function FloorPlanPage() {
  const { terms } = useAuth();
  const [date, setDate] = useState(today);
  const [minutes, setMinutes] = useState(nowMinutes);
  const [playing, setPlaying] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);

  const { data: rooms } = useResource(api.rooms.list, [] as Room[]);
  const { data: people } = useResource(api.teachers.list, [] as Teacher[]);
  const fetchDay = useCallback(() => api.sessions.list({ from: date, to: date }), [date]);
  const { data: sessions, error } = useResource(fetchDay, [] as Session[]);

  // Chạy thời gian: mỗi 0,4 giây tăng 5 phút, tới cuối ngày thì tự dừng
  const running = playing && minutes < DAY_END;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setMinutes((m) => Math.min(m + STEP, DAY_END)), 400);
    return () => clearInterval(t);
  }, [running]);

  function togglePlay() {
    if (running) return setPlaying(false);
    if (minutes >= DAY_END) setMinutes(DAY_START);
    setPlaying(true);
  }

  const plan = useMemo(() => layoutPlan(rooms), [rooms]);
  const where = useMemo(() => locatePeople(people, sessions, minutes, rooms), [people, sessions, minutes, rooms]);
  const seats = useMemo(() => seatPeople(plan, where), [plan, where]);
  const live = useMemo(() => activeAt(sessions, minutes), [sessions, minutes]);
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const busy = [...where.values()].filter((w) => w.role !== "idle").length;
  const roomsInUse = new Set(live.filter((s) => !rooms.find((r) => r.id === s.room_id)?.is_virtual).map((s) => s.room_id)).size;
  const physicalCount = rooms.filter((r) => !r.is_virtual).length;

  function goNow() {
    setDate(today());
    setMinutes(nowMinutes());
  }

  return (
    <>
      <PageHeader
        title="Sơ đồ"
        subtitle={`Ai đang ở ${terms.room.toLowerCase()} nào – ${formatFull(date)}, ${fromMinutes(minutes)}`}
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => setDate(addDays(date, -1))} aria-label="Ngày trước">
              ‹
            </Button>
            <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: "10.5rem" }} aria-label="Ngày" />
            <Button onClick={() => setDate(addDays(date, 1))} aria-label="Ngày sau">
              ›
            </Button>
            <Button onClick={goNow}>Bây giờ</Button>
          </div>
        }
      />

      <GlassCard className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <Button variant="primary" onClick={togglePlay} data-testid="play" className="w-28">
          {running ? "⏸ Dừng" : "▶ Chạy"}
        </Button>
        <span className="w-14 font-mono text-xl font-semibold tabular-nums" data-testid="clock">
          {fromMinutes(minutes)}
        </span>
        <input
          type="range"
          min={DAY_START}
          max={DAY_END}
          step={STEP}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="min-w-40 flex-1 accent-cyan-400"
          aria-label="Thời điểm trong ngày"
          data-testid="time"
        />
        <div className="flex gap-4 text-sm text-white/70">
          <span>
            <b className="text-white">{live.length}</b> lịch đang diễn ra
          </span>
          <span>
            <b className="text-white">{roomsInUse}</b>/{physicalCount} {terms.room.toLowerCase()} có người
          </span>
          <span>
            <b className="text-white">{busy}</b>/{people.length} {terms.people.toLowerCase()} đang bận
          </span>
        </div>
      </GlassCard>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {rooms.length === 0 ? (
        <Alert tone="info">Chưa có {terms.room.toLowerCase()} nào. Thêm phòng hoặc nạp dữ liệu mẫu ở Cài đặt để xem sơ đồ.</Alert>
      ) : (
        <GlassCard className="mb-4 overflow-x-auto p-2">
          <svg
            viewBox={`0 0 ${plan.width} ${plan.height}`}
            className="h-auto w-full min-w-[640px]"
            role="img"
            aria-label={`Sơ đồ ${terms.room.toLowerCase()} lúc ${fromMinutes(minutes)}`}
            data-testid="plan"
          >
            {plan.tiles.map((tile) => (
              <TileView key={tile.id} tile={tile} sessions={sessions} live={live} minutes={minutes} loungeLabel={`Phòng chờ · ${terms.people.toLowerCase()} đang rảnh`} />
            ))}
            {people.map((p) => {
              const seat = seats.get(p.id);
              const w = where.get(p.id);
              if (!seat || !w) return null;
              const dim = focus && focus !== p.id && w.session?.id !== where.get(focus)?.session?.id;
              return (
                <g
                  key={p.id}
                  style={{ transform: `translate(${seat.x}px, ${seat.y}px)`, transition: "transform 1.2s ease-in-out, opacity .3s", opacity: dim ? 0.25 : 1 }}
                  onMouseEnter={() => setFocus(p.id)}
                  onMouseLeave={() => setFocus(null)}
                  onClick={() => setFocus((f) => (f === p.id ? null : p.id))}
                  className="cursor-pointer"
                  data-person={p.name}
                  data-place={w.tileId}
                >
                  <title>
                    {p.name}
                    {w.session ? ` – ${w.role === "host" ? "chủ trì" : "tham dự"} “${w.session.title}” ${w.session.start_time}–${w.session.end_time}` : " – đang rảnh"}
                  </title>
                  {w.role === "host" && <circle r={20} fill="none" stroke={p.color} strokeWidth={2} strokeDasharray="3 3" opacity={0.9} />}
                  <circle r={15} fill={p.color} stroke="rgba(255,255,255,.85)" strokeWidth={1.5} />
                  <text textAnchor="middle" dy="0.35em" fontSize={8.5} fontWeight={700} fill="#0b1026">
                    {shortName(p.name)}
                  </text>
                </g>
              );
            })}
          </svg>
        </GlassCard>
      )}

      <RoomStatus rooms={rooms} sessions={sessions} live={live} minutes={minutes} personById={personById} terms={terms} />
    </>
  );
}

function TileView({ tile, sessions, live, minutes, loungeLabel }: { tile: Tile; sessions: Session[]; live: Session[]; minutes: number; loungeLabel: string }) {
  const { x, y, w, h } = tile;
  if (tile.kind === "lounge" || tile.kind === "online") {
    const online = tile.kind === "online";
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={16} fill={online ? "rgba(34,211,238,.07)" : "rgba(255,255,255,.04)"} stroke="rgba(255,255,255,.18)" strokeDasharray={online ? "6 5" : undefined} />
        <text x={x + 14} y={y + 26} fontSize={14} fontWeight={600} fill="#eef2ff">
          {online ? "🌐 Trực tuyến & bên ngoài" : "☕ " + loungeLabel}
        </text>
        {online && (
          <text x={x + 14} y={y + 44} fontSize={11} fill="rgba(238,242,255,.6)">
            {(tile.virtualRooms ?? []).map((r) => r.name).join(" · ")}
          </text>
        )}
        {!online && (
          <>
            {/* Ghế sofa và bàn nước cho có không khí phòng chờ */}
            <rect x={x + w - 120} y={y + 16} width={100} height={16} rx={8} fill="rgba(129,140,248,.25)" />
            <rect x={x + w - 92} y={y + 38} width={44} height={10} rx={5} fill="rgba(251,191,36,.25)" />
          </>
        )}
      </g>
    );
  }

  const room = tile.room!;
  const now = live.find((s) => s.room_id === room.id);
  const next = sessions
    .filter((s) => s.room_id === room.id && s.status === "scheduled" && toMinutes(s.start_time) > minutes)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
  const color = now?.teacher_color ?? "rgba(255,255,255,.2)";
  const desks = Math.min(8, Math.max(4, Math.round((room.capacity ?? 24) / 4)));
  const progress = now ? (minutes - toMinutes(now.start_time)) / (toMinutes(now.end_time) - toMinutes(now.start_time)) : 0;

  return (
    <g data-room={room.name}>
      <rect x={x} y={y} width={w} height={h} rx={14} fill={now ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.04)"} stroke={color} strokeWidth={now ? 2.5 : 1} />
      {/* Cửa ra vào */}
      <rect x={x + w - 46} y={y + h - 2} width={30} height={4} fill="#0b1026" />
      {/* Bảng và bục giảng */}
      <rect x={x + w / 2 - 46} y={y + 10} width={92} height={7} rx={2} fill="rgba(52,211,153,.35)" />
      <rect x={x + w / 2 - 18} y={y + 58} width={36} height={8} rx={3} fill="rgba(251,191,36,.35)" />
      {/* Bàn học */}
      {Array.from({ length: desks }, (_, i) => {
        const perRow = 4;
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        return <rect key={i} x={x + 24 + col * ((w - 48) / perRow)} y={y + 104 + row * 22} width={(w - 48) / perRow - 10} height={6} rx={2} fill="rgba(255,255,255,.08)" />;
      })}
      <text x={x + 12} y={y + 28} fontSize={13} fontWeight={700} fill="#eef2ff">
        {room.name}
      </text>
      {room.capacity != null && (
        <text x={x + w - 12} y={y + 28} fontSize={10} textAnchor="end" fill="rgba(238,242,255,.5)">
          {room.capacity} chỗ
        </text>
      )}
      <text x={x + 12} y={y + h - 26} fontSize={11} fontWeight={600} fill={now ? "#eef2ff" : "rgba(238,242,255,.45)"}>
        {now ? `${KIND_META[now.kind].icon} ${truncate(now.title, 22)}${now.class_name ? ` · ${truncate(now.class_name, 10)}` : ""}` : "Trống"}
      </text>
      <text x={x + 12} y={y + h - 12} fontSize={10} fill="rgba(238,242,255,.55)">
        {now ? `${now.start_time}–${now.end_time} · ${1 + now.participant_ids.length} người` : next ? `Tiếp: ${next.start_time} ${truncate(next.title, 20)}` : "Hết lịch hôm nay"}
      </text>
      {now && <rect x={x} y={y + h - 4} width={w * Math.min(1, Math.max(0, progress))} height={4} rx={2} fill={color} opacity={0.8} />}
    </g>
  );
}

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function RoomStatus({
  rooms, sessions, live, minutes, personById, terms,
}: {
  rooms: Room[];
  sessions: Session[];
  live: Session[];
  minutes: number;
  personById: Map<string, Teacher>;
  terms: { room: string; person: string };
}) {
  const rows = [...rooms].sort((a, b) => a.is_virtual - b.is_virtual || a.name.localeCompare(b.name, "vi", { numeric: true }));
  return (
    <GlassCard className="overflow-x-auto p-4">
      <h2 className="mb-3 text-lg font-semibold">Tình trạng {terms.room.toLowerCase()} lúc {fromMinutes(minutes)}</h2>
      <table className="w-full min-w-[640px] text-left text-sm" data-testid="room-status">
        <thead className="text-xs uppercase tracking-wide text-white/50">
          <tr>
            <th className="py-2 pr-3 font-medium">{terms.room}</th>
            <th className="py-2 pr-3 font-medium">Đang diễn ra</th>
            <th className="py-2 pr-3 font-medium">Chủ trì</th>
            <th className="py-2 pr-3 font-medium">Số người</th>
            <th className="py-2 font-medium">Tiếp theo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const now = live.filter((s) => s.room_id === r.id);
            const next = sessions
              .filter((s) => s.room_id === r.id && s.status === "scheduled" && toMinutes(s.start_time) > minutes)
              .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
            return (
              <tr key={r.id} className="border-t border-white/10 align-top">
                <td className="py-2 pr-3 font-medium">
                  {r.is_virtual ? "🌐 " : ""}
                  {r.name}
                </td>
                <td className="py-2 pr-3">
                  {now.length ? (
                    now.map((s) => (
                      <div key={s.id}>
                        {KIND_META[s.kind].icon} {s.title}
                        {s.class_name ? ` · ${s.class_name}` : ""} <span className="text-white/50">({s.start_time}–{s.end_time})</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-white/40">Trống</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  {now.map((s) => (
                    <div key={s.id} className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: personById.get(s.teacher_id)?.color }} />
                      {s.teacher_name ?? personById.get(s.teacher_id)?.name}
                    </div>
                  ))}
                </td>
                <td className="py-2 pr-3 tabular-nums">{now.reduce((n, s) => n + 1 + s.participant_ids.length, 0) || ""}</td>
                <td className="py-2 text-white/60">{next ? `${next.start_time} ${next.title}` : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </GlassCard>
  );
}
