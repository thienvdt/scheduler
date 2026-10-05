"use client";

import { useCallback, useMemo, useState } from "react";
import type { Session, Teacher } from "@/shared/types";
import { api } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { addDays, fromISODate, startOfWeek, toISODate, today } from "@/lib/date";
import { downloadText } from "@/lib/download";
import { buildWorkload, hours, workloadCsv } from "@/lib/report";
import { Alert, Button, cn, Field, GlassCard, Input, PageHeader } from "@/components/ui";
import { useTerms } from "@/components/AuthProvider";

function monthRange(offset: number): [string, string] {
  const t = fromISODate(today());
  const first = new Date(t.getFullYear(), t.getMonth() + offset, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + offset + 1, 0);
  return [toISODate(first), toISODate(last)];
}

const PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: "Tuần này", range: () => [startOfWeek(today()), addDays(startOfWeek(today()), 6)] },
  { label: "Tháng này", range: () => monthRange(0) },
  { label: "Tháng trước", range: () => monthRange(-1) },
  { label: "3 tháng gần đây", range: () => [monthRange(-2)[0], monthRange(0)[1]] },
];

export default function ReportsPage() {
  const terms = useTerms();
  const [[from, to], setRange] = useState<[string, string]>(() => monthRange(0));
  const { data: teachers } = useResource(api.teachers.list, [] as Teacher[]);
  const fetchSessions = useCallback(() => api.sessions.list({ from, to }), [from, to]);
  const { data: sessions, loading, error } = useResource(fetchSessions, [] as Session[]);

  const valid = from && to && from <= to;
  const rows = useMemo(() => buildWorkload(sessions, teachers, terms.primaryKinds), [sessions, teachers, terms]);
  const max = Math.max(1, ...rows.map((r) => r.primaryMinutes + r.otherMinutes));
  const totals = rows.reduce(
    (acc, r) => ({
      teaching: acc.teaching + r.primaryMinutes,
      other: acc.other + r.otherMinutes,
      sessions: acc.sessions + r.primarySessions + r.otherSessions,
    }),
    { teaching: 0, other: 0, sessions: 0 },
  );

  return (
    <>
      <PageHeader
        title="Báo cáo khối lượng"
        subtitle={`${terms.primaryHoursLabel}, ${terms.otherHoursLabel.toLowerCase()} theo ${terms.person.toLowerCase()} (gồm cả lịch tham dự, không tính lịch đã huỷ).`}
        actions={
          <Button
            variant="primary"
            disabled={!rows.length}
            onClick={() => downloadText(`bao-cao-khoi-luong-${from}-den-${to}.csv`, workloadCsv(rows, { from, to }, terms), "text/csv;charset=utf-8")}
          >
            ⬇ Xuất Excel (CSV)
          </Button>
        }
      />

      <GlassCard className="mb-4 flex flex-wrap items-end gap-3 p-3">
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => {
            const [pf, pt] = p.range();
            const active = pf === from && pt === to;
            return (
              <Button key={p.label} onClick={() => setRange([pf, pt])} className={cn(active && "bg-white/20")} aria-pressed={active}>
                {p.label}
              </Button>
            );
          })}
        </div>
        <div className="ml-auto flex gap-2">
          <Field label="Từ ngày">
            <Input type="date" value={from} onChange={(e) => setRange([e.target.value, to])} />
          </Field>
          <Field label="Đến ngày">
            <Input type="date" value={to} onChange={(e) => setRange([from, e.target.value])} />
          </Field>
        </div>
      </GlassCard>

      {!valid && (
        <div className="mb-4">
          <Alert>Ngày bắt đầu phải trước ngày kết thúc.</Alert>
        </div>
      )}
      {error && valid && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: terms.primaryHoursLabel, value: hours(totals.teaching) },
          { label: terms.otherHoursLabel, value: hours(totals.other) },
          { label: "Số buổi", value: totals.sessions },
        ].map((s) => (
          <GlassCard key={s.label} className="px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-white/60">{s.label}</div>
            <div className="mt-1 text-2xl font-bold">{s.value}</div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/60">
              <th className="px-4 py-3 font-medium">{terms.person}</th>
              <th className="px-3 py-3 text-right font-medium">{terms.primaryLabel}</th>
              <th className="px-3 py-3 text-right font-medium">Giờ</th>
              <th className="px-3 py-3 text-right font-medium">{terms.otherLabel}</th>
              <th className="px-3 py-3 text-right font-medium">Giờ</th>
              <th className="px-3 py-3 text-right font-medium">Đã huỷ</th>
              <th className="w-1/4 px-4 py-3 font-medium">Tổng giờ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/50">
                  {loading ? "Đang tải…" : "Không có lịch trong khoảng thời gian này."}
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const total = r.primaryMinutes + r.otherMinutes;
              return (
                <tr key={r.teacher.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.teacher.color }} />
                      <span className="font-medium">{r.teacher.name}</span>
                    </div>
                    {r.teacher.department && <div className="pl-[18px] text-xs text-white/50">{r.teacher.department}</div>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.primarySessions}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{hours(r.primaryMinutes)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.otherSessions}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{hours(r.otherMinutes)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-white/60">{r.cancelled}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-white/10" title={`${hours(total)} giờ`}>
                        <div className="h-full bg-gradient-to-r from-indigo-400 to-cyan-400" style={{ width: `${(r.primaryMinutes / max) * 100}%` }} />
                        <div className="h-full bg-fuchsia-400/70" style={{ width: `${(r.otherMinutes / max) * 100}%` }} />
                      </div>
                      <span className="w-12 text-right tabular-nums">{hours(total)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </GlassCard>
      <p className="mt-2 flex gap-4 text-xs text-white/50">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-cyan-400" />
          {terms.primaryLabel}
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-fuchsia-400" />
          {terms.otherLabel}
        </span>
      </p>
    </>
  );
}
