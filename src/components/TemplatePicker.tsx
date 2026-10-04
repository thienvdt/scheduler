"use client";

import Link from "next/link";
import type { Template } from "@/shared/types";
import { KIND_META } from "@/shared/types";
import { formatDuration, templateIcon } from "@/lib/templates";
import { Modal } from "./ui";

export function TemplatePicker({
  templates,
  onClose,
  onPick,
}: {
  templates: Template[];
  onClose: () => void;
  onPick: (t: Template) => void;
}) {
  return (
    <Modal open title="Chọn mẫu lịch" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t)}
            className="glass flex flex-col items-start gap-1 rounded-2xl p-3 text-left transition hover:scale-[1.02] hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          >
            <span className="text-2xl">{templateIcon(t)}</span>
            <span className="font-semibold leading-tight">{t.name}</span>
            <span className="text-xs text-white/60">
              {KIND_META[t.kind].label} · {formatDuration(t.duration_minutes)}
              {t.start_time ? ` · ${t.start_time}` : ""}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-white/60">
        Muốn thêm hoặc sửa mẫu?{" "}
        <Link href="/templates/" className="text-cyan-200 underline">
          Quản lý mẫu lịch
        </Link>
      </p>
    </Modal>
  );
}
