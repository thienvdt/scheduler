"use client";

import { useState } from "react";
import type { Teacher } from "@/shared/types";
import { fold } from "@/lib/voiceParser";
import { cn, Input } from "./ui";

/** Chọn nhiều người tham dự; người chủ trì không có trong danh sách. */
export function ParticipantPicker({
  teachers,
  hostId,
  value,
  onChange,
  disabled,
}: {
  teachers: Teacher[];
  hostId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const candidates = teachers.filter((t) => t.id !== hostId);
  const selected = new Set(value.filter((id) => id !== hostId));
  const host = teachers.find((t) => t.id === hostId);

  const q = fold(query.trim());
  const shown = q
    ? candidates.filter((t) => fold(`${t.name} ${t.department ?? ""}`).includes(q))
    : candidates;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  // Mời nhanh cả khoa/bộ môn của người chủ trì
  const sameDept = host?.department ? candidates.filter((t) => t.department === host.department) : [];

  return (
    <div className="flex flex-col gap-2">
      {!disabled && (
        <div className="flex flex-wrap gap-2">
          {candidates.length > 6 && (
            <Input className="min-w-40 flex-1" placeholder="Tìm người…" value={query} onChange={(e) => setQuery(e.target.value)} />
          )}
          {sameDept.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([...new Set([...selected, ...sameDept.map((t) => t.id)])])}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/15"
            >
              + Cả {host?.department}
            </button>
          )}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/15"
            >
              Bỏ chọn tất cả
            </button>
          )}
        </div>
      )}
      <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
        {(disabled ? candidates.filter((t) => selected.has(t.id)) : shown).map((t) => {
          const on = selected.has(t.id);
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(t.id)}
              aria-pressed={on}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition disabled:cursor-default",
                on ? "border-cyan-300/60 bg-cyan-400/20 text-white" : "border-white/15 bg-white/5 text-white/70 hover:bg-white/15",
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
              {t.name}
              {on && !disabled && <span aria-hidden>✓</span>}
            </button>
          );
        })}
        {disabled && selected.size === 0 && <span className="text-sm text-white/40">Không có</span>}
        {!disabled && shown.length === 0 && <span className="text-sm text-white/40">Không tìm thấy</span>}
      </div>
    </div>
  );
}
